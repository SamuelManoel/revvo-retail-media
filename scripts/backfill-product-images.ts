/**
 * One-shot: varre todos os tenants do banco e baixa/canonicaliza as imagens
 * de produto pra `media/product-images/{ean}.{ext}`.
 *
 * Uso:  npx tsx scripts/backfill-product-images.ts
 *       npx tsx scripts/backfill-product-images.ts <storeId>   # só uma loja
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { prisma } from '../src/lib/prisma';
import { getTenantSchema, tenantId, updateTenantProductImageUrl } from '../src/lib/tenant-db';
import { tryFetchProductImageFromCosmos, canonicalizeProductImage } from '../src/lib/cosmos-cache';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  const onlyStoreId = process.argv[2] || null;
  const stores = await prisma.store.findMany({
    where: onlyStoreId ? { id: onlyStoreId } : undefined,
    select: { id: true, name: true },
  });
  console.log(`[backfill] ${stores.length} loja(s) a processar.\n`);

  const seenEans = new Map<string, string | null>();
  const startedAt = Date.now();
  let grandDownloaded = 0;
  let grandCanonicalized = 0;
  let grandNotFound = 0;
  let grandAlreadyOk = 0;
  let grandErrors = 0;

  for (const store of stores) {
    const schema = getTenantSchema(store.id);
    let products: Array<{ ean: string; image_url: string | null }>;
    try {
      const q = await pool.query(
        `SELECT ean, image_url FROM "${schema}".products WHERE tenant_id = $1 ORDER BY ean`,
        [tenantId(store.id)],
      );
      products = q.rows;
    } catch (e) {
      console.error(`[backfill] erro lendo tenant ${schema}:`, e instanceof Error ? e.message : e);
      continue;
    }

    let dl = 0, canon = 0, notFound = 0, alreadyOk = 0, errors = 0;
    const t0 = Date.now();

    for (const { ean, image_url } of products) {
      if (!ean) continue;

      if (image_url && image_url.includes(`/product-images/${ean}.`)) {
        alreadyOk++;
        continue;
      }

      if (seenEans.has(ean)) {
        const cached = seenEans.get(ean);
        if (cached) {
          await updateTenantProductImageUrl(store.id, ean, cached).catch(() => {});
          alreadyOk++;
        } else {
          notFound++;
        }
        continue;
      }

      try {
        let finalUrl: string | null;
        if (!image_url) {
          finalUrl = await tryFetchProductImageFromCosmos(store.id, ean);
          if (finalUrl) dl++; else notFound++;
        } else {
          finalUrl = await canonicalizeProductImage({ storeId: store.id, ean, sourceUrl: image_url });
          if (finalUrl) canon++; else notFound++;
        }
        seenEans.set(ean, finalUrl);
      } catch (e) {
        errors++;
        console.error(`  ean=${ean} erro:`, e instanceof Error ? e.message : e);
      }
    }

    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `[${store.name}] ${products.length} produtos em ${dt}s — dl=${dl} canon=${canon} ok=${alreadyOk} notFound=${notFound} err=${errors}`,
    );
    grandDownloaded += dl;
    grandCanonicalized += canon;
    grandNotFound += notFound;
    grandAlreadyOk += alreadyOk;
    grandErrors += errors;
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\n[backfill] DONE em ${elapsed}s — EANs únicos=${seenEans.size}  dl=${grandDownloaded} canon=${grandCanonicalized} ok=${grandAlreadyOk} notFound=${grandNotFound} err=${grandErrors}`,
  );
  await pool.end();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
