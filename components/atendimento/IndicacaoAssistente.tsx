'use client';

import { useState } from 'react';

/**
 * Indicação de assistente — FR-002, FR-003, FR-004.
 *
 * Quando a demanda é ambígua, as opções são apresentadas SEM pré-seleção: o app mostra as
 * alternativas em vez de escolher em silêncio pelo BP.
 */

export type Sugestao = {
  assistenteId: string;
  nome: string;
  justificativa: string;
  confianca: number;
};

export type AssistenteCatalogo = {
  id: string;
  nome: string;
  descricao: string;
};

export function IndicacaoAssistente({
  sugestoes,
  ambigua,
  catalogo,
  enviando,
  onConfirmar,
}: {
  sugestoes: Sugestao[];
  ambigua: boolean;
  catalogo: AssistenteCatalogo[];
  enviando: boolean;
  onConfirmar: (assistenteId: string, trocaManual: boolean) => void;
}) {
  const sugerido = ambigua ? null : (sugestoes[0]?.assistenteId ?? null);
  const [escolhido, setEscolhido] = useState<string | null>(sugerido);
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);

  const trocaManual = escolhido !== null && escolhido !== sugestoes[0]?.assistenteId;

  return (
    <div className="cartao" data-testid="indicacao-assistente">
      <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>
        {ambigua ? 'Esta demanda pode ser atendida de duas formas' : 'Assistente indicado'}
      </h2>

      {ambigua ? (
        <p className="suave">
          Escolha qual caminho faz mais sentido para o seu caso — não vamos decidir por você.
        </p>
      ) : null}

      {sugestoes.map((s) => (
        <label
          key={s.assistenteId}
          data-testid={`sugestao-${s.assistenteId}`}
          style={{
            display: 'block',
            border: `1px solid ${escolhido === s.assistenteId ? 'var(--acento)' : 'var(--borda)'}`,
            background: escolhido === s.assistenteId ? 'var(--acento-suave)' : 'transparent',
            borderRadius: 'var(--raio)',
            padding: '0.75rem 1rem',
            marginBottom: '0.625rem',
            cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name="assistente"
            value={s.assistenteId}
            checked={escolhido === s.assistenteId}
            onChange={() => setEscolhido(s.assistenteId)}
            style={{ width: 'auto', marginRight: '0.5rem' }}
          />
          <strong>{s.nome}</strong>
          <p style={{ margin: '0.25rem 0 0' }}>{s.justificativa}</p>
        </label>
      ))}

      <button type="button" onClick={() => setMostrarCatalogo((v) => !v)} disabled={enviando}>
        {mostrarCatalogo ? 'Ocultar catálogo' : 'Escolher outro assistente'}
      </button>

      {mostrarCatalogo ? (
        <div style={{ marginTop: '0.875rem' }} data-testid="catalogo-assistentes">
          {catalogo
            .filter((a) => !sugestoes.some((s) => s.assistenteId === a.id))
            .map((a) => (
              <label
                key={a.id}
                style={{
                  display: 'block',
                  border: `1px solid ${escolhido === a.id ? 'var(--acento)' : 'var(--borda)'}`,
                  borderRadius: 'var(--raio)',
                  padding: '0.625rem 0.875rem',
                  marginBottom: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="assistente"
                  value={a.id}
                  checked={escolhido === a.id}
                  onChange={() => setEscolhido(a.id)}
                  style={{ width: 'auto', marginRight: '0.5rem' }}
                />
                <strong>{a.nome}</strong>
                <p className="suave" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                  {a.descricao}
                </p>
              </label>
            ))}
        </div>
      ) : null}

      <button
        type="button"
        data-variante="primario"
        data-testid="confirmar-assistente"
        disabled={enviando || !escolhido}
        onClick={() => escolhido && onConfirmar(escolhido, trocaManual)}
        style={{ marginTop: '1rem' }}
      >
        {enviando ? 'Iniciando…' : 'Iniciar atendimento'}
      </button>
    </div>
  );
}
