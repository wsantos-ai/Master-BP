import { randomBytes } from 'node:crypto';
import path from 'node:path';

// Banco isolado para integração — nunca o dev.db, que pode conter trabalho real.
// Caminho absoluto para que o cliente e o `prisma db push` apontem para o mesmo arquivo.
const arquivo = path.join(process.cwd(), 'prisma', 'test.db');
process.env.DATABASE_URL = `file:${arquivo}`;

process.env.CHAVE_CRIPTO ??= randomBytes(32).toString('base64');
process.env.AUTH_SECRET ??= randomBytes(32).toString('base64');
