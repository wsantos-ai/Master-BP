import { NextResponse, type NextRequest } from 'next/server';
import { idUsuarioAutenticado } from '@/auth';
import { ErroTranscricao, transcrever } from '@/lib/ia/transcricao';
import { respostaErro } from '@/lib/http/erros';
import { logger } from '@/lib/observabilidade/logger';

/**
 * POST /api/transcricao — áudio → texto (US4, FR-020).
 *
 * Devolve o texto para revisão do BP; NÃO inicia atendimento. O áudio não é persistido em
 * nenhum momento (R-09).
 */
export async function POST(req: NextRequest) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) return respostaErro('NAO_AUTENTICADO');

  let arquivo: File | null = null;
  try {
    const formulario = await req.formData();
    const campo = formulario.get('audio');
    if (campo instanceof File) arquivo = campo;
  } catch {
    return respostaErro('ENTRADA_INVALIDA');
  }

  if (!arquivo) return respostaErro('ENTRADA_INVALIDA', 'Envie o arquivo de áudio.');

  try {
    const resultado = await transcrever(arquivo);
    return NextResponse.json(resultado);
  } catch (erro) {
    if (erro instanceof ErroTranscricao) {
      // O rascunho do BP não se perde: a rota falha, a tela oferece a digitação.
      return respostaErro('TRANSCRICAO_FALHOU', `${erro.message} Você pode digitar o relato.`);
    }
    logger.erro('transcricao.falhou', { usuarioId, tipo: (erro as Error).name });
    return respostaErro('TRANSCRICAO_FALHOU');
  }
}
