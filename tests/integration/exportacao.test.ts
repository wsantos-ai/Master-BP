import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarUsuario, limparAtendimentos, prisma, semearAssistentes } from './ajuda';
import { criarAtendimento } from '@/lib/dados/atendimentos';
import { registrarAuditoria } from '@/lib/dados/auditoria';
import { cifrar } from '@/lib/dados/cripto';
import { entregaParaMarkdown } from '@/lib/exportacao/markdown';
import { entregaParaDocx } from '@/lib/exportacao/docx';
import { entregaParaPdfHtml } from '@/lib/exportacao/pdf';
import { CABECALHO_RESTRITO, aplicarMarcacao } from '@/lib/exportacao/sigilo';
import { parecerValido } from '../fixtures/entregas';

/**
 * US3 — a entrega precisa sair do app preservando estrutura, e o sigilo tem de viajar junto
 * com o documento (FR-021, FR-022). Toda exportação gera auditoria (SC-009).
 */

let bp: { id: string };
let atendimentoId: string;

const dadosEntrega = {
  titulo: 'Ética e compliance (denúncias)',
  conteudo: parecerValido as unknown as Record<string, unknown>,
  planoAcao: parecerValido.planoAcao,
  marcacaoSigilo: 'restrito',
  notaGuarda: parecerValido.notaGuarda,
  avisoEscalonamento:
    'Esta situação envolve assédio moral. Antes de qualquer ação, valide com a área de Compliance.',
};

beforeAll(async () => {
  await semearAssistentes();
});

beforeEach(async () => {
  await limparAtendimentos();
  await semearAssistentes();

  bp = await criarUsuario('bp@exemplo.com.br', 'BP');
  const atendimento = await criarAtendimento({
    autorId: bp.id,
    assistenteId: 'etica-compliance',
    relato: 'Relato de conduta inadequada.',
    origemRelato: 'texto',
    trocaManual: false,
    assistenteSugerido: 'etica-compliance',
    justificativaSugestao: null,
    promptHash: 'hash-de-teste',
    classificacaoSigilo: 'sensivel',
  });
  atendimentoId = atendimento.id;

  await prisma.entrega.create({
    data: {
      atendimentoId,
      estruturaAplicada: 'etica-compliance',
      conteudo: cifrar(JSON.stringify(parecerValido)),
      planoAcao: cifrar(JSON.stringify(parecerValido.planoAcao)),
      marcacaoSigilo: 'restrito',
      notaGuarda: parecerValido.notaGuarda,
      versaoModelo: 'modelo-de-teste',
    },
  });
});

describe('Markdown preserva a estrutura (FR-021)', () => {
  const markdown = entregaParaMarkdown(dadosEntrega);

  it('mantém os títulos das seções', () => {
    expect(markdown).toContain('## Resumo da apuração');
    expect(markdown).toContain('## Embasamento legal e normativo');
    expect(markdown).toContain('## Plano de ação');
  });

  it('mantém tabelas com cabeçalho', () => {
    expect(markdown).toContain('| Ação | Responsável | Prazo |');
    expect(markdown).toContain('| --- | --- | --- |');
  });

  it('mantém tópicos das listas', () => {
    expect(markdown).toContain('- Treinamento de liderança respeitosa');
  });

  it('coloca o escalonamento antes do plano de ação (FR-012)', () => {
    const posAviso = markdown.indexOf('Validação obrigatória');
    const posPlano = markdown.indexOf('## Plano de ação');
    expect(posAviso).toBeGreaterThan(-1);
    expect(posAviso).toBeLessThan(posPlano);
  });
});

describe('marcação de sigilo (FR-022)', () => {
  it('documento restrito carrega a marcação e a nota de guarda', () => {
    const markdown = entregaParaMarkdown(dadosEntrega);
    expect(markdown).toContain('DOCUMENTO RESTRITO');
    expect(markdown).toContain('**Guarda:**');
  });

  it('documento comum não recebe marcação', () => {
    const markdown = entregaParaMarkdown({
      ...dadosEntrega,
      marcacaoSigilo: 'publico_interno',
      notaGuarda: null,
    });
    expect(markdown).not.toContain('DOCUMENTO RESTRITO');
  });

  it('nota de guarda ausente em documento restrito recebe o texto padrão', () => {
    const marcacao = aplicarMarcacao('restrito', null);
    expect(marcacao.cabecalho).toBe(CABECALHO_RESTRITO);
    expect(marcacao.notaGuarda).toContain('local seguro');
  });

  it('o HTML de impressão também carrega a marcação', () => {
    const html = entregaParaPdfHtml(dadosEntrega);
    expect(html).toContain(CABECALHO_RESTRITO);
    expect(html).toContain('<table>');
    expect(html).toContain('lang="pt-BR"');
  });

  it('gera um DOCX não vazio', async () => {
    const buffer = await entregaParaDocx(dadosEntrega);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    // Assinatura de arquivo ZIP — DOCX é um contêiner OOXML.
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
  });
});

describe('auditoria de exportação (SC-009)', () => {
  it('registra autor, ação e formato', async () => {
    await registrarAuditoria({
      atendimentoId,
      usuarioId: bp.id,
      acao: 'exportacao',
      detalhe: { formato: 'docx', marcacaoSigilo: 'restrito' },
    });

    const registros = await prisma.registroAuditoria.findMany({ where: { atendimentoId } });
    expect(registros).toHaveLength(1);
    expect(registros[0]?.acao).toBe('exportacao');
    expect(registros[0]?.usuarioId).toBe(bp.id);
    expect(JSON.parse(registros[0]!.detalhe!).formato).toBe('docx');
  });
});
