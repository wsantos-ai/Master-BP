import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { ESTRUTURAS } from '@/lib/assistentes/estruturas';
import { saidaRoteamento } from '@/lib/ia/roteador';
import { saidaRefinamento } from '@/lib/ia/refinamento';
import { derivarSchema } from '@/lib/ia/saida-estruturada';

/**
 * Conversão Zod → dialeto estrito do provedor (contracts/provedor-ia.md §2.2).
 *
 * Roda sobre os schemas REAIS — as cinco estruturas de entrega mais roteamento e refinamento —
 * porque um schema de brinquedo não exercita reuso de sub-schema, campo anulável nem
 * aninhamento profundo, que é justamente onde a conversão pode quebrar.
 *
 * Nenhuma chamada de rede.
 */

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  ...ESTRUTURAS,
  roteamento: saidaRoteamento,
  refinamento: saidaRefinamento,
};

/** Percorre todo objeto do schema derivado, para asserções recursivas. */
function todosOsNos(no: unknown, acumulado: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(no)) {
    for (const item of no) todosOsNos(item, acumulado);
    return acumulado;
  }
  if (no === null || typeof no !== 'object') return acumulado;

  acumulado.push(no as Record<string, unknown>);
  for (const valor of Object.values(no as Record<string, unknown>)) todosOsNos(valor, acumulado);
  return acumulado;
}

const CHAVES_PROIBIDAS = [
  '$schema',
  '$ref',
  '$defs',
  'definitions',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minItems',
  'maxItems',
  'pattern',
  'format',
  'default',
  'const',
  'nullable',
];

describe.each(Object.keys(SCHEMAS))('schema real: %s', (nome) => {
  const derivado = derivarSchema(SCHEMAS[nome]!);
  const nos = todosOsNos(derivado);

  it('todo objeto declara additionalProperties: false', () => {
    const objetos = nos.filter((n) => n.type === 'object' && typeof n.properties === 'object');

    expect(objetos.length).toBeGreaterThan(0);
    for (const obj of objetos) {
      expect(obj.additionalProperties).toBe(false);
    }
  });

  it('todo objeto exige todas as suas propriedades em required', () => {
    const objetos = nos.filter((n) => n.type === 'object' && typeof n.properties === 'object');

    for (const obj of objetos) {
      const propriedades = Object.keys(obj.properties as Record<string, unknown>);
      expect(obj.required).toEqual(propriedades);
    }
  });

  it('não carrega nenhuma chave que o modo estrito rejeita', () => {
    for (const no of nos) {
      for (const proibida of CHAVES_PROIBIDAS) {
        expect(no).not.toHaveProperty(proibida);
      }
    }
  });

  it('é serializável — o corpo da requisição precisa dele em JSON', () => {
    expect(() => JSON.stringify(derivado)).not.toThrow();
  });
});

describe('casos específicos que a conversão precisa acertar', () => {
  it('motivoRecusa do roteamento vira type ["string","null"]', () => {
    const derivado = derivarSchema(saidaRoteamento) as {
      properties: { motivoRecusa: { type: unknown } };
    };

    expect(derivado.properties.motivoRecusa.type).toEqual(['string', 'null']);
  });

  it('o enum de tipos de risco do refinamento é preservado', () => {
    const serializado = JSON.stringify(derivarSchema(saidaRefinamento));
    expect(serializado).toContain('enum');
  });

  it('as cinco especialidades produzem schema não vazio', () => {
    for (const [id, schema] of Object.entries(ESTRUTURAS)) {
      const derivado = derivarSchema(schema) as Record<string, unknown>;
      expect(Object.keys(derivado.properties as Record<string, unknown>).length).toBeGreaterThan(0);
      expect(id).toBeTruthy();
    }
  });
});
