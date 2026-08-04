import { prisma } from './prisma';
import type { AcaoAuditoria } from '@/lib/validacao/comum';

/**
 * Trilha de auditoria (FR-024, SC-009).
 *
 * Registra acesso, exportação, exclusão e expurgo de atendimentos sensíveis. O `detalhe` guarda
 * metadados da ação — formato de exportação, motivo — e nunca conteúdo de atendimento.
 *
 * Estes registros NÃO são apagados pelo expurgo de retenção: são anonimizados, para que a prova
 * de que a exclusão ocorreu sobreviva ao dado excluído.
 */

type Detalhe = Record<string, string | number | boolean | null>;

export async function registrarAuditoria(params: {
  atendimentoId: string;
  usuarioId: string | null;
  acao: AcaoAuditoria;
  detalhe?: Detalhe;
}): Promise<void> {
  await prisma.registroAuditoria.create({
    data: {
      atendimentoId: params.atendimentoId,
      usuarioId: params.usuarioId,
      acao: params.acao,
      detalhe: params.detalhe ? JSON.stringify(params.detalhe) : null,
    },
  });
}

/**
 * Registra apenas quando o atendimento é sensível.
 * Acesso a atendimento comum não gera ruído na trilha.
 */
export async function registrarSeSensivel(params: {
  atendimentoId: string;
  usuarioId: string | null;
  acao: AcaoAuditoria;
  classificacaoSigilo: string;
  detalhe?: Detalhe;
}): Promise<void> {
  if (params.classificacaoSigilo !== 'sensivel') return;
  await registrarAuditoria(params);
}

export async function listarAuditoriaDoUsuario(usuarioId: string, limite = 100) {
  return prisma.registroAuditoria.findMany({
    where: { usuarioId },
    orderBy: { ocorridoEm: 'desc' },
    take: limite,
  });
}
