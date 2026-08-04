import { AlertaEscalonamento, type Escalonamento } from './AlertaEscalonamento';

/**
 * Renderização da entrega final (FR-010, FR-011, FR-012).
 *
 * A ordem dos blocos é deliberada: alerta de escalonamento → conteúdo → plano de ação.
 */

export type ItemPlano = { acao: string; responsavel: string; prazo: string };

export type EntregaProps = {
  estruturaAplicada: string;
  conteudo: Record<string, unknown>;
  planoAcao: ItemPlano[];
  marcacaoSigilo: string;
  notaGuarda?: string | null;
  escalonamentos: Escalonamento[];
  avisoEscalonamento?: string | null;
};

const ROTULOS: Record<string, string> = {
  cabecalho: 'Cabeçalho',
  resumoApuracao: 'Resumo da apuração',
  gravidade: 'Classificação da gravidade',
  criteriosInvestigacao: 'Critérios de investigação',
  embasamentoLegal: 'Embasamento legal e normativo',
  recomendacoesAdicionais: 'Recomendações adicionais',
  limitacoesAnonimato: 'Limitações probatórias (denúncia anônima)',
  objetivoEstrategico: 'Objetivo estratégico',
  metodologia: 'Metodologia utilizada',
  planoAula: 'Plano de aula',
  roteiroSlides: 'Roteiro de slides',
  dicasFacilitacao: 'Dicas de facilitação',
  indicadoresAvaliacao: 'Indicadores de avaliação',
  promptCanva: 'Prompt para o Canva',
  formato: 'Formato',
  assunto: 'Assunto',
  corpo: 'Comunicação',
  orientacaoConducao: 'Como conduzir',
  diagnostico: 'Diagnóstico',
  analiseEstrategica: 'Análise estratégica',
  orientacao: 'Orientação',
  indicadoresSugeridos: 'Indicadores sugeridos',
  promptGerado: 'Prompt gerado',
  porQueFunciona: 'Por que este prompt funciona',
  tecnicasAplicadas: 'Técnicas aplicadas',
};

function rotular(chave: string): string {
  return (
    ROTULOS[chave] ??
    chave.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
  );
}

function Valor({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined || valor === '') {
    return <p className="suave">—</p>;
  }

  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return <p style={{ whiteSpace: 'pre-wrap' }}>{String(valor)}</p>;
  }

  if (Array.isArray(valor)) {
    if (valor.length === 0) return <p className="suave">—</p>;

    // Lista de objetos com chaves iguais vira tabela — preserva a leitura da liderança.
    if (typeof valor[0] === 'object' && valor[0] !== null) {
      const colunas = Object.keys(valor[0] as Record<string, unknown>);
      return (
        <table>
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c}>{rotular(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(valor as Record<string, unknown>[]).map((linha, i) => (
              <tr key={i}>
                {colunas.map((c) => (
                  <td key={c}>{Array.isArray(linha[c]) ? (linha[c] as string[]).join('; ') : String(linha[c] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <ul>
        {(valor as unknown[]).map((item, i) => (
          <li key={i}>{String(item)}</li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      {Object.entries(valor as Record<string, unknown>).map(([chave, sub]) => (
        <div key={chave} style={{ marginBottom: '0.5rem' }}>
          <strong>{rotular(chave)}:</strong> <Valor valor={sub} />
        </div>
      ))}
    </div>
  );
}

export function Entrega({
  conteudo,
  planoAcao,
  marcacaoSigilo,
  notaGuarda,
  escalonamentos,
  avisoEscalonamento,
}: EntregaProps) {
  const secoes = Object.entries(conteudo).filter(([chave]) => chave !== 'planoAcao');

  return (
    <article data-testid="entrega">
      {/* Escalonamento SEMPRE antes do plano de ação (FR-012). */}
      <AlertaEscalonamento escalonamentos={escalonamentos} aviso={avisoEscalonamento} />

      {marcacaoSigilo === 'restrito' ? (
        <p
          data-testid="marcacao-sigilo"
          style={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            border: '1px solid var(--borda)',
            borderRadius: 'var(--raio)',
            padding: '0.5rem 0.75rem',
            display: 'inline-block',
          }}
        >
          Documento restrito
        </p>
      ) : null}

      {secoes.map(([chave, valor]) => (
        <section key={chave} className="cartao">
          <h3 style={{ marginTop: 0 }}>{rotular(chave)}</h3>
          <Valor valor={valor} />
        </section>
      ))}

      <section className="cartao" data-testid="plano-acao">
        <h3 style={{ marginTop: 0 }}>Plano de ação</h3>
        <table>
          <thead>
            <tr>
              <th>Ação</th>
              <th>Responsável</th>
              <th>Prazo</th>
            </tr>
          </thead>
          <tbody>
            {planoAcao.map((item, i) => (
              <tr key={i}>
                <td>{item.acao}</td>
                <td>{item.responsavel}</td>
                <td>{item.prazo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {notaGuarda ? (
        <p className="suave" data-testid="nota-guarda">
          <strong>Guarda:</strong> {notaGuarda}
        </p>
      ) : null}
    </article>
  );
}
