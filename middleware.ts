import { auth } from '@/auth';
import { NextResponse } from 'next/server';

/**
 * Proteção de rotas (FR-028).
 *
 * O middleware barra o acesso não autenticado à área do app. Ele NÃO substitui a verificação de
 * propriedade em cada consulta (lib/dados/atendimentos.ts): estar autenticado diz quem você é,
 * não a quais atendimentos você tem direito.
 */

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
