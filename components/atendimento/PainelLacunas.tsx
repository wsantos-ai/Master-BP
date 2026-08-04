'use client';

import { useState } from 'react';

/**
 * Painel de lacunas pendentes — FR-008, FR-009.
 *
 * Mostra ao BP o que ainda falta e por que aquilo importa. O "não se aplica" exige
 * justificativa: sem ela, a lacuna continua aberta e a entrega segue bloqueada.
 */

export type LacunaPendente = {
  id: string;
  pergunta: string;
  porQueImporta: string;
};

export function PainelLacunas({
  lacunas,
  enviando,
  onResponder,
  onNaoAplicavel,
}: {
  lacunas: LacunaPendente[];
  enviando: boolean;
  onResponder: (lacunaId: string, conteudo: string) => void;
  onNaoAplicavel: (lacunaId: string, justificativa: string) => void;
}) {
  const [resposta, setResposta] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [modoNaoAplicavel, setModoNaoAplicavel] = useState(false);

  if (lacunas.length === 0) {
    return (
      <div className="cartao" data-testid="painel-lacunas-vazio">
        <p style={{ margin: 0 }}>
          Nenhuma informação crítica pendente. Você já pode emitir a entrega final.
        </p>
      </div>
    );
  }

  const atual = lacunas[0]!;

  return (
    <div className="cartao" data-testid="painel-lacunas">
      <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>
        Ainda falta responder ({lacunas.length})
      </h2>

      <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{atual.pergunta}</p>
      <p className="suave" style={{ marginTop: 0, fontSize: '0.9rem' }}>
        {atual.porQueImporta}
      </p>

      {modoNaoAplicavel ? (
        <>
          <label htmlFor="justificativa">Por que esta informação não se aplica?</label>
          <textarea
            id="justificativa"
            rows={3}
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Explique o motivo — é o que permite seguir sem esta informação."
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              data-variante="primario"
              disabled={enviando || justificativa.trim().length < 10}
              onClick={() => {
                onNaoAplicavel(atual.id, justificativa);
                setJustificativa('');
                setModoNaoAplicavel(false);
              }}
            >
              Confirmar
            </button>
            <button type="button" onClick={() => setModoNaoAplicavel(false)} disabled={enviando}>
              Voltar
            </button>
          </div>
        </>
      ) : (
        <>
          <label htmlFor="resposta">Sua resposta</label>
          <textarea
            id="resposta"
            rows={4}
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            data-testid="campo-resposta"
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              data-variante="primario"
              data-testid="botao-responder"
              disabled={enviando || resposta.trim().length === 0}
              onClick={() => {
                onResponder(atual.id, resposta);
                setResposta('');
              }}
            >
              {enviando ? 'Enviando…' : 'Responder'}
            </button>
            <button type="button" onClick={() => setModoNaoAplicavel(true)} disabled={enviando}>
              Não se aplica
            </button>
          </div>
        </>
      )}

      {lacunas.length > 1 ? (
        <details style={{ marginTop: '1rem' }}>
          <summary className="suave">Ver as outras {lacunas.length - 1} pendências</summary>
          <ul style={{ marginBottom: 0 }}>
            {lacunas.slice(1).map((l) => (
              <li key={l.id}>{l.pergunta}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
