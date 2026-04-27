import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── vi.hoisted ─────────────────────────────────────────────────────────────
const {
  mockGetSession,
  mockStoreFindUnique,
  mockListProducts,
  mockUpsertProduct,
  mockDeleteAllProducts,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockStoreFindUnique: vi.fn(),
  mockListProducts: vi.fn(),
  mockUpsertProduct: vi.fn(),
  mockDeleteAllProducts: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSession: mockGetSession }));
vi.mock('@/lib/prisma', () => ({
  prisma: { store: { findUnique: mockStoreFindUnique } },
}));
vi.mock('@/lib/tenant-db', () => ({
  listProducts: mockListProducts,
  upsertProduct: mockUpsertProduct,
  deleteAllProducts: mockDeleteAllProducts,
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));

import { GET, POST, DELETE } from '@/app/api/stores/[id]/products/route';

// ── Factories ──────────────────────────────────────────────────────────────
const STORE_ID = 'store-uuid-001';
const COMPANY_ID = 'company-uuid-001';

function makeStore(overrides: Record<string, unknown> = {}) {
  return { id: STORE_ID, companyId: COMPANY_ID, name: 'Loja Teste', ...overrides };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-001',
    companyId: COMPANY_ID,
    name: 'Admin',
    email: 'admin@teste.com',
    isMaster: false,
    ...overrides,
  };
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-uuid-001',
    tenant_id: STORE_ID.replace(/-/g, ''),
    ean: '7891000100103',
    produto: 'Produto Teste',
    preco1: '10.00',
    preco2: null,
    preco3: null,
    image_url: null,
    ...overrides,
  };
}

function makeParams(id = STORE_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeGetReq(search = '') {
  return new NextRequest(`http://localhost/api/stores/${STORE_ID}/products${search}`);
}

function makePostReq(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/stores/${STORE_ID}/products`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeDeleteReq() {
  return new NextRequest(`http://localhost/api/stores/${STORE_ID}/products`, { method: 'DELETE' });
}

// ── GET ────────────────────────────────────────────────────────────────────
describe('GET /api/stores/[id]/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(makeSession());
    mockStoreFindUnique.mockResolvedValue(makeStore());
    mockListProducts.mockResolvedValue({ products: [makeProduct()], total: 1, page: 1, limit: 50, pages: 1 });
  });

  it('retorna 401 sem sessão', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await GET(makeGetReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it('retorna 404 quando loja não existe', async () => {
    mockStoreFindUnique.mockResolvedValueOnce(null);
    const res = await GET(makeGetReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it('retorna 404 quando loja pertence a outra empresa (non-master)', async () => {
    mockStoreFindUnique.mockResolvedValueOnce(makeStore({ companyId: 'outra-empresa' }));
    const res = await GET(makeGetReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it('master pode acessar loja de qualquer empresa', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession({ isMaster: true }));
    mockStoreFindUnique.mockResolvedValueOnce(makeStore({ companyId: 'outra-empresa' }));
    const res = await GET(makeGetReq(), makeParams());
    expect(res.status).toBe(200);
  });

  it('retorna lista paginada de produtos', async () => {
    const res = await GET(makeGetReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('passa parâmetros de paginação para listProducts', async () => {
    await GET(makeGetReq('?page=2&limit=10'), makeParams());
    expect(mockListProducts).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ page: 2, limit: 10 }));
  });

  it('passa parâmetro q para listProducts', async () => {
    await GET(makeGetReq('?q=arroz'), makeParams());
    expect(mockListProducts).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ q: 'arroz' }));
  });
});

// ── POST ───────────────────────────────────────────────────────────────────
describe('POST /api/stores/[id]/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(makeSession());
    mockStoreFindUnique.mockResolvedValue(makeStore());
    mockUpsertProduct.mockResolvedValue({ product: makeProduct(), created: true });
  });

  it('retorna 401 sem sessão', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await POST(makePostReq({ ean: '123', produto: 'P', preco1: 10 }), makeParams());
    expect(res.status).toBe(401);
  });

  it('retorna 404 quando loja não existe', async () => {
    mockStoreFindUnique.mockResolvedValueOnce(null);
    const res = await POST(makePostReq({ ean: '123', produto: 'P', preco1: 10 }), makeParams());
    expect(res.status).toBe(404);
  });

  it('retorna 400 quando ean está ausente', async () => {
    const res = await POST(makePostReq({ produto: 'P', preco1: 10 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/ean/i);
  });

  it('retorna 400 quando produto está ausente', async () => {
    const res = await POST(makePostReq({ ean: '123', preco1: 10 }), makeParams());
    expect(res.status).toBe(400);
  });

  it('retorna 400 quando preco1 está ausente', async () => {
    const res = await POST(makePostReq({ ean: '123', produto: 'P' }), makeParams());
    expect(res.status).toBe(400);
  });

  it('retorna 201 quando produto é criado (upsert novo)', async () => {
    mockUpsertProduct.mockResolvedValueOnce({ product: makeProduct(), created: true });
    const res = await POST(makePostReq({ ean: '123', produto: 'P', preco1: 10 }), makeParams());
    expect(res.status).toBe(201);
  });

  it('retorna 200 quando produto é atualizado (upsert existente)', async () => {
    mockUpsertProduct.mockResolvedValueOnce({ product: makeProduct(), created: false });
    const res = await POST(makePostReq({ ean: '123', produto: 'P', preco1: 10 }), makeParams());
    expect(res.status).toBe(200);
  });

  it('chama upsertProduct com dados corretos incluindo preços opcionais', async () => {
    await POST(makePostReq({ ean: '7891', produto: 'Arroz', preco1: 5.99, preco2: 4.99 }), makeParams());
    expect(mockUpsertProduct).toHaveBeenCalledWith(
      STORE_ID,
      expect.objectContaining({ ean: '7891', produto: 'Arroz', preco1: 5.99, preco2: 4.99 })
    );
  });

  it('preco2 e preco3 são null quando ausentes', async () => {
    await POST(makePostReq({ ean: '123', produto: 'P', preco1: 10 }), makeParams());
    expect(mockUpsertProduct).toHaveBeenCalledWith(
      STORE_ID,
      expect.objectContaining({ preco2: null, preco3: null })
    );
  });
});

// ── DELETE ─────────────────────────────────────────────────────────────────
describe('DELETE /api/stores/[id]/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(makeSession());
    mockStoreFindUnique.mockResolvedValue(makeStore());
    mockDeleteAllProducts.mockResolvedValue(10);
  });

  it('retorna 401 sem sessão', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await DELETE(makeDeleteReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it('retorna 404 quando loja não existe', async () => {
    mockStoreFindUnique.mockResolvedValueOnce(null);
    const res = await DELETE(makeDeleteReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it('retorna 200 com mensagem contendo a quantidade removida', async () => {
    const res = await DELETE(makeDeleteReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/10/);
  });

  it('retorna 0 quando não há produtos', async () => {
    mockDeleteAllProducts.mockResolvedValueOnce(0);
    const res = await DELETE(makeDeleteReq(), makeParams());
    const body = await res.json();
    expect(body.message).toMatch(/0/);
  });
});
