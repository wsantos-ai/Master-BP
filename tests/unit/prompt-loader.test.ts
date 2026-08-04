import { describe, expect, it } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  ErroPromptCanonico,
  calcularHash,
  carregarPrompt,
  verificarPromptsPresentes,
} from '@/lib/assistentes/prompt-loader';
import { ARQUIVOS_PROMPT, CATALOGO } from '@/lib/assistentes/catalogo';

const DIRETORIO = path.join(process.cwd(), 'lib', 'agentes');

describe('prompts canônicos (Princípio IV)', () => {
  it('carrega os cinco prompts do catálogo', async () => {
    await expect(verificarPromptsPresentes(ARQUIVOS_PROMPT)).resolves.toBeUndefined();
    expect(ARQUIVOS_PROMPT).toHaveLength(5);
  });

  it('calcula um hash estável para o mesmo conteúdo', async () => {
    const primeira = await carregarPrompt('agente-bp.md');
    const segunda = await carregarPrompt('agente-bp.md');
    expect(primeira.hash).toBe(segunda.hash);
    expect(primeira.hash).toHaveLength(64);
  });

  it('produz hash diferente quando o conteúdo muda', async () => {
    const original = await carregarPrompt('agente-bp.md');
    const alterado = calcularHash(`${original.conteudo}\n- nova diretriz`);
    expect(alterado).not.toBe(original.hash);
  });

  it('dá hashes distintos para especialidades distintas', async () => {
    const carregados = await Promise.all(ARQUIVOS_PROMPT.map((a) => carregarPrompt(a)));
    const hashes = new Set(carregados.map((p) => p.hash));
    expect(hashes.size).toBe(ARQUIVOS_PROMPT.length);
  });

  it('recusa caminho que tenta sair do diretório de prompts', async () => {
    await expect(carregarPrompt('../../package.json')).rejects.toThrow(ErroPromptCanonico);
  });

  it('falha de forma explícita quando o prompt não existe', async () => {
    await expect(carregarPrompt('agente-inexistente.md')).rejects.toThrow(/não encontrado/);
  });

  it('não altera os arquivos canônicos ao carregá-los', async () => {
    const caminho = path.join(DIRETORIO, 'agente-denuncias.md');
    const antes = await stat(caminho);
    const conteudoAntes = await readFile(caminho, 'utf8');

    await carregarPrompt('agente-denuncias.md');

    const depois = await stat(caminho);
    const conteudoDepois = await readFile(caminho, 'utf8');
    expect(depois.mtimeMs).toBe(antes.mtimeMs);
    expect(conteudoDepois).toBe(conteudoAntes);
  });

  it('o catálogo aponta apenas para prompts existentes', async () => {
    for (const especialidade of CATALOGO) {
      const prompt = await carregarPrompt(especialidade.arquivoPrompt);
      expect(prompt.conteudo.length).toBeGreaterThan(100);
    }
  });
});
