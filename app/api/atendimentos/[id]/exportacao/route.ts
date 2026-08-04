import { NextResponse, type NextRequest } from 'next/server';
import { idUsuarioAutenticado } from '@/auth';
import { buscarAtendimentoCompleto } from '@/lib/dados/atendimentos';
import { registrarAuditoria } from '@/lib/dados/auditoria';
import { exigirEspecialidade } from '@/lib/assistentes/catalogo';
import { mensagemEscalonamento, type SinalRisco } from '@/lib/dominio/deteccao-risco';
import { entregaParaMarkdown } from '@/lib/exportacao/markdown';
import { entregaParaDocx } from '@/lib/exportacao/docx';
import { entregaParaPdfHtml } from '@/lib/exportacao/pdf';
import { nomeArquivo } from '@/lib/exportacao/sigilo';
import { requisicaoExportacao } from '@/lib/validacao/requisicoes';
import { respostaErro, respostaNaoEncontrado } from '@/lib/http/erros';

/**
 * POST /api/atendimentos/[id]/exportacao — FR-021, FR-022, SC-009.
 *
 * Toda exportação gera registro de auditoria, sensível ou não: o documento sai do controle do
 * app neste momento, e é justamente isso que precisa ser rastreável.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) return respostaErro('NAO_AUTENTICADO');

  const { id } = await ctx.params;

  const corpo = await req.json().catch(() => null);
  const analise = requisicaoExportacao.safeParse(corpo);
  if (!analise.success) return respostaErro('ENTRADA_INVALIDA');

  const completo = await buscarAtendimentoCompleto(id, usuarioId);
  if (!completo) return respostaNaoEncontrado();

  if (!completo.entrega) {
    return respostaErro('ESTADO_INVALIDO', 'Este atendimento ainda não tem entrega concluída.');
  }

  const especialidade = exigirEspecialidade(completo.atendimento.assistenteId);
  const sinais = completo.escalonamentos.map(
    (e) =>
      ({
        tipoRisco: e.tipoRisco,
        instanciaRecomendada: e.instanciaRecomendada,
        origemDeteccao: e.origemDeteccao,
        trechoGatilho: null,
      }) as SinalRisco,
  );

  const dados = {
    titulo: especialidade.nome,
    conteudo: JSON.parse(completo.entrega.conteudo) as Record<string, unknown>,
    planoAcao: JSON.parse(completo.entrega.planoAcao) as {
      acao: string;
      responsavel: string;
      prazo: string;
    }[],
    marcacaoSigilo: completo.entrega.marcacaoSigilo,
    notaGuarda: completo.entrega.notaGuarda,
    avisoEscalonamento: mensagemEscalonamento(sinais),
  };

  const formato = analise.data.formato;

  await registrarAuditoria({
    atendimentoId: id,
    usuarioId,
    acao: 'exportacao',
    detalhe: { formato, marcacaoSigilo: completo.entrega.marcacaoSigilo },
  });

  if (formato === 'docx') {
    const buffer = await entregaParaDocx(dados);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nomeArquivo(especialidade.id, id, 'docx')}"`,
      },
    });
  }

  if (formato === 'pdf') {
    return new NextResponse(entregaParaPdfHtml(dados), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${nomeArquivo(especialidade.id, id, 'html')}"`,
      },
    });
  }

  return new NextResponse(entregaParaMarkdown(dados), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomeArquivo(especialidade.id, id, 'md')}"`,
    },
  });
}
