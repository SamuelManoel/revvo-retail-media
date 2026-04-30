/**
 * Backfill: roda `createStoreSchema` para cada loja existente, garantindo que
 * as tabelas/índices novos (product_scans) existam em todos os tenants.
 *
 * Idempotente: usa CREATE ... IF NOT EXISTS internamente.
 *
 * Execução: npx tsx --env-file=.env src/scripts/backfill-tenant-analytics.ts
 */

import { prisma } from '../lib/prisma'
import { createStoreSchema } from '../lib/tenant-db'

async function main() {
  const stores = await prisma.store.findMany({
    select: { id: true, name: true, company: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`[backfill-tenant-analytics] ${stores.length} lojas`)

  let ok = 0
  let fail = 0
  for (const s of stores) {
    try {
      await createStoreSchema(s.id)
      ok++
      console.log(`  ✓ ${s.company?.name ?? '?'} / ${s.name}`)
    } catch (e) {
      fail++
      console.error(`  ✗ ${s.company?.name ?? '?'} / ${s.name}: ${(e as Error).message}`)
    }
  }
  console.log(`[backfill-tenant-analytics] ok=${ok} fail=${fail}`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
