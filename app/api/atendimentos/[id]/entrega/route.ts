import { NextResponse, type NextRequest } from 'next/server';
import { idUsuarioAutenticado } from '@/auth';
import { prisma } from '@/lib/dados/prisma';
import { cifrar } from '@/lib/dados/cripto';
import {
  buscarAtendimentoDoAutor,
  concluirAtendimento,
  listarLacunas,
} from '@/lib/dados/atendimentos';
import { exigirEspecialidade } from '@/lib/assistentes/catalogo';
import { avaliarPortao } from '@/lib/dominio/portao-refinamento';
import { marcacaoParaEntrega, notaGuardaObrigatoria } from '@/lib/dominio/classificacao-sigilo';
import { mensagemEscalonamento, type SinalRisco } from '@/lib/dominio/deteccao-risco';
import { ErroVedacaoPunitiva, gerarEntrega } from '@/lib/ia/entrega';
import { ErroSaidaEstruturada } from '@/lib/ia/saida-estruturada';
import { respostaErro, respostaNaoEncontrado } from '@/lib/http/erros';
import { logger } from '@/lib/observabilidade/logger';

/**
 * POST /api/atendimentos/[id]/entrega
 *
 * Aqui vive o portão do Princípio II. A recusa por lacuna aberta é determinística e acontece
 * antes de qualquer chamada ao modelo — inclusive quando a rota é chamada fora da interface.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) return respostaErro('NAO_AUTENTICADO');

  const { id } = await ctx.params;

  const atendimento = await buscarAtendimentoDoAutor(id, usuarioId);
  if (!atendimento) return respostaNaoEncontrado();

  if (atendimento.estado !== 'em_andamento') {
    return respostaErro('ESTADO_INVALIDO', 'Este atendimento já foi concluído ou encerrado.');
  }

  const lacunas = (await listarLacunas(id, usuarioId)) ?? [];
  const portao = avaliarPortao(lacunas);

  // ── Princípio II ──────────────────────────────────────────────────────────
  if (!portao.liberada) {
    return respostaErro('REFINAMENTO_INCOMPLETO', undefined, {
      lacunasPendentes: portao.pendentes,
    });
  }
  // ──────────────────────────────────────────────────────────────────────────

  const especialidade = exigirEspecialidade(atendimento.assistenteId);

  let gerada;
  try {
    gerada = await gerarEntrega({
      especialidade,
      relato: atendimento.relatoInicial,
      lacunas,
    });
  } catch (erro) {
    if (erro instanceof ErroVedacaoPunitiva) {
      logger.aviso('entrega.vedacao_punitiva', { atendimentoId: id });
      return respostaErro('ESTADO_INVALIDO', erro.message, { itens: erro.itens });
    }
    if (erro instanceof ErroSaidaEstruturada) {
      logger.erro('entrega.estrutura_invalida', { atendimentoId: id, motivo: erro.motivo });
      // Falha de provedor (cota, modelo indisponível) não é entrega mal formada: a mensagem ao
      // BP precisa refletir a diferença.
      return respostaErro(
        erro.motivo === 'schema_reprovado' ? 'ESTRUTURA_INVALIDA' : 'PROVEDOR_INDISPONIVEL',
      );
    }
    logger.erro('entrega.falhou', { atendimentoId: id, tipo: (erro as Error).name });
    return respostaErro('PROVEDOR_INDISPONIVEL');
  }

  const marcacao = marcacaoParaEntrega(atendimento.classificacaoSigilo);
  const conteudo = gerada.conteudo as { notaGuarda?: string | null };
  const notaGuarda = notaGuardaObrigatoria(marcacao, conteudo.notaGuarda ?? null);

  await prisma.entrega.create({
    data: {
      atendimentoId: id,
      estruturaAplicada: especialidade.estruturaEntrega,
      conteudo: cifrar(JSON.stringify(gerada.conteudo)),
      planoAcao: cifrar(JSON.stringify(gerada.planoAcao)),
      marcacaoSigilo: marcacao,
      notaGuarda,
      versaoModelo: gerada.modelo,
    },
  });

  await concluirAtendimento(id);

  const escalonamentos = await prisma.sinalizacaoEscalonamento.findMany({
    where: { atendimentoId: id },
  });

  const sinais = escalonamentos.map(
    (e) =>
      ({
        tipoRisco: e.tipoRisco,
        instanciaRecomendada: e.instanciaRecomendada,
        origemDeteccao: e.origemDeteccao,
        trechoGatilho: null,
      }) as SinalRisco,
  );

  return NextResponse.json({
    entrega: {
      estruturaAplicada: especialidade.estruturaEntrega,
      conteudo: gerada.conteudo,
      planoAcao: gerada.planoAcao,
      marcacaoSigilo: marcacao,
      notaGuarda,
    },
    // Renderizado ACIMA do plano de ação pela interface (FR-012).
    escalonamentos: sinais,
    avisoEscalonamento: mensagemEscalonamento(sinais),
  });
}
