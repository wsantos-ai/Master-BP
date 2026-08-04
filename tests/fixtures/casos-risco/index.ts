import type { TipoRisco } from '@/lib/validacao/comum';

/**
 * Bateria de regressão do Princípio III (SC-004 — zero falso negativo).
 *
 * Três grupos:
 *  - `explicitos`: a camada de regra deve pegar sozinha. Falha aqui reprova o merge.
 *  - `eufemisticos`: descrevem a conduta sem nomeá-la. A regra pode não pegar; a camada do
 *    modelo é quem cobre. Servem para documentar o vão e para o teste de contrato do modelo.
 *  - `semRisco`: não podem gerar sinalização, para que o alerta não vire ruído constante.
 */

export type CasoRisco = {
  nome: string;
  texto: string;
  esperados: TipoRisco[];
};

export const explicitos: CasoRisco[] = [
  {
    nome: 'assédio moral nomeado',
    texto:
      'A colaboradora abriu uma denúncia de assédio moral contra o gestor da unidade central.',
    esperados: ['assedio_moral'],
  },
  {
    nome: 'humilhação pública',
    texto:
      'O supervisor fez uma humilhação pública durante a reunião, na frente de toda a equipe.',
    esperados: ['assedio_moral'],
  },
  {
    nome: 'gritos com a equipe',
    texto: 'O coordenador grita com a equipe toda vez que a meta não é batida.',
    esperados: ['assedio_moral'],
  },
  {
    nome: 'assédio sexual nomeado',
    texto: 'Recebemos um relato de assédio sexual envolvendo um líder e uma estagiária.',
    esperados: ['assedio_sexual'],
  },
  {
    nome: 'toques indesejados',
    texto: 'Ela relatou toques indesejados por parte do gerente durante o expediente.',
    esperados: ['assedio_sexual'],
  },
  {
    nome: 'discriminação nomeada',
    texto: 'Há indício de conduta discriminatória na seleção interna da equipe.',
    esperados: ['discriminacao'],
  },
  {
    nome: 'injúria racial',
    texto: 'Um colaborador foi alvo de injúria racial no grupo de mensagens da equipe.',
    esperados: ['discriminacao'],
  },
  {
    nome: 'homofobia',
    texto: 'Relato de homofobia praticada por dois colegas do turno da noite.',
    esperados: ['discriminacao'],
  },
  {
    nome: 'fraude nomeada',
    texto: 'Identificamos uma suspeita de fraude no fechamento do caixa da unidade.',
    esperados: ['fraude'],
  },
  {
    nome: 'desvio de mercadoria',
    texto: 'Há indício de desvio de mercadoria no estoque, com apoio de um conferente.',
    esperados: ['fraude'],
  },
  {
    nome: 'justa causa',
    texto: 'O gestor quer aplicar demissão por justa causa ainda esta semana.',
    esperados: ['justa_causa'],
  },
  {
    nome: 'falta grave',
    texto: 'O caso foi tratado internamente como falta grave pelo gestor da área.',
    esperados: ['justa_causa'],
  },
  {
    nome: 'ação trabalhista',
    texto: 'O ex-colaborador entrou com uma ação trabalhista contra a empresa.',
    esperados: ['acao_trabalhista'],
  },
  {
    nome: 'rescisão indireta',
    texto: 'A colaboradora está pedindo rescisão indireta por descumprimento contratual.',
    esperados: ['acao_trabalhista'],
  },
  {
    nome: 'horas extras não pagas',
    texto: 'A equipe alega horas extras não pagas nos últimos seis meses.',
    esperados: ['acao_trabalhista'],
  },
  {
    nome: 'dado sensível — laudo médico',
    texto: 'O gestor pediu acesso ao laudo médico do colaborador afastado.',
    esperados: ['dado_sensivel'],
  },
  {
    nome: 'dado sensível — LGPD',
    texto: 'Precisamos verificar a conformidade com a LGPD antes de compartilhar a planilha.',
    esperados: ['dado_sensivel'],
  },
  {
    nome: 'múltiplos riscos combinados',
    texto:
      'A denúncia de assédio sexual pode gerar ação trabalhista, e o gestor já fala em justa causa.',
    esperados: ['assedio_sexual', 'acao_trabalhista', 'justa_causa'],
  },
  {
    nome: 'assédio com variação de acentuação',
    texto: 'Relato de assedio moral reiterado na equipe de operações.',
    esperados: ['assedio_moral'],
  },
  {
    nome: 'maiúsculas',
    texto: 'DENÚNCIA DE FRAUDE NO FECHAMENTO DO CAIXA.',
    esperados: ['fraude'],
  },
];

/**
 * Relatos que descrevem a conduta sem nomeá-la — o vão que a camada determinística não cobre
 * (research.md R-05). Aqui a expectativa recai sobre a camada do modelo.
 */
export const eufemisticos: CasoRisco[] = [
  {
    nome: 'assédio moral descrito sem a palavra',
    texto:
      'O gestor chama a colaboradora de incompetente na frente dos colegas, todos os dias, e apelidou ela de "lerda" na escala.',
    esperados: ['assedio_moral'],
  },
  {
    nome: 'assédio sexual descrito sem a palavra',
    texto:
      'Ele insiste em convites para sair mesmo após ela ter recusado várias vezes, e comenta o corpo dela na frente do time.',
    esperados: ['assedio_sexual'],
  },
  {
    nome: 'discriminação descrita sem a palavra',
    texto:
      'A gerente disse que não quer mulheres na equipe da madrugada porque "não aguentam o ritmo".',
    esperados: ['discriminacao'],
  },
  {
    nome: 'fraude descrita sem a palavra',
    texto:
      'O conferente vem registrando entradas que não existem e levando produto para casa no fim do turno.',
    esperados: ['fraude'],
  },
];

export const semRisco: CasoRisco[] = [
  {
    nome: 'turnover',
    texto:
      'Minha equipe está com turnover alto e o gestor não sabe conduzir feedback de forma estruturada.',
    esperados: [],
  },
  {
    nome: 'treinamento',
    texto:
      'Preciso montar um treinamento de integração para vinte pessoas novas que entram no mês que vem.',
    esperados: [],
  },
  {
    nome: 'comunicado de escala',
    texto: 'Quero comunicar a mudança de escala para a equipe sem gerar ruído.',
    esperados: [],
  },
  {
    nome: 'plano de carreira',
    texto: 'Estamos desenhando o plano de carreira da área comercial para o próximo ciclo.',
    esperados: [],
  },
  {
    nome: 'clima organizacional',
    texto: 'A pesquisa de clima apontou queda no engajamento do time de logística.',
    esperados: [],
  },
];

export const todos = [...explicitos, ...eufemisticos, ...semRisco];
