import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cliente do OpenRouter — contracts/provedor-ia.md §1, §2.5 e §3.
 *
 * Nenhum teste aqui toca a rede: `fetch` é dublado. É o que permite a suíte inteira rodar sem
 * `OPENROUTER_API_KEY` configurada (FR-014).
 */

const CHAVE = 'sk-or-teste-1234567890';

/** Recarrega o módulo para que as constantes de modelo releiam o ambiente. */
async function carregarModulo() {
  vi.resetModules();
  return import('@/lib/ia/openrouter');
}

function respostaOk(corpo: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => corpo,
    text: async () => JSON.stringify(corpo),
  } as unknown as Response;
}

function respostaErro(status: number, corpo = '{"error":{"message":"falhou"}}') {
  return {
    ok: false,
    status,
    json: async () => JSON.parse(corpo),
    text: async () => corpo,
  } as unknown as Response;
}

const RESPOSTA_CHAT = { choices: [{ message: { content: '{"ok":true}' } }] };

const parametrosChat = {
  modelo: 'modelo-de-teste',
  instrucaoSistema: 'instrução',
  entrada: 'entrada',
  temperatura: 0.4,
  evento: 'teste',
};

let fetchDublado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = CHAVE;
  fetchDublado = vi.fn();
  vi.stubGlobal('fetch', fetchDublado);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODELO_RAPIDO;
  delete process.env.OPENROUTER_MODELO_CAPAZ;
  delete process.env.OPENROUTER_MODELO_TRANSCRICAO;
});

/** Corpo JSON da última requisição feita ao provedor. */
function ultimoCorpo(): Record<string, unknown> {
  const chamada = fetchDublado.mock.calls.at(-1)!;
  return JSON.parse((chamada[1] as RequestInit).body as string);
}

describe('configuração', () => {
  it('exige OPENROUTER_API_KEY e não retenta sem ela', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { chamarChat, ErroConfiguracaoIA } = await carregarModulo();

    await expect(chamarChat(parametrosChat)).rejects.toThrow(ErroConfiguracaoIA);
    expect(fetchDublado).not.toHaveBeenCalled();
  });

  it('a presença isolada de GEMINI_API_KEY não satisfaz a configuração (FR-015)', async () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.GEMINI_API_KEY = 'chave-antiga-do-provedor-anterior';

    const { chamarChat, ErroConfiguracaoIA } = await carregarModulo();
    await expect(chamarChat(parametrosChat)).rejects.toThrow(ErroConfiguracaoIA);

    delete process.env.GEMINI_API_KEY;
  });

  it('usa os modelos padrão quando o ambiente não os define', async () => {
    const { MODELO_RAPIDO, MODELO_CAPAZ, MODELO_TRANSCRICAO } = await carregarModulo();

    expect(MODELO_RAPIDO).toBe('deepseek/deepseek-v4-flash-0731');
    expect(MODELO_CAPAZ).toBe('deepseek/deepseek-v4-flash-0731');
    expect(MODELO_TRANSCRICAO).toBe('mistralai/voxtral-mini-transcribe');
  });

  it('permite sobrescrever cada modelo por ambiente, sem alteração de código (FR-003)', async () => {
    process.env.OPENROUTER_MODELO_RAPIDO = 'outro/modelo-rapido';
    process.env.OPENROUTER_MODELO_CAPAZ = 'outro/modelo-capaz';
    process.env.OPENROUTER_MODELO_TRANSCRICAO = 'outro/modelo-transcricao';

    const { MODELO_RAPIDO, MODELO_CAPAZ, MODELO_TRANSCRICAO } = await carregarModulo();

    expect(MODELO_RAPIDO).toBe('outro/modelo-rapido');
    expect(MODELO_CAPAZ).toBe('outro/modelo-capaz');
    expect(MODELO_TRANSCRICAO).toBe('outro/modelo-transcricao');
  });
});

describe('política de dados em toda requisição (FR-011, R-05)', () => {
  it('envia data_collection=deny e zdr=true no chat', async () => {
    fetchDublado.mockResolvedValue(respostaOk(RESPOSTA_CHAT));
    const { chamarChat } = await carregarModulo();

    await chamarChat(parametrosChat);

    expect(ultimoCorpo().provider).toEqual({ data_collection: 'deny', zdr: true });
  });

  it('envia data_collection=deny e zdr=true na transcrição', async () => {
    fetchDublado.mockResolvedValue(respostaOk({ text: 'olá', usage: { seconds: 2 } }));
    const { chamarTranscricao } = await carregarModulo();

    await chamarTranscricao({ base64: 'YWJj', formato: 'webm' });

    expect(ultimoCorpo().provider).toEqual({ data_collection: 'deny', zdr: true });
  });

  it('não envia os cabeçalhos de atribuição do provedor (R-01)', async () => {
    fetchDublado.mockResolvedValue(respostaOk(RESPOSTA_CHAT));
    const { chamarChat } = await carregarModulo();

    await chamarChat(parametrosChat);

    const cabecalhos = (fetchDublado.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(cabecalhos.Authorization).toBe(`Bearer ${CHAVE}`);
    expect(cabecalhos).not.toHaveProperty('HTTP-Referer');
    expect(cabecalhos).not.toHaveProperty('X-OpenRouter-Title');
  });
});

describe('mapeamento de status HTTP (contracts §2.5)', () => {
  const configuracao = [
    [401, 'credencial inválida'],
    [402, 'sem crédito'],
    [403, 'sem permissão'],
    [404, 'modelo inexistente'],
  ] as const;

  for (const [status, rotulo] of configuracao) {
    it(`${status} (${rotulo}) vira ErroConfiguracaoIA — sem retentativa`, async () => {
      fetchDublado.mockResolvedValue(respostaErro(status));
      const { chamarChat, ErroConfiguracaoIA } = await carregarModulo();

      await expect(chamarChat(parametrosChat)).rejects.toThrow(ErroConfiguracaoIA);
      expect(fetchDublado).toHaveBeenCalledTimes(1);
    });
  }

  it('429 vira ErroProvedorIA com motivo limite_requisicoes', async () => {
    fetchDublado.mockResolvedValue(respostaErro(429));
    const { chamarChat, ErroProvedorIA } = await carregarModulo();

    await expect(chamarChat(parametrosChat)).rejects.toMatchObject({
      name: 'ErroProvedorIA',
      motivo: 'limite_requisicoes',
      status: 429,
    });
    await expect(chamarChat(parametrosChat)).rejects.toBeInstanceOf(ErroProvedorIA);
  });

  it('5xx vira ErroProvedorIA com motivo falha_provedor', async () => {
    fetchDublado.mockResolvedValue(respostaErro(503));
    const { chamarChat } = await carregarModulo();

    await expect(chamarChat(parametrosChat)).rejects.toMatchObject({
      name: 'ErroProvedorIA',
      motivo: 'falha_provedor',
    });
  });

  it('falha de rede vira ErroProvedorIA com motivo rede', async () => {
    fetchDublado.mockRejectedValue(new TypeError('fetch failed'));
    const { chamarChat } = await carregarModulo();

    await expect(chamarChat(parametrosChat)).rejects.toMatchObject({
      name: 'ErroProvedorIA',
      motivo: 'rede',
    });
  });

  it('resposta sem conteúdo é tratada como inválida, não como sucesso vazio', async () => {
    fetchDublado.mockResolvedValue(respostaOk({ choices: [] }));
    const { chamarChat } = await carregarModulo();

    await expect(chamarChat(parametrosChat)).rejects.toMatchObject({ name: 'ErroProvedorIA' });
  });
});

describe('saída estruturada e degradação (R-02)', () => {
  const comSchema = { ...parametrosChat, schemaProvedor: { type: 'object', properties: {} } };

  it('envia response_format json_schema estrito quando há schema', async () => {
    fetchDublado.mockResolvedValue(respostaOk(RESPOSTA_CHAT));
    const { chamarChat } = await carregarModulo();

    await chamarChat(comSchema);

    const corpo = ultimoCorpo() as { response_format: { type: string; json_schema: { strict: boolean } } };
    expect(corpo.response_format.type).toBe('json_schema');
    expect(corpo.response_format.json_schema.strict).toBe(true);
  });

  it('envia json_object quando nenhum schema é fornecido', async () => {
    fetchDublado.mockResolvedValue(respostaOk(RESPOSTA_CHAT));
    const { chamarChat } = await carregarModulo();

    await chamarChat(parametrosChat);

    expect((ultimoCorpo() as { response_format: { type: string } }).response_format.type).toBe(
      'json_object',
    );
  });

  it('não envia provider.require_parameters — degradar é melhor que falhar no roteamento', async () => {
    fetchDublado.mockResolvedValue(respostaOk(RESPOSTA_CHAT));
    const { chamarChat } = await carregarModulo();

    await chamarChat(comSchema);

    expect(ultimoCorpo().provider).not.toHaveProperty('require_parameters');
  });

  it('degrada para json_object quando o provedor recusa o modo estrito', async () => {
    fetchDublado
      .mockResolvedValueOnce(respostaErro(400, '{"error":{"message":"response_format is not supported"}}'))
      .mockResolvedValueOnce(respostaOk(RESPOSTA_CHAT));

    const { chamarChat } = await carregarModulo();
    const conteudo = await chamarChat(comSchema);

    expect(conteudo).toBe('{"ok":true}');
    expect(fetchDublado).toHaveBeenCalledTimes(2);
    expect((ultimoCorpo() as { response_format: { type: string } }).response_format.type).toBe(
      'json_object',
    );
  });

  it('serializa o schema na instrução quando degradado — o formato ainda é pedido', async () => {
    fetchDublado
      .mockResolvedValueOnce(respostaErro(400, '{"error":{"message":"json_schema unsupported"}}'))
      .mockResolvedValueOnce(respostaOk(RESPOSTA_CHAT));

    const { chamarChat } = await carregarModulo();
    await chamarChat(comSchema);

    const corpo = ultimoCorpo() as { messages: { role: string; content: string }[] };
    expect(corpo.messages[0]!.content).toContain('"type":"object"');
  });

  it('degrada uma única vez por processo — a chamada seguinte já nasce em json_object', async () => {
    fetchDublado
      .mockResolvedValueOnce(respostaErro(400, '{"error":{"message":"structured outputs not supported"}}'))
      .mockResolvedValue(respostaOk(RESPOSTA_CHAT));

    const { chamarChat } = await carregarModulo();

    await chamarChat(comSchema);
    expect(fetchDublado).toHaveBeenCalledTimes(2);

    await chamarChat(comSchema);
    // Só mais uma: a segunda chamada não tenta o modo estrito de novo.
    expect(fetchDublado).toHaveBeenCalledTimes(3);
    expect((ultimoCorpo() as { response_format: { type: string } }).response_format.type).toBe(
      'json_object',
    );
  });

  it('400 sem relação com schema não degrada — vira erro de provedor', async () => {
    fetchDublado.mockResolvedValue(respostaErro(400, '{"error":{"message":"malformed body"}}'));
    const { chamarChat } = await carregarModulo();

    await expect(chamarChat(comSchema)).rejects.toMatchObject({
      name: 'ErroProvedorIA',
      motivo: 'requisicao_invalida',
    });
  });
});

describe('nada de conteúdo no log (Princípio I, SC-006)', () => {
  it('não registra corpo da requisição, corpo da resposta nem credencial', async () => {
    const espiaoLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const espiaoErro = vi.spyOn(console, 'error').mockImplementation(() => {});

    fetchDublado.mockResolvedValue(respostaErro(500, '{"error":{"message":"prompt: assédio na equipe do João"}}'));
    const { chamarChat } = await carregarModulo();

    await expect(
      chamarChat({ ...parametrosChat, entrada: 'assédio na equipe do João' }),
    ).rejects.toThrow();

    const escrito = [...espiaoLog.mock.calls, ...espiaoErro.mock.calls].flat().join('\n');

    expect(escrito).not.toContain('assédio');
    expect(escrito).not.toContain('João');
    expect(escrito).not.toContain(CHAVE);
    // O que PODE aparecer: evento e status.
    expect(escrito).toContain('ia.provedor_recusou');
    expect(escrito).toContain('500');

    espiaoLog.mockRestore();
    espiaoErro.mockRestore();
  });
});
