import { describe, expect, it } from 'vitest';
import {
  PARES_DISTINTOS,
  PARES_EQUIVALENTES,
  PARES_LIMITACAO_CONHECIDA,
} from '../fixtures/pares-equivalencia';
import {
  LIMIAR_EQUIVALENCIA,
  filtrarPropostas,
  normalizar,
  saoEquivalentes,
} from '@/lib/dominio/equivalencia-lacunas';

/**
 * Equivalência entre perguntas — feature 003, US1, FR-005 e FR-006.
 *
 * Função pura: nenhuma rede, nenhum banco, nenhum modelo.
 */

describe('normalização', () => {
  it('põe em caixa baixa', () => {
    expect(normalizar('PRAZO')).toEqual(new Set(['prazo']));
  });

  it('remove acentos', () => {
    // `comunicacao` perde o sufixo `cao`; `mudanca` não casa com nenhum sufixo e fica inteira.
    expect(normalizar('mudança comunicação')).toEqual(new Set(['mudanca', 'comunica']));
  });

  it('reduz a radical, para que flexões da mesma palavra casem', () => {
    expect(normalizar('afetadas')).toEqual(normalizar('afetar'));
    expect(normalizar('validou')).toEqual(normalizar('validada'));
  });

  it('não reduz radical curto demais, que casaria com qualquer coisa', () => {
    // 'cao' sairia deixando 'rea', abaixo do mínimo — a palavra fica inteira.
    expect(normalizar('reação')).toEqual(new Set(['reacao']));
  });

  it('remove pontuação', () => {
    expect(normalizar('prazo?!, prazo.')).toEqual(new Set(['prazo']));
  });

  it('colapsa espaços múltiplos', () => {
    expect(normalizar('prazo    canal')).toEqual(new Set(['prazo', 'canal']));
  });

  it('remove palavras vazias — artigos, preposições e interrogativos', () => {
    expect(normalizar('Qual é o prazo para a comunicação?')).toEqual(
      new Set(['prazo', 'comunica']),
    );
  });

  it('devolve conjunto vazio para texto só de palavras vazias', () => {
    expect(normalizar('qual é o que de a')).toEqual(new Set());
  });
});

describe('equivalência sobre o conjunto de calibração', () => {
  it.each(PARES_EQUIVALENTES)('reconhece como a mesma pergunta: $nota', ({ a, b }) => {
    expect(saoEquivalentes(a, b)).toBe(true);
  });

  it.each(PARES_DISTINTOS)('mantém as duas — são pedidos distintos: $nota', ({ a, b }) => {
    expect(saoEquivalentes(a, b)).toBe(false);
  });

  it('é simétrica', () => {
    for (const { a, b } of [...PARES_EQUIVALENTES, ...PARES_DISTINTOS]) {
      expect(saoEquivalentes(a, b)).toBe(saoEquivalentes(b, a));
    }
  });

  /**
   * Documenta a limitação declarada em R-02 em vez de escondê-la. Se algum destes passar a
   * casar, ótimo — mas a mudança precisa ser deliberada, e os PARES_DISTINTOS têm de continuar
   * sobrevivendo.
   */
  it.each(PARES_LIMITACAO_CONHECIDA)(
    'NÃO pega paráfrase genuína — responsabilidade da instrução ao assistente: $nota',
    ({ a, b }) => {
      expect(saoEquivalentes(a, b)).toBe(false);
    },
  );

  it('o limiar está no intervalo que a spec admite', () => {
    // Abaixo de 0,5 a comparação viraria ruído; 1,0 pegaria só duplicata exata.
    expect(LIMIAR_EQUIVALENCIA).toBeGreaterThan(0.5);
    expect(LIMIAR_EQUIVALENCIA).toBeLessThanOrEqual(1);
  });
});

describe('na dúvida, mantém (assimetria de erro, R-02)', () => {
  it('pergunta sem palavras de conteúdo nunca casa com outra', () => {
    expect(saoEquivalentes('qual é?', 'o que é?')).toBe(false);
  });

  it('sobreposição parcial não basta', () => {
    // {prazo, comunicar} × {prazo, comunicar, equipe, comercial} → 2/4 = 0,5
    expect(
      saoEquivalentes('Qual o prazo para comunicar?', 'Qual o prazo para comunicar à equipe comercial?'),
    ).toBe(false);
  });
});

describe('filtragem de propostas', () => {
  const proposta = (pergunta: string) => ({ pergunta, porQueImporta: 'importa', critica: true });

  it('descarta proposta equivalente a pergunta já existente', () => {
    const { aceitas, descartadas } = filtrarPropostas(
      [proposta('qual e o prazo para comunicar a mudanca')],
      ['Qual é o prazo para comunicar a mudança?'],
    );

    expect(aceitas).toHaveLength(0);
    expect(descartadas).toBe(1);
  });

  it('descarta contra pergunta já respondida, não só contra aberta', () => {
    // A função recebe as perguntas de TODAS as lacunas — o estado é filtrado pelo chamador,
    // e o chamador não filtra: respondida e não aplicável também contam (FR-005).
    const { aceitas } = filtrarPropostas(
      [proposta('Quantas pessoas serão afetadas pela mudança?')],
      ['Quantas pessoas a mudança vai afetar?'],
    );

    expect(aceitas).toHaveLength(0);
  });

  it('descarta equivalentes entre si na mesma rodada (FR-006)', () => {
    const { aceitas, descartadas } = filtrarPropostas(
      [
        proposta('Qual o canal de comunicação escolhido?'),
        proposta('qual e o canal de comunicacao escolhido'),
      ],
      [],
    );

    expect(aceitas).toHaveLength(1);
    expect(descartadas).toBe(1);
  });

  it('mantém propostas distintas', () => {
    const { aceitas, descartadas } = filtrarPropostas(
      [
        proposta('Qual o prazo para comunicar a mudança?'),
        proposta('Qual o prazo para implementar a mudança?'),
      ],
      [],
    );

    expect(aceitas).toHaveLength(2);
    expect(descartadas).toBe(0);
  });

  it('preserva a ordem das aceitas', () => {
    const { aceitas } = filtrarPropostas(
      [proposta('Quem comunica?'), proposta('Qual o tom?'), proposta('Qual o canal?')],
      [],
    );

    expect(aceitas.map((a) => a.pergunta)).toEqual(['Quem comunica?', 'Qual o tom?', 'Qual o canal?']);
  });

  it('devolve CONTAGEM de descartadas, nunca o texto descartado', () => {
    const resultado = filtrarPropostas(
      [proposta('qual e o prazo'), proposta('Qual o prazo?')],
      [],
    );

    expect(typeof resultado.descartadas).toBe('number');
    // Não há caminho pelo qual a pergunta descartada saia da função — é o que impede
    // que ela chegue a um log (Princípio I, FR-012).
    expect(Object.keys(resultado).sort()).toEqual(['aceitas', 'descartadas']);
  });

  it('lida com lista vazia de propostas', () => {
    expect(filtrarPropostas([], ['Qual o prazo?'])).toEqual({ aceitas: [], descartadas: 0 });
  });
});
