import { NOTA_GUARDA_PADRAO } from '@/lib/dominio/classificacao-sigilo';

/**
 * Marcação de sigilo aplicada aos documentos exportados (FR-022).
 *
 * Vale para os três formatos: o documento sai do app e passa a circular por e-mail, pasta de
 * rede, impressão. A marcação é o que faz a restrição viajar junto com o conteúdo.
 */

export const CABECALHO_RESTRITO = 'DOCUMENTO RESTRITO — ACESSO CONTROLADO';

export type MarcacaoAplicada = {
  cabecalho: string | null;
  notaGuarda: string | null;
};

export function aplicarMarcacao(
  marcacaoSigilo: string,
  notaGuardaExistente: string | null,
): MarcacaoAplicada {
  if (marcacaoSigilo !== 'restrito') {
    return { cabecalho: null, notaGuarda: notaGuardaExistente };
  }

  return {
    cabecalho: CABECALHO_RESTRITO,
    notaGuarda:
      notaGuardaExistente && notaGuardaExistente.trim().length > 0
        ? notaGuardaExistente
        : NOTA_GUARDA_PADRAO,
  };
}

/** Nome do arquivo exportado. Sem conteúdo do caso no nome — ele aparece em listagens. */
export function nomeArquivo(
  especialidade: string,
  atendimentoId: string,
  extensao: string,
): string {
  const data = new Date().toISOString().slice(0, 10);
  return `${especialidade}-${data}-${atendimentoId.slice(0, 8)}.${extensao}`;
}
