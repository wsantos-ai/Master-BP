import 'server-only';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { ROTULOS_SECAO } from './rotulos';
import { aplicarMarcacao } from './sigilo';
import type { ItemPlano } from './markdown';

/**
 * Geração de DOCX a partir da entrega estruturada (FR-021, FR-022).
 * Títulos viram Heading, listas viram bullets e arrays de objetos viram tabelas reais — não
 * texto simulando tabela.
 */

function rotular(chave: string): string {
  return (
    ROTULOS_SECAO[chave] ?? chave.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
  );
}

function tabelaDocx(linhas: Record<string, unknown>[]): Table {
  const colunas = Object.keys(linhas[0] ?? {});

  const celula = (texto: string, negrito = false) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: texto, bold: negrito })] })],
    });

  const conteudo = (v: unknown) => (Array.isArray(v) ? v.join('; ') : String(v ?? '—'));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: colunas.map((c) => celula(rotular(c), true)) }),
      ...linhas.map(
        (linha) => new TableRow({ children: colunas.map((c) => celula(conteudo(linha[c]))) }),
      ),
    ],
  });
}

function blocos(valor: unknown, nivel: number): (Paragraph | Table)[] {
  if (valor === null || valor === undefined || valor === '') {
    return [new Paragraph('—')];
  }

  if (typeof valor !== 'object') {
    return [new Paragraph(String(valor))];
  }

  if (Array.isArray(valor)) {
    if (valor.length === 0) return [new Paragraph('—')];
    if (typeof valor[0] === 'object' && valor[0] !== null) {
      return [tabelaDocx(valor as Record<string, unknown>[])];
    }
    return valor.map((item) => new Paragraph({ text: String(item), bullet: { level: 0 } }));
  }

  const saida: (Paragraph | Table)[] = [];
  for (const [chave, sub] of Object.entries(valor as Record<string, unknown>)) {
    saida.push(
      new Paragraph({
        children: [new TextRun({ text: rotular(chave), bold: true })],
        heading: nivel <= 2 ? HeadingLevel.HEADING_3 : undefined,
      }),
    );
    saida.push(...blocos(sub, nivel + 1));
  }
  return saida;
}

export async function entregaParaDocx(params: {
  titulo: string;
  conteudo: Record<string, unknown>;
  planoAcao: ItemPlano[];
  marcacaoSigilo: string;
  notaGuarda?: string | null;
  avisoEscalonamento?: string | null;
}): Promise<Buffer> {
  const marcacao = aplicarMarcacao(params.marcacaoSigilo, params.notaGuarda ?? null);
  const filhos: (Paragraph | Table)[] = [];

  if (marcacao.cabecalho) {
    filhos.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: marcacao.cabecalho, bold: true, allCaps: true })],
      }),
    );
  }

  filhos.push(new Paragraph({ text: params.titulo, heading: HeadingLevel.HEADING_1 }));

  if (params.avisoEscalonamento) {
    filhos.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Validação obrigatória antes de qualquer ação: ', bold: true }),
          new TextRun({ text: params.avisoEscalonamento }),
        ],
      }),
    );
  }

  for (const [chave, valor] of Object.entries(params.conteudo)) {
    if (chave === 'planoAcao') continue;
    filhos.push(new Paragraph({ text: rotular(chave), heading: HeadingLevel.HEADING_2 }));
    filhos.push(...blocos(valor, 2));
  }

  filhos.push(new Paragraph({ text: 'Plano de ação', heading: HeadingLevel.HEADING_2 }));
  filhos.push(tabelaDocx(params.planoAcao as unknown as Record<string, unknown>[]));

  if (marcacao.notaGuarda) {
    filhos.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Guarda: ', bold: true }),
          new TextRun({ text: marcacao.notaGuarda }),
        ],
      }),
    );
  }

  const documento = new Document({ sections: [{ children: filhos }] });
  return Packer.toBuffer(documento);
}
