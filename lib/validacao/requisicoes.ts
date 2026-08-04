import { z } from 'zod';
import {
  estadoAtendimento,
  idAssistente,
  origemRelato,
  textoRelato,
} from './comum';

/**
 * Schemas de entrada das rotas HTTP, conforme contracts/api.md.
 * Validados na fronteira: nada entra no domínio sem passar por aqui.
 */

export const requisicaoRoteamento = z.object({
  relato: textoRelato,
});
export type RequisicaoRoteamento = z.infer<typeof requisicaoRoteamento>;

export const requisicaoCriarAtendimento = z.object({
  relato: textoRelato,
  assistenteId: idAssistente,
  origemRelato: origemRelato.default('texto'),
  trocaManual: z.boolean().default(false),
});
export type RequisicaoCriarAtendimento = z.infer<typeof requisicaoCriarAtendimento>;

export const requisicaoMensagem = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('resposta'),
    lacunaId: z.string().min(1),
    conteudo: z.string().trim().min(1, 'Responda a pergunta para seguir.').max(10_000),
  }),
  z.object({
    tipo: z.literal('nao_aplicavel'),
    lacunaId: z.string().min(1),
    justificativa: z
      .string()
      .trim()
      .min(10, 'Explique por que esta informação não se aplica ao caso.')
      .max(2_000),
  }),
]);
export type RequisicaoMensagem = z.infer<typeof requisicaoMensagem>;

export const filtrosHistorico = z.object({
  especialidade: idAssistente.optional(),
  estado: estadoAtendimento.optional(),
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(20),
});
export type FiltrosHistorico = z.infer<typeof filtrosHistorico>;

export const requisicaoExportacao = z.object({
  formato: z.enum(['docx', 'pdf', 'markdown']),
});
export type RequisicaoExportacao = z.infer<typeof requisicaoExportacao>;

export const credenciaisLogin = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
});
export type CredenciaisLogin = z.infer<typeof credenciaisLogin>;
