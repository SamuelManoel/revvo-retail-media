/**
 * Reconcilia Media com Storage quando arquivos foram movidos manualmente
 * para `stores/<tenantId>/...` no Supabase Storage.
 *
 * Para cada arquivo encontrado no prefixo `stores/<tenantId>/...`:
 *   - Extrai o filename (último segmento do path)
 *   - Procura um Media cujo `path` termine com esse filename
 *   - Atualiza: storeId, companyId (da loja), path (novo), url (regenerada)
 *
 * Idempotente: rodar várias vezes só atualiza o que ainda não bateu.
 *
 * Execução: npx tsx --env-file=.env src/scripts/reconcile-media-stores.ts
 *
 * Flags:
 *   --dry-run   só lista o que faria
 */

import { prisma } from '../lib/prisma'
import { supabaseAdmin } from '../lib/supabase-admin'
import { tenantId } from '../lib/tenant-db'

const DRY_RUN = process.argv.includes('--dry-run')

type StorageFile = { fullPath: string; filename: string }

async function listFilesRecursive(bucket: string, prefix: string): Promise<StorageFile[]> {
  const out: StorageFile[] = []
  const stack = [prefix]
  while (stack.length > 0) {
    const cur = stack.pop()!
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(cur, { limit: 1000 })
    if (error) { console.error(`  list ${cur}: ${error.message}`); continue }
    for (const e of data ?? []) {
      // No SDK do Supabase: e.id === null indica "pasta virtual"
      if (e.id === null) {
        stack.push(`${cur}/${e.name}`)
      } else {
        if (e.name === '.keep' || e.name === '.emptyFolderPlaceholder') continue
        out.push({ fullPath: `${cur}/${e.name}`, filename: e.name })
      }
    }
  }
  return out
}

async function main() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  if (!bucket) { console.error('SUPABASE_STORAGE_BUCKET não configurado.'); process.exit(1) }

  const stores = await prisma.store.findMany({
    select: { id: true, name: true, companyId: true, company: { select: { name: true } } },
  })

  let totalMatched = 0
  let totalUpdated = 0
  let totalSkipped = 0
  let totalUnmatched = 0

  for (const s of stores) {
    const tid = tenantId(s.id)
    const prefix = `stores/${tid}`
    const files = await listFilesRecursive(bucket, prefix)
    console.log(`\n[${s.name}] ${prefix} → ${files.length} arquivos`)
    if (files.length === 0) continue

    for (const f of files) {
      // Procura Media cujo path termine com o filename. Usa endsWith via raw query.
      const candidates = await prisma.media.findMany({
        where: { path: { endsWith: `/${f.filename}` } },
        select: { id: true, path: true, storeId: true, companyId: true, fileName: true, url: true },
      })

      if (candidates.length === 0) {
        totalUnmatched++
        console.log(`  ✗ sem match em DB: ${f.fullPath}`)
        continue
      }
      if (candidates.length > 1) {
        // Não esperado (timestamp prefix é único), mas registra
        console.log(`  ⚠ múltiplos candidatos para ${f.filename}: ${candidates.map((c) => c.id).join(', ')} — usando primeiro`)
      }
      const m = candidates[0]
      totalMatched++

      // Já está com o storeId e path corretos?
      if (m.storeId === s.id && m.path === f.fullPath) {
        totalSkipped++
        continue
      }

      const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(f.fullPath)
      const newUrl = pub.publicUrl || null

      console.log(`  ${DRY_RUN ? '[dry]' : '✓'} ${m.fileName}`)
      console.log(`      path: ${m.path}`)
      console.log(`        →  ${f.fullPath}`)
      console.log(`      store: ${m.storeId ?? '(null)'} → ${s.id}`)

      if (DRY_RUN) continue

      try {
        await prisma.media.update({
          where: { id: m.id },
          data: {
            storeId: s.id,
            companyId: s.companyId,
            path: f.fullPath,
            url: newUrl,
          },
        })
        totalUpdated++
      } catch (e) {
        console.error(`      erro: ${(e as Error).message}`)
      }
    }
  }

  console.log(`\n[reconcile-media-stores] casados=${totalMatched} atualizados=${totalUpdated} já-OK=${totalSkipped} sem-match=${totalUnmatched}${DRY_RUN ? ' (dry-run)' : ''}`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
