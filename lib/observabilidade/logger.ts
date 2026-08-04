/**
 * Ponto único de log da aplicação.
 *
 * Princípio I da constituição: conteúdo de atendimento — relato, respostas do BP, diálogo de
 * refinamento, entrega — NUNCA é registrado. O ESLint bloqueia `console` em todo o resto do
 * código justamente para que este arquivo seja o único caminho possível.
 *
 * A regra prática: logamos identificadores e metadados, nunca texto que veio do usuário ou
 * do modelo.
 */

type Nivel = 'info' | 'aviso' | 'erro';

/** Campos que jamais podem ser registrados, mesmo se alguém os passar por engano. */
const CAMPOS_PROIBIDOS = new Set([
  'relato',
  'relatoInicial',
  'conteudo',
  'resposta',
  'pergunta',
  'texto',
  'entrega',
  'planoAcao',
  'mensagem',
  'mensagens',
  'trechoGatilho',
  'justificativa',
  'justificativaNaoAplicavel',
  'senha',
  'senhaHash',
  'email',
]);

export type ContextoLog = Record<string, string | number | boolean | null | undefined>;

/**
 * Remove qualquer campo sensível do contexto antes de escrever.
 * Preferimos perder informação de diagnóstico a vazar conteúdo de atendimento.
 */
export function redigir(contexto: ContextoLog): ContextoLog {
  const seguro: ContextoLog = {};
  for (const [chave, valor] of Object.entries(contexto)) {
    seguro[chave] = CAMPOS_PROIBIDOS.has(chave) ? '[redigido]' : valor;
  }
  return seguro;
}

function escrever(nivel: Nivel, evento: string, contexto: ContextoLog = {}): void {
  // O contexto vai aninhado: se ele fosse espalhado, uma chave chamada `evento` sobrescreveria
  // silenciosamente o nome do evento e o log perderia sua âncora.
  const linha = JSON.stringify({
    nivel,
    evento,
    em: new Date().toISOString(),
    ctx: redigir(contexto),
  });

  if (nivel === 'erro') {
    console.error(linha);
  } else {
    console.log(linha);
  }
}

export const logger = {
  info: (evento: string, contexto?: ContextoLog) => escrever('info', evento, contexto),
  aviso: (evento: string, contexto?: ContextoLog) => escrever('aviso', evento, contexto),
  erro: (evento: string, contexto?: ContextoLog) => escrever('erro', evento, contexto),
};
