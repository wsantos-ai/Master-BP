import { redirect } from 'next/navigation';
import { idUsuarioAutenticado } from '@/auth';
import { listarAuditoriaDoUsuario } from '@/lib/dados/auditoria';
import { formatarDataHora } from '@/lib/formato';

export const metadata = { title: 'Auditoria — Master BP' };

const ROTULO_ACAO: Record<string, string> = {
  acesso: 'Acesso',
  exportacao: 'Exportação',
  exclusao: 'Exclusão',
  expurgo_retencao: 'Expurgo por retenção',
};

export default async function PaginaAuditoria() {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) redirect('/entrar');

  const registros = await listarAuditoriaDoUsuario(usuarioId);

  return (
    <>
      <h1>Trilha de auditoria</h1>
      <p className="suave">
        Acessos, exportações e exclusões dos seus atendimentos restritos. Estes registros
        sobrevivem ao expurgo de retenção — de forma anonimizada.
      </p>

      {registros.length === 0 ? (
        <div className="cartao">
          <p style={{ margin: 0 }}>Nenhum evento registrado até agora.</p>
        </div>
      ) : (
        <table data-testid="tabela-auditoria">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Ação</th>
              <th>Atendimento</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id}>
                <td>{formatarDataHora(r.ocorridoEm)}</td>
                <td>{ROTULO_ACAO[r.acao] ?? r.acao}</td>
                <td>{r.atendimentoId ?? <span className="suave">expurgado</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
