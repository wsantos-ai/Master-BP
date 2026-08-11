import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ErroConfiguracaoIA, ErroProvedorIA } from '@/lib/ia/openrouter';
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
  it('produz o dialeto estrito: additionalProperties false e required completo', () => {
    const derivado = derivarSchema(schema) as Record<string, unknown>;

    expect(derivado).not.toHaveProperty('$schema');
    expect(derivado).toHaveProperty('type', 'object');
    expect(derivado).toHaveProperty('additionalProperties', false);
    expect(derivado.required).toEqual(['titulo', 'itens']);
  });

  it('aplica o dialeto recursivamente, inclusive dentro de arrays', () => {
    const derivado = derivarSchema(schema) as {
      properties: { itens: { items: Record<string, unknown> } };
    };

    expect(derivado.properties.itens.items).toHaveProperty('additionalProperties', false);
    expect(derivado.properties.itens.items.required).toEqual(['acao', 'responsavel']);
  });

  it('promove propriedades opcionais a required — o modo estrito exige todas', () => {
    const comOpcional = z.object({ obrigatorio: z.string(), opcional: z.string().optional() });
    const derivado = derivarSchema(comOpcional) as { required: string[] };

    expect(derivado.required).toEqual(['obrigatorio', 'opcional']);
  });

  it('converte campo anulável para type ["string","null"], não nullable', () => {
    const comNulo = z.object({ motivo: z.string().nullable() });
    const derivado = derivarSchema(comNulo) as {
      properties: { motivo: Record<string, unknown> };
    };

    expect(derivado.properties.motivo.type).toEqual(['string', 'null']);
    expect(derivado.properties.motivo).not.toHaveProperty('nullable');
  });

  it('remove as restrições de valor que o modo estrito rejeita', () => {
    const derivado = derivarSchema(schema) as {
      properties: { titulo: Record<string, unknown>; itens: Record<string, unknown> };
    };

    expect(derivado.properties.titulo).not.toHaveProperty('minLength');
    expect(derivado.properties.itens).not.toHaveProperty('minItems');
  });

  it('não deixa $ref nem $defs remanescentes', () => {
    const sub = z.object({ nome: z.string() });
    const comReuso = z.object({ a: sub, b: sub });

    const serializado = JSON.stringify(derivarSchema(comReuso));
    expect(serializado).not.toContain('$ref');
    expect(serializado).not.toContain('$defs');
    expect(serializado).not.toContain('definitions');
  });

  it('limpa recursivamente objetos aninhados', () => {
    const limpo = paraSchemaDoProvedor({
      type: 'object',
      $schema: 'x',
      properties: { a: { type: 'string', minLength: 3 } },
    }) as { properties: { a: unknown } };

    expect(limpo.properties.a).toEqual({ type: 'string' });
  });
});

/**
 * Princípio V: o que sai do schema do provedor NÃO sai da validação. Se esta suíte passar a
 * falhar, a migração terá afrouxado o portão de estrutura — não é um detalhe de formato.
 */
describe('as restrições removidas continuam reprovando no Zod', () => {
  const restrito = z.object({
    justificativa: z.string().min(10),
    confianca: z.number().min(0).max(1),
    sugestoes: z.array(z.string()).max(2),
  });

  it('o schema do provedor não carrega as restrições', () => {
    const serializado = JSON.stringify(derivarSchema(restrito));

    expect(serializado).not.toContain('minLength');
    expect(serializado).not.toContain('maximum');
    expect(serializado).not.toContain('maxItems');
  });

  it('mas o Zod reprova justificativa curta demais', () => {
    expect(
      restrito.safeParse({ justificativa: 'curta', confianca: 0.5, sugestoes: [] }).success,
    ).toBe(false);
  });

  it('e reprova confiança fora do intervalo', () => {
    expect(
      restrito.safeParse({ justificativa: 'longa o suficiente', confianca: 2, sugestoes: [] })
        .success,
    ).toBe(false);
  });

  it('e reprova array acima do limite', () => {
    expect(
      restrito.safeParse({
        justificativa: 'longa o suficiente',
        confianca: 0.5,
        sugestoes: ['a', 'b', 'c'],
      }).success,
    ).toBe(false);
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

  it('repassa ao chamador o schema derivado e o evento', async () => {
    const chamador = vi.fn().mockResolvedValue(valido);
    await gerarEstruturado(opcoesBase, chamador);

    const params = chamador.mock.calls[0]![0];
    expect(params.evento).toBe('teste');
    expect(params.schemaProvedor).toHaveProperty('additionalProperties', false);
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

  it('trata falha transitória do provedor como tentativa perdida, não como sucesso', async () => {
    const chamador = vi
      .fn()
      .mockRejectedValueOnce(new ErroProvedorIA('indisponível', 503, 'falha_provedor'))
      .mockResolvedValueOnce(valido);

    const { tentativas } = await gerarEstruturado(opcoesBase, chamador);
    expect(tentativas).toBe(2);
  });

  it('propaga erro quando o provedor falha em todas as tentativas', async () => {
    const chamador = vi.fn().mockRejectedValue(new ErroProvedorIA('indisponível', 503, 'falha_provedor'));
    await expect(gerarEstruturado(opcoesBase, chamador)).rejects.toThrow(ErroSaidaEstruturada);
    expect(chamador).toHaveBeenCalledTimes(MAX_TENTATIVAS);
  });

  it('NÃO retenta erro de configuração — retentar não resolve chave ausente', async () => {
    const chamador = vi.fn().mockRejectedValue(new ErroConfiguracaoIA('sem chave'));

    await expect(gerarEstruturado(opcoesBase, chamador)).rejects.toThrow(ErroConfiguracaoIA);
    expect(chamador).toHaveBeenCalledTimes(1);
  });
});
