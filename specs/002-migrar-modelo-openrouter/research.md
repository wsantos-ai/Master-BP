# Phase 0 — Research: migração para o OpenRouter

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data**: 2026-08-11

Todos os pontos marcados como `NEEDS CLARIFICATION` no Technical Context foram resolvidos. As
consultas à documentação do provedor foram feitas em 11/08/2026; os pontos que dependem de
comportamento em produção estão marcados como **a confirmar na implementação**.

---

## R-01 — Como falar com o OpenRouter: `fetch` nativo, sem SDK

**Decisão**: consumir a API HTTP diretamente com o `fetch` nativo do Node 20. Nenhuma dependência
nova; `@google/genai` sai do `package.json`.

**Racional**:

- A API é `POST https://openrouter.ai/api/v1/chat/completions`, autenticada por
  `Authorization: Bearer <chave>` e `Content-Type: application/json`. É uma chamada JSON simples;
  um SDK não acrescenta nada que o `fetch` não faça.
- O repositório já sofreu com peso de bundle: o commit `dd970c0` reduziu o middleware para caber
  no limite de Edge Function da Vercel. Trocar um SDK por outro empurraria o problema adiante;
  trocar SDK por `fetch` o alivia.
- Sem SDK, o formato exato da requisição fica visível no código — o que importa aqui, porque os
  campos de política de dados (R-05) são justamente o que garante o Princípio I. Enterrá-los sob
  uma abstração de terceiro tornaria a garantia menos auditável.

**Cabeçalhos opcionais**: `HTTP-Referer` e `X-OpenRouter-Title` servem para atribuição do app no
site do provedor. **Não serão enviados** — são metadados de divulgação sem valor para o produto e
associariam a organização às requisições sem necessidade.

**Alternativas consideradas**:

- **SDK `openai` apontado para a base URL do OpenRouter**: funcionaria, e é o caminho mais
  documentado. Rejeitado por adicionar uma dependência pesada para exercitar dois endpoints, e
  por não expor bem o objeto `provider` (campo não-padrão da OpenAI) de que R-05 depende.
- **Manter o SDK Gemini e apontá-lo para o OpenRouter**: inviável — protocolos diferentes.

---

## R-02 — Saída estruturada: schema estrito no provedor, Zod como contrato

**Decisão**: enviar `response_format: { type: 'json_schema', json_schema: { name, strict: true,
schema } }`, com um schema convertido para o dialeto estrito, e **manter a validação Zod como a
única autoridade sobre a aceitação da resposta**.

O modelo `deepseek/deepseek-v4-flash-0731` declara `response_format` e `structured_outputs` entre
os `supported_parameters` — o modo estrito está disponível.

**O que muda em `paraSchemaDoProvedor()`**: hoje a função foi escrita para o dialeto do Gemini —
ela *remove* `additionalProperties` e `$ref`. O dialeto estrito do OpenRouter exige o oposto em um
ponto e proíbe outras coisas:

| Aspecto | Gemini (hoje) | OpenRouter estrito (novo) |
|---|---|---|
| `additionalProperties` | removido | **obrigatório**, `false`, em todo objeto |
| `required` | conforme o Zod | **todas** as propriedades do objeto |
| `$ref` / `$defs` | removidos | não suportados — resolver por inlining |
| `nullable: true` | aceito | não — usar `type: ["string","null"]` |
| `minLength` / `maxItems` / `minimum` | ignorados | não suportados no modo estrito |

Consequências práticas para os schemas existentes:

- `zodToJsonSchema` passa a ser chamado com `target: 'jsonSchema7'` (e não `openApi3`), para que
  `.nullable()` vire `type: [..., "null"]` em vez de `nullable: true`. Afeta
  `saidaRoteamento.motivoRecusa`.
- `$refStrategy: 'none'` elimina `$ref`/`$defs` por inlining, resolvendo o caso das estruturas de
  entrega que reaproveitam sub-schemas.
- As restrições de valor (`z.string().min(10)`, `z.array(...).max(2)`, `z.number().min(0).max(1)`)
  são **removidas do schema do provedor** e permanecem apenas no Zod.

**Este é o ponto que o Princípio V exige que fique explícito**: o schema enviado ao modelo é uma
*orientação de formato*. Quem reprova uma entrega sem seção obrigatória, uma justificativa curta
demais ou uma confiança fora de [0,1] continua sendo o `safeParse` em `gerarEstruturado`, com as
mesmas 3 tentativas e o mesmo "nada é gravado ao esgotar". A migração não afrouxa o portão — ela
apenas para de fingir que o provedor o aplica.

**Degradação**: se o provedor recusar `json_schema` (modelo ou rota sem suporte), a chamada cai
uma única vez, por processo, para `response_format: { type: 'json_object' }` com o schema
serializado na instrução de sistema, e registra `ia.json_schema_indisponivel` no log. A validação
Zod permanece idêntica nos dois modos, então a degradação não é uma perda de garantia — só de
eficiência. `provider.require_parameters: true` foi **rejeitado**: ele transforma ausência de
suporte em falha de roteamento, que é pior que a degradação para o BP.

**Alternativas consideradas**:

- **Só `json_object` (JSON mode), sem schema**: mais simples e universalmente suportado.
  Rejeitado como padrão porque desperdiça uma capacidade que o modelo tem e aumentaria a taxa de
  retentativa, comprometendo SC-002.
- **Traduzir as restrições de valor para o schema do provedor**: impossível no modo estrito, que
  não as aceita.

---

## R-03 — Transcrição: endpoint dedicado, não chat

**Decisão**: usar `POST https://openrouter.ai/api/v1/audio/transcriptions` com
`model: 'mistralai/voxtral-mini-transcribe'`, `input_audio: { data: <base64>, format: <fmt> }` e
`language: 'pt'`.

**Racional e achados**:

- `mistralai/voxtral-mini-transcribe` é um modelo **somente de transcrição**: não aceita instrução
  de sistema nem saída estruturada. O desenho atual — pedir ao modelo um JSON com `texto` e
  `confiancaBaixa` — não sobrevive à migração e precisa ser substituído.
- O endpoint aceita `wav, mp3, flac, m4a, ogg, webm, aac`. Os seis tipos MIME já aceitos pela
  plataforma mapeiam integralmente: `audio/webm`→`webm`, `audio/ogg`→`ogg`, `audio/mpeg`→`mp3`,
  `audio/mp4` e `audio/x-m4a`→`m4a`, `audio/wav`→`wav`. **Nenhuma perda de compatibilidade** — o
  `MediaRecorder` do navegador, que produz `audio/webm` no Chrome, continua atendido.
- O limite de 25 MB do provedor coincide com o `LIMITE_BYTES` já vigente. A premissa da spec
  ("o mais restritivo dos dois") se resolve sem alteração.
- A resposta é `{ text, usage: { seconds, total_tokens, ... } }`. **Não há campo de confiança.**
- O modelo declara suporte a português e filtra silêncio e trechos não-falados, devolvendo texto
  vazio nesses casos — o que já é o gatilho do erro "não foi possível identificar fala".
- Há teto de ~60 s de processamento upstream (não de duração do áudio). Gravações longas podem
  estourar; ver R-07.

**Como `confiancaBaixa` passa a ser produzida**: por regra determinística no servidor, a partir do
texto devolvido e de `usage.seconds`:

- texto vazio ou só espaços → erro "não foi possível identificar fala" (comportamento atual,
  preservado);
- densidade de fala abaixo de um piso (poucos caracteres para muitos segundos de áudio) →
  `confiancaBaixa: true`;
- texto muito curto em termos absolutos → `confiancaBaixa: true`.

A regra é uma função pura, testável sem provedor, e substitui um julgamento que hoje depende da
boa vontade do modelo. Os limiares concretos ficam para a implementação, calibrados contra as
amostras de SC-008.

**Alternativas consideradas**:

- **Pedir `response_format: 'verbose_json'` e derivar confiança de segmentos/logprobs**: os campos
  de probabilidade não são garantidos para este modelo (o formato verboso é modelado sobre o
  Whisper). Rejeitado por depender de comportamento não documentado para o modelo escolhido.
  **A confirmar na implementação**: se o `verbose_json` do Voxtral trouxer sinal utilizável, ele é
  preferível à heurística e a substitui.
- **Usar um modelo de chat multimodal via `input_audio` no chat completions**: manteria o desenho
  atual de JSON estruturado, mas exigiria um terceiro modelo e custaria por token em vez de por
  minuto. Rejeitado: o usuário escolheu o Voxtral, e um modelo de transcrição dedicado é mais
  barato ($0,003/min) e mais preciso na tarefa.

---

## R-04 — Nomes de configuração e superfície do módulo

**Decisão**:

| Variável | Papel | Padrão |
|---|---|---|
| `OPENROUTER_API_KEY` | credencial única, só no servidor | — (obrigatória) |
| `OPENROUTER_MODELO_RAPIDO` | tarefas rápidas (roteamento) | `deepseek/deepseek-v4-flash-0731` |
| `OPENROUTER_MODELO_CAPAZ` | tarefas exigentes (refinamento, entrega) | `deepseek/deepseek-v4-flash-0731` |
| `OPENROUTER_MODELO_TRANSCRICAO` | transcrição de áudio | `mistralai/voxtral-mini-transcribe` |

As variáveis `GEMINI_*` são removidas de `.env.example` e do README. **Não haverá leitura de
fallback** para os nomes antigos: um ambiente que ainda tenha `GEMINI_API_KEY` e não tenha
`OPENROUTER_API_KEY` deve falhar com erro de configuração explícito, não operar meio migrado
(FR-015).

`MODELO_RAPIDO` e `MODELO_CAPAZ` continuam apontando para o mesmo modelo por padrão — a variante
Flash é rápida o bastante para as duas faixas. A distinção permanece como ponto de configuração,
conforme FR-003, e não custa nada mantê-la.

**Nomes exportados**: `lib/ia/openrouter.ts` exporta `MODELO_RAPIDO`, `MODELO_CAPAZ`,
`ErroConfiguracaoIA` — os mesmos de `gemini.ts` — mais `MODELO_TRANSCRICAO`,
`ErroProvedorIA` e as funções de chamada. Assim o diff nos consumidores é só o caminho do import.

---

## R-05 — Política de dados na requisição (Princípio I, FR-011)

**Decisão**: toda requisição — de texto e de transcrição — carrega:

```json
"provider": { "data_collection": "deny", "zdr": true }
```

**Racional**: o provedor oferece controle da política de dados em dois lugares — configuração da
conta e parâmetros de roteamento por requisição. Confiar apenas na conta seria confiar em estado
externo que ninguém no repositório consegue auditar e que qualquer pessoa com acesso ao painel
pode reverter em silêncio. `data_collection: "deny"` restringe o roteamento a provedores que não
armazenam o conteúdo; `zdr: true` restringe a endpoints de retenção zero. Enviá-los em toda
chamada torna a garantia parte do código, revisável em diff e verificável em teste.

**Consequência aceita**: essa restrição reduz o conjunto de provedores elegíveis e pode aumentar
latência ou, no limite, tornar o modelo indisponível em um dado momento. É o trade-off correto
para o domínio — o Princípio I não admite fase de carência. Se a restrição inviabilizar a
operação, a decisão é do usuário e volta como emenda, não como flag silenciosa.

**Também exigido, fora do código**: desativar o treinamento em provedores nas configurações da
conta, para modelos pagos e gratuitos. Vai documentado no [quickstart.md](./quickstart.md) como
passo obrigatório de preparação de ambiente.

**A confirmar na implementação**: se `provider.zdr: true` combinado com
`data_collection: "deny"` deixar o modelo escolhido sem nenhum endpoint elegível, registrar o
achado e escalar a decisão — não relaxar a política por conta própria.

---

## R-06 — Taxonomia de erros e o que vai para o log

**Decisão**: mapear a resposta HTTP para as duas classes de erro que a aplicação já distingue,
mais uma nova para falha transitória.

| Situação | Classe | Retenta? | Mensagem ao BP |
|---|---|---|---|
| `OPENROUTER_API_KEY` ausente | `ErroConfiguracaoIA` | não | "não estão configurados neste ambiente" |
| 401 / 403 — chave inválida ou sem permissão | `ErroConfiguracaoIA` | não | idem |
| 402 — sem crédito | `ErroConfiguracaoIA` | não | idem |
| 404 — modelo inexistente | `ErroConfiguracaoIA` | não | idem |
| 400 — parâmetro não suportado (`json_schema`) | degradação (R-02) | sim, 1× | — |
| 429 — limite de requisições | `ErroProvedorIA` | sim | "provedor indisponível" |
| 5xx / timeout / rede | `ErroProvedorIA` | sim | "provedor indisponível" |
| Resposta fora do schema Zod | `ErroSaidaEstruturada` | sim | erro de geração |

O tratamento de `ErroConfiguracaoIA` em `gerarEstruturado` já existe e já não retenta — a
mudança é apenas passar a *produzir* essa classe nos casos 401/402/403/404, que hoje chegariam
como falha genérica e queimariam três tentativas antes de reportar um problema que retentativa
nunca resolve.

**Log**: o cliente novo registra apenas `evento`, `status` HTTP, `motivo` normalizado e
`tentativa`. Nunca corpo da requisição, nunca corpo da resposta, nunca `usuarioId` junto de
conteúdo. O corpo de erro do provedor pode ecoar trecho do prompt — que contém relato do BP —,
então **ele não é logado**, apenas seu código. Isso é o Princípio I, e SC-006 é o que o verifica.

---

## R-07 — Duração de áudio e o teto de processamento

**Decisão**: manter o limite de 25 MB como está e **não** implementar segmentação de áudio nesta
feature.

**Racional**: o provedor tem teto de ~60 s de processamento upstream. Um relato falado de BP é
tipicamente de 1 a 3 minutos, o que deve caber; mas um áudio longo pode estourar e voltar como
timeout. O comportamento resultante já é aceitável: a rota devolve `TRANSCRICAO_FALHOU` com a
orientação "Você pode digitar o relato", e o rascunho do BP não se perde. Segmentar e recompor
transcrição é complexidade real (ordenação, sobreposição, junção de frases cortadas) para um caso
que ainda não sabemos ser frequente.

**A confirmar na implementação**: medir, nas amostras de SC-008, a duração a partir da qual o
timeout ocorre. Se ficar abaixo de ~3 minutos, isto vira item de escopo próprio — provavelmente
um aviso de duração na interface antes da segmentação.

---

## R-08 — Como os testes continuam rodando sem credencial (FR-014)

**Decisão**: preservar o padrão de injeção já existente e estendê-lo à transcrição.

`gerarEstruturado` recebe `ChamadorModelo` e `transcrever` recebe `TranscritorAudio` — ambos com
implementação padrão real e dublê nos testes. Esse desenho já isola a suíte do provedor e não
muda. O que muda é o que os dublês simulam:

- `saida-estruturada.test.ts`: o dublê passa a devolver a string de conteúdo já extraída, como
  hoje — a assinatura de `ChamadorModelo` não muda, então o teste segue válido com ajuste mínimo.
- `transcricao.test.ts`: o dublê deixa de devolver `{ texto, confiancaBaixa }` vindo do modelo e
  passa a devolver `{ texto, segundos }` vindo do provedor, com `confiancaBaixa` calculada pela
  nova função pura. Os cinco cenários existentes são preservados; ganham dois novos para a
  derivação de confiança.
- Dois arquivos novos, ambos sem rede: `provedor-openrouter.test.ts` (mapeamento HTTP → erro,
  com `fetch` dublado) e `schema-provedor.test.ts` (conversão Zod → JSON Schema estrito, sobre os
  cinco schemas reais de entrega).

---

## R-09 — O que esta feature deliberadamente não faz

Registrado para que o `/speckit-tasks` não expanda o escopo:

- **Não altera prompts** (`lib/agentes/*.md`) — Princípio IV, FR-006.
- **Não altera `lib/dominio/`** — os três controles constitucionais ficam intactos.
- **Não altera o schema do banco** — `Entrega.versaoModelo` já existe e já é gravado.
- **Não altera UI** — `GravadorRelato.tsx` e o contrato HTTP de `/api/transcricao` não mudam.
- **Não reprocessa entregas antigas** — elas mantêm o identificador do modelo Gemini.
- **Não implementa monitoramento de custo** nem alternância automática entre provedores.

---

## Fontes

- [OpenRouter — Structured Outputs](https://openrouter.ai/docs/features/structured-outputs)
- [OpenRouter — Provider Routing](https://openrouter.ai/docs/features/provider-routing)
- [OpenRouter — Privacy and Logging](https://openrouter.ai/docs/features/privacy-and-logging)
- [OpenRouter — Multimodal / Audio](https://openrouter.ai/docs/features/multimodal/audio)
- [OpenRouter — Transcription tutorial](https://openrouter.ai/blog/tutorials/transcription-on-openrouter/)
- [OpenRouter — deepseek/deepseek-v4-flash-0731](https://openrouter.ai/deepseek/deepseek-v4-flash-0731)
- [OpenRouter — mistralai/voxtral-mini-transcribe](https://openrouter.ai/mistralai/voxtral-mini-transcribe)
- [OpenRouter — `GET /api/v1/models`](https://openrouter.ai/api/v1/models) (confirmou
  `structured_outputs` entre os parâmetros suportados e contexto de 1.048.576 tokens)
