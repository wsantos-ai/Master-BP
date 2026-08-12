/**
 * Conjunto de calibração da equivalência entre perguntas (feature 003, R-02).
 *
 * Serve ao mesmo papel que `tests/fixtures/casos-risco/` cumpre para o Princípio III: fixar, em
 * dados, o comportamento que o código precisa ter — e tornar visível quando um ajuste de limiar
 * quebra um caso que antes funcionava.
 *
 * A assimetria de erro importa e está refletida na proporção: descartar uma pergunta legítima
 * custa uma entrega mal fundamentada; manter uma pergunta a mais custa uma pergunta ao BP. Por
 * isso os pares NÃO equivalentes são a parte mais rica do conjunto — são eles que o limiar não
 * pode atropelar.
 */

export type ParEquivalencia = {
  a: string;
  b: string;
  /** Por que este par é (ou não é) o mesmo pedido de informação. */
  nota: string;
};

/** Devem ser reconhecidos como a MESMA pergunta. */
export const PARES_EQUIVALENTES: ParEquivalencia[] = [
  {
    a: 'Qual é o prazo para comunicar a mudança?',
    b: 'qual e o prazo para comunicar a mudanca',
    nota: 'idêntica sem acento, sem pontuação e em caixa baixa',
  },
  {
    a: 'Qual o prazo para comunicar a mudança?',
    b: 'O prazo para comunicar a mudança é qual?',
    nota: 'mesma pergunta com a ordem das palavras trocada',
  },
  {
    a: 'Quantas pessoas serão afetadas pela mudança?',
    b: 'Quantas pessoas a mudança vai afetar?',
    nota: 'mesmo pedido, flexão verbal diferente e sem a preposição',
  },
  {
    a: 'O diretor já validou a decisão?',
    b: 'A decisão já foi validada pelo diretor?',
    nota: 'voz ativa versus passiva, mesmas palavras de conteúdo',
  },
  {
    a: 'Qual   o   canal   de comunicação escolhido?',
    b: 'Qual o canal de comunicação escolhido?',
    nota: 'espaços múltiplos colapsados',
  },
  {
    a: 'Existe política formal sobre remuneração variável?',
    b: 'Existe uma política formal sobre a remuneração variável?',
    nota: 'diferença apenas em artigos, que são palavras vazias',
  },
];

/**
 * Paráfrase genuína: são a mesma pergunta, mas a camada determinística NÃO as pega — as palavras
 * de conteúdo mal se sobrepõem.
 *
 * Isto não é um defeito a corrigir com ajuste de limiar. Baixar o limiar o suficiente para casar
 * estes pares atropelaria os PARES_DISTINTOS, que é o erro caro. A paráfrase é responsabilidade
 * da instrução ao assistente (FR-008); a camada determinística é a rede de segurança para a
 * repetição literal e quase literal (research.md R-02).
 *
 * O conjunto existe para que a limitação fique medida e visível, não escondida. Se um dia a
 * comparação por embeddings for adotada, é este conjunto que ela precisa passar a resolver.
 */
export const PARES_LIMITACAO_CONHECIDA: ParEquivalencia[] = [
  {
    a: 'Como a equipe reagiu à comunicação anterior?',
    b: 'Como foi a reação da equipe à comunicação anterior?',
    nota: 'reagiu/reação — radical irregular, fora do alcance de remoção de sufixo',
  },
  {
    a: 'Qual o prazo para comunicar a mudança?',
    b: 'Em quanto tempo o anúncio precisa sair?',
    nota: 'mesma pergunta, vocabulário inteiramente diferente',
  },
];

/**
 * Devem SOBREVIVER as duas — são pedidos distintos, ainda que lexicalmente próximos.
 * Se algum destes casar, o limiar está agressivo demais e precisa subir (T039).
 */
export const PARES_DISTINTOS: ParEquivalencia[] = [
  {
    a: 'Qual o prazo para comunicar a mudança?',
    b: 'Qual o prazo para implementar a mudança?',
    nota: 'o caso citado na spec: comunicar e implementar são etapas diferentes',
  },
  {
    a: 'Quantas pessoas serão afetadas?',
    b: 'Quais áreas serão afetadas?',
    nota: 'pessoas e áreas são recortes diferentes do mesmo impacto',
  },
  {
    a: 'O diretor já validou a decisão?',
    b: 'O jurídico já validou a decisão?',
    nota: 'instâncias de validação diferentes — confundi-las é risco de compliance',
  },
  {
    a: 'Qual o canal de comunicação escolhido?',
    b: 'Qual o tom de comunicação escolhido?',
    nota: 'canal e tom são decisões independentes',
  },
  {
    a: 'Como fica a remuneração de quem batia a meta?',
    b: 'Como fica a remuneração de quem não batia a meta?',
    nota: 'a negação inverte o público — o caso mais perigoso de falso positivo',
  },
  {
    a: 'Houve denúncia formal sobre o caso?',
    b: 'Houve apuração formal sobre o caso?',
    nota: 'denúncia e apuração são momentos distintos do fluxo de ética',
  },
  {
    a: 'Qual o histórico disciplinar do colaborador?',
    b: 'Qual o histórico de desempenho do colaborador?',
    nota: 'registros distintos, com regras de acesso distintas (Princípio I)',
  },
  {
    a: 'Quem vai comunicar a mudança à equipe?',
    b: 'Quando vai ser comunicada a mudança à equipe?',
    nota: 'responsável e prazo — ambos obrigatórios no plano de ação (Princípio V)',
  },
];
