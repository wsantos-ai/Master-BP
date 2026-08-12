import type { EstadoLacuna } from '@/lib/validacao/comum';

/**
 * Aproveitamento de resposta entre lacunas — Princípio II (feature 003, FR-002 e FR-003).
 *
 * O assistente indica, a cada rodada, quais pendências a última resposta do BP esclareceu —
 * inclusive pendências que não foram as perguntadas. Até esta feature, o sinal era pedido no
 * contrato de saída e descartado no servidor, e por isso uma informação já dada continuava
 * bloqueando o portão indefinidamente.
 *
 * **Por que usar o sinal não entrega o portão ao modelo**: esta função não fecha nada. Ela
 * devolve os ids que o chamador pode fechar, e o chamador fecha gravando a resposta REAL do BP
 * naquela lacuna. Como `lacunaResolvida()` exige conteúdo de resposta não vazio, o predicado do
 * Princípio II continua valendo sem alteração. Se o modelo mentir, o pior que consegue é
 * associar uma resposta verdadeira à pergunta errada — nunca fabricar uma resposta que não
 * existe, nem liberar a entrega sem que o BP tenha falado.
 */

export type SinalResolucao = { lacunaId: string };

export type LacunaConhecida = {
  id: string;
  estado: EstadoLacuna;
  resposta: string | null;
  justificativaNaoAplicavel: string | null;
};

export type ResultadoAproveitamento = {
  /** Lacunas que o chamador pode fechar, gravando nelas o conteúdo do BP. */
  idsParaFechar: string[];
  /** Sinais descartados: id desconhecido, de outro atendimento, ou já resolvido. */
  ignorados: number;
};

export function aproveitarResolucoes(params: {
  sinais: SinalResolucao[];
  lacunasDoAtendimento: LacunaConhecida[];
  lacunaRespondidaDiretamente: string | null;
  conteudoDoBp: string;
}): ResultadoAproveitamento {
  const { sinais, lacunasDoAtendimento, lacunaRespondidaDiretamente, conteudoDoBp } = params;

  // 🚨 FR-002: sem conteúdo do BP nesta rodada, nada é aproveitado — por mais que o assistente
  // declare o atendimento inteiro resolvido. O sinal é evidência de que uma resposta cobre uma
  // pendência; ele nunca substitui a resposta.
  if (conteudoDoBp.trim().length === 0) {
    return { idsParaFechar: [], ignorados: sinais.length };
  }

  const porId = new Map(lacunasDoAtendimento.map((l) => [l.id, l]));
  const idsParaFechar: string[] = [];
  const jaIncluidos = new Set<string>();
  let ignorados = 0;

  for (const { lacunaId } of sinais) {
    // A lacuna respondida diretamente é fechada pelo caminho de sempre, com origem própria.
    // Contá-la aqui produziria origem errada na auditoria.
    if (lacunaId === lacunaRespondidaDiretamente) continue;

    if (jaIncluidos.has(lacunaId)) continue;

    const lacuna = porId.get(lacunaId);

    // Id desconhecido: inventado pelo modelo ou pertencente a outro atendimento. Descartado sem
    // erro — uma rodada não pode ser interrompida por ruído do provedor (FR-003).
    if (!lacuna) {
      ignorados += 1;
      continue;
    }

    if (lacuna.estado !== 'aberta') {
      ignorados += 1;
      continue;
    }

    idsParaFechar.push(lacunaId);
    jaIncluidos.add(lacunaId);
  }

  return { idsParaFechar, ignorados };
}
