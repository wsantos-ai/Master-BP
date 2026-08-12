# Contrato — laço de refinamento

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Research**: [research.md](../research.md)

Três contratos:

- **§1** — funções puras de domínio (`lib/dominio/`), onde as decisões passam a morar
- **§2** — orquestração da rodada, na rota
- **§3** — contrato HTTP, e o que nele muda

O contrato HTTP de `POST /api/atendimentos/[id]/mensagens` mantém a mesma forma de resposta. Ver
[contracts/api.md da feature 001](../../001-assistentes-bp/contracts/api.md) — segue válido, com
a ressalva de §3.

---

## §1 — Funções puras de domínio

### 1.1 `lib/dominio/equivalencia-lacunas.ts`

```ts
export const LIMIAR_EQUIVALENCIA = 0.8;

/** Minúsculas, sem acento, sem pontuação, sem palavras vazias. Exportada para teste. */
export function normalizar(texto: string): Set<string>;

/** Jaccard sobre palavras de conteúdo, comparado ao limiar. */
export function saoEquivalentes(a: string, b: string): boolean;

/**
 * Separa as propostas em aceitas e descartadas, comparando contra as existentes E contra as
 * já aceitas nesta mesma rodada (FR-005, FR-006).
 */
export function filtrarPropostas<T extends { pergunta: string }>(
  propostas: T[],
  perguntasExistentes: string[],
): { aceitas: T[]; descartadas: number };
```

**Invariantes**:

1. **Pura**: sem I/O, sem rede, sem estado, sem `Date`. Mesma entrada, mesma saída.
2. **Conservadora**: em caso de empate ou ambiguidade, a proposta é **aceita**. Descartar por
   engano custa mais que manter (R-02).
3. **Devolve contagem, não conteúdo**: `descartadas` é um número. As perguntas descartadas não
   saem da função, para que não haja caminho pelo qual cheguem a um log.
4. **Não conhece lacuna, banco nem modelo**: opera sobre strings.

### 1.2 `lib/dominio/resolucao-aproveitada.ts`

```ts
export type SinalResolucao = { lacunaId: string };

export type LacunaConhecida = {
  id: string;
  estado: EstadoLacuna;
  resposta: string | null;
  justificativaNaoAplicavel: string | null;
};

/**
 * Decide quais lacunas o sinal do modelo pode fechar. NÃO escreve nada.
 *
 * `conteudoDoBp` é a resposta que o BP acabou de dar. Vazia → nenhuma lacuna é aproveitada,
 * independentemente do que o modelo afirme (FR-002).
 */
export function aproveitarResolucoes(params: {
  sinais: SinalResolucao[];
  lacunasDoAtendimento: LacunaConhecida[];
  lacunaRespondidaDiretamente: string | null;
  conteudoDoBp: string;
}): { idsParaFechar: string[]; ignorados: number };
```

**Invariantes** — esta é a função que sustenta a US3:

1. **Sem conteúdo do BP, devolve lista vazia.** É a garantia de FR-002: o sinal do modelo é
   evidência de que uma resposta cobre uma pendência, nunca substituto da resposta.
2. **Só devolve id presente em `lacunasDoAtendimento`.** Id desconhecido ou de outro atendimento
   entra em `ignorados` (FR-003).
3. **Nunca devolve lacuna já resolvida** nem a que o BP respondeu diretamente.
4. **Não escreve.** Quem persiste é a camada de dados; quem decide é esta função.

### 1.3 `lib/dominio/portao-refinamento.ts` (alterado)

```ts
export const LIMITE_APRESENTADAS = 3;

export type AvaliacaoPortao = {
  liberada: boolean;              // sobre TODAS as críticas não resolvidas
  apresentadas: LacunaPendente[]; // as até 3 primeiras, por ordem
  totalCriticasAbertas: number;   // apresentadas + em fila
  totalAbertas: number;           // inalterado
  totalResolvidas: number;        // inalterado
};
```

**A linha que não pode ser cruzada** (FR-014): `LIMITE_APRESENTADAS` participa **exclusivamente**
do cálculo de `apresentadas`. Se ele aparecer em qualquer expressão que produza `liberada`, o
Princípio II está quebrado — pendência fora da tela não é pendência resolvida.

`lacunaResolvida()`, `podeEmitirEntrega()`, `proximaPergunta()`, `reconciliarComSinalDoModelo()`
e `proximaOrdem()` permanecem **sem alteração de comportamento**. `pendentes` é renomeado para
`apresentadas` e passa a ser limitado.

---

## §2 — Orquestração da rodada

Ordem obrigatória em `POST /api/atendimentos/[id]/mensagens`. Cada passo depende do anterior.

```text
1. Persistir a resposta direta do BP        → origemFechamento = 'resposta_direta'
2. Registrar a mensagem do BP
3. Carregar as lacunas do atendimento (decifradas)
4. Chamar o assistente (conduzirRefinamento)
5. aproveitarResolucoes(...)                → fecha as aproveitadas com o conteúdo do BP
6. Recarregar lacunas                        ← passo 5 mudou o estado
7. filtrarPropostas(novasLacunas, perguntas existentes)
8. Persistir apenas as aceitas
9. detectarRisco(textoDoBp, ...)             ← INALTERADO, sobre a resposta integral
10. Recarregar e avaliarPortao(...)
11. Emitir o evento de observabilidade (só contagens)
12. Responder com `apresentadas`
```

**Por que 5 antes de 7**: uma proposta pode ser equivalente a uma lacuna que acabou de ser
fechada por aproveitamento. Deduplicar antes de aplicar as resoluções deixaria passar a repetição
justamente do caso que o sinal do modelo resolveu.

**Por que 9 permanece onde está e como está**: `detectarRisco` recebe o texto integral da
resposta do BP. Nada nesta feature pode reduzir, filtrar ou normalizar esse texto antes dele —
Princípio III.

**Na criação do atendimento** (`POST /api/atendimentos`): apenas os passos 7 e 8, com o conjunto
de perguntas existentes vazio (R-05).

---

## §3 — Contrato HTTP

### 3.1 O que muda

`POST /api/atendimentos/[id]/mensagens` e `POST /api/atendimentos` continuam devolvendo o campo
`lacunasAbertas`, com a mesma forma (`{ id, pergunta, porQueImporta }[]`).

**A única mudança**: o array passa a ter **no máximo 3 elementos**. Antes vinham todas as
críticas abertas.

Nenhum campo é adicionado, removido ou renomeado. `prontoParaEntrega` continua refletindo
`liberada` — computado sobre todas as críticas, não só as enviadas.

### 3.2 O que a interface faz com isso

Nada de novo. [PainelLacunas.tsx](../../../components/atendimento/PainelLacunas.tsx) já exibe
`lacunas[0]` como pergunta ativa, mostra `Ainda falta responder (N)` no cabeçalho e esconde as
demais atrás de um `<details>`. Com no máximo 3 no payload, o contador para de crescer e a lista
oculta fica curta — sem alterar uma linha de componente.

A fila não é exposta: o BP não vê "3 de 7". Para ele, as perguntas simplesmente vão chegando.

### 3.3 Recusa de entrega

`POST /api/atendimentos/[id]/entrega` continua recusando enquanto houver crítica aberta —
incluindo as em fila — e continua devolvendo as pendências que faltam. Passa a devolver as até 3
apresentadas, pela mesma razão de legibilidade.

---

## §4 — Verificações que este contrato torna testáveis

| Verificação | Onde | Sem rede? |
|---|---|---|
| Normalização: acento, caixa, pontuação, palavras vazias | `tests/unit/equivalencia-lacunas.test.ts` | sim |
| "prazo para comunicar" ≠ "prazo para implementar" | idem | sim |
| Equivalência entre propostas da mesma rodada | idem | sim |
| Na dúvida, mantém | idem, com o conjunto de pares de calibração | sim |
| Sem conteúdo do BP → nenhuma lacuna aproveitada | `tests/unit/resolucao-aproveitada.test.ts` | sim |
| Id de outro atendimento → ignorado, sem erro | idem | sim |
| Modelo declara tudo resolvido → não resolvidas seguem abertas | idem | sim |
| `liberada` ignora o limite de 3 | `tests/unit/portao-refinamento.test.ts` | sim |
| `apresentadas` nunca passa de 3 | idem | sim |
| Retomada devolve as mesmas 3, na mesma ordem | idem | sim |
| Convergência ao longo de rodadas sobre estado persistido | `tests/integration/refinamento-convergencia.test.ts` | sim |
| Log da rodada não contém texto | idem + `tests/unit/vazamento-log.test.ts` | sim |
