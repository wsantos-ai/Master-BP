import { NextResponse, type NextRequest } from 'next/server';
import { idUsuarioAutenticado } from '@/auth';
import {
  buscarAtendimentoDoAutor,
  criarLacunas,
  listarLacunas,
  marcarLacunaNaoAplicavel,
  marcarSensivel,
  registrarEscalonamentos,
  registrarMensagem,
  responderLacuna,
  tocarAtendimento,
} from '@/lib/dados/atendimentos';
import { exigirEspecialidade } from '@/lib/assistentes/catalogo';
import { avaliarPortao, proximaOrdem, reconciliarComSinalDoModelo } from '@/lib/dominio/portao-refinamento';
import { detectarRisco, mensagemEscalonamento } from '@/lib/dominio/deteccao-risco';
import { conduzirRefinamento } from '@/lib/ia/refinamento';
import { ErroConfiguracaoIA, MODELO_CAPAZ } from '@/lib/ia/openrouter';
import { ErroSaidaEstruturada } from '@/lib/ia/saida-estruturada';
import { requisicaoMensagem } from '@/lib/validacao/requisicoes';
import { respostaErro, respostaNaoEncontrado } from '@/lib/http/erros';
import { logger } from '@/lib/observabilidade/logger';

/**
 * POST /api/atendimentos/[id]/mensagens — uma rodada de refinamento.
 *
 * `prontoParaEntrega` na resposta é calculado pelo servidor, com o mesmo predicado que a rota de
 * entrega aplica. A interface apenas exibe: ela não decide.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) return respostaErro('NAO_AUTENTICADO');

  const { id } = await ctx.params;

  const atendimento = await buscarAtendimentoDoAutor(id, usuarioId);
  if (!atendimento) return respostaNaoEncontrado();

  if (atendimento.estado !== 'em_andamento') {
    return respostaErro('ESTADO_INVALIDO', 'Este atendimento não aceita novas respostas.');
  }

  const corpo = await req.json().catch(() => null);
  const analise = requisicaoMensagem.safeParse(corpo);
  if (!analise.success) return respostaErro('ENTRADA_INVALIDA');

  const entrada = analise.data;
  const textoDoBp =
    entrada.tipo === 'resposta' ? entrada.conteudo : `Não se aplica: ${entrada.justificativa}`;

  if (entrada.tipo === 'resposta') {
    await responderLacuna(entrada.lacunaId, id, entrada.conteudo);
  } else {
    await marcarLacunaNaoAplicavel(entrada.lacunaId, id, entrada.justificativa);
  }

  await registrarMensagem(id, 'bp', textoDoBp);

  const especialidade = exigirEspecialidade(atendimento.assistenteId);
  const lacunasAtuais = (await listarLacunas(id, usuarioId)) ?? [];

  let refinamento;
  try {
    refinamento = await conduzirRefinamento({
      especialidade,
      relato: atendimento.relatoInicial,
      lacunas: lacunasAtuais.map((l) => ({
        id: l.id,
        pergunta: l.pergunta,
        estado: l.estado,
        resposta: l.resposta,
      })),
      ultimaMensagemDoBp: textoDoBp,
    });
  } catch (erro) {
    // A resposta do BP já foi persistida: nada se perde na indisponibilidade (contracts/api.md).
    const tipo = (erro as Error).name;

    // Chave ausente, inválida, sem crédito ou modelo inexistente. Dizer "indisponível" aqui
    // mandaria quem opera procurar o problema no provedor, e ele está no ambiente.
    if (erro instanceof ErroConfiguracaoIA) {
      logger.erro('refinamento.configuracao_ausente', { atendimentoId: id, tipo });
      return respostaErro(
        'ERRO_INTERNO',
        'Os assistentes não estão configurados neste ambiente. Verifique a chave do provedor.',
      );
    }

    logger.erro('refinamento.falhou', {
      atendimentoId: id,
      tipo,
      motivo: erro instanceof ErroSaidaEstruturada ? erro.motivo : undefined,
      modelo: MODELO_CAPAZ,
    });
    return respostaErro('PROVEDOR_INDISPONIVEL');
  }

  await registrarMensagem(id, 'assistente', refinamento.mensagem);

  if (refinamento.novasLacunas.length > 0) {
    await criarLacunas(id, refinamento.novasLacunas, proximaOrdem(lacunasAtuais));
  }

  // Risco pode aparecer numa resposta, não só no relato inicial.
  const sinais = detectarRisco(textoDoBp, refinamento.risco.tipos);
  if (sinais.length > 0) {
    await registrarEscalonamentos(
      id,
      sinais.map((s) => ({
        tipoRisco: s.tipoRisco,
        instanciaRecomendada: s.instanciaRecomendada,
        origemDeteccao: s.origemDeteccao,
        trechoGatilho: s.trechoGatilho,
      })),
    );
    if (atendimento.classificacaoSigilo !== 'sensivel') {
      await marcarSensivel(id);
    }
  }

  await tocarAtendimento(id);

  const lacunasFinais = (await listarLacunas(id, usuarioId)) ?? [];
  const portao = avaliarPortao(lacunasFinais);
  const { divergiu } = reconciliarComSinalDoModelo(lacunasFinais, refinamento.prontoParaEntrega);

  if (divergiu) {
    // Sinal do modelo contra o estado real. Registramos porque é informação de qualidade do
    // prompt — e seguimos com a decisão do servidor.
    logger.aviso('portao.divergencia_modelo', {
      atendimentoId: id,
      modeloDisse: refinamento.prontoParaEntrega,
      servidorDecidiu: portao.liberada,
    });
  }

  return NextResponse.json({
    mensagem: refinamento.mensagem,
    lacunasAbertas: portao.pendentes,
    lacunasResolvidas: portao.totalResolvidas,
    prontoParaEntrega: portao.liberada,
    novosEscalonamentos: sinais,
    avisoEscalonamento: mensagemEscalonamento(sinais),
  });
}
