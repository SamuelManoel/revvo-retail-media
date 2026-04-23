/**
 * Adiciona a coluna image_url em todos os schemas de tenant existentes.
 * Execução: npx tsx src/scripts/migrate-tenant-image-url.ts
 */
import { Pool } from 'pg'
import { getTenantSchema } from '../lib/tenant-db'

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

async function main() {
  // Busca todas as lojas cadastradas
  const { rows: stores } = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM stores ORDER BY name`
  )

  console.log(`${stores.length} lojas encontradas.\n`)

  for (const store of stores) {
    const schema = getTenantSchema(store.id)
    try {
      // Verifica se o schema existe
      const { rows } = await pool.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
        [schema]
      )

      if (rows.length === 0) {
        console.log(`⚠  ${store.name} — schema "${schema}" não existe, pulando.`)
        continue
      }

      await pool.query(
        `ALTER TABLE "${schema}".products ADD COLUMN IF NOT EXISTS image_url TEXT`
      )
      console.log(`✓  ${store.name} — coluna image_url adicionada.`)
    } catch (err) {
      console.error(`✗  ${store.name} — erro:`, err)
    }
  }

  await pool.end()
  console.log('\nMigração concluída.')
}

main().catch((err) => { console.error(err); process.exit(1) })
