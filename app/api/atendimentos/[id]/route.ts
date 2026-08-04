import { NextResponse, type NextRequest } from 'next/server';
import { idUsuarioAutenticado } from '@/auth';
import {
  buscarAtendimentoCompleto,
  excluirAtendimentoDoAutor,
} from '@/lib/dados/atendimentos';
import { registrarAuditoria, registrarSeSensivel } from '@/lib/dados/auditoria';
import { avaliarPortao, proximaPergunta } from '@/lib/dominio/portao-refinamento';
import { mensagemEscalonamento, type SinalRisco } from '@/lib/dominio/deteccao-risco';
import { respostaErro, respostaNaoEncontrado } from '@/lib/http/erros';

/**
 * GET /api/atendimentos/[id] — reabre o atendimento (FR-014, FR-016).
 *
 * Atendimento de outro BP responde 404, não 403: diferenciar confirmaria a existência do
 * registro alheio (FR-017, SC-006).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) return respostaErro('NAO_AUTENTICADO');

  const { id } = await ctx.params;
  const completo = await buscarAtendimentoCompleto(id, usuarioId);
  if (!completo) return respostaNaoEncontrado();

  await registrarSeSensivel({
    atendimentoId: id,
    usuarioId,
    acao: 'acesso',
    classificacaoSigilo: completo.atendimento.classificacaoSigilo,
  });

  const portao = avaliarPortao(completo.lacunas);
  const proxima = proximaPergunta(completo.lacunas);

  const sinais = completo.escalonamentos.map(
    (e) =>
      ({
        tipoRisco: e.tipoRisco,
        instanciaRecomendada: e.instanciaRecomendada,
        origemDeteccao: e.origemDeteccao,
        trechoGatilho: null,
      }) as SinalRisco,
  );

  return NextResponse.json({
    atendimento: {
      id: completo.atendimento.id,
      assistenteId: completo.atendimento.assistenteId,
      assistenteNome: completo.assistente.nome,
      estado: completo.atendimento.estado,
      classificacaoSigilo: completo.atendimento.classificacaoSigilo,
      relatoInicial: completo.atendimento.relatoInicial,
      criadoEm: completo.atendimento.criadoEm,
      concluidoEm: completo.atendimento.concluidoEm,
    },
    lacunas: completo.lacunas,
    // Retomada: a próxima pergunta pendente (SC-008).
    proximaPergunta: proxima ? { id: proxima.id, pergunta: proxima.pergunta } : null,
    mensagens: completo.mensagens,
    entrega: completo.entrega
      ? {
          estruturaAplicada: completo.entrega.estruturaAplicada,
          conteudo: JSON.parse(completo.entrega.conteudo),
          planoAcao: JSON.parse(completo.entrega.planoAcao),
          marcacaoSigilo: completo.entrega.marcacaoSigilo,
          notaGuarda: completo.entrega.notaGuarda,
        }
      : null,
    prontoParaEntrega: portao.liberada,
    escalonamentos: sinais,
    avisoEscalonamento: mensagemEscalonamento(sinais),
  });
}

/** DELETE /api/atendimentos/[id] — exclusão a pedido do BP (FR-027). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) return respostaErro('NAO_AUTENTICADO');

  const { id } = await ctx.params;
  const completo = await buscarAtendimentoCompleto(id, usuarioId);
  if (!completo) return respostaNaoEncontrado();

  // A auditoria é gravada ANTES da remoção: depois, o vínculo com o atendimento já não existe.
  await registrarAuditoria({
    atendimentoId: id,
    usuarioId,
    acao: 'exclusao',
    detalhe: { motivo: 'solicitacao_do_bp' },
  });

  await excluirAtendimentoDoAutor(id, usuarioId);
  return new NextResponse(null, { status: 204 });
}
