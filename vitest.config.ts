import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// `server-only` existe para o build do Next barrar import em Client Component. Sob o Vitest
// não há essa distinção — o pacote resolveria para a variante de cliente e lançaria erro.
const alias = [
  {
    find: 'server-only',
    replacement: fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
  },
];

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/setup-unit.ts'],
        },
      },
      {
        plugins: [tsconfigPaths()],
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/setup-integration.ts'],
          globalSetup: ['tests/global-setup-integration.ts'],
          // Preparar o banco chama o CLI do Prisma — mais lento que o padrão de 10s.
          hookTimeout: 120_000,
          testTimeout: 30_000,
          // Testes de integração compartilham o mesmo arquivo SQLite — sem execução paralela.
          pool: 'threads',
          poolOptions: { threads: { singleThread: true } },
          sequence: { concurrent: false },
        },
      },
    ],
  },
});
