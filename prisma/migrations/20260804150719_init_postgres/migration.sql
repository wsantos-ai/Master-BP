-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "organizacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistentes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dominios" TEXT NOT NULL,
    "arquivoPrompt" TEXT NOT NULL,
    "estruturaEntrega" TEXT NOT NULL,
    "sensivelPorPadrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "assistentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimentos" (
    "id" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "assistenteId" TEXT NOT NULL,
    "relatoInicial" TEXT NOT NULL,
    "origemRelato" TEXT NOT NULL DEFAULT 'texto',
    "estado" TEXT NOT NULL DEFAULT 'em_andamento',
    "classificacaoSigilo" TEXT NOT NULL DEFAULT 'padrao',
    "assistenteSugerido" TEXT,
    "justificativaSugestao" TEXT,
    "trocaManual" BOOLEAN NOT NULL DEFAULT false,
    "promptHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaInteracaoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),
    "expurgarEm" TIMESTAMP(3),

    CONSTRAINT "atendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lacunas" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "pergunta" TEXT NOT NULL,
    "porQueImporta" TEXT NOT NULL,
    "critica" BOOLEAN NOT NULL DEFAULT true,
    "estado" TEXT NOT NULL DEFAULT 'aberta',
    "resposta" TEXT,
    "justificativaNaoAplicavel" TEXT,
    "ordem" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidaEm" TIMESTAMP(3),

    CONSTRAINT "lacunas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_refinamento" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_refinamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "estruturaAplicada" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "planoAcao" TEXT NOT NULL,
    "marcacaoSigilo" TEXT NOT NULL DEFAULT 'publico_interno',
    "notaGuarda" TEXT,
    "versaoModelo" TEXT NOT NULL,
    "geradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entregas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinalizacoes_escalonamento" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "tipoRisco" TEXT NOT NULL,
    "instanciaRecomendada" TEXT NOT NULL,
    "origemDeteccao" TEXT NOT NULL,
    "trechoGatilho" TEXT,
    "detectadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sinalizacoes_escalonamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalhe" TEXT,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "atendimentos_autorId_criadoEm_idx" ON "atendimentos"("autorId", "criadoEm");

-- CreateIndex
CREATE INDEX "atendimentos_estado_ultimaInteracaoEm_idx" ON "atendimentos"("estado", "ultimaInteracaoEm");

-- CreateIndex
CREATE INDEX "atendimentos_expurgarEm_idx" ON "atendimentos"("expurgarEm");

-- CreateIndex
CREATE INDEX "lacunas_atendimentoId_ordem_idx" ON "lacunas"("atendimentoId", "ordem");

-- CreateIndex
CREATE INDEX "mensagens_refinamento_atendimentoId_criadaEm_idx" ON "mensagens_refinamento"("atendimentoId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_atendimentoId_key" ON "entregas"("atendimentoId");

-- CreateIndex
CREATE INDEX "sinalizacoes_escalonamento_atendimentoId_idx" ON "sinalizacoes_escalonamento"("atendimentoId");

-- CreateIndex
CREATE INDEX "registros_auditoria_atendimentoId_idx" ON "registros_auditoria"("atendimentoId");

-- CreateIndex
CREATE INDEX "registros_auditoria_usuarioId_ocorridoEm_idx" ON "registros_auditoria"("usuarioId", "ocorridoEm");

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_assistenteId_fkey" FOREIGN KEY ("assistenteId") REFERENCES "assistentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lacunas" ADD CONSTRAINT "lacunas_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_refinamento" ADD CONSTRAINT "mensagens_refinamento_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinalizacoes_escalonamento" ADD CONSTRAINT "sinalizacoes_escalonamento_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
