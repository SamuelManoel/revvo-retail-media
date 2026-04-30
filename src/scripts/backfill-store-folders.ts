/**
 * Backfill: cria a pasta `stores/<tenantId>/` no Supabase Storage para cada
 * loja existente (sobe um placeholder `.keep` vazio com upsert).
 *
 * Idempotente: rodar várias vezes não duplica nada.
 *
 * Execução: npx tsx --env-file=.env src/scripts/backfill-store-folders.ts
 *
 * Flags:
 *   --dry-run    apenas lista as lojas, sem subir arquivos
 */

import { prisma } from '../lib/prisma'
import { supabaseAdmin } from '../lib/supabase-admin'
import { tenantId } from '../lib/tenant-db'
import { buildStoreFolderKeepPath } from '../lib/upload'

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  if (!bucket) {
    console.error('SUPABASE_STORAGE_BUCKET não configurado.')
    process.exit(1)
  }

  const stores = await prisma.store.findMany({
    select: { id: true, name: true, company: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`[backfill-store-folders] ${stores.length} lojas encontradas. bucket=${bucket}${DRY_RUN ? ' (dry-run)' : ''}`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const store of stores) {
    const tid = tenantId(store.id)
    const path = buildStoreFolderKeepPath(tid)
    const label = `${store.company?.name ?? '?'} / ${store.name}`

    if (DRY_RUN) {
      console.log(`  [dry] ${path}  (${label})`)
      continue
    }

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, new Blob([''], { type: 'text/plain' }), { upsert: true })

    if (error) {
      // upsert deveria evitar erro, mas registramos qualquer falha
      if (/already exists/i.test(error.message)) {
        skipped++
        console.log(`  ↪ ${path}  já existe — ${label}`)
      } else {
        failed++
        console.error(`  ✗ ${path}  erro: ${error.message} — ${label}`)
      }
      continue
    }
    created++
    console.log(`  ✓ ${path}  — ${label}`)
  }

  console.log(`[backfill-store-folders] criadas=${created} já-existiam=${skipped} falharam=${failed}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
