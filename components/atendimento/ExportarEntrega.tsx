'use client';

import { useState } from 'react';

/** Exportação e cópia da entrega (FR-021, US3). */
export function ExportarEntrega({
  atendimentoId,
  conteudoMarkdown,
}: {
  atendimentoId: string;
  conteudoMarkdown: string;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function exportar(formato: 'docx' | 'pdf' | 'markdown') {
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/atendimentos/${atendimentoId}/exportacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato }),
      });

      if (!resposta.ok) {
        setErro('Não foi possível exportar o documento.');
        return;
      }

      if (formato === 'pdf') {
        // O HTML de impressão abre em nova aba e dispara o diálogo de impressão.
        const html = await resposta.text();
        const aba = window.open('', '_blank');
        aba?.document.write(html);
        aba?.document.close();
        return;
      }

      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        resposta.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ??
        `entrega.${formato === 'docx' ? 'docx' : 'md'}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Falha de conexão ao exportar.');
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(conteudoMarkdown);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro('Não foi possível copiar. Selecione o texto manualmente.');
    }
  }

  return (
    <div className="cartao" data-testid="exportar-entrega">
      <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Levar esta entrega para fora do app</h3>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => exportar('docx')} disabled={ocupado}>
          Baixar Word
        </button>
        <button type="button" onClick={() => exportar('pdf')} disabled={ocupado}>
          Imprimir / PDF
        </button>
        <button type="button" onClick={() => exportar('markdown')} disabled={ocupado}>
          Baixar Markdown
        </button>
        <button type="button" onClick={copiar} disabled={ocupado} data-testid="copiar-entrega">
          {copiado ? 'Copiado!' : 'Copiar'}
        </button>
      </div>

      {erro ? (
        <p className="erro" role="alert" style={{ marginBottom: 0 }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}
