import { NextResponse, type NextRequest } from 'next/server';
import { idUsuarioAutenticado } from '@/auth';
import { exigirEspecialidade } from '@/lib/assistentes/catalogo';
import { carregarPrompt } from '@/lib/assistentes/prompt-loader';
import { classificarAtendimento } from '@/lib/dominio/classificacao-sigilo';
import { detectarRisco, mensagemEscalonamento } from '@/lib/dominio/deteccao-risco';
import { avaliarPortao } from '@/lib/dominio/portao-refinamento';
import {
  criarAtendimento,
  criarLacunas,
  listarHistorico,
  listarLacunas,
  registrarMensagem,
  registrarEscalonamentos,
} from '@/lib/dados/atendimentos';
import { conduzirRefinamento } from '@/lib/ia/refinamento';
import { ErroConfiguracaoIA, MODELO_CAPAZ } from '@/lib/ia/gemini';
import { ErroSaidaEstruturada } from '@/lib/ia/saida-estruturada';
import { filtrosHistorico, requisicaoCriarAtendimento } from '@/lib/validacao/requisicoes';
import { respostaErro } from '@/lib/http/erros';
import { logger } from '@/lib/observabilidade/logger';

/**
 * POST /api/atendimentos — cria o atendimento e a primeira rodada de lacunas.
 *
 * A detecção de risco roda sobre o relato ANTES de qualquer coisa: se o relato já traz assédio,
 * o BP precisa ver a recomendação de escalonamento desde a primeira tela (FR-012).
 */
export async function POST(req: NextRequest) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) return respostaErro('NAO_AUTENTICADO');

  const corpo = await req.json().catch(() => null);
  const analise = requisicaoCriarAtendimento.safeParse(corpo);
  if (!analise.success) return respostaErro('ENTRADA_INVALIDA');

  const { relato, assistenteId, origemRelato, trocaManual } = analise.data;
  const especialidade = exigirEspecialidade(assistenteId);

  let refinamento;
  let promptHash: string;
  try {
    const prompt = await carregarPrompt(especialidade.arquivoPrompt);
    promptHash = prompt.hash;
    refinamento = await conduzirRefinamento({ especialidade, relato, lacunas: [] });
  } catch (erro) {
    const tipo = (erro as Error).name;

    if (erro instanceof ErroConfiguracaoIA) {
      logger.erro('atendimento.configuracao_ausente', { usuarioId, tipo });
      return respostaErro(
        'ERRO_INTERNO',
        'Os assistentes não estão configurados neste ambiente. Verifique a chave do provedor.',
      );
    }

    logger.erro('atendimento.criacao_falhou', {
      usuarioId,
      tipo,
      // Sem o motivo, o log não distingue cota estourada de modelo inexistente.
      motivo: erro instanceof ErroSaidaEstruturada ? erro.motivo : undefined,
      modelo: MODELO_CAPAZ,
    });
    return respostaErro('PROVEDOR_INDISPONIVEL');
  }

  // Camada determinística + sinal do modelo. Basta uma sinalizar (R-05).
  const sinais = detectarRisco(relato, refinamento.risco.tipos);

  const classificacao = classificarAtendimento({
    especialidadeSensivelPorPadrao: especialidade.sensivelPorPadrao,
    sinaisRisco: sinais,
  });

  const atendimento = await criarAtendimento({
    autorId: usuarioId,
    assistenteId,
    relato,
    origemRelato,
    trocaManual,
    assistenteSugerido: trocaManual ? null : assistenteId,
    justificativaSugestao: null,
    promptHash,
    classificacaoSigilo: classificacao,
  });

  await criarLacunas(atendimento.id, refinamento.novasLacunas, 1);
  await registrarMensagem(atendimento.id, 'bp', relato);
  await registrarMensagem(atendimento.id, 'assistente', refinamento.mensagem);
  await registrarEscalonamentos(
    atendimento.id,
    sinais.map((s) => ({
      tipoRisco: s.tipoRisco,
      instanciaRecomendada: s.instanciaRecomendada,
      origemDeteccao: s.origemDeteccao,
      trechoGatilho: s.trechoGatilho,
    })),
  );

  const lacunas = (await listarLacunas(atendimento.id, usuarioId)) ?? [];
  const portao = avaliarPortao(lacunas);

  return NextResponse.json(
    {
      id: atendimento.id,
      assistenteId,
      estado: atendimento.estado,
      classificacaoSigilo: classificacao,
      mensagem: refinamento.mensagem,
      lacunasAbertas: portao.pendentes,
      prontoParaEntrega: portao.liberada,
      escalonamentos: sinais,
      avisoEscalonamento: mensagemEscalonamento(sinais),
    },
    { status: 201 },
  );
}

/** GET /api/atendimentos — histórico do BP autenticado (FR-016). */
export async function GET(req: NextRequest) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) return respostaErro('NAO_AUTENTICADO');

  const analise = filtrosHistorico.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  if (!analise.success) return respostaErro('ENTRADA_INVALIDA');

  const { total, itens, pagina } = await listarHistorico({
    autorId: usuarioId,
    especialidade: analise.data.especialidade,
    estado: analise.data.estado,
    de: analise.data.de,
    ate: analise.data.ate,
    pagina: analise.data.pagina,
    porPagina: analise.data.porPagina,
  });

  return NextResponse.json({
    total,
    pagina,
    itens: itens.map((a) => ({
      id: a.id,
      assistenteId: a.assistenteId,
      assistenteNome: a.assistente.nome,
      estado: a.estado,
      classificacaoSigilo: a.classificacaoSigilo,
      criadoEm: a.criadoEm,
      concluidoEm: a.concluidoEm,
    })),
  });
}
