-- Drop product catalog and store integration tables
-- These are replaced by per-store tenant schemas (tenant_{storeId})

ALTER TABLE "stores" DROP COLUMN IF EXISTS "integration";
ALTER TABLE "stores" DROP COLUMN IF EXISTS "products";

DROP TABLE IF EXISTS "products";
DROP TABLE IF EXISTS "store_integrations";
