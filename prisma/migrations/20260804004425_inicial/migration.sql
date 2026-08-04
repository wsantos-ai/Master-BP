-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "organizacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "assistentes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dominios" TEXT NOT NULL,
    "arquivoPrompt" TEXT NOT NULL,
    "estruturaEntrega" TEXT NOT NULL,
    "sensivelPorPadrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "atendimentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaInteracaoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" DATETIME,
    "expurgarEm" DATETIME,
    CONSTRAINT "atendimentos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atendimentos_assistenteId_fkey" FOREIGN KEY ("assistenteId") REFERENCES "assistentes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lacunas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "atendimentoId" TEXT NOT NULL,
    "pergunta" TEXT NOT NULL,
    "porQueImporta" TEXT NOT NULL,
    "critica" BOOLEAN NOT NULL DEFAULT true,
    "estado" TEXT NOT NULL DEFAULT 'aberta',
    "resposta" TEXT,
    "justificativaNaoAplicavel" TEXT,
    "ordem" INTEGER NOT NULL,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidaEm" DATETIME,
    CONSTRAINT "lacunas_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mensagens_refinamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "atendimentoId" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mensagens_refinamento_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "entregas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "atendimentoId" TEXT NOT NULL,
    "estruturaAplicada" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "planoAcao" TEXT NOT NULL,
    "marcacaoSigilo" TEXT NOT NULL DEFAULT 'publico_interno',
    "notaGuarda" TEXT,
    "versaoModelo" TEXT NOT NULL,
    "geradaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entregas_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sinalizacoes_escalonamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "atendimentoId" TEXT NOT NULL,
    "tipoRisco" TEXT NOT NULL,
    "instanciaRecomendada" TEXT NOT NULL,
    "origemDeteccao" TEXT NOT NULL,
    "trechoGatilho" TEXT,
    "detectadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sinalizacoes_escalonamento_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "atendimentoId" TEXT,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "ocorridoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalhe" TEXT,
    CONSTRAINT "registros_auditoria_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "atendimentos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "registros_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
