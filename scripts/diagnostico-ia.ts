/**
 * Diagnóstico da integração com o provedor de IA.
 *
 * Faz chamadas reais e reporta o resultado de cada etapa separadamente. Serve para separar
 * "problema de configuração" de "problema de código" sem precisar subir a aplicação inteira —
 * e para que uma falha de áudio não seja confundida com uma falha de texto.
 *
 *   npx tsx scripts/diagnostico-ia.ts
 */
import { readFileSync } from 'node:fs';

for (const linha of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  if (linha.trim().startsWith('#')) continue;
  const par = /^(\w+)=\s*"?(.*?)"?\s*$/.exec(linha);
  if (par?.[1]) process.env[par[1]] = par[2];
}

const chave = process.env.OPENROUTER_API_KEY;
// Só o tamanho: a chave em si nunca vai para a saída padrão.
console.log(`OPENROUTER_API_KEY: ${chave ? `presente (${chave.length} caracteres)` : 'AUSENTE'}`);

const { MODELO_CAPAZ, MODELO_RAPIDO, MODELO_TRANSCRICAO } = await import('../lib/ia/openrouter.js');
console.log(`Modelo rápido:      ${MODELO_RAPIDO}`);
console.log(`Modelo capaz:       ${MODELO_CAPAZ}`);
console.log(`Modelo transcrição: ${MODELO_TRANSCRICAO}`);

const RELATO = 'minha equipe está com turnover alto e o gestor não sabe conduzir feedback';

// 1. Roteamento — usa o modelo rápido.
const { rotear } = await import('../lib/ia/roteador.js');
try {
  const resultado = await rotear(RELATO);
  console.log(`\n[1/3] Roteamento OK -> ${resultado.sugestoes[0]?.assistenteId}`);
} catch (erro) {
  const e = erro as Error;
  console.log(`\n[1/3] Roteamento FALHOU: ${e.name} | ${e.message}`);
  process.exitCode = 1;
}

// 2. Refinamento — usa o modelo capaz. É esta a etapa da criação do atendimento.
const { conduzirRefinamento } = await import('../lib/ia/refinamento.js');
const { exigirEspecialidade } = await import('../lib/assistentes/catalogo.js');

try {
  const saida = await conduzirRefinamento({
    especialidade: exigirEspecialidade('mentoria-bp'),
    relato: RELATO,
    lacunas: [],
  });
  console.log(`[2/3] Refinamento OK -> ${saida.novasLacunas.length} lacuna(s) propostas`);
  for (const l of saida.novasLacunas) console.log(`      • ${l.pergunta}`);
} catch (erro) {
  const e = erro as Error;
  console.log(`[2/3] Refinamento FALHOU: ${e.name} | ${e.message}`);
  process.exitCode = 1;
}

// 3. Transcrição — outro modelo, outro endpoint. Uma falha aqui não implica falha no texto.
//
// O caminho do áudio vem por argumento porque não versionamos amostra de voz no repositório:
// gravação de fala é dado biométrico, e o Princípio I não abre exceção para arquivo de teste.
//
//   npx tsx scripts/diagnostico-ia.ts ./amostra.webm
const caminhoAudio = process.argv[2];

if (!caminhoAudio) {
  console.log('[3/3] Transcrição PULADA — informe o caminho de um áudio como argumento.');
} else {
  const { transcrever } = await import('../lib/ia/transcricao.js');
  const { extname } = await import('node:path');

  const MIME_POR_EXTENSAO: Record<string, string> = {
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/x-m4a',
    '.mp4': 'audio/mp4',
    '.wav': 'audio/wav',
  };

  try {
    const bytes = readFileSync(caminhoAudio);
    const tipo = MIME_POR_EXTENSAO[extname(caminhoAudio).toLowerCase()] ?? 'audio/webm';

    const resultado = await transcrever({
      size: bytes.byteLength,
      type: tipo,
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    });

    console.log(`[3/3] Transcrição OK -> confiancaBaixa=${resultado.confiancaBaixa}`);
    console.log(`      ${resultado.texto.slice(0, 120)}`);
  } catch (erro) {
    const e = erro as Error;
    console.log(`[3/3] Transcrição FALHOU: ${e.name} | ${e.message}`);
    process.exitCode = 1;
  }
}
