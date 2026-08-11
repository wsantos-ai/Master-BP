import 'server-only';
import { logger } from '@/lib/observabilidade/logger';

/**
 * Cliente do OpenRouter — provedor único de IA da plataforma (texto e transcrição).
 *
 * `OPENROUTER_API_KEY` é lida exclusivamente no servidor: o import de `server-only` faz o build
 * falhar se este módulo for arrastado para um Client Component.
 *
 * Sem SDK. A API é HTTP+JSON e o `fetch` do Node 20 basta — o que importa aqui é que o corpo da
 * requisição fique visível no código, porque é nele que mora a garantia do Princípio I
 * (research.md R-01, R-05).
 *
 * Esta camada NÃO decide política de produto e NÃO retenta. Ela chama, classifica o erro e
 * devolve. Quem decide se a resposta é aceitável é o Zod em saida-estruturada.ts; quem decide se
 * a confiança da transcrição é baixa é transcricao.ts; quem retenta é gerarEstruturado.
 */

const BASE = 'https://openrouter.ai/api/v1';

/**
 * O mesmo modelo atende as duas faixas: a variante Flash é rápida o bastante para roteamento e
 * capaz o bastante para a entrega. A distinção permanece como ponto de configuração (FR-003),
 * para o caso de um ambiente querer diferenciá-las.
 */
const MODELO_TEXTO_PADRAO = 'deepseek/deepseek-v4-flash-0731';

export const MODELO_RAPIDO = process.env.OPENROUTER_MODELO_RAPIDO || MODELO_TEXTO_PADRAO;
export const MODELO_CAPAZ = process.env.OPENROUTER_MODELO_CAPAZ || MODELO_TEXTO_PADRAO;
export const MODELO_TRANSCRICAO =
  process.env.OPENROUTER_MODELO_TRANSCRICAO || 'mistralai/voxtral-mini-transcribe';

/**
 * Política de dados enviada em TODA requisição (FR-011).
 *
 * Confiar apenas na configuração da conta seria confiar em estado externo que ninguém no
 * repositório consegue auditar e que qualquer pessoa com acesso ao painel reverte em silêncio.
 * Aqui a garantia é código: revisável em diff, verificável em teste.
 *
 * Custo aceito: reduz o conjunto de provedores elegíveis. Para este domínio é o trade-off certo.
 */
export const POLITICA_DADOS = { data_collection: 'deny', zdr: true } as const;

/** Falta de chave, chave inválida, sem crédito, modelo inexistente. Retentar não resolve. */
export class ErroConfiguracaoIA extends Error {
  // Sem isto, `erro.name` seria "Error" e o log não distinguiria falta de chave de
  // indisponibilidade do provedor.
  override name = 'ErroConfiguracaoIA';
}

/** Falha transitória: limite de requisições, indisponibilidade, timeout, rede. Vale retentar. */
export class ErroProvedorIA extends Error {
  override name = 'ErroProvedorIA';

  constructor(
    message: string,
    readonly status: number,
    /** Rótulo normalizado para o log — nunca corpo de resposta. */
    readonly motivo: string,
  ) {
    super(message);
  }
}

let chaveCache: string | null = null;

/**
 * Leitura preguiçosa, na primeira chamada — não no carregamento do módulo. A suíte de testes
 * nunca configura credencial e precisa conseguir importar este arquivo.
 */
function obterChave(): string {
  if (chaveCache) return chaveCache;

  const chave = process.env.OPENROUTER_API_KEY;
  if (!chave) {
    throw new ErroConfiguracaoIA(
      'OPENROUTER_API_KEY ausente. Os assistentes não operam sem a chave do provedor.',
    );
  }

  chaveCache = chave;
  return chaveCache;
}

export function limparClienteCache(): void {
  chaveCache = null;
  modoDegradado = false;
}

/**
 * Classifica a resposta de erro do provedor.
 *
 * O corpo da resposta NÃO é lido nem logado: ele pode ecoar o prompt, que contém o relato do BP.
 * Só o status entra em decisão e em log (Princípio I, SC-006).
 */
function classificarFalha(status: number, rota: string): never {
  if (status === 401 || status === 403) {
    throw new ErroConfiguracaoIA(
      'Credencial do provedor inválida ou sem permissão para este recurso.',
    );
  }
  if (status === 402) {
    throw new ErroConfiguracaoIA('Conta do provedor sem crédito disponível.');
  }
  if (status === 404) {
    throw new ErroConfiguracaoIA(
      `Modelo não encontrado no provedor (${rota}). Verifique o identificador configurado.`,
    );
  }
  if (status === 429) {
    throw new ErroProvedorIA('Limite de requisições do provedor atingido.', status, 'limite_requisicoes');
  }
  if (status >= 500) {
    throw new ErroProvedorIA('Provedor indisponível.', status, 'falha_provedor');
  }
  throw new ErroProvedorIA('Requisição recusada pelo provedor.', status, 'requisicao_invalida');
}

/** Erro interno: sinaliza que `json_schema` não passou e a degradação deve entrar (R-02). */
class SchemaNaoSuportado extends Error {}

async function requisitar(
  caminho: string,
  corpo: Record<string, unknown>,
  evento: string,
): Promise<unknown> {
  const chave = obterChave();

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
      },
      // A política de dados entra aqui, em toda requisição, sem exceção.
      body: JSON.stringify({ ...corpo, provider: POLITICA_DADOS }),
    });
  } catch {
    // Nunca logamos a causa original: mensagens de rede podem carregar URL com credencial.
    logger.aviso('ia.rede', { evento, caminho });
    throw new ErroProvedorIA('Falha de rede ao contatar o provedor.', 0, 'rede');
  }

  if (!resposta.ok) {
    // 400 com menção a parâmetro/schema é o sinal de que o modo estrito não passou.
    if (resposta.status === 400) {
      const pista = await resposta.text().catch(() => '');
      if (/response_format|json_schema|structured|not supported|unsupported/i.test(pista)) {
        throw new SchemaNaoSuportado();
      }
    }

    logger.aviso('ia.provedor_recusou', { evento, status: resposta.status });
    classificarFalha(resposta.status, caminho);
  }

  try {
    return await resposta.json();
  } catch {
    throw new ErroProvedorIA('Resposta do provedor não é JSON.', resposta.status, 'resposta_invalida');
  }
}

/**
 * Uma vez descoberto que o modelo configurado não aceita `json_schema`, não insistimos: o
 * processo inteiro passa a operar em modo JSON livre. A garantia de estrutura não muda — ela
 * sempre foi do Zod (R-02).
 */
let modoDegradado = false;

export type ParametrosChat = {
  modelo: string;
  instrucaoSistema: string;
  entrada: string;
  /** Ausente → JSON livre. Presente → `json_schema` estrito, com degradação automática. */
  schemaProvedor?: unknown;
  temperatura: number;
  /** Rótulo para o log — nunca inclui conteúdo. */
  evento: string;
};

function montarCorpoChat(p: ParametrosChat, comSchema: boolean): Record<string, unknown> {
  const instrucao = comSchema
    ? p.instrucaoSistema
    : // Sem modo estrito, o schema vira instrução: é o melhor que se pode fazer, e o Zod
      // continua sendo quem reprova.
      `${p.instrucaoSistema}\n\nResponda exclusivamente com um JSON que satisfaça este schema:\n${JSON.stringify(p.schemaProvedor)}`;

  return {
    model: p.modelo,
    messages: [
      { role: 'system', content: instrucao },
      { role: 'user', content: p.entrada },
    ],
    temperature: p.temperatura,
    response_format: comSchema
      ? {
          type: 'json_schema',
          json_schema: { name: p.evento, strict: true, schema: p.schemaProvedor },
        }
      : { type: 'json_object' },
  };
}

function extrairConteudo(bruto: unknown): string {
  const escolha = (bruto as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0];
  const conteudo = escolha?.message?.content;
  if (typeof conteudo !== 'string' || conteudo.length === 0) {
    throw new ErroProvedorIA('Resposta do provedor sem conteúdo.', 200, 'resposta_vazia');
  }
  return conteudo;
}

/** Chat completions. Devolve o conteúdo textual da primeira escolha. */
export async function chamarChat(p: ParametrosChat): Promise<string> {
  const usarSchema = p.schemaProvedor !== undefined && !modoDegradado;

  try {
    return extrairConteudo(await requisitar('/chat/completions', montarCorpoChat(p, usarSchema), p.evento));
  } catch (erro) {
    if (!(erro instanceof SchemaNaoSuportado)) throw erro;

    // Uma única vez por processo. A partir daqui, todas as chamadas já nascem em JSON livre.
    modoDegradado = true;
    logger.aviso('ia.json_schema_indisponivel', { evento: p.evento, modelo: p.modelo });

    return extrairConteudo(await requisitar('/chat/completions', montarCorpoChat(p, false), p.evento));
  }
}

export type FormatoAudio = 'wav' | 'mp3' | 'flac' | 'm4a' | 'ogg' | 'webm' | 'aac';

/**
 * Transcrição de áudio. Endpoint dedicado, não chat: o modelo de transcrição não aceita
 * instrução de sistema nem saída estruturada (R-03).
 *
 * Devolve texto e duração. A decisão sobre confiança é de transcricao.ts — aqui não se
 * interpreta nada.
 */
export async function chamarTranscricao(p: {
  base64: string;
  formato: FormatoAudio;
}): Promise<{ texto: string; segundos: number }> {
  const bruto = (await requisitar(
    '/audio/transcriptions',
    {
      model: MODELO_TRANSCRICAO,
      input_audio: { data: p.base64, format: p.formato },
      language: 'pt',
    },
    'transcricao',
  )) as { text?: unknown; usage?: { seconds?: unknown } };

  if (typeof bruto.text !== 'string') {
    throw new ErroProvedorIA('Resposta de transcrição sem texto.', 200, 'resposta_invalida');
  }

  return {
    texto: bruto.text,
    segundos: typeof bruto.usage?.seconds === 'number' ? bruto.usage.seconds : 0,
  };
}
