'use client';

import { useRef, useState } from 'react';

/**
 * Gravação do relato por voz (US4, FR-020).
 *
 * O áudio é enviado para transcrição e descartado. O texto volta para revisão do BP antes de
 * chegar ao assistente — ele confirma o que será enviado.
 */

export function GravadorRelato({
  onTranscrito,
  desabilitado,
}: {
  onTranscrito: (texto: string, confiancaBaixa: boolean) => void;
  desabilitado?: boolean;
}) {
  const [gravando, setGravando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const cronometroRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function iniciar() {
    setErro(null);
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(fluxo);
      pedacosRef.current = [];

      gravador.ondataavailable = (e) => {
        if (e.data.size > 0) pedacosRef.current.push(e.data);
      };

      gravador.onstop = async () => {
        fluxo.getTracks().forEach((t) => t.stop());
        await enviar(new Blob(pedacosRef.current, { type: gravador.mimeType }));
      };

      gravador.start();
      gravadorRef.current = gravador;
      setGravando(true);
      setSegundos(0);
      cronometroRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch {
      setErro('Não foi possível acessar o microfone. Você pode digitar o relato.');
    }
  }

  function parar() {
    gravadorRef.current?.stop();
    setGravando(false);
    if (cronometroRef.current) clearInterval(cronometroRef.current);
  }

  async function enviar(blob: Blob) {
    setProcessando(true);
    try {
      const formulario = new FormData();
      formulario.append('audio', blob, 'relato.webm');

      const resposta = await fetch('/api/transcricao', { method: 'POST', body: formulario });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados?.erro?.mensagem ?? 'Não foi possível transcrever. Você pode digitar.');
        return;
      }
      onTranscrito(dados.texto, dados.confiancaBaixa);
    } catch {
      setErro('Falha ao enviar o áudio. Você pode digitar o relato.');
    } finally {
      setProcessando(false);
    }
  }

  const minutos = String(Math.floor(segundos / 60)).padStart(2, '0');
  const resto = String(segundos % 60).padStart(2, '0');

  return (
    <div data-testid="gravador-relato" style={{ marginTop: '0.75rem' }}>
      {gravando ? (
        <button type="button" onClick={parar} data-testid="parar-gravacao">
          ⏹ Parar gravação ({minutos}:{resto})
        </button>
      ) : (
        <button
          type="button"
          onClick={iniciar}
          disabled={desabilitado || processando}
          data-testid="iniciar-gravacao"
        >
          {processando ? 'Transcrevendo…' : '🎙 Gravar relato'}
        </button>
      )}

      {erro ? (
        <p className="erro" role="alert" data-testid="erro-transcricao">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
