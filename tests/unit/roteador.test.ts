import { describe, expect, it, vi } from 'vitest';
import { interpretarRoteamento, rotear } from '@/lib/ia/roteador';

const resposta = (corpo: unknown) => vi.fn().mockResolvedValue(JSON.stringify(corpo));

describe('interpretação do roteamento', () => {
  it('devolve a especialidade indicada com nome e justificativa', () => {
    const resultado = interpretarRoteamento({
      sugestoes: [
        { assistenteId: 'mentoria-bp', justificativa: 'Trata de liderança e turnover.', confianca: 0.9 },
      ],
      foraDeEscopo: false,
      motivoRecusa: null,
    });

    expect(resultado.foraDeEscopo).toBe(false);
    expect(resultado.sugestoes[0]?.nome).toBe('Mentoria estratégica de BP');
    expect(resultado.ambigua).toBe(false);
  });

  it('marca ambiguidade quando duas sugestões têm confiança próxima (FR-004)', () => {
    const resultado = interpretarRoteamento({
      sugestoes: [
        { assistenteId: 'etica-compliance', justificativa: 'Relato de assédio.', confianca: 0.55 },
        { assistenteId: 'comunicacao-lideranca', justificativa: 'Exige comunicar o time.', confianca: 0.5 },
      ],
      foraDeEscopo: false,
      motivoRecusa: null,
    });

    expect(resultado.ambigua).toBe(true);
    expect(resultado.sugestoes).toHaveLength(2);
  });

  it('não marca ambiguidade quando uma sugestão domina', () => {
    const resultado = interpretarRoteamento({
      sugestoes: [
        { assistenteId: 'etica-compliance', justificativa: 'Denúncia formal.', confianca: 0.95 },
        { assistenteId: 'mentoria-bp', justificativa: 'Também toca liderança.', confianca: 0.3 },
      ],
      foraDeEscopo: false,
      motivoRecusa: null,
    });
    expect(resultado.ambigua).toBe(false);
  });

  it('ordena as sugestões por confiança', () => {
    const resultado = interpretarRoteamento({
      sugestoes: [
        { assistenteId: 'mentoria-bp', justificativa: 'Menos aderente.', confianca: 0.4 },
        { assistenteId: 'treinamento-desenvolvimento', justificativa: 'Mais aderente.', confianca: 0.85 },
      ],
      foraDeEscopo: false,
      motivoRecusa: null,
    });
    expect(resultado.sugestoes[0]?.assistenteId).toBe('treinamento-desenvolvimento');
  });

  it('bloqueia demanda fora de escopo com motivo (FR-005)', () => {
    const resultado = interpretarRoteamento({
      sugestoes: [],
      foraDeEscopo: true,
      motivoRecusa: 'Demanda de infraestrutura de TI.',
    });

    expect(resultado.foraDeEscopo).toBe(true);
    expect(resultado.sugestoes).toHaveLength(0);
    expect(resultado.motivoRecusa).toContain('TI');
  });

  it('trata ausência de sugestão utilizável como fora de escopo, sem escolher sozinho', () => {
    const resultado = interpretarRoteamento({
      sugestoes: [],
      foraDeEscopo: false,
      motivoRecusa: null,
    });
    expect(resultado.foraDeEscopo).toBe(true);
    expect(resultado.motivoRecusa).toBeTruthy();
  });
});

describe('roteamento ponta a ponta com o modelo simulado', () => {
  it('indica mentoria para conflito de liderança', async () => {
    const chamador = resposta({
      sugestoes: [
        { assistenteId: 'mentoria-bp', justificativa: 'Turnover e feedback de liderança.', confianca: 0.92 },
      ],
      foraDeEscopo: false,
      motivoRecusa: null,
    });

    const resultado = await rotear('turnover alto e gestor sem saber dar feedback', chamador);
    expect(resultado.sugestoes[0]?.assistenteId).toBe('mentoria-bp');
  });

  it('indica compliance para denúncia', async () => {
    const chamador = resposta({
      sugestoes: [
        { assistenteId: 'etica-compliance', justificativa: 'Denúncia recebida no canal.', confianca: 0.97 },
      ],
      foraDeEscopo: false,
      motivoRecusa: null,
    });

    const resultado = await rotear('recebi uma denúncia de assédio', chamador);
    expect(resultado.sugestoes[0]?.assistenteId).toBe('etica-compliance');
  });

  it('recusa demanda fora dos domínios de gestão de pessoas', async () => {
    const chamador = resposta({
      sugestoes: [],
      foraDeEscopo: true,
      motivoRecusa: 'Demanda fiscal, fora de gestão de pessoas.',
    });

    const resultado = await rotear('como calculo o ICMS da nota', chamador);
    expect(resultado.foraDeEscopo).toBe(true);
  });

  it('rejeita especialidade inexistente devolvida pelo modelo', async () => {
    const chamador = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({
          sugestoes: [{ assistenteId: 'assistente-fantasma', justificativa: 'inventado', confianca: 1 }],
          foraDeEscopo: false,
          motivoRecusa: null,
        }),
      );

    // O schema reprova o id desconhecido; após as retentativas, a chamada falha.
    await expect(rotear('qualquer demanda', chamador)).rejects.toThrow();
  });
});
