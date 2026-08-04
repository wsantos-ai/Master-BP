import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { credenciaisLogin } from '@/lib/validacao/requisicoes';

export const metadata = { title: 'Entrar — Master BP' };

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  const sessao = await auth();
  const { proximo, erro } = await searchParams;

  if (sessao?.user) redirect(proximo ?? '/atendimentos');

  async function entrar(dados: FormData) {
    'use server';

    const analise = credenciaisLogin.safeParse({
      email: dados.get('email'),
      senha: dados.get('senha'),
    });

    if (!analise.success) {
      redirect('/entrar?erro=invalido');
    }

    try {
      await signIn('credentials', {
        email: analise.data.email,
        senha: analise.data.senha,
        redirectTo: (dados.get('proximo') as string) || '/atendimentos',
      });
    } catch (falha) {
      // O signIn do Auth.js sinaliza o redirecionamento por exceção; repassamos.
      if (falha instanceof Error && falha.message.includes('NEXT_REDIRECT')) throw falha;
      redirect('/entrar?erro=credenciais');
    }
  }

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: '4rem' }}>
      <h1>Master BP</h1>
      <p className="suave">Assistentes especializados para o Business Partner de RH.</p>

      <form action={entrar} className="cartao" style={{ marginTop: '1.5rem' }}>
        <input type="hidden" name="proximo" value={proximo ?? ''} />

        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required />

        <label htmlFor="senha" style={{ display: 'block', marginTop: '0.875rem' }}>
          Senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required />

        {erro ? (
          <p className="erro" role="alert" style={{ marginTop: '0.875rem' }}>
            {erro === 'credenciais'
              ? 'E-mail ou senha incorretos.'
              : 'Verifique os dados informados.'}
          </p>
        ) : null}

        <button type="submit" data-variante="primario" style={{ marginTop: '1.25rem' }}>
          Entrar
        </button>
      </form>
    </main>
  );
}
