import { z } from 'zod';
import { planoAcao } from '@/lib/validacao/comum';

/**
 * Parecer técnico de ética e compliance — 7 seções obrigatórias.
 * Fonte: lib/agentes/agente-denuncias.md (Princípio IV e V).
 *
 * Seção ausente reprova a validação e a entrega é regenerada. É isto que torna SC-003
 * verificável de forma booleana.
 */

export const entregaEticaCompliance = z.object({
  cabecalho: z.object({
    codigoCaso: z.string().nullable(),
    dataElaboracao: z.string().min(1),
    classificacaoSigilo: z.literal('restrito'),
  }),
  resumoApuracao: z.string().min(30, 'O resumo da apuração não pode ser superficial.'),
  gravidade: z.object({
    nivel: z.enum(['baixa', 'media', 'alta']),
    justificativa: z.string().min(20),
  }),
  criteriosInvestigacao: z.object({
    escutaAtiva: z.string().min(10),
    apuracaoFatos: z.string().min(10),
    contextoAdicional: z.string().min(10),
    planoResolucao: z.string().min(10),
  }),
  embasamentoLegal: z
    .array(z.object({ referencia: z.string().min(1), aplicacao: z.string().min(1) }))
    .min(1, 'O parecer exige ao menos uma referência legal ou normativa.'),
  planoAcao,
  recomendacoesAdicionais: z.array(z.string().min(1)).min(1),
  notaGuarda: z.string().min(10, 'A nota de guarda em local seguro é obrigatória.'),
  /** Obrigatória quando a denúncia é anônima (FR-025). Nula caso contrário. */
  limitacoesAnonimato: z.string().nullable(),
});

export type EntregaEticaCompliance = z.infer<typeof entregaEticaCompliance>;
