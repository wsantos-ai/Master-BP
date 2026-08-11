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
- "lacunasResolvidas": ids das lacunas que a última resposta do BP resolveu.
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

export function montarEntrada(contexto: ContextoRefinamento): string {
  const historico = contexto.lacunas
    .map((l) => {
      const situacao =
        l.estado === 'respondida'
          ? `respondida: ${l.resposta}`
          : l.estado === 'nao_aplicavel'
            ? 'declarada não aplicável pelo BP'
            : 'ainda aberta';
      return `- [${l.id}] ${l.pergunta} → ${situacao}`;
    })
    .join('\n');

  return [
    `Relato inicial do Business Partner:\n${contexto.relato}`,
    historico ? `\nPerguntas já feitas:\n${historico}` : '',
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
