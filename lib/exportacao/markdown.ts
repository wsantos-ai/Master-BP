import { ROTULOS_SECAO } from './rotulos';

/**
 * Serialização da entrega estruturada para Markdown (FR-021).
 *
 * Preserva títulos, tópicos e tabelas — a estrutura é justamente o que torna o documento
 * comparável e defensável (Princípio V). É também a representação intermediária de onde saem
 * o DOCX e o PDF.
 */

export type ItemPlano = { acao: string; responsavel: string; prazo: string };

function rotular(chave: string): string {
  return (
    ROTULOS_SECAO[chave] ?? chave.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
  );
}

function tabela(linhas: Record<string, unknown>[]): string {
  const colunas = Object.keys(linhas[0] ?? {});
  if (colunas.length === 0) return '';

  const celula = (v: unknown) =>
    Array.isArray(v) ? v.join('; ') : String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');

  return [
    `| ${colunas.map(rotular).join(' | ')} |`,
    `| ${colunas.map(() => '---').join(' | ')} |`,
    ...linhas.map((l) => `| ${colunas.map((c) => celula(l[c])).join(' | ')} |`),
  ].join('\n');
}

function valorParaMarkdown(valor: unknown, nivel: number): string {
  if (valor === null || valor === undefined || valor === '') return '—';

  if (typeof valor !== 'object') return String(valor);

  if (Array.isArray(valor)) {
    if (valor.length === 0) return '—';
    if (typeof valor[0] === 'object' && valor[0] !== null) {
      return tabela(valor as Record<string, unknown>[]);
    }
    return valor.map((item) => `- ${String(item)}`).join('\n');
  }

  return Object.entries(valor as Record<string, unknown>)
    .map(([chave, sub]) => {
      const conteudo = valorParaMarkdown(sub, nivel + 1);
      return conteudo.includes('\n')
        ? `${'#'.repeat(Math.min(nivel + 1, 6))} ${rotular(chave)}\n\n${conteudo}`
        : `**${rotular(chave)}:** ${conteudo}`;
    })
    .join('\n\n');
}

export function entregaParaMarkdown(params: {
  titulo: string;
  conteudo: Record<string, unknown>;
  planoAcao: ItemPlano[];
  marcacaoSigilo: string;
  notaGuarda?: string | null;
  avisoEscalonamento?: string | null;
}): string {
  const partes: string[] = [];

  partes.push(`# ${params.titulo}`);

  if (params.marcacaoSigilo === 'restrito') {
    partes.push('> **DOCUMENTO RESTRITO**');
  }

  // Escalonamento antes de tudo, como na tela (FR-012).
  if (params.avisoEscalonamento) {
    partes.push(`> ⚠️ **Validação obrigatória antes de qualquer ação**\n>\n> ${params.avisoEscalonamento}`);
  }

  for (const [chave, valor] of Object.entries(params.conteudo)) {
    if (chave === 'planoAcao') continue;
    partes.push(`## ${rotular(chave)}`);
    partes.push(valorParaMarkdown(valor, 2));
  }

  partes.push('## Plano de ação');
  partes.push(tabela(params.planoAcao as unknown as Record<string, unknown>[]));

  if (params.notaGuarda) {
    partes.push(`---\n\n**Guarda:** ${params.notaGuarda}`);
  }

  return partes.join('\n\n');
}
