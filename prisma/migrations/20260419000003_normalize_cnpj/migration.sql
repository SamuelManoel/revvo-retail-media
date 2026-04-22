-- Normalize CNPJs: remove all non-digit characters from existing records
-- Ensures all stored CNPJs are exactly 14 raw digits (no dots, slash or dash)
UPDATE "companies"
SET "cnpj" = regexp_replace("cnpj", '[^0-9]', '', 'g')
WHERE "cnpj" ~ '[^0-9]';
