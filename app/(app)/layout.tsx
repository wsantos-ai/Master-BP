import Link from 'next/link';
import { auth, signOut } from '@/auth';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await auth();

  async function sair() {
    'use server';
    await signOut({ redirectTo: '/entrar' });
  }

  return (
    <>
      <header
        style={{
          borderBottom: '1px solid var(--borda)',
          background: 'var(--superficie)',
        }}
      >
        <nav
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            paddingTop: '0.875rem',
            paddingBottom: '0.875rem',
          }}
        >
          <Link href="/atendimentos" style={{ fontWeight: 700, textDecoration: 'none' }}>
            Master BP
          </Link>
          <Link href="/atendimentos">Atendimentos</Link>
          <Link href="/atendimentos/novo">Novo</Link>
          <Link href="/auditoria">Auditoria</Link>

          <span style={{ marginLeft: 'auto' }} className="suave">
            {sessao?.user?.name}
          </span>
          <form action={sair}>
            <button type="submit">Sair</button>
          </form>
        </nav>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
