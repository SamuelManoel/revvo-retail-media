import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── vi.hoisted: mockQuery disponível antes do hoisting do vi.mock ─────────
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('pg', () => ({
  Pool: class {
    query = mockQuery;
  },
}));

import {
  getTenantSchema,
  listProducts,
  getProductByEan,
  upsertProduct,
  deleteProduct,
  deleteAllProducts,
} from '../tenant-db';

const STORE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TENANT_SCHEMA = 'tenant_550e8400e29b41d4a716446655440000';
const TENANT_ID = '550e8400e29b41d4a716446655440000';

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-uuid-001',
    tenant_id: TENANT_ID,
    ean: '7891000100103',
    codigo_produto: 'COD001',
    produto: 'Produto Teste',
    preco1: '10.00',
    preco2: null,
    preco3: null,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── getTenantSchema ────────────────────────────────────────────────────────
describe('getTenantSchema', () => {
  it('remove hífens e adiciona prefixo tenant_', () => {
    expect(getTenantSchema(STORE_ID)).toBe(TENANT_SCHEMA);
  });

  it('funciona com UUID sem hífens', () => {
    expect(getTenantSchema(TENANT_ID)).toBe(`tenant_${TENANT_ID}`);
  });

  it('prefixo é sempre tenant_', () => {
    expect(getTenantSchema('any-id').startsWith('tenant_')).toBe(true);
  });
});

// ── listProducts ───────────────────────────────────────────────────────────
describe('listProducts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna lista paginada de produtos', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [makeProduct()] });

    const result = await listProducts(STORE_ID, { page: 1, limit: 10 });
    expect(result.products).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.pages).toBe(1);
  });

  it('usa valores padrão de paginação', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listProducts(STORE_ID);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
  });

  it('limita o máximo de resultados a 100', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listProducts(STORE_ID, { limit: 9999 });
    expect(result.limit).toBe(100);
  });

  it('calcula pages corretamente (55 itens, limit 10 = 6 páginas)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 55 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listProducts(STORE_ID, { limit: 10 });
    expect(result.pages).toBe(6);
  });

  it('usa o schema correto na query', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listProducts(STORE_ID);
    const [countCall] = mockQuery.mock.calls;
    expect(countCall[0]).toContain(`"${TENANT_SCHEMA}".products`);
  });

  it('inclui filtro ILIKE quando q é fornecido', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listProducts(STORE_ID, { q: 'arroz' });
    const [countSql, countParams] = mockQuery.mock.calls[0];
    expect(countSql).toContain('ILIKE');
    expect(countParams).toContain('%arroz%');
  });
});

// ── getProductByEan ────────────────────────────────────────────────────────
describe('getProductByEan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna produto quando encontrado', async () => {
    const product = makeProduct();
    mockQuery.mockResolvedValueOnce({ rows: [product] });

    const result = await getProductByEan(STORE_ID, '7891000100103');
    expect(result).toEqual(product);
  });

  it('retorna null quando produto não existe', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getProductByEan(STORE_ID, 'ean-inexistente');
    expect(result).toBeNull();
  });

  it('busca no schema correto', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getProductByEan(STORE_ID, '123');
    expect(mockQuery.mock.calls[0][0]).toContain(`"${TENANT_SCHEMA}".products`);
  });
});

// ── upsertProduct ──────────────────────────────────────────────────────────
describe('upsertProduct', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna produto criado com created=true', async () => {
    const product = makeProduct({ created: true });
    mockQuery.mockResolvedValueOnce({ rows: [product] });

    const result = await upsertProduct(STORE_ID, {
      ean: '7891000100103',
      produto: 'Produto Teste',
      preco1: 10.0,
    });

    expect(result.created).toBe(true);
    expect(result.product.ean).toBe('7891000100103');
    expect(result.product).not.toHaveProperty('created');
  });

  it('retorna produto atualizado com created=false', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeProduct({ created: false })] });

    const result = await upsertProduct(STORE_ID, {
      ean: '7891000100103',
      produto: 'Produto Atualizado',
      preco1: 15.0,
    });

    expect(result.created).toBe(false);
  });

  it('usa ON CONFLICT para upsert por EAN', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeProduct({ created: true })] });
    await upsertProduct(STORE_ID, { ean: '123', produto: 'P', preco1: 1 });

    expect(mockQuery.mock.calls[0][0]).toContain('ON CONFLICT (ean) DO UPDATE');
  });

  it('aceita campos opcionais nulos', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeProduct({ created: true })] });

    await upsertProduct(STORE_ID, {
      ean: '123',
      produto: 'P',
      preco1: 1,
      preco2: null,
      preco3: null,
      codigoProduto: null,
      imageUrl: null,
    });

    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain(null);
  });
});

// ── deleteProduct ──────────────────────────────────────────────────────────
describe('deleteProduct', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna true quando produto foi deletado', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    expect(await deleteProduct(STORE_ID, 'prod-uuid-001')).toBe(true);
  });

  it('retorna false quando produto não existe', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    expect(await deleteProduct(STORE_ID, 'nao-existe')).toBe(false);
  });
});

// ── deleteAllProducts ──────────────────────────────────────────────────────
describe('deleteAllProducts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna quantidade de produtos removidos', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 42 });
    expect(await deleteAllProducts(STORE_ID)).toBe(42);
  });

  it('retorna 0 quando não há produtos', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    expect(await deleteAllProducts(STORE_ID)).toBe(0);
  });

  it('usa schema correto', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    await deleteAllProducts(STORE_ID);
    expect(mockQuery.mock.calls[0][0]).toContain(`"${TENANT_SCHEMA}".products`);
  });
});
