/**
 * Filtros do histórico (FR-016).
 *
 * Formulário GET simples: os filtros viram query string e a página os aplica no servidor. Só
 * metadados em claro entram aqui — conteúdo cifrado não pode ser filtrado.
 */

export function FiltrosHistorico({
  especialidades,
  valores,
}: {
  especialidades: { id: string; nome: string }[];
  valores: { especialidade?: string; estado?: string; de?: string; ate?: string };
}) {
  return (
    <form
      method="get"
      className="cartao"
      data-testid="filtros-historico"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'end' }}
    >
      <div>
        <label htmlFor="especialidade">Especialidade</label>
        <select id="especialidade" name="especialidade" defaultValue={valores.especialidade ?? ''}>
          <option value="">Todas</option>
          {especialidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="estado">Situação</label>
        <select id="estado" name="estado" defaultValue={valores.estado ?? ''}>
          <option value="">Todas</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
          <option value="incompleto">Incompleto</option>
        </select>
      </div>

      <div>
        <label htmlFor="de">De</label>
        <input id="de" name="de" type="date" defaultValue={valores.de ?? ''} />
      </div>

      <div>
        <label htmlFor="ate">Até</label>
        <input id="ate" name="ate" type="date" defaultValue={valores.ate ?? ''} />
      </div>

      <button type="submit" data-variante="primario">
        Filtrar
      </button>
    </form>
  );
}
