/**
 * Migra imagens de produtos do tenant para o Supabase Storage.
 *
 * Para cada produto com image_url externa:
 *  1. Faz download da imagem pela URL
 *  2. Faz upload para o bucket em products/{tenantId}/{ean}.{ext}
 *  3. Atualiza o image_url no banco com a URL pública do Supabase
 *
 * Execução: npx tsx --env-file=.env src/scripts/migrate-product-images.ts
 *
 * Flags opcionais:
 *   --store <storeId>   processa apenas a store informada
 *   --limit <n>         limita a n produtos por store (padrão: sem limite)
 *   --dry-run           exibe o que faria sem alterar nada
 */

import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { getTenantSchema } from '../lib/tenant-db'

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET!

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const storeFilter = args.includes('--store') ? args[args.indexOf('--store') + 1] : null
const limitArg    = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null
const DRY_RUN     = args.includes('--dry-run')

if (DRY_RUN) console.log('🔍 DRY RUN — nenhuma alteração será feita.\n')

// ── Helpers ──────────────────────────────────────────────────────────────────
function isAlreadySupabase(url: string): boolean {
  return url.includes(process.env.NEXT_PUBLIC_SUPABASE_URL!)
}

function extFromUrl(url: string, contentType: string | null): string {
  // Tenta pegar pela URL
  const match = url.split('?')[0].match(/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i)
  if (match) return match[1].toLowerCase()
  // Fallback pelo content-type
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif',
  }
  return map[contentType ?? ''] ?? 'jpg'
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type')
    const buffer = Buffer.from(await res.arrayBuffer())
    return { buffer, contentType }
  } catch {
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function processStore(storeId: string, storeName: string) {
  const schema = getTenantSchema(storeId)
  const tenantId = storeId.replace(/-/g, '')

  const limitClause = limitArg ? `LIMIT ${limitArg}` : ''
  const { rows: products } = await pool.query<{ id: string; ean: string; image_url: string }>(
    `SELECT id, ean, image_url
     FROM "${schema}".products
     WHERE tenant_id = $1
       AND image_url IS NOT NULL
       AND image_url <> ''
     ORDER BY ean
     ${limitClause}`,
    [tenantId]
  )

  const external = products.filter((p) => !isAlreadySupabase(p.image_url))
  console.log(`\n📦 ${storeName} (${storeId})`)
  console.log(`   ${products.length} produtos com imagem, ${external.length} externas para migrar`)

  let ok = 0, skip = 0, fail = 0

  for (const product of external) {
    const downloaded = await downloadImage(product.image_url)

    if (!downloaded) {
      console.log(`   ✗ EAN ${product.ean} — download falhou: ${product.image_url}`)
      fail++
      continue
    }

    const ext  = extFromUrl(product.image_url, downloaded.contentType)
    const path = `products/${tenantId}/${product.ean}.${ext}`
    const mime = downloaded.contentType ?? `image/${ext}`

    if (DRY_RUN) {
      console.log(`   → EAN ${product.ean} — seria salvo em ${path}`)
      ok++
      continue
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, downloaded.buffer, { contentType: mime, upsert: true })

    if (uploadError) {
      console.log(`   ✗ EAN ${product.ean} — upload falhou: ${uploadError.message}`)
      fail++
      continue
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const newUrl = urlData.publicUrl

    await pool.query(
      `UPDATE "${schema}".products SET image_url = $1, updated_at = NOW() WHERE id = $2`,
      [newUrl, product.id]
    )

    console.log(`   ✓ EAN ${product.ean} → ${path}`)
    ok++
  }

  console.log(`   Resultado: ${ok} migradas, ${skip} puladas, ${fail} falhas`)
}

async function main() {
  const { rows: stores } = await pool.query<{ id: string; name: string }>(
    storeFilter
      ? `SELECT id, name FROM stores WHERE id = $1`
      : `SELECT id, name FROM stores ORDER BY name`,
    storeFilter ? [storeFilter] : []
  )

  if (stores.length === 0) {
    console.log('Nenhuma store encontrada.')
    return
  }

  for (const store of stores) {
    await processStore(store.id, store.name)
  }

  await pool.end()
  console.log('\n✅ Migração concluída.')
}

main().catch((err) => { console.error(err); process.exit(1) })
