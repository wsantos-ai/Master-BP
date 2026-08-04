/**
 * Diagnóstico da integração com o provedor de IA.
 *
 * Faz uma chamada real de roteamento e reporta o resultado. Serve para separar "problema de
 * configuração" de "problema de código" sem precisar subir a aplicação inteira.
 *
 *   npx tsx scripts/diagnostico-ia.ts
 */
import { readFileSync } from 'node:fs';

for (const linha of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  if (linha.trim().startsWith('#')) continue;
  const par = /^(\w+)=\s*"?(.*?)"?\s*$/.exec(linha);
  if (par?.[1]) process.env[par[1]] = par[2];
}

const chave = process.env.GEMINI_API_KEY;
console.log(`GEMINI_API_KEY: ${chave ? `presente (${chave.length} caracteres)` : 'AUSENTE'}`);

const { MODELO_CAPAZ, MODELO_RAPIDO } = await import('../lib/ia/gemini.js');
console.log(`Modelo rápido:  ${MODELO_RAPIDO}`);
console.log(`Modelo capaz:   ${MODELO_CAPAZ}`);

const RELATO = 'minha equipe está com turnover alto e o gestor não sabe conduzir feedback';

// 1. Roteamento — usa o modelo rápido.
const { rotear } = await import('../lib/ia/roteador.js');
try {
  const resultado = await rotear(RELATO);
  console.log(`\n[1/2] Roteamento OK -> ${resultado.sugestoes[0]?.assistenteId}`);
} catch (erro) {
  const e = erro as Error;
  console.log(`\n[1/2] Roteamento FALHOU: ${e.name} | ${e.message}`);
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
  console.log(`[2/2] Refinamento OK -> ${saida.novasLacunas.length} lacuna(s) propostas`);
  for (const l of saida.novasLacunas) console.log(`      • ${l.pergunta}`);
} catch (erro) {
  const e = erro as Error;
  console.log(`[2/2] Refinamento FALHOU: ${e.name} | ${e.message}`);
  process.exitCode = 1;
}
