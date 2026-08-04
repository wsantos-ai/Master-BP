import { z } from 'zod';
import { planoAcao } from '@/lib/validacao/comum';

/**
 * Prompt gerado pelo assistente de engenharia de prompts.
 * Fonte: lib/agentes/agente-prompt.md.
 *
 * `fluxoAcao` pode ser nulo apenas para agentes simples de pergunta-resposta — é a única
 * omissão que o prompt canônico autoriza. `restricoes` nunca pode ser vazia: negative
 * prompting é exigido sempre.
 */

export const entregaEngenhariaPrompts = z.object({
  promptGerado: z.object({
    persona: z.string().min(20),
    missao: z.string().min(20),
    fluxoAcao: z.array(z.string().min(1)).nullable(),
    dominios: z.array(z.string().min(1)).min(1),
    formatoSaida: z.string().min(10),
    tomDeVoz: z.string().min(10),
    restricoes: z.array(z.string().min(1)).min(1, 'Todo prompt exige restrições explícitas.'),
    orientacoesGerais: z.string().nullable(),
  }),
  porQueFunciona: z.string().min(30),
  tecnicasAplicadas: z
    .array(
      z.enum([
        'role_prompting',
        'chain_of_thought',
        'few_shot',
        'structured_output',
        'negative_prompting',
        'conditional_logic',
        'guardrails',
      ]),
    )
    .min(1),
  planoAcao,
});

export type EntregaEngenhariaPrompts = z.infer<typeof entregaEngenhariaPrompts>;
