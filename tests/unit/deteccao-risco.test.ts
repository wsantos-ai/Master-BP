import { describe, expect, it } from 'vitest';
import {
  detectarPorRegra,
  detectarRisco,
  exigeValidacaoJuridica,
  instanciaPara,
  mensagemEscalonamento,
  sinaisDoModelo,
  unirSinais,
} from '@/lib/dominio/deteccao-risco';
import { eufemisticos, explicitos, semRisco } from '../fixtures/casos-risco';

/**
 * SC-004: 100% dos atendimentos com risco jurídico elevado exibem a recomendação de validação.
 * Nenhum falso negativo tolerado. Esta suíte é portão de merge (`npm run test:risco`).
 */

describe('camada determinística — casos explícitos (SC-004)', () => {
  for (const caso of explicitos) {
    it(`detecta: ${caso.nome}`, () => {
      const tipos = detectarPorRegra(caso.texto).map((s) => s.tipoRisco);
      for (const esperado of caso.esperados) {
        expect(tipos, `falso negativo em "${caso.nome}"`).toContain(esperado);
      }
    });
  }
});

describe('camada determinística — sem risco não pode gerar ruído', () => {
  for (const caso of semRisco) {
    it(`não sinaliza: ${caso.nome}`, () => {
      expect(detectarPorRegra(caso.texto)).toHaveLength(0);
    });
  }
});

describe('relatos eufemísticos — o vão que a camada do modelo cobre (R-05)', () => {
  for (const caso of eufemisticos) {
    it(`sinaliza quando o modelo classifica: ${caso.nome}`, () => {
      // Com a regra sozinha o caso pode passar; é exatamente por isso que existe a segunda
      // camada. A união precisa sinalizar mesmo quando só o modelo viu o risco.
      const sinais = detectarRisco(caso.texto, caso.esperados);
      const tipos = sinais.map((s) => s.tipoRisco);
      for (const esperado of caso.esperados) {
        expect(tipos).toContain(esperado);
      }
      expect(sinais.length).toBeGreaterThan(0);
    });
  }
});

describe('união das camadas', () => {
  const texto = 'Denúncia de assédio moral na equipe.';

  it('marca "ambos" quando regra e modelo concordam', () => {
    const sinais = detectarRisco(texto, ['assedio_moral']);
    expect(sinais.find((s) => s.tipoRisco === 'assedio_moral')?.origemDeteccao).toBe('ambos');
  });

  it('mantém "regra" quando o modelo não sinalizou', () => {
    const sinais = detectarRisco(texto, []);
    expect(sinais[0]?.origemDeteccao).toBe('regra');
  });

  it('mantém "modelo" quando a regra não pegou', () => {
    const sinais = detectarRisco('situação delicada na equipe', ['assedio_moral']);
    expect(sinais[0]?.origemDeteccao).toBe('modelo');
  });

  it('discordância não anula nenhuma das camadas', () => {
    const sinais = detectarRisco(texto, ['fraude']);
    const tipos = sinais.map((s) => s.tipoRisco);
    expect(tipos).toContain('assedio_moral');
    expect(tipos).toContain('fraude');
  });

  it('não duplica o mesmo tipo de risco', () => {
    const unido = unirSinais(detectarPorRegra(texto), sinaisDoModelo(['assedio_moral']));
    expect(unido.filter((s) => s.tipoRisco === 'assedio_moral')).toHaveLength(1);
  });

  it('preserva o trecho gatilho da regra ao unir', () => {
    const sinais = detectarRisco(texto, ['assedio_moral']);
    expect(sinais[0]?.trechoGatilho).toContain('assédio moral');
  });
});

describe('instância recomendada', () => {
  it('assédio sexual, discriminação e fraude vão sempre ao jurídico', () => {
    expect(instanciaPara('assedio_sexual')).toBe('juridico');
    expect(instanciaPara('discriminacao')).toBe('juridico');
    expect(instanciaPara('fraude')).toBe('juridico');
  });

  it('justa causa vai a Relações Trabalhistas', () => {
    expect(instanciaPara('justa_causa')).toBe('relacoes_trabalhistas');
  });

  it('assédio moral e dado sensível vão a Compliance', () => {
    expect(instanciaPara('assedio_moral')).toBe('compliance');
    expect(instanciaPara('dado_sensivel')).toBe('compliance');
  });

  it('reconhece quando há exigência de validação jurídica', () => {
    expect(exigeValidacaoJuridica(detectarRisco('suspeita de fraude no caixa'))).toBe(true);
    expect(exigeValidacaoJuridica(detectarRisco('vamos falar de plano de carreira'))).toBe(false);
  });
});

describe('mensagem de escalonamento (FR-012)', () => {
  it('nomeia o risco e a instância', () => {
    const mensagem = mensagemEscalonamento(detectarRisco('relato de assédio sexual'));
    expect(mensagem).toContain('assédio sexual');
    expect(mensagem).toContain('departamento jurídico');
  });

  it('deixa claro que a orientação não substitui a validação', () => {
    const mensagem = mensagemEscalonamento(detectarRisco('suspeita de fraude'));
    expect(mensagem).toContain('não substitui');
  });

  it('agrega múltiplos riscos em uma única mensagem', () => {
    const mensagem = mensagemEscalonamento(
      detectarRisco('assédio sexual que pode virar ação trabalhista'),
    );
    expect(mensagem).toContain('assédio sexual');
    expect(mensagem).toContain('risco de ação trabalhista');
  });

  it('devolve null quando não há risco', () => {
    expect(mensagemEscalonamento([])).toBeNull();
  });
});
