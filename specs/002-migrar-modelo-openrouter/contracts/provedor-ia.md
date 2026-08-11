# Contrato — camada de provedor de IA

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Research**: [research.md](../research.md)

Dois contratos, em direções opostas:

- **§1 — Interno**: a superfície que `lib/ia/openrouter.ts` oferece ao resto da aplicação. É o
  que os módulos consumidores podem depender.
- **§2 — Externo**: a forma exata das requisições ao provedor. É o que a implementação precisa
  produzir.

O contrato HTTP da aplicação (`/api/atendimentos`, `/api/transcricao`, …) **não muda**. Ver
[contracts/api.md da feature 001](../../001-assistentes-bp/contracts/api.md) — permanece válido.

---

## §1 — Contrato interno: `lib/ia/openrouter.ts`

Substitui `lib/ia/gemini.ts` preservando os nomes exportados, de modo que os consumidores mudem
apenas o caminho do import.

### Constantes de modelo

```ts
export const MODELO_RAPIDO: string;       // OPENROUTER_MODELO_RAPIDO ?? 'deepseek/deepseek-v4-flash-0731'
export const MODELO_CAPAZ: string;        // OPENROUTER_MODELO_CAPAZ ?? 'deepseek/deepseek-v4-flash-0731'
export const MODELO_TRANSCRICAO: string;  // OPENROUTER_MODELO_TRANSCRICAO ?? 'mistralai/voxtral-mini-transcribe'
```

### Erros

```ts
export class ErroConfiguracaoIA extends Error {  // name: 'ErroConfiguracaoIA' — NÃO retentar
  override name = 'ErroConfiguracaoIA';
}

export class ErroProvedorIA extends Error {      // name: 'ErroProvedorIA' — retentar
  override name = 'ErroProvedorIA';
  readonly status: number;
  readonly motivo: string;  // rótulo normalizado, sem conteúdo
}
```

### Chamadas

```ts
/** Chat completions. Devolve o conteúdo textual da primeira escolha. */
export function chamarChat(params: {
  modelo: string;
  instrucaoSistema: string;
  entrada: string;
  schemaProvedor?: unknown;   // ausente → response_format json_object
  temperatura: number;
}): Promise<string>;

/** Transcrição. Devolve o texto e a duração; NÃO decide sobre confiança. */
export function chamarTranscricao(params: {
  base64: string;
  formato: 'wav' | 'mp3' | 'flac' | 'm4a' | 'ogg' | 'webm' | 'aac';
}): Promise<{ texto: string; segundos: number }>;

/** Zera o cache de configuração. Usado apenas em teste. */
export function limparClienteCache(): void;
```

### Invariantes desta camada

1. **Não decide política de produto.** `chamarTranscricao` devolve texto e duração; quem decide
   se a confiança é baixa é `lib/ia/transcricao.ts`. Quem decide se a resposta é aceitável é o
   Zod em `saida-estruturada.ts`.
2. **Não loga conteúdo.** Nem corpo de requisição, nem corpo de resposta do provedor, nem texto
   transcrito, nem credencial. Só `evento`, `status`, `motivo`, `tentativa`, `modelo`.
3. **Não retenta.** A política de retentativa é de `gerarEstruturado`, que já a implementa. Esta
   camada apenas classifica o erro para que a de cima decida.
4. **`import 'server-only'`** no topo do módulo.

---

## §2 — Contrato externo: OpenRouter

Base: `https://openrouter.ai/api/v1`
Autenticação: `Authorization: Bearer ${OPENROUTER_API_KEY}`

Os cabeçalhos opcionais `HTTP-Referer` e `X-OpenRouter-Title` **não são enviados** (R-01).

### 2.1 `POST /chat/completions`

```jsonc
{
  "model": "deepseek/deepseek-v4-flash-0731",
  "messages": [
    { "role": "system", "content": "<prompt canônico + contrato de saída>" },
    { "role": "user",   "content": "<relato + refinamento>" }
  ],
  "temperature": 0.4,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "entrega",
      "strict": true,
      "schema": { /* dialeto estrito — ver §2.2 */ }
    }
  },
  "provider": { "data_collection": "deny", "zdr": true }
}
```

Resposta aproveitada: `choices[0].message.content` (string). Qualquer outra forma —
`content` ausente, `choices` vazio — é tratada como resposta inválida e entra na retentativa.

**`provider` é obrigatório em toda chamada.** É ele que materializa o Princípio I no código
(R-05); omiti-lo é uma regressão de confidencialidade, não uma otimização.

**`provider.require_parameters` NÃO é enviado** — a degradação de §2.3 é preferível a uma falha
de roteamento.

### 2.2 Dialeto do schema estrito

Obrigatório:

- `additionalProperties: false` em **todo** objeto;
- `required` contendo **todas** as propriedades do objeto;
- `$ref` e `$defs` resolvidos por inlining;
- nulos como `type: ["string", "null"]`, nunca `nullable: true`.

Proibido (removido na conversão, mantido apenas no Zod):

- `minLength`, `maxLength`, `minimum`, `maximum`, `minItems`, `maxItems`, `pattern`, `format`,
  `default`, `const`, `exclusiveMinimum`, `exclusiveMaximum`.

Exemplo — `saidaRoteamento`, o caso que exercita nulo e array:

```jsonc
{
  "type": "object",
  "additionalProperties": false,
  "required": ["sugestoes", "foraDeEscopo", "motivoRecusa"],
  "properties": {
    "sugestoes": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["assistenteId", "justificativa", "confianca"],
        "properties": {
          "assistenteId":  { "type": "string" },
          "justificativa": { "type": "string" },
          "confianca":     { "type": "number" }
        }
      }
    },
    "foraDeEscopo":  { "type": "boolean" },
    "motivoRecusa":  { "type": ["string", "null"] }
  }
}
```

Note o que **não** está aqui: `maxItems: 2` em `sugestoes`, `minLength: 10` em `justificativa`,
`minimum: 0` / `maximum: 1` em `confianca`. Essas regras continuam existindo — no Zod, que é
quem reprova a resposta.

### 2.3 Degradação quando `json_schema` é recusado

Gatilho: HTTP 400 cuja mensagem indique parâmetro ou modo não suportado.

Ação, **uma única vez por processo**:

1. registrar `ia.json_schema_indisponivel` (evento e modelo, nada mais);
2. marcar o modo degradado em memória;
3. reemitir com `response_format: { "type": "json_object" }` e o schema serializado ao final da
   instrução de sistema.

A validação Zod é idêntica nos dois modos. A degradação custa eficiência, não garantia.

### 2.4 `POST /audio/transcriptions`

```jsonc
{
  "model": "mistralai/voxtral-mini-transcribe",
  "input_audio": { "data": "<base64 puro, sem data: URI>", "format": "webm" },
  "language": "pt",
  "provider": { "data_collection": "deny", "zdr": true }
}
```

Resposta:

```jsonc
{ "text": "…", "usage": { "seconds": 9.2, "total_tokens": 113, "cost": 0.000508 } }
```

Restrições confirmadas na Fase 0:

- formatos: `wav, mp3, flac, m4a, ogg, webm, aac` — cobrem os 6 tipos MIME aceitos;
- tamanho: 25 MB, coincidente com `LIMITE_BYTES`;
- processamento upstream: ~60 s (R-07);
- **não** aceita instrução de sistema nem `response_format` de schema;
- **não** devolve campo de confiança — daí a derivação no servidor.

### 2.5 Mapeamento de status HTTP

| Status | Classe interna | Retenta | `motivo` |
|---|---|---|---|
| 400 (parâmetro não suportado) | — degradação §2.3 | 1× | `json_schema_indisponivel` |
| 400 (demais) | `ErroProvedorIA` | sim | `requisicao_invalida` |
| 401 / 403 | `ErroConfiguracaoIA` | **não** | `credencial_invalida` |
| 402 | `ErroConfiguracaoIA` | **não** | `sem_credito` |
| 404 | `ErroConfiguracaoIA` | **não** | `modelo_inexistente` |
| 429 | `ErroProvedorIA` | sim | `limite_requisicoes` |
| 5xx | `ErroProvedorIA` | sim | `falha_provedor` |
| timeout / rede | `ErroProvedorIA` | sim | `rede` |

O corpo de erro do provedor pode ecoar o prompt — que contém o relato do BP. Ele **não é
logado**; apenas o status e o `motivo` normalizado.

---

## §3 — Verificações que este contrato torna testáveis

| Verificação | Onde | Sem rede? |
|---|---|---|
| Conversão Zod → dialeto estrito, sobre os 5 schemas reais | `tests/unit/schema-provedor.test.ts` | sim |
| Cada status HTTP → classe de erro correta | `tests/unit/provedor-openrouter.test.ts` (`fetch` dublado) | sim |
| `provider.data_collection` e `zdr` presentes em toda requisição | idem | sim |
| Credencial ausente → `ErroConfiguracaoIA` sem retentativa | idem | sim |
| Nenhum conteúdo em log de falha | `tests/unit/vazamento-log.test.ts` (existente) + asserção no novo teste | sim |
| Derivação de `confiancaBaixa` | `tests/unit/transcricao.test.ts` | sim |
| MIME → `format` cobre os 6 tipos | idem | sim |
| Validação de áudio ocorre antes da chamada | idem (dublê não invocado) | sim |
