import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger, redigir } from '@/lib/observabilidade/logger';

/**
 * Princípio I: conteúdo de atendimento nunca chega a log.
 *
 * Este teste cobre a última linha de defesa — o redator. A primeira é a regra de ESLint que
 * proíbe `console` fora deste módulo.
 */

afterEach(() => vi.restoreAllMocks());

describe('redação de campos sensíveis', () => {
  it.each([
    'relato',
    'relatoInicial',
    'conteudo',
    'resposta',
    'pergunta',
    'texto',
    'entrega',
    'planoAcao',
    'trechoGatilho',
    'justificativa',
    'senha',
    'senhaHash',
    'email',
  ])('redige o campo "%s"', (campo) => {
    const redigido = redigir({ [campo]: 'denúncia de assédio moral contra o gestor' });
    expect(redigido[campo]).toBe('[redigido]');
  });

  it('preserva metadados úteis ao diagnóstico', () => {
    const redigido = redigir({ atendimentoId: 'abc123', tentativa: 2, ok: false });
    expect(redigido).toEqual({ atendimentoId: 'abc123', tentativa: 2, ok: false });
  });
});

/** Feature 003 — SC-007: o evento da rodada de refinamento é composto só de contagens. */
describe('evento da rodada de refinamento', () => {
  it('não carrega pergunta, resposta, justificativa nem relato', () => {
    const espiao = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Exatamente a forma emitida por app/api/atendimentos/[id]/mensagens/route.ts.
    logger.info('refinamento.rodada', {
      atendimentoId: 'abc123',
      propostas: 4,
      descartadas: 2,
      fechadasAproveitamento: 1,
      sinaisIgnorados: 0,
      criticasAbertas: 3,
      apresentadas: 3,
    });

    const linha = espiao.mock.calls[0]![0] as string;
    const registro = JSON.parse(linha) as { ctx: Record<string, unknown> };

    // Só números e o identificador. Nenhuma chave de conteúdo.
    for (const [chave, valor] of Object.entries(registro.ctx)) {
      if (chave === 'atendimentoId') continue;
      expect(typeof valor).toBe('number');
    }
    expect(Object.keys(registro.ctx)).not.toContain('pergunta');
    expect(Object.keys(registro.ctx)).not.toContain('resposta');
    expect(Object.keys(registro.ctx)).not.toContain('relato');
  });
});

describe('escrita no console', () => {
  it('não emite conteúdo sensível na linha de log', () => {
    const espia = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('atendimento.criado', {
      atendimentoId: 'abc123',
      relato: 'A colaboradora relatou assédio sexual pelo gerente.',
    });

    const linha = espia.mock.calls[0]![0] as string;
    expect(linha).not.toContain('assédio');
    expect(linha).not.toContain('colaboradora');
    expect(linha).toContain('[redigido]');
    expect(linha).toContain('abc123');
  });

  it('mantém o nome do evento mesmo quando o contexto traz a chave "evento"', () => {
    const espia = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('ia.schema_reprovado', { evento: 'entrega' });

    const linha = JSON.parse(espia.mock.calls[0]![0] as string);
    expect(linha.evento).toBe('ia.schema_reprovado');
    expect(linha.ctx.evento).toBe('entrega');
  });

  it('erros vão para console.error', () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.erro('entrega.falhou', { atendimentoId: 'abc' });
    expect(espia).toHaveBeenCalledOnce();
  });
});
