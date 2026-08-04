import { z } from 'zod';
import { planoAcao } from '@/lib/validacao/comum';

/**
 * Comunicação de liderança.
 * Fonte: lib/agentes/agente-mensagens.md.
 *
 * As regras por formato do prompt canônico viram `superRefine` aqui: saudação obrigatória no
 * e-mail, limite de 5 parágrafos no informal, assunto no comunicado oficial.
 */

const SAUDACOES_EMAIL = /^(bom dia|boa tarde|boa noite)/i;
const MAX_PARAGRAFOS_INFORMAL = 5;

export const entregaComunicacao = z
  .object({
    formato: z.enum(['informal', 'email', 'comunicado_oficial']),
    assunto: z.string().nullable(),
    corpo: z.string().min(20),
    escalonamento: z.object({
      necessario: z.boolean(),
      situacao: z.string().nullable(),
      acaoRecomendada: z.string().nullable(),
    }),
    /** O agente não é só redator: orienta o líder sobre como conduzir o envio. */
    orientacaoConducao: z.string().min(20),
    planoAcao,
  })
  .superRefine((valor, ctx) => {
    if (valor.formato === 'email') {
      if (!SAUDACOES_EMAIL.test(valor.corpo.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['corpo'],
          message: 'E-mail deve iniciar com "Bom dia / Boa tarde / Boa noite, tudo bem?".',
        });
      }
      if (!valor.assunto) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['assunto'],
          message: 'E-mail exige assunto.',
        });
      }
    }

    if (valor.formato === 'informal') {
      const paragrafos = valor.corpo.split(/\n{2,}/).filter((p) => p.trim().length > 0);
      if (paragrafos.length > MAX_PARAGRAFOS_INFORMAL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['corpo'],
          message: `Mensagem informal deve ter no máximo ${MAX_PARAGRAFOS_INFORMAL} parágrafos.`,
        });
      }
    }

    if (valor.formato === 'comunicado_oficial' && !valor.assunto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assunto'],
        message: 'Comunicado oficial exige assunto.',
      });
    }

    if (valor.escalonamento.necessario) {
      if (!valor.escalonamento.situacao || !valor.escalonamento.acaoRecomendada) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['escalonamento'],
          message: 'Escalonamento necessário exige situação e ação recomendada.',
        });
      }
    }
  });

export type EntregaComunicacao = z.infer<typeof entregaComunicacao>;
