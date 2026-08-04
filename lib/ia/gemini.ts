import 'server-only';
import { GoogleGenAI } from '@google/genai';

/**
 * Cliente Gemini.
 *
 * `GEMINI_API_KEY` é lida exclusivamente no servidor — o import de `server-only` faz o build
 * falhar se este módulo for arrastado para um Client Component.
 *
 * Seleção de modelo por rota (plan.md / research.md): roteamento e transcrição toleram o
 * modelo rápido; a entrega final justifica o mais capaz.
 */

/**
 * Aliases `-latest` em vez de versões fixas: `gemini-2.5-flash` responde 404 para chaves novas
 * ("no longer available to new users"), e fixar versão faz o app quebrar sozinho a cada
 * descontinuação do provedor. Sobrescreva por ambiente se precisar de uma versão específica.
 */
export const MODELO_RAPIDO = process.env.GEMINI_MODELO_RAPIDO ?? 'gemini-flash-latest';
export const MODELO_CAPAZ = process.env.GEMINI_MODELO_CAPAZ ?? 'gemini-pro-latest';

let clienteCache: GoogleGenAI | null = null;

export class ErroConfiguracaoIA extends Error {
  // Sem isto, `erro.name` seria "Error" e o log não distinguiria falta de chave de
  // indisponibilidade do provedor.
  override name = 'ErroConfiguracaoIA';
}

export function obterCliente(): GoogleGenAI {
  if (clienteCache) return clienteCache;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ErroConfiguracaoIA(
      'GEMINI_API_KEY ausente. Os assistentes não operam sem a chave do provedor.',
    );
  }

  clienteCache = new GoogleGenAI({ apiKey });
  return clienteCache;
}

export function limparClienteCache(): void {
  clienteCache = null;
}
