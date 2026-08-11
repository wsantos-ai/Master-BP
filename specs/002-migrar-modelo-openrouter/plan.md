# Implementation Plan: Migração do provedor de IA para o OpenRouter (DeepSeek V4 Flash + Voxtral Mini Transcribe)

**Branch**: `develop` (repositório sem branch dedicada para esta feature; identificada por `specs/002-migrar-modelo-openrouter/`) | **Date**: 2026-08-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-migrar-modelo-openrouter/spec.md`

## Summary

Trocar o provedor de IA da plataforma: sai o Gemini (SDK `@google/genai`), entra o OpenRouter
acessado por HTTP direto. Todas as gerações de texto — roteamento, refinamento, conversa e
entrega final — passam a usar `deepseek/deepseek-v4-flash-0731`; a transcrição de áudio passa a
usar `mistralai/voxtral-mini-transcribe`, em um endpoint distinto do provedor.

A abordagem técnica central: **a troca é confinada à camada `lib/ia/`**. Os três controles
constitucionais vivem em `lib/dominio/` e não sabem qual provedor está em uso — o portão de
refinamento lê estado persistido, a detecção de risco roda sobre texto, a vedação punitiva roda
sobre o plano de ação já materializado. Nenhum deles é tocado por esta feature, e é isso que
torna a migração segura.

Duas consequências de desenho decorrem das capacidades reais do novo provedor, confirmadas em
pesquisa (Fase 0):

1. **O schema enviado ao provedor vira uma dica; o Zod continua sendo o contrato.** O modo
   estrito do OpenRouter exige `additionalProperties: false` e `required` completo, e não aceita
   as restrições de tamanho e formato que nossos schemas usam (`min`, `max`, `maxItems`). A
   conversão passa a produzir um schema estrito *estruturalmente* e a deixar as restrições de
   valor exclusivamente para a validação Zod já existente, que é quem reprova a entrega.
2. **A transcrição deixa de ser uma chamada de chat com instrução.** O modelo de transcrição não
   aceita instrução de sistema nem saída estruturada — ele devolve `{ text, usage }`. O sinal de
   `confiancaBaixa`, hoje produzido pelo modelo, passa a ser derivado no servidor a partir do
   texto e da duração do áudio. É uma regra determinística, testável sem provedor.

## Technical Context

**Language/Version**: TypeScript 5.7 sobre Node.js 20 LTS (inalterado)

**Primary Dependencies**: Next.js 15 (App Router), React 19, Prisma ORM, Zod 3,
`zod-to-json-schema`, Auth.js (NextAuth v5). **Removida**: `@google/genai`. **Adicionada**:
nenhuma — o OpenRouter é consumido pelo `fetch` nativo do Node 20, sem SDK.

**Storage**: PostgreSQL via Prisma (migrado na feature 001). Sem alteração de schema nesta
feature — o campo `Entrega.versaoModelo` já existe e já recebe o identificador do modelo.

**Testing**: Vitest (unidade e integração) com o provedor sempre injetado por dublê; Playwright
para os fluxos end-to-end. `npm run test:risco` permanece como portão de merge.

**Target Platform**: Web responsiva servida por Node.js; build de produção na Vercel

**Project Type**: Web application full-stack em projeto único Next.js

**Performance Goals**: roteamento em até 5 s (SC-003); entrega final completa em até 30 s. O
endpoint de transcrição tem limite de ~60 s de processamento upstream, o que impõe teto prático
à duração do áudio.

**Constraints**: credencial única lida apenas no servidor; conteúdo de atendimento e áudio não
podem ser retidos nem usados para treinamento pelo provedor (FR-011); áudio nunca persistido;
limite de 25 MB por arquivo; nenhum conteúdo de atendimento em log.

**Scale/Scope**: 5 especialidades, 4 módulos em `lib/ia/`, 4 rotas de API afetadas por troca de
import, 1 script de diagnóstico, 3 arquivos de configuração/documentação. Nenhuma mudança de UI,
schema de banco ou regra de domínio.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliado contra **Master BP Constitution v1.0.2**.

| Princípio | Portão aplicado a esta feature | Pré-Fase 0 | Pós-Fase 1 |
|---|---|---|---|
| **I. Confidencialidade e Conformidade Legal** | Trocar de provedor é trocar de operador de dados pessoais. A migração só passa se: (a) a política de não-retenção e não-treinamento for imposta **na requisição**, não apenas confiada à conta; (b) o áudio continuar não persistido; (c) nenhum conteúdo de atendimento entrar em log de erro do novo cliente | ✅ | ✅ — `provider.data_collection: "deny"` + `zdr: true` enviados em toda chamada (R-05); logs do cliente novo carregam apenas código HTTP, motivo e tentativa (R-06) |
| **II. Refinamento Antes da Entrega** | O portão de lacunas é código em `lib/dominio/portao-refinamento.ts`, alimentado por estado persistido. A feature não pode movê-lo nem torná-lo dependente do modelo | ✅ | ✅ — nenhum arquivo de `lib/dominio/` é tocado; o contrato de `conduzirRefinamento` permanece idêntico |
| **III. Escalonamento de Riscos Críticos** | A camada determinística de detecção de risco roda sobre o texto do relato, independente de provedor. A camada do modelo muda de modelo — logo, a bateria de regressão precisa ser reexecutada e continuar 100% verde | ✅ | ✅ — `npm run test:risco` não chama provedor e continua sendo portão de merge; SC-004 cobre o conjunto de casos |
| **IV. Prompts como Artefatos Versionados** | Nenhum byte de `lib/agentes/*.md` pode mudar. Se o novo modelo aderir mal à estrutura, a correção é trabalho subsequente com revisão própria, não um ajuste embutido nesta migração | ✅ | ✅ — FR-006; o teste de imutabilidade dos prompts em `tests/unit/prompt-loader.test.ts` segue válido |
| **V. Saída Estruturada e Auditável** | A validação Zod antes de persistir é o que torna o Princípio V booleano. Como o modo estrito do provedor não aceita nossas restrições de valor, o desenho tem de deixar explícito que o Zod é o contrato e o schema do provedor é apenas orientação | ✅ | ✅ — R-02 fixa a regra; `MAX_TENTATIVAS` e o "nada é gravado ao esgotar" permanecem intactos |

**Restrições de domínio**: retenção e controle de acesso não mudam — esta feature não persiste
dado novo nem altera quem lê o quê. A restrição que *muda* é para onde o dado trafega, e ela é
endereçada por FR-011 e por R-05.

**Idioma**: mensagens de erro e documentação em português do Brasil, como já vigente.

**Simplicidade**: nenhuma dependência nova. O cliente HTTP é `fetch`; o SDK anterior sai. A
alternativa de adotar o SDK `openai` foi rejeitada em R-01 — ver Complexity Tracking (vazia:
nenhuma violação foi necessária).

**Resultado do portão**: aprovado nas duas avaliações. Complexity Tracking permanece vazia.

### Reavaliação pós-implementação (T049) — 2026-08-11

Terceira avaliação, agora contra o código entregue e não contra o desenho.

| Princípio | Evidência no código | Verificação | Situação |
|---|---|---|---|
| **I** | `POLITICA_DADOS` em [lib/ia/openrouter.ts](../../lib/ia/openrouter.ts) injetada em `requisitar()` — nenhuma requisição pode omiti-la; corpo da resposta de erro nunca lido para log, apenas o status | 3 testes provam `data_collection: "deny"` + `zdr: true` nas duas rotas; 1 teste força um 500 cujo corpo contém relato e nome de pessoa e prova que nada disso aparece no log | ✅ |
| **II** | `lib/dominio/portao-refinamento.ts` intocado; contrato de `conduzirRefinamento` idêntico | `git diff --stat lib/dominio/` vazio; 19 testes do portão seguem verdes | ✅ |
| **III** | `lib/dominio/deteccao-risco.ts` intocado; a camada determinística não conhece provedor | `npm run test:risco` — 43/43 verdes após a troca de modelo | ✅ |
| **IV** | Nenhum byte de `lib/agentes/*.md` alterado | `git diff --stat lib/agentes/` vazio; 8 testes de `prompt-loader`, incluindo o de imutabilidade | ✅ |
| **V** | `paraSchemaDoProvedor()` produz o dialeto estrito; as restrições de valor saem do schema e permanecem no Zod, que segue sendo o único portão de aceitação | 31 testes em `schema-provedor.test.ts` sobre os 7 schemas reais + 4 testes que provam que o que saiu do schema **continua reprovando no Zod** | ✅ |

**O achado que a implementação forçou**: `app/api/roteamento/route.ts` importava `ErroConfiguracaoIA`
de `lib/ia/gemini` e não constava da lista de arquivos afetados no plano — o `tsc` o encontrou. A
lista de consumidores em Project Structure estava incompleta em um item. Corrigido; nenhuma regra
mudou.

**Resultado**: aprovado. Complexity Tracking segue vazio — nenhuma violação foi necessária.

## Project Structure

### Documentation (this feature)

```text
specs/002-migrar-modelo-openrouter/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── provedor-ia.md   # Contrato interno da camada lib/ia/ e do provedor externo
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — não criado aqui)
```

### Source Code (repository root)

Somente os caminhos afetados. Tudo que não aparece aqui permanece inalterado.

```text
lib/ia/
├── openrouter.ts          # NOVO — substitui gemini.ts: credencial, modelos, HTTP, erros
├── gemini.ts              # REMOVIDO
├── saida-estruturada.ts   # ALTERADO — chamador padrão e conversão de schema
├── transcricao.ts         # ALTERADO — endpoint dedicado; confiancaBaixa derivada no servidor
├── roteador.ts            # ALTERADO — apenas o caminho do import
├── refinamento.ts         # ALTERADO — apenas o caminho do import
└── entrega.ts             # ALTERADO — apenas o caminho do import

app/api/
├── atendimentos/route.ts                 # ALTERADO — apenas o import de ErroConfiguracaoIA/MODELO_CAPAZ
├── atendimentos/[id]/mensagens/route.ts  # ALTERADO — apenas o import
├── atendimentos/[id]/entrega/route.ts    # inalterado (grava versaoModelo, que já vem do módulo)
└── transcricao/route.ts                  # inalterado (o contrato HTTP não muda)

scripts/diagnostico-ia.ts  # ALTERADO — novas variáveis + verificação da transcrição

tests/unit/
├── provedor-openrouter.test.ts  # NOVO — mapeamento de erro HTTP → classe de erro
├── schema-provedor.test.ts      # NOVO — conversão Zod → JSON Schema estrito
├── transcricao.test.ts          # ALTERADO — confiancaBaixa derivada
└── saida-estruturada.test.ts    # ALTERADO — dublê no novo formato

.env.example    # ALTERADO — OPENROUTER_*
README.md       # ALTERADO — tabela de variáveis de ambiente
package.json    # ALTERADO — remove @google/genai
```

**Structure Decision**: a estrutura de projeto da feature 001 é preservada integralmente. O
único módulo novo é `lib/ia/openrouter.ts`, que ocupa exatamente o lugar de `lib/ia/gemini.ts` e
exporta a mesma superfície (`MODELO_RAPIDO`, `MODELO_CAPAZ`, `ErroConfiguracaoIA`) acrescida de
`MODELO_TRANSCRICAO` e das funções de chamada HTTP. Manter os nomes exportados é deliberado:
mantém a mudança nos módulos consumidores restrita ao caminho do import, o que torna o diff
auditável e reduz a chance de arrastar um controle constitucional junto.

`lib/dominio/`, `lib/dados/`, `lib/assistentes/`, `components/` e `prisma/` **não são tocados**.

## Complexity Tracking

> Nenhuma violação do Constitution Check a justificar. Seção intencionalmente vazia.
