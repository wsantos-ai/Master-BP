import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/auth.config';

/**
 * Proteção de rotas (FR-028).
 *
 * O middleware barra o acesso não autenticado à área do app. Ele NÃO substitui a verificação de
 * propriedade em cada consulta (lib/dados/atendimentos.ts): estar autenticado diz quem você é,
 * não a quais atendimentos você tem direito.
 *
 * Usa auth.config.ts (sem provider) em vez de @/auth: middleware roda em Edge Runtime, que não
 * suporta os módulos Node usados por bcryptjs/@prisma/client dentro do Credentials provider.
 */
const { auth } = NextAuth(authConfig);

const ROTAS_PUBLICAS = ['/entrar', '/api/auth'];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Faça login para continuar.' } },
        { status: 401 },
      );
    }
    const destino = new URL('/entrar', req.nextUrl.origin);
    destino.searchParams.set('proximo', pathname);
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)'],
};
