import { NextResponse, type NextRequest } from 'next/server';
import { executarRetencao } from '@/lib/dados/retencao';
import { logger } from '@/lib/observabilidade/logger';

/**
 * Rotina agendada de retenção (FR-018, FR-026).
 *
 * Protegida por segredo em cabeçalho: sem autenticação de usuário, porque não há usuário — mas
 * também não pode ficar aberta, já que apaga dados.
 */
export async function POST(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const enviado = req.headers.get('authorization');

  if (!segredo || enviado !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: { codigo: 'NAO_AUTENTICADO' } }, { status: 401 });
  }

  try {
    const resultado = await executarRetencao();
    return NextResponse.json(resultado);
  } catch (erro) {
    logger.erro('retencao.falhou', { tipo: (erro as Error).name });
    return NextResponse.json({ erro: { codigo: 'ERRO_INTERNO' } }, { status: 500 });
  }
}
