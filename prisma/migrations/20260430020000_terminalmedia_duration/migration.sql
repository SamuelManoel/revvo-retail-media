-- AlterTable
ALTER TABLE "terminal_medias" ADD COLUMN "duration" INTEGER;

-- Backfill: imagens existentes recebem 10s; vídeos ficam null (tocam até o fim)
UPDATE "terminal_medias" tm
SET "duration" = 10
FROM "media" m
WHERE tm."mediaId" = m.id
  AND m."type" = 'image'
  AND tm."duration" IS NULL;
