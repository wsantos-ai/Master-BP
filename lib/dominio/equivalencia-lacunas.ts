/**
 * Equivalência entre perguntas de refinamento — Princípio II (feature 003, FR-005 e FR-006).
 *
 * O assistente propõe perguntas a cada rodada. Sem verificação, uma reformulação do que o BP já
 * respondeu vira pendência nova, com id novo, e o BP vê o assistente "esquecendo" o que foi dito.
 *
 * Esta camada é **lexical, não semântica**: pega repetição literal e quase literal. Paráfrase
 * genuína é responsabilidade da instrução ao assistente em `lib/ia/refinamento.ts` (research.md
 * R-02). O conjunto `tests/fixtures/pares-equivalencia/` fixa os dois lados dessa fronteira.
 *
 * **Assimetria de erro**: na dúvida, a pergunta é MANTIDA. Uma pendência a mais custa uma
 * pergunta ao BP; uma pendência descartada por engano custa uma entrega mal fundamentada — e o
 * Princípio II existe para impedir a segunda.
 */

/**
 * Calibrado contra `tests/fixtures/pares-equivalencia/` em 11/08/2026.
 *
 * Distribuição medida com a remoção de sufixo em vigor:
 *
 * - pares EQUIVALENTES: todos em 1,00 — o radical faz as flexões colapsarem por completo;
 * - pares DISTINTOS: máximo de 0,60, com UMA exceção em 0,857.
 *
 * A exceção é o par de negação ("quem batia a meta" × "quem NÃO batia a meta"), e ela só
 * sobrevive porque `saoEquivalentes` bloqueia negação assimétrica ANTES de olhar o índice.
 * Sem essa regra, nenhum limiar utilizável separaria os dois — e fundir esses dois públicos
 * produziria uma entrega sobre as pessoas erradas.
 *
 * Descontada a negação, a folga vai de 0,60 a 1,00. 0,80 é o meio dessa faixa: margem máxima
 * dos dois lados. Deliberadamente NÃO escolhi o menor valor que ainda separa o conjunto —
 * colar em 0,61 ajustaria o limiar às fixtures e, pela assimetria de erro (descartar pergunta
 * legítima custa mais que manter uma a mais), o risco deve ficar do lado alto.
 */
export const LIMIAR_EQUIVALENCIA = 0.8;

/** Abaixo disto, o radical perde identidade e passa a casar com qualquer coisa. */
const TAMANHO_MINIMO_RADICAL = 4;

/**
 * Palavras sem carga de conteúdo.
 *
 * Note o que NÃO está aqui, e por quê:
 *
 * - `quem`, `quando`, `onde`, `quanto(s)`, `como` — carregam a distinção entre pedidos. "Quem
 *   comunica?" e "Quando comunica?" pedem coisas diferentes: responsável e prazo, os dois campos
 *   que o plano de ação exige (Princípio V). Descartá-los fundiria as duas perguntas.
 * - `nao`, `nem`, `sem` — negação inverte o público. "Quem batia a meta" e "quem NÃO batia a
 *   meta" são populações opostas; tratá-las como a mesma pergunta produziria uma entrega sobre
 *   as pessoas erradas. Ver também `temNegacao`.
 */
const PALAVRAS_VAZIAS = new Set([
  // artigos e contrações
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas',
  'ao', 'aos', 'pelo', 'pela', 'pelos', 'pelas',
  'deste', 'desta', 'desse', 'dessa', 'daquele', 'daquela',
  // preposições e conjunções
  'de', 'em', 'para', 'por', 'com', 'sobre', 'entre', 'ate', 'desde',
  'e', 'ou', 'mas', 'que', 'se', 'ja', 'tambem', 'apenas', 'so',
  // pronomes
  'ele', 'ela', 'eles', 'elas', 'seu', 'sua', 'seus', 'suas',
  'este', 'esta', 'esse', 'essa', 'isso', 'isto', 'aquele', 'aquela',
  // interrogativos sem carga (ao contrário de quem/quando/onde/quanto/como)
  'qual', 'quais',
  // verbos auxiliares
  'e', 'sao', 'era', 'eram', 'foi', 'for', 'fosse', 'seja', 'sera', 'serao', 'ser',
  'esta', 'estao', 'estava', 'estar', 'estao',
  'vai', 'vao', 'ira', 'irao', 'ir',
  'ha', 'houve', 'haver', 'tem', 'tinha', 'ter',
  'pode', 'podem', 'deve', 'devem',
]);

/** Sufixos removidos do mais longo para o mais curto — o primeiro que couber é aplicado. */
const SUFIXOS = [
  'issimo', 'issima', 'mente',
  'aram', 'eram', 'iram', 'ando', 'endo', 'indo',
  'ados', 'adas', 'idos', 'idas', 'coes',
  'ado', 'ada', 'ido', 'ida', 'cao',
  'ar', 'er', 'ir', 'ou', 'am', 'em', 'es', 's',
];

/**
 * Remoção de sufixo em vez de lematização de verdade. É grosseiro e resolve o que precisa
 * resolver: "afetadas"/"afetar" e "validou"/"validada" passam a casar. Radical irregular
 * ("reagiu"/"reação") continua fora de alcance, e isso está documentado, não escondido.
 */
function radical(palavra: string): string {
  for (const sufixo of SUFIXOS) {
    if (palavra.length - sufixo.length >= TAMANHO_MINIMO_RADICAL && palavra.endsWith(sufixo)) {
      return palavra.slice(0, -sufixo.length);
    }
  }
  return palavra;
}

/** Reduz a pergunta ao conjunto de radicais de conteúdo. Exportada para teste. */
export function normalizar(texto: string): Set<string> {
  const palavras = texto
    .toLowerCase()
    .normalize('NFD')
    // Remove os diacríticos que a decomposição separou.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ');

  const conteudo = new Set<string>();
  for (const palavra of palavras) {
    if (palavra.length < 2 || PALAVRAS_VAZIAS.has(palavra)) continue;
    conteudo.add(radical(palavra));
  }
  return conteudo;
}

const NEGACOES = new Set(['nao', 'nem', 'sem', 'nunca', 'jamais']);

function temNegacao(conjunto: Set<string>): boolean {
  for (const palavra of conjunto) {
    if (NEGACOES.has(palavra)) return true;
  }
  return false;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersecao = 0;
  for (const item of a) {
    if (b.has(item)) intersecao += 1;
  }
  const uniao = a.size + b.size - intersecao;
  return uniao === 0 ? 0 : intersecao / uniao;
}

export function saoEquivalentes(a: string, b: string): boolean {
  const conjuntoA = normalizar(a);
  const conjuntoB = normalizar(b);

  // Sem palavras de conteúdo não há o que comparar. Duas perguntas vazias de conteúdo não são
  // "iguais" — são indeterminadas, e indeterminado resolve pela manutenção.
  if (conjuntoA.size === 0 || conjuntoB.size === 0) return false;

  // Negação de um lado só: mesmo com sobreposição alta, o público é outro.
  if (temNegacao(conjuntoA) !== temNegacao(conjuntoB)) return false;

  return jaccard(conjuntoA, conjuntoB) >= LIMIAR_EQUIVALENCIA;
}

/**
 * Separa as propostas do assistente em aceitas e descartadas.
 *
 * Compara contra as perguntas já existentes no atendimento — abertas, respondidas e não
 * aplicáveis (FR-005) — e contra as propostas já aceitas nesta mesma rodada (FR-006).
 *
 * Devolve a CONTAGEM de descartadas, nunca o texto: assim não existe caminho pelo qual uma
 * pergunta descartada chegue a um log (Princípio I, FR-012).
 */
export function filtrarPropostas<T extends { pergunta: string }>(
  propostas: T[],
  perguntasExistentes: string[],
): { aceitas: T[]; descartadas: number } {
  const aceitas: T[] = [];
  const comparar = [...perguntasExistentes];

  for (const proposta of propostas) {
    if (comparar.some((existente) => saoEquivalentes(proposta.pergunta, existente))) continue;

    aceitas.push(proposta);
    comparar.push(proposta.pergunta);
  }

  return { aceitas, descartadas: propostas.length - aceitas.length };
}
