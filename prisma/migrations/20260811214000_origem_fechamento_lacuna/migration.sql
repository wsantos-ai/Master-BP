-- Origem do fechamento da lacuna (feature 003, FR-004).
-- Nullable e sem backfill: lacunas fechadas antes desta migracao ficam com NULL, que significa
-- "fechada antes de a origem passar a ser registrada". Inventar 'resposta_direta' retroativamente
-- seria fabricar auditoria.

-- AlterTable
ALTER TABLE "lacunas" ADD COLUMN     "origemFechamento" TEXT;
