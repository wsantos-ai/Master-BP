/** Entregas válidas mínimas, uma por especialidade. Os testes as deformam para provar a recusa. */

export const parecerValido = {
  cabecalho: { codigoCaso: 'DEN-2026-014', dataElaboracao: '2026-07-28', classificacaoSigilo: 'restrito' },
  resumoApuracao:
    'A colaboradora relatou exposição pública reiterada por parte do gestor durante reuniões de equipe.',
  gravidade: { nivel: 'alta', justificativa: 'Conduta reiterada com testemunhas e registro em ata.' },
  criteriosInvestigacao: {
    escutaAtiva: 'Ouvidas a denunciante, duas testemunhas e o gestor, em 12/07.',
    apuracaoFatos: 'Atas de reunião e mensagens corroboram os episódios narrados.',
    contextoAdicional: 'Não há registro de conflito anterior entre as partes.',
    planoResolucao: 'Afastamento preventivo do gestor durante a apuração.',
  },
  embasamentoLegal: [
    { referencia: 'CLT, art. 483', aplicacao: 'Rescisão indireta por rigor excessivo.' },
  ],
  planoAcao: [{ acao: 'Concluir oitivas pendentes', responsavel: 'BP responsável', prazo: '5 dias úteis' }],
  recomendacoesAdicionais: ['Treinamento de liderança respeitosa para a unidade.'],
  notaGuarda: 'Documento restrito — guardar em local seguro de acesso controlado.',
  limitacoesAnonimato: null,
};

export const treinamentoValido = {
  objetivoEstrategico: {
    descricao: 'Reduzir o turnover de novos entrantes por meio de integração estruturada.',
    roiEsperado: 'Queda de 15% no desligamento nos primeiros 90 dias.',
    kpis: ['turnover 90 dias', 'nota de integração'],
  },
  metodologia: {
    nome: 'Aprendizagem experiencial',
    porQueEscolhida: 'Público adulto operacional aprende fazendo, não assistindo.',
  },
  planoAula: [
    { modulo: 'Boas-vindas', duracao: '30 min', descricao: 'História e valores', recurso: 'Projetor' },
  ],
  roteiroSlides: [{ numero: 1, titulo: 'Quem somos', pontosChave: ['Propósito', 'Valores'] }],
  dicasFacilitacao: ['Abra com uma pergunta ao grupo, não com o slide.'],
  indicadoresAvaliacao: {
    reacao: 'Pesquisa ao final',
    aprendizagem: 'Quiz de fixação',
    comportamento: 'Observação do gestor em 30 dias',
    resultado: 'Turnover 90 dias',
  },
  planoAcao: [{ acao: 'Agendar primeira turma', responsavel: 'BP', prazo: '15 dias' }],
  promptCanva: null,
};

export const comunicacaoEmailValida = {
  formato: 'email',
  assunto: 'Alinhamento sobre a nova escala',
  corpo:
    'Bom dia, tudo bem?\n\nEscrevo para alinhar a mudança de escala que entra em vigor no próximo mês.\n\nFico à disposição.',
  escalonamento: { necessario: false, situacao: null, acaoRecomendada: null },
  orientacaoConducao: 'Converse pessoalmente antes de enviar o e-mail, para evitar surpresa.',
  planoAcao: [{ acao: 'Enviar após conversa individual', responsavel: 'Gestor', prazo: 'Esta semana' }],
};

export const mentoriaValida = {
  diagnostico:
    'O turnover concentra-se em uma equipe cujo gestor assumiu há seis meses sem preparo em feedback.',
  analiseEstrategica: {
    pessoas: 'Equipe experiente, liderança nova.',
    processos: 'Não há rotina de feedback estruturado.',
    cultura: 'Cultura de resultado sem contrapartida de desenvolvimento.',
    resultados: 'Produtividade estável, mas custo de reposição crescente.',
  },
  orientacao: {
    recomendacao:
      'Implantar ciclo quinzenal de feedback com o gestor, com acompanhamento do BP nos dois primeiros meses.',
    fundamentacao: [{ fonte: 'Indicador de turnover da unidade', aplicacao: 'Concentração na equipe B.' }],
  },
  indicadoresSugeridos: ['turnover trimestral', 'clima da equipe'],
  planoAcao: [{ acao: 'Agendar mentoria com o gestor', responsavel: 'BP', prazo: '7 dias' }],
};

export const promptValido = {
  promptGerado: {
    persona: 'Você é um analista de triagem de currículos com foco em fit técnico e cultural.',
    missao: 'Classificar currículos segundo os critérios definidos pela vaga.',
    fluxoAcao: ['Ler a vaga', 'Ler o currículo', 'Classificar'],
    dominios: ['Recrutamento e seleção'],
    formatoSaida: 'Tabela com candidato, aderência e justificativa.',
    tomDeVoz: 'Objetivo, técnico e imparcial.',
    restricoes: ['Nunca inferir gênero, idade ou origem do candidato.'],
    orientacoesGerais: null,
  },
  porQueFunciona: 'Define persona, restringe o escopo e proíbe explicitamente inferência protegida.',
  tecnicasAplicadas: ['role_prompting', 'negative_prompting', 'structured_output'],
  planoAcao: [{ acao: 'Testar com 10 currículos reais', responsavel: 'BP', prazo: '3 dias' }],
};
