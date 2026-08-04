'use client';

import { useState } from 'react';
import { AlertaEscalonamento, type Escalonamento } from '@/components/atendimento/AlertaEscalonamento';
import { Entrega, type ItemPlano } from '@/components/atendimento/Entrega';
import { ExportarEntrega } from '@/components/atendimento/ExportarEntrega';
import { type LacunaPendente, PainelLacunas } from '@/components/atendimento/PainelLacunas';

type Mensagem = { id: string; autor: string; conteudo: string };

type EntregaCarregada = {
  estruturaAplicada: string;
  conteudo: Record<string, unknown>;
  planoAcao: ItemPlano[];
  marcacaoSigilo: string;
  notaGuarda: string | null;
};

export function Atendimento({
  atendimentoId,
  estado,
  mensagensIniciais,
  lacunasIniciais,
  prontoInicial,
  escalonamentos: escalonamentosIniciais,
  avisoEscalonamento,
  entregaInicial,
  markdownEntrega,
}: {
  atendimentoId: string;
  estado: string;
  mensagensIniciais: Mensagem[];
  lacunasIniciais: LacunaPendente[];
  prontoInicial: boolean;
  escalonamentos: Escalonamento[];
  avisoEscalonamento: string | null;
  entregaInicial: EntregaCarregada | null;
  /** Markdown pré-serializado no servidor, usado pelo botão "Copiar" (FR-021). */
  markdownEntrega: string;
}) {
  const [mensagens, setMensagens] = useState(mensagensIniciais);
  const [lacunas, setLacunas] = useState(lacunasIniciais);
  const [pronto, setPronto] = useState(prontoInicial);
  const [escalonamentos, setEscalonamentos] = useState(escalonamentosIniciais);
  const [aviso, setAviso] = useState(avisoEscalonamento);
  const [entrega, setEntrega] = useState(entregaInicial);
  const [enviando, setEnviando] = useState(false);
  const [pendenciasRecusa, setPendenciasRecusa] = useState<LacunaPendente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const concluido = estado !== 'em_andamento' || entrega !== null;

  async function enviar(corpo: unknown, textoLocal: string) {
    setEnviando(true);
    setErro(null);
    setPendenciasRecusa(null);
    setMensagens((atual) => [
      ...atual,
      { id: `local-${Date.now()}`, autor: 'bp', conteudo: textoLocal },
    ]);

    try {
      const resposta = await fetch(`/api/atendimentos/${atendimentoId}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados?.erro?.mensagem ?? 'Não foi possível enviar sua resposta.');
        return;
      }

      setMensagens((atual) => [
        ...atual,
        { id: `assist-${Date.now()}`, autor: 'assistente', conteudo: dados.mensagem },
      ]);
      setLacunas(dados.lacunasAbertas);
      setPronto(dados.prontoParaEntrega);

      if (dados.novosEscalonamentos?.length > 0) {
        setEscalonamentos((atual) => [...atual, ...dados.novosEscalonamentos]);
        setAviso(dados.avisoEscalonamento);
      }
    } catch {
      setErro('Falha de conexão. Suas respostas anteriores foram preservadas.');
    } finally {
      setEnviando(false);
    }
  }

  async function emitirEntrega() {
    setEnviando(true);
    setErro(null);
    setPendenciasRecusa(null);

    try {
      const resposta = await fetch(`/api/atendimentos/${atendimentoId}/entrega`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        // A recusa por refinamento incompleto não é um erro genérico: ela devolve
        // exatamente o que falta e por quê (FR-007).
        if (dados?.erro?.codigo === 'REFINAMENTO_INCOMPLETO') {
          setPendenciasRecusa(dados.erro.detalhes?.lacunasPendentes ?? []);
          setLacunas(dados.erro.detalhes?.lacunasPendentes ?? []);
          setPronto(false);
          return;
        }
        setErro(dados?.erro?.mensagem ?? 'Não foi possível emitir a entrega.');
        return;
      }

      setEntrega(dados.entrega);
      setEscalonamentos(dados.escalonamentos ?? []);
      setAviso(dados.avisoEscalonamento);
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (entrega) {
    return (
      <>
        <Entrega
          estruturaAplicada={entrega.estruturaAplicada}
          conteudo={entrega.conteudo}
          planoAcao={entrega.planoAcao}
          marcacaoSigilo={entrega.marcacaoSigilo}
          notaGuarda={entrega.notaGuarda}
          escalonamentos={escalonamentos}
          avisoEscalonamento={aviso}
        />
        <ExportarEntrega atendimentoId={atendimentoId} conteudoMarkdown={markdownEntrega} />
      </>
    );
  }

  return (
    <>
      <AlertaEscalonamento escalonamentos={escalonamentos} aviso={aviso} />

      <section data-testid="dialogo">
        {mensagens.map((m) => (
          <div
            key={m.id}
            className="cartao"
            style={{
              background: m.autor === 'bp' ? 'var(--acento-suave)' : 'var(--superficie)',
            }}
          >
            <p className="suave" style={{ margin: '0 0 0.375rem', fontSize: '0.85rem' }}>
              {m.autor === 'bp' ? 'Você' : 'Assistente'}
            </p>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.conteudo}</p>
          </div>
        ))}
      </section>

      {pendenciasRecusa ? (
        <div className="cartao" data-testid="recusa-entrega" style={{ borderColor: 'var(--alerta-borda)' }}>
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>
            Faltam informações para concluir com segurança
          </h2>
          <ul>
            {pendenciasRecusa.map((l) => (
              <li key={l.id}>
                <strong>{l.pergunta}</strong>
                <br />
                <span className="suave">{l.porQueImporta}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!concluido ? (
        <PainelLacunas
          lacunas={lacunas}
          enviando={enviando}
          onResponder={(lacunaId, conteudo) =>
            enviar({ tipo: 'resposta', lacunaId, conteudo }, conteudo)
          }
          onNaoAplicavel={(lacunaId, justificativa) =>
            enviar(
              { tipo: 'nao_aplicavel', lacunaId, justificativa },
              `Não se aplica: ${justificativa}`,
            )
          }
        />
      ) : null}

      {erro ? (
        <p className="erro" role="alert">
          {erro}
        </p>
      ) : null}

      {!concluido ? (
        <button
          type="button"
          data-variante="primario"
          data-testid="emitir-entrega"
          onClick={emitirEntrega}
          disabled={enviando}
          title={
            pronto
              ? 'Emitir a entrega final'
              : 'Ainda há informações pendentes — o assistente vai indicar quais'
          }
        >
          {enviando ? 'Processando…' : 'Emitir entrega final'}
        </button>
      ) : null}
    </>
  );
}
