import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dados/prisma';

/** GET /api/assistentes — catálogo para seleção manual (FR-003). */
export async function GET() {
  const itens = await prisma.assistente.findMany({
    where: { ativo: true },
    select: {
      id: true,
      nome: true,
      descricao: true,
      dominios: true,
      sensivelPorPadrao: true,
    },
    orderBy: { nome: 'asc' },
  });

  return NextResponse.json({
    itens: itens.map((a) => ({ ...a, dominios: JSON.parse(a.dominios) as string[] })),
  });
}
