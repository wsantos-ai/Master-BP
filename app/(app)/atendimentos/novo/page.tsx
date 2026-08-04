import { prisma } from '@/lib/dados/prisma';
import { NovoAtendimento } from './NovoAtendimento';

export const metadata = { title: 'Novo atendimento — Master BP' };

export default async function PaginaNovoAtendimento() {
  const catalogo = await prisma.assistente.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, descricao: true },
    orderBy: { nome: 'asc' },
  });

  return (
    <>
      <h1>Novo atendimento</h1>
      <p className="suave">
        Descreva a situação com suas palavras. Vamos indicar o assistente mais adequado e, antes
        de qualquer conclusão, fazer as perguntas necessárias.
      </p>
      <NovoAtendimento catalogo={catalogo} />
    </>
  );
}
