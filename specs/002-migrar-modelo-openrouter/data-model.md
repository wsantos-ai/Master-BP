# Phase 1 — Data Model: migração para o OpenRouter

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

**Nenhuma alteração no schema Prisma.** Esta feature não cria, remove nem altera tabela, coluna,
índice ou migração. As entidades abaixo são de configuração e de tempo de execução — vivem em
variáveis de ambiente e em tipos TypeScript, não no banco.

---

## 1. Configuração de provedor de IA

Entidade de ambiente. Lida uma única vez por processo, exclusivamente no servidor
(`import 'server-only'` em `lib/ia/openrouter.ts` faz o build falhar se vazar para o cliente).

| Campo | Origem | Obrigatório | Padrão | Validação |
|---|---|---|---|---|
| `apiKey` | `OPENROUTER_API_KEY` | sim | — | não-vazia; ausência → `ErroConfiguracaoIA` na primeira chamada |
| `modeloRapido` | `OPENROUTER_MODELO_RAPIDO` | não | `deepseek/deepseek-v4-flash-0731` | string não-vazia |
| `modeloCapaz` | `OPENROUTER_MODELO_CAPAZ` | não | `deepseek/deepseek-v4-flash-0731` | string não-vazia |
| `modeloTranscricao` | `OPENROUTER_MODELO_TRANSCRICAO` | não | `mistralai/voxtral-mini-transcribe` | string não-vazia |

**Regras**:

- A credencial é única para as duas rotas do provedor (chat e transcrição) — FR-015.
- Nenhuma variável pode ser prefixada com `NEXT_PUBLIC_`.
- Não há leitura de fallback para `GEMINI_*` (R-04): um ambiente meio migrado deve falhar alto.
- A credencial nunca aparece em log, mensagem de erro ou resposta HTTP.

**Estado**: a validação é preguiçosa (na primeira chamada), não no carregamento do módulo — do
contrário a suíte de testes, que nunca configura credencial, não conseguiria importar o módulo.

---

## 2. Requisição de geração estruturada

Objeto de tempo de execução, montado por `lib/ia/saida-estruturada.ts`. Não persiste.

| Campo | Tipo | Origem | Observação |
|---|---|---|---|
| `modelo` | string | `MODELO_RAPIDO` ou `MODELO_CAPAZ` | gravado em `Entrega.versaoModelo` quando a chamada é de entrega |
| `instrucaoSistema` | string | prompt canônico + contrato de saída | conteúdo de `lib/agentes/*.md`, inalterado |
| `entrada` | string | relato + refinamento do atendimento | **dado sensível** — nunca logado |
| `schemaProvedor` | JSON Schema estrito | derivado do Zod | orientação de formato, não contrato (R-02) |
| `temperatura` | number | 0.2 (roteamento) / 0.4 (entrega) / 0.5 (refinamento) | inalterado |
| `politicaDados` | objeto | fixo | `{ data_collection: "deny", zdr: true }` (R-05) |

**Invariante do Princípio V**: a resposta só é aceita após `schema.safeParse` do Zod. O schema
enviado ao provedor pode ser mais permissivo — nunca mais restritivo do que o Zod, e nunca
autoridade sobre a aceitação.

### 2.1 Conversão Zod → schema do provedor

Transformação pura em `paraSchemaDoProvedor()`, testável sem rede.

| Entrada (Zod / JSON Schema 7) | Saída (dialeto estrito) |
|---|---|
| objeto | mesmo objeto + `additionalProperties: false` |
| propriedades opcionais | todas listadas em `required` |
| `.nullable()` | `type: ["<tipo>", "null"]` |
| `$ref` / `$defs` | resolvidos por inlining |
| `.min()` / `.max()` em string, número e array | **removidos** — permanecem só no Zod |
| `.describe()` | preservado como `description` |

---

## 3. Resultado de transcrição

Objeto de tempo de execução em `lib/ia/transcricao.ts`. O áudio **não persiste em lugar algum**;
o texto só entra no banco depois que o BP o revisa e cria o atendimento.

### 3.1 Resposta bruta do provedor

| Campo | Tipo | Observação |
|---|---|---|
| `text` | string | transcrição literal; vazio quando não há fala audível |
| `usage.seconds` | number | duração do áudio processado |

### 3.2 Resultado devolvido à aplicação

Contrato **inalterado** em relação à feature 001 — a interface e a rota HTTP não mudam.

| Campo | Tipo | Como é produzido agora |
|---|---|---|
| `texto` | string | `text` do provedor, sem transformação |
| `confiancaBaixa` | boolean | **derivado no servidor** por função pura (R-03) |

**Regra de derivação** (`avaliarConfianca(texto, segundos)`):

1. `texto` vazio ou só espaços → não é baixa confiança, é **erro**: "não foi possível identificar
   fala no áudio" (comportamento preservado da feature 001).
2. densidade de fala abaixo do piso (caracteres por segundo de áudio) → `true`.
3. texto abaixo de um mínimo absoluto de caracteres → `true`.
4. caso contrário → `false`.

Limiares concretos calibrados na implementação contra as amostras de SC-008.

### 3.3 Validação de entrada (antes de qualquer chamada ao provedor)

Inalterada, e agora com garantia explícita em FR-015 de que ocorre **antes** da rede.

| Regra | Limite | Erro |
|---|---|---|
| tamanho > 0 | — | "Arquivo de áudio vazio." |
| tamanho ≤ 25 MB | `LIMITE_BYTES` | "Áudio acima do limite de 25 MB." |
| tipo MIME na lista aceita | 6 tipos | "Formato de áudio não suportado: <tipo>." |

**Mapa MIME → `format` do provedor** (R-03; cobertura total, nenhuma perda):

| MIME aceito | `format` |
|---|---|
| `audio/webm` | `webm` |
| `audio/ogg` | `ogg` |
| `audio/mpeg` | `mp3` |
| `audio/mp4` | `m4a` |
| `audio/x-m4a` | `m4a` |
| `audio/wav` | `wav` |

---

## 4. Erros da camada de IA

Hierarquia de tempo de execução. Determina se há retentativa e qual mensagem o BP vê.

| Classe | Novo? | Retenta | Situação |
|---|---|---|---|
| `ErroConfiguracaoIA` | não (movido de `gemini.ts`) | **não** | credencial ausente/inválida, sem crédito, modelo inexistente |
| `ErroProvedorIA` | **sim** | sim | 429, 5xx, timeout, falha de rede |
| `ErroSaidaEstruturada` | não | sim (até 3) | resposta não é JSON válido ou reprova no Zod |
| `ErroTranscricao` | não | não | áudio inválido, sem fala audível, falha na transcrição |

**Campos observáveis** (o que pode ir para log — SC-006):

| Campo | Exemplo | Contém dado sensível? |
|---|---|---|
| `evento` | `roteamento`, `entrega`, `transcricao` | não |
| `status` | `429` | não |
| `motivo` | `json_invalido`, `schema_reprovado`, `limite_requisicoes` | não |
| `tentativa` | `2` | não |
| `modelo` | `deepseek/deepseek-v4-flash-0731` | não |

**Proibido em log**: corpo da requisição, corpo da resposta do provedor (pode ecoar o prompt, que
contém o relato), texto transcrito, credencial.

---

## 5. Entidade persistida afetada: `Entrega`

Sem migração. Um único campo muda de **valor** — nunca de tipo ou de semântica.

| Campo | Antes | Depois |
|---|---|---|
| `versaoModelo` | `gemini-pro-latest` | `deepseek/deepseek-v4-flash-0731` |

**Regra de continuidade** (FR-008, SC-005): entregas anteriores à migração mantêm o identificador
antigo. Não há reprocessamento retroativo, e o campo é o que torna as duas gerações
distinguíveis em auditoria.
