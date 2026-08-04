import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Cria o banco de integração uma única vez, antes de qualquer arquivo de teste.
 *
 * Antes isso ficava no `beforeAll` de cada arquivo: o segundo arquivo tentava apagar um arquivo
 * ainda aberto pela conexão do primeiro. Preparar uma vez só resolve e é mais rápido.
 */
export default function setup() {
  const arquivo = path.join(process.cwd(), 'prisma', 'test.db');
  if (existsSync(arquivo)) rmSync(arquivo, { force: true });

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: `file:${arquivo}` },
    stdio: 'ignore',
  });
}
