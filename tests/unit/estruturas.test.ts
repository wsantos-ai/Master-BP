import { describe, expect, it } from 'vitest';
import { ESTRUTURAS, extrairPlanoAcao, obterEstrutura } from '@/lib/assistentes/estruturas';
import { CATALOGO } from '@/lib/assistentes/catalogo';
import {
  comunicacaoEmailValida,
  mentoriaValida,
  parecerValido,
  promptValido,
  treinamentoValido,
} from '../fixtures/entregas';

/**
 * SC-003: 100% das entregas seguem a estrutura obrigatória, sem seção ausente.
 * Cada caso abaixo remove ou corrompe uma seção e exige a reprovação.
 */

const VALIDAS = {
  'etica-compliance': parecerValido,
  'treinamento-desenvolvimento': treinamentoValido,
  'comunicacao-lideranca': comunicacaoEmailValida,
  'mentoria-bp': mentoriaValida,
  'engenharia-prompts': promptValido,
} as const;

describe('registro de estruturas', () => {
  it('cobre todas as especialidades do catálogo', () => {
    for (const especialidade of CATALOGO) {
      expect(() => obterEstrutura(especialidade.estruturaEntrega)).not.toThrow();
    }
    expect(Object.keys(ESTRUTURAS)).toHaveLength(CATALOGO.length);
  });

  it('recusa especialidade desconhecida', () => {
    expect(() => obterEstrutura('inexistente')).toThrow(/desconhecida/);
  });
});

describe('entregas válidas passam', () => {
  for (const [id, entrega] of Object.entries(VALIDAS)) {
    it(`aceita a entrega completa de ${id}`, () => {
      expect(obterEstrutura(id).safeParse(entrega).success).toBe(true);
    });
  }
});

describe('seção obrigatória ausente reprova (SC-003)', () => {
  for (const [id, entrega] of Object.entries(VALIDAS)) {
    for (const secao of Object.keys(entrega)) {
      it(`${id}: sem "${secao}"`, () => {
        const semSecao = { ...entrega } as Record<string, unknown>;
        delete semSecao[secao];
        expect(obterEstrutura(id).safeParse(semSecao).success).toBe(false);
      });
    }
  }
});

describe('plano de ação é obrigatório em toda entrega (FR-011)', () => {
  for (const [id, entrega] of Object.entries(VALIDAS)) {
    it(`${id}: plano de ação vazio reprova`, () => {
      const semPlano = { ...entrega, planoAcao: [] };
      expect(obterEstrutura(id).safeParse(semPlano).success).toBe(false);
    });

    it(`${id}: item de plano sem responsável reprova`, () => {
      const semResponsavel = {
        ...entrega,
        planoAcao: [{ acao: 'Fazer algo', responsavel: '', prazo: '5 dias' }],
      };
      expect(obterEstrutura(id).safeParse(semResponsavel).success).toBe(false);
    });

    it(`${id}: extrai o plano de ação da entrega`, () => {
      expect(extrairPlanoAcao(entrega).length).toBeGreaterThan(0);
    });
  }
});

describe('regras específicas do parecer de compliance', () => {
  it('exige classificação restrita', () => {
    const semSigilo = {
      ...parecerValido,
      cabecalho: { ...parecerValido.cabecalho, classificacaoSigilo: 'publico_interno' },
    };
    expect(obterEstrutura('etica-compliance').safeParse(semSigilo).success).toBe(false);
  });

  it('exige nota de guarda (FR-022)', () => {
    const semNota = { ...parecerValido, notaGuarda: '' };
    expect(obterEstrutura('etica-compliance').safeParse(semNota).success).toBe(false);
  });

  it('exige embasamento legal', () => {
    const semLei = { ...parecerValido, embasamentoLegal: [] };
    expect(obterEstrutura('etica-compliance').safeParse(semLei).success).toBe(false);
  });

  it('exige os quatro critérios de investigação', () => {
    const semCriterio = {
      ...parecerValido,
      criteriosInvestigacao: { ...parecerValido.criteriosInvestigacao, escutaAtiva: '' },
    };
    expect(obterEstrutura('etica-compliance').safeParse(semCriterio).success).toBe(false);
  });
});

describe('regras de formato da comunicação', () => {
  it('e-mail sem a saudação obrigatória reprova', () => {
    const semSaudacao = { ...comunicacaoEmailValida, corpo: 'Segue o alinhamento da nova escala.' };
    expect(obterEstrutura('comunicacao-lideranca').safeParse(semSaudacao).success).toBe(false);
  });

  it('e-mail sem assunto reprova', () => {
    const semAssunto = { ...comunicacaoEmailValida, assunto: null };
    expect(obterEstrutura('comunicacao-lideranca').safeParse(semAssunto).success).toBe(false);
  });

  it('mensagem informal com mais de 5 parágrafos reprova', () => {
    const longa = {
      ...comunicacaoEmailValida,
      formato: 'informal',
      assunto: null,
      corpo: Array.from({ length: 6 }, (_, i) => `Parágrafo ${i + 1} com conteúdo.`).join('\n\n'),
    };
    expect(obterEstrutura('comunicacao-lideranca').safeParse(longa).success).toBe(false);
  });

  it('mensagem informal dentro do limite passa', () => {
    const curta = {
      ...comunicacaoEmailValida,
      formato: 'informal',
      assunto: null,
      corpo: 'Oi! Passando para alinhar a escala.\n\nQualquer dúvida, me chama.',
    };
    expect(obterEstrutura('comunicacao-lideranca').safeParse(curta).success).toBe(true);
  });

  it('escalonamento necessário exige situação e ação', () => {
    const incompleto = {
      ...comunicacaoEmailValida,
      escalonamento: { necessario: true, situacao: null, acaoRecomendada: null },
    };
    expect(obterEstrutura('comunicacao-lideranca').safeParse(incompleto).success).toBe(false);
  });
});

describe('regras específicas de mentoria e prompts', () => {
  it('mentoria sem fundamentação reprova', () => {
    const semFonte = {
      ...mentoriaValida,
      orientacao: { ...mentoriaValida.orientacao, fundamentacao: [] },
    };
    expect(obterEstrutura('mentoria-bp').safeParse(semFonte).success).toBe(false);
  });

  it('mentoria exige as quatro perspectivas', () => {
    const semCultura = {
      ...mentoriaValida,
      analiseEstrategica: { ...mentoriaValida.analiseEstrategica, cultura: '' },
    };
    expect(obterEstrutura('mentoria-bp').safeParse(semCultura).success).toBe(false);
  });

  it('prompt gerado sem restrições reprova (negative prompting é sempre exigido)', () => {
    const semRestricao = {
      ...promptValido,
      promptGerado: { ...promptValido.promptGerado, restricoes: [] },
    };
    expect(obterEstrutura('engenharia-prompts').safeParse(semRestricao).success).toBe(false);
  });

  it('prompt de agente simples pode omitir o fluxo de ação', () => {
    const semFluxo = {
      ...promptValido,
      promptGerado: { ...promptValido.promptGerado, fluxoAcao: null },
    };
    expect(obterEstrutura('engenharia-prompts').safeParse(semFluxo).success).toBe(true);
  });
});
