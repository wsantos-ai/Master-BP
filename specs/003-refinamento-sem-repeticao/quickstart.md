# Quickstart — Validação do refinamento sem repetição

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
| **Contrato**: [contracts/refinamento.md](./contracts/refinamento.md) | **Pesquisa**: [research.md](./research.md)

Guia para provar que o refinamento parou de repetir e passou a convergir. Cenários mapeados aos
critérios de sucesso. Detalhes de função e schema ficam nos artefatos linkados.

## Pré-requisitos

- A aplicação das features 001 e 002 funcionando, com `OPENROUTER_API_KEY` configurada
- Banco PostgreSQL acessível
- Node.js 20 LTS

## Setup

```powershell
npx prisma migrate dev    # aplica a coluna origemFechamento
npm run dev
```

Nenhuma variável de ambiente nova. O limite de 3 e o limiar de equivalência são constantes de
código, ajustáveis em um ponto só.

## Comandos de verificação

```powershell
npm run test:unit          # equivalência, aproveitamento, portão
npm run test:integration   # convergência ao longo de rodadas, sobre estado persistido
npm run test:risco         # portão de merge — deve permanecer 100% verde
npm run test:e2e           # Playwright
```

Toda a suíte roda sem credencial de provedor: as três correções são funções puras e a rodada é
exercitada com dublê.

---

## Cenários

### Cenário 1 — O caso que originou a feature (US1, US2, SC-009)

Abrir um atendimento com o relato original:

> "Preciso comunicar à equipe comercial que o modelo de comissionamento muda no dia 1º do mês que
> vem. A parte fixa sobe, mas o acelerador que eles tinham acima de 120% da meta acaba. Na
> prática, quem batia muito a meta vai ganhar menos. São 24 pessoas e a notícia vai gerar reação.
> O diretor quer que saia por e-mail ainda esta semana."

Responder cada pergunta com conteúdo distinto e verificável, até o portão liberar.

**Esperado**: nenhuma pergunta pede informação já fornecida; o contador `Ainda falta responder`
nunca passa de 3; o refinamento termina. Anotar o número de rodadas — SC-003 admite até 8.

### Cenário 2 — Não reperguntar o que foi respondido (US1, SC-001)

Durante o cenário 1, a cada rodada, conferir a pergunta ativa e a lista atrás de "Ver as outras
pendências".

**Esperado**: zero perguntas pedindo informação já dada, literalmente ou em paráfrase.

Repetir em 10 atendimentos de temas variados. **Este cenário não é substituível por teste
unitário**: a camada determinística pega repetição quase literal, mas a paráfrase depende do
assistente (R-02). É aqui que se descobre se a instrução de FR-008 está funcionando.

### Cenário 3 — Convergência (US2, SC-002)

Ao longo do cenário 1, registrar por rodada o campo `criticas_abertas` do evento de
observabilidade.

**Esperado**: série não crescente após a primeira rodada. Se subir, a deduplicação está frouxa ou
o assistente está abrindo pendências novas para continuar perguntando.

### Cenário 4 — O teto de 3 e a fila (US2, SC-004, FR-007)

Provocar um relato amplo, que gere mais de 3 pendências críticas.

**Esperado**: no máximo 3 no payload e no contador; ao responder uma, a próxima aparece. O BP não
vê a fila como conceito — as perguntas simplesmente vão chegando.

### Cenário 5 — A fila continua bloqueando (US3, SC-010, FR-014)

Com pendências em fila, resolver **apenas** as 3 apresentadas e tentar emitir a entrega final.

**Esperado**: a entrega é **recusada**. Este é o cenário mais importante do quickstart: se a
entrega sair aqui, o limite de apresentação vazou para dentro da decisão do portão e o Princípio
II está quebrado.

### Cenário 6 — O portão resiste a um assistente mentiroso (US3, SC-005)

Coberto por teste, sem provedor:

```powershell
npm run test:unit
```

**Esperado**: um assistente que declara resolvidas todas as lacunas — inclusive as nunca
respondidas — não fecha nenhuma sem conteúdo de resposta registrado, e o portão segue bloqueando.

### Cenário 7 — Rastreabilidade da origem (US3, SC-006)

Após concluir um atendimento em que uma resposta cobriu duas pendências, consultar as linhas em
`lacunas`.

**Esperado**: toda lacuna fechada por resposta tem `origemFechamento` preenchido, distinguindo
`resposta_direta` de `aproveitada`. Lacunas anteriores à implantação permanecem nulas — é
informação honesta, não falha.

### Cenário 8 — Retomada estável (FR-015, SC-011)

Interromper um atendimento com pendências em fila e reabri-lo.

**Esperado**: as mesmas 3 perguntas, na mesma ordem.

### Cenário 9 — Perguntas parecidas mas distintas (Edge case, US1)

Provocar um caso com prazos diferentes — comunicar versus implementar — e conferir que **as duas**
perguntas sobrevivem.

**Esperado**: ambas presentes. Descartar informação legítima é pior que manter uma pendência a
mais; se este cenário falhar, o limiar está agressivo demais e precisa subir.

### Cenário 10 — Log sem conteúdo (SC-007)

Inspecionar os registros de uma execução completa do cenário 1.

**Esperado**: apenas contagens. Nenhum texto de pergunta, resposta, relato ou nome de pessoa.

### Cenário 11 — Risco preservado (Princípio III)

```powershell
npm run test:risco
```

Complementar relatando, dentro do refinamento, uma situação de assédio.

**Esperado**: 100% verde, e a recomendação de escalonamento aparece. A detecção continua recebendo
o texto integral da resposta — nada nesta feature pode filtrá-lo antes.

---

## Checagem final

- [ ] `git diff --stat lib/agentes/ components/` vazio — Princípio IV e "sem mudança de interface"
- [ ] `detectarRisco` recebe o texto integral, sem normalização prévia
- [ ] `LIMITE_APRESENTADAS` não aparece em nenhuma expressão que produza `liberada`
- [ ] Uma única migração nova, com a coluna nullable e sem backfill
- [ ] Nenhuma dependência nova em `package.json`
