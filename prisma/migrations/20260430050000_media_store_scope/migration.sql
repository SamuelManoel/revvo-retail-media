-- Mídia agora pode ser escopada por loja. Linhas legadas ficam com storeId NULL
-- (escopo "empresa") e seguem visíveis para a empresa toda.

ALTER TABLE "media" ADD COLUMN "storeId" TEXT;

CREATE INDEX "media_storeId_idx" ON "media"("storeId");

ALTER TABLE "media"
  ADD CONSTRAINT "media_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
