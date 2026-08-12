import 'server-only';
import { z } from 'zod';
import { tipoRisco } from '@/lib/validacao/comum';
import type { EspecialidadeAssistente } from '@/lib/assistentes/catalogo';
import { carregarPrompt } from '@/lib/assistentes/prompt-loader';
import { MODELO_CAPAZ } from './openrouter';
import { type ChamadorModelo, gerarEstruturado } from './saida-estruturada';

/**
 * Condução do diálogo de refinamento (FR-006 a FR-009).
 *
 * O prompt canônico da especialidade é injetado como instrução de sistema — ele é a fonte do
 * comportamento (Princípio IV). O que este módulo acrescenta é apenas o contrato de saída, para
 * que o servidor consiga trabalhar com o resultado.
 *
 * `prontoParaEntrega` vem do modelo, mas quem decide é o portão em lib/dominio.
 */

export const saidaRefinamento = z.object({
  /** Texto conversacional exibido ao BP. */
  mensagem: z.string().min(1),
  novasLacunas: z
    .array(
      z.object({
        pergunta: z.string().min(5),
        critica: z.boolean(),
        porQueImporta: z.string().min(10),
      }),
    )
    .max(6),
  lacunasResolvidas: z.array(z.object({ lacunaId: z.string() })),
  risco: z.object({
    detectado: z.boolean(),
    tipos: z.array(tipoRisco),
  }),
  prontoParaEntrega: z.boolean(),
});

export type SaidaRefinamento = z.infer<typeof saidaRefinamento>;

const CONTRATO_SAIDA = `
Além de conduzir o atendimento conforme suas instruções, você deve estruturar a resposta assim:
- "mensagem": o que você diria ao Business Partner agora, em português do Brasil.
- "novasLacunas": informações que ainda faltam para você poder emitir a entrega final. Marque
  "critica": true quando a ausência daquela informação impedir uma conclusão segura.
  "porQueImporta" explica ao BP, em uma frase, por que você precisa daquele dado.
  NUNCA repita nem reformule uma pergunta já feita neste atendimento. Antes de propor uma
  pergunta, verifique as duas listas da entrada: se o assunto já foi perguntado — mesmo com
  outras palavras —, não proponha de novo. Reperguntar o que o BP já respondeu destrói a
  confiança dele na entrega final. Se nada de novo faltar, devolva "novasLacunas" vazio.
- "lacunasResolvidas": ids das lacunas que a última resposta do BP resolveu — inclusive lacunas
  abertas que ela esclareceu de passagem, não só aquela que foi perguntada. Use os ids entre
  colchetes na entrada.
- "risco": marque "detectado": true e liste os tipos quando a situação envolver assédio moral ou
  sexual, discriminação, fraude, demissão por justa causa, risco de ação trabalhista ou
  tratamento de dado pessoal sensível. Na dúvida, sinalize.
- "prontoParaEntrega": true apenas quando nenhuma informação crítica estiver faltando.

Nunca produza a entrega final nesta etapa. Aqui você apenas conduz o refinamento.
`.trim();

export type ContextoRefinamento = {
  especialidade: EspecialidadeAssistente;
  relato: string;
  lacunas: { id: string; pergunta: string; estado: string; resposta: string | null }[];
  ultimaMensagemDoBp?: string;
};

/**
 * As perguntas já feitas entram em DOIS blocos rotulados, não em uma lista única com o estado
 * ao lado. A distinção entre "já respondida" e "ainda aberta" passa a ser estrutural, em vez de
 * depender do modelo interpretar um sufixo — e o bloco das respondidas leva a instrução junto,
 * onde ela é mais difícil de ignorar (FR-008).
 */
export function montarEntrada(contexto: ContextoRefinamento): string {
  const resolvidas = contexto.lacunas
    .filter((l) => l.estado === 'respondida' || l.estado === 'nao_aplicavel')
    .map((l) =>
      l.estado === 'respondida'
        ? `- [${l.id}] ${l.pergunta}\n  Resposta do BP: ${l.resposta}`
        : `- [${l.id}] ${l.pergunta}\n  O BP declarou que não se aplica.`,
    )
    .join('\n');

  const abertas = contexto.lacunas
    .filter((l) => l.estado !== 'respondida' && l.estado !== 'nao_aplicavel')
    .map((l) => `- [${l.id}] ${l.pergunta}`)
    .join('\n');

  return [
    `Relato inicial do Business Partner:\n${contexto.relato}`,
    resolvidas
      ? `\nJÁ RESPONDIDAS — não pergunte nada disto de novo, nem com outras palavras:\n${resolvidas}`
      : '',
    abertas ? `\nAINDA ABERTAS — já perguntadas, aguardando resposta:\n${abertas}` : '',
    contexto.ultimaMensagemDoBp ? `\nÚltima resposta do BP:\n${contexto.ultimaMensagemDoBp}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function conduzirRefinamento(
  contexto: ContextoRefinamento,
  chamador?: ChamadorModelo,
): Promise<SaidaRefinamento> {
  const prompt = await carregarPrompt(contexto.especialidade.arquivoPrompt);

  const { dados } = await gerarEstruturado(
    {
      schema: saidaRefinamento,
      instrucaoSistema: `${prompt.conteudo}\n\n---\n\n${CONTRATO_SAIDA}`,
      entrada: montarEntrada(contexto),
      modelo: MODELO_CAPAZ,
      temperatura: 0.5,
      evento: 'refinamento',
    },
    chamador,
  );

  return dados;
}
