import 'server-only';
import { z } from 'zod';
import { MODELO_RAPIDO, obterCliente } from './gemini';

/**
 * Transcrição de áudio (US4, FR-020, research.md R-09).
 *
 * O áudio NÃO é persistido: só o texto revisado pelo BP entra no atendimento. A voz de alguém
 * relatando um caso de assédio é dado biométrico desnecessário para o produto — guardá-lo
 * ampliaria a superfície sensível sem nenhum ganho.
 */

export const LIMITE_BYTES = 25 * 1024 * 1024; // 25 MB
export const TIPOS_ACEITOS = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-m4a',
];

export const resultadoTranscricao = z.object({
  texto: z.string(),
  confiancaBaixa: z.boolean(),
});

export type ResultadoTranscricao = z.infer<typeof resultadoTranscricao>;

export class ErroTranscricao extends Error {}

const INSTRUCAO = `Transcreva o áudio em português do Brasil, fielmente, sem resumir nem interpretar.
Devolva JSON com:
- "texto": a transcrição literal.
- "confiancaBaixa": true se o áudio estiver inaudível, muito ruidoso ou incompreensível em parte relevante.
Se não houver fala audível, devolva "texto" vazio e "confiancaBaixa": true.`;

export type TranscritorAudio = (params: {
  base64: string;
  tipoMime: string;
}) => Promise<ResultadoTranscricao>;

const transcritorPadrao: TranscritorAudio = async ({ base64, tipoMime }) => {
  const cliente = obterCliente();

  const resposta = await cliente.models.generateContent({
    model: MODELO_RAPIDO,
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: tipoMime, data: base64 } }, { text: INSTRUCAO }],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const bruto = resposta.text ?? '';
  const analise = resultadoTranscricao.safeParse(JSON.parse(bruto));
  if (!analise.success) throw new ErroTranscricao('Resposta de transcrição inválida.');
  return analise.data;
};

export function validarAudio(arquivo: { size: number; type: string }): void {
  if (arquivo.size === 0) throw new ErroTranscricao('Arquivo de áudio vazio.');
  if (arquivo.size > LIMITE_BYTES) throw new ErroTranscricao('Áudio acima do limite de 25 MB.');

  const tipoBase = arquivo.type.split(';')[0]!.trim();
  if (!TIPOS_ACEITOS.includes(tipoBase)) {
    throw new ErroTranscricao(`Formato de áudio não suportado: ${tipoBase}.`);
  }
}

export async function transcrever(
  arquivo: { arrayBuffer: () => Promise<ArrayBuffer>; size: number; type: string },
  transcritor: TranscritorAudio = transcritorPadrao,
): Promise<ResultadoTranscricao> {
  validarAudio(arquivo);

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const resultado = await transcritor({
    base64: bytes.toString('base64'),
    tipoMime: arquivo.type.split(';')[0]!.trim(),
  });

  // Daqui em diante o áudio deixa de existir: `bytes` sai de escopo e nada é gravado em disco.
  if (resultado.texto.trim().length === 0) {
    throw new ErroTranscricao('Não foi possível identificar fala no áudio.');
  }

  return resultado;
}
