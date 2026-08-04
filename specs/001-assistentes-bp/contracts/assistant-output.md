# Contract — Saída estruturada dos assistentes

**Feature**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md) (R-02, R-05)

Contrato entre a aplicação e o modelo. Todas as chamadas pedem JSON com `responseSchema`
derivado do schema Zod correspondente — fonte única, para que os dois nunca divirjam. A
resposta é validada antes de qualquer persistência; validação reprovada não vira entrega.

---

## 1. Roteamento

Usado por `POST /api/roteamento`.

```
{
  sugestoes: [ { assistenteId: <id do catálogo>, justificativa: string, confianca: 0..1 } ],
  foraDeEscopo: boolean,
  motivoRecusa: string | null
}
```

**Validação**: `assistenteId` restrito aos cinco ids do catálogo; lista com 0–2 itens;
`foraDeEscopo = true` exige `motivoRecusa` preenchido e `sugestoes` vazio.

---

## 2. Rodada de refinamento

Usado por `POST /api/atendimentos/[id]/mensagens`. O texto conversacional vai por streaming; o
quadro estruturado abaixo fecha a resposta.

```
{
  novasLacunas: [ { pergunta: string, critica: boolean, porQueImporta: string } ],
  lacunasResolvidas: [ { lacunaId: string } ],
  risco: { detectado: boolean, tipos: [<tipoRisco>], instanciaRecomendada: <instancia> | null },
  prontoParaEntrega: boolean
}
```

**Regra crítica**: `prontoParaEntrega` do modelo é **sinal, não decisão**. O servidor recalcula
o predicado a partir das lacunas persistidas; divergência prevalece pelo servidor (R-01).
O mesmo vale para `risco`: o campo é unido ao resultado da camada determinística, e qualquer um
dos dois basta para sinalizar (R-05).

---

## 3. Entregas por especialidade

Cada especialidade declara sua estrutura obrigatória. Seção ausente reprova a validação e a
entrega é regenerada (SC-003). Todas incluem `planoAcao` não vazio (FR-011).

### 3.1 `etica-compliance` — Parecer técnico (7 seções)

Conforme `lib/agentes/agente-denuncias.md`:

```
{
  cabecalho: { codigoCaso: string | null, dataElaboracao: string, classificacaoSigilo: "restrito" },
  resumoApuracao: string,
  gravidade: { nivel: "baixa"|"media"|"alta", justificativa: string },
  criteriosInvestigacao: {
    escutaAtiva: string, apuracaoFatos: string,
    contextoAdicional: string, planoResolucao: string
  },
  embasamentoLegal: [ { referencia: string, aplicacao: string } ],
  planoAcao: [ { acao: string, responsavel: string, prazo: string } ],
  recomendacoesAdicionais: [ string ],
  notaGuarda: string,
  limitacoesAnonimato: string | null
}
```

**Regras**: `marcacaoSigilo` sempre `restrito`; `notaGuarda` obrigatória (FR-022);
`limitacoesAnonimato` obrigatória quando a denúncia é anônima (FR-025); nenhuma medida punitiva
em `planoAcao` sem fato correspondente registrado em `criteriosInvestigacao` (FR-013).

### 3.2 `treinamento-desenvolvimento` — Entrega de T&D (6 seções)

Conforme `agente-treinamento.md`:

```
{
  objetivoEstrategico: { descricao: string, roiEsperado: string, kpis: [string] },
  metodologia: { nome: string, porQueEscolhida: string },
  planoAula: [ { modulo: string, duracao: string, descricao: string, recurso: string } ],
  roteiroSlides: [ { numero: number, titulo: string, pontosChave: [string] } ],
  dicasFacilitacao: [ string ],
  indicadoresAvaliacao: { reacao: string, aprendizagem: string, comportamento: string, resultado: string },
  planoAcao: [ { acao: string, responsavel: string, prazo: string } ],
  promptCanva: string | null
}
```

**Regras**: `planoAula` e `roteiroSlides` não vazios; `indicadoresAvaliacao` segue os quatro
níveis de Kirkpatrick; `promptCanva` preenchido apenas quando solicitado.

### 3.3 `comunicacao-lideranca` — Comunicação

Conforme `agente-mensagens.md`:

```
{
  formato: "informal" | "email" | "comunicado_oficial",
  assunto: string | null,
  corpo: string,
  escalonamento: { necessario: boolean, situacao: string | null, acaoRecomendada: string | null },
  orientacaoConducao: string,
  planoAcao: [ { acao: string, responsavel: string, prazo: string } ]
}
```

**Regras**: `formato = email` ⟹ `corpo` inicia com a saudação obrigatória do prompt e `assunto`
é preenchido; `formato = informal` ⟹ no máximo 5 parágrafos; `formato = comunicado_oficial` ⟹
`assunto` e data presentes. `orientacaoConducao` é obrigatória — o agente não é só redator.

### 3.4 `mentoria-bp` — Orientação estratégica

Conforme `agente-bp.md`:

```
{
  diagnostico: string,
  analiseEstrategica: { pessoas: string, processos: string, cultura: string, resultados: string },
  orientacao: { recomendacao: string, fundamentacao: [ { fonte: string, aplicacao: string } ] },
  indicadoresSugeridos: [ string ],
  planoAcao: [ { acao: string, responsavel: string, prazo: string } ]
}
```

**Regras**: as quatro perspectivas de `analiseEstrategica` são obrigatórias;
`fundamentacao` não vazia — recomendação sem embasamento reprova (Princípio V).

### 3.5 `engenharia-prompts` — Prompt gerado

Conforme `agente-prompt.md`:

```
{
  promptGerado: {
    persona: string, missao: string, fluxoAcao: [string] | null,
    dominios: [string], formatoSaida: string, tomDeVoz: string,
    restricoes: [string], orientacoesGerais: string | null
  },
  porQueFunciona: string,
  tecnicasAplicadas: [ "role_prompting"|"chain_of_thought"|"few_shot"|"structured_output"|"negative_prompting"|"conditional_logic"|"guardrails" ],
  planoAcao: [ { acao: string, responsavel: string, prazo: string } ]
}
```

**Regras**: os blocos obrigatórios do prompt canônico devem estar presentes (`fluxoAcao` pode
ser nulo apenas para agentes simples de pergunta-resposta); `restricoes` não vazia —
negative prompting é exigido sempre; `porQueFunciona` obrigatória.

---

## 4. Transcrição

```
{ texto: string, confiancaBaixa: boolean }
```

`confiancaBaixa = true` sinaliza ao BP que a revisão merece atenção. Falha de transcrição não
usa este contrato — retorna o erro `TRANSCRICAO_FALHOU` da rota.

---

## 5. Comportamento em falha

| Situação | Ação |
|---|---|
| JSON inválido ou schema reprovado | Até 2 retentativas; depois `502 ESTRUTURA_INVALIDA`, nada persistido |
| Modelo devolve `prontoParaEntrega = true` com lacuna crítica aberta | Servidor ignora e recusa a entrega (`422 REFINAMENTO_INCOMPLETO`) |
| Modelo não sinaliza risco que a regra determinística detectou | Escalonamento é registrado com `origemDeteccao = "regra"` |
| Modelo sinaliza risco que a regra não detectou | Escalonamento é registrado com `origemDeteccao = "modelo"` |
| Provedor indisponível | `503`, atendimento preservado em `em_andamento`, respostas já enviadas intactas |
