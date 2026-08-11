---

description: "Task list for feature implementation"
---

# Tasks: Migração do provedor de IA para o OpenRouter (DeepSeek V4 Flash + Voxtral Mini Transcribe)

**Input**: Design documents from `/specs/002-migrar-modelo-openrouter/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/provedor-ia.md](./contracts/provedor-ia.md), [quickstart.md](./quickstart.md)

**Tests**: incluídos. FR-014 exige que a suíte continue rodando sem credencial de provedor, e
[contracts/provedor-ia.md §3](./contracts/provedor-ia.md) enumera oito verificações que o
contrato torna testáveis sem rede. Os testes aqui não são opcionais — SC-002, SC-004, SC-006 e
SC-008 dependem deles.

**Organization**: tarefas agrupadas por história de usuário, para que cada uma seja implementável
e testável de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: a qual história a tarefa pertence (US1, US2, US3, US4)
- Caminhos de arquivo exatos nas descrições

## Path Conventions

Projeto único Next.js na raiz do repositório: `lib/`, `app/`, `tests/`, `scripts/`. Ver
[plan.md](./plan.md), seção Source Code.

## ⚠️ Fronteiras desta feature (R-09)

Nenhuma tarefa abaixo altera — e nenhuma tarefa nova deve alterar:

- `lib/agentes/*.md` (Princípio IV, FR-006)
- `lib/dominio/**` (Princípios II, III e V — os três controles constitucionais)
- `prisma/schema.prisma` e `prisma/migrations/**` (nenhuma migração nesta feature)
- `components/**` e o contrato HTTP de `app/api/transcricao/route.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar configuração e dependências antes de qualquer código de provedor

- [X] T001 Substituir as variáveis do provedor em `.env.example`: remover `GEMINI_API_KEY` e adicionar `OPENROUTER_API_KEY`, com comentário de que é lida só no servidor e nunca prefixada com `NEXT_PUBLIC_`
- [X] T002 [P] Remover a dependência `@google/genai` de `package.json` e regenerar `package-lock.json` com `npm install`
- [X] T003 [P] Atualizar a tabela de variáveis de ambiente em `README.md`: trocar `GEMINI_API_KEY` por `OPENROUTER_API_KEY` e `GEMINI_MODELO_RAPIDO`/`GEMINI_MODELO_CAPAZ` por `OPENROUTER_MODELO_RAPIDO`/`OPENROUTER_MODELO_CAPAZ`/`OPENROUTER_MODELO_TRANSCRICAO`
- [X] T004 [P] Documentar em `README.md`, na seção de configuração, o passo obrigatório fora do código: desativar nas configurações da conta OpenRouter o roteamento para provedores que treinam sobre os dados, para modelos pagos e gratuitos (FR-011, R-05)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o cliente do provedor. Todas as histórias dependem dele.

**⚠️ CRITICAL**: nenhuma história pode começar antes desta fase terminar.

- [X] T005 Criar `lib/ia/openrouter.ts` com `import 'server-only'` no topo e as constantes de modelo `MODELO_RAPIDO`, `MODELO_CAPAZ` e `MODELO_TRANSCRICAO`, lendo `OPENROUTER_MODELO_RAPIDO`, `OPENROUTER_MODELO_CAPAZ` e `OPENROUTER_MODELO_TRANSCRICAO` com os padrões de [data-model.md §1](./data-model.md) — **sem** fallback para as variáveis `GEMINI_*`
- [X] T006 Implementar em `lib/ia/openrouter.ts` a leitura preguiçosa de `OPENROUTER_API_KEY` (na primeira chamada, não no carregamento do módulo, para que a suíte consiga importar sem credencial) e as classes `ErroConfiguracaoIA` e `ErroProvedorIA` conforme [contracts/provedor-ia.md §1](./contracts/provedor-ia.md), preservando `limparClienteCache()`
- [X] T007 Implementar em `lib/ia/openrouter.ts` a função interna de requisição HTTP sobre `fetch`, com `Authorization: Bearer`, `Content-Type: application/json` e o objeto `provider: { data_collection: "deny", zdr: true }` injetado em **todo** corpo de requisição (R-05) — sem os cabeçalhos `HTTP-Referer` e `X-OpenRouter-Title`
- [X] T008 Implementar em `lib/ia/openrouter.ts` o mapeamento de status HTTP → classe de erro da tabela [contracts/provedor-ia.md §2.5](./contracts/provedor-ia.md): 401/402/403/404 → `ErroConfiguracaoIA` (sem retentativa); 429/5xx/timeout/rede → `ErroProvedorIA`
- [X] T009 Garantir em `lib/ia/openrouter.ts` que nenhum log da camada carregue corpo de requisição, corpo de resposta do provedor ou credencial — apenas `evento`, `status`, `motivo` normalizado, `tentativa` e `modelo` ([contracts/provedor-ia.md §1](./contracts/provedor-ia.md), invariante 2)
- [X] T010 [P] Criar `tests/unit/provedor-openrouter.test.ts` com `fetch` dublado (`vi.stubGlobal`), cobrindo: cada status HTTP da tabela §2.5 → classe de erro correta; credencial ausente → `ErroConfiguracaoIA`; presença de `provider.data_collection: "deny"` e `provider.zdr: true` no corpo de toda requisição; ausência da credencial e do corpo da resposta em qualquer chamada ao logger
- [X] T011 Remover `lib/ia/gemini.ts` e atualizar o caminho do import em `lib/ia/roteador.ts`, `lib/ia/refinamento.ts`, `lib/ia/entrega.ts`, `lib/ia/saida-estruturada.ts`, `app/api/atendimentos/route.ts` e `app/api/atendimentos/[id]/mensagens/route.ts` — apenas o caminho, nenhum nome exportado muda

**Checkpoint**: o cliente do provedor existe, classifica erros e impõe a política de dados. As histórias podem começar.

---

## Phase 3: User Story 1 - Atendimento completo servido pelo novo modelo (Priority: P1) 🎯 MVP

**Goal**: roteamento, refinamento, conversa e entrega final produzidos pelo DeepSeek V4 Flash via OpenRouter, com o comportamento de produto inalterado.

**Independent Test**: com apenas `OPENROUTER_API_KEY` configurada, percorrer um atendimento de ponta a ponta em cada uma das cinco especialidades e confirmar que a entrega final é aprovada na validação de estrutura obrigatória. Nesta fase o schema ainda não é enviado ao provedor — a resposta vem em modo JSON livre e é o Zod que garante a estrutura, o que já basta para a história funcionar.

### Tests for User Story 1

- [X] T012 [P] [US1] Atualizar `tests/unit/saida-estruturada.test.ts` para o novo chamador: o dublê `ChamadorModelo` continua devolvendo a string de conteúdo, mas os cenários de falha passam a usar `ErroProvedorIA` e `ErroConfiguracaoIA` importados de `lib/ia/openrouter`; verificar que `ErroConfiguracaoIA` não dispara retentativa e que `ErroProvedorIA` dispara
- [X] T013 [P] [US1] Estender `tests/unit/roteador.test.ts` com um caso que prova que `rotear` propaga `ErroConfiguracaoIA` sem retentar, sem alterar os testes existentes de `interpretarRoteamento`

### Implementation for User Story 1

- [X] T014 [US1] Implementar `chamarChat()` em `lib/ia/openrouter.ts` conforme [contracts/provedor-ia.md §2.1](./contracts/provedor-ia.md): `POST /chat/completions`, mensagens `system` + `user`, `temperature`, e extração de `choices[0].message.content` — tratando `choices` vazio ou `content` ausente como resposta inválida
- [X] T015 [US1] Substituir `chamadorPadrao` em `lib/ia/saida-estruturada.ts` para usar `chamarChat()`, enviando `response_format: { type: 'json_object' }` quando nenhum schema de provedor for fornecido, e preservando integralmente `MAX_TENTATIVAS`, o laço de retentativa, a validação `safeParse` e o comportamento de não gravar nada ao esgotar as tentativas
- [X] T016 [US1] Ajustar `lib/ia/saida-estruturada.ts` para que `ErroProvedorIA` entre no laço de retentativa e `ErroConfiguracaoIA` seja relançado imediatamente, mantendo os rótulos de log `ia.falha_provedor`, `ia.json_invalido` e `ia.schema_reprovado`
- [ ] T017 [P] [US1] Verificar que `lib/ia/roteador.ts` opera sem alteração além do import, executando `rotear` contra o provedor real e conferindo que `foraDeEscopo` e `LIMIAR_AMBIGUIDADE` produzem o mesmo comportamento — **PARCIAL**: o import foi trocado e os 11 testes de `tests/unit/roteador.test.ts` passam com dublê; a execução contra o provedor real exige `OPENROUTER_API_KEY`, não configurada neste ambiente
- [ ] T018 [P] [US1] Verificar que `lib/ia/refinamento.ts` opera sem alteração além do import, conferindo que `saidaRefinamento` é satisfeita pelo novo modelo e que `prontoParaEntrega` continua sendo apenas sinal — quem decide segue sendo `lib/dominio/portao-refinamento.ts` — **PARCIAL**: import trocado, `saidaRefinamento` convertida e validada em `tests/unit/schema-provedor.test.ts`; a aderência do modelo real exige credencial
- [ ] T019 [US1] Verificar que `lib/ia/entrega.ts` opera sem alteração além do import e que `Entrega.versaoModelo` passa a receber `deepseek/deepseek-v4-flash-0731` em `app/api/atendimentos/[id]/entrega/route.ts` (FR-008, SC-005), sem tocar em `avaliarVedacaoPunitiva` — **PARCIAL**: import trocado, `versaoModelo: gerada.modelo` inalterado e `gerarEstruturado` devolve `MODELO_CAPAZ`; conferir o valor gravado no banco exige uma entrega real

**Checkpoint**: US1 completa. O ciclo de atendimento roda inteiramente no OpenRouter, com a estrutura garantida pelo Zod. Cenários 1, 2 e 5 do [quickstart.md](./quickstart.md) devem passar.

---

## Phase 4: User Story 2 - Estrutura obrigatória garantida mesmo com aderência imperfeita (Priority: P1)

**Goal**: enviar o schema ao provedor no dialeto estrito para reduzir a taxa de retentativa, sem que isso desloque a autoridade de aceitação do Zod.

**Independent Test**: simular respostas malformadas do provedor e verificar retentativa, log sem conteúdo de atendimento e erro explícito sem persistência ao esgotar as tentativas. A conversão de schema é uma função pura, testável sobre os cinco schemas reais de entrega sem nenhuma chamada de rede.

### Tests for User Story 2

- [X] T020 [P] [US2] Criar `tests/unit/schema-provedor.test.ts` cobrindo a conversão sobre os cinco schemas reais de `lib/assistentes/estruturas/` mais `saidaRoteamento` e `saidaRefinamento`: todo objeto tem `additionalProperties: false`; `required` lista todas as propriedades; nenhum `$ref`/`$defs` remanescente; `motivoRecusa` vira `type: ["string","null"]`; nenhuma das chaves proibidas de [contracts/provedor-ia.md §2.2](./contracts/provedor-ia.md) sobrevive
- [X] T021 [P] [US2] Adicionar a `tests/unit/schema-provedor.test.ts` a asserção que fixa a regra do Princípio V: as restrições removidas do schema do provedor (`min`, `max`, `maxItems`) continuam reprovando no Zod — uma resposta com `justificativa` de 3 caracteres ou `confianca` igual a 2 deve falhar em `safeParse`
- [X] T022 [P] [US2] Adicionar a `tests/unit/saida-estruturada.test.ts` o cenário de degradação: um HTTP 400 de parâmetro não suportado provoca uma única reemissão em modo `json_object`, registra `ia.json_schema_indisponivel` e não repete a degradação na chamada seguinte do mesmo processo

### Implementation for User Story 2

- [X] T023 [US2] Reescrever `paraSchemaDoProvedor()` em `lib/ia/saida-estruturada.ts` para o dialeto estrito de [contracts/provedor-ia.md §2.2](./contracts/provedor-ia.md): acrescentar `additionalProperties: false` a todo objeto, promover todas as propriedades a `required`, e remover `minLength`, `maxLength`, `minimum`, `maximum`, `minItems`, `maxItems`, `pattern`, `format`, `default`, `const`, `exclusiveMinimum` e `exclusiveMaximum`
- [X] T024 [US2] Alterar `derivarSchema()` em `lib/ia/saida-estruturada.ts` para chamar `zodToJsonSchema` com `target: 'jsonSchema7'` e `$refStrategy: 'none'`, de modo que `.nullable()` produza `type: [..., "null"]` e nenhum `$ref` sobreviva (R-02)
- [X] T025 [US2] Estender `chamarChat()` em `lib/ia/openrouter.ts` para enviar `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }` quando um schema for fornecido, e passar a fornecê-lo a partir de `lib/ia/saida-estruturada.ts` — **sem** enviar `provider.require_parameters` (R-02)
- [X] T026 [US2] Implementar em `lib/ia/openrouter.ts` a degradação única por processo: HTTP 400 indicando parâmetro não suportado marca o modo degradado em memória, registra `ia.json_schema_indisponivel` com evento e modelo, e reemite com `response_format: { type: 'json_object' }` e o schema serializado ao final da instrução de sistema

**Checkpoint**: US2 completa. Cenário 3 do [quickstart.md](./quickstart.md) deve passar, e a taxa de aprovação na primeira tentativa deve subir (SC-002).

---

## Phase 5: User Story 3 - Operação e diagnóstico da nova configuração (Priority: P2)

**Goal**: quem opera consegue configurar, diagnosticar e auditar qual modelo produziu o quê.

**Independent Test**: executar a rotina de diagnóstico com e sem credencial e confirmar que ela distingue os dois casos; conferir que a entrega persistida registra o identificador do modelo.

### Tests for User Story 3

- [X] T027 [P] [US3] Adicionar a `tests/unit/provedor-openrouter.test.ts` os casos de configurabilidade: com `OPENROUTER_MODELO_CAPAZ` definido no ambiente, `MODELO_CAPAZ` reflete o valor; sem a variável, cai no padrão; a presença isolada de `GEMINI_API_KEY` não satisfaz a configuração (FR-015)

### Implementation for User Story 3

- [X] T028 [US3] Atualizar `scripts/diagnostico-ia.ts` para reportar presença de `OPENROUTER_API_KEY` (só o tamanho, nunca o valor) e os três modelos configurados, importando de `../lib/ia/openrouter.js`
- [X] T029 [US3] Acrescentar a `scripts/diagnostico-ia.ts` uma terceira etapa de verificação da transcrição, separada das duas existentes, para que uma falha de áudio não seja confundida com falha de texto (depende de US4 para ter o que chamar; até lá, a etapa reporta "não implementada")
- [X] T030 [P] [US3] Ajustar em `app/api/atendimentos/route.ts` o tratamento de `ErroConfiguracaoIA` para cobrir também os novos casos 401/402/404, mantendo a mensagem "Os assistentes não estão configurados neste ambiente. Verifique a chave do provedor." e a distinção em relação a `PROVEDOR_INDISPONIVEL`
- [X] T031 [P] [US3] Aplicar o mesmo tratamento em `app/api/atendimentos/[id]/mensagens/route.ts`, conferindo que o log de falha registra `modelo` e `motivo` sem conteúdo de atendimento
- [X] T032 [US3] Conferir em `app/api/atendimentos/[id]/entrega/route.ts` que `versaoModelo: gerada.modelo` continua gravando o identificador vindo da camada de IA, sem alteração de código — e registrar a verificação (FR-008)

**Checkpoint**: US3 completa. Cenários 4 e 5 do [quickstart.md](./quickstart.md) devem passar.

---

## Phase 6: User Story 4 - Continuidade da entrada por voz (Priority: P2)

**Goal**: transcrição funcionando com credencial única, via endpoint dedicado do provedor, com o contrato da rota e a interface inalterados.

**Independent Test**: enviar um áudio válido e confirmar que o texto transcrito volta para revisão; enviar áudio inaudível e confirmar a sinalização de baixa confiança; confirmar que áudio inválido é recusado antes de qualquer chamada ao provedor.

### Tests for User Story 4

- [X] T033 [P] [US4] Criar em `tests/unit/transcricao.test.ts` os casos da função pura de confiança: texto vazio ou só espaços → erro "não foi possível identificar fala"; densidade de fala abaixo do piso → `confiancaBaixa: true`; texto abaixo do mínimo absoluto → `true`; texto normal → `false`
- [X] T034 [P] [US4] Adicionar a `tests/unit/transcricao.test.ts` a cobertura do mapa MIME → `format` para os seis tipos aceitos ([data-model.md §3.3](./data-model.md)), e preservar o caso existente que prova que arquivo inválido falha **antes** de o dublê ser invocado (FR-015)

### Implementation for User Story 4

- [X] T035 [US4] Implementar `chamarTranscricao()` em `lib/ia/openrouter.ts` conforme [contracts/provedor-ia.md §2.4](./contracts/provedor-ia.md): `POST /audio/transcriptions` com `model`, `input_audio: { data, format }`, `language: 'pt'` e o mesmo objeto `provider` de política de dados; devolver `{ texto, segundos }` a partir de `text` e `usage.seconds`
- [X] T036 [US4] Criar em `lib/ia/transcricao.ts` a função pura `avaliarConfianca(texto, segundos)` com as três regras de [data-model.md §3.2](./data-model.md), exportada para teste, com os limiares em constantes nomeadas
- [X] T037 [US4] Criar em `lib/ia/transcricao.ts` o mapa de tipo MIME → `format` do provedor cobrindo os seis tipos de `TIPOS_ACEITOS`, e fazer `validarAudio` continuar rejeitando qualquer tipo fora dele antes da chamada
- [X] T038 [US4] Substituir `transcritorPadrao` em `lib/ia/transcricao.ts` para usar `chamarTranscricao()` em vez do chat multimodal, removendo a constante `INSTRUCAO` e o `resultadoTranscricao.safeParse` sobre JSON do modelo — o provedor devolve texto puro, não JSON estruturado
- [X] T039 [US4] Alterar a assinatura de `TranscritorAudio` em `lib/ia/transcricao.ts` para devolver `{ texto, segundos }` e fazer `transcrever()` aplicar `avaliarConfianca` sobre esse resultado, preservando o contrato de saída `{ texto, confiancaBaixa }` e o erro de fala ausente
- [X] T040 [US4] Confirmar que `lib/ia/transcricao.ts` continua descartando os bytes do áudio ao fim da função e que nada é escrito em disco ou banco (SC-009, R-09) — sem alterar `app/api/transcricao/route.ts` nem `components/atendimento/GravadorRelato.tsx`
- [X] T041 [US4] Completar a etapa de transcrição em `scripts/diagnostico-ia.ts` (aberta em T029) com uma chamada real usando um áudio curto de exemplo, reportando texto e `confiancaBaixa`

**Checkpoint**: US4 completa. Cenários 6 e 7 do [quickstart.md](./quickstart.md) devem passar, e a plataforma opera com uma única credencial (FR-015).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: verificação constitucional, calibração e fechamento da migração

- [X] T042 Executar `npm run test:risco` sobre `tests/unit/deteccao-risco.test.ts` e confirmar 100% verde após a troca de modelo — portão de merge, SC-004
- [ ] T043 [P] Executar `npm run test:unit`, `npm run test:integration` e `npm run test:e2e` sobre `tests/unit/`, `tests/integration/` e `tests/e2e/` sem `OPENROUTER_API_KEY` no ambiente, confirmando que toda a suíte passa sem credencial (FR-014) — **PARCIAL**: `test:unit` passa 284/284 sem credencial; `test:integration` **não sobe neste ambiente por defeito preexistente** — `tests/global-setup-integration.ts` faz `prisma db push` com `DATABASE_URL=file:...` enquanto `prisma/schema.prisma` declara `provider = "postgresql"` desde o commit `c2b1ad0`, anterior a esta feature; `test:e2e` depende do app subindo com banco
- [ ] T044 **BLOQUEADA** (exige amostras de áudio e credencial) — Calibrar os limiares de `avaliarConfianca` em `lib/ia/transcricao.ts` contra um conjunto de amostras de áudio em português do Brasil — audíveis, ruidosas e silenciosas — e registrar os números escolhidos em comentário no código (SC-008)
- [ ] T045 **BLOQUEADA** (exige credencial; a parte automatizável já é coberta pelo teste de vazamento de log em `tests/unit/provedor-openrouter.test.ts`) — Executar o cenário 9 do [quickstart.md](./quickstart.md) forçando chave inválida e modelo inexistente, e inspecionar os registros produzidos para confirmar ausência de relato, resposta de refinamento, nome de pessoa, corpo de resposta do provedor e credencial (SC-006)
- [ ] T046 **BLOQUEADA** (exige 30 chamadas reais ao provedor) — Medir a taxa de aprovação na primeira tentativa em 30 execuções de entrega final, contando as ocorrências de `ia.schema_reprovado` emitidas por `lib/ia/saida-estruturada.ts`, e confirmar ≥95% (SC-002); medir também roteamento ≤5 s e entrega ≤30 s (SC-003), registrando os números em `docs/desempenho.md`
- [X] T047 [P] Verificar as fronteiras da feature com `git diff --stat lib/agentes/ lib/dominio/ prisma/ components/` — o resultado deve ser vazio (Princípios II, III, IV, V; R-09)
- [X] T048 [P] Verificar que nenhuma ocorrência de `GEMINI` ou `@google/genai` resta em código, `.env.example`, `README.md`, `package.json` ou `package-lock.json`, e que `lib/ia/gemini.ts` foi removido
- [X] T049 Reavaliar o Constitution Check de [plan.md](./plan.md) contra o código entregue, no formato da reavaliação pós-implementação da feature 001, apontando a evidência de cada princípio
- [ ] T050 Executar o [quickstart.md](./quickstart.md) inteiro, os dez cenários mais a checagem final de migração, e registrar o resultado — **PARCIAL**: cenários 3, 7 e 8 cobertos por teste automatizado e verdes; a checagem final de migração está integralmente cumprida (T047, T048); os cenários 1, 2, 4, 5, 6, 9 e 10 dependem de `OPENROUTER_API_KEY` e de banco disponível

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: depende do Setup — **BLOQUEIA todas as histórias**
- **US1 (Phase 3)**: depende da Phase 2
- **US2 (Phase 4)**: depende da Phase 2 e de T014/T015 de US1 (o `chamarChat` que ela estende)
- **US3 (Phase 5)**: depende da Phase 2. T029 fica parcial até US4
- **US4 (Phase 6)**: depende da Phase 2. Independente de US1, US2 e US3 — endpoint e módulo distintos
- **Polish (Phase 7)**: depende de todas as histórias desejadas

### User Story Dependencies

- **US1 (P1)**: primeira história implementável após a fundação. Nenhuma dependência de outra história
- **US2 (P1)**: depende de US1 apenas por estender `chamarChat`. É a única dependência entre histórias, e é deliberada: US1 entrega o ciclo funcionando em modo JSON livre, US2 acrescenta o schema estrito por cima
- **US3 (P2)**: independente. Pode ser feita em paralelo com US1/US2 por outra pessoa
- **US4 (P2)**: totalmente independente — outro endpoint, outro modelo, outro módulo

### Within Each User Story

- Testes escritos antes da implementação, e devem falhar antes dela
- Cliente do provedor antes dos módulos que o consomem
- Módulos de `lib/ia/` antes das rotas em `app/api/`
- História concluída antes de passar para a próxima prioridade

### Parallel Opportunities

- Setup: T002, T003 e T004 em paralelo (arquivos diferentes)
- Foundational: T010 em paralelo com T005–T009 (arquivo de teste separado)
- US1: T012 e T013 em paralelo; T017 e T018 em paralelo após T015
- US2: T020, T021 e T022 em paralelo (dois arquivos de teste)
- US3: T030 e T031 em paralelo (rotas diferentes)
- US4: T033 e T034 em paralelo
- Polish: T043, T047 e T048 em paralelo
- **Entre histórias**: com mais de uma pessoa, US4 e US3 podem correr em paralelo com US1/US2 — tocam arquivos disjuntos

---

## Parallel Example: User Story 4

```bash
# Testes de US4 juntos:
Task: "Casos da função pura de confiança em tests/unit/transcricao.test.ts"
Task: "Cobertura do mapa MIME → format em tests/unit/transcricao.test.ts"

# Depois, implementação em sequência (mesmo arquivo lib/ia/transcricao.ts):
Task: "chamarTranscricao() em lib/ia/openrouter.ts"
Task: "avaliarConfianca() em lib/ia/transcricao.ts"
```

---

## Implementation Strategy

### MVP First (US1 apenas)

1. Phase 1: Setup
2. Phase 2: Foundational (**crítica** — bloqueia tudo)
3. Phase 3: US1
4. **PARAR E VALIDAR**: cenários 1, 2 e 5 do quickstart nas cinco especialidades
5. Neste ponto a plataforma já opera no OpenRouter para texto, com o Zod garantindo a estrutura

### Entrega incremental

1. Setup + Foundational → fundação pronta
2. US1 → validar → o produto funciona no novo provedor (**MVP**)
3. US2 → validar → menos retentativas, mesma garantia
4. US4 → validar → provedor único de fato; a dependência do Gemini pode sair
5. US3 → validar → operação e diagnóstico completos
6. Polish → verificação constitucional e calibração

**Nota sobre a ordem**: US4 vem antes de US3 na entrega incremental, apesar da mesma prioridade
P2, porque é ela que fecha FR-015 — enquanto a transcrição não migrar, a plataforma ainda depende
de dois provedores e T029 fica em aberto.

### Parallel Team Strategy

Com mais de uma pessoa, após a Phase 2:

- Pessoa A: US1 → US2 (sequenciais entre si)
- Pessoa B: US4 (independente, arquivos disjuntos)
- Pessoa C: US3 (independente; T029 fecha após US4)

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- `[Story]` mapeia a tarefa à história, para rastreabilidade
- Verificar que os testes falham antes de implementar
- Commit por tarefa ou grupo lógico
- Parar em qualquer checkpoint para validar a história isoladamente
- **Três pontos ficaram marcados como "a confirmar na implementação"** em [research.md](./research.md): se o `verbose_json` do Voxtral traz sinal de confiança utilizável (substituiria a heurística de T036); a duração de áudio a partir da qual o teto de ~60 s de processamento estoura (T044); e se `zdr: true` + `data_collection: "deny"` deixa o modelo sem endpoint elegível (T007) — neste último caso, **escalar a decisão, não relaxar a política**
