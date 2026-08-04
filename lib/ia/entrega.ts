import 'server-only';
import type { EspecialidadeAssistente } from '@/lib/assistentes/catalogo';
import { carregarPrompt } from '@/lib/assistentes/prompt-loader';
import { extrairPlanoAcao, obterEstrutura } from '@/lib/assistentes/estruturas';
import { avaliarVedacaoPunitiva, haFatosApurados } from '@/lib/dominio/vedacao-punitiva';
import { MODELO_CAPAZ } from './gemini';
import { type ChamadorModelo, gerarEstruturado } from './saida-estruturada';

/**
 * Geração da entrega final (FR-010, FR-011, FR-013).
 *
 * A entrega NÃO é transmitida por streaming (research.md R-10): ela é gerada, validada contra o
 * schema da especialidade e só então exibida. Transmitir mostraria ao BP um documento que ainda
 * pode ser rejeitado por seção ausente — exibir e retirar é pior que esperar.
 *
 * Duas verificações antes de devolver:
 *   1. Estrutura obrigatória (Princípio V) — feita pelo schema em gerarEstruturado.
 *   2. Vedação punitiva (FR-013) — feita aqui, sobre o plano de ação produzido.
 */

export class ErroVedacaoPunitiva extends Error {
  constructor(
    message: string,
    readonly itens: string[],
  ) {
    super(message);
  }
}

export type ContextoEntrega = {
  especialidade: EspecialidadeAssistente;
  relato: string;
  lacunas: { pergunta: string; estado: string; resposta: string | null; justificativaNaoAplicavel: string | null }[];
  denunciaAnonima?: boolean;
};

function montarEntrada(contexto: ContextoEntrega): string {
  const refinamento = contexto.lacunas
    .map((l) => {
      if (l.estado === 'respondida') return `- ${l.pergunta}\n  Resposta: ${l.resposta}`;
      if (l.estado === 'nao_aplicavel')
        return `- ${l.pergunta}\n  Não se aplica: ${l.justificativaNaoAplicavel}`;
      return `- ${l.pergunta}\n  (sem resposta — informação não crítica)`;
    })
    .join('\n');

  return [
    `Relato inicial:\n${contexto.relato}`,
    refinamento ? `\nRefinamento realizado:\n${refinamento}` : '',
    contexto.denunciaAnonima
      ? '\nA denúncia é anônima: sinalize as limitações probatórias decorrentes disso.'
      : '',
    '\nProduza agora a entrega final completa, seguindo integralmente a estrutura obrigatória da sua especialidade.',
  ]
    .filter(Boolean)
    .join('\n');
}

export type EntregaGerada = {
  conteudo: unknown;
  planoAcao: { acao: string; responsavel: string; prazo: string }[];
  modelo: string;
};

export async function gerarEntrega(
  contexto: ContextoEntrega,
  chamador?: ChamadorModelo,
): Promise<EntregaGerada> {
  const prompt = await carregarPrompt(contexto.especialidade.arquivoPrompt);
  const schema = obterEstrutura(contexto.especialidade.estruturaEntrega);

  const { dados, modelo } = await gerarEstruturado(
    {
      schema,
      instrucaoSistema: `${prompt.conteudo}\n\n---\n\nResponda exclusivamente com a entrega final estruturada, em português do Brasil. Toda recomendação deve vir acompanhada de plano de ação com responsáveis e prazos.`,
      entrada: montarEntrada(contexto),
      modelo: MODELO_CAPAZ,
      temperatura: 0.4,
      evento: 'entrega',
    },
    chamador,
  );

  const planoAcao = extrairPlanoAcao(dados);

  // FR-013: o plano não pode propor punição sem fatos apurados registrados no atendimento.
  const respostas = contexto.lacunas.map((l) => l.resposta);
  const vedacao = avaliarVedacaoPunitiva({
    planoAcao,
    fatosRegistrados: haFatosApurados(respostas),
  });

  if (!vedacao.permitido) {
    throw new ErroVedacaoPunitiva(vedacao.motivo, vedacao.itens);
  }

  return { conteudo: dados, planoAcao, modelo };
}
