import { notFound } from 'next/navigation';
import { idUsuarioAutenticado } from '@/auth';
import { buscarAtendimentoCompleto } from '@/lib/dados/atendimentos';
import { registrarSeSensivel } from '@/lib/dados/auditoria';
import { avaliarPortao } from '@/lib/dominio/portao-refinamento';
import { mensagemEscalonamento, type SinalRisco } from '@/lib/dominio/deteccao-risco';
import { entregaParaMarkdown } from '@/lib/exportacao/markdown';
import { formatarDataHora } from '@/lib/formato';
import { Atendimento } from './Atendimento';

export const metadata = { title: 'Atendimento — Master BP' };

export default async function PaginaAtendimento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuarioId = await idUsuarioAutenticado();
  if (!usuarioId) notFound();

  const { id } = await params;
  const completo = await buscarAtendimentoCompleto(id, usuarioId);

  // Atendimento de outro BP cai aqui do mesmo jeito que um inexistente (FR-017).
  if (!completo) notFound();

  await registrarSeSensivel({
    atendimentoId: id,
    usuarioId,
    acao: 'acesso',
    classificacaoSigilo: completo.atendimento.classificacaoSigilo,
  });

  const portao = avaliarPortao(completo.lacunas);
  const sinais = completo.escalonamentos.map(
    (e) =>
      ({
        tipoRisco: e.tipoRisco,
        instanciaRecomendada: e.instanciaRecomendada,
        origemDeteccao: e.origemDeteccao,
        trechoGatilho: null,
      }) as SinalRisco,
  );

  return (
    <>
      <h1>{completo.assistente.nome}</h1>
      <p className="suave">
        Iniciado em {formatarDataHora(completo.atendimento.criadoEm)}
        {completo.atendimento.classificacaoSigilo === 'sensivel' ? ' · Atendimento restrito' : ''}
      </p>

      <Atendimento
        atendimentoId={id}
        estado={completo.atendimento.estado}
        mensagensIniciais={completo.mensagens.map((m) => ({
          id: m.id,
          autor: m.autor,
          conteudo: m.conteudo,
        }))}
        lacunasIniciais={portao.pendentes}
        prontoInicial={portao.liberada}
        escalonamentos={sinais}
        avisoEscalonamento={mensagemEscalonamento(sinais)}
        entregaInicial={
          completo.entrega
            ? {
                estruturaAplicada: completo.entrega.estruturaAplicada,
                conteudo: JSON.parse(completo.entrega.conteudo),
                planoAcao: JSON.parse(completo.entrega.planoAcao),
                marcacaoSigilo: completo.entrega.marcacaoSigilo,
                notaGuarda: completo.entrega.notaGuarda,
              }
            : null
        }
        markdownEntrega={
          completo.entrega
            ? entregaParaMarkdown({
                titulo: completo.assistente.nome,
                conteudo: JSON.parse(completo.entrega.conteudo),
                planoAcao: JSON.parse(completo.entrega.planoAcao),
                marcacaoSigilo: completo.entrega.marcacaoSigilo,
                notaGuarda: completo.entrega.notaGuarda,
                avisoEscalonamento: mensagemEscalonamento(sinais),
              })
            : ''
        }
      />
    </>
  );
}
