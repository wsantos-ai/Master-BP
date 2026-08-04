/**
 * Ponto único de exportação dos schemas compartilhados.
 *
 * Regra do data-model: todo campo de valor restrito tem união Zod, e todo campo que guarda
 * JSON é parseado por Zod na leitura — dado corrompido falha alto, não silenciosamente.
 */
export * from './comum';
export * from './requisicoes';
