import 'server-only';
import { z } from 'zod';
import { type FormatoAudio, chamarTranscricao } from './openrouter';

/**
 * Transcrição de áudio (US4, FR-020, FR-012, research.md R-03 e R-09).
 *
 * O áudio NÃO é persistido: só o texto revisado pelo BP entra no atendimento. A voz de alguém
 * relatando um caso de assédio é dado biométrico desnecessário para o produto — guardá-lo
 * ampliaria a superfície sensível sem nenhum ganho.
 *
 * O modelo de transcrição não aceita instrução de sistema nem saída estruturada: ele devolve
 * texto puro e a duração processada. O sinal de confiança baixa, que antes vinha do modelo,
 * passa a ser derivado aqui por regra determinística — testável sem provedor, e não sujeita à
 * boa vontade do modelo.
 */

export const LIMITE_BYTES = 25 * 1024 * 1024; // 25 MB — coincide com o limite do provedor
export const TIPOS_ACEITOS = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-m4a',
];

/** Tipo MIME aceito pela plataforma → `format` esperado pelo provedor (R-03). */
const FORMATO_POR_MIME: Record<string, FormatoAudio> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
};

export const resultadoTranscricao = z.object({
  texto: z.string(),
  confiancaBaixa: z.boolean(),
});

export type ResultadoTranscricao = z.infer<typeof resultadoTranscricao>;

export class ErroTranscricao extends Error {}

/**
 * Limiares da derivação de confiança.
 *
 * Calibrados como ponto de partida conservador: preferimos avisar o BP à toa a deixá-lo enviar
 * ao assistente uma transcrição furada que ele não conferiu. Ver tarefa T044 — os números devem
 * ser reajustados contra amostras reais de áudio em pt-BR.
 */
export const MIN_CARACTERES = 15;
export const MIN_CARACTERES_POR_SEGUNDO = 3;

/**
 * Decide se a transcrição merece aviso de baixa confiança.
 *
 * Fala corrida em português rende em torno de 12 a 18 caracteres por segundo. Bem abaixo disso
 * significa que o modelo capturou pouco do que foi dito — ruído, microfone distante, fala
 * sobreposta. Função pura: nenhuma rede, nenhum estado.
 */
export function avaliarConfianca(texto: string, segundos: number): boolean {
  const limpo = texto.trim();

  if (limpo.length < MIN_CARACTERES) return true;

  // Sem duração informada não há densidade a calcular — o tamanho absoluto já decidiu acima.
  if (segundos <= 0) return false;

  return limpo.length / segundos < MIN_CARACTERES_POR_SEGUNDO;
}

/** Injetável nos testes, para não depender do provedor. */
export type TranscritorAudio = (params: {
  base64: string;
  formato: FormatoAudio;
}) => Promise<{ texto: string; segundos: number }>;

const transcritorPadrao: TranscritorAudio = (params) => chamarTranscricao(params);

/** Normaliza `audio/webm;codecs=opus` para `audio/webm`. */
function tipoBase(tipo: string): string {
  return tipo.split(';')[0]!.trim();
}

export function validarAudio(arquivo: { size: number; type: string }): void {
  if (arquivo.size === 0) throw new ErroTranscricao('Arquivo de áudio vazio.');
  if (arquivo.size > LIMITE_BYTES) throw new ErroTranscricao('Áudio acima do limite de 25 MB.');

  const base = tipoBase(arquivo.type);
  if (!TIPOS_ACEITOS.includes(base)) {
    throw new ErroTranscricao(`Formato de áudio não suportado: ${base}.`);
  }
}

export async function transcrever(
  arquivo: { arrayBuffer: () => Promise<ArrayBuffer>; size: number; type: string },
  transcritor: TranscritorAudio = transcritorPadrao,
): Promise<ResultadoTranscricao> {
  // Antes de qualquer rede: arquivo inválido não vira requisição ao provedor (FR-015).
  validarAudio(arquivo);

  const formato = FORMATO_POR_MIME[tipoBase(arquivo.type)]!;
  const bytes = Buffer.from(await arquivo.arrayBuffer());

  const { texto, segundos } = await transcritor({
    base64: bytes.toString('base64'),
    formato,
  });

  // Daqui em diante o áudio deixa de existir: `bytes` sai de escopo e nada é gravado em disco.
  if (texto.trim().length === 0) {
    throw new ErroTranscricao('Não foi possível identificar fala no áudio.');
  }

  return { texto, confiancaBaixa: avaliarConfianca(texto, segundos) };
}
