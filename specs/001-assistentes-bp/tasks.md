---

description: "Task list for App de Assistentes Especializados para Business Partner"
---

# Tasks: App de Assistentes Especializados para Business Partner

**Input**: Design documents from `/specs/001-assistentes-bp/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Incluídos e obrigatórios. Não por preferência de TDD, mas porque a constituição
exige: SC-004 não tolera falso negativo em escalonamento, SC-005 não tolera entrega com lacuna
aberta e SC-006 não tolera vazamento entre BPs. Esses três critérios só são verificáveis com
teste determinístico sobre a lógica de `lib/dominio/`. Testes de UI e de casos felizes ficam no
E2E de cada história.

**Organization**: Tarefas agrupadas por história de usuário, permitindo implementar e testar
cada uma de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: US1, US2, US3, US4 — mapeia para as histórias da spec
- Caminhos de arquivo exatos nas descrições

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialização do projeto e ferramental

- [X] T001 Inicializar projeto Next.js 15 com App Router e TypeScript 5.x na raiz do repositório, com `tsconfig.json` em modo estrito
- [X] T002 [P] Configurar ESLint e Prettier em `eslint.config.mjs` e `.prettierrc`, incluindo regra que proíbe `console.log` fora de `lib/observabilidade/`
- [X] T003 [P] Instalar e configurar Prisma com provider SQLite em `prisma/schema.prisma` e `DATABASE_URL="file:./dev.db"`
- [X] T004 [P] Instalar Zod e criar `lib/validacao/index.ts` como ponto único de exportação dos schemas compartilhados
- [X] T005 [P] Instalar `@google/genai` e criar `.env.example` com `GEMINI_API_KEY`, `AUTH_SECRET`, `CHAVE_CRIPTO` e `DATABASE_URL`
- [X] T006 [P] Configurar Vitest em `vitest.config.ts` com projetos separados `unit` e `integration`
- [X] T007 [P] Configurar Playwright em `playwright.config.ts` apontando para `tests/e2e/`
- [X] T008 Definir scripts em `package.json`: `dev`, `build`, `seed`, `test:unit`, `test:integration`, `test:risco`, `test:e2e`
- [X] T009 [P] Criar `lib/observabilidade/logger.ts` com política explícita de nunca registrar conteúdo de atendimento (Princípio I)
- [X] T010 [P] Configurar `app/layout.tsx` com `lang="pt-BR"` e formatação de data/hora em pt-BR (FR-029)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura que TODA história depende

**⚠️ CRITICAL**: Nenhuma história pode começar antes desta fase terminar

### Persistência

- [X] T011 Modelar `Usuario`, `Assistente` e `Atendimento` em `prisma/schema.prisma` conforme [data-model.md](./data-model.md), sem `enum` e sem tipo `Json` (restrição R-03)
- [X] T012 Modelar `Lacuna`, `MensagemRefinamento` e `Entrega` em `prisma/schema.prisma` com as relações e invariantes do data-model
- [X] T013 Modelar `SinalizacaoEscalonamento` e `RegistroAuditoria` em `prisma/schema.prisma`
- [X] T014 Criar índices `(autorId, criadoEm)`, `(estado, ultimaInteracaoEm)` e `(expurgarEm)` em `prisma/schema.prisma` e gerar a migração inicial
- [X] T015 Criar `lib/dados/prisma.ts` com instância única do client, segura para hot reload em desenvolvimento

### Controles transversais do Princípio I

- [X] T016 Implementar cifragem AES-256-GCM de campos sensíveis em `lib/dados/cripto.ts`, com chave derivada de `CHAVE_CRIPTO` (R-08)
- [X] T017 [P] Escrever testes de ida e volta da cifragem em `tests/unit/cripto.test.ts`, incluindo falha em chave ausente ou inválida
- [X] T018 Implementar `lib/dados/auditoria.ts` com registro de `acesso`, `exportacao`, `exclusao` e `expurgo_retencao` (FR-024)
- [X] T019 Implementar guarda de propriedade em `lib/dados/atendimentos.ts`, aplicando `autorId = sessao.userId` na consulta — nunca só na UI (FR-017)

### Prompts canônicos e catálogo

- [X] T020 Implementar `lib/assistentes/prompt-loader.ts` lendo `lib/agentes/*.md` em modo somente leitura e calculando SHA-256 do conteúdo (R-06)
- [X] T021 [P] Escrever teste em `tests/unit/prompt-loader.test.ts` verificando que o hash muda quando o prompt muda e que a aplicação nunca escreve nesses arquivos
- [X] T022 Criar `lib/assistentes/catalogo.ts` com as cinco especialidades, seus domínios, arquivo de prompt e identificador de estrutura de entrega (FR-001)
- [X] T023 Criar `prisma/seed.ts` semeando os cinco assistentes a partir do catálogo e um BP de teste

### Integração com o modelo

- [X] T024 Implementar cliente Gemini em `lib/ia/gemini.ts`, com `GEMINI_API_KEY` lida apenas no servidor e seleção de modelo por rota (research.md, pontos a confirmar)
- [X] T025 Implementar helper em `lib/ia/saida-estruturada.ts` que deriva o `responseSchema` do schema Zod, valida a resposta e aplica até 2 retentativas (R-02)
- [X] T026 [P] Escrever teste em `tests/unit/saida-estruturada.test.ts` cobrindo JSON inválido, schema reprovado e esgotamento de retentativas sem persistir nada

### Autenticação

- [X] T027 Configurar Auth.js (NextAuth v5) com provedor de credenciais e sessão em cookie `httpOnly` em `auth.ts` e `app/api/auth/[...nextauth]/route.ts` (R-07)
- [X] T028 Criar tela de login em `app/(auth)/entrar/page.tsx` e middleware de proteção de rotas em `middleware.ts` (FR-028)
- [X] T029 [P] Criar envelope padrão de erro `{ erro: { codigo, mensagem, detalhes? } }` em `lib/http/erros.ts`, com mensagens em pt-BR e sem conteúdo de atendimento

**Checkpoint**: Fundação pronta — as histórias podem começar

---

## Phase 3: User Story 1 - Ser atendido pelo assistente certo (Priority: P1) 🎯 MVP

**Goal**: O BP descreve a demanda, é direcionado ao assistente certo, passa pelo refinamento
obrigatório e recebe a entrega estruturada com escalonamento quando houver risco.

**Independent Test**: Descrever um conflito de equipe, verificar que o app indica o assistente
de mentoria, que ele faz perguntas antes de concluir, e que a entrega traz orientação
fundamentada com plano de ação, responsáveis e prazos.

### Estruturas de entrega (Princípio V)

- [X] T030 [P] [US1] Definir schema Zod do parecer técnico de compliance (7 seções) em `lib/assistentes/estruturas/etica-compliance.ts` conforme [contracts/assistant-output.md](./contracts/assistant-output.md)
- [X] T031 [P] [US1] Definir schema Zod da entrega de T&D (6 seções) em `lib/assistentes/estruturas/treinamento-desenvolvimento.ts`
- [X] T032 [P] [US1] Definir schema Zod da comunicação de liderança em `lib/assistentes/estruturas/comunicacao-lideranca.ts`, com as regras por formato
- [X] T033 [P] [US1] Definir schema Zod da orientação estratégica em `lib/assistentes/estruturas/mentoria-bp.ts`
- [X] T034 [P] [US1] Definir schema Zod do prompt gerado em `lib/assistentes/estruturas/engenharia-prompts.ts`
- [X] T035 [US1] Criar registro `lib/assistentes/estruturas/index.ts` mapeando especialidade → schema, e teste em `tests/unit/estruturas.test.ts` provando que entrega sem seção obrigatória é reprovada (SC-003)

### Controles constitucionais (o núcleo do plano)

- [X] T036 [US1] Implementar o portão de refinamento em `lib/dominio/portao-refinamento.ts`: predicado "existe lacuna crítica aberta" a partir do estado persistido (R-01, R-04)
- [X] T037 [US1] Escrever testes em `tests/unit/portao-refinamento.test.ts` cobrindo lacuna aberta, respondida, `nao_aplicavel` com e sem justificativa, e o caso em que o modelo afirma `prontoParaEntrega = true` com lacuna aberta (SC-005)
- [X] T038 [US1] Implementar a camada determinística de detecção de risco em `lib/dominio/deteccao-risco.ts`, com dicionário de termos e padrões em pt-BR para os sete tipos de risco (R-05)
- [X] T039 [US1] Criar a bateria de casos fixos em `tests/fixtures/casos-risco/`, incluindo relatos explícitos e relatos que descrevem a conduta sem nomeá-la
- [X] T040 [US1] Escrever a suíte de regressão em `tests/unit/deteccao-risco.test.ts` exigindo zero falso negativo sobre as fixtures, executável por `npm run test:risco` (SC-004)
- [X] T041 [US1] Implementar a união dos sinais regra + modelo em `lib/dominio/deteccao-risco.ts`, gravando `origemDeteccao` como `regra`, `modelo` ou `ambos`
- [X] T042 [P] [US1] Implementar `lib/dominio/classificacao-sigilo.ts` marcando o atendimento como sensível por especialidade e por conteúdo detectado (FR-023)
- [X] T043 [US1] Implementar a regra que bloqueia sugestão punitiva sem fatos registrados em `lib/dominio/vedacao-punitiva.ts`, com teste em `tests/unit/vedacao-punitiva.test.ts` (FR-013)

### Orquestração do modelo

- [X] T044 [US1] Implementar o roteamento de especialidade em `lib/ia/roteador.ts`, retornando sugestões com justificativa, sinal de ambiguidade e recusa fora de escopo (FR-002, FR-004, FR-005)
- [X] T045 [P] [US1] Escrever teste em `tests/unit/roteador.test.ts` com o modelo simulado, cobrindo sugestão única, ambiguidade e demanda fora de escopo
- [X] T046 [US1] Implementar a condução do refinamento em `lib/ia/refinamento.ts`, montando o prompt a partir do arquivo canônico e extraindo novas lacunas da saída estruturada
- [X] T047 [US1] Implementar a geração da entrega final em `lib/ia/entrega.ts`, com validação contra o schema da especialidade antes de qualquer persistência (R-02, R-10)

### Rotas

- [X] T048 [P] [US1] Implementar `GET /api/assistentes` em `app/api/assistentes/route.ts` listando apenas assistentes ativos (FR-003)
- [X] T049 [US1] Implementar `POST /api/roteamento` em `app/api/roteamento/route.ts` conforme [contracts/api.md](./contracts/api.md), incluindo erro `RELATO_MUITO_EXTENSO` sem truncar
- [X] T050 [US1] Implementar `POST /api/atendimentos` em `app/api/atendimentos/route.ts`: cria o atendimento, registra `promptHash`, roda detecção de risco e classificação de sigilo
- [X] T051 [US1] Implementar `POST /api/atendimentos/[id]/mensagens` em `app/api/atendimentos/[id]/mensagens/route.ts` com resposta por streaming e quadro final de lacunas (R-10)
- [X] T052 [US1] Implementar `POST /api/atendimentos/[id]/entrega` em `app/api/atendimentos/[id]/entrega/route.ts`, recusando com `422 REFINAMENTO_INCOMPLETO` enquanto houver lacuna crítica aberta
- [X] T053 [US1] Concluir o atendimento na emissão bem-sucedida: `estado`, `concluidoEm` e `expurgarEm = concluidoEm + 24 meses` em `lib/dados/atendimentos.ts`
- [X] T054 [US1] Escrever testes de integração em `tests/integration/entrega.test.ts` provando que a rota de entrega recusa com lacuna aberta mesmo quando chamada fora da UI

### Interface

- [X] T055 [P] [US1] Criar a tela de novo atendimento em `app/(app)/atendimentos/novo/page.tsx` com campo de relato e envio
- [X] T056 [US1] Criar o componente de indicação de assistente em `components/atendimento/IndicacaoAssistente.tsx`, exibindo justificativa e permitindo troca manual (FR-002, FR-003)
- [X] T057 [US1] Tratar o caso ambíguo em `components/atendimento/IndicacaoAssistente.tsx`, apresentando as opções sem pré-selecionar (FR-004)
- [X] T058 [US1] Criar a tela do atendimento em `app/(app)/atendimentos/[id]/page.tsx` com o diálogo de refinamento em streaming
- [X] T059 [P] [US1] Criar o painel de lacunas pendentes em `components/atendimento/PainelLacunas.tsx`, mostrando o que ainda falta (FR-009)
- [X] T060 [US1] Permitir marcar lacuna como não aplicável com justificativa obrigatória em `components/atendimento/PainelLacunas.tsx` (FR-008)
- [X] T061 [US1] Criar o componente de entrega em `components/atendimento/Entrega.tsx`, renderizando as seções da especialidade com títulos, tópicos e tabelas
- [X] T062 [US1] Criar o alerta de escalonamento em `components/atendimento/AlertaEscalonamento.tsx`, renderizado **acima** do plano de ação (FR-012)
- [X] T063 [P] [US1] Exibir a recusa de entrega de forma útil em `components/atendimento/Entrega.tsx`: perguntas pendentes com o porquê de cada uma, em vez de erro genérico

### Validação da história

- [X] T064 [US1] Escrever E2E em `tests/e2e/us1-atendimento.spec.ts` cobrindo os cinco cenários de aceite da US1
- [X] T065 [US1] Escrever E2E em `tests/e2e/us1-escalonamento.spec.ts` cobrindo relato explícito e relato eufemístico de assédio (quickstart, cenário 2)

**Checkpoint**: MVP funcional — o BP resolve uma demanda ponta a ponta com as garantias
constitucionais ativas

---

## Phase 4: User Story 2 - Retomar e consultar atendimentos (Priority: P2)

**Goal**: Continuidade entre sessões e histórico consultável, com isolamento estrito entre BPs.

**Independent Test**: Iniciar um atendimento, responder parte do refinamento, sair, retornar e
verificar que ele consta como pendente e retoma da próxima pergunta.

- [X] T066 [US2] Implementar a consulta de histórico com filtros de especialidade, período e estado em `lib/dados/atendimentos.ts`, operando apenas sobre metadados em claro
- [X] T067 [US2] Implementar `GET /api/atendimentos` em `app/api/atendimentos/route.ts` com paginação de até 50 itens (FR-016)
- [X] T068 [US2] Implementar `GET /api/atendimentos/[id]` em `app/api/atendimentos/[id]/route.ts`, respondendo `404` para atendimento de outro BP — nunca `403` (FR-017)
- [X] T069 [US2] Implementar a retomada em `lib/dominio/portao-refinamento.ts`: a próxima pergunta é a lacuna aberta de menor `ordem` (SC-008)
- [X] T070 [US2] Registrar auditoria de acesso na leitura de atendimento sensível em `app/api/atendimentos/[id]/route.ts` (SC-009)
- [X] T071 [P] [US2] Criar a tela de histórico em `app/(app)/atendimentos/page.tsx` com lista, estado e classificação de sigilo
- [X] T072 [P] [US2] Criar os filtros de especialidade e período em `components/historico/FiltrosHistorico.tsx`
- [X] T073 [US2] Exibir atendimento concluído em modo somente leitura, com entrega e diálogo completo, em `app/(app)/atendimentos/[id]/page.tsx` (FR-014)
- [X] T074 [US2] Escrever testes de integração de isolamento em `tests/integration/propriedade-atendimento.test.ts`, cobrindo leitura, retomada e exclusão cruzadas entre dois BPs (SC-006)
- [X] T075 [US2] Escrever E2E em `tests/e2e/us2-historico.spec.ts` cobrindo os quatro cenários de aceite da US2

**Checkpoint**: US1 e US2 funcionam de forma independente

---

## Phase 5: User Story 3 - Levar a entrega para fora do app (Priority: P3)

**Goal**: Exportar a entrega preservando estrutura, com marcação de sigilo quando sensível.

**Independent Test**: Concluir um atendimento de comunicação, exportar e verificar que títulos,
tópicos e tabelas foram preservados no arquivo.

- [X] T076 [P] [US3] Implementar a serialização da entrega estruturada para Markdown em `lib/exportacao/markdown.ts`, preservando títulos, tópicos e tabelas
- [X] T077 [P] [US3] Implementar a geração de DOCX em `lib/exportacao/docx.ts` a partir da representação intermediária
- [X] T078 [P] [US3] Implementar a geração de PDF em `lib/exportacao/pdf.ts` a partir da representação intermediária
- [X] T079 [US3] Aplicar marcação de sigilo e nota de guarda em local seguro nos três formatos, em `lib/exportacao/sigilo.ts` (FR-022)
- [X] T080 [US3] Implementar `POST /api/atendimentos/[id]/exportacao` em `app/api/atendimentos/[id]/exportacao/route.ts`, com `Content-Disposition: attachment` e registro de auditoria
- [X] T081 [P] [US3] Criar o controle de exportação em `components/atendimento/ExportarEntrega.tsx` com escolha de formato
- [X] T082 [P] [US3] Implementar cópia preservando formatação estruturada em `components/atendimento/CopiarEntrega.tsx`
- [X] T083 [US3] Escrever teste de integração em `tests/integration/exportacao.test.ts` verificando marcação de sigilo obrigatória e auditoria em toda exportação
- [X] T084 [US3] Escrever E2E em `tests/e2e/us3-exportacao.spec.ts` cobrindo os três cenários de aceite da US3

**Checkpoint**: US1, US2 e US3 funcionam de forma independente

---

## Phase 6: User Story 4 - Relatar a situação por voz (Priority: P4)

**Goal**: Iniciar o atendimento por gravação, com transcrição revisável antes do envio.

**Independent Test**: Gravar 60 s de relato, verificar que o texto transcrito aparece para
revisão e que, após confirmação, o atendimento inicia normalmente.

- [X] T085 [US4] Implementar a transcrição via Gemini em `lib/ia/transcricao.ts`, descartando o áudio após o processamento (R-09)
- [X] T086 [US4] Implementar `POST /api/transcricao` em `app/api/transcricao/route.ts` aceitando `multipart/form-data` com limite de 10 min / 25 MB
- [X] T087 [US4] Retornar `422 TRANSCRICAO_FALHOU` com orientação para digitação, preservando o rascunho, em `app/api/transcricao/route.ts`
- [X] T088 [P] [US4] Criar o componente de gravação em `components/atendimento/GravadorRelato.tsx` com permissão de microfone e indicação de duração
- [X] T089 [US4] Criar a revisão da transcrição em `components/atendimento/RevisaoTranscricao.tsx`, editável antes do envio ao assistente (FR-020)
- [X] T090 [US4] Escrever teste de integração em `tests/integration/transcricao.test.ts` provando que nenhum arquivo de áudio é persistido
- [X] T091 [US4] Escrever E2E em `tests/e2e/us4-voz.spec.ts` cobrindo os três cenários de aceite da US4

**Checkpoint**: as quatro histórias funcionam de forma independente

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Ciclo de vida do dado, desempenho e fechamento. As tarefas T092–T097 são **portão
de release**, não acabamento opcional: sem elas, os Princípios I e III ficam declarados mas não
executados.

- [X] T092 Implementar o encerramento automático de atendimentos sem interação há 90 dias em `lib/dados/retencao.ts` (FR-018)
- [X] T093 Implementar o expurgo de atendimentos concluídos há mais de 24 meses em `lib/dados/retencao.ts`, apagando conteúdo e anonimizando a auditoria (FR-026, R-11)
- [X] T094 Criar a rotina agendada diária que dispara as duas varreduras em `app/api/cron/retencao/route.ts`, protegida por segredo
- [X] T095 Escrever testes de integração com relógio simulado em `tests/integration/retencao.test.ts` cobrindo 91 dias, 24 meses + 1 dia e persistência da auditoria (SC-011)
- [X] T096 Implementar `DELETE /api/atendimentos/[id]` em `app/api/atendimentos/[id]/route.ts` com registro de auditoria (FR-027)
- [X] T097 [P] Criar tela de trilha de auditoria do próprio BP em `app/(app)/auditoria/page.tsx`, listando acessos, exportações e exclusões dos seus atendimentos
- [ ] T098 [P] Verificar as metas de latência do plano — primeiro token em 3 s, entrega em 30 s — e registrar os números em `docs/desempenho.md` — **BLOQUEADA**: exige chamadas reais ao provedor; `GEMINI_API_KEY` não está configurada neste ambiente
- [X] T099 [P] Revisar responsividade e acessibilidade das telas de atendimento e histórico em `app/(app)/`
- [X] T100 [P] Auditar que nenhum conteúdo de atendimento chega a log ou a mensagem de erro, com teste em `tests/integration/vazamento-log.test.ts`
- [X] T101 [P] Escrever `README.md` com setup, variáveis de ambiente e como rodar cada suíte
- [ ] T102 Executar o [quickstart.md](./quickstart.md) inteiro, os sete cenários, e registrar o resultado — **PARCIAL**: cenários 3, 4, 6 e 7 cobertos por teste automatizado; 1, 2 e 5 dependem de `GEMINI_API_KEY`
- [X] T103 Reavaliar os cinco princípios da constituição contra o código entregue e anexar o resultado ao Constitution Check do [plan.md](./plan.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — começa imediatamente
- **Foundational (Phase 2)**: depende do Setup — **BLOQUEIA todas as histórias**
- **User Stories (Phases 3–6)**: dependem da Foundational
  - US1 é pré-requisito real de US2, US3 e US4 — todas operam sobre atendimentos e entregas que
    só a US1 sabe produzir. Esta é a exceção honesta ao ideal de histórias independentes:
    US2/US3/US4 são independentes **entre si**, não da US1.
- **Polish (Phase 7)**: T092–T096 dependem da US1; o restante depende das histórias desejadas

### Ordem interna de cada história

- Schemas e domínio antes de orquestração do modelo
- Orquestração antes de rotas
- Rotas antes de interface
- Testes de domínio junto com o domínio; E2E ao final da história

### Parallel Opportunities

- Setup: T002–T007, T009, T010 em paralelo
- Foundational: T017, T021, T026, T029 em paralelo; T011–T014 são sequenciais (mesmo arquivo)
- US1: os cinco schemas de estrutura (T030–T034) em paralelo; T042, T045, T048, T055, T059,
  T063 em paralelo dentro das suas etapas
- US3: os três formatos de exportação (T076–T078) em paralelo
- Polish: T097–T101 em paralelo

**Atenção**: T011–T014 tocam `prisma/schema.prisma` e T036/T069 tocam
`lib/dominio/portao-refinamento.ts` — não paralelizar apesar de pertencerem a fases distintas.

---

## Parallel Example: User Story 1

```bash
# Os cinco schemas de entrega, um por especialidade:
Task: "Definir schema Zod do parecer técnico em lib/assistentes/estruturas/etica-compliance.ts"
Task: "Definir schema Zod da entrega de T&D em lib/assistentes/estruturas/treinamento-desenvolvimento.ts"
Task: "Definir schema Zod da comunicação em lib/assistentes/estruturas/comunicacao-lideranca.ts"
Task: "Definir schema Zod da orientação estratégica em lib/assistentes/estruturas/mentoria-bp.ts"
Task: "Definir schema Zod do prompt gerado em lib/assistentes/estruturas/engenharia-prompts.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup
2. Phase 2: Foundational — bloqueia tudo
3. Phase 3: User Story 1
4. **PARAR e VALIDAR**: rodar `npm run test:risco` e os cenários 1 e 2 do quickstart
5. Demonstrar

O MVP é a US1 completa, incluindo T036–T043. Cortar os controles constitucionais para "entregar
mais rápido" não produz um MVP menor — produz um produto que a constituição do projeto proíbe.

### Incremental Delivery

1. Setup + Foundational → fundação pronta
2. US1 → testar → demonstrar (MVP)
3. US2 → testar → entregar
4. US3 → testar → entregar
5. US4 → testar → entregar
6. Phase 7 T092–T096 → **obrigatório antes de qualquer deploy com dado real**

### Parallel Team Strategy

Com mais de um desenvolvedor, após a Foundational:

1. Um par conclui a US1 — ela destrava as demais
2. Concluída a US1: Dev A em US2, Dev B em US3, Dev C em US4
3. Retenção e auditoria (T092–T097) podem correr em paralelo às US2–US4

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- `[Story]` mapeia a tarefa à história, para rastreabilidade
- Commitar a cada tarefa ou grupo lógico
- `npm run test:risco` é portão de merge: falso negativo reprova (SC-004)
- Nenhuma tarefa altera arquivos em `lib/agentes/` — são fonte de verdade lida,
  nunca escrita (Princípio IV)
