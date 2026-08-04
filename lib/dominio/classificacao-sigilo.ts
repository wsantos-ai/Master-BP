import type { ClassificacaoSigilo, MarcacaoSigilo } from '@/lib/validacao/comum';
import type { SinalRisco } from './deteccao-risco';

/**
 * Classificação de sigilo (FR-023, Princípio I).
 *
 * Dois caminhos levam a "sensível":
 *  - a especialidade é sensível por natureza (compliance/denúncias);
 *  - o conteúdo disparou algum sinal de risco.
 *
 * Na dúvida, sensível. Classificar a mais custa uma trilha de auditoria extra; classificar a
 * menos deixa dado de colaborador sem a proteção que a constituição exige.
 */

export function classificarAtendimento(params: {
  especialidadeSensivelPorPadrao: boolean;
  sinaisRisco: SinalRisco[];
}): ClassificacaoSigilo {
  if (params.especialidadeSensivelPorPadrao) return 'sensivel';
  if (params.sinaisRisco.length > 0) return 'sensivel';
  return 'padrao';
}

export function marcacaoParaEntrega(classificacao: ClassificacaoSigilo): MarcacaoSigilo {
  return classificacao === 'sensivel' ? 'restrito' : 'publico_interno';
}

export const NOTA_GUARDA_PADRAO =
  'Documento restrito. Guardar em local seguro, de acesso controlado, e compartilhar apenas ' +
  'com quem tem necessidade explícita de conhecer.';

/** Entrega restrita sem nota de guarda é inválida (FR-022). */
export function notaGuardaObrigatoria(
  marcacao: MarcacaoSigilo,
  notaExistente: string | null,
): string | null {
  if (marcacao !== 'restrito') return notaExistente;
  return notaExistente && notaExistente.trim().length > 0 ? notaExistente : NOTA_GUARDA_PADRAO;
}
