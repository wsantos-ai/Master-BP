# Quickstart — Validação da feature

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
| **Contratos**: [contracts/api.md](./contracts/api.md), [contracts/assistant-output.md](./contracts/assistant-output.md)

Guia para subir o app e provar que a feature funciona ponta a ponta. Cenários mapeados aos
critérios de sucesso da spec. Detalhes de modelo e rota ficam nos artefatos linkados — aqui só
o que se roda e o que se espera ver.

## Pré-requisitos

- Node.js 20 LTS
- Chave do Gemini disponível
- Os cinco prompts presentes em `lib/agentes/` — o app não sobe sem eles (R-06)

## Setup

```powershell
npm install
Copy-Item .env.example .env.local
# preencher em .env.local:
#   GEMINI_API_KEY=<sua chave>
#   AUTH_SECRET=<segredo de sessão>
#   CHAVE_CRIPTO=<chave de 32 bytes em base64, para os campos cifrados>
#   DATABASE_URL="file:./dev.db"

npx prisma migrate dev
npm run seed        # semeia os 5 assistentes e um BP de teste
npm run dev
```

App em `http://localhost:3000`. Entrar com o usuário semeado.

## Comandos de verificação

```powershell
npm run test:unit          # portão de lacunas, detecção de risco, schemas, cifragem
npm run test:integration   # rotas, propriedade do atendimento, auditoria, retenção
npm run test:risco         # bateria de regressão do Princípio III — deve passar 100%
npm run test:e2e           # Playwright, uma suíte por história
```

`npm run test:risco` é portão de merge: qualquer falso negativo reprova (SC-004).

---

## Cenário 1 — Roteamento e refinamento (US1, P1)

1. Novo atendimento. Digitar: *"minha equipe está com turnover alto e o gestor não sabe
   conduzir feedback"*.
2. **Esperado**: o app indica **Mentoria estratégica** com justificativa visível (FR-002).
3. Trocar manualmente para outro assistente e confirmar que o atendimento segue com o escolhido
   (FR-003). Voltar e refazer com a indicação aceita.
4. Na tela do atendimento, tentar **Emitir entrega** antes de responder as perguntas.
5. **Esperado**: a entrega **não** é produzida. Aparecem as perguntas pendentes e o porquê de
   cada uma (FR-007, SC-005). O painel lateral mostra o que ainda falta (FR-009).
6. Responder todas as lacunas críticas; marcar uma não crítica como "não se aplica" com
   justificativa (FR-008).
7. Emitir a entrega.
8. **Esperado**: documento com as seções obrigatórias da especialidade e plano de ação com
   responsáveis e prazos (FR-010, FR-011, SC-003).

**Verificação negativa**: com uma lacuna crítica ainda aberta, chamar
`POST /api/atendimentos/[id]/entrega` direto (fora da UI) deve retornar
`422 REFINAMENTO_INCOMPLETO` — o portão é do servidor, não da tela.

---

## Cenário 2 — Escalonamento de risco (US1, cenário 5 — Princípio III)

1. Novo atendimento com um relato de assédio moral em termos explícitos.
2. **Esperado**: recomendação de validação jurídica/Compliance em destaque, **acima** do plano
   de ação (FR-012).
3. Repetir com um relato que **descreve** a conduta sem usar a palavra "assédio" — humilhação
   reiterada em público, por exemplo.
4. **Esperado**: escalonamento igualmente sinalizado, agora com `origemDeteccao = "modelo"`
   (R-05). Nenhum dos dois casos pode passar sem sinalização (SC-004).
5. Pedir explicitamente uma punição ao colaborador sem ter registrado fatos apurados.
6. **Esperado**: a sugestão punitiva é recusada, com explicação (FR-013).

---

## Cenário 3 — Continuidade e isolamento (US2)

1. Iniciar um atendimento, responder parte das perguntas, fechar o navegador.
2. Reabrir: o atendimento consta **em andamento** e retoma da próxima pergunta pendente
   (SC-008).
3. No histórico, filtrar por especialidade e por período — só os correspondentes aparecem
   (FR-016).
4. Reabrir um atendimento concluído: entrega e diálogo completo visíveis (FR-014).
5. **Isolamento**: autenticado como o BP B, chamar `GET /api/atendimentos/[id]` com o id de um
   atendimento do BP A.
6. **Esperado**: `404` — não `403`, para não confirmar a existência do registro (FR-017, SC-006).

---

## Cenário 4 — Exportação e sigilo (US3)

1. Concluir um atendimento de **comunicação de liderança** e exportar.
2. **Esperado**: títulos, tópicos e tabelas preservados no arquivo (FR-021).
3. Concluir um atendimento de **ética e compliance** e exportar.
4. **Esperado**: o documento carrega marcação de sigilo e a nota de guarda em local seguro de
   acesso restrito (FR-022).
5. Consultar a trilha de auditoria.
6. **Esperado**: registros de acesso e exportação com autor, data/hora e ação (FR-024, SC-009).

---

## Cenário 5 — Entrada por voz (US4)

1. Gravar um relato falado de ~60 s.
2. **Esperado**: transcrição exibida para revisão e edição **antes** de o assistente recebê-la
   (FR-020).
3. Corrigir um erro na transcrição e enviar — o assistente recebe o texto corrigido.
4. Enviar um áudio inaudível.
5. **Esperado**: falha informada com oferta de digitação; o rascunho não se perde.
6. **Verificar** que nenhum arquivo de áudio foi persistido (R-09).

---

## Cenário 6 — Retenção e ciclo de vida (Princípio I)

Executados como testes de integração com relógio simulado — não manualmente:

1. Atendimento sem interação há 91 dias → encerrado como **incompleto** (FR-018).
2. Atendimento concluído há 24 meses e 1 dia → conteúdo não recuperável (FR-026, SC-011).
3. Após o expurgo, o `RegistroAuditoria` continua existindo, anonimizado (R-11).
4. Exclusão a pedido do BP → conteúdo apagado, auditoria registrada (FR-027).

---

## Cenário 7 — Integridade dos prompts canônicos (Princípio IV)

1. Concluir um atendimento e consultar seu `promptHash`.
2. Alterar uma linha do prompt da especialidade em `lib/agentes/`.
3. Iniciar um novo atendimento na mesma especialidade.
4. **Esperado**: o novo `promptHash` difere do anterior — é possível saber com qual versão do
   prompt cada entrega foi produzida (R-06).
5. **Verificar** que o app não alterou nenhum arquivo em `lib/agentes/`.

---

## Sinais de que algo está errado

| Sintoma | Provável causa |
|---|---|
| Entrega sai sem uma seção obrigatória | Schema Zod da especialidade não está sendo aplicado antes de persistir (R-02) |
| Entrega sai com lacuna crítica aberta | O portão foi movido para a UI; ele pertence ao servidor (R-01) |
| Relato de assédio sem escalonamento | Uma das duas camadas de detecção está desligada (R-05) |
| BP enxerga atendimento de outro | Filtro de propriedade ausente na consulta, não só na tela (R-07) |
| Conteúdo de atendimento aparecendo em log | Violação direta do Princípio I — bloquear antes de qualquer deploy |
