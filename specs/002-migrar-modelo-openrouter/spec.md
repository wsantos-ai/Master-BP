# Feature Specification: Migração do provedor de IA para o OpenRouter (DeepSeek V4 Flash + Voxtral Mini Transcribe)

**Feature Branch**: `002-migrar-modelo-openrouter`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "atualizar para usar o modelo deepseek/deepseek-v4-flash-0731 do Openrouter"

**Clarificações incorporadas**: transcrição de áudio passa a usar
`mistralai/voxtral-mini-transcribe`, também no OpenRouter (2026-08-11).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Atendimento completo servido pelo novo modelo (Priority: P1)

O Business Partner abre um atendimento, descreve sua demanda, é roteado para a especialidade
correta, responde às perguntas de refinamento e recebe a entrega final estruturada — tudo isso
gerado pelo novo provedor e pelo novo modelo, sem que ele perceba qualquer diferença de
comportamento além, possivelmente, do tempo de resposta.

**Why this priority**: É a razão de ser da mudança. Se o ciclo completo não funcionar no novo
provedor, nada mais importa — os outros itens são refinamentos sobre esta base.

**Independent Test**: Configurar apenas a credencial do novo provedor (sem a credencial do
provedor anterior para geração de texto), percorrer um atendimento de ponta a ponta em cada uma
das especialidades do catálogo e confirmar que roteamento, refinamento e entrega final são
produzidos e aprovados pela validação de estrutura obrigatória.

**Acceptance Scenarios**:

1. **Given** a credencial do novo provedor está configurada, **When** o BP descreve uma demanda
   de gestão de pessoas, **Then** o sistema indica de uma a duas especialidades com
   justificativa e confiança, exatamente como antes da migração.
2. **Given** um atendimento com refinamento concluído, **When** o BP solicita a entrega final,
   **Then** o documento devolvido contém todas as seções obrigatórias da especialidade e o plano
   de ação com responsáveis e prazos.
3. **Given** uma demanda fora dos domínios de gestão de pessoas, **When** o BP a submete,
   **Then** o sistema recusa a criação do atendimento e explica o motivo, em português do Brasil.
4. **Given** a entrega gerada propõe medida punitiva sem fatos apurados, **When** a validação
   ocorre, **Then** a entrega é rejeitada e nada é persistido — a vedação punitiva continua
   valendo com o novo modelo.

---

### User Story 2 - Estrutura obrigatória garantida mesmo com aderência imperfeita do modelo (Priority: P1)

Quando o novo modelo devolve uma resposta que não obedece à estrutura obrigatória — seção
faltando, campo com tipo errado, texto fora do formato de dados — o sistema tenta novamente e,
esgotadas as tentativas, informa a falha ao BP sem gravar nada.

**Why this priority**: Modelos diferentes aderem a esquemas com fidelidade diferente. Sem esta
garantia, a migração poderia degradar silenciosamente o Princípio V (saída estruturada e
auditável) e entregar documentos incompletos ao BP.

**Independent Test**: Simular respostas malformadas do provedor e verificar que o sistema
retenta, registra o motivo em log sem conteúdo de atendimento e, ao esgotar as tentativas,
devolve erro sem persistir entrega parcial.

**Acceptance Scenarios**:

1. **Given** o modelo devolve uma resposta que não corresponde à estrutura exigida, **When** o
   sistema processa a resposta, **Then** ele descarta a resposta e tenta novamente, até o limite
   de tentativas definido.
2. **Given** todas as tentativas falharam, **When** o limite é atingido, **Then** o BP recebe
   mensagem de falha em português do Brasil e nenhuma entrega parcial fica gravada.
3. **Given** o modelo devolve texto que não é um documento de dados válido, **When** o sistema o
   processa, **Then** o registro em log identifica o motivo da falha sem incluir qualquer trecho
   do relato do BP.

---

### User Story 3 - Operação e diagnóstico da nova configuração (Priority: P2)

Quem opera a plataforma consegue configurar a credencial e o identificador do modelo por
ambiente, verificar rapidamente se a configuração está válida e entender, pelos registros, qual
modelo produziu cada entrega.

**Why this priority**: Sem diagnóstico, uma credencial ausente ou um identificador de modelo
descontinuado vira uma falha genérica para o BP em produção. Não bloqueia a migração, mas
determina o custo de sustentá-la.

**Independent Test**: Executar a rotina de diagnóstico com e sem credencial configurada e
confirmar que ela distingue os dois casos; conferir que a entrega persistida registra o
identificador do modelo que a gerou.

**Acceptance Scenarios**:

1. **Given** a credencial do provedor não está configurada, **When** o BP tenta iniciar um
   atendimento, **Then** o sistema responde com erro de configuração distinguível de
   indisponibilidade do provedor, e não retenta.
2. **Given** um atendimento foi entregue, **When** se consulta o registro da entrega, **Then**
   consta o identificador do modelo que a gerou.
3. **Given** um responsável precisa fixar outro modelo em um ambiente específico, **When** ele
   ajusta a configuração de ambiente, **Then** o sistema passa a usar o modelo indicado sem
   alteração de código.

---

### User Story 4 - Continuidade da entrada por voz (Priority: P2)

O BP continua podendo relatar sua demanda por áudio, com o texto transcrito apresentado para
revisão antes de entrar no atendimento, e sem que o áudio seja persistido.

**Why this priority**: É uma funcionalidade já entregue (US4 da feature 001) que depende de
capacidade de áudio. O modelo de texto escolhido não transcreve, então a migração precisa
apontar a transcrição para um modelo próprio de áudio, no mesmo provedor, em vez de quebrá-la
por omissão.

**Independent Test**: Configurar apenas a credencial do novo provedor, enviar um áudio válido e
confirmar que o texto transcrito volta para revisão do BP; enviar áudio inaudível e confirmar a
sinalização de baixa confiança.

**Acceptance Scenarios**:

1. **Given** o BP envia um áudio audível dentro do limite de tamanho, **When** a transcrição é
   concluída, **Then** o texto é apresentado para revisão antes de virar relato do atendimento.
2. **Given** o áudio é inaudível ou ruidoso, **When** a transcrição é concluída, **Then** o
   sistema sinaliza baixa confiança ao BP.
3. **Given** a transcrição foi concluída, **When** a requisição termina, **Then** o áudio não
   permanece armazenado em lugar algum.
4. **Given** o áudio está em português do Brasil, **When** a transcrição é concluída, **Then** o
   texto devolvido é literal — sem resumo, tradução ou interpretação.
5. **Given** o arquivo excede o limite de tamanho ou está em formato não aceito, **When** o BP o
   envia, **Then** a recusa acontece antes de qualquer chamada ao provedor, com mensagem em
   português do Brasil.

---

### Edge Cases

- O provedor devolve erro de limite de requisições ou indisponibilidade temporária: o BP recebe
  mensagem de indisponibilidade em português do Brasil, distinta do erro de configuração, e o
  atendimento permanece íntegro para nova tentativa.
- O identificador de modelo configurado deixa de existir no provedor: a falha é reportada como
  erro de configuração acionável, não como falha genérica de geração.
- A resposta do modelo excede o limite de tamanho e é truncada no meio do documento: tratada
  como resposta inválida, sujeita a retentativa, nunca persistida parcialmente.
- O modelo de transcrição devolve texto vazio para um áudio sem fala audível: o BP recebe aviso
  de que não foi possível identificar fala, e nenhum relato vazio entra no atendimento.
- O modelo de transcrição fica indisponível enquanto o de texto opera normalmente (ou o
  contrário): a falha é reportada apenas na funcionalidade afetada, sem derrubar o restante do
  atendimento.
- A demanda envolve risco jurídico crítico: o escalonamento para Jurídico/RT/Compliance continua
  explícito na entrega, independentemente do modelo que a gerou.
- A denúncia é anônima: as limitações probatórias continuam sinalizadas na entrega.
- Credencial do provedor anterior ainda presente no ambiente: não deve alterar o comportamento —
  a origem das gerações de texto é determinada pela configuração ativa, não por sobras de
  ambiente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST usar o modelo `deepseek/deepseek-v4-flash-0731`, servido pelo
  OpenRouter, como modelo padrão para todas as gerações de texto da plataforma: roteamento de
  especialidade, perguntas de refinamento, respostas conversacionais e entrega final.
- **FR-002**: O sistema MUST autenticar-se no provedor por meio de credencial lida
  exclusivamente no servidor, nunca exposta ao navegador.
- **FR-003**: O sistema MUST permitir sobrescrever, por configuração de ambiente e sem alteração
  de código, o identificador do modelo usado — inclusive mantendo a distinção entre o modelo de
  tarefas rápidas e o de tarefas mais exigentes, caso um ambiente queira diferenciá-los.
- **FR-004**: O sistema MUST tratar a ausência de credencial como erro de configuração
  distinguível de falha do provedor, sem retentativa e com mensagem acionável para quem opera.
- **FR-005**: O sistema MUST validar toda resposta do modelo contra a estrutura obrigatória da
  especialidade antes de qualquer persistência ou exibição, mantendo o limite atual de
  tentativas e o comportamento de não gravar nada quando as tentativas se esgotam.
- **FR-006**: O sistema MUST preservar, sem alteração de conteúdo, os prompts canônicos dos
  agentes — a migração troca o provedor e o modelo, não o comportamento instruído.
- **FR-007**: O sistema MUST preservar integralmente as regras de domínio já vigentes: recusa de
  demanda fora de escopo, portão de refinamento, detecção de risco com escalonamento explícito,
  vedação de medida punitiva sem fatos apurados e sinalização de limitações em denúncia anônima.
- **FR-008**: O sistema MUST registrar, na entrega persistida, o identificador do modelo que a
  gerou, de modo que entregas anteriores e posteriores à migração permaneçam distinguíveis.
- **FR-009**: O sistema MUST manter os registros de log livres de conteúdo de atendimento,
  reportando falhas do provedor apenas por motivo, evento e número da tentativa.
- **FR-010**: O sistema MUST devolver ao BP mensagens de erro em português do Brasil que
  distingam configuração inválida, indisponibilidade do provedor e resposta reprovada na
  validação de estrutura.
- **FR-011**: O envio de dados ao novo provedor MUST ser configurado de modo que o conteúdo dos
  atendimentos — incluindo o áudio submetido para transcrição — não seja retido pelo provedor
  além do necessário para atender à requisição, nem usado para treinamento de modelos. Onde o
  provedor oferecer controle explícito dessa política, a configuração restritiva MUST ser
  adotada e documentada. A restrição vale para todos os modelos usados, de texto e de áudio.
- **FR-012**: O sistema MUST usar o modelo `mistralai/voxtral-mini-transcribe`, servido pelo
  OpenRouter, para a transcrição de áudio, mantendo a entrada por voz funcional: transcrição
  literal em português do Brasil, sinalização de baixa confiança quando o áudio for inaudível ou
  ruidoso, texto apresentado para revisão do BP antes de virar relato e áudio nunca persistido.
  O identificador desse modelo MUST ser configurável por ambiente, nos mesmos termos do FR-003.
- **FR-015**: Após a migração, o sistema MUST operar com um único provedor de IA: nenhuma
  funcionalidade — geração de texto ou transcrição — pode depender de credencial de outro
  provedor. As validações de tamanho e formato de áudio MUST continuar ocorrendo antes de
  qualquer chamada ao provedor.
- **FR-013**: A documentação de operação (variáveis de ambiente e passos de configuração) MUST
  ser atualizada para refletir o novo provedor, de forma que um ambiente novo suba sem consultar
  o código-fonte.
- **FR-014**: O conjunto de testes automatizados MUST continuar executando sem credencial de
  provedor configurada, com as chamadas ao modelo substituídas por dublês.

### Key Entities

- **Configuração de provedor de IA**: identifica o provedor ativo, a credencial de acesso e os
  identificadores de modelo por tipo de tarefa — rápida, exigente e transcrição de áudio.
  Definida por ambiente, com uma única credencial para todas as tarefas.
- **Entrega**: documento final produzido para o atendimento; entre seus atributos de auditoria
  está o identificador do modelo que a gerou.
- **Registro de falha de geração**: evento observável com tipo de falha, etapa e número da
  tentativa — sem qualquer conteúdo de atendimento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das especialidades do catálogo produzem entrega final aprovada na validação
  de estrutura obrigatória, em pelo menos uma execução de ponta a ponta por especialidade.
- **SC-002**: Em 30 execuções de entrega final, no mínimo 95% são aprovadas na primeira
  tentativa de validação de estrutura, e 100% resultam em entrega válida ou em erro explícito —
  nunca em entrega parcial gravada.
- **SC-003**: O BP recebe a primeira resposta do sistema (roteamento) em até 5 segundos e a
  entrega final em até 30 segundos, em condições normais de operação.
- **SC-004**: 100% dos casos de risco crítico do conjunto de testes continuam disparando
  recomendação explícita de validação com Jurídico, Relações Trabalhistas ou Compliance.
- **SC-005**: 100% das entregas geradas após a migração registram o identificador do modelo que
  as produziu.
- **SC-006**: Nenhum registro de log produzido durante falhas de geração contém trecho de relato,
  resposta de refinamento ou nome de pessoa — verificável por inspeção dos registros de uma
  execução completa de testes.
- **SC-007**: Um ambiente novo entra em operação seguindo apenas a documentação atualizada, sem
  consulta ao código-fonte.
- **SC-008**: A entrada por voz funciona com apenas uma credencial de provedor configurada: em
  um conjunto de amostras de áudio em português do Brasil, 100% das gravações audíveis retornam
  texto para revisão do BP, e 100% das inaudíveis são sinalizadas como baixa confiança ou
  recusadas por ausência de fala.
- **SC-009**: Nenhum áudio submetido permanece armazenado após o término da requisição —
  verificável por inspeção do armazenamento da aplicação e do banco de dados.

## Assumptions

- **Provedor único**: o OpenRouter passa a ser o provedor de todas as chamadas de IA — geração de
  texto e transcrição de áudio —, com uma única credencial. A dependência do provedor anterior
  sai do projeto. A plataforma não mantém alternância automática entre provedores nesta feature.
- **Modelo de transcrição dedicado**: a transcrição usa `mistralai/voxtral-mini-transcribe`,
  distinto do modelo de texto. Presume-se que ele aceite os formatos de áudio já suportados pela
  plataforma e o limite de 25 MB vigente; caso o provedor imponha limite menor, o limite da
  plataforma é ajustado para o mais restritivo dos dois.
- **Modelo único nas duas faixas**: por padrão, o mesmo modelo atende tarefas rápidas e
  exigentes, já que a variante indicada é de baixa latência. A separação entre as duas faixas é
  preservada apenas como ponto de configuração, para o caso de um ambiente querer diferenciá-las.
- **Sem migração de dados**: entregas geradas antes da migração permanecem como estão, com o
  identificador do modelo antigo. Não há reprocessamento retroativo.
- **Sem mudança de interface**: nenhuma tela, fluxo ou texto visível ao BP muda por causa desta
  feature, exceto mensagens de erro que já são específicas de provedor.
- **Sem mudança nos prompts**: os prompts canônicos dos agentes são preservados. Se a aderência
  do novo modelo à estrutura obrigatória exigir ajuste de prompt, esse ajuste é tratado como
  trabalho subsequente, sujeito à revisão prevista na constituição.
- **Custo e cotas**: presume-se que a conta do provedor tenha crédito e limite de requisições
  suficientes para o volume atual; monitoramento de custo está fora do escopo desta feature.
- **Disponibilidade dos identificadores**: presume-se que `deepseek/deepseek-v4-flash-0731` e
  `mistralai/voxtral-mini-transcribe` estejam disponíveis na conta usada. Caso algum não esteja,
  a configurabilidade prevista em FR-003 e FR-012 permite apontar para outro identificador sem
  alteração de código.
