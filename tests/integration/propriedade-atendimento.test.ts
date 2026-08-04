import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarUsuario,
  limparAtendimentos,
  prisma,
  semearAssistentes,
} from './ajuda';
import {
  buscarAtendimentoCompleto,
  buscarAtendimentoDoAutor,
  criarAtendimento,
  criarLacunas,
  excluirAtendimentoDoAutor,
  listarHistorico,
  listarLacunas,
} from '@/lib/dados/atendimentos';

/**
 * SC-006: nenhum BP visualiza atendimento de outro BP.
 *
 * O filtro de propriedade é aplicado na consulta, não na tela. Estes testes chamam a camada de
 * dados diretamente — se passassem apenas pela UI, provariam só que a tela esconde.
 */

let bpA: { id: string };
let bpB: { id: string };
let atendimentoDeA: string;

beforeAll(async () => {
  await semearAssistentes();
});

beforeEach(async () => {
  await limparAtendimentos();
  await semearAssistentes();

  bpA = await criarUsuario('a@exemplo.com.br', 'BP A');
  bpB = await criarUsuario('b@exemplo.com.br', 'BP B');

  const atendimento = await criarAtendimento({
    autorId: bpA.id,
    assistenteId: 'etica-compliance',
    relato: 'Denúncia de assédio moral na equipe de operações.',
    origemRelato: 'texto',
    trocaManual: false,
    assistenteSugerido: 'etica-compliance',
    justificativaSugestao: null,
    promptHash: 'hash-de-teste',
    classificacaoSigilo: 'sensivel',
  });
  atendimentoDeA = atendimento.id;

  await criarLacunas(
    atendimentoDeA,
    [{ pergunta: 'Quem foi ouvido?', porQueImporta: 'Contraditório.', critica: true }],
    1,
  );
});

describe('leitura', () => {
  it('o autor enxerga o próprio atendimento', async () => {
    const encontrado = await buscarAtendimentoDoAutor(atendimentoDeA, bpA.id);
    expect(encontrado).not.toBeNull();
    expect(encontrado?.relatoInicial).toContain('assédio moral');
  });

  it('outro BP não enxerga — devolve null, indistinguível de inexistente', async () => {
    expect(await buscarAtendimentoDoAutor(atendimentoDeA, bpB.id)).toBeNull();
    expect(await buscarAtendimentoDoAutor('id-que-nao-existe', bpB.id)).toBeNull();
  });

  it('a leitura completa também é barrada para outro BP', async () => {
    expect(await buscarAtendimentoCompleto(atendimentoDeA, bpA.id)).not.toBeNull();
    expect(await buscarAtendimentoCompleto(atendimentoDeA, bpB.id)).toBeNull();
  });

  it('as lacunas não vazam para outro BP', async () => {
    expect(await listarLacunas(atendimentoDeA, bpA.id)).toHaveLength(1);
    expect(await listarLacunas(atendimentoDeA, bpB.id)).toBeNull();
  });
});

describe('histórico', () => {
  it('lista apenas os atendimentos do próprio BP', async () => {
    await criarAtendimento({
      autorId: bpB.id,
      assistenteId: 'mentoria-bp',
      relato: 'Turnover alto na equipe comercial.',
      origemRelato: 'texto',
      trocaManual: false,
      assistenteSugerido: 'mentoria-bp',
      justificativaSugestao: null,
      promptHash: 'hash-de-teste',
      classificacaoSigilo: 'padrao',
    });

    const deA = await listarHistorico({ autorId: bpA.id, pagina: 1, porPagina: 20 });
    const deB = await listarHistorico({ autorId: bpB.id, pagina: 1, porPagina: 20 });

    expect(deA.total).toBe(1);
    expect(deB.total).toBe(1);
    expect(deA.itens[0]?.id).toBe(atendimentoDeA);
    expect(deB.itens[0]?.id).not.toBe(atendimentoDeA);
  });

  it('filtra por especialidade sem cruzar autores', async () => {
    const resultado = await listarHistorico({
      autorId: bpB.id,
      especialidade: 'etica-compliance',
      pagina: 1,
      porPagina: 20,
    });
    expect(resultado.total).toBe(0);
  });
});

describe('exclusão', () => {
  it('outro BP não consegue excluir', async () => {
    expect(await excluirAtendimentoDoAutor(atendimentoDeA, bpB.id)).toBe(false);
    expect(await buscarAtendimentoDoAutor(atendimentoDeA, bpA.id)).not.toBeNull();
  });

  it('o autor consegue excluir o próprio atendimento (FR-027)', async () => {
    expect(await excluirAtendimentoDoAutor(atendimentoDeA, bpA.id)).toBe(true);
    expect(await buscarAtendimentoDoAutor(atendimentoDeA, bpA.id)).toBeNull();
  });
});

describe('cifragem em repouso (Princípio I)', () => {
  it('o relato não fica legível na coluna do banco', async () => {
    const bruto = await prisma.atendimento.findUnique({
      where: { id: atendimentoDeA },
      select: { relatoInicial: true },
    });

    expect(bruto?.relatoInicial).not.toContain('assédio');
    expect(bruto?.relatoInicial.startsWith('v1:')).toBe(true);
  });

  it('a pergunta da lacuna também é cifrada', async () => {
    const bruto = await prisma.lacuna.findFirst({
      where: { atendimentoId: atendimentoDeA },
      select: { pergunta: true },
    });
    expect(bruto?.pergunta).not.toContain('ouvido');
  });
});
