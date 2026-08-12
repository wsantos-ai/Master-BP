---

description: "Task list for feature implementation"
---

# Tasks: Refinamento sem repetição

**Input**: Design documents from `/specs/003-refinamento-sem-repeticao/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/refinamento.md](./contracts/refinamento.md), [quickstart.md](./quickstart.md)

**Tests**: incluídos, e não opcionais. [contracts/refinamento.md §4](./contracts/refinamento.md)
enumera doze verificações que o contrato torna testáveis sem rede, e SC-002, SC-005, SC-006,
SC-007, SC-010 e SC-011 dependem delas. A US3 inteira só é demonstrável por teste: ela consiste em
provar que um assistente mentiroso **não** consegue abrir o portão.

**Organization**: tarefas agrupadas por história de usuário. As três são P1 — nenhuma entrega o
resultado sozinha.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: a qual história a tarefa pertence (US1, US2, US3)
- Caminhos de arquivo exatos nas descrições

## Path Conventions

Projeto único Next.js na raiz: `lib/`, `app/`, `components/`, `prisma/`, `tests/`. Ver
[plan.md](./plan.md), seção Source Code.

## ⚠️ Fronteiras desta feature (R-08)

Nenhuma tarefa abaixo altera — e nenhuma tarefa nova deve alterar:

- `lib/agentes/*.md` (Princípio IV)
- `components/**` — a interface já pergunta uma de cada vez; ela apenas recebe uma lista menor
- `lib/dominio/deteccao-risco.ts` e `lib/dominio/vedacao-punitiva.ts` (Princípios III e V)
- O roteamento, a entrega final, a exportação e a retenção

## 🚨 A linha vermelha desta feature

`LIMITE_APRESENTADAS` participa **exclusivamente** do cálculo de `apresentadas`. Se ele aparecer
em qualquer expressão que produza `liberada`, `podeEmitirEntrega` ou `lacunaResolvida`, o
Princípio II está quebrado: pendência fora da tela não é pendência resolvida. T021 e T042 existem
para verificar isso.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: base verificada antes de mexer em controle constitucional

- [X] T001 Executar `npm run test:unit` e `npm run test:risco` e registrar o baseline verde antes de qualquer alteração, para que qualquer regressão introduzida seja atribuível
- [X] T002 [P] Criar `tests/fixtures/pares-equivalencia/index.ts` com o conjunto de calibração: pares equivalentes (mesma pergunta reescrita, com e sem acento, com e sem pontuação) e pares NÃO equivalentes (o caso "prazo para comunicar" × "prazo para implementar" e outros próximos lexicalmente mas distintos em intenção), todos em português do Brasil

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: separar, na estrutura devolvida pelo portão, a **decisão** da **apresentação**. As
três histórias leem essa estrutura na rota; mudá-la depois seria refazer a fiação três vezes.

**⚠️ CRITICAL**: nenhuma história pode começar antes desta fase terminar.

**Nota de escopo**: esta fase muda a **forma** de `AvaliacaoPortao`, não a política. O limite de 3
é introduzido em US2 — aqui `apresentadas` ainda devolve todas as críticas abertas.

- [X] T003 Alterar `AvaliacaoPortao` em `lib/dominio/portao-refinamento.ts`: renomear `pendentes` para `apresentadas` e acrescentar `totalCriticasAbertas`, mantendo `liberada`, `totalAbertas` e `totalResolvidas` com o comportamento atual
- [X] T004 Atualizar `tests/unit/portao-refinamento.test.ts` para a nova forma, preservando integralmente os 19 casos existentes de `lacunaResolvida`, `podeEmitirEntrega`, `proximaPergunta` e `reconciliarComSinalDoModelo` — nenhum deles pode mudar de expectativa
- [X] T005 [P] Atualizar os consumidores de `portao.pendentes` para `portao.apresentadas` em `app/api/atendimentos/route.ts`, `app/api/atendimentos/[id]/mensagens/route.ts` e `app/api/atendimentos/[id]/entrega/route.ts` — apenas o nome do campo, nenhuma mudança de comportamento
- [X] T006 Executar `npm run test:unit` e `npm run test:integration` e confirmar que a renomeação não alterou nenhum resultado — **PARCIAL**: `test:unit` manteve 284/284 e `tsc --noEmit` ficou limpo; `test:integration` não sobe neste ambiente (ver T038)

**Checkpoint**: a decisão do portão e a lista renderizada são campos distintos. As histórias podem começar.

---

## Phase 3: User Story 1 - O assistente não repergunta o que já foi respondido (Priority: P1) 🎯 MVP

**Goal**: pergunta equivalente a outra já existente no atendimento é descartada antes de virar pendência, e o assistente é instruído a não repetir.

**Independent Test**: conduzir um atendimento respondendo cada pergunta com conteúdo distinto e verificável, conferindo rodada a rodada que nenhuma pendência pede informação já fornecida. A camada determinística é testável sem provedor sobre o conjunto de calibração de T002.

### Tests for User Story 1

- [X] T007 [P] [US1] Criar `tests/unit/equivalencia-lacunas.test.ts` cobrindo `normalizar`: minúsculas, remoção de acentos, remoção de pontuação, colapso de espaços e remoção de palavras vazias em pt-BR, com asserção sobre o conjunto de palavras de conteúdo resultante
- [X] T008 [P] [US1] Adicionar a `tests/unit/equivalencia-lacunas.test.ts` os casos de `saoEquivalentes` sobre todo o conjunto de `tests/fixtures/pares-equivalencia/index.ts`: 100% dos pares equivalentes devem casar e 100% dos não equivalentes devem sobreviver — em especial "qual o prazo para comunicar" × "qual o prazo para implementar"
- [X] T009 [P] [US1] Adicionar a `tests/unit/equivalencia-lacunas.test.ts` os casos de `filtrarPropostas`: descarte contra perguntas existentes (abertas, respondidas e não aplicáveis), descarte entre propostas da mesma rodada, e a asserção de que a função devolve **contagem** de descartadas, nunca o texto descartado

### Implementation for User Story 1

- [X] T010 [US1] Criar `lib/dominio/equivalencia-lacunas.ts` com `normalizar()`, a lista de palavras vazias em pt-BR e a constante `LIMIAR_EQUIVALENCIA = 0.8`, conforme [data-model.md §5.1](./data-model.md)
- [X] T011 [US1] Implementar `saoEquivalentes()` em `lib/dominio/equivalencia-lacunas.ts` como índice de Jaccard sobre as palavras de conteúdo, comparado ao limiar — função pura, sem I/O, sem `Date`, sem estado
- [X] T012 [US1] Implementar `filtrarPropostas()` em `lib/dominio/equivalencia-lacunas.ts` conforme [contracts/refinamento.md §1.1](./contracts/refinamento.md): compara contra as existentes e contra as já aceitas na mesma rodada; em caso de dúvida **aceita** a proposta; devolve `{ aceitas, descartadas: number }`
- [X] T013 [US1] Aplicar `filtrarPropostas` em `app/api/atendimentos/[id]/mensagens/route.ts` antes de `criarLacunas`, usando como conjunto de comparação as perguntas de todas as lacunas do atendimento — abertas, respondidas e não aplicáveis
- [X] T014 [US1] Aplicar `filtrarPropostas` em `app/api/atendimentos/route.ts` na criação do atendimento, com o conjunto de existentes vazio, para deduplicar as propostas da primeira rodada entre si (R-05, FR-006)
- [X] T015 [US1] Acrescentar a `CONTRATO_SAIDA` em `lib/ia/refinamento.ts` a regra explícita de não repetir nem reformular pergunta já feita no atendimento — **sem** tocar em `lib/agentes/*.md` (R-07, FR-008)
- [X] T016 [US1] Alterar `montarEntrada` em `lib/ia/refinamento.ts` para separar as perguntas em dois blocos rotulados — "já respondidas, não pergunte isso de novo" e "ainda abertas" — em vez da lista única atual com o estado ao lado

**Checkpoint**: US1 completa. Cenários 2 e 9 do [quickstart.md](./quickstart.md) devem passar.

---

## Phase 4: User Story 2 - A etapa de refinamento converge (Priority: P1)

**Goal**: no máximo 3 pendências críticas apresentadas por vez, com as excedentes em fila derivada — sem que a fila deixe de bloquear a entrega.

**Independent Test**: montar um atendimento com mais de 3 pendências críticas abertas e confirmar que a rota devolve 3, que a quarta aparece ao resolver uma das ativas, e que a retomada devolve as mesmas 3 na mesma ordem.

### Tests for User Story 2

- [X] T017 [P] [US2] Adicionar a `tests/unit/portao-refinamento.test.ts` os casos do limite: com 7 críticas abertas, `apresentadas` tem exatamente 3 e `totalCriticasAbertas` tem 7; com 2 abertas, `apresentadas` tem 2
- [X] T018 [P] [US2] Adicionar a `tests/unit/portao-refinamento.test.ts` o caso de promoção: resolvida uma das 3 apresentadas, a próxima por `ordem` entra no lugar, e a ordem entre as demais não muda (FR-015, SC-011)
- [X] T019 [P] [US2] Adicionar a `tests/unit/portao-refinamento.test.ts` o caso de pendências não críticas: elas ficam fora do limite de 3 e não bloqueiam a entrega (FR-016)

### Implementation for User Story 2

- [X] T020 [US2] Introduzir `LIMITE_APRESENTADAS = 3` em `lib/dominio/portao-refinamento.ts` e limitar `apresentadas` às primeiras críticas não resolvidas por `ordem`, conforme [data-model.md §3](./data-model.md)
- [X] T021 [US2] 🚨 Garantir em `lib/dominio/portao-refinamento.ts` que `liberada`, `podeEmitirEntrega` e `lacunaResolvida` continuam computados sobre **todas** as críticas não resolvidas, sem nenhuma referência a `LIMITE_APRESENTADAS` (FR-014) — a linha vermelha da feature
- [X] T022 [US2] Adicionar a `tests/unit/portao-refinamento.test.ts` o caso que fecha FR-014: com 3 apresentadas resolvidas e 4 em fila, `liberada` é **falso** e `podeEmitirEntrega` devolve **falso** (SC-010)
- [X] T023 [US2] Criar `tests/integration/refinamento-convergencia.test.ts` exercitando várias rodadas sobre estado persistido e verificando SC-002: o total de críticas não resolvidas ao fim de cada rodada não é maior que no início — **ENTREGUE EM OUTRO CAMINHO**: o harness de integração não sobe neste ambiente (ver T038), então a suíte foi escrita como `tests/unit/refinamento-convergencia.test.ts`, encadeando as mesmas funções puras que a rota usa, na mesma ordem do contrato §2, sobre estado em memória. Verifica SC-002 e SC-004 e **roda** (5 casos verdes). Quando o harness voltar, vale reescrevê-la sobre estado persistido

**Checkpoint**: US2 completa. Cenários 3, 4, 5 e 8 do [quickstart.md](./quickstart.md) devem passar.

---

## Phase 5: User Story 3 - O portão de refinamento continua incorruptível (Priority: P1)

**Goal**: o sinal do assistente sobre lacunas resolvidas passa a ser usado, sem nunca conseguir fechar pendência que o BP não respondeu — e a origem de cada fechamento fica auditável.

**Independent Test**: simular um assistente que declara resolvidas todas as lacunas do atendimento, inclusive as nunca respondidas e ids de outro atendimento, e confirmar que as não respondidas permanecem abertas e o portão segue bloqueando.

### Tests for User Story 3

- [X] T024 [P] [US3] Criar `tests/unit/resolucao-aproveitada.test.ts` com o caso central de FR-002: sem conteúdo do BP na rodada, `aproveitarResolucoes` devolve lista vazia por mais que o assistente declare tudo resolvido
- [X] T025 [P] [US3] Adicionar a `tests/unit/resolucao-aproveitada.test.ts` os casos de FR-003: `lacunaId` inexistente e `lacunaId` de outro atendimento são descartados sem erro e entram em `ignorados`
- [X] T026 [P] [US3] Adicionar a `tests/unit/resolucao-aproveitada.test.ts` os casos de idempotência: lacuna já resolvida é ignorada sem efeito, e a lacuna respondida diretamente nesta rodada não é tratada como aproveitada
- [X] T027 [P] [US3] Adicionar a `tests/unit/resolucao-aproveitada.test.ts` o caso do assistente mentiroso de SC-005: sinal declarando resolvidas todas as lacunas do atendimento fecha apenas as cobertas por conteúdo real, e `podeEmitirEntrega` continua falso

### Implementation for User Story 3

- [X] T028 [US3] Acrescentar a coluna opcional `origemFechamento` ao modelo `Lacuna` em `prisma/schema.prisma`, sem *default* e sem backfill, com comentário explicando que nulo significa "fechada antes de a origem passar a ser registrada" ([data-model.md §1.1](./data-model.md))
- [X] T029 [US3] Gerar a migração com `npx prisma migrate dev` e conferir que o SQL resultante em `prisma/migrations/` contém apenas o `ADD COLUMN` nullable
- [X] T030 [US3] Expor `origemFechamento` em `LacunaDecifrada` e em `decifrarLacuna` em `lib/dados/atendimentos.ts` — o campo **não** é cifrado, é rótulo de enumeração
- [X] T031 [US3] Criar `lib/dominio/resolucao-aproveitada.ts` com `aproveitarResolucoes()` conforme [contracts/refinamento.md §1.2](./contracts/refinamento.md): função pura, sem escrita, que devolve `{ idsParaFechar, ignorados }` e aplica as quatro verificações de [data-model.md §2](./data-model.md)
- [X] T032 [US3] Criar `fecharLacunasAproveitadas()` em `lib/dados/atendimentos.ts`, que grava **a resposta real do BP** nas lacunas indicadas com `estado = 'respondida'` e `origemFechamento = 'aproveitada'` — nunca resposta vazia (R-03)
- [X] T033 [US3] Preencher `origemFechamento = 'resposta_direta'` em `responderLacuna()` em `lib/dados/atendimentos.ts`, mantendo `marcarLacunaNaoAplicavel()` com origem nula (FR-004, SC-006)
- [X] T034 [US3] Ligar `aproveitarResolucoes` e `fecharLacunasAproveitadas` em `app/api/atendimentos/[id]/mensagens/route.ts`, **antes** da deduplicação e **depois** de persistir a resposta direta, recarregando as lacunas entre os dois passos — ordem obrigatória de [contracts/refinamento.md §2](./contracts/refinamento.md)

**Checkpoint**: US3 completa. Cenários 5, 6 e 7 do [quickstart.md](./quickstart.md) devem passar.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: observabilidade, verificação constitucional e calibração

- [X] T035 Emitir em `app/api/atendimentos/[id]/mensagens/route.ts` o evento de observabilidade da rodada com **apenas as sete contagens** de [data-model.md §6](./data-model.md) — os campos com texto não podem sequer ser montados (FR-011, FR-012)
- [X] T036 [P] Adicionar a `tests/unit/vazamento-log.test.ts` a asserção de que o evento da rodada não carrega pergunta, resposta, justificativa nem relato (SC-007)
- [X] T037 Executar `npm run test:risco` e confirmar 100% verde — portão de merge; `detectarRisco` deve continuar recebendo o texto integral da resposta do BP, sem normalização prévia
- [ ] T038 [P] Executar `npm run test:unit`, `npm run test:integration` e `npm run test:e2e` e confirmar a suíte inteira verde sem credencial de provedor — **PARCIAL**: `test:unit` 346/346 verde e `test:risco` 43/43 verde, sem credencial; `test:integration` **não sobe por defeito preexistente** — `tests/global-setup-integration.ts` faz `prisma db push` com `DATABASE_URL=file:...` contra um `prisma/schema.prisma` que declara `provider = "postgresql"` desde o commit `c2b1ad0`, anterior às features 002 e 003; `test:e2e` depende do app com banco
- [X] T039 Calibrar `LIMIAR_EQUIVALENCIA` em `lib/dominio/equivalencia-lacunas.ts` contra `tests/fixtures/pares-equivalencia/index.ts`, ajustando para o menor valor que ainda preserve 100% dos pares não equivalentes, e registrar o número escolhido em comentário
- [ ] T040 **BLOQUEADA** (exige app no ar, com banco e credencial do provedor) — Executar o cenário 1 do [quickstart.md](./quickstart.md) — o relato de comissionamento que originou a feature — e confirmar zero repetições, contador nunca acima de 3 e conclusão em até 8 rodadas (SC-003, SC-009)
- [ ] T041 **BLOQUEADA** (exige 10 atendimentos reais; é a medição que decide se a paráfrase ficou coberta) — Repetir o cenário 2 do [quickstart.md](./quickstart.md) em 10 atendimentos de temas variados e medir SC-001; se houver repetição por paráfrase, registrar os casos como entrada para a avaliação de embeddings prevista em R-02 — **sem** implementá-los aqui
- [X] T042 [P] 🚨 Verificar por inspeção que `LIMITE_APRESENTADAS` não aparece em nenhuma expressão que produza `liberada`, `podeEmitirEntrega` ou `lacunaResolvida` em `lib/dominio/portao-refinamento.ts`
- [X] T043 [P] Verificar as fronteiras da feature com `git diff --stat lib/agentes/ components/ lib/dominio/deteccao-risco.ts lib/dominio/vedacao-punitiva.ts` — o resultado deve ser vazio
- [X] T044 Reavaliar o Constitution Check de [plan.md](./plan.md) contra o código entregue, no formato da reavaliação pós-implementação das features 001 e 002, apontando a evidência de cada princípio

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende do Setup — **BLOQUEIA todas as histórias**
- **US1 (Phase 3)**: depende da Phase 2. Independente de US2 e US3
- **US2 (Phase 4)**: depende da Phase 2. Independente de US1 e US3
- **US3 (Phase 5)**: depende da Phase 2. Independente de US1 e US2
- **Polish (Phase 6)**: depende das três histórias

### User Story Dependencies

As três são genuinamente independentes entre si — arquivos de domínio distintos, testes distintos:

- **US1 (P1)**: `equivalencia-lacunas.ts` + fiação nas duas rotas + contrato de saída
- **US2 (P1)**: `portao-refinamento.ts` + testes de portão
- **US3 (P1)**: `resolucao-aproveitada.ts` + migração + camada de dados

**O único ponto de encontro** é `app/api/atendimentos/[id]/mensagens/route.ts`, tocado por T013
(US1) e T034 (US3). Se as duas histórias correrem em paralelo, esses dois passos precisam ser
sequenciados, e a ordem obrigatória é a de [contracts/refinamento.md §2](./contracts/refinamento.md):
**aproveitamento antes da deduplicação**, porque uma proposta pode ser equivalente a uma lacuna
que o aproveitamento acabou de fechar.

### Within Each User Story

- Testes escritos antes da implementação, e devem falhar antes dela
- Funções puras de `lib/dominio/` antes da fiação nas rotas
- Migração antes da camada de dados que a usa (US3)
- História concluída antes de passar para a próxima

### Parallel Opportunities

- Setup: T002 em paralelo com T001
- US1: T007, T008 e T009 em paralelo (mesmo arquivo, seções distintas — sequenciar se houver conflito de escrita)
- US2: T017, T018 e T019 em paralelo
- US3: T024 a T027 em paralelo (todos em `resolucao-aproveitada.test.ts`)
- Polish: T036, T038, T042 e T043 em paralelo
- **Entre histórias**: com três pessoas, as três correm em paralelo após a Phase 2, com a ressalva do ponto de encontro acima

---

## Parallel Example: User Story 3

```bash
# Testes de US3 juntos — todos sem rede e sem banco:
Task: "Sem conteúdo do BP, nada é aproveitado, em tests/unit/resolucao-aproveitada.test.ts"
Task: "Id inexistente ou de outro atendimento é ignorado, no mesmo arquivo"
Task: "Idempotência: lacuna já resolvida e resposta direta, no mesmo arquivo"
Task: "Assistente mentiroso não abre o portão, no mesmo arquivo"

# Depois, implementação em sequência (migração antes da camada de dados):
Task: "Coluna origemFechamento em prisma/schema.prisma"
Task: "aproveitarResolucoes() em lib/dominio/resolucao-aproveitada.ts"
Task: "fecharLacunasAproveitadas() em lib/dados/atendimentos.ts"
```

---

## Implementation Strategy

### MVP First (US1 apenas)

1. Phase 1: Setup
2. Phase 2: Foundational (**crítica** — bloqueia tudo)
3. Phase 3: US1
4. **PARAR E VALIDAR**: cenários 2 e 9 do quickstart
5. Neste ponto a queixa principal — reperguntar — está endereçada, ainda que a etapa continue longa

### Entrega incremental

1. Setup + Foundational → estrutura pronta
2. US1 → validar → o assistente para de repetir (**MVP**)
3. US2 → validar → a etapa encurta e converge
4. US3 → validar → o sinal do modelo passa a valer, com o portão protegido
5. Polish → observabilidade, calibração e verificação constitucional

**Nota sobre a ordem**: US3 vem por último apesar de ser P1 porque é a única que exige migração de
banco, e porque seu ganho — aproveitar uma resposta que cobre duas pendências — só é perceptível
depois que US1 e US2 já tornaram a etapa curta. Se a prioridade for reduzir risco em vez de
percepção, inverta com US2: US3 é a que mexe no Princípio II e merece o maior tempo de rodagem.

### Parallel Team Strategy

Com três pessoas, após a Phase 2:

- Pessoa A: US1
- Pessoa B: US2
- Pessoa C: US3

Combinar antes quem escreve T013 e T034 — os dois tocam a mesma rota, na ordem fixada pelo contrato.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- `[Story]` mapeia a tarefa à história, para rastreabilidade
- Verificar que os testes falham antes de implementar
- Commit por tarefa ou grupo lógico
- **A limitação declarada em R-02 não é um defeito a corrigir aqui**: a camada determinística é
  lexical e não pega paráfrase genuína. A paráfrase é responsabilidade de T015 e T016. T041 mede
  se isso bastou; se não bastou, embeddings viram feature própria, com o custo declarado — nunca
  acrescentados de contrabando a esta.
