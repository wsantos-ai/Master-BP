import 'server-only';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErroConfiguracaoIA, MODELO_CAPAZ, chamarChat } from './openrouter';
import { logger } from '@/lib/observabilidade/logger';

/**
 * Saída estruturada validada por Zod (research.md R-02).
 *
 * O schema Zod é a fonte única: dele derivamos o schema enviado ao provedor, para que os dois
 * nunca divirjam na forma. Mas a autoridade não é simétrica — **o schema do provedor é uma
 * orientação de formato; o Zod é o contrato**. O modo estrito do OpenRouter não aceita as
 * restrições de valor que nossos schemas usam (`min`, `max`, `maxItems`), então elas são
 * removidas do que vai para o modelo e permanecem apenas aqui, onde reprovam de verdade.
 *
 * A resposta é validada antes de qualquer persistência — reprovar aqui é o que torna o
 * Princípio V uma verificação booleana, não uma leitura otimista.
 *
 * Até 2 retentativas. Esgotadas, o chamador recebe erro e NADA é gravado: entrega parcial é
 * pior que ausência de entrega.
 */

export const MAX_TENTATIVAS = 3; // 1 tentativa + 2 retentativas

export class ErroSaidaEstruturada extends Error {
  override name = 'ErroSaidaEstruturada';

  constructor(
    message: string,
    readonly tentativas: number,
    /** Último motivo da falha — vai para o log, sem conteúdo de atendimento. */
    readonly motivo: string = 'desconhecido',
  ) {
    super(message);
  }
}

/**
 * Chaves que o modo estrito do provedor não aceita (contracts/provedor-ia.md §2.2).
 *
 * Removê-las não afrouxa nada: cada uma delas continua existindo no schema Zod, que é quem
 * decide se a resposta entra ou não no banco.
 */
const NAO_SUPORTADAS = new Set([
  '$schema',
  '$ref',
  'definitions',
  '$defs',
  'default',
  'const',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minItems',
  'maxItems',
  'pattern',
  'format',
]);

/**
 * Converte um JSON Schema 7 para o dialeto estrito do provedor:
 * todo objeto ganha `additionalProperties: false` e passa a exigir todas as suas propriedades.
 */
export function paraSchemaDoProvedor(schemaJson: unknown): unknown {
  if (Array.isArray(schemaJson)) return schemaJson.map(paraSchemaDoProvedor);
  if (schemaJson === null || typeof schemaJson !== 'object') return schemaJson;

  const entrada = schemaJson as Record<string, unknown>;
  const saida: Record<string, unknown> = {};

  for (const [chave, valor] of Object.entries(entrada)) {
    if (NAO_SUPORTADAS.has(chave)) continue;
    saida[chave] = paraSchemaDoProvedor(valor);
  }

  if (entrada.type === 'object' && typeof entrada.properties === 'object') {
    saida.additionalProperties = false;
    // O modo estrito exige que `required` liste TODAS as propriedades. Campos opcionais no Zod
    // continuam opcionais no Zod — aqui eles apenas passam a ser sempre pedidos ao modelo.
    saida.required = Object.keys(entrada.properties as Record<string, unknown>);
  }

  return saida;
}

export function derivarSchema<T extends z.ZodTypeAny>(schema: T): unknown {
  return paraSchemaDoProvedor(
    zodToJsonSchema(schema, {
      // `jsonSchema7`, e não `openApi3`: precisamos de `type: ["string","null"]` para os campos
      // anuláveis, não do `nullable: true` que o modo estrito rejeita.
      target: 'jsonSchema7',
      // Sem `$ref`/`$defs`: o dialeto estrito não os resolve.
      $refStrategy: 'none',
    }),
  );
}

export type OpcoesGeracao<T extends z.ZodTypeAny> = {
  schema: T;
  instrucaoSistema: string;
  entrada: string;
  modelo?: string;
  temperatura?: number;
  /** Rótulo para o log — nunca inclui conteúdo. */
  evento: string;
};

/** Injetável nos testes, para não depender do provedor. */
export type ChamadorModelo = (params: {
  modelo: string;
  instrucaoSistema: string;
  entrada: string;
  schemaProvedor: unknown;
  temperatura: number;
  evento: string;
}) => Promise<string>;

const chamadorPadrao: ChamadorModelo = (params) => chamarChat(params);

export async function gerarEstruturado<T extends z.ZodTypeAny>(
  opcoes: OpcoesGeracao<T>,
  chamador: ChamadorModelo = chamadorPadrao,
): Promise<{ dados: z.infer<T>; modelo: string; tentativas: number }> {
  const modelo = opcoes.modelo ?? MODELO_CAPAZ;
  const schemaProvedor = derivarSchema(opcoes.schema);
  let ultimoMotivo = 'desconhecido';

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    let bruto: string;
    try {
      bruto = await chamador({
        modelo,
        instrucaoSistema: opcoes.instrucaoSistema,
        entrada: opcoes.entrada,
        schemaProvedor,
        temperatura: opcoes.temperatura ?? 0.4,
        evento: opcoes.evento,
      });
    } catch (erro) {
      // Falta ou invalidez de chave, falta de crédito, modelo inexistente: retentar não resolve
      // e só atrasa o diagnóstico de quem opera.
      if (erro instanceof ErroConfiguracaoIA) throw erro;

      ultimoMotivo = erro instanceof Error ? erro.name : 'falha_provedor';
      logger.aviso('ia.falha_provedor', {
        evento: opcoes.evento,
        tentativa,
        motivo: ultimoMotivo,
      });
      continue;
    }

    let json: unknown;
    try {
      json = JSON.parse(bruto);
    } catch {
      ultimoMotivo = 'json_invalido';
      logger.aviso('ia.json_invalido', { evento: opcoes.evento, tentativa });
      continue;
    }

    const resultado = opcoes.schema.safeParse(json);
    if (resultado.success) {
      return { dados: resultado.data, modelo, tentativas: tentativa };
    }

    ultimoMotivo = 'schema_reprovado';
    logger.aviso('ia.schema_reprovado', {
      evento: opcoes.evento,
      tentativa,
      // Caminho do campo, não o valor: o valor pode conter conteúdo de atendimento.
      campos: resultado.error.issues.map((i) => i.path.join('.')).join(','),
    });
  }

  throw new ErroSaidaEstruturada(
    `Não foi possível obter uma resposta válida do modelo (${ultimoMotivo}).`,
    MAX_TENTATIVAS,
    ultimoMotivo,
  );
}
