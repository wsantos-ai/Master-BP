import { z } from 'zod';

/**
 * Uniões Zod para os campos de valor restrito.
 *
 * O conector SQLite do Prisma não suporta `enum` (research.md R-03), então o banco guarda
 * `String` e a garantia de valor vive aqui. Todo ponto que lê ou escreve esses campos passa
 * por estes schemas.
 */

export const estadoAtendimento = z.enum(['em_andamento', 'concluido', 'incompleto']);
export type EstadoAtendimento = z.infer<typeof estadoAtendimento>;

export const classificacaoSigilo = z.enum(['padrao', 'sensivel']);
export type ClassificacaoSigilo = z.infer<typeof classificacaoSigilo>;

export const marcacaoSigilo = z.enum(['publico_interno', 'restrito']);
export type MarcacaoSigilo = z.infer<typeof marcacaoSigilo>;

export const origemRelato = z.enum(['texto', 'audio']);
export type OrigemRelato = z.infer<typeof origemRelato>;

export const estadoLacuna = z.enum(['aberta', 'respondida', 'nao_aplicavel']);
export type EstadoLacuna = z.infer<typeof estadoLacuna>;

export const autorMensagem = z.enum(['bp', 'assistente']);
export type AutorMensagem = z.infer<typeof autorMensagem>;

export const tipoRisco = z.enum([
  'assedio_moral',
  'assedio_sexual',
  'discriminacao',
  'fraude',
  'justa_causa',
  'acao_trabalhista',
  'dado_sensivel',
]);
export type TipoRisco = z.infer<typeof tipoRisco>;

export const instanciaEscalonamento = z.enum(['juridico', 'relacoes_trabalhistas', 'compliance']);
export type InstanciaEscalonamento = z.infer<typeof instanciaEscalonamento>;

export const origemDeteccao = z.enum(['regra', 'modelo', 'ambos']);
export type OrigemDeteccao = z.infer<typeof origemDeteccao>;

export const acaoAuditoria = z.enum(['acesso', 'exportacao', 'exclusao', 'expurgo_retencao']);
export type AcaoAuditoria = z.infer<typeof acaoAuditoria>;

export const idAssistente = z.enum([
  'mentoria-bp',
  'etica-compliance',
  'comunicacao-lideranca',
  'treinamento-desenvolvimento',
  'engenharia-prompts',
]);
export type IdAssistente = z.infer<typeof idAssistente>;

/** Limite do relato. Acima disso o BP é orientado a segmentar — nunca truncamos em silêncio. */
export const LIMITE_RELATO = 20_000;

export const textoRelato = z
  .string()
  .trim()
  .min(1, 'Descreva a situação para começar o atendimento.')
  .max(LIMITE_RELATO, 'Relato acima do limite suportado.');

/** Item de plano de ação — obrigatório em toda entrega (FR-011). */
export const itemPlanoAcao = z.object({
  acao: z.string().min(1),
  responsavel: z.string().min(1),
  prazo: z.string().min(1),
});
export type ItemPlanoAcao = z.infer<typeof itemPlanoAcao>;

export const planoAcao = z.array(itemPlanoAcao).min(1, 'Toda recomendação exige plano de ação.');
