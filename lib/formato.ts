/**
 * Formatação pt-BR (FR-029).
 *
 * Datas são persistidas em UTC (regra transversal 4 do data-model); a conversão para o fuso e
 * o idioma do usuário acontece só na apresentação.
 */

const FUSO = 'America/Sao_Paulo';

export function formatarData(data: Date | string): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: FUSO }).format(d);
}

export function formatarDataHora(data: Date | string): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: FUSO,
  }).format(d);
}

export function formatarDataExtenso(data: Date | string): string {
  const d = typeof data === 'string' ? new Date(data) : data;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: FUSO }).format(d);
}
