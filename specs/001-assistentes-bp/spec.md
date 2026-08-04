# Feature Specification: App de Assistentes Especializados para Business Partner

**Feature Branch**: `001-assistentes-bp`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "desenvolver um app que oriente o profissional de Business Partner na execução de suas atividades através de assistentes especializados para cada tarefa."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ser atendido pelo assistente certo para a tarefa (Priority: P1)

O Business Partner abre o app com uma demanda real do dia a dia — um conflito entre líder e
equipe, uma denúncia recebida, uma comunicação difícil a enviar, uma necessidade de
treinamento. Ele descreve a situação em linguagem natural. O app identifica de qual
especialidade a demanda trata, indica o assistente adequado (permitindo que o BP confirme ou
troque), e o assistente conduz o atendimento: faz as perguntas de refinamento necessárias,
aguarda as respostas e só então emite a entrega final na estrutura obrigatória daquela
especialidade.

**Why this priority**: É o núcleo do produto. Sem esta jornada não há valor algum — todas as
demais histórias apenas ampliam ou preservam o resultado que ela produz. Entregue sozinha, já
substitui a consulta manual a cinco prompts avulsos.

**Independent Test**: Descrever uma situação de conflito de equipe, verificar que o app
direciona ao assistente de mentoria, que ele faz perguntas antes de concluir, e que a entrega
final contém orientação fundamentada e plano de ação com responsáveis e prazos.

**Acceptance Scenarios**:

1. **Given** um BP autenticado na tela inicial, **When** ele descreve "minha equipe está com
   turnover alto e o gestor não sabe conduzir feedback", **Then** o app indica o
   assistente de mentoria estratégica e apresenta a justificativa da indicação.
2. **Given** a indicação apresentada, **When** o BP discorda e escolhe manualmente outro
   assistente, **Then** o atendimento prossegue com o assistente escolhido por ele.
3. **Given** um atendimento iniciado com informações incompletas, **When** o BP solicita a
   entrega final, **Then** o assistente responde com as perguntas de refinamento pendentes em
   vez de produzir a entrega.
4. **Given** todas as lacunas críticas respondidas, **When** o assistente conclui, **Then** a
   entrega segue integralmente a estrutura obrigatória da especialidade e inclui plano de ação
   com responsáveis e prazos sugeridos.
5. **Given** um relato que envolve assédio, discriminação, fraude, justa causa ou risco de
   ação trabalhista, **When** o assistente responde, **Then** a recomendação de validação
   jurídica/Compliance aparece de forma destacada e explícita na tela, antes do plano de ação.

---

### User Story 2 - Retomar e consultar atendimentos anteriores (Priority: P2)

O BP raramente resolve um caso em uma única sessão. Ele precisa interromper um atendimento,
buscar um dado com o gestor da unidade e voltar depois. Também precisa reencontrar o parecer
ou a comunicação que produziu semanas atrás quando o caso volta à tona.

**Why this priority**: Sem continuidade, o BP recomeça do zero a cada sessão e perde o
refinamento já feito — o custo de uso passa a superar o benefício. É também o que torna as
entregas auditáveis ao longo do tempo.

**Independent Test**: Iniciar um atendimento, responder parte do refinamento, sair do app,
retornar e verificar que o atendimento aparece na lista como pendente e retoma exatamente do
ponto onde parou.

**Acceptance Scenarios**:

1. **Given** um atendimento com refinamento parcialmente respondido, **When** o BP sai e
   retorna ao app, **Then** o atendimento consta como "em andamento" e retoma da próxima
   pergunta pendente.
2. **Given** um histórico com atendimentos de várias especialidades, **When** o BP filtra por
   especialidade ou período, **Then** apenas os atendimentos correspondentes são listados.
3. **Given** um atendimento concluído, **When** o BP o reabre, **Then** ele visualiza a
   entrega final e todo o diálogo de refinamento que a originou.
4. **Given** um BP autenticado, **When** ele acessa o histórico, **Then** ele visualiza
   somente os atendimentos que criou — nunca os de outro BP.

---

### User Story 3 - Levar a entrega para fora do app (Priority: P3)

A entrega do assistente só gera valor quando chega ao destinatário: um e-mail para o
colaborador, um parecer arquivado no processo, um roteiro de slides para o treinamento. O BP
precisa exportar ou copiar o resultado preservando a formatação.

**Why this priority**: Amplia o valor das entregas já produzidas, mas o BP consegue operar
sem isso copiando manualmente o texto da tela. Depende da US1 existir.

**Independent Test**: Concluir um atendimento de comunicação, exportar a entrega e verificar
que títulos, tópicos e tabelas foram preservados no arquivo gerado.

**Acceptance Scenarios**:

1. **Given** uma entrega final concluída, **When** o BP exporta o documento, **Then** o
   arquivo preserva títulos, tópicos e tabelas da entrega original.
2. **Given** uma entrega classificada como sensível (parecer de denúncia), **When** o BP
   exporta, **Then** o documento gerado carrega a marcação de sigilo e a nota de guarda em
   local seguro de acesso restrito.
3. **Given** uma entrega qualquer, **When** o BP copia o conteúdo, **Then** a formatação
   estruturada é mantida ao colar em editor de texto ou cliente de e-mail.

---

### User Story 4 - Relatar a situação por voz (Priority: P4)

Boa parte das demandas chega ao BP fora da mesa de trabalho — entre reuniões, em visita a uma
unidade, no deslocamento — sem tempo de digitar um relato longo. Ele grava o relato falando e o
app converte em texto para iniciar o atendimento.

**Why this priority**: Reduz significativamente o atrito de entrada quando o BP está em campo,
mas todo o fluxo funciona sem isso via digitação.

**Independent Test**: Gravar um relato falado de 60 segundos, verificar que o texto transcrito
é exibido para revisão e que, após confirmação, o atendimento inicia normalmente.

**Acceptance Scenarios**:

1. **Given** um BP na tela de novo atendimento, **When** ele grava um relato por voz, **Then**
   o texto transcrito é exibido para revisão e edição antes de ser enviado ao assistente.
2. **Given** uma transcrição com erros, **When** o BP a corrige, **Then** o assistente recebe
   o texto corrigido.
3. **Given** uma gravação que falhou ou ficou inaudível, **When** a transcrição não é possível,
   **Then** o app informa a falha e oferece a entrada por digitação, sem perder o atendimento.

---

### Edge Cases

- **Demanda ambígua entre especialidades**: um relato de assédio que também exige comunicação
  ao time pode acionar dois assistentes. O app apresenta as opções ao BP em vez de escolher
  silenciosamente.
- **Demanda fora do escopo**: pedidos alheios aos domínios de gestão de pessoas (fiscal,
  logística, TI) são recusados com explicação, sem tentativa de resposta genérica.
- **BP insiste na entrega sem refinar**: o assistente mantém a recusa e explica qual
  informação falta e por que ela é indispensável.
- **Relato contém dado sensível não solicitado** (remuneração, condição médica, nome de
  denunciante): o app sinaliza o risco ao BP e registra o atendimento sob acesso restrito.
- **Atendimento abandonado por longo período**: atendimentos em andamento sem interação por 90
  dias são encerrados automaticamente e movidos ao histórico como incompletos.
- **Relato muito extenso**: relatos acima do limite suportado são sinalizados ao BP com
  orientação para segmentar, sem truncamento silencioso.
- **Perda de conexão durante o refinamento**: as respostas já enviadas permanecem preservadas
  ao reconectar.

## Requirements *(mandatory)*

### Functional Requirements

#### Catálogo e roteamento

- **FR-001**: O sistema MUST oferecer um catálogo de assistentes especializados cobrindo, no
  mínimo, as cinco especialidades existentes: mentoria estratégica de BP, ética e compliance
  (denúncias), comunicação de liderança, treinamento e desenvolvimento, e engenharia de
  prompts.
- **FR-002**: O sistema MUST identificar, a partir do relato em linguagem natural, qual
  especialidade atende a demanda, e MUST apresentar a indicação com justificativa antes de
  iniciar o atendimento.
- **FR-003**: O BP MUST poder selecionar manualmente qualquer assistente do catálogo,
  sobrepondo-se à indicação automática.
- **FR-004**: Quando a demanda for compatível com mais de uma especialidade, o sistema MUST
  apresentar as opções ao BP em vez de decidir sozinho.
- **FR-005**: O sistema MUST recusar demandas fora dos domínios de gestão de pessoas definidos
  na constituição do projeto, informando ao BP o motivo da recusa.

#### Condução do atendimento

- **FR-006**: Cada assistente MUST conduzir o fluxo de ação definido em seu prompt canônico
  em `lib/agentes/`, sem pular etapas.
- **FR-007**: O sistema MUST impedir a emissão da entrega final enquanto houver lacuna crítica
  de informação não respondida, apresentando as perguntas pendentes em seu lugar.
- **FR-008**: As perguntas de refinamento MUST ser apresentadas em rodadas objetivas, e o BP
  MUST poder responder por texto ou declarar uma pergunta como não aplicável com justificativa.
- **FR-009**: O sistema MUST exibir ao BP, durante o atendimento, quais informações ainda
  faltam para que a entrega possa ser concluída.
- **FR-010**: A entrega final MUST seguir integralmente a estrutura obrigatória declarada no
  prompt da especialidade correspondente.
- **FR-011**: Toda recomendação MUST vir acompanhada de plano de ação com responsáveis e
  prazos sugeridos.
- **FR-012**: O sistema MUST detectar situações de risco jurídico elevado — assédio moral ou
  sexual, discriminação, fraude, demissão por justa causa, risco de ação trabalhista,
  tratamento de dados pessoais sensíveis — e MUST exibir a recomendação de validação
  jurídica/Compliance de forma destacada, antes do plano de ação.
- **FR-013**: O sistema MUST NOT apresentar sugestão de medida punitiva contra colaborador sem
  que fatos apurados e documentados tenham sido registrados no atendimento.

#### Histórico e continuidade

- **FR-014**: O sistema MUST persistir cada atendimento com seu estado (em andamento,
  concluído, incompleto), o diálogo de refinamento e a entrega final.
- **FR-015**: O BP MUST poder retomar um atendimento em andamento a partir da próxima pergunta
  pendente.
- **FR-016**: O BP MUST poder listar, filtrar por especialidade e período, e reabrir seus
  atendimentos anteriores.
- **FR-017**: O sistema MUST restringir o acesso aos atendimentos ao BP que os criou; nenhum
  outro usuário pode visualizá-los sem autorização explícita registrada.
- **FR-018**: O sistema MUST encerrar automaticamente atendimentos sem interação por 90 dias,
  marcando-os como incompletos no histórico.

#### Entrada e saída

- **FR-019**: O BP MUST poder iniciar e conduzir um atendimento por texto digitado.
- **FR-020**: O BP MUST poder iniciar um atendimento por gravação de voz, com a transcrição
  exibida para revisão e edição antes do envio.
- **FR-021**: O sistema MUST permitir exportar a entrega final em documento preservando
  títulos, tópicos e tabelas.
- **FR-022**: Entregas classificadas como sensíveis MUST ser exportadas com marcação de sigilo
  e nota de guarda em local seguro de acesso restrito.

#### Proteção de dados e conformidade

- **FR-023**: O sistema MUST tratar como sensível, por padrão, todo dado de colaborador
  registrado em um atendimento: remuneração, informação de saúde, identidade de denunciante e
  histórico disciplinar.
- **FR-024**: O sistema MUST registrar trilha de auditoria de acesso e exportação de
  atendimentos classificados como sensíveis, contendo autor, data/hora e ação.
- **FR-025**: O sistema MUST proteger a identidade de denunciante em todo o fluxo e MUST
  sinalizar, na entrega, as limitações probatórias decorrentes do anonimato.
- **FR-026**: O sistema MUST reter os atendimentos por 24 meses após a conclusão, e MUST
  excluí-los ou anonimizá-los ao fim desse período.
- **FR-027**: O BP MUST poder solicitar a exclusão de um atendimento antes do fim do prazo de
  retenção, com o evento registrado na trilha de auditoria.
- **FR-028**: O sistema MUST autenticar o usuário antes de qualquer acesso a atendimentos ou
  assistentes.
- **FR-029**: A interface e todas as entregas MUST ser apresentadas em português do Brasil.
- **FR-030**: O comportamento de cada assistente MUST derivar exclusivamente do prompt
  canônico versionado da especialidade, sem regras de comportamento embutidas fora desses
  arquivos.

### Key Entities

- **Business Partner (usuário)**: profissional de RH que opera o app. Atributos relevantes:
  identificação, organização/unidade a que pertence, atendimentos que criou.
- **Assistente**: especialidade disponível no catálogo. Atributos: nome, descrição, domínios
  de atuação, prompt canônico de referência, estrutura obrigatória de entrega.
- **Atendimento**: uma sessão de trabalho entre o BP e um assistente sobre uma demanda.
  Atributos: relato inicial, assistente utilizado, estado, classificação de sensibilidade,
  data de criação e de conclusão, prazo de retenção.
- **Diálogo de refinamento**: sequência de perguntas do assistente e respostas do BP dentro de
  um atendimento, com indicação de quais lacunas permanecem abertas.
- **Entrega**: documento final produzido em um atendimento, estruturado conforme a
  especialidade. Atributos: conteúdo, estrutura aplicada, classificação de sigilo, plano de
  ação associado.
- **Sinalização de escalonamento**: registro de que uma situação de risco crítico foi
  detectada em um atendimento, com o tipo de risco e a instância recomendada (jurídico,
  Relações Trabalhistas, Compliance).
- **Registro de auditoria**: evento de acesso, exportação ou exclusão sobre atendimento
  sensível, com autor, data/hora e ação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A partir do relato inicial, o BP chega ao assistente correto para sua demanda em
  até 30 segundos e no máximo 2 interações.
- **SC-002**: O assistente indicado automaticamente é aceito pelo BP sem troca manual em pelo
  menos 85% dos atendimentos.
- **SC-003**: 100% das entregas finais seguem a estrutura obrigatória da especialidade, sem
  seção ausente, em auditoria amostral de 30 atendimentos.
- **SC-004**: 100% dos atendimentos que envolvem risco jurídico elevado exibem a recomendação
  de validação jurídica/Compliance de forma destacada — nenhum falso negativo tolerado na
  bateria de casos de teste de risco.
- **SC-005**: 0 entregas finais emitidas com lacuna crítica de refinamento em aberto.
- **SC-006**: Nenhum BP consegue visualizar atendimento de outro BP sem autorização explícita
  registrada, verificado em teste de controle de acesso.
- **SC-007**: O BP conclui um atendimento completo — do relato à entrega final — em até 15
  minutos, contra a referência atual de consulta manual a documentos de prompt.
- **SC-008**: 90% dos atendimentos interrompidos são retomados com sucesso do ponto exato onde
  pararam.
- **SC-009**: 100% dos acessos e exportações de atendimentos sensíveis geram registro de
  auditoria recuperável.
- **SC-010**: 80% dos BPs avaliam a entrega recebida como pronta para uso com ajuste mínimo,
  em pesquisa aplicada após o atendimento.
- **SC-011**: Atendimentos concluídos há mais de 24 meses não são recuperáveis no app,
  verificado em teste de expiração de retenção.

## Assumptions

- **Público**: o usuário primário é o Business Partner de RH, independentemente do setor ou
  segmento de atuação da organização. O app não pressupõe nenhum ramo de negócio específico e
  se adapta ao contexto informado pelo BP no relato. Lideranças e gestores não acessam o app
  diretamente nesta versão — recebem as entregas por meio do BP.
- **Fonte de comportamento**: os cinco prompts em `lib/agentes/` são a base dos
  assistentes desta versão; ampliar o catálogo é evolução futura, não escopo desta feature.
- **Idioma**: interface, relatos e entregas em português do Brasil.
- **Retenção**: 24 meses após a conclusão do atendimento, prazo alinhado ao uso corrente de
  documentos de gestão de pessoas. Casos que exijam guarda mais longa são arquivados fora do
  app pelo BP, via exportação.
- **Conectividade**: o BP tem conexão de internet estável durante o atendimento; operação
  offline está fora de escopo.
- **Integrações**: não há integração com sistemas de RH, folha, ATS ou canal de denúncias
  corporativo nesta versão. Todos os dados de contexto são informados pelo BP no relato ou no
  refinamento.
- **Envio de comunicações**: o app produz o texto da comunicação, mas não a envia ao
  destinatário — o disparo por e-mail ou mensageria permanece com o BP.
- **Decisão final**: os assistentes aconselham; qualquer decisão disciplinar, jurídica ou de
  desligamento permanece humana e fora do app.
- **Volume**: dimensionamento inicial para dezenas de BPs simultâneos em uma organização, não
  para uso público em massa.

## Dependencies

- Prompts canônicos versionados em `lib/agentes/` — fonte única de verdade do
  comportamento dos assistentes (Princípio IV da constituição).
- Constituição do projeto em `.specify/memory/constitution.md` — define as regras de
  confidencialidade, refinamento, escalonamento e estrutura de saída que esta feature
  materializa.
- Capacidade de processamento de linguagem natural para condução dos assistentes e de
  transcrição de áudio para a US4.
