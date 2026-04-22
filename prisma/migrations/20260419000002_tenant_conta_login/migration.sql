-- Add conta (tenant identifier) to companies
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "conta" TEXT;

-- Backfill: use slug as initial conta for existing companies
UPDATE "companies" SET "conta" = "slug" WHERE "conta" IS NULL;

-- Now enforce NOT NULL and UNIQUE
ALTER TABLE "companies" ALTER COLUMN "conta" SET NOT NULL;
ALTER TABLE "companies" ADD CONSTRAINT "companies_conta_key" UNIQUE ("conta");

-- Change users.email uniqueness from global to per-company
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";
ALTER TABLE "users" ADD CONSTRAINT "users_email_companyId_key" UNIQUE ("email", "companyId");
