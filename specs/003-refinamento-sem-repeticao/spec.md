# Feature Specification: Refinamento sem repetição — o assistente para de reperguntar e a lista de lacunas para de crescer

**Feature Branch**: `003-refinamento-sem-repeticao`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "corrigir o laço de refinamento: o assistente repete perguntas já respondidas e a lista de lacunas cresce a cada rodada. Consumir o sinal lacunasResolvidas do modelo, deduplicar novas lacunas contra as já existentes no atendimento, e instruir o modelo a não reformular pergunta já feita"

**Clarificações incorporadas**: no máximo 3 pendências críticas apresentadas por vez, com as
excedentes em fila — nada é descartado, e a fila continua bloqueando a entrega (2026-08-11).

**Origem**: defeito observado em uso real. Relato de teste: comunicação de mudança de modelo de
comissionamento para 24 pessoas, com prazo de uma semana. O refinamento passou a reperguntar
informações já dadas e a lista de pendências cresceu a cada rodada, tornando a etapa longa
demais para ser concluída.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O assistente não repergunta o que já foi respondido (Priority: P1)

O Business Partner responde uma pergunta do refinamento. Nas rodadas seguintes, aquela
informação não volta a ser pedida — nem com as mesmas palavras, nem reformulada.

**Why this priority**: é a queixa central. Reperguntar destrói a confiança do BP no assistente:
se ele não retém o que foi dito, o BP passa a duvidar de que a entrega final considerará suas
respostas. Sem isso, nada mais importa.

**Independent Test**: conduzir um atendimento respondendo cada pergunta com conteúdo distinto e
verificável, e conferir, rodada a rodada, que nenhuma pergunta pendente pede informação já
fornecida — nem literalmente, nem em paráfrase.

**Acceptance Scenarios**:

1. **Given** o BP respondeu uma pergunta na rodada anterior, **When** a rodada seguinte é
   processada, **Then** aquela pergunta não aparece entre as pendências.
2. **Given** o assistente propõe uma pergunta equivalente a uma já respondida, apenas com outra
   redação, **When** o sistema processa a proposta, **Then** a pergunta equivalente é descartada
   e não vira pendência nova.
3. **Given** o BP declarou uma pergunta como não aplicável, com justificativa, **When** as
   rodadas seguintes ocorrem, **Then** aquele assunto não retorna como pendência.
4. **Given** o assistente propõe uma pergunta equivalente a outra que já está **aberta**,
   **When** o sistema processa a proposta, **Then** apenas uma pendência sobre aquele assunto
   permanece na lista.

---

### User Story 2 - A etapa de refinamento converge (Priority: P1)

A cada resposta do BP, a quantidade de pendências tende a diminuir. O BP percebe progresso e
consegue chegar ao fim do refinamento em um número previsível de rodadas.

**Why this priority**: mesmo sem repetição, uma lista que só cresce torna a etapa interminável.
Convergência é o que transforma o refinamento em um caminho com fim visível, em vez de uma
esteira. É tão crítica quanto a US1 e não é entregue por ela.

**Independent Test**: conduzir três atendimentos de complexidade média até o portão liberar,
registrando o número de pendências abertas ao fim de cada rodada, e confirmar que a série é
decrescente após a primeira rodada e que o refinamento termina.

**Acceptance Scenarios**:

1. **Given** um atendimento em refinamento com pendências apresentadas, **When** o BP responde uma
   pergunta, **Then** o total de pendências críticas ainda não resolvidas — apresentadas mais em
   fila — ao fim da rodada não é maior que o total do início da rodada.
2. **Given** um relato amplo, que legitimamente demanda muitas informações, **When** o
   refinamento é conduzido até o fim, **Then** o BP nunca vê mais de 3 pendências críticas por
   vez, e as demais entram conforme ele resolve as ativas.
3. **Given** existem pendências críticas em fila, **When** o BP resolve uma das apresentadas,
   **Then** a próxima da fila é promovida e aparece, mantendo o BP com um caminho visível.
4. **Given** todas as pendências críticas foram resolvidas, apresentadas e em fila, **When** a
   rodada é processada, **Then** o portão libera a entrega e o assistente não abre novas
   pendências críticas apenas para continuar perguntando.

---

### User Story 3 - O portão de refinamento continua incorruptível (Priority: P1)

O sistema passa a usar o sinal do assistente sobre quais lacunas foram resolvidas — mas esse
sinal nunca consegue fechar uma pendência que o BP de fato não respondeu.

**Why this priority**: a correção introduz um caminho novo pelo qual uma lacuna pode ser marcada
como resolvida. Se esse caminho aceitar a palavra do modelo sem verificação, o Princípio II cai:
o assistente poderia liberar a entrega final declarando resolvido o que ninguém respondeu. A
correção não pode custar a garantia que o produto existe para dar.

**Independent Test**: simular um assistente que declara resolvidas todas as lacunas do
atendimento, inclusive as que nunca foram respondidas, e confirmar que as não respondidas
permanecem abertas e que o portão continua bloqueando a entrega.

**Acceptance Scenarios**:

1. **Given** o assistente declara resolvida uma lacuna crítica que o BP não respondeu, **When** a
   rodada é processada, **Then** a lacuna permanece aberta e a entrega segue bloqueada.
2. **Given** o assistente declara resolvida uma lacuna que pertence a outro atendimento, **When**
   a rodada é processada, **Then** o sinal é ignorado e nada muda em nenhum dos dois
   atendimentos.
3. **Given** o BP respondeu uma pergunta cuja resposta também esclarece outra pendência aberta,
   **When** o assistente sinaliza as duas como resolvidas, **Then** ambas são fechadas e o
   registro preserva de onde veio a informação de cada uma.
4. **Given** uma lacuna foi fechada pelo sinal do assistente, **When** se consulta o atendimento,
   **Then** é possível distinguir se ela foi fechada por resposta direta do BP ou por
   aproveitamento de outra resposta.

---

### Edge Cases

- O assistente propõe uma pergunta quase idêntica a uma existente, diferindo só por pontuação,
  acentuação, maiúsculas ou uma palavra de ligação: tratada como repetição.
- O assistente propõe duas perguntas equivalentes entre si na **mesma** rodada: apenas uma entra.
- Duas perguntas são textualmente parecidas mas pedem coisas diferentes (por exemplo, "qual o
  prazo para comunicar?" e "qual o prazo para implementar?"): ambas permanecem — descartar
  informação legítima é pior que manter uma pendência a mais.
- O assistente não sinaliza nenhuma lacuna como resolvida, embora o BP tenha respondido: a
  resposta direta do BP continua fechando a pendência correspondente, como sempre.
- O assistente sinaliza como resolvida uma lacuna já fechada: sem efeito, sem erro.
- O limite de 3 apresentadas é atingido e o assistente propõe mais: as excedentes entram em fila,
  não são descartadas (FR-007), e continuam bloqueando a entrega (FR-014).
- O BP resolve as 3 apresentadas de uma vez: as 3 seguintes da fila são promovidas na mesma
  rodada, respeitando o limite.
- O BP retoma um atendimento interrompido com pendências em fila: vê as mesmas 3 de antes, na
  mesma ordem (FR-015).
- Uma pendência em fila se torna equivalente a outra respondida no meio do caminho: é descartada
  pela mesma verificação de equivalência, sem nunca chegar a ser apresentada.
- A rodada não produz nenhuma pendência nova e nenhuma resolução: o atendimento não fica travado;
  o BP sempre tem um próximo passo visível.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST usar o sinal do assistente sobre lacunas resolvidas para fechar
  pendências que a última resposta do BP esclareceu, mesmo quando a resposta foi dada a outra
  pergunta.
- **FR-002**: O sistema MUST recusar o fechamento de qualquer lacuna para a qual não exista
  conteúdo de resposta registrado no atendimento. O sinal do assistente é evidência de que uma
  resposta cobre uma pendência — nunca substituto da resposta.
- **FR-003**: O sistema MUST ignorar sinal de resolução que aponte para lacuna inexistente ou
  pertencente a outro atendimento, sem interromper a rodada.
- **FR-004**: O sistema MUST registrar, para cada lacuna fechada, se o fechamento veio de resposta
  direta do BP ou de aproveitamento de outra resposta, de modo que a origem seja auditável.
- **FR-005**: O sistema MUST descartar, antes de registrar, toda pergunta proposta pelo
  assistente que seja equivalente a uma pergunta já existente no atendimento — aberta, respondida
  ou declarada não aplicável.
- **FR-006**: O sistema MUST aplicar a mesma verificação de equivalência entre as perguntas
  propostas na mesma rodada, de modo que duas formulações do mesmo pedido não gerem duas
  pendências.
- **FR-007**: O sistema MUST apresentar ao BP no máximo **3 pendências críticas por vez**. As
  pendências críticas excedentes MUST ser mantidas em fila, na ordem em que foram propostas, e
  promovidas a apresentadas conforme o BP resolve as ativas — de modo que o número de perguntas
  visíveis se mantenha em até 3 e nenhuma informação necessária seja perdida.
- **FR-014**: Uma pendência crítica em fila MUST continuar bloqueando a entrega final,
  exatamente como uma apresentada. O limite de 3 governa o que o BP vê por vez, **nunca** o que o
  portão exige: uma pendência fora da tela não é uma pendência resolvida.
- **FR-015**: A promoção de pendências da fila MUST ser determinística e ocorrer no servidor, de
  modo que o BP sempre veja o próximo item na mesma ordem, inclusive ao retomar um atendimento
  interrompido.
- **FR-016**: Pendências não críticas MUST permanecer fora do limite de 3 e continuar sem
  bloquear a entrega, como já ocorre hoje.
- **FR-008**: O sistema MUST instruir explicitamente o assistente a não repetir nem reformular
  pergunta já feita no atendimento, sem alterar os prompts canônicos das especialidades.
- **FR-009**: O sistema MUST manter o portão de refinamento como decisão de servidor sobre estado
  persistido: nenhuma alteração desta feature pode permitir que a entrega final seja liberada com
  lacuna crítica de fato aberta.
- **FR-010**: O sistema MUST preservar o comportamento atual de resposta direta: responder uma
  pergunta ou declará-la não aplicável com justificativa continua fechando aquela pendência.
- **FR-011**: O sistema MUST manter a rastreabilidade das perguntas descartadas por equivalência,
  em volume e não em conteúdo, para que a qualidade da deduplicação seja mensurável sem registrar
  conteúdo de atendimento.
- **FR-012**: O sistema MUST tratar perguntas e respostas como conteúdo sensível em todo o novo
  processamento: nenhuma comparação, contagem ou registro pode expor texto de atendimento em log.
- **FR-013**: O sistema MUST continuar apresentando ao BP, a cada rodada, pelo menos um próximo
  passo — pendência a responder ou liberação da entrega —, nunca um estado sem saída.

### Key Entities

- **Lacuna**: informação que falta para a entrega poder ser emitida. Além do que já possui,
  passa a distinguir duas coisas novas: a **origem do fechamento** (resposta direta do BP ou
  aproveitamento de outra resposta) e a **situação de apresentação** (apresentada ao BP ou em
  fila). A situação de apresentação não altera o efeito da lacuna sobre o portão.
- **Fila de pendências**: ordem determinística em que as pendências críticas ainda não
  apresentadas entrarão na tela do BP, conforme ele resolve as ativas.
- **Sinal de resolução do assistente**: indicação, por rodada, de quais pendências a última
  resposta do BP esclareceu. É evidência sujeita a verificação, não decisão.
- **Proposta de pergunta**: pergunta que o assistente sugere acrescentar. Passa por verificação
  de equivalência antes de virar pendência; pode ser descartada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 10 atendimentos conduzidos até a liberação do portão, **zero** perguntas
  pendentes pedem informação que o BP já forneceu no mesmo atendimento.
- **SC-002**: Em cada rodada de refinamento, o número de pendências críticas não resolvidas —
  apresentadas mais em fila — ao final não é maior que o número no início: a série é
  monotonicamente não crescente após a primeira rodada.
- **SC-003**: 90% dos atendimentos de complexidade média chegam à liberação do portão em no
  máximo 8 rodadas de refinamento. O teto sobe de 6 para 8 porque a apresentação em blocos de 3
  troca rodadas longas por rodadas curtas — o que o BP responde no total não aumenta.
- **SC-004**: O número de pendências críticas apresentadas ao BP nunca ultrapassa **3**, em
  nenhum momento de nenhum atendimento.
- **SC-010**: 100% das pendências críticas em fila continuam bloqueando a entrega final,
  verificável por caso que enfileira pendências e confirma que o portão não libera.
- **SC-011**: Ao retomar um atendimento interrompido, as pendências apresentadas são as mesmas, e
  na mesma ordem, em 100% das retomadas.
- **SC-005**: 100% das tentativas de fechar lacuna sem resposta registrada são recusadas,
  verificável por conjunto de casos que simula um assistente declarando tudo resolvido.
- **SC-006**: 100% das lacunas fechadas registram a origem do fechamento.
- **SC-007**: Nenhum registro de log produzido pelo novo processamento contém texto de pergunta,
  resposta ou relato — verificável por inspeção dos registros de uma execução completa.
- **SC-008**: A taxa de descarte por equivalência é observável por atendimento, permitindo
  identificar deduplicação agressiva demais (perguntas legítimas descartadas) ou frouxa demais.
- **SC-009**: O BP conclui o refinamento do caso de teste de origem — comunicação de mudança de
  comissionamento para 24 pessoas — sem encontrar nenhuma pergunta repetida.

## Assumptions

- **Escopo**: a correção se limita ao laço de refinamento. Roteamento, geração da entrega final,
  detecção de risco, vedação punitiva, exportação e retenção não são tocados.
- **Prompts canônicos preservados**: a instrução de não repetir pergunta é acrescentada ao
  contrato de saída que o sistema já impõe sobre o comportamento do assistente, sem alterar os
  arquivos canônicos das especialidades. Se a correção exigir mudança neles, isso vira trabalho
  próprio, com a revisão que a constituição pede.
- **Equivalência aproximada**: a verificação de equivalência entre perguntas é heurística e pode
  errar. Diante da dúvida, o sistema **mantém** a pergunta: uma pendência a mais custa uma
  pergunta ao BP; uma pendência descartada por engano custa uma entrega mal fundamentada.
- **Sem migração de dados**: atendimentos já existentes mantêm suas lacunas como estão. A
  correção vale para as rodadas a partir da implantação.
- **Sem fluxo novo na interface**: a tela de refinamento continua exibindo as pendências que o
  servidor manda, do jeito que já exibe — ela apenas passa a receber no máximo 3. Nenhuma tela,
  botão ou etapa nova é criada para o BP, e a fila não é exposta como conceito: para ele, as
  perguntas simplesmente vão chegando conforme responde.
- **Limite de 3 como constante de produto**: o número é uma escolha de experiência, não uma
  restrição técnica. Fica em um único ponto de configuração, para poder ser ajustado com base no
  uso sem virar nova feature.
- **Atendimentos concluídos não são reprocessados**: entregas já emitidas permanecem como estão.
- **Complexidade média**: para efeito de SC-003, um atendimento de complexidade média é o que hoje
  gera entre 4 e 8 lacunas críticas ao longo do refinamento.
