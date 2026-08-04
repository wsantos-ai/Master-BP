import type { NextAuthConfig } from 'next-auth';

/**
 * Config compatível com Edge Runtime (usada pelo middleware).
 *
 * Sem provider aqui: `Credentials` com bcrypt + Prisma só entra em `auth.ts`, que roda em
 * Node.js runtime. Middleware só decodifica o JWT do cookie — não precisa (nem pode) carregar
 * bcryptjs/@prisma/client, cujas APIs Node estouram o limite de tamanho de Edge Function.
 */
export const authConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/entrar' },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session: ({ session, token }) => {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
