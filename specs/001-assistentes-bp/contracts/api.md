# Contract — Rotas HTTP

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

Route Handlers do Next.js sob `app/api/`. Todas as rotas exigem sessão autenticada (FR-028) e
respondem em pt-BR. Corpo de requisição e resposta validados por Zod nas duas direções.

## Convenções

- **Autorização**: toda rota que toca um atendimento filtra por `autorId = sessao.userId` na
  consulta. Atendimento de outro usuário responde `404`, nunca `403` — não confirmar existência
  é parte da proteção (FR-017, SC-006).
- **Erros**: `{ erro: { codigo, mensagem, detalhes? } }`. `mensagem` é legível ao BP em pt-BR.
- **Auditoria**: rotas marcadas 🔒 gravam `RegistroAuditoria` quando o atendimento é sensível.
- **Nenhum conteúdo de atendimento em log**, incluindo mensagens de erro de validação.

---

## `POST /api/roteamento`

Indica a especialidade a partir do relato (FR-002, FR-004, FR-005).

**Entrada**: `{ relato: string (1..20000) }`

**Saída 200**:
```
{
  sugestoes: [ { assistenteId, nome, justificativa, confianca } ],  // 1..2 itens
  ambigua: boolean,        // true ⟹ a UI apresenta as opções sem pré-selecionar (FR-004)
  foraDeEscopo: boolean,
  motivoRecusa?: string    // preenchido quando foraDeEscopo (FR-005)
}
```

**Regras**: `foraDeEscopo = true` ⟹ `sugestoes` vazio e a criação de atendimento é bloqueada.
Duas sugestões com confiança próxima ⟹ `ambigua = true`.

**Erros**: `400` relato vazio ou acima do limite (`RELATO_MUITO_EXTENSO`, com orientação para
segmentar — sem truncar).

---

## `POST /api/atendimentos`

Cria o atendimento e a primeira rodada de lacunas.

**Entrada**: `{ relato, assistenteId, origemRelato: "texto" | "audio", trocaManual: boolean }`

**Saída 201**: `{ id, assistenteId, estado: "em_andamento", classificacaoSigilo, lacunasAbertas: [ { id, pergunta, ordem } ], escalonamentos: [...] }`

**Efeitos**: registra `promptHash`; roda a detecção de risco sobre o relato (R-05); classifica
sigilo; grava auditoria se sensível.

---

## `GET /api/atendimentos`

Histórico do BP autenticado (FR-016).

**Query**: `especialidade?`, `de?`, `ate?`, `estado?`, `pagina?`, `porPagina?` (máx. 50)

**Saída 200**: `{ itens: [ { id, assistenteNome, estado, classificacaoSigilo, criadoEm, concluidoEm, resumo } ], total, pagina }`

**Regras**: `resumo` é metadado gerado, não trecho do relato cifrado. Filtros operam apenas
sobre metadados em claro (data-model, regra transversal 5).

---

## `GET /api/atendimentos/[id]` 🔒

Reabre o atendimento com diálogo e entrega (FR-014, FR-016).

**Saída 200**: `{ atendimento, lacunas: [...], mensagens: [...], entrega: Entrega | null, escalonamentos: [...] }`

**Erros**: `404` se não existir **ou** não pertencer ao usuário.

---

## `POST /api/atendimentos/[id]/mensagens`

Uma rodada de refinamento. Resposta transmitida por streaming (R-10).

**Entrada**: uma das duas formas —
`{ tipo: "resposta", lacunaId, conteudo }` ou
`{ tipo: "nao_aplicavel", lacunaId, justificativa }` (FR-008)

**Saída 200**: stream de texto, seguido de um quadro final:
```
{ lacunasAbertas: [...], lacunasResolvidas: n, novosEscalonamentos: [...], prontoParaEntrega: boolean }
```

**Efeitos**: atualiza `ultimaInteracaoEm`; roda detecção de risco sobre a resposta do BP;
persiste as mensagens; pode criar novas lacunas.

**Regras**: `prontoParaEntrega` é calculado pelo servidor — ausência de lacuna crítica aberta.
É o mesmo predicado que a rota de entrega aplica; a UI não decide.

**Erros**: `409` se o atendimento não estiver `em_andamento`.

---

## `POST /api/atendimentos/[id]/entrega`

Emite a entrega final. **Aqui vive o portão do Princípio II.**

**Entrada**: `{}`

**Saída 200**: `{ entrega: { estruturaAplicada, conteudo, planoAcao, marcacaoSigilo, notaGuarda? }, escalonamentos: [...] }`

**Saída 422 — lacunas em aberto** (o caso que a constituição protege):
```
{ erro: { codigo: "REFINAMENTO_INCOMPLETO",
          mensagem: "Faltam informações para concluir com segurança.",
          detalhes: { lacunasPendentes: [ { id, pergunta, porQueImporta } ] } } }
```

**Regras**:
- Recusa determinística enquanto houver lacuna crítica `aberta` (FR-007, SC-005).
- Saída do modelo validada contra o schema da especialidade antes de persistir; falha ⟹ até 2
  retentativas; persistindo ⟹ `502 ESTRUTURA_INVALIDA`, sem gravar entrega parcial (SC-003).
- Havendo escalonamento, ele é retornado em campo próprio para renderização **acima** do plano
  de ação (FR-012).
- Sugestão punitiva sem fatos registrados no atendimento é rejeitada (FR-013).
- Sucesso ⟹ `estado = concluido`, `concluidoEm = agora`, `expurgarEm = agora + 24 meses`.

---

## `POST /api/atendimentos/[id]/exportacao` 🔒

Exporta a entrega preservando estrutura (FR-021, FR-022).

**Entrada**: `{ formato: "docx" | "pdf" | "markdown" }`

**Saída 200**: arquivo binário ou texto, com `Content-Disposition: attachment`.

**Regras**: entrega `restrito` ⟹ documento carrega marcação de sigilo e nota de guarda em local
seguro de acesso restrito. Sempre grava auditoria (SC-009).

**Erros**: `409` se o atendimento não tiver entrega concluída.

---

## `DELETE /api/atendimentos/[id]` 🔒

Exclusão a pedido do BP antes do prazo de retenção (FR-027).

**Saída 204**. Apaga conteúdo, mantém `RegistroAuditoria` com `acao = exclusao`.

---

## `POST /api/transcricao`

Áudio → texto para a US4 (FR-020).

**Entrada**: `multipart/form-data` com o arquivo de áudio (máx. 10 min / 25 MB).

**Saída 200**: `{ texto }` — devolvido para revisão e edição, **sem** iniciar atendimento.

**Regras**: o áudio é descartado após a transcrição, nunca persistido (R-09).

**Erros**: `422 TRANSCRICAO_FALHOU` com mensagem orientando a entrada por digitação — o
atendimento em rascunho não é perdido (US4, cenário 3).

---

## `GET /api/assistentes`

Catálogo para seleção manual (FR-003).

**Saída 200**: `{ itens: [ { id, nome, descricao, dominios, sensivelPorPadrao } ] }` — apenas
assistentes `ativo = true`.
