import { describe, expect, it, vi } from 'vitest';
import {
  ErroTranscricao,
  LIMITE_BYTES,
  MIN_CARACTERES,
  avaliarConfianca,
  transcrever,
  validarAudio,
} from '@/lib/ia/transcricao';

/** US4 — FR-020, FR-012, research.md R-03 e R-09 (o áudio não é persistido). */

function arquivoFalso(conteudo: string, tipo = 'audio/webm') {
  const bytes = Buffer.from(conteudo);
  return {
    size: bytes.byteLength,
    type: tipo,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  };
}

/** Texto suficientemente longo e denso para não disparar o aviso de confiança. */
const FALA_NORMAL = 'A colaboradora relatou constrangimento durante a reunião de equipe.';

describe('validação do áudio', () => {
  it('aceita formatos suportados', () => {
    expect(() => validarAudio({ size: 1024, type: 'audio/webm' })).not.toThrow();
    expect(() => validarAudio({ size: 1024, type: 'audio/webm;codecs=opus' })).not.toThrow();
    expect(() => validarAudio({ size: 1024, type: 'audio/mpeg' })).not.toThrow();
  });

  it('recusa arquivo vazio', () => {
    expect(() => validarAudio({ size: 0, type: 'audio/webm' })).toThrow(ErroTranscricao);
  });

  it('recusa áudio acima de 25 MB', () => {
    expect(() => validarAudio({ size: LIMITE_BYTES + 1, type: 'audio/webm' })).toThrow(/25 MB/);
  });

  it('recusa formato não suportado', () => {
    expect(() => validarAudio({ size: 1024, type: 'video/mp4' })).toThrow(/não suportado/);
  });
});

describe('derivação de confiança (R-03)', () => {
  it('sinaliza baixa confiança quando o texto é curto demais em termos absolutos', () => {
    expect(avaliarConfianca('oi', 10)).toBe(true);
    expect(avaliarConfianca('a'.repeat(MIN_CARACTERES - 1), 1)).toBe(true);
  });

  it('sinaliza baixa confiança quando a densidade de fala é baixa', () => {
    // 66 caracteres em 60 segundos de áudio: o modelo capturou quase nada do que foi dito.
    expect(avaliarConfianca(FALA_NORMAL, 60)).toBe(true);
  });

  it('não sinaliza quando a densidade é compatível com fala corrida', () => {
    // ~66 caracteres em 5 segundos: densidade normal para português falado.
    expect(avaliarConfianca(FALA_NORMAL, 5)).toBe(false);
  });

  it('não sinaliza por densidade quando a duração não é informada', () => {
    expect(avaliarConfianca(FALA_NORMAL, 0)).toBe(false);
  });
});

describe('transcrição', () => {
  it('devolve o texto transcrito para revisão', async () => {
    const transcritor = vi.fn().mockResolvedValue({ texto: FALA_NORMAL, segundos: 5 });

    const resultado = await transcrever(arquivoFalso('audio-ficticio'), transcritor);

    expect(resultado.texto).toContain('constrangimento');
    expect(resultado.confiancaBaixa).toBe(false);
  });

  it('devolve o texto literal, sem transformação', async () => {
    const literal = '  Ele disse: "não vou aceitar isso".  ';
    const transcritor = vi.fn().mockResolvedValue({ texto: literal, segundos: 3 });

    const resultado = await transcrever(arquivoFalso('x'), transcritor);
    expect(resultado.texto).toBe(literal);
  });

  it('sinaliza confiança baixa quando o áudio é ruim', async () => {
    const transcritor = vi.fn().mockResolvedValue({ texto: 'trecho', segundos: 45 });
    const resultado = await transcrever(arquivoFalso('ruido'), transcritor);
    expect(resultado.confiancaBaixa).toBe(true);
  });

  it('falha de forma explícita quando não há fala audível', async () => {
    const transcritor = vi.fn().mockResolvedValue({ texto: '   ', segundos: 12 });
    await expect(transcrever(arquivoFalso('silencio'), transcritor)).rejects.toThrow(
      /não foi possível identificar fala/i,
    );
  });

  it('falha quando o provedor devolve texto vazio (silêncio filtrado)', async () => {
    const transcritor = vi.fn().mockResolvedValue({ texto: '', segundos: 30 });
    await expect(transcrever(arquivoFalso('silencio'), transcritor)).rejects.toThrow(
      ErroTranscricao,
    );
  });

  it('envia o áudio em base64 com o formato que o provedor espera', async () => {
    const transcritor = vi.fn().mockResolvedValue({ texto: FALA_NORMAL, segundos: 5 });
    await transcrever(arquivoFalso('conteudo', 'audio/ogg;codecs=opus'), transcritor);

    const chamada = transcritor.mock.calls[0]![0];
    expect(chamada.formato).toBe('ogg');
    expect(Buffer.from(chamada.base64, 'base64').toString()).toBe('conteudo');
  });

  it('mapeia os seis tipos MIME aceitos para o formato do provedor', async () => {
    const esperado: [string, string][] = [
      ['audio/webm', 'webm'],
      ['audio/ogg', 'ogg'],
      ['audio/mpeg', 'mp3'],
      ['audio/mp4', 'm4a'],
      ['audio/x-m4a', 'm4a'],
      ['audio/wav', 'wav'],
    ];

    for (const [mime, formato] of esperado) {
      const transcritor = vi.fn().mockResolvedValue({ texto: FALA_NORMAL, segundos: 5 });
      await transcrever(arquivoFalso('conteudo', mime), transcritor);
      expect(transcritor.mock.calls[0]![0].formato).toBe(formato);
    }
  });

  it('não transcreve arquivo inválido — falha antes de chamar o provedor', async () => {
    const transcritor = vi.fn();
    await expect(transcrever(arquivoFalso('x', 'application/pdf'), transcritor)).rejects.toThrow(
      ErroTranscricao,
    );
    expect(transcritor).not.toHaveBeenCalled();
  });

  it('não chama o provedor para áudio acima do limite', async () => {
    const transcritor = vi.fn();
    const grande = { ...arquivoFalso('x'), size: LIMITE_BYTES + 1 };

    await expect(transcrever(grande, transcritor)).rejects.toThrow(/25 MB/);
    expect(transcritor).not.toHaveBeenCalled();
  });
});
