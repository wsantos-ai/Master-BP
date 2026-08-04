import 'server-only';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErroConfiguracaoIA, MODELO_CAPAZ, obterCliente } from './gemini';
import { logger } from '@/lib/observabilidade/logger';

/**
 * Saída estruturada validada por Zod (research.md R-02).
 *
 * O schema Zod é a fonte única: dele derivamos o `responseSchema` enviado ao provedor, para que
 * os dois nunca divirjam. A resposta é validada antes de qualquer persistência — reprovar aqui é
 * o que torna o Princípio V uma verificação booleana, não uma leitura otimista.
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
 * O `responseSchema` do Gemini aceita um subconjunto do JSON Schema. Removemos as chaves que
 * ele não entende, preservando a estrutura que importa.
 */
export function paraSchemaDoProvedor(schemaJson: unknown): unknown {
  if (Array.isArray(schemaJson)) return schemaJson.map(paraSchemaDoProvedor);
  if (schemaJson === null || typeof schemaJson !== 'object') return schemaJson;

  const naoSuportadas = new Set([
    '$schema',
    '$ref',
    'additionalProperties',
    'definitions',
    '$defs',
    'default',
    'const',
    'exclusiveMinimum',
    'exclusiveMaximum',
  ]);

  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(schemaJson as Record<string, unknown>)) {
    if (naoSuportadas.has(chave)) continue;
    saida[chave] = paraSchemaDoProvedor(valor);
  }
  return saida;
}

export function derivarSchema<T extends z.ZodTypeAny>(schema: T): unknown {
  return paraSchemaDoProvedor(zodToJsonSchema(schema, { target: 'openApi3' }));
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
}) => Promise<string>;

const chamadorPadrao: ChamadorModelo = async ({
  modelo,
  instrucaoSistema,
  entrada,
  schemaProvedor,
  temperatura,
}) => {
  const cliente = obterCliente();
  const resposta = await cliente.models.generateContent({
    model: modelo,
    contents: entrada,
    config: {
      systemInstruction: instrucaoSistema,
      responseMimeType: 'application/json',
      responseSchema: schemaProvedor as never,
      temperature: temperatura,
    },
  });
  return resposta.text ?? '';
};

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
      });
    } catch (erro) {
      // Falta de chave é erro de configuração: retentar não resolve e só atrasa o diagnóstico.
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
