# Phase 0 — Research: refinamento sem repetição

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data**: 2026-08-11

Nenhum `NEEDS CLARIFICATION` restou no Technical Context. As decisões abaixo saíram da leitura do
código existente, não de fontes externas — o problema é de desenho interno.

---

## R-01 — Onde a deduplicação pode acontecer: em memória, nunca no banco

**Decisão**: comparar perguntas em memória, na camada de domínio, depois de decifrar.

**Racional**: `pergunta` é cifrada com AES-256-GCM e **IV aleatório por chamada**
([cripto.ts:58](../../lib/dados/cripto.ts)). Duas perguntas idênticas geram cifras diferentes, e
o formato `v1:iv:tag:dados` não é comparável nem por igualdade nem por `LIKE`. Qualquer tentativa
de deduplicar em SQL — índice único, `DISTINCT`, comparação de coluna — é impossível por
construção, e é bom que seja: um índice sobre pergunta em claro reintroduziria no banco
exatamente o que o Princípio I mandou cifrar.

A rota já carrega todas as lacunas decifradas antes de chamar o modelo
(`listarLacunas` em [mensagens/route.ts:60](../../app/api/atendimentos/[id]/mensagens/route.ts)),
então a comparação não custa consulta adicional.

**Alternativas consideradas**:

- **Hash determinístico da pergunta normalizada, gravado em coluna indexada**: permitiria
  deduplicação no banco e detecção de duplicata exata em O(1). Rejeitado: um hash de texto curto
  e previsível ("qual o prazo?") é reversível por dicionário, o que o transformaria em vazamento
  de conteúdo em repouso. E só pegaria duplicata exata, que é o caso fácil.
- **Cifragem determinística para o campo pergunta**: mesma objeção, agravada — tornaria todo o
  corpus de perguntas correlacionável.

---

## R-02 — Como decidir que duas perguntas são equivalentes

**Decisão**: duas camadas, no mesmo espírito da detecção de risco da feature 001 (regra
determinística ∪ sinal do modelo), mas com os papéis invertidos — aqui o modelo faz o trabalho
semântico e o servidor é a rede de segurança determinística.

**Camada 1 — o assistente** (FR-008): `CONTRATO_SAIDA` passa a instruir explicitamente que
`novasLacunas` não deve repetir nem reformular pergunta já feita, e `montarEntrada` passa a
destacar o que já foi respondido em vez de listá-lo em pé de igualdade com o que está aberto. O
modelo já recebe todo o histórico de perguntas e respostas; o que falta é a instrução.

**Camada 2 — o servidor**: função pura `saoEquivalentes(a, b)` sobre texto normalizado.

Normalização: minúsculas → remoção de acentos → remoção de pontuação → colapso de espaços →
remoção de palavras vazias em português (artigos, preposições, pronomes, verbos de interrogação
como "qual", "quanto", "como"). Sobram as palavras de conteúdo.

Comparação: índice de Jaccard sobre o conjunto de palavras de conteúdo, com limiar. Acima do
limiar, equivalentes.

**Limiar conservador, por assimetria de erro**: a spec fixa que, na dúvida, a pergunta é
**mantida**. Uma pendência a mais custa uma pergunta ao BP; uma pendência descartada por engano
custa uma entrega mal fundamentada — e o Princípio II existe justamente para impedir a segunda.
O limiar inicial proposto é **0,80**, calibrado contra o conjunto de pares em
`tests/fixtures/pares-equivalencia/`.

O caso que a spec cita como armadilha funciona: "qual o prazo para comunicar" e "qual o prazo
para implementar" reduzem a `{prazo, comunicar}` e `{prazo, implementar}`, Jaccard = 1/3 ≈ 0,33 —
bem abaixo do limiar, as duas sobrevivem.

**Limitação que precisa ficar registrada**: a camada 2 é **lexical, não semântica**. Ela pega
repetição literal e quase literal — que é a maioria do que se observa quando um modelo repete —,
mas não pega paráfrase genuína. "Qual o prazo para comunicar a mudança?" e "Em quanto tempo a
comunicação precisa sair?" reduzem a conjuntos quase disjuntos e ambas sobreviveriam. **A
paráfrase é responsabilidade da camada 1.** Isso significa que o cenário 2 da US1 depende do
comportamento do modelo, e é por isso que SC-001 mede o resultado em 10 atendimentos reais em vez
de confiar apenas em teste unitário.

**Alternativas consideradas**:

- **Embeddings + similaridade de cosseno**: resolveria a paráfrase de verdade. Rejeitado por
  agora: exige uma chamada ao provedor por pergunta proposta (custo e latência em um laço que já
  é o gargalo percebido), um modelo de embedding a mais para versionar, e enviaria mais conteúdo
  de atendimento para fora. Se SC-001 reprovar na medição, esta é a evolução natural — e aí passa
  a ser feature própria, com o custo declarado.
- **Perguntar ao modelo, em chamada separada, se duas perguntas são equivalentes**: colocaria uma
  decisão de domínio de volta nas mãos do modelo, contra o que a feature 001 estabeleceu, e
  dobraria as chamadas por rodada.
- **Distância de Levenshtein sobre a frase inteira**: sensível a ordem e a tamanho; "o prazo é
  qual?" e "qual é o prazo?" ficariam distantes. Conjunto de tokens é mais robusto para o que
  importa aqui.

---

## R-03 — Como consumir `lacunasResolvidas` sem entregar o portão ao modelo

**Decisão**: o sinal do modelo **não muda o estado da lacuna diretamente**. Ele indica quais
pendências a resposta que o BP acabou de dar também esclarece; o servidor então **grava essa
mesma resposta** na lacuna apontada, marcando `origemFechamento = 'aproveitada'`.

**Por que isso é seguro**: `lacunaResolvida()` em
[portao-refinamento.ts:44](../../lib/dominio/portao-refinamento.ts) considera resolvida a lacuna
com `estado = 'respondida'` **e** conteúdo de resposta não vazio. Como o aproveitamento grava
conteúdo real do BP, o predicado do Princípio II continua valendo **sem nenhuma alteração** e sem
passar a confiar no modelo. Se o modelo mentir, ele consegue no máximo associar uma resposta
verdadeira à pergunta errada — nunca fabricar uma resposta que não existe.

**Verificações antes de aplicar o sinal** (FR-002, FR-003):

1. a rodada precisa ter conteúdo do BP (resposta ou justificativa de não aplicável); sem isso, o
   sinal inteiro é ignorado;
2. cada `lacunaId` precisa pertencer ao atendimento em questão — id de outro atendimento é
   descartado sem erro;
3. lacuna já resolvida é ignorada, sem efeito e sem erro;
4. a lacuna que o BP respondeu diretamente nesta rodada é fechada pelo caminho de sempre, com
   `origemFechamento = 'resposta_direta'`, e não pelo aproveitamento.

**Alternativas consideradas**:

- **Marcar `estado = 'respondida'` com `resposta` vazia e confiar no sinal**: quebraria
  `lacunaResolvida()` ou exigiria afrouxá-lo. É exatamente a regressão que a US3 existe para
  impedir.
- **Criar um estado novo, `resolvida_por_inferencia`, que o portão aceite**: acrescentaria um
  caminho de liberação que não exige conteúdo — mesma objeção, com mais superfície.
- **Ignorar o sinal e resolver tudo por deduplicação**: não resolve o caso em que a resposta do BP
  cobre uma pendência **já aberta** com redação diferente; ela continuaria bloqueando o portão
  indefinidamente.

---

## R-04 — A fila: derivada, sem coluna nova

**Decisão**: as pendências apresentadas são as **3 primeiras lacunas críticas não resolvidas,
ordenadas por `ordem`**. Não há coluna `apresentada`, nem tabela de fila.

**Racional**: `ordem` já existe, já é monotônica (`proximaOrdem` soma 1 ao maior) e já indexa a
tabela (`@@index([atendimentoId, ordem])`). Derivar dá de graça três coisas que FR-015 pede:
determinismo, estabilidade na retomada e ausência de estado a sincronizar. Uma coluna
`apresentada` seria estado redundante, passível de divergir do conjunto real de não resolvidas —
e divergência aqui significa pendência que some da tela sem ter sido respondida.

**A separação que o portão precisa** (FR-014): `avaliarPortao` hoje devolve, na mesma estrutura,
a decisão e a lista renderizada. Passa a devolver três coisas distintas:

- `liberada` — computada sobre **todas** as críticas não resolvidas, apresentadas ou em fila;
- `apresentadas` — as até 3 primeiras, que a rota envia à interface;
- `totalCriticasAbertas` — contagem completa, para observabilidade.

O limite governa `apresentadas`. Ele **não** entra em `liberada`. Essa é a linha que não pode ser
cruzada: uma pendência fora da tela não é uma pendência resolvida.

**Limite como constante nomeada**: `LIMITE_APRESENTADAS = 3` em `portao-refinamento.ts`, ponto
único de ajuste, conforme a premissa da spec.

**Alternativas consideradas**:

- **Coluna `apresentada` mantida pela rota**: estado duplicado, com risco de divergir.
- **Limitar na interface, mandando tudo do servidor**: o BP continuaria recebendo a lista inteira
  no payload, e a "fila" viraria decisão de cliente — não auditável, e o contador
  `Ainda falta responder (N)` seguiria crescendo, que é justamente o que ele reclamou.

---

## R-05 — Deduplicação também na primeira rodada

**Decisão**: aplicar a mesma verificação de equivalência em
[atendimentos/route.ts](../../app/api/atendimentos/route.ts), na criação do atendimento.

**Racional**: FR-006 exige deduplicar entre as perguntas propostas **na mesma rodada**, e a
primeira rodada é uma rodada. Hoje ela insere as até 6 lacunas iniciais sem verificação alguma; o
modelo pode propor duas formulações do mesmo pedido logo de saída. Não custa nada: a mesma função
pura, com o conjunto de existentes vazio.

---

## R-06 — Observabilidade sem conteúdo

**Decisão**: cada rodada emite um evento com **contagens apenas**:

| Campo | Significado |
|---|---|
| `propostas` | quantas lacunas o modelo sugeriu |
| `descartadas_equivalentes` | quantas foram descartadas por equivalência |
| `fechadas_aproveitamento` | quantas fecharam pelo sinal do modelo |
| `sinais_ignorados` | quantos `lacunaId` inválidos ou já resolvidos vieram |
| `criticas_abertas` | total após a rodada |
| `apresentadas` | quantas foram enviadas à interface |

Nenhum texto de pergunta, resposta ou relato. O `logger` já redige as chaves `pergunta`,
`resposta` e `justificativa` ([logger.ts:15-32](../../lib/observabilidade/logger.ts)), mas a
proteção aqui é anterior: **esses campos nunca são montados**. SC-007 e SC-008 saem inteiramente
desses contadores — inclusive a detecção de deduplicação agressiva demais, que aparece como
`descartadas_equivalentes` alto com `criticas_abertas` caindo rápido demais.

---

## R-07 — Onde a instrução de não repetir pode morar

**Decisão**: em `CONTRATO_SAIDA`, dentro de
[lib/ia/refinamento.ts](../../lib/ia/refinamento.ts).

**Racional**: o Princípio IV protege `lib/agentes/*.md` — os prompts canônicos que definem o
comportamento de cada especialidade. `CONTRATO_SAIDA` é outra coisa: é o contrato de formato que
o sistema impõe por cima do prompt, já versionado como código e já contendo regras equivalentes
("Nunca produza a entrega final nesta etapa"). Acrescentar "não repita nem reformule pergunta já
feita" é a mesma natureza de regra, no mesmo lugar. Nenhum arquivo canônico é tocado.

Junto vai um ajuste em `montarEntrada`: hoje as perguntas já feitas aparecem em uma lista única
com o estado ao lado. Passam a ser separadas em "já respondidas — não pergunte isso de novo" e
"ainda abertas", para que a distinção seja estrutural e não dependa do modelo interpretar o
sufixo de estado.

---

## R-08 — O que esta feature deliberadamente não faz

Registrado para que o `/speckit-tasks` não expanda o escopo:

- **Não altera prompts canônicos** (`lib/agentes/*.md`) — Princípio IV.
- **Não altera a detecção de risco nem a vedação punitiva** — `detectarRisco` continua recebendo
  a resposta integral do BP.
- **Não altera a interface** — `PainelLacunas.tsx` e `Atendimento.tsx` apenas recebem uma lista
  menor.
- **Não reprocessa atendimentos existentes** — lacunas antigas ficam com `origemFechamento` nulo.
- **Não introduz embeddings nem chamada extra ao modelo.**
- **Não mexe no roteamento, na entrega final, na exportação nem na retenção.**
