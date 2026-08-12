import { describe, expect, it } from 'vitest';
import { filtrarPropostas } from '@/lib/dominio/equivalencia-lacunas';
import { aproveitarResolucoes } from '@/lib/dominio/resolucao-aproveitada';
import {
  LIMITE_APRESENTADAS,
  type LacunaAvaliavel,
  avaliarPortao,
} from '@/lib/dominio/portao-refinamento';

/**
 * US2 — SC-002: a etapa de refinamento converge.
 *
 * Simula rodadas encadeando as MESMAS funções puras que a rota usa, sobre estado em memória. O
 * que se prova aqui é a propriedade que o BP percebe: o total de pendências críticas não
 * resolvidas nunca sobe de uma rodada para a seguinte, e o refinamento termina.
 *
 * A versão de integração desta suíte — sobre estado persistido — está descrita no plano, mas o
 * harness de integração não sobe neste ambiente por um defeito anterior a esta feature (o
 * global setup faz `prisma db push` com URL SQLite contra um schema PostgreSQL). A propriedade
 * verificada é a mesma; o que falta é o banco.
 */

type Estado = { lacunas: LacunaAvaliavel[]; proximaOrdem: number };

function novaLacuna(id: string, pergunta: string, ordem: number): LacunaAvaliavel {
  return {
    id,
    pergunta,
    porQueImporta: 'importa para a entrega',
    critica: true,
    estado: 'aberta',
    resposta: null,
    justificativaNaoAplicavel: null,
    ordem,
  };
}

/**
 * Uma rodada: o BP responde a primeira pendência apresentada, o assistente devolve o sinal de
 * resolução e propõe novas perguntas. Mesma ordem da rota (contracts/refinamento.md §2):
 * aproveitamento → releitura → deduplicação → persistência.
 */
function rodada(
  estado: Estado,
  assistente: { propostas: string[]; sinaisResolucao: string[] },
): Estado {
  const portao = avaliarPortao(estado.lacunas);
  const alvo = portao.apresentadas[0];
  if (!alvo) return estado;

  const respostaDoBp = `Resposta objetiva do BP para ${alvo.id}.`;

  let lacunas = estado.lacunas.map((l) =>
    l.id === alvo.id
      ? { ...l, estado: 'respondida' as const, resposta: respostaDoBp }
      : l,
  );

  const aproveitamento = aproveitarResolucoes({
    sinais: assistente.sinaisResolucao.map((lacunaId) => ({ lacunaId })),
    lacunasDoAtendimento: estado.lacunas,
    lacunaRespondidaDiretamente: alvo.id,
    conteudoDoBp: respostaDoBp,
  });

  const fechar = new Set(aproveitamento.idsParaFechar);
  lacunas = lacunas.map((l) =>
    fechar.has(l.id) ? { ...l, estado: 'respondida' as const, resposta: respostaDoBp } : l,
  );

  const { aceitas } = filtrarPropostas(
    assistente.propostas.map((pergunta) => ({ pergunta })),
    lacunas.map((l) => l.pergunta),
  );

  let ordem = estado.proximaOrdem;
  for (const aceita of aceitas) {
    lacunas.push(novaLacuna(`n${ordem}`, aceita.pergunta, ordem));
    ordem += 1;
  }

  return { lacunas, proximaOrdem: ordem };
}

const PERGUNTAS = [
  'Quem vai comunicar a mudança à equipe?',
  'Quando a mudança entra em vigor?',
  'Qual o canal escolhido para o anúncio?',
  'Quantas pessoas serão afetadas?',
  'Como fica a remuneração de quem batia a meta?',
  'O diretor já validou a decisão?',
  'Existe política formal sobre remuneração variável?',
];

function estadoInicial(quantidade: number): Estado {
  return {
    lacunas: PERGUNTAS.slice(0, quantidade).map((p, i) => novaLacuna(`l${i + 1}`, p, i + 1)),
    proximaOrdem: quantidade + 1,
  };
}

describe('convergência do refinamento (SC-002)', () => {
  it('o total de críticas abertas nunca sobe quando o assistente não propõe nada novo', () => {
    let estado = estadoInicial(7);
    const serie = [avaliarPortao(estado.lacunas).totalCriticasAbertas];

    for (let i = 0; i < 7; i++) {
      estado = rodada(estado, { propostas: [], sinaisResolucao: [] });
      serie.push(avaliarPortao(estado.lacunas).totalCriticasAbertas);
    }

    expect(serie[0]).toBe(7);
    for (let i = 1; i < serie.length; i++) {
      expect(serie[i]!).toBeLessThanOrEqual(serie[i - 1]!);
    }
    expect(serie.at(-1)).toBe(0);
  });

  it('reformulações do que já foi perguntado não fazem a lista crescer', () => {
    let estado = estadoInicial(5);
    const antes = avaliarPortao(estado.lacunas).totalCriticasAbertas;

    // O assistente repropõe as mesmas perguntas com outra grafia — o caso que originou a feature.
    estado = rodada(estado, {
      propostas: [
        'quem vai comunicar a mudanca a equipe',
        'quando a mudanca entra em vigor',
        'qual o canal escolhido para o anuncio',
      ],
      sinaisResolucao: [],
    });

    const depois = avaliarPortao(estado.lacunas).totalCriticasAbertas;
    expect(depois).toBe(antes - 1);
  });

  it('o aproveitamento acelera a convergência sem pular o portão', () => {
    let estado = estadoInicial(5);

    // A resposta à primeira também esclarece a segunda.
    estado = rodada(estado, { propostas: [], sinaisResolucao: ['l2'] });

    const portao = avaliarPortao(estado.lacunas);
    expect(portao.totalCriticasAbertas).toBe(3);
    expect(portao.liberada).toBe(false);

    // E as duas fechadas têm conteúdo real — nenhuma foi fechada vazia.
    for (const l of estado.lacunas) {
      if (l.estado === 'respondida') expect(l.resposta).toBeTruthy();
    }
  });

  it('o BP nunca vê mais de 3 pendências em nenhum momento (SC-004)', () => {
    let estado = estadoInicial(7);

    for (let i = 0; i < 7; i++) {
      expect(avaliarPortao(estado.lacunas).apresentadas.length).toBeLessThanOrEqual(
        LIMITE_APRESENTADAS,
      );
      estado = rodada(estado, { propostas: [], sinaisResolucao: [] });
    }
  });

  it('o refinamento termina mesmo quando o assistente insiste em propor', () => {
    let estado = estadoInicial(3);

    // A cada rodada o assistente repropõe o repertório inteiro. Nada de novo entra.
    for (let i = 0; i < 10; i++) {
      estado = rodada(estado, { propostas: [...PERGUNTAS.slice(0, 3)], sinaisResolucao: [] });
    }

    expect(avaliarPortao(estado.lacunas).liberada).toBe(true);
  });
});
