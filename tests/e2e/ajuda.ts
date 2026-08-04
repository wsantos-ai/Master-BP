import type { Page } from '@playwright/test';

export const BP_TESTE = { email: 'bp@exemplo.com.br', senha: 'MasterBP2026' };

export async function entrar(page: Page, credenciais = BP_TESTE) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(credenciais.email);
  await page.getByLabel('Senha').fill(credenciais.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/atendimentos**');
}
