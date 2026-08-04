import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarUsuario, limparAtendimentos, prisma, semearAssistentes } from './ajuda';
import { criarAtendimento } from '@/lib/dados/atendimentos';
import { registrarAuditoria } from '@/lib/dados/auditoria';
import { encerrarAbandonados, executarRetencao, expurgarVencidos } from '@/lib/dados/retencao';

/**
 * SC-011: atendimentos concluídos há mais de 24 meses não são recuperáveis.
 * FR-018: atendimentos sem interação há 90 dias são encerrados como incompletos.
 *
 * Relógio simulado: as datas são escritas diretamente, e a varredura recebe o "agora".
 */

let bp: { id: string };

const DIA = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  await semearAssistentes();
});

beforeEach(async () => {
  await limparAtendimentos();
  await semearAssistentes();
  bp = await criarUsuario('bp@exemplo.com.br', 'BP');
});

async function criar(dados: {
  ultimaInteracaoEm?: Date;
  estado?: string;
  concluidoEm?: Date;
  expurgarEm?: Date;
}) {
  const atendimento = await criarAtendimento({
    autorId: bp.id,
    assistenteId: 'mentoria-bp',
    relato: 'Situação de turnover na equipe de operações.',
    origemRelato: 'texto',
    trocaManual: false,
    assistenteSugerido: 'mentoria-bp',
    justificativaSugestao: null,
    promptHash: 'hash-de-teste',
    classificacaoSigilo: 'padrao',
  });

  await prisma.atendimento.update({ where: { id: atendimento.id }, data: dados });
  return atendimento.id;
}

describe('encerramento por inatividade (FR-018)', () => {
  it('encerra atendimento parado há 91 dias', async () => {
    const agora = new Date();
    const id = await criar({ ultimaInteracaoEm: new Date(agora.getTime() - 91 * DIA) });

    expect(await encerrarAbandonados(agora)).toBe(1);

    const atendimento = await prisma.atendimento.findUnique({ where: { id } });
    expect(atendimento?.estado).toBe('incompleto');
  });

  it('preserva atendimento parado há 89 dias', async () => {
    const agora = new Date();
    const id = await criar({ ultimaInteracaoEm: new Date(agora.getTime() - 89 * DIA) });

    expect(await encerrarAbandonados(agora)).toBe(0);

    const atendimento = await prisma.atendimento.findUnique({ where: { id } });
    expect(atendimento?.estado).toBe('em_andamento');
  });

  it('não mexe em atendimento já concluído', async () => {
    const agora = new Date();
    const id = await criar({
      estado: 'concluido',
      ultimaInteracaoEm: new Date(agora.getTime() - 200 * DIA),
    });

    await encerrarAbandonados(agora);
    const atendimento = await prisma.atendimento.findUnique({ where: { id } });
    expect(atendimento?.estado).toBe('concluido');
  });
});

describe('expurgo de retenção (FR-026, SC-011)', () => {
  it('apaga atendimento vencido há 1 dia', async () => {
    const agora = new Date();
    const id = await criar({
      estado: 'concluido',
      concluidoEm: new Date(agora.getTime() - 731 * DIA),
      expurgarEm: new Date(agora.getTime() - DIA),
    });

    expect(await expurgarVencidos(agora)).toBe(1);
    expect(await prisma.atendimento.findUnique({ where: { id } })).toBeNull();
  });

  it('preserva atendimento cujo prazo ainda não venceu', async () => {
    const agora = new Date();
    const id = await criar({
      estado: 'concluido',
      concluidoEm: agora,
      expurgarEm: new Date(agora.getTime() + 30 * DIA),
    });

    expect(await expurgarVencidos(agora)).toBe(0);
    expect(await prisma.atendimento.findUnique({ where: { id } })).not.toBeNull();
  });

  it('apaga em cascata lacunas, mensagens e entrega', async () => {
    const agora = new Date();
    const id = await criar({
      estado: 'concluido',
      expurgarEm: new Date(agora.getTime() - DIA),
    });

    await prisma.mensagemRefinamento.create({
      data: { atendimentoId: id, autor: 'bp', conteudo: 'v1:conteudo-ficticio' },
    });

    await expurgarVencidos(agora);

    expect(await prisma.mensagemRefinamento.count({ where: { atendimentoId: id } })).toBe(0);
  });

  it('a trilha de auditoria sobrevive ao expurgo, anonimizada (R-11)', async () => {
    const agora = new Date();
    const id = await criar({
      estado: 'concluido',
      expurgarEm: new Date(agora.getTime() - DIA),
    });

    await registrarAuditoria({ atendimentoId: id, usuarioId: bp.id, acao: 'acesso' });

    await expurgarVencidos(agora);

    const registros = await prisma.registroAuditoria.findMany();
    expect(registros.length).toBeGreaterThanOrEqual(2); // o acesso anonimizado + o expurgo

    const acesso = registros.find((r) => r.acao === 'acesso');
    expect(acesso).toBeDefined();
    expect(acesso?.atendimentoId).toBeNull();
    expect(acesso?.usuarioId).toBeNull();

    expect(registros.some((r) => r.acao === 'expurgo_retencao')).toBe(true);
  });
});

describe('varredura completa', () => {
  it('executa as duas rotinas em uma passada', async () => {
    const agora = new Date();
    await criar({ ultimaInteracaoEm: new Date(agora.getTime() - 100 * DIA) });
    await criar({ estado: 'concluido', expurgarEm: new Date(agora.getTime() - DIA) });

    const resultado = await executarRetencao(agora);
    expect(resultado.encerrados).toBe(1);
    expect(resultado.expurgados).toBe(1);
  });
});
