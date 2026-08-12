# Phase 1 — Data Model: refinamento sem repetição

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Uma alteração de schema: uma coluna nova, opcional, em `lacunas`. Tudo o mais é estado derivado
ou objeto de tempo de execução.

---

## 1. `Lacuna` — entidade persistida

### 1.1 O que muda

| Campo | Tipo | Novo? | Regra |
|---|---|---|---|
| `origemFechamento` | texto, opcional | **sim** | `resposta_direta` \| `aproveitada`. Nulo enquanto a lacuna está aberta ou não aplicável. Preenchido no momento do fechamento por resposta |

**Migração**: coluna nullable, sem *default*, sem backfill. Lacunas anteriores à implantação
ficam com nulo — e nulo significa "fechada antes de a origem passar a ser registrada", que é
informação honesta. Inventar `resposta_direta` retroativamente seria fabricar auditoria.

**Não é cifrada**: é um rótulo de enumeração de dois valores, não conteúdo de atendimento. Segue
a mesma regra que `estado`, `critica` e `ordem`, que já vivem em claro para serem consultáveis.

### 1.2 O que não muda

`pergunta`, `porQueImporta`, `resposta` e `justificativaNaoAplicavel` continuam cifradas.
`ordem` continua monotônica e continua sendo a chave da ordenação — agora com um papel a mais:
é ela que define a fila (§3).

### 1.3 Transições de estado

```text
aberta ──resposta direta do BP──────────→ respondida  (origemFechamento = resposta_direta)
aberta ──sinal do modelo + resposta────→ respondida  (origemFechamento = aproveitada)
aberta ──"não se aplica" + justificativa→ nao_aplicavel  (origemFechamento = null)
```

**Invariante do Princípio II**: nenhuma transição para `respondida` ocorre sem conteúdo gravado em
`resposta`. O aproveitamento grava a resposta real que o BP deu na rodada — ele associa uma
resposta existente a outra pergunta, nunca cria resposta.

Não há transição de volta: lacuna resolvida não reabre.

---

## 2. Sinal de resolução do assistente

Objeto de tempo de execução, já existente no schema Zod `saidaRefinamento` e até aqui descartado.

| Campo | Tipo | Observação |
|---|---|---|
| `lacunasResolvidas[].lacunaId` | string | id que o assistente afirma ter sido esclarecido pela última resposta |

**É evidência, não decisão.** Filtros aplicados antes de qualquer escrita (FR-002, FR-003):

| Verificação | Ação quando falha |
|---|---|
| A rodada tem conteúdo do BP? | o sinal inteiro é ignorado |
| O `lacunaId` existe neste atendimento? | aquele item é descartado, sem erro |
| A lacuna já está resolvida? | aquele item é ignorado, sem efeito |
| É a lacuna que o BP respondeu diretamente? | tratada pelo caminho direto, não pelo aproveitamento |

Itens descartados entram apenas na contagem `sinais_ignorados` (§5).

---

## 3. Fila de apresentação — estado derivado

**Não existe coluna, tabela nem cache.** É uma projeção calculada a cada leitura:

```text
não resolvidas  = lacunas onde lacunaResolvida(l) é falso
críticas        = não resolvidas onde critica = true
apresentadas    = críticas ordenadas por `ordem`, as 3 primeiras
em fila         = críticas ordenadas por `ordem`, da 4ª em diante
```

| Propriedade | Valor | Vem de |
|---|---|---|
| `LIMITE_APRESENTADAS` | 3 | constante nomeada, ponto único de ajuste |
| Ordenação | `ordem` ascendente | já indexada em `@@index([atendimentoId, ordem])` |
| Estabilidade na retomada | garantida | `ordem` é imutável após a criação (FR-015) |

**A regra que não pode ser violada** (FR-014): `em fila` é subconjunto de `não resolvidas`.
Pendência em fila bloqueia a entrega exatamente como uma apresentada. O limite governa o que o BP
vê, nunca o que o portão exige.

**Pendências não críticas** (FR-016): ficam fora do limite e fora do bloqueio, como hoje.

---

## 4. Avaliação do portão — objeto de tempo de execução

Hoje `avaliarPortao` devolve a decisão e a lista renderizada na mesma estrutura. Passa a separar:

| Campo | Calculado sobre | Serve para |
|---|---|---|
| `liberada` | **todas** as críticas não resolvidas | a decisão do Princípio II |
| `apresentadas` | as 3 primeiras críticas não resolvidas | o que a rota envia à interface |
| `totalCriticasAbertas` | todas as críticas não resolvidas | observabilidade e SC-002 |
| `totalAbertas` | todas as não resolvidas, críticas ou não | inalterado |
| `totalResolvidas` | todas as resolvidas | inalterado |

`podeEmitirEntrega()` continua sendo o predicado usado pela rota de entrega e continua olhando
todas as críticas — nenhuma alteração de comportamento ali.

---

## 5. Proposta de pergunta — objeto de tempo de execução

Pergunta que o assistente sugere acrescentar, antes de virar lacuna.

| Campo | Tipo | Origem |
|---|---|---|
| `pergunta` | string | modelo — **conteúdo sensível** |
| `porQueImporta` | string | modelo — **conteúdo sensível** |
| `critica` | boolean | modelo |

**Verificação de equivalência** (FR-005, FR-006), na ordem:

1. contra todas as perguntas já existentes no atendimento — abertas, respondidas ou não
   aplicáveis;
2. contra as propostas já aceitas **na mesma rodada**.

Equivalente → descartada, sem persistir. Na dúvida → mantida (assimetria de erro, R-02).

### 5.1 Normalização e comparação

| Etapa | Efeito |
|---|---|
| minúsculas | `Qual` → `qual` |
| remoção de acentos | `próximo` → `proximo` |
| remoção de pontuação | `prazo?` → `prazo` |
| colapso de espaços | `a  b` → `a b` |
| remoção de palavras vazias em pt-BR | artigos, preposições, pronomes, interrogativos |
| conjunto de palavras de conteúdo | `{prazo, comunicar}` |
| índice de Jaccard | interseção ÷ união |
| limiar | `LIMIAR_EQUIVALENCIA = 0,80` |

Ambos os limiares e a lista de palavras vazias ficam em constantes nomeadas, calibradas contra
`tests/fixtures/pares-equivalencia/`.

---

## 6. Observabilidade da rodada — objeto de tempo de execução

Evento emitido uma vez por rodada. **Somente contagens** (FR-011, FR-012, SC-007, SC-008):

| Campo | Tipo | Contém conteúdo? |
|---|---|---|
| `atendimentoId` | string | não |
| `propostas` | número | não |
| `descartadas_equivalentes` | número | não |
| `fechadas_aproveitamento` | número | não |
| `sinais_ignorados` | número | não |
| `criticas_abertas` | número | não |
| `apresentadas` | número | não |

Os campos com texto de pergunta ou resposta **não são montados** — a proteção é anterior à
redação do `logger`, não dependente dela.
