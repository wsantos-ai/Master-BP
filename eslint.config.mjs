import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: [
      // Gerado pelo Next a cada build — não é código nosso.
      'next-env.d.ts',
      'node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'prisma/migrations/**',
      '*.min.js',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Princípio I: conteúdo de atendimento nunca vai para log.
      // O único ponto autorizado a escrever em console é lib/observabilidade/logger.ts,
      // que redige o que registra.
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['lib/observabilidade/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['prisma/seed.ts', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
];

export default config;
