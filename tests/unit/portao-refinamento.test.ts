import { describe, expect, it } from 'vitest';
import {
  LIMITE_APRESENTADAS,
  type LacunaAvaliavel,
  avaliarPortao,
  lacunaResolvida,
  podeEmitirEntrega,
  proximaOrdem,
  proximaPergunta,
  reconciliarComSinalDoModelo,
} from '@/lib/dominio/portao-refinamento';

/**
 * SC-005: zero entregas emitidas com lacuna crítica em aberto.
 */

function lacuna(parcial: Partial<LacunaAvaliavel> = {}): LacunaAvaliavel {
  return {
    id: 'l1',
    pergunta: 'Quem foi ouvido e quando?',
    porQueImporta: 'Sem escuta das partes não há contraditório.',
    critica: true,
    estado: 'aberta',
    resposta: null,
    justificativaNaoAplicavel: null,
    ordem: 1,
    ...parcial,
  };
}

describe('resolução de lacuna', () => {
  it('aberta não está resolvida', () => {
    expect(lacunaResolvida(lacuna())).toBe(false);
  });

  it('respondida com conteúdo está resolvida', () => {
    expect(lacunaResolvida(lacuna({ estado: 'respondida', resposta: 'Ouvidas em 12/07.' }))).toBe(
      true,
    );
  });

  it('respondida sem conteúdo NÃO está resolvida', () => {
    expect(lacunaResolvida(lacuna({ estado: 'respondida', resposta: '   ' }))).toBe(false);
  });

  it('não aplicável com justificativa está resolvida', () => {
    expect(
      lacunaResolvida(
        lacuna({ estado: 'nao_aplicavel', justificativaNaoAplicavel: 'Não há testemunhas.' }),
      ),
    ).toBe(true);
  });

  it('não aplicável SEM justificativa não está resolvida (FR-008)', () => {
    expect(lacunaResolvida(lacuna({ estado: 'nao_aplicavel', justificativaNaoAplicavel: null }))).toBe(
      false,
    );
  });
});

describe('portão de entrega', () => {
  it('bloqueia quando há lacuna crítica aberta', () => {
    const avaliacao = avaliarPortao([lacuna()]);
    expect(avaliacao.liberada).toBe(false);
    expect(avaliacao.apresentadas).toHaveLength(1);
    expect(avaliacao.apresentadas[0]?.porQueImporta).toContain('contraditório');
  });

  it('libera quando todas as críticas estão resolvidas', () => {
    const lacunas = [
      lacuna({ id: 'a', estado: 'respondida', resposta: 'ok' }),
      lacuna({ id: 'b', ordem: 2, estado: 'nao_aplicavel', justificativaNaoAplicavel: 'sem caso' }),
    ];
    expect(podeEmitirEntrega(lacunas)).toBe(true);
  });

  it('libera com lacuna NÃO crítica em aberto', () => {
    const lacunas = [
      lacuna({ id: 'a', estado: 'respondida', resposta: 'ok' }),
      lacuna({ id: 'b', ordem: 2, critica: false }),
    ];
    const avaliacao = avaliarPortao(lacunas);
    expect(avaliacao.liberada).toBe(true);
    expect(avaliacao.totalAbertas).toBe(1);
  });

  it('libera quando não há lacuna alguma', () => {
    expect(podeEmitirEntrega([])).toBe(true);
  });

  it('ordena as pendências pela ordem de apresentação', () => {
    const avaliacao = avaliarPortao([
      lacuna({ id: 'c', ordem: 3 }),
      lacuna({ id: 'a', ordem: 1 }),
      lacuna({ id: 'b', ordem: 2 }),
    ]);
    expect(avaliacao.apresentadas.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('conta resolvidas e abertas separadamente', () => {
    const avaliacao = avaliarPortao([
      lacuna({ id: 'a', estado: 'respondida', resposta: 'ok' }),
      lacuna({ id: 'b', ordem: 2 }),
      lacuna({ id: 'c', ordem: 3, critica: false }),
    ]);
    expect(avaliacao.totalResolvidas).toBe(1);
    expect(avaliacao.totalAbertas).toBe(2);
  });
});

/** US2 — FR-007, FR-014, FR-015, FR-016. */
describe('limite de apresentação e fila', () => {
  function criticas(quantidade: number): LacunaAvaliavel[] {
    return Array.from({ length: quantidade }, (_, i) =>
      lacuna({ id: `l${i + 1}`, ordem: i + 1, pergunta: `Pergunta ${i + 1}?` }),
    );
  }

  it('apresenta no máximo 3, mesmo com 7 abertas', () => {
    const avaliacao = avaliarPortao(criticas(7));

    expect(avaliacao.apresentadas).toHaveLength(LIMITE_APRESENTADAS);
    expect(avaliacao.totalCriticasAbertas).toBe(7);
  });

  it('apresenta todas quando há menos que o limite', () => {
    const avaliacao = avaliarPortao(criticas(2));

    expect(avaliacao.apresentadas).toHaveLength(2);
    expect(avaliacao.totalCriticasAbertas).toBe(2);
  });

  it('apresenta as primeiras por ordem, nunca uma seleção arbitrária', () => {
    const avaliacao = avaliarPortao(criticas(7));
    expect(avaliacao.apresentadas.map((p) => p.id)).toEqual(['l1', 'l2', 'l3']);
  });

  it('promove a próxima da fila quando uma apresentada é resolvida (FR-015)', () => {
    const lacunas = criticas(5);
    lacunas[0] = { ...lacunas[0]!, estado: 'respondida', resposta: 'respondida pelo BP' };

    const avaliacao = avaliarPortao(lacunas);

    expect(avaliacao.apresentadas.map((p) => p.id)).toEqual(['l2', 'l3', 'l4']);
    expect(avaliacao.totalCriticasAbertas).toBe(4);
  });

  it('devolve as mesmas 3, na mesma ordem, em avaliações repetidas (SC-011)', () => {
    const lacunas = criticas(6);
    // Embaralhar a entrada simula a retomada, em que a ordem de leitura pode variar.
    const embaralhadas = [...lacunas].reverse();

    expect(avaliarPortao(embaralhadas).apresentadas.map((p) => p.id)).toEqual(
      avaliarPortao(lacunas).apresentadas.map((p) => p.id),
    );
  });

  it('lacunas NÃO críticas ficam fora do limite e não bloqueiam (FR-016)', () => {
    const lacunas = [
      ...criticas(2),
      lacuna({ id: 'n1', ordem: 10, critica: false }),
      lacuna({ id: 'n2', ordem: 11, critica: false }),
      lacuna({ id: 'n3', ordem: 12, critica: false }),
    ];

    const avaliacao = avaliarPortao(lacunas);

    expect(avaliacao.apresentadas.map((p) => p.id)).toEqual(['l1', 'l2']);
    expect(avaliacao.totalCriticasAbertas).toBe(2);
    expect(avaliacao.totalAbertas).toBe(5);
  });
});

/**
 * 🚨 FR-014 / SC-010 — a linha vermelha da feature.
 *
 * Se estes testes caírem, a entrega passa a sair com pendência crítica na fila: o limite de
 * apresentação terá vazado para dentro da decisão do portão, e o Princípio II está quebrado.
 */
describe('o limite de apresentação NÃO afrouxa o portão', () => {
  it('resolver as 3 apresentadas não libera enquanto houver fila', () => {
    const lacunas = Array.from({ length: 7 }, (_, i) =>
      lacuna({ id: `l${i + 1}`, ordem: i + 1 }),
    );
    // O BP resolveu exatamente o que via na tela.
    for (let i = 0; i < LIMITE_APRESENTADAS; i++) {
      lacunas[i] = { ...lacunas[i]!, estado: 'respondida', resposta: 'respondido' };
    }

    const avaliacao = avaliarPortao(lacunas);

    expect(avaliacao.liberada).toBe(false);
    expect(podeEmitirEntrega(lacunas)).toBe(false);
    expect(avaliacao.totalCriticasAbertas).toBe(4);
  });

  it('só libera quando as apresentadas E as em fila estão resolvidas', () => {
    const lacunas = Array.from({ length: 7 }, (_, i) =>
      lacuna({ id: `l${i + 1}`, ordem: i + 1, estado: 'respondida', resposta: 'respondido' }),
    );

    expect(avaliarPortao(lacunas).liberada).toBe(true);
    expect(podeEmitirEntrega(lacunas)).toBe(true);
  });

  it('proximaPergunta enxerga a fila inteira, não só as apresentadas', () => {
    const lacunas = Array.from({ length: 7 }, (_, i) =>
      lacuna({ id: `l${i + 1}`, ordem: i + 1 }),
    );
    for (let i = 0; i < LIMITE_APRESENTADAS; i++) {
      lacunas[i] = { ...lacunas[i]!, estado: 'respondida', resposta: 'respondido' };
    }

    expect(proximaPergunta(lacunas)?.id).toBe('l4');
  });
});

describe('o sinal do modelo não decide (R-01)', () => {
  it('modelo diz pronto, mas há lacuna crítica aberta → servidor recusa', () => {
    const { pronto, divergiu } = reconciliarComSinalDoModelo([lacuna()], true);
    expect(pronto).toBe(false);
    expect(divergiu).toBe(true);
  });

  it('modelo diz não pronto, mas tudo está resolvido → servidor libera', () => {
    const resolvidas = [lacuna({ estado: 'respondida', resposta: 'ok' })];
    const { pronto, divergiu } = reconciliarComSinalDoModelo(resolvidas, false);
    expect(pronto).toBe(true);
    expect(divergiu).toBe(true);
  });

  it('sem divergência quando ambos concordam', () => {
    expect(reconciliarComSinalDoModelo([lacuna()], false).divergiu).toBe(false);
  });

  it('estado inconsistente (respondida sem resposta) não vira passe livre', () => {
    const inconsistente = [lacuna({ estado: 'respondida', resposta: null })];
    expect(reconciliarComSinalDoModelo(inconsistente, true).pronto).toBe(false);
  });
});

describe('retomada do atendimento (SC-008)', () => {
  it('devolve a próxima lacuna aberta de menor ordem', () => {
    const proxima = proximaPergunta([
      lacuna({ id: 'a', ordem: 1, estado: 'respondida', resposta: 'ok' }),
      lacuna({ id: 'b', ordem: 2 }),
      lacuna({ id: 'c', ordem: 3 }),
    ]);
    expect(proxima?.id).toBe('b');
  });

  it('prioriza lacuna crítica mesmo com ordem maior', () => {
    const proxima = proximaPergunta([
      lacuna({ id: 'nao-critica', ordem: 1, critica: false }),
      lacuna({ id: 'critica', ordem: 5, critica: true }),
    ]);
    expect(proxima?.id).toBe('critica');
  });

  it('devolve null quando tudo está resolvido', () => {
    expect(proximaPergunta([lacuna({ estado: 'respondida', resposta: 'ok' })])).toBeNull();
  });

  it('calcula a próxima ordem a partir da maior existente', () => {
    expect(proximaOrdem([{ ordem: 1 }, { ordem: 4 }, { ordem: 2 }])).toBe(5);
    expect(proximaOrdem([])).toBe(1);
  });
});
