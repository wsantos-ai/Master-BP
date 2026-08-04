<!--
Sync Impact Report
==================
Version change: (template, unversioned) → 1.0.0
Bump rationale: Initial ratification. Todos os placeholders do template foram
substituídos por conteúdo concreto derivado do PRD e dos prompts de agentes.

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Confidencialidade e Conformidade Legal (NÃO NEGOCIÁVEL)
  - [PRINCIPLE_2_NAME] → II. Refinamento Antes da Entrega
  - [PRINCIPLE_3_NAME] → III. Escalonamento de Riscos Críticos
  - [PRINCIPLE_4_NAME] → IV. Prompts como Artefatos Versionados
  - [PRINCIPLE_5_NAME] → V. Saída Estruturada e Auditável

Added sections:
  - Restrições de Domínio e Proteção de Dados (era [SECTION_2_NAME])
  - Fluxo de Desenvolvimento e Portões de Qualidade (era [SECTION_3_NAME])

Removed sections: nenhuma

Templates requiring updates:
  ✅ .specify/templates/plan-template.md — "Constitution Check" é genérico
     ("[Gates determined based on constitution file]"); compatível, sem edição.
  ✅ .specify/templates/spec-template.md — seções obrigatórias (Requirements,
     Success Criteria, Assumptions) cobrem os Princípios II e V; sem edição.
  ✅ .specify/templates/tasks-template.md — categorização de tarefas compatível
     com os portões definidos; sem edição.
  ✅ CLAUDE.md — bloco SPECKIT gerenciado automaticamente; sem edição manual.

Follow-up TODOs: nenhum. Nenhum placeholder remanescente.

---

Version change: 1.0.0 → 1.0.1 (2026-07-28)
Bump rationale: PATCH. O parágrafo de escopo restringia a plataforma ao "setor de varejo".
A restrição foi removida — o usuário primário é o Business Partner de RH em qualquer setor.
Nenhum princípio teve sua semântica alterada.

Modified sections:
  - Parágrafo de escopo (preâmbulo): "no setor de varejo" → "em qualquer setor de atuação"

Artefatos sincronizados:
  ✅ specs/001-assistentes-bp/spec.md — premissa "Público" e exemplos ilustrativos
     generalizados para qualquer segmento.
  ⚠ lib/agentes/agente-bp.md — persona declara "vasta expertise no setor de
     varejo" (l.6) e "dinamismo do varejo" (l.27). Pendente de decisão: manter a
     especialização de domínio do agente ou generalizá-la.
  ⚠ lib/agentes/agente-treinamento.md — domínio "encantamento do cliente no
     varejo" (l.36) e exemplo de tema visual (l.94). Mesma decisão pendente.

---

Version change: 1.0.1 → 1.0.2 (2026-08-04)
Bump rationale: PATCH. Os prompts canônicos foram movidos de `project-documents/agents/`
para `lib/agentes/`. O Princípio IV nomeia esse caminho, então a referência precisou ser
corrigida — mas nenhuma regra mudou de sentido: a fonte única de verdade continua sendo
esses arquivos, apenas em outro lugar.

Modified sections:
  - Princípio IV: caminho dos prompts canônicos
  - Fluxo de Desenvolvimento: gatilho de revisão de mudança de prompt
  - Governance: escopo da avaliação de impacto de emendas

Artefatos sincronizados:
  ✅ lib/assistentes/prompt-loader.ts — DIRETORIO_PROMPTS aponta para lib/agentes
  ✅ next.config.mjs — outputFileTracingIncludes, para os prompts irem no build
  ✅ tests/unit/prompt-loader.test.ts — verificação de imutabilidade dos arquivos
  ✅ lib/assistentes/estruturas/*.ts — comentários "Fonte:" de cada schema
  ✅ prisma/schema.prisma — comentário do campo arquivoPrompt
  ✅ README.md e specs/001-assistentes-bp/* — todas as referências ao caminho antigo
-->

# Master BP Constitution

Master BP é uma plataforma de agentes de IA especializados que apoiam Business Partners
de RH e lideranças, em qualquer setor de atuação. Esta constituição governa o desenvolvimento da
plataforma e o comportamento dos agentes que ela entrega.

## Core Principles

### I. Confidencialidade e Conformidade Legal (NÃO NEGOCIÁVEL)

Todo agente, funcionalidade e artefato do projeto DEVE tratar dados de colaboradores como
sensíveis por padrão. Remuneração, prontuários médicos, identidade de denunciantes e
histórico disciplinar DEVE permanecer restritos a quem tem necessidade explícita de acesso.
Nenhuma funcionalidade pode registrar, exportar ou exibir esses dados sem controle de acesso
declarado na especificação. Recomendações produzidas pelos agentes DEVE respeitar a LGPD, a
CLT, as NRs aplicáveis e os acordos coletivos vigentes.

**Racional**: O domínio é gestão de pessoas. Um vazamento ou uma orientação juridicamente
incorreta gera dano irreversível ao colaborador e passivo trabalhista à organização — risco
de ordem diferente de um bug funcional comum.

### II. Refinamento Antes da Entrega

Agentes DEVEM coletar as informações essenciais antes de emitir qualquer entrega final
(parecer, comunicação, plano de treinamento, orientação estratégica ou prompt). Quando houver
lacuna crítica, o agente DEVE fazer perguntas objetivas e aguardar resposta em vez de assumir
o dado faltante. Entregas genéricas, desconectadas do contexto informado, são vedadas.
Especificações de features que envolvam agentes DEVEM descrever explicitamente quais lacunas
bloqueiam a entrega final.

**Racional**: É a regra comum a todos os cinco agentes do produto. Uma orientação de RH
baseada em premissa errada não é apenas imprecisa — ela é acionada por um líder sobre pessoas
reais.

### III. Escalonamento de Riscos Críticos

Situações de risco jurídico elevado — assédio sexual, discriminação, fraude, demissão por
justa causa, risco de ação trabalhista, tratamento de dados pessoais sensíveis — DEVEM
disparar recomendação explícita de validação com o departamento jurídico, Relações
Trabalhistas ou Compliance antes de qualquer ação. Nenhum agente pode sugerir medida punitiva
sem fatos apurados e documentados. O caminho de escalonamento DEVE ser visível ao usuário,
nunca implícito.

**Racional**: Os agentes aconselham, não decidem. Confundir esses papéis transfere à IA uma
responsabilidade que é humana e jurídica.

### IV. Prompts como Artefatos Versionados

Os prompts em `lib/agentes/` são a fonte única de verdade do comportamento de
cada agente. Alterações de comportamento DEVE ser feitas nesses arquivos, revisadas e
versionadas — nunca embutidas em código, em configuração de plataforma ou em ajuste manual de
ambiente. Cada prompt DEVE conter, no mínimo: Persona, Missão, Fluxo de Ação, Domínios de
Atuação, Formato de Saída, Tom de Voz e Restrições.

**Racional**: Sem um artefato canônico, o comportamento do agente deriva silenciosamente
entre ambientes e ninguém consegue auditar o que a IA foi instruída a fazer.

### V. Saída Estruturada e Auditável

Entregas dos agentes DEVE seguir a estrutura obrigatória declarada no prompt correspondente
(por exemplo, as sete seções do parecer técnico ou as seis seções da entrega de treinamento).
Conclusões DEVEM ser rastreáveis até os fatos, evidências ou indicadores que as sustentam.
Recomendações DEVEM vir acompanhadas de plano de ação com responsáveis e prazos sugeridos.
Formatação DEVE usar títulos, tópicos e tabelas quando isso facilitar a leitura pela
liderança.

**Racional**: Documentos de RH são lidos, arquivados e eventualmente usados como prova.
Estrutura fixa torna a saída comparável, revisável e defensável.

## Restrições de Domínio e Proteção de Dados

- **Escopo de atuação**: A plataforma cobre os domínios definidos no PRD (`docs/prd.md`) — atração e seleção,
  desenvolvimento e mentoria, carreira e sucessão, remuneração, relações trabalhistas e clima,
  ética e compliance, comunicação de liderança e T&D. Funcionalidades fora desses domínios
  DEVEM ser justificadas na especificação.
- **Imparcialidade**: Agentes DEVEM se basear em evidências e políticas, sem julgamento de
  valor sobre as partes envolvidas.
- **Denúncias anônimas**: A identidade do denunciante DEVE ser protegida em todo o fluxo, e as
  limitações probatórias decorrentes do anonimato DEVE ser sinalizadas no parecer.
- **Armazenamento**: Pareceres e documentos sensíveis DEVE indicar guarda em local seguro de
  acesso restrito.
- **Retenção e acesso**: Toda feature que persista dados de colaborador DEVE declarar, na
  spec, o período de retenção e quem tem acesso. `NEEDS CLARIFICATION` não é resposta aceitável
  para esses dois pontos no fechamento do plano.
- **Idioma**: A documentação de produto e os prompts de agentes DEVE ser mantidos em português
  do Brasil, consistente com o público de uso.

## Fluxo de Desenvolvimento e Portões de Qualidade

- **Fluxo Spec Kit**: O trabalho segue `/speckit-specify` → `/speckit-plan` → `/speckit-tasks`
  → `/speckit-implement`. Implementação sem spec e plano aprovados é vedada.
- **Portão de constituição**: A seção "Constitution Check" do plano DEVE ser preenchida com os
  cinco princípios acima antes da Fase 0 e reavaliada após a Fase 1. Violações DEVEM ser
  registradas em "Complexity Tracking" com a alternativa mais simples e o motivo da rejeição —
  ou o plano DEVE ser corrigido.
- **Critérios de sucesso mensuráveis**: Toda spec DEVE definir métricas verificáveis e
  agnósticas de tecnologia. Princípios I e III DEVE ter critério de aceite próprio sempre que a
  feature toque dados sensíveis ou fluxo de escalonamento.
- **Revisão de mudança de prompt**: Alteração em `lib/agentes/*.md` DEVE ser
  revisada quanto à aderência aos Princípios I a V antes de ser considerada concluída.
- **Simplicidade**: Comece pela solução mais simples que satisfaça a spec. Camadas de
  abstração adicionais DEVE ser justificadas por necessidade presente, não antecipada.

## Governance

Esta constituição supersede quaisquer outras práticas e convenções do projeto. Em caso de
conflito entre esta constituição e um plano, uma spec ou um prompt de agente, a constituição
prevalece e o artefato conflitante DEVE ser corrigido.

**Procedimento de emenda**: Emendas são propostas por escrito, com justificativa e avaliação
de impacto sobre os templates em `.specify/templates/` e sobre os prompts em
`lib/agentes/`. Uma emenda só é adotada quando o Sync Impact Report no topo deste
arquivo é atualizado e os artefatos dependentes ficam consistentes.

**Política de versionamento** (semântico):

- **MAJOR**: remoção ou redefinição incompatível de princípio ou regra de governança.
- **MINOR**: novo princípio ou seção, ou expansão material de orientação existente.
- **PATCH**: esclarecimento, ajuste de redação ou correção sem mudança semântica.

**Revisão de conformidade**: Todo plano de implementação MUST passar pelo portão de
constituição descrito acima. Complexidade MUST ser justificada. Para orientação de
desenvolvimento em tempo de execução, consulte `CLAUDE.md` e o plano ativo da feature.

**Version**: 1.0.2 | **Ratified**: 2026-07-28 | **Last Amended**: 2026-08-04
