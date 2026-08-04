import 'server-only';
import { z } from 'zod';
import { CATALOGO } from '@/lib/assistentes/catalogo';
import { idAssistente } from '@/lib/validacao/comum';
import { MODELO_RAPIDO } from './gemini';
import { type ChamadorModelo, gerarEstruturado } from './saida-estruturada';

/**
 * Roteamento de especialidade (FR-002, FR-004, FR-005).
 *
 * O modelo classifica; o servidor decide o que fazer com a classificação:
 *  - fora de escopo → bloqueia a criação do atendimento, com motivo;
 *  - duas sugestões próximas → apresenta as opções, sem pré-selecionar (FR-004).
 */

export const LIMIAR_AMBIGUIDADE = 0.15;

export const saidaRoteamento = z.object({
  sugestoes: z
    .array(
      z.object({
        assistenteId: idAssistente,
        justificativa: z.string().min(10),
        confianca: z.number().min(0).max(1),
      }),
    )
    .max(2),
  foraDeEscopo: z.boolean(),
  motivoRecusa: z.string().nullable(),
});

export type SaidaRoteamento = z.infer<typeof saidaRoteamento>;

export type ResultadoRoteamento = {
  sugestoes: { assistenteId: string; nome: string; justificativa: string; confianca: number }[];
  ambigua: boolean;
  foraDeEscopo: boolean;
  motivoRecusa?: string;
};

function montarInstrucao(): string {
  const especialidades = CATALOGO.map(
    (e) =>
      `- ${e.id} — ${e.nome}: ${e.descricao}\n  Domínios: ${e.dominios.join('; ')}\n  Exemplos: ${e.exemplosDemanda.join('; ')}`,
  ).join('\n');

  return `Você classifica demandas de um Business Partner de RH e indica qual assistente especializado deve atendê-la.

Especialidades disponíveis:
${especialidades}

Regras:
1. Indique de 1 a 2 especialidades, ordenadas por aderência. Duas apenas quando a demanda for genuinamente compatível com ambas.
2. A justificativa deve explicar ao BP, em uma frase, por que aquela especialidade atende a demanda dele.
3. "confianca" é sua certeza na indicação, de 0 a 1.
4. Se a demanda estiver fora dos domínios de gestão de pessoas (fiscal, logística, TI, jurídico societário, etc.), marque foraDeEscopo=true, deixe sugestoes vazio e explique o motivo em motivoRecusa, em português do Brasil.
5. Responda sempre em português do Brasil.`;
}

export async function rotear(
  relato: string,
  chamador?: ChamadorModelo,
): Promise<ResultadoRoteamento> {
  const { dados } = await gerarEstruturado(
    {
      schema: saidaRoteamento,
      instrucaoSistema: montarInstrucao(),
      entrada: relato,
      modelo: MODELO_RAPIDO,
      temperatura: 0.2,
      evento: 'roteamento',
    },
    chamador,
  );

  return interpretarRoteamento(dados);
}

/**
 * Traduz a saída do modelo para a decisão do servidor. Separado da chamada para ser testável
 * sem provedor.
 */
export function interpretarRoteamento(dados: SaidaRoteamento): ResultadoRoteamento {
  if (dados.foraDeEscopo) {
    return {
      sugestoes: [],
      ambigua: false,
      foraDeEscopo: true,
      motivoRecusa:
        dados.motivoRecusa ??
        'Esta demanda está fora dos domínios de gestão de pessoas atendidos aqui.',
    };
  }

  const sugestoes = dados.sugestoes
    .map((s) => {
      const especialidade = CATALOGO.find((e) => e.id === s.assistenteId);
      return especialidade
        ? {
            assistenteId: s.assistenteId,
            nome: especialidade.nome,
            justificativa: s.justificativa,
            confianca: s.confianca,
          }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.confianca - a.confianca);

  // Sem sugestão utilizável, tratamos como fora de escopo em vez de escolher por conta própria.
  if (sugestoes.length === 0) {
    return {
      sugestoes: [],
      ambigua: false,
      foraDeEscopo: true,
      motivoRecusa: 'Não foi possível identificar uma especialidade para esta demanda.',
    };
  }

  const primeira = sugestoes[0]!;
  const segunda = sugestoes[1];
  const ambigua = segunda !== undefined && primeira.confianca - segunda.confianca < LIMIAR_AMBIGUIDADE;

  return { sugestoes, ambigua, foraDeEscopo: false };
}
