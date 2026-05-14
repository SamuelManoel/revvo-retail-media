import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getTenantSchema, tenantId, updateTenantProductImageUrl } from '@/lib/tenant-db';
import { tryFetchProductImageFromCosmos, canonicalizeProductImage } from '@/lib/cosmos-cache';

// Vercel hobby plan permite no máximo 300s. Para batches maiores rode o script
// CLI em scripts/ — esta rota processa em chunks dentro do limite.
export const maxDuration = 300;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

/**
 * POST /api/admin/backfill-product-images
 *
 * Master only. Varre TODOS os tenants do banco e, pra cada produto:
 *  - Se não tem `image_url`: tenta puxar do Cosmos via proxy e mirrora.
 *  - Se tem URL não-canônica (não em `product-images/{ean}`): re-baixa e
 *    sobe pro path canônico (compartilhado entre tenants).
 *
 * Idempotente. EANs já visitados nessa execução não são reprocessados
 * (mesmo entre tenants diferentes) — produto já está no `product-images/`,
 * só precisa apontar o `image_url` do tenant pra URL canônica.
 *
 * Body opcional: { storeId?: string } — limita a uma única loja.
 *
 * Síncrono. Pode demorar (uns 200ms–1s por EAN novo). Se estourar timeout,
 * basta rerodar: o cache no Storage faz com que as próximas execuções pulem
 * EANs já baixados.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isMaster) {
    return NextResponse.json({ message: 'Apenas master.' }, { status: 403 });
  }

  let onlyStoreId: string | null = null;
  try {
    const body = (await req.json().catch(() => ({}))) as { storeId?: string };
    if (body?.storeId) onlyStoreId = String(body.storeId);
  } catch {}

  const stores = await prisma.store.findMany({
    where: onlyStoreId ? { id: onlyStoreId } : undefined,
    select: { id: true, name: true },
  });

  // Cache de EANs já processados nesta execução, com URL canônica resultante.
  const seenEans = new Map<string, string | null>();

  type StoreResult = {
    storeId: string;
    storeName: string;
    total: number;
    downloaded: number;
    canonicalized: number;
    alreadyOk: number;
    notFound: number;
    errors: number;
  };
  const results: StoreResult[] = [];
  const startedAt = Date.now();

  for (const store of stores) {
    const schema = getTenantSchema(store.id);
    const r: StoreResult = {
      storeId: store.id,
      storeName: store.name,
      total: 0,
      downloaded: 0,
      canonicalized: 0,
      alreadyOk: 0,
      notFound: 0,
      errors: 0,
    };

    let products: Array<{ ean: string; image_url: string | null }> = [];
    try {
      const q = await pool.query(
        `SELECT ean, image_url FROM "${schema}".products WHERE tenant_id = $1 ORDER BY ean`,
        [tenantId(store.id)],
      );
      products = q.rows;
    } catch (e) {
      console.error(`[backfill] erro lendo tenant ${schema}:`, e);
      results.push(r);
      continue;
    }
    r.total = products.length;

    for (const { ean, image_url } of products) {
      if (!ean) continue;

      // Já canônica → nada a fazer.
      if (image_url && image_url.includes(`/product-images/${ean}.`)) {
        r.alreadyOk++;
        continue;
      }

      // EAN já processado nesta execução por outro tenant: aproveita o resultado.
      if (seenEans.has(ean)) {
        const cached = seenEans.get(ean);
        if (cached) {
          await updateTenantProductImageUrl(store.id, ean, cached).catch(() => {});
          r.alreadyOk++;
        } else {
          r.notFound++;
        }
        continue;
      }

      try {
        let finalUrl: string | null;
        if (!image_url) {
          finalUrl = await tryFetchProductImageFromCosmos(store.id, ean);
          if (finalUrl) r.downloaded++;
          else r.notFound++;
        } else {
          finalUrl = await canonicalizeProductImage({ storeId: store.id, ean, sourceUrl: image_url });
          if (finalUrl) r.canonicalized++;
          else r.notFound++;
        }
        seenEans.set(ean, finalUrl);
      } catch (e) {
        console.error(`[backfill] ean=${ean} erro:`, e);
        r.errors++;
      }
    }

    console.log(`[backfill] ${store.name}: total=${r.total} dl=${r.downloaded} canon=${r.canonicalized} ok=${r.alreadyOk} notFound=${r.notFound} err=${r.errors}`);
    results.push(r);
  }

  const elapsedMs = Date.now() - startedAt;
  return NextResponse.json({
    elapsedMs,
    distinctEansProcessed: seenEans.size,
    stores: results,
  });
}
