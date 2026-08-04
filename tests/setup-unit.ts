import { randomBytes } from 'node:crypto';

// Chave determinística para os testes de unidade — nunca reutilizada fora daqui.
process.env.CHAVE_CRIPTO ??= randomBytes(32).toString('base64');
