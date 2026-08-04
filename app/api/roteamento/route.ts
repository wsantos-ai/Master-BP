import { NextResponse, type NextRequest } from 'next/server';
import { idUsuarioAutenticado } from '@/auth';
import { rotear } from '@/lib/ia/roteador';
import { ErroConfiguracaoIA } from '@/lib/ia/gemini';
import { ErroSaidaEstruturada } from '@/lib/ia/saida-estruturada';
import { requisicaoRoteamento } from '@/lib/validacao/requisicoes';
import { LIMITE_RELATO } from '@/lib/validacao/comum';
import { respostaErro } from '@/lib/http/erros';
import { logger } from '@/lib/observabilidade/logger';

/** POST /api/roteamento — indica a especialidade a partir do relato (FR-002, FR-004, FR-005). */
export async function POST(req: NextRequest) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) return respostaErro('NAO_AUTENTICADO');

  const corpo = await req.json().catch(() => null);
  const analise = requisicaoRoteamento.safeParse(corpo);

  if (!analise.success) {
    const relatoBruto = typeof corpo?.relato === 'string' ? corpo.relato : '';
    // Relato acima do limite é sinalizado, nunca truncado em silêncio.
    if (relatoBruto.length > LIMITE_RELATO) return respostaErro('RELATO_MUITO_EXTENSO');
    return respostaErro('ENTRADA_INVALIDA');
  }

  try {
    const resultado = await rotear(analise.data.relato);
    return NextResponse.json(resultado);
  } catch (erro) {
    const tipo = (erro as Error).name;

    // Falta de chave não é indisponibilidade do provedor: a mensagem precisa apontar para a
    // configuração, ou o operador fica procurando problema no lugar errado.
    if (erro instanceof ErroConfiguracaoIA) {
      logger.erro('roteamento.configuracao_ausente', { usuarioId, tipo });
      return respostaErro(
        'ERRO_INTERNO',
        'Os assistentes não estão configurados neste ambiente. Verifique a chave do provedor.',
      );
    }

    logger.erro('roteamento.falhou', {
      usuarioId,
      tipo,
      motivo: erro instanceof ErroSaidaEstruturada ? erro.motivo : undefined,
    });
    return respostaErro('PROVEDOR_INDISPONIVEL');
  }
}
