import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarUsuario, limparAtendimentos, prisma, semearAssistentes } from './ajuda';
import {
  buscarAtendimentoDoAutor,
  concluirAtendimento,
  criarAtendimento,
  criarLacunas,
  listarLacunas,
  marcarLacunaNaoAplicavel,
  responderLacuna,
} from '@/lib/dados/atendimentos';
import { avaliarPortao, reconciliarComSinalDoModelo } from '@/lib/dominio/portao-refinamento';

/**
 * SC-005: zero entregas emitidas com lacuna crítica em aberto.
 *
 * O portão é avaliado sobre o estado PERSISTIDO — é este caminho que a rota de entrega percorre
 * antes de chamar o modelo. Aqui provamos que ele recusa mesmo quando a interface não está no
 * meio do caminho.
 */

let bp: { id: string };
let atendimentoId: string;

beforeAll(async () => {
  await semearAssistentes();
});

beforeEach(async () => {
  await limparAtendimentos();
  await semearAssistentes();

  bp = await criarUsuario('bp@exemplo.com.br', 'BP');
  const atendimento = await criarAtendimento({
    autorId: bp.id,
    assistenteId: 'etica-compliance',
    relato: 'Relato de conduta inadequada do gestor durante as reuniões de equipe.',
    origemRelato: 'texto',
    trocaManual: false,
    assistenteSugerido: 'etica-compliance',
    justificativaSugestao: null,
    promptHash: 'hash-de-teste',
    classificacaoSigilo: 'sensivel',
  });
  atendimentoId = atendimento.id;

  await criarLacunas(
    atendimentoId,
    [
      { pergunta: 'Quem foi ouvido e quando?', porQueImporta: 'Sem escuta não há contraditório.', critica: true },
      { pergunta: 'Há evidências documentais?', porQueImporta: 'Fato sem prova não sustenta parecer.', critica: true },
      { pergunta: 'Há histórico anterior?', porQueImporta: 'Reincidência pesa na gravidade.', critica: false },
    ],
    1,
  );
});

describe('portão de entrega sobre o estado persistido', () => {
  it('recusa com todas as lacunas críticas abertas', async () => {
    const lacunas = (await listarLacunas(atendimentoId, bp.id))!;
    const portao = avaliarPortao(lacunas);

    expect(portao.liberada).toBe(false);
    expect(portao.pendentes).toHaveLength(2);
  });

  it('continua recusando com apenas uma crítica respondida', async () => {
    const lacunas = (await listarLacunas(atendimentoId, bp.id))!;
    await responderLacuna(lacunas[0]!.id, atendimentoId, 'Ouvidas a denunciante e duas testemunhas em 12/07.');

    const atualizadas = (await listarLacunas(atendimentoId, bp.id))!;
    expect(avaliarPortao(atualizadas).liberada).toBe(false);
    expect(avaliarPortao(atualizadas).pendentes).toHaveLength(1);
  });

  it('libera quando as duas críticas são resolvidas, mesmo com a não crítica aberta', async () => {
    const lacunas = (await listarLacunas(atendimentoId, bp.id))!;
    await responderLacuna(lacunas[0]!.id, atendimentoId, 'Ouvidas as partes e duas testemunhas.');
    await marcarLacunaNaoAplicavel(lacunas[1]!.id, atendimentoId, 'Não há registro documental disponível.');

    const atualizadas = (await listarLacunas(atendimentoId, bp.id))!;
    const portao = avaliarPortao(atualizadas);

    expect(portao.liberada).toBe(true);
    expect(portao.totalAbertas).toBe(1); // a não crítica segue aberta
  });

  it('"não se aplica" sem justificativa não libera o portão', async () => {
    const lacunas = (await listarLacunas(atendimentoId, bp.id))!;

    // Escrita direta no banco, contornando a camada que exige justificativa — simula estado
    // corrompido. O portão não pode aceitar isso como resolvido.
    await prisma.lacuna.update({
      where: { id: lacunas[0]!.id },
      data: { estado: 'nao_aplicavel', justificativaNaoAplicavel: null },
    });

    const atualizadas = (await listarLacunas(atendimentoId, bp.id))!;
    expect(avaliarPortao(atualizadas).liberada).toBe(false);
  });

  it('o sinal do modelo não abre o portão (R-01)', async () => {
    const lacunas = (await listarLacunas(atendimentoId, bp.id))!;
    const { pronto, divergiu } = reconciliarComSinalDoModelo(lacunas, true);

    expect(pronto).toBe(false);
    expect(divergiu).toBe(true);
  });
});

describe('conclusão e retenção', () => {
  it('agenda o expurgo para 24 meses após a conclusão (FR-026)', async () => {
    await concluirAtendimento(atendimentoId);
    const atendimento = await buscarAtendimentoDoAutor(atendimentoId, bp.id);

    expect(atendimento?.estado).toBe('concluido');
    expect(atendimento?.concluidoEm).not.toBeNull();
    expect(atendimento?.expurgarEm).not.toBeNull();

    const meses =
      (atendimento!.expurgarEm!.getFullYear() - atendimento!.concluidoEm!.getFullYear()) * 12 +
      (atendimento!.expurgarEm!.getMonth() - atendimento!.concluidoEm!.getMonth());
    expect(meses).toBe(24);
  });
});
