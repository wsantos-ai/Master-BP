import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  ErroSaidaEstruturada,
  MAX_TENTATIVAS,
  derivarSchema,
  gerarEstruturado,
  paraSchemaDoProvedor,
} from '@/lib/ia/saida-estruturada';

const schema = z.object({
  titulo: z.string().min(1),
  itens: z.array(z.object({ acao: z.string(), responsavel: z.string() })).min(1),
});

const opcoesBase = {
  schema,
  instrucaoSistema: 'instrução',
  entrada: 'entrada',
  evento: 'teste',
};

const valido = JSON.stringify({
  titulo: 'Plano',
  itens: [{ acao: 'Conversar com o gestor', responsavel: 'BP' }],
});

describe('derivação do schema do provedor', () => {
  it('remove chaves que o provedor não suporta', () => {
    const derivado = derivarSchema(schema) as Record<string, unknown>;
    expect(derivado).not.toHaveProperty('$schema');
    expect(derivado).not.toHaveProperty('additionalProperties');
    expect(derivado).toHaveProperty('type', 'object');
    expect(derivado).toHaveProperty('properties');
  });

  it('limpa recursivamente objetos aninhados', () => {
    const limpo = paraSchemaDoProvedor({
      type: 'object',
      $schema: 'x',
      properties: { a: { type: 'string', additionalProperties: false } },
    }) as { properties: { a: unknown } };
    expect(limpo.properties.a).toEqual({ type: 'string' });
  });
});

describe('geração estruturada', () => {
  it('devolve os dados validados na primeira tentativa', async () => {
    const chamador = vi.fn().mockResolvedValue(valido);
    const { dados, tentativas } = await gerarEstruturado(opcoesBase, chamador);

    expect(dados.titulo).toBe('Plano');
    expect(tentativas).toBe(1);
    expect(chamador).toHaveBeenCalledTimes(1);
  });

  it('retenta quando o modelo devolve JSON inválido e aceita a resposta seguinte', async () => {
    const chamador = vi.fn().mockResolvedValueOnce('isto não é json').mockResolvedValueOnce(valido);
    const { tentativas } = await gerarEstruturado(opcoesBase, chamador);

    expect(tentativas).toBe(2);
    expect(chamador).toHaveBeenCalledTimes(2);
  });

  it('retenta quando o JSON é válido mas o schema reprova', async () => {
    const semItens = JSON.stringify({ titulo: 'Plano', itens: [] });
    const chamador = vi.fn().mockResolvedValueOnce(semItens).mockResolvedValueOnce(valido);

    const { tentativas } = await gerarEstruturado(opcoesBase, chamador);
    expect(tentativas).toBe(2);
  });

  it('falha após esgotar as retentativas, sem devolver dado parcial', async () => {
    const chamador = vi.fn().mockResolvedValue(JSON.stringify({ titulo: 'Sem itens' }));

    await expect(gerarEstruturado(opcoesBase, chamador)).rejects.toThrow(ErroSaidaEstruturada);
    expect(chamador).toHaveBeenCalledTimes(MAX_TENTATIVAS);
  });

  it('trata falha do provedor como tentativa perdida, não como sucesso', async () => {
    const chamador = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(valido);

    const { tentativas } = await gerarEstruturado(opcoesBase, chamador);
    expect(tentativas).toBe(2);
  });

  it('propaga erro quando o provedor falha em todas as tentativas', async () => {
    const chamador = vi.fn().mockRejectedValue(new Error('indisponível'));
    await expect(gerarEstruturado(opcoesBase, chamador)).rejects.toThrow(ErroSaidaEstruturada);
  });
});
