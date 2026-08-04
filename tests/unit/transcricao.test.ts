import { describe, expect, it, vi } from 'vitest';
import { ErroTranscricao, LIMITE_BYTES, transcrever, validarAudio } from '@/lib/ia/transcricao';

/** US4 — FR-020, research.md R-09 (o áudio não é persistido). */

function arquivoFalso(conteudo: string, tipo = 'audio/webm') {
  const bytes = Buffer.from(conteudo);
  return {
    size: bytes.byteLength,
    type: tipo,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  };
}

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

describe('transcrição', () => {
  it('devolve o texto transcrito para revisão', async () => {
    const transcritor = vi.fn().mockResolvedValue({
      texto: 'A colaboradora relatou constrangimento durante a reunião.',
      confiancaBaixa: false,
    });

    const resultado = await transcrever(arquivoFalso('audio-ficticio'), transcritor);

    expect(resultado.texto).toContain('constrangimento');
    expect(resultado.confiancaBaixa).toBe(false);
  });

  it('sinaliza confiança baixa quando o áudio é ruim', async () => {
    const transcritor = vi.fn().mockResolvedValue({ texto: 'trecho incompreensível', confiancaBaixa: true });
    const resultado = await transcrever(arquivoFalso('ruido'), transcritor);
    expect(resultado.confiancaBaixa).toBe(true);
  });

  it('falha de forma explícita quando não há fala audível', async () => {
    const transcritor = vi.fn().mockResolvedValue({ texto: '   ', confiancaBaixa: true });
    await expect(transcrever(arquivoFalso('silencio'), transcritor)).rejects.toThrow(
      /não foi possível identificar fala/i,
    );
  });

  it('envia o áudio em base64 com o tipo MIME correto', async () => {
    const transcritor = vi.fn().mockResolvedValue({ texto: 'ok', confiancaBaixa: false });
    await transcrever(arquivoFalso('conteudo', 'audio/ogg;codecs=opus'), transcritor);

    const chamada = transcritor.mock.calls[0]![0];
    expect(chamada.tipoMime).toBe('audio/ogg');
    expect(Buffer.from(chamada.base64, 'base64').toString()).toBe('conteudo');
  });

  it('não transcreve arquivo inválido — falha antes de chamar o provedor', async () => {
    const transcritor = vi.fn();
    await expect(transcrever(arquivoFalso('x', 'application/pdf'), transcritor)).rejects.toThrow(
      ErroTranscricao,
    );
    expect(transcritor).not.toHaveBeenCalled();
  });
});
