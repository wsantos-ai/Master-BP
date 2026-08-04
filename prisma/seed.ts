import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CATALOGO } from '../lib/assistentes/catalogo';
import { cifrar } from '../lib/dados/cripto';

const prisma = new PrismaClient();

async function main() {
  for (const especialidade of CATALOGO) {
    await prisma.assistente.upsert({
      where: { id: especialidade.id },
      update: {
        nome: especialidade.nome,
        descricao: especialidade.descricao,
        dominios: JSON.stringify(especialidade.dominios),
        arquivoPrompt: especialidade.arquivoPrompt,
        estruturaEntrega: especialidade.estruturaEntrega,
        sensivelPorPadrao: especialidade.sensivelPorPadrao,
        ativo: true,
      },
      create: {
        id: especialidade.id,
        nome: especialidade.nome,
        descricao: especialidade.descricao,
        dominios: JSON.stringify(especialidade.dominios),
        arquivoPrompt: especialidade.arquivoPrompt,
        estruturaEntrega: especialidade.estruturaEntrega,
        sensivelPorPadrao: especialidade.sensivelPorPadrao,
      },
    });
  }
  console.log(`Assistentes semeados: ${CATALOGO.length}`);

  // BP de teste — apenas para desenvolvimento local.
  const email = 'bp@exemplo.com.br';
  const senha = 'MasterBP2026';
  const bp = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      email,
      nome: 'Business Partner de Teste',
      senhaHash: await bcrypt.hash(senha, 10),
      organizacao: 'Organização Demonstração',
    },
  });
  console.log(`BP de teste: ${email} / ${senha}`);

  // Atendimento em andamento, com lacuna crítica aberta. Serve para o desenvolvedor ver a tela
  // sem gastar chamada ao modelo, e para o E2E exercitar o portão do Princípio II (SC-005).
  const jaExiste = await prisma.atendimento.findFirst({
    where: { autorId: bp.id, estado: 'em_andamento' },
  });

  if (!jaExiste) {
    const atendimento = await prisma.atendimento.create({
      data: {
        autorId: bp.id,
        assistenteId: 'etica-compliance',
        relatoInicial: cifrar(
          'Recebi um relato de conduta inadequada de um gestor durante as reuniões de equipe.',
        ),
        origemRelato: 'texto',
        estado: 'em_andamento',
        classificacaoSigilo: 'sensivel',
        assistenteSugerido: 'etica-compliance',
        promptHash: 'seed',
      },
    });

    await prisma.lacuna.createMany({
      data: [
        {
          atendimentoId: atendimento.id,
          pergunta: cifrar('Quem foi ouvido e quando?'),
          porQueImporta: cifrar('Sem escuta das partes não há contraditório.'),
          critica: true,
          ordem: 1,
        },
        {
          atendimentoId: atendimento.id,
          pergunta: cifrar('Há evidências documentais do ocorrido?'),
          porQueImporta: cifrar('Fato sem prova não sustenta um parecer.'),
          critica: true,
          ordem: 2,
        },
      ],
    });

    await prisma.mensagemRefinamento.create({
      data: {
        atendimentoId: atendimento.id,
        autor: 'assistente',
        conteudo: cifrar(
          'Antes de emitir o parecer, preciso entender a apuração já realizada. Quem foi ouvido e quando?',
        ),
      },
    });

    console.log('Atendimento de demonstração criado (em andamento, com lacunas abertas).');
  }
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
