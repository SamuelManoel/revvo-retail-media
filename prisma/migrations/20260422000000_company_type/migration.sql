-- Add type field to companies (master | tenant)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'tenant';

-- Mark the master company (identified by slug = 'revvo')
UPDATE "companies" SET "type" = 'master' WHERE "slug" = 'revvo';
