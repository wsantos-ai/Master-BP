import type { z } from 'zod';
import type { IdAssistente } from '@/lib/validacao/comum';
import { entregaEticaCompliance } from './etica-compliance';
import { entregaTreinamento } from './treinamento-desenvolvimento';
import { entregaComunicacao } from './comunicacao-lideranca';
import { entregaMentoria } from './mentoria-bp';
import { entregaEngenhariaPrompts } from './engenharia-prompts';

/**
 * Registro especialidade → schema da entrega (Princípio V).
 *
 * A entrega só é persistida depois de aprovada pelo schema correspondente. Nenhum caminho de
 * escrita ignora este mapa.
 */

export const ESTRUTURAS = {
  'etica-compliance': entregaEticaCompliance,
  'treinamento-desenvolvimento': entregaTreinamento,
  'comunicacao-lideranca': entregaComunicacao,
  'mentoria-bp': entregaMentoria,
  'engenharia-prompts': entregaEngenhariaPrompts,
} as const satisfies Record<IdAssistente, z.ZodTypeAny>;

export type IdEstrutura = keyof typeof ESTRUTURAS;

export function obterEstrutura(id: string) {
  const schema = ESTRUTURAS[id as IdEstrutura];
  if (!schema) {
    throw new Error(`Estrutura de entrega desconhecida: ${id}`);
  }
  return schema;
}

/** Extrai o plano de ação de qualquer entrega — todas o possuem (FR-011). */
export function extrairPlanoAcao(conteudo: unknown): { acao: string; responsavel: string; prazo: string }[] {
  if (conteudo && typeof conteudo === 'object' && 'planoAcao' in conteudo) {
    return (conteudo as { planoAcao: { acao: string; responsavel: string; prazo: string }[] })
      .planoAcao;
  }
  return [];
}

export {
  entregaEticaCompliance,
  entregaTreinamento,
  entregaComunicacao,
  entregaMentoria,
  entregaEngenhariaPrompts,
};
