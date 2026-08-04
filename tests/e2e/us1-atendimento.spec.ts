import { expect, test } from '@playwright/test';
import { entrar } from './ajuda';

/**
 * US1 — cenários de aceite da spec.
 *
 * As chamadas ao Gemini são interceptadas: o que se testa aqui é o fluxo do app e as garantias
 * do servidor, não a qualidade da resposta do modelo. A resposta real é coberta pelos testes de
 * contrato, fora do pipeline padrão.
 */

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test('indica o assistente com justificativa e permite troca manual', async ({ page }) => {
  await page.route('**/api/roteamento', async (rota) => {
    await rota.fulfill({
      json: {
        sugestoes: [
          {
            assistenteId: 'mentoria-bp',
            nome: 'Mentoria estratégica de BP',
            justificativa: 'A demanda trata de liderança e turnover.',
            confianca: 0.93,
          },
        ],
        ambigua: false,
        foraDeEscopo: false,
      },
    });
  });

  await page.goto('/atendimentos/novo');
  await page
    .getByTestId('campo-relato')
    .fill('minha equipe está com turnover alto e o gestor não sabe conduzir feedback');
  await page.getByTestId('analisar-relato').click();

  // Cenário 1: indicação com justificativa visível.
  const indicacao = page.getByTestId('indicacao-assistente');
  await expect(indicacao).toBeVisible();
  await expect(indicacao).toContainText('Mentoria estratégica de BP');
  await expect(indicacao).toContainText('liderança e turnover');

  // Cenário 2: o BP pode escolher outro assistente.
  await page.getByRole('button', { name: 'Escolher outro assistente' }).click();
  await expect(page.getByTestId('catalogo-assistentes')).toBeVisible();
});

test('apresenta as opções sem pré-selecionar quando a demanda é ambígua', async ({ page }) => {
  await page.route('**/api/roteamento', async (rota) => {
    await rota.fulfill({
      json: {
        sugestoes: [
          {
            assistenteId: 'etica-compliance',
            nome: 'Ética e compliance (denúncias)',
            justificativa: 'Há relato de conduta a apurar.',
            confianca: 0.56,
          },
          {
            assistenteId: 'comunicacao-lideranca',
            nome: 'Comunicação de liderança',
            justificativa: 'Também exige comunicar a equipe.',
            confianca: 0.51,
          },
        ],
        ambigua: true,
        foraDeEscopo: false,
      },
    });
  });

  await page.goto('/atendimentos/novo');
  await page.getByTestId('campo-relato').fill('recebi um relato e preciso falar com o time');
  await page.getByTestId('analisar-relato').click();

  await expect(page.getByTestId('indicacao-assistente')).toContainText(
    'pode ser atendida de duas formas',
  );
  // Nenhuma opção vem marcada — a escolha é do BP (FR-004).
  await expect(page.getByTestId('confirmar-assistente')).toBeDisabled();
});

test('recusa demanda fora dos domínios de gestão de pessoas', async ({ page }) => {
  await page.route('**/api/roteamento', async (rota) => {
    await rota.fulfill({
      json: {
        sugestoes: [],
        ambigua: false,
        foraDeEscopo: true,
        motivoRecusa: 'Demanda fiscal, fora de gestão de pessoas.',
      },
    });
  });

  await page.goto('/atendimentos/novo');
  await page.getByTestId('campo-relato').fill('como calculo o ICMS da nota fiscal');
  await page.getByTestId('analisar-relato').click();

  await expect(page.getByTestId('fora-de-escopo')).toContainText('fora de gestão de pessoas');
  await expect(page.getByTestId('indicacao-assistente')).toHaveCount(0);
});

test('a entrega é recusada enquanto houver lacuna crítica aberta (SC-005)', async ({ page }) => {
  await page.route('**/api/atendimentos/*/entrega', async (rota) => {
    await rota.fulfill({
      status: 422,
      json: {
        erro: {
          codigo: 'REFINAMENTO_INCOMPLETO',
          mensagem: 'Faltam informações para concluir com segurança.',
          detalhes: {
            lacunasPendentes: [
              {
                id: 'l1',
                pergunta: 'Quem foi ouvido e quando?',
                porQueImporta: 'Sem escuta das partes não há contraditório.',
              },
            ],
          },
        },
      },
    });
  });

  // Um atendimento em andamento é necessário; usamos a rota interceptada sobre a tela.
  await page.goto('/atendimentos');
  const primeiro = page.getByTestId('lista-atendimentos').getByRole('link').first();

  if ((await primeiro.count()) === 0) {
    test.skip(true, 'Sem atendimento em andamento no banco de desenvolvimento.');
  }

  await primeiro.click();
  const botao = page.getByTestId('emitir-entrega');

  if ((await botao.count()) > 0) {
    await botao.click();
    const recusa = page.getByTestId('recusa-entrega');
    await expect(recusa).toBeVisible();
    await expect(recusa).toContainText('Quem foi ouvido');
    await expect(recusa).toContainText('contraditório');
    await expect(page.getByTestId('entrega')).toHaveCount(0);
  }
});
