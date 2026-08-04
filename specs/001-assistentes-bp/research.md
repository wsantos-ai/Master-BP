# Phase 0 — Research: App de Assistentes Especializados para BP

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-28

Stack fixada pelo usuário: Next.js, SQLite, Zod, Prisma, Gemini via `GEMINI_API_KEY`. As
decisões abaixo cobrem as lacunas remanescentes e o modo de uso de cada peça. Nenhum
`NEEDS CLARIFICATION` permanece aberto.

---

## R-01 — Onde vivem os controles constitucionais

**Decision**: Os três controles não negociáveis — portão de refinamento (Princípio II),
detecção de risco jurídico (Princípio III) e conformidade estrutural da entrega (Princípio V) —
são implementados como código de servidor em `lib/dominio/`, avaliados sobre o estado
persistido do atendimento. O prompt continua instruindo o modelo a se comportar assim, mas a
decisão final é do servidor.

**Rationale**: Um prompt é uma instrução, não uma garantia. Modelos podem ser induzidos a pular
etapas pelo próprio usuário ("me dá logo o parecer"), e a constituição trata esses três pontos
como não negociáveis — SC-004 chega a exigir zero falso negativo em escalonamento. Uma
salvaguarda que só existe no prompt não é testável em unidade e não sobrevive a uma troca de
modelo.

**Alternatives considered**:
- *Confiar só no prompt*: mais simples e mais barato, mas nenhum dos critérios SC-004 e SC-005
  seria verificável de forma determinística. Rejeitado.
- *Modelo secundário como juiz*: cobre parte do problema, mas adiciona latência, custo e outra
  fonte não determinística onde a constituição pede certeza. Rejeitado como controle primário;
  pode complementar a detecção de risco (ver R-05).

---

## R-02 — Saída estruturada do Gemini validada por Zod

**Decision**: Toda chamada ao modelo pede resposta em JSON, com `responseMimeType:
"application/json"` e `responseSchema` declarado. A resposta é validada com o schema Zod
correspondente antes de qualquer persistência. Falha de validação dispara uma nova tentativa
(até 2 retentativas) e, persistindo, retorna erro ao BP sem gravar entrega parcial.

**Rationale**: A entrega de cada especialidade tem estrutura obrigatória fixa — sete seções no
parecer técnico, seis na entrega de treinamento. Texto livre exigiria parsing frágil. Com
schema declarado, a conformidade do Princípio V vira uma validação booleana, diretamente
testável (SC-003).

**Alternatives considered**:
- *Markdown livre + parsing por heurística*: frágil a variação de redação; rejeitado.
- *Function calling*: equivalente em garantia, mas mais verboso para o caso de saída única.

**Nota de implementação**: manter o schema Zod como fonte única e derivar dele o
`responseSchema` enviado ao Gemini, para que os dois nunca divirjam.

---

## R-03 — SQLite com Prisma, mantendo portabilidade para PostgreSQL

**Decision**: SQLite como provider inicial. O schema evita recursos que o conector SQLite do
Prisma não suporta: **sem `enum`** (usa `String` com união Zod validando no domínio) e **sem
tipo `Json`** (usa `String` com JSON serializado, parseado por Zod na leitura). Sem arrays
escalares. Trocar para PostgreSQL depois deve exigir mudança de `provider` e nova migração, não
reescrita de modelo.

**Rationale**: São limitações reais do conector SQLite do Prisma. Descobri-las durante a
implementação custaria retrabalho de schema. Declará-las agora mantém a migração futura barata
— e a spec já projeta crescimento além da fase inicial.

**Alternatives considered**:
- *Começar em PostgreSQL*: elimina a restrição, mas contraria a escolha do usuário e adiciona
  infraestrutura antes que a escala justifique.
- *Guardar tudo como JSON em uma tabela*: perderia integridade referencial e tornaria a trilha
  de auditoria e o expurgo de retenção difíceis de consultar. Rejeitado.

---

## R-04 — Portão de refinamento como máquina de estados

**Decision**: Cada atendimento mantém uma lista de lacunas (`Lacuna`) derivada do fluxo de ação
da especialidade, cada uma com estado `aberta`, `respondida` ou `nao_aplicavel` (com
justificativa, conforme FR-008). A rota de emissão da entrega recusa a operação enquanto
existir lacuna crítica `aberta`, devolvendo as pendências. O modelo propõe novas lacunas ao
analisar o relato; o servidor persiste e controla.

**Rationale**: Torna FR-007 e FR-009 observáveis: o BP vê o que falta, e o teste verifica um
estado, não uma redação. Também é o que permite retomar o atendimento exatamente do ponto onde
parou (US2, SC-008) — a próxima pergunta é simplesmente a próxima lacuna aberta.

**Alternatives considered**:
- *Contador de rodadas mínimas*: trivial de implementar e trivial de burlar; não representa o
  que a constituição pede. Rejeitado.

---

## R-05 — Detecção de risco jurídico em duas camadas

**Decision**: União de dois sinais. (a) Camada determinística: dicionário de termos e padrões
de risco em pt-BR — assédio moral/sexual, discriminação, fraude, justa causa, ação trabalhista,
dado pessoal sensível — aplicada ao relato e a cada resposta do BP. (b) Camada do modelo: campo
de classificação de risco na saída estruturada. Basta **uma** das camadas sinalizar para que o
escalonamento seja registrado e exibido. Uma bateria de casos fixos em `tests/fixtures/
casos-risco/` roda como regressão obrigatória.

**Rationale**: SC-004 não tolera falso negativo. A camada de regras cobre o vocabulário
explícito com determinismo; a do modelo cobre o relato que descreve assédio sem nunca usar a
palavra. Falso positivo aqui é barato — uma recomendação a mais de consultar o jurídico; falso
negativo é o dano que a constituição existe para evitar.

**Alternatives considered**:
- *Só regras*: cego a paráfrase e eufemismo, comuns em relato de RH. Rejeitado.
- *Só modelo*: não determinístico onde o critério exige garantia. Rejeitado.

---

## R-06 — Carregamento dos prompts canônicos

**Decision**: `lib/assistentes/prompt-loader.ts` lê os arquivos de `lib/agentes/`
em tempo de execução, calcula o hash SHA-256 do conteúdo e o registra no atendimento. Os
arquivos são somente leitura para a aplicação. Em produção, os prompts são empacotados no
build; o hash detecta divergência entre o que foi planejado e o que foi executado.

**Rationale**: Princípio IV exige fonte única de verdade e auditabilidade do que a IA foi
instruída a fazer. Guardar o hash por atendimento responde, meses depois, com qual versão do
prompt aquele parecer foi produzido — informação relevante se a entrega for questionada.

**Alternatives considered**:
- *Copiar os prompts para o banco*: cria uma segunda fonte de verdade que deriva silenciosamente
  da primeira. Viola o Princípio IV. Rejeitado.
- *Colar os prompts em constantes TypeScript*: mesma violação, com pior legibilidade.

---

## R-07 — Autenticação e controle de acesso

**Decision**: Auth.js (NextAuth v5) com provedor de credenciais e sessão em cookie `httpOnly`.
Toda leitura de atendimento passa por uma verificação de propriedade no servidor
(`atendimento.autorId === sessao.userId`), aplicada na camada de dados — não apenas na UI.

**Rationale**: FR-017 e SC-006 exigem que um BP jamais veja o atendimento de outro. Filtro na
consulta é a única defesa que não depende de a UI ter lembrado de esconder algo. Credenciais
bastam para a escala declarada; SSO corporativo é evolução natural sem reescrita, pois Auth.js
troca de provedor sem alterar a camada de autorização.

**Alternatives considered**:
- *SSO/OIDC já nesta versão*: adiciona dependência de infraestrutura do cliente antes de haver
  cliente. Adiável sem custo de retrabalho.

---

## R-08 — Proteção dos dados sensíveis em repouso

**Decision**: Relato, diálogo de refinamento e conteúdo da entrega são cifrados em repouso com
AES-256-GCM, chave derivada de variável de ambiente do servidor, cifragem aplicada na camada
de acesso a dados. Metadados necessários a filtro e expurgo (datas, especialidade, estado,
classificação) permanecem em claro. Nenhum conteúdo de atendimento entra em log de aplicação.

**Rationale**: SQLite é um arquivo no disco do servidor; sem cifragem, uma cópia do arquivo
entrega todo o histórico de RH da organização. Manter metadados em claro preserva os filtros da
US2 e o job de retenção sem expor conteúdo.

**Alternatives considered**:
- *Cifragem de banco inteiro (SQLCipher)*: proteção mais ampla, porém adiciona dependência
  nativa e complica a migração para PostgreSQL prevista em R-03.
- *Sem cifragem na fase inicial*: incompatível com o Princípio I, que não admite fase de
  carência. Rejeitado.

---

## R-09 — Transcrição de áudio (US4)

**Decision**: Usar o próprio Gemini para transcrever o áudio enviado, com o resultado exibido
ao BP para revisão e edição antes de iniciar o atendimento (FR-020). O áudio bruto é descartado
após a transcrição — só o texto revisado é persistido.

**Rationale**: Evita um segundo provedor e uma segunda chave de API. Descartar o áudio reduz a
superfície de dado sensível: a voz do BP relatando um caso de assédio é dado biométrico
desnecessário para o produto.

**Alternatives considered**:
- *API de transcrição do navegador*: gratuita, mas com suporte e qualidade irregulares entre
  navegadores, e a qualidade da transcrição determina a qualidade de todo o atendimento.
- *Provedor dedicado de STT*: melhor precisão marginal, ao custo de outro contrato e outra
  chave. Reavaliar se a precisão medida frustrar a US4.

---

## R-10 — Streaming da resposta e latência percebida

**Decision**: As rodadas de refinamento são transmitidas por streaming a partir de Route
Handlers; a entrega final **não** é transmitida — ela é gerada, validada contra o schema e só
então exibida.

**Rationale**: A meta de 3 s até o primeiro token só é alcançável com streaming no diálogo. Já
a entrega final precisa passar pela validação estrutural antes de chegar aos olhos do BP;
transmiti-la exibiria um documento que ainda pode ser rejeitado por seção ausente. Exibir e
depois retirar seria pior que esperar.

**Alternatives considered**:
- *Streaming em tudo*: melhora a percepção de velocidade e enfraquece o Princípio V. Rejeitado.

---

## R-11 — Retenção, expurgo e encerramento automático

**Decision**: Uma rotina agendada diária executa duas varreduras: encerra atendimentos sem
interação há 90 dias marcando-os como incompletos (FR-018) e expurga atendimentos concluídos há
mais de 24 meses (FR-026). O expurgo apaga conteúdo e mantém o registro de auditoria
anonimizado. Exclusão a pedido do BP (FR-027) segue o mesmo caminho, registrada na auditoria.

**Rationale**: Retenção declarada que não é executada é apenas texto. SC-011 exige verificar que
o dado realmente sumiu. Preservar o registro de auditoria anonimizado mantém a prova de que a
exclusão ocorreu, sem preservar o que foi excluído.

**Alternatives considered**:
- *Expurgo sob demanda na leitura*: dado expirado continuaria no arquivo do banco indefinidamente
  se ninguém o lesse — não satisfaz SC-011.

---

## R-12 — Estratégia de testes

**Decision**: Vitest para unidade (portão de lacunas, detecção de risco, schemas de entrega,
cifragem) e integração (rotas, propriedade do atendimento, auditoria, retenção). Playwright para
E2E, uma suíte por história. Chamadas ao Gemini são simuladas em unidade e integração; um
conjunto reduzido de testes de contrato roda contra a API real, fora do pipeline padrão.

**Rationale**: Os critérios de aceite mais duros — SC-004, SC-005, SC-006 — dependem de lógica
determinística nossa, não da resposta do modelo. Isolá-los permite exigir 100% deles sem
flakiness. Os testes contra a API real existem para detectar mudança de contrato do provedor.

**Alternatives considered**:
- *E2E contra a API real em todo o pipeline*: instável e caro, sem ganhar cobertura sobre os
  controles que realmente importam.

---

## Pontos a confirmar na implementação

- **Modelo Gemini específico**: escolher entre o modelo rápido e o mais capaz por rota — o
  roteamento (R-01) e a transcrição toleram o mais rápido; a entrega final justifica o mais
  capaz. Confirmar os identificadores de modelo vigentes na documentação do provedor no início
  da implementação, em vez de fixá-los aqui.
- **Nome da variável de ambiente**: o usuário especificou `GEMINI_API_KEY`, adotada como está.
  Note que a convenção mais difundida do provedor é `GEMINI_API_KEY` — vale um alinhamento antes
  de o nome se espalhar por deploy e documentação.
