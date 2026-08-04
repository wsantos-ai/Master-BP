import { afterEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { ErroCripto, cifrar, decifrar, limparCacheChave } from '@/lib/dados/cripto';

const CHAVE_ORIGINAL = process.env.CHAVE_CRIPTO;

function usarChave(valor: string | undefined) {
  if (valor === undefined) {
    delete process.env.CHAVE_CRIPTO;
  } else {
    process.env.CHAVE_CRIPTO = valor;
  }
  limparCacheChave();
}

afterEach(() => usarChave(CHAVE_ORIGINAL));

describe('cifragem de campos sensíveis', () => {
  it('devolve o texto original na ida e volta', () => {
    const original = 'Relato: o gestor humilhou a colaboradora na frente da equipe.';
    expect(decifrar(cifrar(original))).toBe(original);
  });

  it('preserva acentuação e quebras de linha', () => {
    const original = 'Ação disciplinar\nJustificativa: reincidência não comprovada — apurar.';
    expect(decifrar(cifrar(original))).toBe(original);
  });

  it('produz saídas diferentes para o mesmo texto (IV aleatório)', () => {
    const texto = 'mesmo conteúdo';
    expect(cifrar(texto)).not.toBe(cifrar(texto));
  });

  it('não deixa o texto em claro visível no resultado', () => {
    const cifrado = cifrar('assédio moral reiterado');
    expect(cifrado).not.toContain('assédio');
    expect(cifrado.startsWith('v1:')).toBe(true);
  });

  it('falha quando a chave está ausente', () => {
    usarChave(undefined);
    expect(() => cifrar('qualquer coisa')).toThrow(ErroCripto);
  });

  it('falha quando a chave tem tamanho inválido', () => {
    usarChave(randomBytes(16).toString('base64'));
    expect(() => cifrar('qualquer coisa')).toThrow(/32 bytes/);
  });

  it('falha ao decifrar com outra chave — não devolve texto parcial', () => {
    const cifrado = cifrar('parecer confidencial');
    usarChave(randomBytes(32).toString('base64'));
    expect(() => decifrar(cifrado)).toThrow(ErroCripto);
  });

  it('falha quando o conteúdo cifrado foi adulterado', () => {
    const cifrado = cifrar('parecer confidencial');
    const partes = cifrado.split(':');
    const adulterado = [partes[0], partes[1], partes[2], Buffer.from('outro').toString('base64')].join(
      ':',
    );
    expect(() => decifrar(adulterado)).toThrow(ErroCripto);
  });

  it('rejeita formato desconhecido', () => {
    expect(() => decifrar('texto-solto')).toThrow(/Formato/);
  });
});
