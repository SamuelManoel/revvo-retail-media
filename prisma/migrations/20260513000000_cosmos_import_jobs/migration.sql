-- Jobs assíncronos da importação de imagens do Cosmos.
-- Permite que o processo rode no servidor independente da UI estar aberta.

CREATE TABLE "cosmos_import_jobs" (
  "id"            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "storeId"       TEXT        NOT NULL,
  "status"        TEXT        NOT NULL DEFAULT 'queued',  -- queued|running|done|failed|cancelled
  "overwrite"     BOOLEAN     NOT NULL DEFAULT false,
  "total"         INTEGER     NOT NULL DEFAULT 0,
  "processed"     INTEGER     NOT NULL DEFAULT 0,
  "updated"       INTEGER     NOT NULL DEFAULT 0,
  "notFound"      INTEGER     NOT NULL DEFAULT 0,
  "errorsCount"   INTEGER     NOT NULL DEFAULT 0,
  "errors"        JSONB       NOT NULL DEFAULT '[]',   -- [{ean, reason}]
  "currentEan"    TEXT,                                -- EAN sendo processado agora (debug)
  "message"       TEXT,                                -- mensagem de erro caso failed
  "createdById"   TEXT,                                -- userId que disparou
  "startedAt"     TIMESTAMPTZ,
  "finishedAt"    TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "cosmos_import_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cosmos_import_jobs_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE
);

CREATE INDEX "cosmos_import_jobs_storeId_idx" ON "cosmos_import_jobs"("storeId");
CREATE INDEX "cosmos_import_jobs_status_idx" ON "cosmos_import_jobs"("status");
CREATE INDEX "cosmos_import_jobs_createdAt_idx" ON "cosmos_import_jobs"("createdAt" DESC);
