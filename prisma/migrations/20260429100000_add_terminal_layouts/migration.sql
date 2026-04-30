-- Layouts visuais editáveis para a tela do price-checker no terminal.
-- Master cria; empresa/lojas só consomem (escolhem 1 por loja).

CREATE TABLE "terminal_layouts" (
  "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "slug"           TEXT,
  "name"           TEXT        NOT NULL,
  "description"    TEXT,
  "configFound"    JSONB       NOT NULL DEFAULT '{}',
  "configNotFound" JSONB       NOT NULL DEFAULT '{}',
  "isPublic"       BOOLEAN     NOT NULL DEFAULT true,
  "isActive"       BOOLEAN     NOT NULL DEFAULT true,
  "thumbnailUrl"   TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "terminal_layouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "terminal_layouts_slug_key" UNIQUE ("slug")
);

ALTER TABLE "stores"
  ADD COLUMN "terminalLayoutId" TEXT,
  ADD CONSTRAINT "stores_terminalLayoutId_fkey"
    FOREIGN KEY ("terminalLayoutId") REFERENCES "terminal_layouts"("id") ON DELETE SET NULL;

CREATE INDEX "stores_terminalLayoutId_idx" ON "stores"("terminalLayoutId");
