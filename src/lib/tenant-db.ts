import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
})

/**
 * Converte um storeId (UUID) para o nome do schema PostgreSQL do tenant.
 * Ex: "550e8400-e29b-41d4-a716-446655440000" → "tenant_550e8400e29b41d4a716446655440000"
 */
export function getTenantSchema(storeId: string): string {
  return `tenant_${storeId.replace(/-/g, '')}`
}

/** Normaliza o storeId para uso como tenant_id (sem hífens). */
function tenantId(storeId: string): string {
  return storeId.replace(/-/g, '')
}

/**
 * Cria o schema e a tabela de produtos para uma loja.
 * Chamado automaticamente ao criar uma Store.
 */
export async function createStoreSchema(storeId: string): Promise<void> {
  const schema = getTenantSchema(storeId)

  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${schema}".products (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     TEXT        NOT NULL,
      ean           TEXT        NOT NULL,
      codigo_produto TEXT,
      produto       TEXT        NOT NULL,
      preco1        NUMERIC(10,2) NOT NULL,
      preco2        NUMERIC(10,2),
      preco3        NUMERIC(10,2),
      image_url     TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (ean)
    )
  `)

  // Garante que schemas existentes também tenham a coluna
  await pool.query(`ALTER TABLE "${schema}".products ADD COLUMN IF NOT EXISTS image_url TEXT`)
}

/**
 * Remove o schema inteiro da loja (chamado ao deletar uma Store).
 */
export async function dropStoreSchema(storeId: string): Promise<void> {
  const schema = getTenantSchema(storeId)
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
}

// ── Produtos ──────────────────────────────────────────────────────────────────

export interface TenantProduct {
  id: string
  tenant_id: string
  ean: string
  codigo_produto: string | null
  produto: string
  preco1: string
  preco2: string | null
  preco3: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface ListProductsOptions {
  page?: number
  limit?: number
  q?: string
}

export async function listProducts(
  storeId: string,
  options: ListProductsOptions = {}
): Promise<{ products: TenantProduct[]; total: number; page: number; limit: number; pages: number }> {
  const schema = getTenantSchema(storeId)
  const page = Math.max(1, options.page ?? 1)
  const limit = Math.min(100, Math.max(1, options.limit ?? 50))
  const offset = (page - 1) * limit

  let where = ''
  const params: unknown[] = [tenantId(storeId)]

  if (options.q) {
    params.push(`%${options.q}%`)
    where = `AND (p.produto ILIKE $${params.length} OR p.ean ILIKE $${params.length} OR p.codigo_produto ILIKE $${params.length})`
  }

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM "${schema}".products p WHERE p.tenant_id = $1 ${where}`,
    params
  )

  params.push(limit, offset)
  const dataResult = await pool.query(
    `SELECT * FROM "${schema}".products p
     WHERE p.tenant_id = $1 ${where}
     ORDER BY p.produto ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const total: number = countResult.rows[0].total
  return {
    products: dataResult.rows,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }
}

export async function getProductByEan(
  storeId: string,
  ean: string
): Promise<TenantProduct | null> {
  const schema = getTenantSchema(storeId)
  const result = await pool.query(
    `SELECT * FROM "${schema}".products WHERE tenant_id = $1 AND ean = $2 LIMIT 1`,
    [tenantId(storeId), ean]
  )
  return result.rows[0] ?? null
}

export interface UpsertProductInput {
  ean: string
  codigoProduto?: string | null
  produto: string
  preco1: number
  preco2?: number | null
  preco3?: number | null
  imageUrl?: string | null
}

/**
 * Upsert por EAN. Retorna o produto e se foi criado (true) ou atualizado (false).
 */
export async function upsertProduct(
  storeId: string,
  input: UpsertProductInput
): Promise<{ product: TenantProduct; created: boolean }> {
  const schema = getTenantSchema(storeId)

  const result = await pool.query(
    `INSERT INTO "${schema}".products (tenant_id, ean, codigo_produto, produto, preco1, preco2, preco3, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (ean) DO UPDATE SET
       codigo_produto = EXCLUDED.codigo_produto,
       produto        = EXCLUDED.produto,
       preco1         = EXCLUDED.preco1,
       preco2         = EXCLUDED.preco2,
       preco3         = EXCLUDED.preco3,
       image_url      = EXCLUDED.image_url,
       updated_at     = NOW()
     RETURNING *, (xmax = 0) AS created`,
    [
      tenantId(storeId),
      input.ean,
      input.codigoProduto ?? null,
      input.produto,
      input.preco1,
      input.preco2 ?? null,
      input.preco3 ?? null,
      input.imageUrl ?? null,
    ]
  )

  const row = result.rows[0]
  const created: boolean = row.created
  delete row.created
  return { product: row, created }
}

export async function updateProduct(
  storeId: string,
  productId: string,
  input: Partial<UpsertProductInput>
): Promise<TenantProduct | null> {
  const schema = getTenantSchema(storeId)

  const fields: string[] = []
  const params: unknown[] = [tenantId(storeId), productId]

  if (input.ean !== undefined) { params.push(input.ean); fields.push(`ean = $${params.length}`) }
  if (input.codigoProduto !== undefined) { params.push(input.codigoProduto); fields.push(`codigo_produto = $${params.length}`) }
  if (input.produto !== undefined) { params.push(input.produto); fields.push(`produto = $${params.length}`) }
  if (input.preco1 !== undefined) { params.push(input.preco1); fields.push(`preco1 = $${params.length}`) }
  if (input.preco2 !== undefined) { params.push(input.preco2); fields.push(`preco2 = $${params.length}`) }
  if (input.preco3 !== undefined) { params.push(input.preco3); fields.push(`preco3 = $${params.length}`) }
  if (input.imageUrl !== undefined) { params.push(input.imageUrl); fields.push(`image_url = $${params.length}`) }

  if (fields.length === 0) return null

  fields.push(`updated_at = NOW()`)

  const result = await pool.query(
    `UPDATE "${schema}".products SET ${fields.join(', ')}
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    params
  )
  return result.rows[0] ?? null
}

export async function deleteProduct(
  storeId: string,
  productId: string
): Promise<boolean> {
  const schema = getTenantSchema(storeId)
  const result = await pool.query(
    `DELETE FROM "${schema}".products WHERE tenant_id = $1 AND id = $2`,
    [tenantId(storeId), productId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function deleteAllProducts(storeId: string): Promise<number> {
  const schema = getTenantSchema(storeId)
  const result = await pool.query(
    `DELETE FROM "${schema}".products WHERE tenant_id = $1`,
    [tenantId(storeId)]
  )
  return result.rowCount ?? 0
}
