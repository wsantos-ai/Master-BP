import { describe, expect, it } from 'vitest';
import {
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
    expect(avaliacao.pendentes).toHaveLength(1);
    expect(avaliacao.pendentes[0]?.porQueImporta).toContain('contraditório');
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
    expect(avaliacao.pendentes.map((p) => p.id)).toEqual(['a', 'b', 'c']);
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
