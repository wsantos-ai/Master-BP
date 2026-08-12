# Implementation Plan: Refinamento sem repetição

**Branch**: `develop` (repositório sem branch por feature; identificada por `specs/003-refinamento-sem-repeticao/`) | **Date**: 2026-08-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-refinamento-sem-repeticao/spec.md`

## Summary

Corrigir o laço de refinamento em três frentes: aproveitar o sinal do assistente sobre lacunas
resolvidas (hoje descartado), descartar perguntas equivalentes a outras já existentes no
atendimento (hoje não há deduplicação alguma), e apresentar no máximo 3 pendências críticas por
vez, mantendo as demais em fila.

A abordagem técnica central: **as três correções são funções puras em `lib/dominio/`, e a rota
apenas as orquestra**. É a mesma escolha que a feature 001 fez para o portão de refinamento e
para a detecção de risco — controle constitucional vira código testável sem servidor e sem
modelo. Nenhuma das três decisões fica a cargo do assistente.

Três consequências de desenho decorrem do código existente:

1. **A deduplicação não pode acontecer no banco.** `pergunta` é cifrada com AES-256-GCM e IV
   aleatório ([cripto.ts:58](../../lib/dados/cripto.ts)), então dois textos idênticos produzem
   cifras diferentes. Comparação só existe em memória, depois de decifrar.
2. **A fila não precisa de coluna nova.** As apresentadas são as 3 primeiras lacunas críticas não
   resolvidas por `ordem` — derivado, determinístico e estável na retomada, que é exatamente o
   que FR-015 pede. A única coluna nova é `origemFechamento`, exigida por FR-004.
3. **A UI não muda.** O painel já exibe uma pergunta por vez, com as demais atrás de um
   `<details>` e um contador `Ainda falta responder (N)`
   ([PainelLacunas.tsx:43-48](../../components/atendimento/PainelLacunas.tsx)). O que cresceu na
   tela do BP foi esse contador e essa lista. Limitando a 3 no servidor, a percepção se corrige
   sem tocar em componente algum.

**O ponto que exige mais cuidado**: consumir `lacunasResolvidas` cria um caminho novo pelo qual
uma lacuna crítica pode ser fechada. O desenho fecha esse caminho gravando a resposta real do BP
na lacuna aproveitada — de modo que `lacunaResolvida()`, o predicado do Princípio II, continua
valendo sem alteração e sem passar a confiar no modelo.

## Technical Context

**Language/Version**: TypeScript 5.7 sobre Node.js 20 LTS (inalterado)

**Primary Dependencies**: Next.js 15, React 19, Prisma ORM, Zod 3. **Nenhuma dependência nova** —
a comparação de similaridade é implementada no repositório, sem biblioteca de NLP.

**Storage**: PostgreSQL via Prisma. **Uma migração**: coluna `origemFechamento` (texto, opcional)
em `lacunas`. A fila e o limite de 3 são derivados, sem coluna.

**Testing**: Vitest para as funções puras de domínio e para a orquestração da rota; Playwright
para o fluxo. Conjunto de casos de equivalência (`tests/fixtures/`) como suíte de calibração, no
mesmo espírito da bateria de risco da feature 001.

**Target Platform**: Web responsiva servida por Node.js; produção na Vercel

**Project Type**: Web application full-stack em projeto único Next.js

**Performance Goals**: a deduplicação roda sobre dezenas de lacunas por atendimento — comparação
O(n·m) sobre conjuntos de tokens é irrelevante diante da latência do modelo. Nenhuma meta nova.

**Constraints**: perguntas e respostas são conteúdo sensível e cifrado em repouso; nenhuma
comparação ou contagem pode expor texto em log; o portão de refinamento não pode ser afrouxado;
prompts canônicos não podem ser alterados.

**Scale/Scope**: 3 funções puras novas em `lib/dominio/`, 1 migração de coluna, 1 rota
reorganizada, 1 contrato de saída ampliado. Nenhuma mudança de UI.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliado contra **Master BP Constitution v1.0.2**. Esta feature mexe diretamente no Princípio II,
então o portão é mais estrito que o normal.

| Princípio | Portão aplicado a esta feature | Pré-Fase 0 | Pós-Fase 1 |
|---|---|---|---|
| **I. Confidencialidade e Conformidade Legal** | Perguntas e respostas são conteúdo sensível. A deduplicação as manipula em claro, em memória. Só passa se: (a) nenhuma comparação vazar texto para log; (b) as métricas de SC-008 forem contagens, nunca amostras; (c) nada de novo for persistido em claro | ✅ | ✅ — a observabilidade é composta só de contadores (R-06); `origemFechamento` é um rótulo de enumeração, não conteúdo; o `logger` já redige `pergunta` e `resposta` |
| **II. Refinamento Antes da Entrega** | **O portão de risco desta feature.** Consumir o sinal do modelo cria um caminho novo de fechamento de lacuna, e a fila cria um conjunto de pendências fora da tela. Só passa se: (a) nenhuma lacuna fechar sem conteúdo de resposta registrado; (b) lacuna em fila continuar bloqueando a entrega | ✅ | ✅ — o aproveitamento **grava a resposta real do BP** na lacuna, então `lacunaResolvida()` segue inalterado (R-03); `liberada` é computada sobre todas as críticas não resolvidas, apresentadas ou não (R-04) |
| **III. Escalonamento de Riscos Críticos** | A detecção de risco roda sobre o texto da resposta do BP, não sobre lacunas. A feature não pode alterá-la nem reduzir o texto que chega até ela | ✅ | ✅ — `detectarRisco(textoDoBp, …)` permanece intocado e continua recebendo a resposta integral |
| **IV. Prompts como Artefatos Versionados** | A instrução de não repetir pergunta precisa existir. Se ela for parar em `lib/agentes/*.md`, vira alteração de prompt canônico com revisão própria | ✅ | ✅ — vai para `CONTRATO_SAIDA` em [refinamento.ts](../../lib/ia/refinamento.ts), que é código do contrato de saída, não prompt de especialidade |
| **V. Saída Estruturada e Auditável** | `lacunasResolvidas` já existe no schema Zod e continua validado. FR-004 acrescenta auditabilidade: precisa ser possível saber, meses depois, por que uma lacuna crítica foi considerada resolvida | ✅ | ✅ — `origemFechamento` distingue `resposta_direta` de `aproveitada`; nenhuma lacuna fecha sem um dos dois |

**Restrições de domínio**: nenhum dado novo de colaborador é persistido; retenção e controle de
acesso permanecem os da feature 001. A coluna nova é metadado de auditoria.

**Simplicidade**: sem dependência de NLP, sem embeddings, sem chamada extra ao modelo, sem coluna
para a fila. A comparação de similaridade é uma função de ~30 linhas sobre conjuntos de tokens.

**Resultado do portão**: aprovado nas duas avaliações. Complexity Tracking permanece vazia.

### Reavaliação pós-implementação (T044) — 2026-08-11

Terceira avaliação, contra o código entregue.

| Princípio | Evidência no código | Verificação | Situação |
|---|---|---|---|
| **I** | `filtrarPropostas` devolve `{ aceitas, descartadas: number }` — não existe caminho pelo qual o texto descartado saia da função; o evento `refinamento.rodada` é composto só de sete contagens | 1 teste prova que a chave de retorno é contagem; 1 teste em `vazamento-log.test.ts` prova que todo valor do evento, exceto o id, é número | ✅ |
| **II** | O aproveitamento **não fecha nada** — `aproveitarResolucoes` devolve ids e `fecharLacunasAproveitadas` grava a resposta real do BP; `lacunaResolvida()` ficou intocado; `LIMITE_APRESENTADAS` aparece em uma única expressão executável, a de `apresentadas` | 12 testes de aproveitamento, incluindo o assistente mentiroso; 3 testes provando que resolver as 3 apresentadas **não** libera com fila pendente | ✅ |
| **III** | `detectarRisco(textoDoBp, …)` continua recebendo o texto integral, e nada foi inserido antes dele na rota | `npm run test:risco` 43/43 verdes; `git diff` de `deteccao-risco.ts` vazio | ✅ |
| **IV** | A instrução de não repetir foi para `CONTRATO_SAIDA` em `lib/ia/refinamento.ts` | `git diff --stat lib/agentes/` vazio; 8 testes de `prompt-loader` verdes | ✅ |
| **V** | `origemFechamento` distingue `resposta_direta` de `aproveitada`; nenhuma transição para `respondida` ocorre sem conteúdo | filtro `estado: 'aberta'` em `fecharLacunasAproveitadas` como última barreira; teste que verifica conteúdo não vazio em toda lacuna fechada | ✅ |

**Dois achados que a implementação forçou:**

1. **A calibração revelou que o limiar sozinho não separa o conjunto.** Um par deliberadamente
   distinto — "quem batia a meta" × "quem **não** batia a meta" — pontua 0,857, acima do limiar
   de 0,80. Ele só sobrevive porque `saoEquivalentes` bloqueia negação assimétrica antes de olhar
   o índice. Sem essa regra, nenhum limiar utilizável separaria os dois, e fundir esses públicos
   produziria uma entrega sobre as pessoas erradas. A regra estava no desenho por precaução;
   a medição mostrou que ela é load-bearing.
2. **`app/(app)/atendimentos/[id]/page.tsx` e `tests/integration/entrega.test.ts` consumiam
   `portao.pendentes`** e não constavam da lista de arquivos afetados no plano — o `grep` os
   encontrou na T005. A lista de consumidores estava incompleta em dois itens. Corrigido;
   nenhuma regra mudou.

**Resultado**: aprovado. Complexity Tracking segue vazio.

## Project Structure

### Documentation (this feature)

```text
specs/003-refinamento-sem-repeticao/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── refinamento.md   # Contrato das funções de domínio e da rodada de refinamento
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — não criado aqui)
```

### Source Code (repository root)

Somente os caminhos afetados. Tudo que não aparece aqui permanece inalterado.

```text
lib/dominio/
├── equivalencia-lacunas.ts   # NOVO — normalização e comparação de perguntas (função pura)
├── resolucao-aproveitada.ts  # NOVO — aplica o sinal do modelo com verificação (função pura)
└── portao-refinamento.ts     # ALTERADO — separa o que o portão conta do que o BP vê

lib/dados/
└── atendimentos.ts           # ALTERADO — criarLacunas devolve os ids criados;
                              #   nova fecharLacunasAproveitadas(); decifrarLacuna
                              #   passa a expor origemFechamento

lib/ia/
└── refinamento.ts            # ALTERADO — CONTRATO_SAIDA ganha a regra de não repetir;
                              #   montarEntrada destaca o que já foi respondido

app/api/atendimentos/
├── route.ts                  # ALTERADO — deduplicação já na primeira rodada
└── [id]/mensagens/route.ts   # ALTERADO — orquestra as três correções

prisma/
├── schema.prisma             # ALTERADO — coluna origemFechamento em Lacuna
└── migrations/               # NOVA migração

tests/
├── unit/
│   ├── equivalencia-lacunas.test.ts   # NOVO
│   ├── resolucao-aproveitada.test.ts  # NOVO
│   └── portao-refinamento.test.ts     # ALTERADO — apresentadas vs. bloqueantes
├── integration/
│   └── refinamento-convergencia.test.ts  # NOVO — rodadas sobre estado persistido
└── fixtures/
    └── pares-equivalencia/            # NOVO — casos de calibração do limiar
```

**Structure Decision**: as três correções vão para `lib/dominio/`, junto com os controles
constitucionais existentes, e não para `lib/ia/`. A razão é a mesma que motivou o portão a sair
do prompt na feature 001: decisão que a constituição torna obrigatória tem de ser código
testável, não comportamento esperado do modelo. `lib/ia/refinamento.ts` continua responsável
apenas por conduzir o diálogo e declarar o contrato de saída.

`components/` não é tocado — o painel já exibe uma pergunta por vez e apenas recebe uma lista
menor.

## Complexity Tracking

> Nenhuma violação do Constitution Check a justificar. Seção intencionalmente vazia.
