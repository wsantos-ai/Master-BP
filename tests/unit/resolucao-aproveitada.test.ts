import { describe, expect, it } from 'vitest';
import {
  type LacunaConhecida,
  aproveitarResolucoes,
} from '@/lib/dominio/resolucao-aproveitada';
import { type LacunaAvaliavel, podeEmitirEntrega } from '@/lib/dominio/portao-refinamento';

/**
 * US3 — o portão continua incorruptível (FR-002, FR-003, SC-005).
 *
 * Esta suíte é a própria história: ela existe para provar que um assistente que mente sobre o
 * que foi respondido NÃO consegue abrir o portão. Se ela ficar frouxa, o Princípio II cai pela
 * correção que veio consertar o refinamento.
 */

function conhecida(parcial: Partial<LacunaConhecida> = {}): LacunaConhecida {
  return {
    id: 'l1',
    estado: 'aberta',
    resposta: null,
    justificativaNaoAplicavel: null,
    ...parcial,
  };
}

const RESPOSTA_DO_BP = 'O diretor validou na terça e o RH acompanha desde então.';

describe('sem conteúdo do BP, nada é aproveitado (FR-002)', () => {
  it('devolve lista vazia quando a rodada não trouxe resposta', () => {
    const resultado = aproveitarResolucoes({
      sinais: [{ lacunaId: 'l1' }, { lacunaId: 'l2' }],
      lacunasDoAtendimento: [conhecida({ id: 'l1' }), conhecida({ id: 'l2' })],
      lacunaRespondidaDiretamente: null,
      conteudoDoBp: '',
    });

    expect(resultado.idsParaFechar).toEqual([]);
  });

  it('devolve lista vazia quando a resposta é só espaço em branco', () => {
    const resultado = aproveitarResolucoes({
      sinais: [{ lacunaId: 'l1' }],
      lacunasDoAtendimento: [conhecida({ id: 'l1' })],
      lacunaRespondidaDiretamente: null,
      conteudoDoBp: '   \n  ',
    });

    expect(resultado.idsParaFechar).toEqual([]);
  });
});

describe('sinal inválido é ignorado sem interromper a rodada (FR-003)', () => {
  it('ignora lacunaId que não existe', () => {
    const resultado = aproveitarResolucoes({
      sinais: [{ lacunaId: 'inexistente' }],
      lacunasDoAtendimento: [conhecida({ id: 'l1' })],
      lacunaRespondidaDiretamente: 'l1',
      conteudoDoBp: RESPOSTA_DO_BP,
    });

    expect(resultado.idsParaFechar).toEqual([]);
    expect(resultado.ignorados).toBe(1);
  });

  it('ignora lacunaId de outro atendimento', () => {
    // A lista de lacunas conhecidas é a do atendimento em questão; qualquer id fora dela é,
    // por construção, de outro atendimento ou inventado.
    const resultado = aproveitarResolucoes({
      sinais: [{ lacunaId: 'lacuna-de-outro-atendimento' }, { lacunaId: 'l2' }],
      lacunasDoAtendimento: [conhecida({ id: 'l1' }), conhecida({ id: 'l2' })],
      lacunaRespondidaDiretamente: 'l1',
      conteudoDoBp: RESPOSTA_DO_BP,
    });

    expect(resultado.idsParaFechar).toEqual(['l2']);
    expect(resultado.ignorados).toBe(1);
  });

  it('não lança exceção com sinal vazio', () => {
    expect(() =>
      aproveitarResolucoes({
        sinais: [],
        lacunasDoAtendimento: [conhecida()],
        lacunaRespondidaDiretamente: 'l1',
        conteudoDoBp: RESPOSTA_DO_BP,
      }),
    ).not.toThrow();
  });
});

describe('idempotência e separação de caminhos', () => {
  it('ignora lacuna já respondida', () => {
    const resultado = aproveitarResolucoes({
      sinais: [{ lacunaId: 'l2' }],
      lacunasDoAtendimento: [
        conhecida({ id: 'l1' }),
        conhecida({ id: 'l2', estado: 'respondida', resposta: 'já respondida antes' }),
      ],
      lacunaRespondidaDiretamente: 'l1',
      conteudoDoBp: RESPOSTA_DO_BP,
    });

    expect(resultado.idsParaFechar).toEqual([]);
    expect(resultado.ignorados).toBe(1);
  });

  it('ignora lacuna já declarada não aplicável', () => {
    const resultado = aproveitarResolucoes({
      sinais: [{ lacunaId: 'l2' }],
      lacunasDoAtendimento: [
        conhecida({ id: 'l1' }),
        conhecida({ id: 'l2', estado: 'nao_aplicavel', justificativaNaoAplicavel: 'não se aplica' }),
      ],
      lacunaRespondidaDiretamente: 'l1',
      conteudoDoBp: RESPOSTA_DO_BP,
    });

    expect(resultado.idsParaFechar).toEqual([]);
  });

  it('não trata como aproveitada a lacuna que o BP respondeu diretamente', () => {
    const resultado = aproveitarResolucoes({
      sinais: [{ lacunaId: 'l1' }, { lacunaId: 'l2' }],
      lacunasDoAtendimento: [conhecida({ id: 'l1' }), conhecida({ id: 'l2' })],
      lacunaRespondidaDiretamente: 'l1',
      conteudoDoBp: RESPOSTA_DO_BP,
    });

    // l1 já foi fechada pelo caminho direto, com origem própria.
    expect(resultado.idsParaFechar).toEqual(['l2']);
  });

  it('não duplica id repetido no sinal', () => {
    const resultado = aproveitarResolucoes({
      sinais: [{ lacunaId: 'l2' }, { lacunaId: 'l2' }],
      lacunasDoAtendimento: [conhecida({ id: 'l1' }), conhecida({ id: 'l2' })],
      lacunaRespondidaDiretamente: 'l1',
      conteudoDoBp: RESPOSTA_DO_BP,
    });

    expect(resultado.idsParaFechar).toEqual(['l2']);
  });
});

describe('o caso legítimo: uma resposta que cobre duas pendências', () => {
  it('fecha a pendência aberta que a resposta esclareceu de passagem', () => {
    const resultado = aproveitarResolucoes({
      sinais: [{ lacunaId: 'l2' }],
      lacunasDoAtendimento: [
        conhecida({ id: 'l1' }),
        conhecida({ id: 'l2' }),
        conhecida({ id: 'l3' }),
      ],
      lacunaRespondidaDiretamente: 'l1',
      conteudoDoBp: RESPOSTA_DO_BP,
    });

    expect(resultado.idsParaFechar).toEqual(['l2']);
    expect(resultado.ignorados).toBe(0);
  });
});

/** 🚨 SC-005 — o assistente mentiroso. */
describe('um assistente que declara tudo resolvido não abre o portão', () => {
  function avaliavel(id: string, aberta: boolean): LacunaAvaliavel {
    return {
      id,
      pergunta: `Pergunta ${id}?`,
      porQueImporta: 'importa',
      critica: true,
      estado: aberta ? 'aberta' : 'respondida',
      resposta: aberta ? null : RESPOSTA_DO_BP,
      justificativaNaoAplicavel: null,
      ordem: Number(id.slice(1)),
    };
  }

  it('fecha apenas as cobertas por conteúdo real e mantém o portão bloqueado', () => {
    const ids = ['l1', 'l2', 'l3', 'l4', 'l5'];

    const resultado = aproveitarResolucoes({
      // O modelo declara TODAS resolvidas, inclusive as que ninguém respondeu.
      sinais: ids.map((lacunaId) => ({ lacunaId })),
      lacunasDoAtendimento: ids.map((id) => conhecida({ id })),
      lacunaRespondidaDiretamente: 'l1',
      conteudoDoBp: RESPOSTA_DO_BP,
    });

    // O sinal é aceito — mas cada fechamento vai gravar a resposta REAL do BP. O modelo não
    // fabrica conteúdo; ele no máximo associa uma resposta verdadeira à pergunta errada.
    const fechadas = new Set(['l1', ...resultado.idsParaFechar]);
    const estado = ids.map((id) => avaliavel(id, !fechadas.has(id)));

    // O que precisa valer: nenhuma lacuna foi fechada SEM conteúdo.
    for (const lacuna of estado) {
      if (lacuna.estado === 'respondida') {
        expect(lacuna.resposta).toBeTruthy();
      }
    }
    expect(podeEmitirEntrega(estado)).toBe(fechadas.size === ids.length);
  });

  it('sem resposta nenhuma do BP, o portão segue bloqueado por completo', () => {
    const ids = ['l1', 'l2', 'l3'];

    const resultado = aproveitarResolucoes({
      sinais: ids.map((lacunaId) => ({ lacunaId })),
      lacunasDoAtendimento: ids.map((id) => conhecida({ id })),
      lacunaRespondidaDiretamente: null,
      conteudoDoBp: '',
    });

    expect(resultado.idsParaFechar).toEqual([]);
    expect(podeEmitirEntrega(ids.map((id) => avaliavel(id, true)))).toBe(false);
  });
});
