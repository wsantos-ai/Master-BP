import { z } from 'zod';
import { planoAcao } from '@/lib/validacao/comum';

/**
 * Entrega de T&D — 6 seções obrigatórias.
 * Fonte: lib/agentes/agente-treinamento.md.
 */

export const entregaTreinamento = z.object({
  objetivoEstrategico: z.object({
    descricao: z.string().min(20),
    roiEsperado: z.string().min(10),
    kpis: z.array(z.string().min(1)).min(1, 'Treinamento sem KPI não conecta a resultado.'),
  }),
  metodologia: z.object({
    nome: z.string().min(1),
    porQueEscolhida: z.string().min(20),
  }),
  planoAula: z
    .array(
      z.object({
        modulo: z.string().min(1),
        duracao: z.string().min(1),
        descricao: z.string().min(1),
        recurso: z.string().min(1),
      }),
    )
    .min(1, 'O plano de aula não pode ser vazio.'),
  roteiroSlides: z
    .array(
      z.object({
        numero: z.number().int().positive(),
        titulo: z.string().min(1),
        pontosChave: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1, 'O roteiro de slides não pode ser vazio.'),
  dicasFacilitacao: z.array(z.string().min(1)).min(1),
  /** Quatro níveis de Kirkpatrick — todos obrigatórios. */
  indicadoresAvaliacao: z.object({
    reacao: z.string().min(1),
    aprendizagem: z.string().min(1),
    comportamento: z.string().min(1),
    resultado: z.string().min(1),
  }),
  planoAcao,
  /** Preenchido apenas quando o BP solicita a apresentação visual. */
  promptCanva: z.string().nullable(),
});

export type EntregaTreinamento = z.infer<typeof entregaTreinamento>;
