-- Fix: add ON DELETE CASCADE to terminals.companyId foreign key
-- Without this, deleting a company fails with FK violation when terminals exist

ALTER TABLE "terminals" DROP CONSTRAINT IF EXISTS "terminals_companyId_fkey";

ALTER TABLE "terminals"
  ADD CONSTRAINT "terminals_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
