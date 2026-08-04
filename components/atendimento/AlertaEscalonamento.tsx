/**
 * Alerta de escalonamento — FR-012.
 *
 * Renderizado SEMPRE acima do plano de ação. A ordem não é estética: se o BP lê primeiro o que
 * fazer e depois "consulte o jurídico", a recomendação de validação vira rodapé. A constituição
 * pede o contrário — o caminho de escalonamento tem de ser visível antes da ação.
 */

export type Escalonamento = {
  tipoRisco: string;
  instanciaRecomendada: string;
  origemDeteccao: string;
};

const ROTULO_RISCO: Record<string, string> = {
  assedio_moral: 'assédio moral',
  assedio_sexual: 'assédio sexual',
  discriminacao: 'discriminação',
  fraude: 'fraude',
  justa_causa: 'demissão por justa causa',
  acao_trabalhista: 'risco de ação trabalhista',
  dado_sensivel: 'tratamento de dado pessoal sensível',
};

const ROTULO_INSTANCIA: Record<string, string> = {
  juridico: 'departamento jurídico',
  relacoes_trabalhistas: 'área de Relações Trabalhistas',
  compliance: 'área de Compliance',
};

export function AlertaEscalonamento({
  escalonamentos,
  aviso,
}: {
  escalonamentos: Escalonamento[];
  aviso?: string | null;
}) {
  if (escalonamentos.length === 0) return null;

  const riscos = [...new Set(escalonamentos.map((e) => ROTULO_RISCO[e.tipoRisco] ?? e.tipoRisco))];
  const instancias = [
    ...new Set(escalonamentos.map((e) => ROTULO_INSTANCIA[e.instanciaRecomendada] ?? e.instanciaRecomendada)),
  ];

  return (
    <section
      role="alert"
      data-testid="alerta-escalonamento"
      style={{
        background: 'var(--alerta-fundo)',
        border: `2px solid var(--alerta-borda)`,
        borderRadius: 'var(--raio)',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        color: 'var(--alerta-texto)',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
        ⚠️ Validação obrigatória antes de qualquer ação
      </h2>

      <p style={{ margin: '0 0 0.5rem' }}>
        {aviso ??
          `Esta situação envolve ${riscos.join(', ')}. Antes de qualquer ação, valide com ${instancias.join(' e ')}.`}
      </p>

      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
        {escalonamentos.map((e, i) => (
          <li key={`${e.tipoRisco}-${i}`}>
            <strong>{ROTULO_RISCO[e.tipoRisco] ?? e.tipoRisco}</strong> — encaminhar a{' '}
            {ROTULO_INSTANCIA[e.instanciaRecomendada] ?? e.instanciaRecomendada}
          </li>
        ))}
      </ul>

      <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem' }}>
        A orientação a seguir é consultiva e não substitui essa validação.
      </p>
    </section>
  );
}
