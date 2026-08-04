/**
 * Vedação de medida punitiva sem fatos apurados — FR-013, Princípio III.
 *
 * O prompt canônico de compliance já proíbe isso ("Nunca sugira medidas punitivas sem
 * embasamento em fatos apurados e documentados"). Aqui a proibição vira verificação: se o plano
 * de ação propõe punição e o atendimento não registrou fatos, a entrega é rejeitada.
 *
 * O agente aconselha; a decisão disciplinar é humana e exige prova. Confundir os dois papéis é
 * exatamente o que a constituição impede.
 */

const TERMOS_PUNITIVOS = [
  /advert[êe]ncia/i,
  /suspens[ãa]o\s+disciplinar/i,
  /demiss[ãa]o/i,
  // Também a forma verbal: "demitir o supervisor" é tão punitivo quanto "demissão do supervisor".
  /demit(?:ir|iu|ida?|indo)/i,
  /desligament[o]|deslig(?:ar|ou)\s+(?:o|a)\s/i,
  /afastament[o]\s+(?:disciplinar|punitivo)/i,
  /justa\s+causa/i,
  /rescis[ãa]o\s+(?:do\s+)?contrat/i,
  /puni(?:ç[ãa]o|r|tiv[oa])/i,
  /medida\s+disciplinar/i,
  /sanç[ãa]o/i,
];

export type ItemAcao = { acao: string; responsavel: string; prazo: string };

export function ehMedidaPunitiva(acao: string): boolean {
  return TERMOS_PUNITIVOS.some((termo) => termo.test(acao));
}

export function itensPunitivos(plano: ItemAcao[]): ItemAcao[] {
  return plano.filter((item) => ehMedidaPunitiva(item.acao));
}

export type ResultadoVedacao =
  | { permitido: true }
  | { permitido: false; motivo: string; itens: string[] };

/**
 * `fatosRegistrados` vem das respostas do BP no refinamento: sem lacuna respondida com
 * apuração, não há fato documentado no atendimento.
 */
export function avaliarVedacaoPunitiva(params: {
  planoAcao: ItemAcao[];
  fatosRegistrados: boolean;
}): ResultadoVedacao {
  const punitivos = itensPunitivos(params.planoAcao);

  if (punitivos.length === 0) return { permitido: true };
  if (params.fatosRegistrados) return { permitido: true };

  return {
    permitido: false,
    motivo:
      'O plano de ação propõe medida disciplinar, mas o atendimento não registrou fatos apurados ' +
      'e documentados. Conclua a apuração antes de recomendar qualquer punição.',
    itens: punitivos.map((i) => i.acao),
  };
}

/**
 * Considera que há fatos apurados quando ao menos uma lacuna crítica foi respondida com
 * conteúdo substantivo — não bastam respostas vazias ou "não sei".
 */
const RESPOSTAS_VAZIAS = /^(n[ãa]o sei|sem informaç[ãa]o|n[ãa]o tenho|nada|n\/?a)\.?$/i;

export function haFatosApurados(respostas: (string | null)[]): boolean {
  return respostas.some((r) => {
    const texto = (r ?? '').trim();
    return texto.length >= 20 && !RESPOSTAS_VAZIAS.test(texto);
  });
}
