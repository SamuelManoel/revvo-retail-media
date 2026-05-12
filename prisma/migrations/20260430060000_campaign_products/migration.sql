-- Snapshot de produtos vinculados a uma campanha (preserva histórico de preço).

CREATE TABLE "campaign_products" (
  "id"          TEXT NOT NULL,
  "ean"         TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "preco1"      DECIMAL(10,2),
  "preco2"      DECIMAL(10,2),
  "preco3"      DECIMAL(10,2),
  "productId"   TEXT,
  "campaignId"  TEXT NOT NULL,
  "storeId"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "campaign_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_products_campaignId_ean_key"
  ON "campaign_products" ("campaignId", "ean");

CREATE INDEX "campaign_products_campaignId_idx"
  ON "campaign_products" ("campaignId");

CREATE INDEX "campaign_products_storeId_idx"
  ON "campaign_products" ("storeId");

ALTER TABLE "campaign_products"
  ADD CONSTRAINT "campaign_products_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campaign_products"
  ADD CONSTRAINT "campaign_products_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
