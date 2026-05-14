-- Layouts de oferta (master): templates HTML-like com fundo opcional, classificados
-- por categoria (oferta_item / leve_x_pague_y / compre_ganhe_brinde / outro).

CREATE TABLE "offer_layouts" (
  "id"            TEXT NOT NULL,
  "slug"          TEXT,
  "category"      TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "orientation"   TEXT NOT NULL DEFAULT 'portrait',
  "backgroundUrl" TEXT,
  "template"      TEXT NOT NULL DEFAULT '',
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "thumbnailUrl"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "offer_layouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "offer_layouts_slug_key"     ON "offer_layouts" ("slug");
CREATE INDEX        "offer_layouts_category_idx" ON "offer_layouts" ("category");

-- Ofertas (por loja)

CREATE TABLE "offers" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "kind"           TEXT NOT NULL,
  "leveX"          INTEGER,
  "pagueY"         INTEGER,
  "brindeText"     TEXT,
  "brindeImageUrl" TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "companyId"      TEXT NOT NULL,
  "storeId"        TEXT NOT NULL,
  "layoutId"       TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "offers_storeId_idx"   ON "offers" ("storeId");
CREATE INDEX "offers_companyId_idx" ON "offers" ("companyId");

ALTER TABLE "offers"
  ADD CONSTRAINT "offers_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "offers"
  ADD CONSTRAINT "offers_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "offers"
  ADD CONSTRAINT "offers_layoutId_fkey"
  FOREIGN KEY ("layoutId") REFERENCES "offer_layouts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Snapshot dos produtos da oferta

CREATE TABLE "offer_products" (
  "id"          TEXT NOT NULL,
  "ean"         TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "preco1"      DECIMAL(10,2),
  "preco2"      DECIMAL(10,2),
  "preco3"      DECIMAL(10,2),
  "productId"   TEXT,
  "offerId"     TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "offer_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "offer_products_offerId_ean_key" ON "offer_products" ("offerId", "ean");
CREATE INDEX        "offer_products_offerId_idx"     ON "offer_products" ("offerId");

ALTER TABLE "offer_products"
  ADD CONSTRAINT "offer_products_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "offers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- TerminalMedia agora pode apontar para uma Offer em vez de Media.
-- mediaId vira opcional; novo offerId opcional; novo unique [terminalId, offerId, campaignId].

ALTER TABLE "terminal_medias" ALTER COLUMN "mediaId" DROP NOT NULL;

ALTER TABLE "terminal_medias" ADD COLUMN "offerId" TEXT;

CREATE INDEX "terminal_medias_offerId_idx" ON "terminal_medias" ("offerId");

CREATE UNIQUE INDEX "terminal_medias_terminalId_offerId_campaignId_key"
  ON "terminal_medias" ("terminalId", "offerId", "campaignId");

ALTER TABLE "terminal_medias"
  ADD CONSTRAINT "terminal_medias_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "offers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
