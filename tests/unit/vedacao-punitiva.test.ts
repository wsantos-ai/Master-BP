import { describe, expect, it } from 'vitest';
import {
  avaliarVedacaoPunitiva,
  ehMedidaPunitiva,
  haFatosApurados,
  itensPunitivos,
} from '@/lib/dominio/vedacao-punitiva';

const acao = (texto: string) => ({ acao: texto, responsavel: 'BP', prazo: '5 dias' });

describe('identificação de medida punitiva (FR-013)', () => {
  it.each([
    'Aplicar advertência escrita ao colaborador',
    'Suspensão disciplinar de três dias',
    'Proceder com a demissão do gestor',
    'Rescisão do contrato por justa causa',
    'Adotar medida disciplinar cabível',
    'Aplicar sanção conforme o código de conduta',
  ])('reconhece: %s', (texto) => {
    expect(ehMedidaPunitiva(texto)).toBe(true);
  });

  it.each([
    'Agendar conversa de alinhamento com o gestor',
    'Realizar treinamento de liderança respeitosa',
    'Concluir as oitivas pendentes',
    'Registrar o caso no canal de ética',
  ])('não confunde ação não punitiva: %s', (texto) => {
    expect(ehMedidaPunitiva(texto)).toBe(false);
  });

  it('filtra apenas os itens punitivos do plano', () => {
    const plano = [acao('Concluir oitivas'), acao('Aplicar advertência'), acao('Treinar equipe')];
    expect(itensPunitivos(plano)).toHaveLength(1);
  });
});

describe('vedação sem fatos apurados', () => {
  it('bloqueia punição quando não há fatos registrados', () => {
    const resultado = avaliarVedacaoPunitiva({
      planoAcao: [acao('Aplicar advertência escrita')],
      fatosRegistrados: false,
    });

    expect(resultado.permitido).toBe(false);
    if (!resultado.permitido) {
      expect(resultado.motivo).toContain('fatos apurados');
      expect(resultado.itens).toHaveLength(1);
    }
  });

  it('permite punição quando há fatos registrados', () => {
    const resultado = avaliarVedacaoPunitiva({
      planoAcao: [acao('Aplicar advertência escrita')],
      fatosRegistrados: true,
    });
    expect(resultado.permitido).toBe(true);
  });

  it('permite plano sem medida punitiva mesmo sem fatos', () => {
    const resultado = avaliarVedacaoPunitiva({
      planoAcao: [acao('Agendar mentoria com o gestor')],
      fatosRegistrados: false,
    });
    expect(resultado.permitido).toBe(true);
  });

  it('basta um item punitivo para bloquear o plano inteiro', () => {
    const resultado = avaliarVedacaoPunitiva({
      planoAcao: [acao('Treinar a equipe'), acao('Demitir o supervisor')],
      fatosRegistrados: false,
    });
    expect(resultado.permitido).toBe(false);
  });
});

describe('o que conta como fato apurado', () => {
  it('resposta substantiva conta', () => {
    expect(haFatosApurados(['Ouvidas a denunciante e duas testemunhas em 12/07/2026.'])).toBe(true);
  });

  it('resposta curta demais não conta', () => {
    expect(haFatosApurados(['sim'])).toBe(false);
  });

  it('resposta evasiva não conta', () => {
    expect(haFatosApurados(['não sei', 'sem informação', 'não tenho'])).toBe(false);
  });

  it('nenhuma resposta não conta', () => {
    expect(haFatosApurados([null, null])).toBe(false);
  });

  it('basta uma resposta substantiva entre várias vazias', () => {
    expect(haFatosApurados([null, 'não sei', 'Registro de ponto e câmeras confirmam o relato.'])).toBe(
      true,
    );
  });
});
