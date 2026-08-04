import 'server-only';
import { entregaParaMarkdown, type ItemPlano } from './markdown';
import { aplicarMarcacao } from './sigilo';

/**
 * Geração de PDF (FR-021, FR-022).
 *
 * Produz HTML imprimível a partir da mesma representação intermediária usada pelo Markdown e
 * pelo DOCX. Manter a origem única evita o cenário em que um formato ganha uma seção e os
 * outros não.
 *
 * O HTML é servido com estilo de impressão embutido; o navegador do BP converte em PDF. Uma
 * dependência de renderização headless traria peso considerável para um ganho marginal nesta
 * fase — se a exportação binária virar requisito, a substituição é local a este arquivo.
 */

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Conversor mínimo: cobre o subconjunto de Markdown que a entrega produz. */
function markdownParaHtml(markdown: string): string {
  const linhas = markdown.split('\n');
  const saida: string[] = [];
  let emLista = false;
  let emTabela = false;

  const fecharBlocos = () => {
    if (emLista) {
      saida.push('</ul>');
      emLista = false;
    }
    if (emTabela) {
      saida.push('</tbody></table>');
      emTabela = false;
    }
  };

  for (const linha of linhas) {
    const bruta = linha.trim();

    if (bruta === '') {
      fecharBlocos();
      continue;
    }

    const titulo = /^(#{1,6})\s+(.*)$/.exec(bruta);
    if (titulo) {
      fecharBlocos();
      const nivel = titulo[1]!.length;
      saida.push(`<h${nivel}>${escapar(titulo[2]!)}</h${nivel}>`);
      continue;
    }

    if (bruta.startsWith('> ')) {
      fecharBlocos();
      saida.push(`<blockquote>${escapar(bruta.slice(2))}</blockquote>`);
      continue;
    }

    if (bruta.startsWith('- ')) {
      if (emTabela) fecharBlocos();
      if (!emLista) {
        saida.push('<ul>');
        emLista = true;
      }
      saida.push(`<li>${escapar(bruta.slice(2))}</li>`);
      continue;
    }

    if (bruta.startsWith('|')) {
      const celulas = bruta.split('|').slice(1, -1).map((c) => c.trim());
      if (celulas.every((c) => /^-+$/.test(c))) continue; // separador

      if (!emTabela) {
        saida.push('<table><thead><tr>');
        saida.push(celulas.map((c) => `<th>${escapar(c)}</th>`).join(''));
        saida.push('</tr></thead><tbody>');
        emTabela = true;
        continue;
      }
      saida.push(`<tr>${celulas.map((c) => `<td>${escapar(c)}</td>`).join('')}</tr>`);
      continue;
    }

    fecharBlocos();
    saida.push(`<p>${escapar(bruta).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`);
  }

  fecharBlocos();
  return saida.join('\n');
}

const ESTILO = `
  @page { size: A4; margin: 2cm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1c2430; line-height: 1.5; }
  h1 { font-size: 20pt; } h2 { font-size: 15pt; margin-top: 1.4em; } h3 { font-size: 12pt; }
  table { width: 100%; border-collapse: collapse; margin: 0.75em 0; page-break-inside: avoid; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #eee; }
  blockquote { border-left: 4px solid #d98324; background: #fff4e5; margin: 1em 0; padding: 0.75em 1em; }
  .marcacao-sigilo { text-align: center; font-weight: 700; letter-spacing: 0.08em; border: 2px solid #1c2430; padding: 6px; margin-bottom: 1.5em; }
`;

export function entregaParaPdfHtml(params: {
  titulo: string;
  conteudo: Record<string, unknown>;
  planoAcao: ItemPlano[];
  marcacaoSigilo: string;
  notaGuarda?: string | null;
  avisoEscalonamento?: string | null;
}): string {
  const marcacao = aplicarMarcacao(params.marcacaoSigilo, params.notaGuarda ?? null);
  const markdown = entregaParaMarkdown({ ...params, notaGuarda: marcacao.notaGuarda });

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapar(params.titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
${marcacao.cabecalho ? `<div class="marcacao-sigilo">${escapar(marcacao.cabecalho)}</div>` : ''}
${markdownParaHtml(markdown)}
<script>window.addEventListener('load', () => window.print());</script>
</body>
</html>`;
}
