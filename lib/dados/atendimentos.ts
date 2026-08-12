import { prisma } from './prisma';
import { cifrar, cifrarOpcional, decifrar, decifrarOpcional } from './cripto';
import type { Prisma } from '@prisma/client';
import type {
  ClassificacaoSigilo,
  EstadoAtendimento,
  EstadoLacuna,
  IdAssistente,
  OrigemRelato,
} from '@/lib/validacao/comum';

/**
 * Camada de acesso a atendimentos.
 *
 * Duas responsabilidades que não podem escapar daqui:
 *
 * 1. **Propriedade** (FR-017, SC-006): toda leitura filtra por `autorId` na própria consulta.
 *    Um filtro aplicado só na tela é uma tela que alguém pode esquecer de escrever; um filtro
 *    na consulta é a única defesa que não depende de memória.
 * 2. **Cifragem**: conteúdo entra cifrado e sai decifrado, para que nenhum chamador precise
 *    lembrar de fazer isso.
 */

export const MESES_RETENCAO = 24;
export const DIAS_ATE_ENCERRAMENTO_AUTOMATICO = 90;

export type AtendimentoDecifrado = {
  id: string;
  autorId: string;
  assistenteId: string;
  relatoInicial: string;
  origemRelato: string;
  estado: EstadoAtendimento;
  classificacaoSigilo: ClassificacaoSigilo;
  assistenteSugerido: string | null;
  justificativaSugestao: string | null;
  trocaManual: boolean;
  promptHash: string;
  criadoEm: Date;
  ultimaInteracaoEm: Date;
  concluidoEm: Date | null;
  expurgarEm: Date | null;
};

export type OrigemFechamento = 'resposta_direta' | 'aproveitada';

export type LacunaDecifrada = {
  id: string;
  pergunta: string;
  porQueImporta: string;
  critica: boolean;
  estado: EstadoLacuna;
  resposta: string | null;
  justificativaNaoAplicavel: string | null;
  /** Nulo enquanto aberta, quando não aplicável, e em lacunas anteriores à feature 003. */
  origemFechamento: OrigemFechamento | null;
  ordem: number;
};

function decifrarAtendimento(registro: {
  id: string;
  autorId: string;
  assistenteId: string;
  relatoInicial: string;
  origemRelato: string;
  estado: string;
  classificacaoSigilo: string;
  assistenteSugerido: string | null;
  justificativaSugestao: string | null;
  trocaManual: boolean;
  promptHash: string;
  criadoEm: Date;
  ultimaInteracaoEm: Date;
  concluidoEm: Date | null;
  expurgarEm: Date | null;
}): AtendimentoDecifrado {
  return {
    ...registro,
    relatoInicial: decifrar(registro.relatoInicial),
    estado: registro.estado as EstadoAtendimento,
    classificacaoSigilo: registro.classificacaoSigilo as ClassificacaoSigilo,
  };
}

export function decifrarLacuna(registro: {
  id: string;
  pergunta: string;
  porQueImporta: string;
  critica: boolean;
  estado: string;
  resposta: string | null;
  justificativaNaoAplicavel: string | null;
  origemFechamento: string | null;
  ordem: number;
}): LacunaDecifrada {
  return {
    ...registro,
    pergunta: decifrar(registro.pergunta),
    porQueImporta: decifrar(registro.porQueImporta),
    estado: registro.estado as EstadoLacuna,
    resposta: decifrarOpcional(registro.resposta),
    justificativaNaoAplicavel: decifrarOpcional(registro.justificativaNaoAplicavel),
    // Rótulo de enumeração, não conteúdo de atendimento: fica em claro, como estado e ordem.
    origemFechamento: registro.origemFechamento as OrigemFechamento | null,
  };
}

export async function criarAtendimento(dados: {
  autorId: string;
  assistenteId: IdAssistente;
  relato: string;
  origemRelato: OrigemRelato;
  trocaManual: boolean;
  assistenteSugerido: string | null;
  justificativaSugestao: string | null;
  promptHash: string;
  classificacaoSigilo: ClassificacaoSigilo;
}): Promise<AtendimentoDecifrado> {
  const criado = await prisma.atendimento.create({
    data: {
      autorId: dados.autorId,
      assistenteId: dados.assistenteId,
      relatoInicial: cifrar(dados.relato),
      origemRelato: dados.origemRelato,
      trocaManual: dados.trocaManual,
      assistenteSugerido: dados.assistenteSugerido,
      justificativaSugestao: dados.justificativaSugestao,
      promptHash: dados.promptHash,
      classificacaoSigilo: dados.classificacaoSigilo,
    },
  });
  return decifrarAtendimento(criado);
}

/**
 * Busca um atendimento **do autor informado**.
 * Devolve null quando não existe OU quando pertence a outro BP — a rota traduz os dois casos
 * para 404, sem confirmar a existência do registro alheio (contracts/api.md).
 */
export async function buscarAtendimentoDoAutor(
  id: string,
  autorId: string,
): Promise<AtendimentoDecifrado | null> {
  const registro = await prisma.atendimento.findFirst({ where: { id, autorId } });
  return registro ? decifrarAtendimento(registro) : null;
}

export async function buscarAtendimentoCompleto(id: string, autorId: string) {
  const registro = await prisma.atendimento.findFirst({
    where: { id, autorId },
    include: {
      assistente: true,
      lacunas: { orderBy: { ordem: 'asc' } },
      mensagens: { orderBy: { criadaEm: 'asc' } },
      entrega: true,
      escalonamentos: { orderBy: { detectadaEm: 'asc' } },
    },
  });

  if (!registro) return null;

  return {
    atendimento: decifrarAtendimento(registro),
    assistente: registro.assistente,
    lacunas: registro.lacunas.map(decifrarLacuna),
    mensagens: registro.mensagens.map((m) => ({
      id: m.id,
      autor: m.autor,
      conteudo: decifrar(m.conteudo),
      criadaEm: m.criadaEm,
    })),
    entrega: registro.entrega
      ? {
          ...registro.entrega,
          conteudo: decifrar(registro.entrega.conteudo),
          planoAcao: decifrar(registro.entrega.planoAcao),
        }
      : null,
    escalonamentos: registro.escalonamentos.map((e) => ({
      ...e,
      trechoGatilho: decifrarOpcional(e.trechoGatilho),
    })),
  };
}

export async function listarLacunas(
  atendimentoId: string,
  autorId: string,
): Promise<LacunaDecifrada[] | null> {
  const dono = await prisma.atendimento.findFirst({
    where: { id: atendimentoId, autorId },
    select: { id: true },
  });
  if (!dono) return null;

  const lacunas = await prisma.lacuna.findMany({
    where: { atendimentoId },
    orderBy: { ordem: 'asc' },
  });
  return lacunas.map(decifrarLacuna);
}

export async function criarLacunas(
  atendimentoId: string,
  lacunas: { pergunta: string; porQueImporta: string; critica: boolean }[],
  ordemInicial: number,
): Promise<void> {
  if (lacunas.length === 0) return;

  await prisma.lacuna.createMany({
    data: lacunas.map((l, indice) => ({
      atendimentoId,
      pergunta: cifrar(l.pergunta),
      porQueImporta: cifrar(l.porQueImporta),
      critica: l.critica,
      ordem: ordemInicial + indice,
    })),
  });
}

export async function responderLacuna(
  lacunaId: string,
  atendimentoId: string,
  resposta: string,
): Promise<void> {
  await prisma.lacuna.updateMany({
    where: { id: lacunaId, atendimentoId },
    data: {
      estado: 'respondida',
      resposta: cifrar(resposta),
      origemFechamento: 'resposta_direta',
      resolvidaEm: new Date(),
    },
  });
}

/**
 * Fecha as lacunas que a resposta do BP esclareceu de passagem (FR-001, FR-004).
 *
 * Grava o conteúdo REAL do BP em cada uma — nunca resposta vazia. É isso que mantém
 * `lacunaResolvida()` válido sem alteração e o Princípio II fora do alcance do modelo
 * (research.md R-03).
 *
 * O `estado: 'aberta'` no filtro é a última barreira: mesmo que a decisão a montante falhe,
 * nenhuma lacuna já resolvida é sobrescrita.
 */
export async function fecharLacunasAproveitadas(
  atendimentoId: string,
  lacunaIds: string[],
  conteudoDoBp: string,
): Promise<void> {
  if (lacunaIds.length === 0) return;
  if (conteudoDoBp.trim().length === 0) return;

  await prisma.lacuna.updateMany({
    where: { id: { in: lacunaIds }, atendimentoId, estado: 'aberta' },
    data: {
      estado: 'respondida',
      resposta: cifrar(conteudoDoBp),
      origemFechamento: 'aproveitada',
      resolvidaEm: new Date(),
    },
  });
}

export async function marcarLacunaNaoAplicavel(
  lacunaId: string,
  atendimentoId: string,
  justificativa: string,
): Promise<void> {
  await prisma.lacuna.updateMany({
    where: { id: lacunaId, atendimentoId },
    data: {
      estado: 'nao_aplicavel',
      justificativaNaoAplicavel: cifrar(justificativa),
      resolvidaEm: new Date(),
    },
  });
}

export async function registrarMensagem(
  atendimentoId: string,
  autor: 'bp' | 'assistente',
  conteudo: string,
): Promise<void> {
  await prisma.mensagemRefinamento.create({
    data: { atendimentoId, autor, conteudo: cifrar(conteudo) },
  });
}

export async function tocarAtendimento(atendimentoId: string): Promise<void> {
  await prisma.atendimento.update({
    where: { id: atendimentoId },
    data: { ultimaInteracaoEm: new Date() },
  });
}

export function calcularExpurgo(concluidoEm: Date): Date {
  const expurgo = new Date(concluidoEm);
  expurgo.setMonth(expurgo.getMonth() + MESES_RETENCAO);
  return expurgo;
}

/** Conclui o atendimento e agenda o expurgo de 24 meses (FR-026). */
export async function concluirAtendimento(atendimentoId: string): Promise<void> {
  const agora = new Date();
  await prisma.atendimento.update({
    where: { id: atendimentoId },
    data: {
      estado: 'concluido',
      concluidoEm: agora,
      ultimaInteracaoEm: agora,
      expurgarEm: calcularExpurgo(agora),
    },
  });
}

export async function marcarSensivel(atendimentoId: string): Promise<void> {
  await prisma.atendimento.update({
    where: { id: atendimentoId },
    data: { classificacaoSigilo: 'sensivel' },
  });
}

export async function registrarEscalonamentos(
  atendimentoId: string,
  sinalizacoes: {
    tipoRisco: string;
    instanciaRecomendada: string;
    origemDeteccao: string;
    trechoGatilho: string | null;
  }[],
): Promise<void> {
  if (sinalizacoes.length === 0) return;

  await prisma.sinalizacaoEscalonamento.createMany({
    data: sinalizacoes.map((s) => ({
      atendimentoId,
      tipoRisco: s.tipoRisco,
      instanciaRecomendada: s.instanciaRecomendada,
      origemDeteccao: s.origemDeteccao,
      trechoGatilho: cifrarOpcional(s.trechoGatilho),
    })),
  });
}

export type FiltroHistorico = {
  autorId: string;
  especialidade?: string;
  estado?: string;
  de?: Date;
  ate?: Date;
  pagina: number;
  porPagina: number;
};

/**
 * Histórico do BP (FR-016).
 * Os filtros operam apenas sobre metadados em claro — nenhum campo cifrado pode ir para `where`
 * ou `orderBy` (regra transversal 5 do data-model).
 */
export async function listarHistorico(filtro: FiltroHistorico) {
  const where: Prisma.AtendimentoWhereInput = { autorId: filtro.autorId };

  if (filtro.especialidade) where.assistenteId = filtro.especialidade;
  if (filtro.estado) where.estado = filtro.estado;
  if (filtro.de || filtro.ate) {
    where.criadoEm = {
      ...(filtro.de ? { gte: filtro.de } : {}),
      ...(filtro.ate ? { lte: filtro.ate } : {}),
    };
  }

  const [total, itens] = await Promise.all([
    prisma.atendimento.count({ where }),
    prisma.atendimento.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (filtro.pagina - 1) * filtro.porPagina,
      take: filtro.porPagina,
      select: {
        id: true,
        estado: true,
        classificacaoSigilo: true,
        criadoEm: true,
        concluidoEm: true,
        assistenteId: true,
        assistente: { select: { nome: true } },
        _count: { select: { lacunas: true } },
      },
    }),
  ]);

  return { total, itens, pagina: filtro.pagina };
}

/** Exclusão a pedido do BP (FR-027). A auditoria é gravada pela rota, antes da remoção. */
export async function excluirAtendimentoDoAutor(id: string, autorId: string): Promise<boolean> {
  const resultado = await prisma.atendimento.deleteMany({ where: { id, autorId } });
  return resultado.count > 0;
}
