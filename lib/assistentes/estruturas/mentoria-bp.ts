import { z } from 'zod';
import { planoAcao } from '@/lib/validacao/comum';

/**
 * Orientação estratégica de mentoria.
 * Fonte: lib/agentes/agente-bp.md.
 *
 * As quatro perspectivas da análise são obrigatórias, e a fundamentação não pode ser vazia:
 * recomendação sem embasamento reprova (Princípio V).
 */

export const entregaMentoria = z.object({
  diagnostico: z.string().min(30),
  analiseEstrategica: z.object({
    pessoas: z.string().min(10),
    processos: z.string().min(10),
    cultura: z.string().min(10),
    resultados: z.string().min(10),
  }),
  orientacao: z.object({
    recomendacao: z.string().min(30),
    fundamentacao: z
      .array(z.object({ fonte: z.string().min(1), aplicacao: z.string().min(1) }))
      .min(1, 'Recomendação sem fundamentação não é orientação — é opinião.'),
  }),
  indicadoresSugeridos: z.array(z.string().min(1)).min(1),
  planoAcao,
});

export type EntregaMentoria = z.infer<typeof entregaMentoria>;
