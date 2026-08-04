import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Carregamento dos prompts canônicos (Princípio IV, research.md R-06).
 *
 * `lib/agentes/*.md` é a fonte única de verdade do comportamento de cada assistente. Este
 * módulo apenas LÊ esses arquivos e calcula o hash do conteúdo — não existe função de escrita
 * aqui, e não deve existir.
 *
 * O hash é gravado em cada atendimento. Meses depois, se uma entrega for questionada, é
 * possível responder com qual versão do prompt ela foi produzida.
 */

const DIRETORIO_PROMPTS = path.join(process.cwd(), 'lib', 'agentes');

export type PromptCanonico = {
  arquivo: string;
  conteudo: string;
  hash: string;
};

const cache = new Map<string, PromptCanonico>();

export class ErroPromptCanonico extends Error {}

export function calcularHash(conteudo: string): string {
  return createHash('sha256').update(conteudo, 'utf8').digest('hex');
}

/**
 * Lê um prompt canônico. Em produção o conteúdo é cacheado; em desenvolvimento, não —
 * editar o prompt e ver o efeito imediato é parte do fluxo de trabalho do Princípio IV.
 */
export async function carregarPrompt(arquivo: string): Promise<PromptCanonico> {
  if (arquivo.includes('..') || path.isAbsolute(arquivo)) {
    throw new ErroPromptCanonico(`Caminho de prompt inválido: ${arquivo}`);
  }

  const emProducao = process.env.NODE_ENV === 'production';
  if (emProducao) {
    const emCache = cache.get(arquivo);
    if (emCache) return emCache;
  }

  const caminho = path.join(DIRETORIO_PROMPTS, arquivo);

  let conteudo: string;
  try {
    conteudo = await readFile(caminho, 'utf8');
  } catch {
    throw new ErroPromptCanonico(
      `Prompt canônico não encontrado: ${arquivo}. A aplicação não opera sem ele (Princípio IV).`,
    );
  }

  if (conteudo.trim().length === 0) {
    throw new ErroPromptCanonico(`Prompt canônico vazio: ${arquivo}.`);
  }

  const prompt: PromptCanonico = { arquivo, conteudo, hash: calcularHash(conteudo) };
  if (emProducao) cache.set(arquivo, prompt);
  return prompt;
}

/** Usado no boot e nos testes: falha cedo se algum prompt estiver ausente. */
export async function verificarPromptsPresentes(arquivos: string[]): Promise<void> {
  await Promise.all(arquivos.map((a) => carregarPrompt(a)));
}

export function limparCachePrompts(): void {
  cache.clear();
}
