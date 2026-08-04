import Link from 'next/link';
import { redirect } from 'next/navigation';
import { idUsuarioAutenticado } from '@/auth';
import { listarHistorico } from '@/lib/dados/atendimentos';
import { CATALOGO } from '@/lib/assistentes/catalogo';
import { formatarData } from '@/lib/formato';
import { FiltrosHistorico } from '@/components/historico/FiltrosHistorico';

export const metadata = { title: 'Atendimentos — Master BP' };

const ROTULO_ESTADO: Record<string, string> = {
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  incompleto: 'Incompleto',
};

export default async function PaginaHistorico({
  searchParams,
}: {
  searchParams: Promise<{ especialidade?: string; estado?: string; de?: string; ate?: string; pagina?: string }>;
}) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) redirect('/entrar');

  const filtros = await searchParams;

  const { itens, total, pagina } = await listarHistorico({
    autorId: usuarioId,
    especialidade: filtros.especialidade || undefined,
    estado: filtros.estado || undefined,
    de: filtros.de ? new Date(filtros.de) : undefined,
    ate: filtros.ate ? new Date(filtros.ate) : undefined,
    pagina: Number(filtros.pagina ?? 1),
    porPagina: 20,
  });

  return (
    <>
      <h1>Seus atendimentos</h1>
      <p className="suave">
        {total === 0
          ? 'Nenhum atendimento ainda.'
          : `${total} atendimento${total > 1 ? 's' : ''} — visíveis apenas para você.`}
      </p>

      <FiltrosHistorico
        especialidades={CATALOGO.map((e) => ({ id: e.id, nome: e.nome }))}
        valores={filtros}
      />

      {itens.length === 0 ? (
        <div className="cartao">
          <p style={{ margin: 0 }}>
            <Link href="/atendimentos/novo">Comece um novo atendimento</Link> descrevendo a
            situação com suas palavras.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }} data-testid="lista-atendimentos">
          {itens.map((a) => (
            <li key={a.id} className="cartao">
              <Link href={`/atendimentos/${a.id}`} style={{ fontWeight: 600 }}>
                {a.assistente.nome}
              </Link>
              <p className="suave" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                {ROTULO_ESTADO[a.estado] ?? a.estado} · criado em {formatarData(a.criadoEm)}
                {a.concluidoEm ? ` · concluído em ${formatarData(a.concluidoEm)}` : ''}
                {a.classificacaoSigilo === 'sensivel' ? ' · restrito' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      {total > pagina * 20 ? (
        <Link href={`/atendimentos?pagina=${pagina + 1}`}>Próxima página</Link>
      ) : null}
    </>
  );
}
