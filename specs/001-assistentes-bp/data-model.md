# Phase 1 — Data Model: App de Assistentes Especializados para BP

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Modelo derivado das entidades da spec. Restrições do conector SQLite do Prisma (decisão R-03)
aplicadas: sem `enum`, sem tipo `Json`, sem arrays escalares. Campos de valor restrito são
`String` validados por união Zod no domínio; estruturas compostas são `String` com JSON
serializado, parseado por Zod na leitura.

Campos marcados **[cifrado]** são cifrados em repouso (R-08) e nunca aparecem em log.

---

## Usuario

O Business Partner que opera o app.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String (cuid) | PK |
| `email` | String | único, formato de e-mail |
| `nome` | String | 2–120 caracteres |
| `senhaHash` | String | nunca exposto por nenhuma rota |
| `organizacao` | String? | unidade/organização a que pertence |
| `criadoEm` | DateTime | default now |
| `ativo` | Boolean | default true; inativo não autentica |

**Relações**: 1—N `Atendimento` (como autor), 1—N `RegistroAuditoria`.

---

## Assistente

Catálogo das especialidades. Persistido para dar integridade referencial ao histórico; os
metadados de comportamento continuam vindo do prompt canônico (R-06).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String | PK; chave estável da especialidade |
| `nome` | String | rótulo exibido ao BP |
| `descricao` | String | usado na tela de catálogo e na justificativa de indicação |
| `dominios` | String | JSON: lista de domínios de atuação |
| `arquivoPrompt` | String | caminho relativo em `lib/agentes/` |
| `estruturaEntrega` | String | identificador do schema Zod da entrega |
| `sensivelPorPadrao` | Boolean | true para compliance/denúncias |
| `ativo` | Boolean | permite retirar uma especialidade sem apagar histórico |

**Valores de `id`** (FR-001): `mentoria-bp`, `etica-compliance`, `comunicacao-lideranca`,
`treinamento-desenvolvimento`, `engenharia-prompts`.

**Regra**: registros semeados a partir do catálogo em código. O app nunca escreve em
`arquivoPrompt` nem edita o arquivo apontado.

---

## Atendimento

Uma sessão de trabalho entre o BP e um assistente sobre uma demanda.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String (cuid) | PK |
| `autorId` | String | FK → `Usuario`; **filtro obrigatório em toda leitura** (FR-017) |
| `assistenteId` | String | FK → `Assistente` |
| `relatoInicial` | String | **[cifrado]**; 1–20.000 caracteres (FR: relato extenso sinalizado, não truncado) |
| `origemRelato` | String | `texto` \| `audio` |
| `estado` | String | `em_andamento` \| `concluido` \| `incompleto` |
| `classificacaoSigilo` | String | `padrao` \| `sensivel` |
| `assistenteSugerido` | String? | especialidade indicada pelo roteamento |
| `justificativaSugestao` | String? | exibida ao BP (FR-002) |
| `trocaManual` | Boolean | true se o BP sobrepôs a indicação (alimenta SC-002) |
| `promptHash` | String | SHA-256 do prompt canônico usado (R-06) |
| `criadoEm` | DateTime | default now |
| `ultimaInteracaoEm` | DateTime | base do encerramento de 90 dias (FR-018) |
| `concluidoEm` | DateTime? | marca o início da contagem de retenção |
| `expurgarEm` | DateTime? | `concluidoEm` + 24 meses (FR-026) |

**Relações**: N—1 `Usuario`, N—1 `Assistente`, 1—N `Lacuna`, 1—N `MensagemRefinamento`,
1—1 `Entrega`, 1—N `SinalizacaoEscalonamento`, 1—N `RegistroAuditoria`.

**Índices**: (`autorId`, `criadoEm`) para o histórico; (`estado`, `ultimaInteracaoEm`) para o
encerramento automático; (`expurgarEm`) para o expurgo.

### Transições de estado

```
                 ┌───────────────────────────────┐
                 │                               │
  [criado] ──► em_andamento ──► concluido ──► [expurgado]
                    │                24 meses após concluidoEm
                    │
                    └──► incompleto  (90 dias sem interação, ou exclusão a pedido)
```

- `em_andamento → concluido`: permitido **somente** quando não há `Lacuna` crítica `aberta`
  (Princípio II, FR-007). A verificação é do servidor, não do modelo.
- `em_andamento → incompleto`: automático após 90 dias sem interação (FR-018).
- `concluido` é terminal para edição; a reabertura é somente leitura (FR-016).
- Qualquer estado → expurgo: apaga conteúdo, preserva auditoria anonimizada (R-11).

---

## Lacuna

Informação que o assistente precisa antes de poder emitir a entrega. É o que torna o Princípio
II verificável.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String (cuid) | PK |
| `atendimentoId` | String | FK → `Atendimento` |
| `pergunta` | String | **[cifrado]**; pergunta objetiva ao BP |
| `critica` | Boolean | true bloqueia a entrega final |
| `estado` | String | `aberta` \| `respondida` \| `nao_aplicavel` |
| `resposta` | String? | **[cifrado]**; obrigatória se `respondida` |
| `justificativaNaoAplicavel` | String? | obrigatória se `nao_aplicavel` (FR-008) |
| `ordem` | Int | define a próxima pergunta na retomada (US2) |
| `criadaEm` / `resolvidaEm` | DateTime / DateTime? | |

**Invariantes**:
- `estado = respondida` ⟹ `resposta` não vazia.
- `estado = nao_aplicavel` ⟹ `justificativaNaoAplicavel` não vazia.
- Existe `Lacuna` com `critica = true` e `estado = aberta` ⟹ emissão de entrega recusada.
- A "próxima pergunta pendente" na retomada é a lacuna `aberta` de menor `ordem`.

---

## MensagemRefinamento

O diálogo que originou a entrega, preservado para auditoria e para a reabertura (FR-014).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String (cuid) | PK |
| `atendimentoId` | String | FK → `Atendimento` |
| `autor` | String | `bp` \| `assistente` |
| `conteudo` | String | **[cifrado]** |
| `criadaEm` | DateTime | ordena o diálogo |

---

## Entrega

Documento final produzido no atendimento (Princípio V).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String (cuid) | PK |
| `atendimentoId` | String | FK único → `Atendimento` (1—1) |
| `estruturaAplicada` | String | identificador do schema validado |
| `conteudo` | String | **[cifrado]**; JSON da entrega estruturada |
| `planoAcao` | String | **[cifrado]**; JSON: itens com ação, responsável, prazo (FR-011) |
| `marcacaoSigilo` | String | `publico_interno` \| `restrito` |
| `notaGuarda` | String? | preenchida quando `restrito` (FR-022) |
| `versaoModelo` | String | modelo do provedor que gerou a entrega |
| `geradaEm` | DateTime | |

**Invariantes**:
- Persistida somente após validação bem-sucedida contra o schema da especialidade (SC-003).
- `planoAcao` não vazio — toda recomendação carrega plano de ação (FR-011).
- Atendimento com `classificacaoSigilo = sensivel` ⟹ `marcacaoSigilo = restrito` e
  `notaGuarda` preenchida.

---

## SinalizacaoEscalonamento

Registro de risco jurídico detectado (Princípio III).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String (cuid) | PK |
| `atendimentoId` | String | FK → `Atendimento` |
| `tipoRisco` | String | `assedio_moral` \| `assedio_sexual` \| `discriminacao` \| `fraude` \| `justa_causa` \| `acao_trabalhista` \| `dado_sensivel` |
| `instanciaRecomendada` | String | `juridico` \| `relacoes_trabalhistas` \| `compliance` |
| `origemDeteccao` | String | `regra` \| `modelo` \| `ambos` (R-05) |
| `trechoGatilho` | String? | **[cifrado]**; evidência da detecção |
| `detectadaEm` | DateTime | |

**Invariantes**:
- Existência de sinalização ⟹ a recomendação é renderizada **acima** do plano de ação (FR-012).
- Detecção por qualquer camada é suficiente para criar o registro — não se exige concordância.
- `tipoRisco` em `{assedio_sexual, discriminacao, fraude}` ⟹ `instanciaRecomendada = juridico`.

---

## RegistroAuditoria

Trilha exigida pelo Princípio I (FR-024).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String (cuid) | PK |
| `atendimentoId` | String? | nulo após expurgo do atendimento |
| `usuarioId` | String? | anonimizado no expurgo |
| `acao` | String | `acesso` \| `exportacao` \| `exclusao` \| `expurgo_retencao` |
| `ocorridoEm` | DateTime | |
| `detalhe` | String? | JSON; formato de exportação, motivo da exclusão |

**Invariantes**:
- Todo acesso e toda exportação de atendimento `sensivel` gera registro (SC-009).
- Registros de auditoria **não** são apagados pelo expurgo de retenção — são anonimizados.

---

## Regras transversais de validação

Todas expressas como schemas Zod em `lib/validacao/` e reutilizadas nas fronteiras (entrada
HTTP, saída do modelo, leitura de campo JSON):

1. Todo campo `String` de valor restrito tem união Zod correspondente; o banco não a garante.
2. Todo campo que guarda JSON é parseado por Zod na leitura — dado corrompido falha alto, não
   silenciosamente.
3. Texto submetido pelo BP: mínimo 1 caractere, máximo declarado por campo, sem truncamento
   silencioso.
4. Datas persistidas em UTC; formatação pt-BR ocorre só na apresentação (FR-029).
5. Nenhum campo **[cifrado]** pode ser usado em `where`, `orderBy` ou índice — filtro só sobre
   metadados em claro.
