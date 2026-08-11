# Quickstart — Validação da migração para o OpenRouter

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
| **Contrato**: [contracts/provedor-ia.md](./contracts/provedor-ia.md) | **Pesquisa**: [research.md](./research.md)

Guia para validar que a plataforma opera inteiramente sobre o OpenRouter. Os cenários estão
mapeados aos critérios de sucesso da spec. Detalhes de requisição e schema ficam no contrato —
aqui só o que se roda e o que se espera ver.

## Pré-requisitos

- Node.js 20 LTS, banco PostgreSQL acessível e a aplicação da feature 001 já funcionando
- Conta no OpenRouter com crédito e uma chave de API
- **Passo obrigatório fora do código** (FR-011, R-05): nas configurações de privacidade da conta,
  desativar o roteamento para provedores que treinam sobre os dados — para modelos pagos **e**
  gratuitos. Sem isso, o Princípio I não está satisfeito, ainda que o código envie
  `data_collection: "deny"`.

## Setup

```powershell
npm install                    # @google/genai deve sair do node_modules
Copy-Item .env.example .env.local
# preencher em .env.local:
#   OPENROUTER_API_KEY=<sua chave>
#   AUTH_SECRET=<segredo de sessão>
#   CHAVE_CRIPTO=<32 bytes em base64>
#   DATABASE_URL=<postgres://...>
#
# opcionais — só se o ambiente precisar de modelo diferente do padrão:
#   OPENROUTER_MODELO_RAPIDO / OPENROUTER_MODELO_CAPAZ / OPENROUTER_MODELO_TRANSCRICAO

npm run dev
```

Nenhuma migração de banco é necessária: esta feature não altera o schema.

**Remova `GEMINI_API_KEY` do `.env.local`.** Ela não é mais lida, e mantê-la só cria a ilusão de
que o ambiente ainda tem um provedor de reserva — não tem (FR-015).

## Comandos de verificação

```powershell
npm run test:unit          # inclui os dois arquivos novos: schema estrito e mapeamento de erro
npm run test:integration   # rotas, propriedade, auditoria, retenção
npm run test:risco         # portão de merge — deve permanecer 100% verde após a troca de modelo
npm run test:e2e           # Playwright, uma suíte por história

npx tsx scripts/diagnostico-ia.ts   # chamada real: roteamento, refinamento e transcrição
```

Toda a suíte roda **sem** `OPENROUTER_API_KEY` configurada (FR-014). Se algum teste passar a
exigir credencial, é regressão de desenho, não de ambiente.

---

## Cenários

### Cenário 1 — Ciclo completo no novo provedor (US1, SC-001, SC-003)

1. Entrar como o BP semeado e abrir um novo atendimento.
2. Relatar uma demanda clara de gestão de pessoas ("turnover alto na equipe e o gestor não
   conduz feedback").
3. Aceitar a especialidade indicada, responder às perguntas de refinamento até o portão liberar.
4. Solicitar a entrega final.

**Esperado**: indicação de especialidade com justificativa em até ~5 s; entrega final completa,
com todas as seções obrigatórias da especialidade e plano de ação com responsáveis e prazos, em
até ~30 s. Repetir para as cinco especialidades — todas devem produzir entrega aprovada (SC-001).

### Cenário 2 — Recusa de demanda fora de escopo (US1)

Relatar "preciso configurar o roteador da filial".

**Esperado**: criação do atendimento bloqueada, com motivo em português do Brasil. O comportamento
não pode ter mudado com a troca de modelo.

### Cenário 3 — Estrutura obrigatória e o que acontece quando o modelo erra (US2, SC-002)

Este cenário não depende do provedor: é exercido pelos testes com dublê.

```powershell
npm run test:unit
```

**Esperado**: resposta fora do schema é descartada e retentada; esgotadas as 3 tentativas, erro
explícito e **nada gravado**. Verificar no banco que nenhuma linha em `entregas` corresponde ao
atendimento da falha.

Complemento com provedor real: em 30 execuções de entrega, ao menos 95% aprovadas na primeira
tentativa (SC-002). Contar pelas ocorrências de `ia.schema_reprovado` no log.

### Cenário 4 — Erro de configuração distinguível de indisponibilidade (US3)

1. Remover `OPENROUTER_API_KEY` do ambiente e tentar criar um atendimento.
2. Repor uma chave inválida e repetir.

**Esperado**: nos dois casos, "Os assistentes não estão configurados neste ambiente. Verifique a
chave do provedor." — e **nenhuma retentativa** no log (o registro deve mostrar uma única
ocorrência, não três). Uma falha 429 ou 5xx, por contraste, produz "provedor indisponível".

```powershell
npx tsx scripts/diagnostico-ia.ts
```

**Esperado**: relata presença da credencial, os três modelos configurados, e o resultado de cada
etapa — roteamento, refinamento e transcrição — separadamente.

### Cenário 5 — Rastreabilidade do modelo (US3, SC-005)

Após concluir uma entrega, consultar a linha correspondente em `entregas`.

**Esperado**: `versaoModelo` = `deepseek/deepseek-v4-flash-0731` (ou o identificador configurado).
Entregas geradas antes da migração mantêm o identificador Gemini — as duas gerações permanecem
distinguíveis.

### Cenário 6 — Entrada por voz com provedor único (US4, SC-008, SC-009)

1. Com apenas `OPENROUTER_API_KEY` configurada, gravar um relato falado em português do Brasil.
2. Repetir com uma gravação ruidosa ou muito curta.
3. Repetir com silêncio.

**Esperado**:

- áudio audível → texto literal apresentado para revisão, sem resumo nem tradução;
- áudio ruim → sinalização de baixa confiança;
- silêncio → "não foi possível identificar fala", com a orientação de digitar o relato;
- em nenhum caso o áudio permanece armazenado (verificar `entregas`, `atendimentos`, disco da
  aplicação e qualquer storage — SC-009).

Testar também os formatos: o `MediaRecorder` do Chrome produz `audio/webm`; o do Safari,
`audio/mp4`. Ambos devem funcionar.

### Cenário 7 — Recusa antes da rede (US4, FR-015)

Enviar um PDF renomeado como áudio e um arquivo acima de 25 MB para `/api/transcricao`.

**Esperado**: recusa com mensagem em português do Brasil e **nenhuma chamada ao provedor** —
verificável no teste unitário, onde o dublê não é invocado.

### Cenário 8 — Escalonamento de risco preservado (SC-004)

```powershell
npm run test:risco
```

**Esperado**: 100% verde. Complementar com um relato de assédio pela interface e conferir que a
recomendação de validação com Jurídico/RT/Compliance aparece acima do plano de ação — a camada
determinística não depende de provedor, mas a camada do modelo mudou de modelo.

### Cenário 9 — Log sem conteúdo de atendimento (SC-006)

Forçar falhas do provedor (chave inválida, depois um modelo inexistente em
`OPENROUTER_MODELO_CAPAZ`) durante um atendimento com relato reconhecível.

**Esperado**: nenhum registro contém trecho do relato, resposta de refinamento, nome de pessoa,
corpo de resposta do provedor ou a credencial. Apenas `evento`, `status`, `motivo`, `tentativa` e
`modelo`.

### Cenário 10 — Ambiente novo só com a documentação (SC-007)

Em uma máquina limpa, seguir apenas o README atualizado — sem abrir código-fonte — até a
aplicação responder a um atendimento completo.

**Esperado**: sucesso. Se faltar algum passo, o README é que está incompleto.

---

## Checagem final de migração

- [ ] `@google/genai` ausente de `package.json` e de `package-lock.json`
- [ ] Nenhuma ocorrência de `GEMINI` no código, em `.env.example` ou no README
- [ ] `lib/ia/gemini.ts` removido
- [ ] `provider.data_collection: "deny"` e `zdr: true` presentes nas duas rotas do provedor
- [ ] Política de treinamento desativada na conta do OpenRouter
- [ ] `lib/agentes/*.md` sem nenhuma alteração (`git diff --stat lib/agentes/`)
- [ ] `lib/dominio/` sem nenhuma alteração
- [ ] Nenhuma migração Prisma nova
