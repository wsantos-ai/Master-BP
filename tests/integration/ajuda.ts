import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/dados/prisma';
import { CATALOGO } from '@/lib/assistentes/catalogo';

/**
 * Banco isolado para os testes de integração. Nunca o dev.db — ele pode conter trabalho real.
 * O caminho é fixado em tests/setup-integration.ts, antes de qualquer import do client.
 */

export async function semearAssistentes() {
  for (const especialidade of CATALOGO) {
    await prisma.assistente.upsert({
      where: { id: especialidade.id },
      update: {},
      create: {
        id: especialidade.id,
        nome: especialidade.nome,
        descricao: especialidade.descricao,
        dominios: JSON.stringify(especialidade.dominios),
        arquivoPrompt: especialidade.arquivoPrompt,
        estruturaEntrega: especialidade.estruturaEntrega,
        sensivelPorPadrao: especialidade.sensivelPorPadrao,
      },
    });
  }
}

export async function criarUsuario(email: string, nome: string) {
  return prisma.usuario.create({
    data: { email, nome, senhaHash: await bcrypt.hash('MasterBP2026', 4) },
  });
}

export async function limparAtendimentos() {
  await prisma.registroAuditoria.deleteMany();
  await prisma.atendimento.deleteMany();
  await prisma.usuario.deleteMany();
}

export { prisma };
