# Master BP

Assistentes especializados que orientam o Business Partner de RH na execução das suas
atividades. O BP descreve a demanda em linguagem natural, o app indica a especialidade adequada,
conduz o refinamento obrigatório e emite a entrega estruturada.

- **PRD**: [docs/prd.md](docs/prd.md)
- **Spec**: [specs/001-assistentes-bp/spec.md](specs/001-assistentes-bp/spec.md)
- **Plano**: [specs/001-assistentes-bp/plan.md](specs/001-assistentes-bp/plan.md)
- **Constituição**: [.specify/memory/constitution.md](.specify/memory/constitution.md)

## A decisão de arquitetura que sustenta o projeto

Três controles são avaliados **no servidor**, sobre o estado persistido, e não pelo modelo:

| Controle | Onde vive | Por quê |
|---|---|---|
| Portão de refinamento | [lib/dominio/portao-refinamento.ts](lib/dominio/portao-refinamento.ts) | SC-005 não admite entrega com lacuna crítica aberta |
| Detecção de risco jurídico | [lib/dominio/deteccao-risco.ts](lib/dominio/deteccao-risco.ts) | SC-004 não tolera falso negativo em escalonamento |
| Conformidade estrutural | [lib/assistentes/estruturas/](lib/assistentes/estruturas/) | SC-003 exige 100% das seções obrigatórias |

O modelo devolve `prontoParaEntrega` e uma classificação de risco — ambos tratados como
**sinal, não decisão**. Um prompt não é testável em unidade e não sobrevive à troca de modelo.

O comportamento de cada assistente vem dos prompts canônicos em
[lib/agentes/](lib/agentes/), lidos em tempo de execução e nunca
reescritos em código. O hash SHA-256 do prompt é gravado em cada atendimento: meses depois,
é possível saber com qual versão uma entrega foi produzida.

## Stack

TypeScript · Next.js 15 (App Router) · React 19 · Prisma + PostgreSQL · Zod · Auth.js ·
OpenRouter (DeepSeek V4 Flash + Voxtral Mini Transcribe) · Vitest · Playwright

## Setup

```powershell
npm install
Copy-Item .env.example .env

# Gerar os segredos:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # CHAVE_CRIPTO
npx auth secret                                                              # AUTH_SECRET

npx prisma migrate dev
npm run seed
npm run dev
```

BP de teste semeado: `bp@exemplo.com.br` / `MasterBP2026`.

### Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Banco SQLite local (`file:./dev.db`) |
| `OPENROUTER_API_KEY` | Chave do OpenRouter — provedor único de IA. **Só no servidor** — nunca prefixar com `NEXT_PUBLIC_` |
| `AUTH_SECRET` | Segredo de sessão do Auth.js |
| `CHAVE_CRIPTO` | 32 bytes em base64. Cifra relato, diálogo e entrega em repouso |
| `CRON_SECRET` | Protege a rota de retenção agendada |
| `OPENROUTER_MODELO_RAPIDO` / `OPENROUTER_MODELO_CAPAZ` | Opcionais — sobrescrevem o modelo de texto padrão (`deepseek/deepseek-v4-flash-0731`) |
| `OPENROUTER_MODELO_TRANSCRICAO` | Opcional — sobrescreve o modelo de transcrição padrão (`mistralai/voxtral-mini-transcribe`) |

Sem `CHAVE_CRIPTO` a aplicação não opera: o Princípio I não admite fase de carência.

### Política de dados no provedor (obrigatório)

Toda requisição envia `provider: { data_collection: "deny", zdr: true }`, restringindo o
roteamento a provedores que não armazenam o conteúdo. Isso **não basta sozinho**: nas
configurações de privacidade da conta OpenRouter é preciso desativar o roteamento para
provedores que treinam sobre os dados, **para modelos pagos e gratuitos**.

Atendimentos carregam relato de colaborador e áudio de voz. Enquanto esse passo não for feito, o
Princípio I não está satisfeito, por mais que o código faça a sua parte.

## Testes

```powershell
npm run test:unit          # domínio, schemas, cifragem, redação de log
npm run test:integration   # persistência, propriedade, auditoria, retenção, exportação
npm run test:risco         # regressão do Princípio III — portão de merge
npm run test:e2e           # Playwright, uma suíte por história
```

`npm run test:risco` é **portão de merge**: qualquer falso negativo na detecção de risco
reprova (SC-004).

## Rotina de retenção

Duas varreduras diárias ([lib/dados/retencao.ts](lib/dados/retencao.ts)):

1. encerra atendimentos sem interação há 90 dias (FR-018);
2. expurga atendimentos concluídos há mais de 24 meses (FR-026), preservando a trilha de
   auditoria anonimizada.

Agendar `POST /api/cron/retencao` com `Authorization: Bearer $CRON_SECRET`.

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/cron/retencao `
  -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

## Estrutura

```
app/            rotas e telas (App Router)
  api/          Route Handlers — contratos em specs/001-assistentes-bp/contracts/api.md
components/     componentes de UI
docs/           PRD e documentação de produto versionada
lib/
  agentes/      prompts canônicos (.md) — fonte única do comportamento, só leitura
  assistentes/  catálogo, carregador de prompts, schemas de entrega
  dominio/      controles constitucionais — testáveis sem servidor e sem modelo
  ia/           integração com o OpenRouter — cliente, saída estruturada, transcrição
  dados/        Prisma, cifragem, auditoria, retenção
  exportacao/   entrega → Markdown, DOCX, HTML de impressão
prisma/         schema e migrações
tests/          unit, integration, e2e, fixtures
```

## Restrições conhecidas

- **SQLite via Prisma** não suporta `enum` nem o tipo `Json`. Campos de valor restrito são
  `String` validados por união Zod; JSON é serializado em `String` e parseado na leitura. Isso
  mantém a migração futura para PostgreSQL barata.
- **Nenhum campo cifrado** pode ir para `where`, `orderBy` ou índice — filtros operam apenas
  sobre metadados em claro.
- **`console` é proibido** fora de [lib/observabilidade/logger.ts](lib/observabilidade/logger.ts),
  por regra de ESLint. O logger redige campos sensíveis antes de escrever.
