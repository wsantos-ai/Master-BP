import { PrismaClient } from '@prisma/client';

/**
 * Instância única do Prisma Client.
 *
 * O hot reload do Next.js reavalia módulos a cada alteração; sem o cache no escopo global,
 * cada recarga abriria uma nova pool de conexões contra o mesmo arquivo SQLite.
 */

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    // Nunca habilitar log de `query` fora de depuração local: os parâmetros incluiriam
    // conteúdo de atendimento (Princípio I).
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalParaPrisma.prisma = prisma;
}
