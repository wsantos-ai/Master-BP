import type { InstanciaEscalonamento, OrigemDeteccao, TipoRisco } from '@/lib/validacao/comum';

/**
 * Detecção de risco jurídico — Princípio III (research.md R-05).
 *
 * Duas camadas, unidas por OU:
 *   (a) regras determinísticas sobre o texto, aqui;
 *   (b) classificação do modelo, que chega pelo campo `risco` da saída estruturada.
 *
 * Basta UMA sinalizar. SC-004 não tolera falso negativo, e as duas camadas falham de formas
 * diferentes: a regra é cega a paráfrase e eufemismo — comuns em relato de RH, onde ninguém
 * escreve "isto é assédio"; o modelo é não determinístico. Juntas, cobrem o vão uma da outra.
 *
 * Falso positivo aqui custa uma recomendação a mais de consultar o jurídico. Falso negativo
 * custa o dano que a constituição existe para evitar. A assimetria justifica a sensibilidade.
 */

export type SinalRisco = {
  tipoRisco: TipoRisco;
  instanciaRecomendada: InstanciaEscalonamento;
  origemDeteccao: OrigemDeteccao;
  trechoGatilho: string | null;
};

/** Riscos cuja gravidade jurídica exige o jurídico, não Compliance ou RT. */
const SEMPRE_JURIDICO: TipoRisco[] = ['assedio_sexual', 'discriminacao', 'fraude'];

const INSTANCIA_PADRAO: Record<TipoRisco, InstanciaEscalonamento> = {
  assedio_moral: 'compliance',
  assedio_sexual: 'juridico',
  discriminacao: 'juridico',
  fraude: 'juridico',
  justa_causa: 'relacoes_trabalhistas',
  acao_trabalhista: 'juridico',
  dado_sensivel: 'compliance',
};

export function instanciaPara(tipo: TipoRisco): InstanciaEscalonamento {
  return SEMPRE_JURIDICO.includes(tipo) ? 'juridico' : INSTANCIA_PADRAO[tipo];
}

/**
 * Padrões em pt-BR. Cobrem o vocabulário explícito e as formulações mais frequentes.
 * O que escapa daqui é justamente o que a camada do modelo existe para pegar.
 */
const PADROES: { tipo: TipoRisco; regex: RegExp }[] = [
  // Assédio moral
  { tipo: 'assedio_moral', regex: /ass[ée]dio\s+moral/i },
  { tipo: 'assedio_moral', regex: /humilha(?:ç[ãa]o|r|ndo|do|da)\b/i },
  { tipo: 'assedio_moral', regex: /constrangiment[o]\s+(?:p[úu]blico|reiterado)/i },
  { tipo: 'assedio_moral', regex: /perseguiç[ãa]o\s+(?:no\s+trabalho|do\s+gestor|da\s+chefia)/i },
  { tipo: 'assedio_moral', regex: /expor?\s+(?:o\s+)?colaborador\s+(?:ao\s+)?ridículo/i },
  { tipo: 'assedio_moral', regex: /grit(?:a|ou|ando)\s+com\s+(?:a\s+equipe|o\s+colaborador)/i },

  // Assédio sexual
  { tipo: 'assedio_sexual', regex: /ass[ée]dio\s+sexual/i },
  { tipo: 'assedio_sexual', regex: /cantada|insinuaç(?:ão|ões)\s+sexual/i },
  { tipo: 'assedio_sexual', regex: /convite[s]?\s+(?:insistente|constrangedor)/i },
  { tipo: 'assedio_sexual', regex: /toque[s]?\s+(?:indesejad|sem\s+consentimento)/i },
  { tipo: 'assedio_sexual', regex: /import[uú]n(?:aç[ãa]o|ar|ou)\s+sexual/i },

  // Discriminação
  // Cobre discriminação, discriminatório/discriminatória, discriminar, discriminando.
  { tipo: 'discriminacao', regex: /discrimina(?:ç[ãa]o|t[óo]ri[oa]s?|r|ndo|d[oa]s?)/i },
  { tipo: 'discriminacao', regex: /racism[o]|racist[ao]|injúria\s+racial/i },
  { tipo: 'discriminacao', regex: /homofobi|transfobi|lgbtfobi/i },
  { tipo: 'discriminacao', regex: /machism[o]|misogini/i },
  { tipo: 'discriminacao', regex: /capacitism[o]|xenofobi|etarism[o]/i },
  { tipo: 'discriminacao', regex: /preconceit[o]\s+(?:racial|de\s+g[êe]nero|religioso)/i },

  // Fraude
  { tipo: 'fraude', regex: /fraude|fraudulent/i },
  { tipo: 'fraude', regex: /desvi[o]\s+(?:de\s+)?(?:recurso|verba|dinheiro|mercadoria)/i },
  { tipo: 'fraude', regex: /falsifica(?:ç[ãa]o|r|ndo|do)/i },
  { tipo: 'fraude', regex: /corrupç[ãa]o|propina|suborno/i },
  { tipo: 'fraude', regex: /apropriaç[ãa]o\s+indébita|furt[o]\s+interno/i },

  // Justa causa
  { tipo: 'justa_causa', regex: /just[a]\s+causa/i },
  { tipo: 'justa_causa', regex: /demiss[ãa]o\s+por\s+justa\s+causa/i },
  { tipo: 'justa_causa', regex: /dispensa\s+motivada/i },
  { tipo: 'justa_causa', regex: /falta\s+grave/i },

  // Ação trabalhista
  { tipo: 'acao_trabalhista', regex: /aç[ãa]o\s+trabalhista|reclamat[óo]ria/i },
  { tipo: 'acao_trabalhista', regex: /process(?:o|ar)\s+(?:a\s+empresa|na\s+justiça)/i },
  { tipo: 'acao_trabalhista', regex: /advogad[oa]\s+(?:do\s+colaborador|trabalhista)/i },
  { tipo: 'acao_trabalhista', regex: /rescis[ãa]o\s+indireta/i },
  { tipo: 'acao_trabalhista', regex: /sindicato\s+(?:acionou|notificou)|minist[ée]rio\s+p[úu]blico\s+do\s+trabalho|\bmpt\b/i },
  { tipo: 'acao_trabalhista', regex: /hora[s]?\s+extra[s]?\s+n[ãa]o\s+pag/i },

  // Dado pessoal sensível
  { tipo: 'dado_sensivel', regex: /\blgpd\b|dado[s]?\s+(?:pessoal|sens[íi]ve)/i },
  { tipo: 'dado_sensivel', regex: /atestado\s+m[ée]dico|laudo\s+m[ée]dico|prontu[áa]rio/i },
  { tipo: 'dado_sensivel', regex: /diagn[óo]stic[o]|cid\s+\d|afastament[o]\s+(?:pelo\s+)?inss/i },
  { tipo: 'dado_sensivel', regex: /orientaç[ãa]o\s+sexual|religi[ãa]o\s+d[oa]\s+colaborador/i },
  { tipo: 'dado_sensivel', regex: /dados?\s+de\s+sa[úu]de/i },
];

/** Recorta o entorno do trecho que disparou a regra, para a evidência da sinalização. */
function recortar(texto: string, indice: number, tamanho = 160): string {
  const inicio = Math.max(0, indice - tamanho / 2);
  const fim = Math.min(texto.length, indice + tamanho / 2);
  return `${inicio > 0 ? '…' : ''}${texto.slice(inicio, fim).trim()}${fim < texto.length ? '…' : ''}`;
}

/** Camada (a): regras determinísticas. */
export function detectarPorRegra(texto: string): SinalRisco[] {
  const encontrados = new Map<TipoRisco, SinalRisco>();

  for (const { tipo, regex } of PADROES) {
    if (encontrados.has(tipo)) continue;
    const achado = regex.exec(texto);
    if (!achado) continue;

    encontrados.set(tipo, {
      tipoRisco: tipo,
      instanciaRecomendada: instanciaPara(tipo),
      origemDeteccao: 'regra',
      trechoGatilho: recortar(texto, achado.index),
    });
  }

  return [...encontrados.values()];
}

/** Camada (b): classificação do modelo, já validada pelo schema da saída estruturada. */
export function sinaisDoModelo(tipos: TipoRisco[]): SinalRisco[] {
  return tipos.map((tipo) => ({
    tipoRisco: tipo,
    instanciaRecomendada: instanciaPara(tipo),
    origemDeteccao: 'modelo' as OrigemDeteccao,
    trechoGatilho: null,
  }));
}

/**
 * União das duas camadas. Concordância vira `ambos`; discordância NÃO anula ninguém —
 * cada camada sozinha basta para sinalizar.
 */
export function unirSinais(porRegra: SinalRisco[], porModelo: SinalRisco[]): SinalRisco[] {
  const unido = new Map<TipoRisco, SinalRisco>();

  for (const sinal of porRegra) {
    unido.set(sinal.tipoRisco, sinal);
  }

  for (const sinal of porModelo) {
    const existente = unido.get(sinal.tipoRisco);
    if (existente) {
      unido.set(sinal.tipoRisco, { ...existente, origemDeteccao: 'ambos' });
    } else {
      unido.set(sinal.tipoRisco, sinal);
    }
  }

  return [...unido.values()];
}

/** Ponto de entrada usado pelas rotas. */
export function detectarRisco(texto: string, tiposDoModelo: TipoRisco[] = []): SinalRisco[] {
  return unirSinais(detectarPorRegra(texto), sinaisDoModelo(tiposDoModelo));
}

export function exigeValidacaoJuridica(sinais: SinalRisco[]): boolean {
  return sinais.some((s) => s.instanciaRecomendada === 'juridico');
}

const ROTULO_INSTANCIA: Record<InstanciaEscalonamento, string> = {
  juridico: 'departamento jurídico',
  relacoes_trabalhistas: 'área de Relações Trabalhistas',
  compliance: 'área de Compliance',
};

const ROTULO_RISCO: Record<TipoRisco, string> = {
  assedio_moral: 'assédio moral',
  assedio_sexual: 'assédio sexual',
  discriminacao: 'discriminação',
  fraude: 'fraude',
  justa_causa: 'demissão por justa causa',
  acao_trabalhista: 'risco de ação trabalhista',
  dado_sensivel: 'tratamento de dado pessoal sensível',
};

export function rotuloRisco(tipo: TipoRisco): string {
  return ROTULO_RISCO[tipo];
}

/** Texto exibido em destaque, acima do plano de ação (FR-012). */
export function mensagemEscalonamento(sinais: SinalRisco[]): string | null {
  if (sinais.length === 0) return null;

  const riscos = [...new Set(sinais.map((s) => ROTULO_RISCO[s.tipoRisco]))];
  const instancias = [...new Set(sinais.map((s) => ROTULO_INSTANCIA[s.instanciaRecomendada]))];

  return (
    `Esta situação envolve ${riscos.join(', ')}. ` +
    `Antes de qualquer ação, valide com ${instancias.join(' e ')}. ` +
    'A orientação a seguir é consultiva e não substitui essa validação.'
  );
}
