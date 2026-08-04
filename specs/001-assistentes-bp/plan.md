# Implementation Plan: App de Assistentes Especializados para Business Partner

**Branch**: n/d — repositório sem git; feature identificada por `specs/001-assistentes-bp/`
| **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-assistentes-bp/spec.md`

## Summary

Aplicação web em Next.js que roteia a demanda do Business Partner para um entre cinco
assistentes especializados, conduz o diálogo de refinamento obrigatório e só então emite a
entrega estruturada da especialidade. O comportamento de cada assistente vem dos prompts
canônicos em `lib/agentes/`, carregados como artefatos versionados — nunca
reescritos em código.

A abordagem técnica central: **o modelo conduz a conversa, mas não decide sozinho o que a
constituição torna obrigatório**. Três controles ficam no servidor, fora do alcance do prompt:
o portão de refinamento (Princípio II), a detecção de risco jurídico (Princípio III) e a
validação da estrutura de entrega (Princípio V). O Gemini responde em saída estruturada
validada por Zod; se a validação falhar ou uma lacuna crítica seguir aberta, o servidor recusa
a entrega e devolve as perguntas pendentes.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 20 LTS

**Primary Dependencies**: Next.js 15 (App Router, Server Actions e Route Handlers), React 19,
Prisma ORM, Zod, Auth.js (NextAuth v5), `@google/genai` (SDK Gemini)

**Storage**: SQLite via Prisma na fase inicial, com o schema mantido portável para PostgreSQL
(ver research.md, decisão R-03)

**Testing**: Vitest para unidade e integração de serviços; Playwright para os fluxos
end-to-end das quatro histórias; conjunto de casos-fixos de risco jurídico executado como
suíte de regressão obrigatória (SC-004)

**Target Platform**: Web responsiva (desktop e mobile), servida por Node.js

**Project Type**: Web application full-stack em projeto único Next.js

**Performance Goals**: primeiro token da resposta do assistente em até 3 s; entrega final
completa em até 30 s; navegação entre telas do histórico em até 1 s

**Constraints**: interface e entregas em português do Brasil; dados de colaborador tratados
como sensíveis por padrão; trilha de auditoria obrigatória em acesso e exportação de
atendimento sensível; retenção de 24 meses; chave do Gemini lida de `GEMINI_API_KEY`,
exclusivamente no servidor

**Scale/Scope**: dezenas de BPs simultâneos em uma organização; 5 assistentes; 4 histórias de
usuário; ~30 requisitos funcionais

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliado contra **Master BP Constitution v1.0.1**.

| Princípio | Portão aplicado a esta feature | Pré-Fase 0 | Pós-Fase 1 |
|---|---|---|---|
| **I. Confidencialidade e Conformidade Legal** | Campos sensíveis cifrados em repouso; acesso a atendimento restrito ao autor, verificado no servidor a cada leitura; trilha de auditoria em acesso/exportação/exclusão; retenção de 24 meses com expurgo automatizado; nenhum dado de atendimento em log de aplicação | ✅ | ✅ |
| **II. Refinamento Antes da Entrega** | O portão de lacunas é avaliado por código no servidor, a partir do estado persistido do atendimento — não pela boa vontade do modelo. Entrega final bloqueada enquanto houver lacuna crítica aberta | ✅ | ✅ |
| **III. Escalonamento de Riscos Críticos** | Detecção de risco em duas camadas (regra determinística + sinal do modelo), com união dos resultados; sinalização persistida e renderizada acima do plano de ação; sugestão punitiva bloqueada sem fatos registrados | ✅ | ✅ |
| **IV. Prompts como Artefatos Versionados** | Prompts carregados de `lib/agentes/*.md` com hash registrado por atendimento; nenhuma regra de comportamento duplicada em código; o app não edita esses arquivos | ✅ | ✅ |
| **V. Saída Estruturada e Auditável** | Cada especialidade declara sua estrutura obrigatória como schema Zod; a entrega é validada contra o schema antes de ser persistida; entrega sem seção obrigatória é rejeitada e regenerada | ✅ | ✅ |

**Restrições de domínio**: retenção (24 meses, FR-026) e controle de acesso (autor exclusivo,
FR-017) estão declarados na spec — nenhum `NEEDS CLARIFICATION` remanescente nesses pontos,
como o portão exige.

**Simplicidade**: projeto único, sem serviço separado para orquestração de IA, sem fila
externa, sem cache distribuído. SQLite e o próprio processo Next.js atendem à escala declarada.

**Resultado do portão**: aprovado nas duas avaliações. Nenhuma violação a justificar — a seção
Complexity Tracking permanece vazia.

### Reavaliação pós-implementação (T103) — 2026-07-28

Terceira avaliação, agora contra o código entregue e não contra o desenho.

| Princípio | Evidência no código | Verificação | Situação |
|---|---|---|---|
| **I** | [lib/dados/cripto.ts](../../lib/dados/cripto.ts) (AES-256-GCM), [auditoria.ts](../../lib/dados/auditoria.ts), [retencao.ts](../../lib/dados/retencao.ts), [logger.ts](../../lib/observabilidade/logger.ts) + regra ESLint `no-console` | 9 testes de cifragem, 8 de retenção, 7 de redação de log, 2 provando que o relato não fica legível na coluna | ✅ |
| **II** | [lib/dominio/portao-refinamento.ts](../../lib/dominio/portao-refinamento.ts), aplicado em [entrega/route.ts](../../app/api/atendimentos/[id]/entrega/route.ts) antes de qualquer chamada ao modelo | 19 unitários + 6 de integração sobre estado persistido + E2E da recusa | ✅ |
| **III** | [lib/dominio/deteccao-risco.ts](../../lib/dominio/deteccao-risco.ts) (duas camadas unidas por OU), [vedacao-punitiva.ts](../../lib/dominio/vedacao-punitiva.ts), [AlertaEscalonamento.tsx](../../components/atendimento/AlertaEscalonamento.tsx) renderizado acima do plano | 43 testes em `npm run test:risco` (portão de merge) + 20 de vedação punitiva | ✅ |
| **IV** | [lib/assistentes/prompt-loader.ts](../../lib/assistentes/prompt-loader.ts) — somente leitura, hash SHA-256 por atendimento | 8 testes, incluindo um que verifica que os arquivos canônicos não são alterados | ✅ |
| **V** | [lib/assistentes/estruturas/](../../lib/assistentes/estruturas/) — 5 schemas Zod, validados antes de persistir | 66 testes: cada seção obrigatória removida deve reprovar | ✅ |

**Duas correções que os testes forçaram durante a implementação** — ambas eram falso negativo
real em controle constitucional:

1. `discriminatória` (feminino) não casava com o padrão de discriminação, que previa apenas
   `-tório`. Princípio III.
2. `demitir` não casava com a vedação punitiva, que cobria só o substantivo `demissão`.
   FR-013.

**Resultado**: aprovado. Complexity Tracking segue vazio — nenhuma violação foi necessária.

## Project Structure

### Documentation (this feature)

```text
specs/001-assistentes-bp/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api.md           # Contrato dos Route Handlers
│   └── assistant-output.md  # Contrato de saída estruturada dos assistentes
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — não criado aqui)
```

### Source Code (repository root)

```text
app/
├── (auth)/
│   └── entrar/                    # tela de autenticação
├── (app)/
│   ├── atendimentos/
│   │   ├── novo/                  # US1: relato inicial + indicação de assistente
│   │   ├── [id]/                  # US1/US2: diálogo de refinamento e entrega
│   │   └── page.tsx               # US2: histórico com filtros
│   └── layout.tsx
└── api/
    ├── atendimentos/              # criar, listar, retomar, excluir
    │   └── [id]/
    │       ├── mensagens/         # rodada de refinamento (streaming)
    │       ├── entrega/           # emissão da entrega final (portão de lacunas)
    │       └── exportacao/        # US3: exportação com marcação de sigilo
    ├── roteamento/                # US1: indicação de especialidade
    └── transcricao/               # US4: áudio → texto

lib/
├── agentes/                       # prompts canônicos (.md) — conteúdo, não código
├── assistentes/
│   ├── catalogo.ts                # as 5 especialidades e seus metadados
│   ├── prompt-loader.ts           # lê e faz hash dos prompts canônicos
│   └── estruturas/                # schemas Zod da entrega de cada especialidade
├── ia/
│   ├── gemini.ts                  # cliente único, chave via GEMINI_API_KEY
│   ├── roteador.ts                # classificação de especialidade
│   ├── refinamento.ts             # condução do diálogo e extração de lacunas
│   └── transcricao.ts             # áudio → texto
├── dominio/
│   ├── portao-refinamento.ts      # Princípio II — decide se a entrega é permitida
│   ├── deteccao-risco.ts          # Princípio III — regras + sinal do modelo
│   └── classificacao-sigilo.ts    # marca o atendimento como sensível
├── dados/
│   ├── prisma.ts
│   ├── cripto.ts                  # cifra/decifra campos sensíveis
│   ├── auditoria.ts               # registro de acesso, exportação, exclusão
│   └── retencao.ts                # expurgo de 24 meses e encerramento de 90 dias
├── exportacao/                    # entrega → documento
└── validacao/                     # schemas Zod compartilhados de entrada

prisma/
├── schema.prisma
└── migrations/

tests/
├── unit/                          # portão de lacunas, detecção de risco, schemas
├── integration/                   # rotas, persistência, auditoria, retenção
├── e2e/                           # Playwright, uma suíte por história
└── fixtures/
    └── casos-risco/               # bateria de regressão do Princípio III (SC-004)
```

**Structure Decision**: projeto único Next.js. A pasta `app/` concentra UI e rotas HTTP;
`lib/` isola a lógica de domínio da camada de framework, de modo que os três controles
constitucionais (`lib/dominio/`) sejam testáveis em unidade sem subir o servidor nem chamar o
Gemini. `lib/agentes/` guarda os prompts canônicos: apesar de viver sob `lib/`, é conteúdo, não
código — arquivos `.md` lidos em tempo de execução e nunca importados. Ficam ali por proximidade
com quem os consome; a regra que importa é que só `prompt-loader.ts` os acessa, e só para leitura.

## Complexity Tracking

> Nenhuma violação do Constitution Check a justificar. Seção intencionalmente vazia.
