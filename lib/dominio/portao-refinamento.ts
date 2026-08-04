import type { EstadoLacuna } from '@/lib/validacao/comum';

/**
 * Portão de refinamento — Princípio II (research.md R-01 e R-04).
 *
 * A regra: a entrega final não sai enquanto houver lacuna crítica aberta. A decisão é tomada
 * AQUI, sobre o estado persistido do atendimento, e não a partir do que o modelo afirma.
 *
 * O modelo devolve um campo `prontoParaEntrega`; ele é sinal, não decisão. Se ele disser que
 * está pronto e existir lacuna crítica aberta, prevalece este módulo. Foi por isso que o
 * portão saiu do prompt e virou código: um prompt não é testável nem sobrevive à troca de
 * modelo, e SC-005 não admite exceção.
 */

export type LacunaAvaliavel = {
  id: string;
  pergunta: string;
  porQueImporta: string;
  critica: boolean;
  estado: EstadoLacuna;
  resposta: string | null;
  justificativaNaoAplicavel: string | null;
  ordem: number;
};

export type LacunaPendente = {
  id: string;
  pergunta: string;
  porQueImporta: string;
};

export type AvaliacaoPortao = {
  liberada: boolean;
  pendentes: LacunaPendente[];
  totalAbertas: number;
  totalResolvidas: number;
};

/**
 * Uma lacuna está resolvida quando foi respondida com conteúdo, ou declarada não aplicável com
 * justificativa (FR-008). Estado sem o dado correspondente é tratado como NÃO resolvido: um
 * registro inconsistente não pode virar passe livre.
 */
export function lacunaResolvida(lacuna: LacunaAvaliavel): boolean {
  if (lacuna.estado === 'respondida') {
    return (lacuna.resposta ?? '').trim().length > 0;
  }
  if (lacuna.estado === 'nao_aplicavel') {
    return (lacuna.justificativaNaoAplicavel ?? '').trim().length > 0;
  }
  return false;
}

export function avaliarPortao(lacunas: LacunaAvaliavel[]): AvaliacaoPortao {
  const naoResolvidas = lacunas.filter((l) => !lacunaResolvida(l));
  const criticasAbertas = naoResolvidas.filter((l) => l.critica);

  return {
    liberada: criticasAbertas.length === 0,
    pendentes: criticasAbertas
      .sort((a, b) => a.ordem - b.ordem)
      .map((l) => ({ id: l.id, pergunta: l.pergunta, porQueImporta: l.porQueImporta })),
    totalAbertas: naoResolvidas.length,
    totalResolvidas: lacunas.length - naoResolvidas.length,
  };
}

/** Predicado usado pela rota de entrega. Nome explícito porque é o coração do Princípio II. */
export function podeEmitirEntrega(lacunas: LacunaAvaliavel[]): boolean {
  return avaliarPortao(lacunas).liberada;
}

/**
 * Próxima pergunta na retomada (US2, SC-008): a lacuna não resolvida de menor ordem.
 * Críticas primeiro — são elas que bloqueiam a conclusão.
 */
export function proximaPergunta(lacunas: LacunaAvaliavel[]): LacunaAvaliavel | null {
  const naoResolvidas = lacunas
    .filter((l) => !lacunaResolvida(l))
    .sort((a, b) => {
      if (a.critica !== b.critica) return a.critica ? -1 : 1;
      return a.ordem - b.ordem;
    });
  return naoResolvidas[0] ?? null;
}

/**
 * Reconcilia o sinal do modelo com o estado real.
 * Divergência é registrada pelo chamador; o valor que vale é sempre o do servidor.
 */
export function reconciliarComSinalDoModelo(
  lacunas: LacunaAvaliavel[],
  prontoSegundoModelo: boolean,
): { pronto: boolean; divergiu: boolean } {
  const pronto = podeEmitirEntrega(lacunas);
  return { pronto, divergiu: pronto !== prontoSegundoModelo };
}

export function proximaOrdem(lacunas: { ordem: number }[]): number {
  return lacunas.reduce((maior, l) => Math.max(maior, l.ordem), 0) + 1;
}
