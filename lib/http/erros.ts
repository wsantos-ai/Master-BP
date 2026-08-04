import { NextResponse } from 'next/server';

/**
 * Envelope padrão de erro (contracts/api.md).
 *
 * `mensagem` é legível pelo BP, em pt-BR. `detalhes` carrega apenas estrutura — nunca trecho de
 * relato, resposta ou entrega (Princípio I).
 */

export type CodigoErro =
  | 'NAO_AUTENTICADO'
  | 'NAO_ENCONTRADO'
  | 'ENTRADA_INVALIDA'
  | 'RELATO_MUITO_EXTENSO'
  | 'FORA_DE_ESCOPO'
  | 'REFINAMENTO_INCOMPLETO'
  | 'ESTADO_INVALIDO'
  | 'ESTRUTURA_INVALIDA'
  | 'TRANSCRICAO_FALHOU'
  | 'PROVEDOR_INDISPONIVEL'
  | 'ERRO_INTERNO';

const STATUS: Record<CodigoErro, number> = {
  NAO_AUTENTICADO: 401,
  NAO_ENCONTRADO: 404,
  ENTRADA_INVALIDA: 400,
  RELATO_MUITO_EXTENSO: 400,
  FORA_DE_ESCOPO: 422,
  REFINAMENTO_INCOMPLETO: 422,
  ESTADO_INVALIDO: 409,
  ESTRUTURA_INVALIDA: 502,
  TRANSCRICAO_FALHOU: 422,
  PROVEDOR_INDISPONIVEL: 503,
  ERRO_INTERNO: 500,
};

export const MENSAGEM_PADRAO: Record<CodigoErro, string> = {
  NAO_AUTENTICADO: 'Faça login para continuar.',
  NAO_ENCONTRADO: 'Atendimento não encontrado.',
  ENTRADA_INVALIDA: 'Os dados enviados não são válidos.',
  RELATO_MUITO_EXTENSO:
    'O relato ultrapassa o limite suportado. Divida-o em partes para não perder informação.',
  FORA_DE_ESCOPO: 'Esta demanda está fora dos domínios de gestão de pessoas atendidos aqui.',
  REFINAMENTO_INCOMPLETO: 'Faltam informações para concluir com segurança.',
  ESTADO_INVALIDO: 'A operação não é possível no estado atual do atendimento.',
  ESTRUTURA_INVALIDA:
    'A resposta do assistente não seguiu a estrutura obrigatória. Nada foi salvo — tente novamente.',
  TRANSCRICAO_FALHOU:
    'Não foi possível transcrever o áudio. Você pode digitar o relato para continuar.',
  PROVEDOR_INDISPONIVEL:
    'O assistente está indisponível no momento. Suas respostas foram preservadas.',
  ERRO_INTERNO: 'Algo deu errado. Tente novamente.',
};

export type DetalhesErro = Record<string, unknown>;

export function respostaErro(
  codigo: CodigoErro,
  mensagem?: string,
  detalhes?: DetalhesErro,
): NextResponse {
  return NextResponse.json(
    {
      erro: {
        codigo,
        mensagem: mensagem ?? MENSAGEM_PADRAO[codigo],
        ...(detalhes ? { detalhes } : {}),
      },
    },
    { status: STATUS[codigo] },
  );
}

/**
 * Atendimento inexistente e atendimento de outro BP recebem a MESMA resposta.
 * Diferenciar 403 de 404 confirmaria a existência do registro alheio (FR-017).
 */
export function respostaNaoEncontrado(): NextResponse {
  return respostaErro('NAO_ENCONTRADO');
}
