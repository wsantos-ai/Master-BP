import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/dados/prisma';
import { credenciaisLogin } from '@/lib/validacao/requisicoes';

/**
 * Autenticação (FR-028, research.md R-07).
 *
 * Sessão em JWT dentro de cookie httpOnly. Credenciais bastam para a escala declarada; trocar
 * por SSO corporativo depois não mexe na camada de autorização, que consulta apenas
 * `sessao.user.id`.
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/entrar' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        senha: { label: 'Senha', type: 'password' },
      },
      authorize: async (credenciais) => {
        const analise = credenciaisLogin.safeParse(credenciais);
        if (!analise.success) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: analise.data.email.toLowerCase() },
        });
        if (!usuario || !usuario.ativo) return null;

        const senhaConfere = await bcrypt.compare(analise.data.senha, usuario.senhaHash);
        if (!senhaConfere) return null;

        return { id: usuario.id, name: usuario.nome, email: usuario.email };
      },
    }),
  ],
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
});

/** Id do BP autenticado, ou null. Toda rota que toca atendimento passa por aqui. */
export async function idUsuarioAutenticado(): Promise<string | null> {
  const sessao = await auth();
  return sessao?.user?.id ?? null;
}
