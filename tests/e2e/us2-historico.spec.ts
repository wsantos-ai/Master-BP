import { expect, test } from '@playwright/test';
import { entrar } from './ajuda';

/** US2 — histórico, filtros e isolamento entre BPs. */

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test('lista o histórico do próprio BP com filtros', async ({ page }) => {
  await page.goto('/atendimentos');

  await expect(page.getByRole('heading', { name: 'Seus atendimentos' })).toBeVisible();
  await expect(page.getByTestId('filtros-historico')).toBeVisible();

  await page.getByLabel('Especialidade').selectOption('etica-compliance');
  await page.getByRole('button', { name: 'Filtrar' }).click();

  await expect(page).toHaveURL(/especialidade=etica-compliance/);
});

test('filtra por situação', async ({ page }) => {
  await page.goto('/atendimentos');
  await page.getByLabel('Situação').selectOption('concluido');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/estado=concluido/);
});

test('atendimento inexistente ou de outro BP responde 404 (SC-006)', async ({ page }) => {
  const resposta = await page.request.get('/api/atendimentos/id-de-outro-bp-inexistente');
  expect(resposta.status()).toBe(404);

  const corpo = await resposta.json();
  // 404, nunca 403: diferenciar confirmaria a existência do registro alheio.
  expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');
});

test('rota protegida rejeita acesso sem sessão', async ({ browser }) => {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();

  const resposta = await pagina.request.get('/api/atendimentos');
  expect(resposta.status()).toBe(401);

  await contexto.close();
});
