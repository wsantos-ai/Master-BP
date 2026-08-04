import type { IdAssistente } from '@/lib/validacao/comum';

/**
 * Catálogo das cinco especialidades (FR-001).
 *
 * Aqui ficam apenas metadados: nome, domínios, qual arquivo canônico governa o comportamento e
 * qual schema valida a entrega. Nenhuma regra de comportamento é escrita neste arquivo — ela
 * vive no prompt canônico (Princípio IV).
 */

export type EspecialidadeAssistente = {
  id: IdAssistente;
  nome: string;
  descricao: string;
  dominios: string[];
  arquivoPrompt: string;
  estruturaEntrega: IdAssistente;
  sensivelPorPadrao: boolean;
  /** Sinais que ajudam o roteador a explicar a indicação ao BP. */
  exemplosDemanda: string[];
};

export const CATALOGO: EspecialidadeAssistente[] = [
  {
    id: 'mentoria-bp',
    nome: 'Mentoria estratégica de BP',
    descricao:
      'Orientação estratégica sobre pessoas, processos, cultura e resultados, com análise de indicadores e plano de ação.',
    dominios: [
      'Atração e seleção',
      'Desenvolvimento e mentoria',
      'Carreira e sucessão',
      'Remuneração e recompensa',
      'Relações trabalhistas e clima',
      'Gestão de indicadores (turnover, absenteísmo, produtividade)',
      'Diversidade e inclusão',
    ],
    arquivoPrompt: 'agente-bp.md',
    estruturaEntrega: 'mentoria-bp',
    sensivelPorPadrao: false,
    exemplosDemanda: [
      'turnover alto em uma equipe',
      'líder com dificuldade de conduzir feedback',
      'planejamento de sucessão',
      'estruturação de plano de carreira',
    ],
  },
  {
    id: 'etica-compliance',
    nome: 'Ética e compliance (denúncias)',
    descricao:
      'Condução de apuração de denúncias e emissão de parecer técnico imparcial, com embasamento legal e plano de ação.',
    dominios: [
      'Assédio moral e sexual',
      'Discriminação',
      'Fraude e desvio de conduta',
      'Conflito interpessoal',
      'Conformidade com código de conduta, CLT e LGPD',
    ],
    arquivoPrompt: 'agente-denuncias.md',
    estruturaEntrega: 'etica-compliance',
    sensivelPorPadrao: true,
    exemplosDemanda: [
      'denúncia recebida no canal de ética',
      'relato de assédio',
      'suspeita de fraude interna',
      'apuração de desvio de conduta',
    ],
  },
  {
    id: 'comunicacao-lideranca',
    nome: 'Comunicação de liderança',
    descricao:
      'Elaboração de comunicações delicadas — mensagem, e-mail ou comunicado oficial — com análise de risco e orientação de condução.',
    dominios: [
      'Comunicação de decisões difíceis',
      'Feedback formal',
      'Comunicados de mudança organizacional',
      'Mediação de conflito entre áreas',
    ],
    arquivoPrompt: 'agente-mensagens.md',
    estruturaEntrega: 'comunicacao-lideranca',
    sensivelPorPadrao: false,
    exemplosDemanda: [
      'preciso comunicar uma mudança de escala',
      'como escrever um e-mail sobre queda de desempenho',
      'comunicado sobre nova política interna',
    ],
  },
  {
    id: 'treinamento-desenvolvimento',
    nome: 'Treinamento e desenvolvimento',
    descricao:
      'Desenho de soluções de aprendizagem com metodologia, plano de aula, roteiro de slides e indicadores de avaliação.',
    dominios: [
      'Onboarding e integração',
      'Soft skills e comportamental',
      'Liderança e sucessão',
      'Cultura e engajamento',
      'Vendas e atendimento',
    ],
    arquivoPrompt: 'agente-treinamento.md',
    estruturaEntrega: 'treinamento-desenvolvimento',
    sensivelPorPadrao: false,
    exemplosDemanda: [
      'preciso de um treinamento de integração',
      'dinâmica para desenvolver comunicação',
      'programa de formação de líderes',
    ],
  },
  {
    id: 'engenharia-prompts',
    nome: 'Engenharia de prompts',
    descricao:
      'Transformação de uma ideia em prompt estruturado e de alto desempenho para agentes de IA, com explicação técnica das escolhas.',
    dominios: [
      'Desenho de instruções para agentes de IA',
      'Melhoria de prompts existentes',
      'Definição de persona, fluxo e restrições',
    ],
    arquivoPrompt: 'agente-prompt.md',
    estruturaEntrega: 'engenharia-prompts',
    sensivelPorPadrao: false,
    exemplosDemanda: [
      'quero criar um agente para triagem de currículos',
      'melhorar o prompt que já uso',
    ],
  },
];

const porId = new Map(CATALOGO.map((e) => [e.id, e]));

export function buscarEspecialidade(id: string): EspecialidadeAssistente | undefined {
  return porId.get(id as IdAssistente);
}

export function exigirEspecialidade(id: string): EspecialidadeAssistente {
  const especialidade = porId.get(id as IdAssistente);
  if (!especialidade) {
    throw new Error(`Especialidade desconhecida: ${id}`);
  }
  return especialidade;
}

export const ARQUIVOS_PROMPT = CATALOGO.map((e) => e.arquivoPrompt);
