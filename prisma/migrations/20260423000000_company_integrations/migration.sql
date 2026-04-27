CREATE TABLE "company_integrations" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "slug"      TEXT        NOT NULL,
  "isEnabled" BOOLEAN     NOT NULL DEFAULT false,
  "config"    JSONB       NOT NULL DEFAULT '{}',
  "features"  JSONB       NOT NULL DEFAULT '[]',
  "companyId" TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "company_integrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_integrations_slug_companyId_key" UNIQUE ("slug", "companyId"),
  CONSTRAINT "company_integrations_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
);
