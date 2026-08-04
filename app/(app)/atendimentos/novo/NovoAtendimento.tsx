'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GravadorRelato } from '@/components/atendimento/GravadorRelato';
import {
  type AssistenteCatalogo,
  IndicacaoAssistente,
  type Sugestao,
} from '@/components/atendimento/IndicacaoAssistente';

type Roteamento = {
  sugestoes: Sugestao[];
  ambigua: boolean;
  foraDeEscopo: boolean;
  motivoRecusa?: string;
};

export function NovoAtendimento({ catalogo }: { catalogo: AssistenteCatalogo[] }) {
  const router = useRouter();
  const [relato, setRelato] = useState('');
  const [roteamento, setRoteamento] = useState<Roteamento | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [origem, setOrigem] = useState<'texto' | 'audio'>('texto');
  const [revisaoPendente, setRevisaoPendente] = useState(false);
  const [confiancaBaixa, setConfiancaBaixa] = useState(false);

  async function analisar() {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch('/api/roteamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relato }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados?.erro?.mensagem ?? 'Não foi possível analisar o relato.');
        return;
      }
      setRoteamento(dados);
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function iniciar(assistenteId: string, trocaManual: boolean) {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch('/api/atendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relato, assistenteId, origemRelato: origem, trocaManual }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados?.erro?.mensagem ?? 'Não foi possível iniciar o atendimento.');
        return;
      }
      router.push(`/atendimentos/${dados.id}`);
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="cartao">
        <label htmlFor="relato">O que está acontecendo?</label>
        <textarea
          id="relato"
          rows={8}
          value={relato}
          onChange={(e) => setRelato(e.target.value)}
          data-testid="campo-relato"
          placeholder="Ex.: minha equipe está com turnover alto e o gestor não sabe conduzir feedback."
          disabled={roteamento !== null}
        />

        {roteamento === null ? (
          <GravadorRelato
            desabilitado={enviando}
            onTranscrito={(texto, baixa) => {
              // A transcrição vai para o campo, editável: o BP confirma antes de enviar (FR-020).
              setRelato(texto);
              setOrigem('audio');
              setRevisaoPendente(true);
              setConfiancaBaixa(baixa);
            }}
          />
        ) : null}

        {revisaoPendente ? (
          <p
            className="suave"
            data-testid="revisao-transcricao"
            style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}
          >
            {confiancaBaixa
              ? '⚠️ A transcrição pode ter falhas. Revise com atenção antes de continuar.'
              : 'Revise a transcrição acima e ajuste o que for necessário antes de continuar.'}
          </p>
        ) : null}

        {roteamento === null ? (
          <button
            type="button"
            data-variante="primario"
            data-testid="analisar-relato"
            onClick={analisar}
            disabled={enviando || relato.trim().length === 0}
            style={{ marginTop: '0.875rem' }}
          >
            {enviando ? 'Analisando…' : 'Continuar'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setRoteamento(null)}
            style={{ marginTop: '0.875rem' }}
          >
            Editar relato
          </button>
        )}
      </div>

      {erro ? (
        <p className="erro" role="alert" data-testid="erro">
          {erro}
        </p>
      ) : null}

      {roteamento?.foraDeEscopo ? (
        <div className="cartao" data-testid="fora-de-escopo">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Demanda fora do escopo</h2>
          <p>{roteamento.motivoRecusa}</p>
          <p className="suave">
            Os assistentes cobrem gestão de pessoas. Para outros temas, procure a área
            responsável.
          </p>
        </div>
      ) : null}

      {roteamento && !roteamento.foraDeEscopo ? (
        <IndicacaoAssistente
          sugestoes={roteamento.sugestoes}
          ambigua={roteamento.ambigua}
          catalogo={catalogo}
          enviando={enviando}
          onConfirmar={iniciar}
        />
      ) : null}
    </>
  );
}
