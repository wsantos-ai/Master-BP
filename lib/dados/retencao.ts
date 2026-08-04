import { prisma } from './prisma';
import { DIAS_ATE_ENCERRAMENTO_AUTOMATICO } from './atendimentos';
import { logger } from '@/lib/observabilidade/logger';

/**
 * Ciclo de vida do dado — FR-018, FR-026, research.md R-11.
 *
 * Retenção declarada que não é executada é apenas texto. Duas varreduras diárias:
 *   1. encerra atendimentos parados há 90 dias;
 *   2. expurga atendimentos concluídos há mais de 24 meses.
 *
 * O expurgo apaga o conteúdo e PRESERVA o registro de auditoria, anonimizado: a prova de que a
 * exclusão ocorreu tem de sobreviver ao dado excluído.
 */

export function limiteEncerramento(agora: Date): Date {
  const limite = new Date(agora);
  limite.setDate(limite.getDate() - DIAS_ATE_ENCERRAMENTO_AUTOMATICO);
  return limite;
}

/** FR-018 — atendimentos sem interação há 90 dias viram "incompleto". */
export async function encerrarAbandonados(agora = new Date()): Promise<number> {
  const { count } = await prisma.atendimento.updateMany({
    where: {
      estado: 'em_andamento',
      ultimaInteracaoEm: { lt: limiteEncerramento(agora) },
    },
    data: { estado: 'incompleto' },
  });

  if (count > 0) logger.info('retencao.encerrados_por_inatividade', { quantidade: count });
  return count;
}

/** FR-026 — expurga o conteúdo de atendimentos concluídos há mais de 24 meses. */
export async function expurgarVencidos(agora = new Date()): Promise<number> {
  const vencidos = await prisma.atendimento.findMany({
    where: { expurgarEm: { not: null, lte: agora } },
    select: { id: true, autorId: true },
  });

  if (vencidos.length === 0) return 0;

  for (const atendimento of vencidos) {
    await prisma.$transaction([
      // A auditoria fica: perde o vínculo com o atendimento e com o usuário, mantém o evento.
      prisma.registroAuditoria.updateMany({
        where: { atendimentoId: atendimento.id },
        data: { atendimentoId: null, usuarioId: null },
      }),
      prisma.registroAuditoria.create({
        data: {
          atendimentoId: null,
          usuarioId: null,
          acao: 'expurgo_retencao',
          detalhe: JSON.stringify({ motivo: 'retencao_24_meses' }),
        },
      }),
      // Cascata apaga lacunas, mensagens, entrega e escalonamentos.
      prisma.atendimento.delete({ where: { id: atendimento.id } }),
    ]);
  }

  logger.info('retencao.expurgados', { quantidade: vencidos.length });
  return vencidos.length;
}

export async function executarRetencao(agora = new Date()) {
  const encerrados = await encerrarAbandonados(agora);
  const expurgados = await expurgarVencidos(agora);
  return { encerrados, expurgados };
}
