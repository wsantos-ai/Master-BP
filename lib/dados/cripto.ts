import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Cifragem dos campos sensíveis em repouso (research.md R-08, Princípio I).
 *
 * SQLite é um arquivo no disco do servidor: sem isto, uma cópia do arquivo entrega todo o
 * histórico de RH da organização. Cifra-se conteúdo (relato, diálogo, entrega); metadados
 * usados em filtro e expurgo permanecem em claro, ou o histórico e a retenção parariam de
 * funcionar.
 *
 * Formato do texto cifrado: v1:<iv-base64>:<tag-base64>:<dados-base64>
 * O prefixo de versão permite trocar o algoritmo depois sem ambiguidade na leitura.
 */

const ALGORITMO = 'aes-256-gcm';
const VERSAO = 'v1';
const TAMANHO_IV = 12; // recomendado para GCM
const TAMANHO_CHAVE = 32;

let chaveCache: Buffer | null = null;

export class ErroCripto extends Error {}

function obterChave(): Buffer {
  if (chaveCache) return chaveCache;

  const bruta = process.env.CHAVE_CRIPTO;
  if (!bruta) {
    throw new ErroCripto(
      'CHAVE_CRIPTO ausente. A aplicação não opera sem cifragem de dados sensíveis.',
    );
  }

  let chave: Buffer;
  try {
    chave = Buffer.from(bruta, 'base64');
  } catch {
    throw new ErroCripto('CHAVE_CRIPTO não é base64 válido.');
  }

  if (chave.length !== TAMANHO_CHAVE) {
    throw new ErroCripto(
      `CHAVE_CRIPTO deve ter ${TAMANHO_CHAVE} bytes em base64 (recebido: ${chave.length}).`,
    );
  }

  chaveCache = chave;
  return chave;
}

/** Usado apenas em teste, quando a variável de ambiente muda entre casos. */
export function limparCacheChave(): void {
  chaveCache = null;
}

export function cifrar(texto: string): string {
  const chave = obterChave();
  const iv = randomBytes(TAMANHO_IV);
  const cifrador = createCipheriv(ALGORITMO, chave, iv);

  const dados = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  const tag = cifrador.getAuthTag();

  return [VERSAO, iv.toString('base64'), tag.toString('base64'), dados.toString('base64')].join(
    ':',
  );
}

export function decifrar(cifrado: string): string {
  const chave = obterChave();
  const partes = cifrado.split(':');

  if (partes.length !== 4 || partes[0] !== VERSAO) {
    throw new ErroCripto('Formato de texto cifrado inválido.');
  }

  const [, ivB64, tagB64, dadosB64] = partes as [string, string, string, string];

  try {
    const decifrador = createDecipheriv(ALGORITMO, chave, Buffer.from(ivB64, 'base64'));
    decifrador.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decifrador.update(Buffer.from(dadosB64, 'base64')),
      decifrador.final(),
    ]).toString('utf8');
  } catch {
    // GCM falha aqui se o dado foi adulterado ou a chave é outra. Falhar alto é o correto:
    // devolver texto parcial seria pior que devolver erro.
    throw new ErroCripto('Não foi possível decifrar o conteúdo.');
  }
}

export function cifrarOpcional(texto: string | null | undefined): string | null {
  return texto == null ? null : cifrar(texto);
}

export function decifrarOpcional(cifrado: string | null | undefined): string | null {
  return cifrado == null ? null : decifrar(cifrado);
}
