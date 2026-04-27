import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkLicenseAvailable, incrementLicenseUsed, decrementLicenseUsed } from '../license';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    storeLicense: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
const mockStoreLicense = (prisma as any).storeLicense as {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

const STORE_ID = 'store-uuid-001';
const now = new Date();
const futureDate = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30); // +30 dias
const pastDate = new Date(now.getTime() - 1000); // -1 segundo

function makeLicense(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lic-001',
    storeId: STORE_ID,
    status: 'active',
    expiresAt: futureDate,
    quantityTotal: 5,
    quantityUsed: 2,
    ...overrides,
  };
}

// ── checkLicenseAvailable ──────────────────────────────────────────────────
describe('checkLicenseAvailable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna ok=false quando loja não tem licença', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(null);
    const result = await checkLicenseAvailable(STORE_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/licença/i);
  });

  it('retorna ok=false quando status é suspended', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(makeLicense({ status: 'suspended' }));
    const result = await checkLicenseAvailable(STORE_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/suspensa|inativa/i);
  });

  it('retorna ok=false quando status é expired (campo status)', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(makeLicense({ status: 'expired' }));
    const result = await checkLicenseAvailable(STORE_ID);
    expect(result.ok).toBe(false);
  });

  it('retorna ok=false quando data expiresAt é passada', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(makeLicense({ expiresAt: pastDate }));
    const result = await checkLicenseAvailable(STORE_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/expirada/i);
  });

  it('retorna ok=false quando limite de terminais foi atingido', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(
      makeLicense({ quantityTotal: 3, quantityUsed: 3 })
    );
    const result = await checkLicenseAvailable(STORE_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/limite/i);
  });

  it('retorna ok=true quando licença está ativa, não expirada e tem slot disponível', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(makeLicense());
    const result = await checkLicenseAvailable(STORE_ID);
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('retorna ok=true com quantityUsed = quantityTotal - 1 (último slot)', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(
      makeLicense({ quantityTotal: 5, quantityUsed: 4 })
    );
    const result = await checkLicenseAvailable(STORE_ID);
    expect(result.ok).toBe(true);
  });

  it('retorna ok=false quando quantityUsed ultrapassa quantityTotal', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(
      makeLicense({ quantityTotal: 3, quantityUsed: 5 })
    );
    const result = await checkLicenseAvailable(STORE_ID);
    expect(result.ok).toBe(false);
  });
});

// ── incrementLicenseUsed ───────────────────────────────────────────────────
describe('incrementLicenseUsed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama update com increment de 1', async () => {
    mockStoreLicense.update.mockResolvedValueOnce({});
    await incrementLicenseUsed(STORE_ID);
    expect(mockStoreLicense.update).toHaveBeenCalledWith({
      where: { storeId: STORE_ID },
      data: { quantityUsed: { increment: 1 } },
    });
  });
});

// ── decrementLicenseUsed ───────────────────────────────────────────────────
describe('decrementLicenseUsed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('não chama update quando licença não existe', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(null);
    await decrementLicenseUsed(STORE_ID);
    expect(mockStoreLicense.update).not.toHaveBeenCalled();
  });

  it('não chama update quando quantityUsed já é 0', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(makeLicense({ quantityUsed: 0 }));
    await decrementLicenseUsed(STORE_ID);
    expect(mockStoreLicense.update).not.toHaveBeenCalled();
  });

  it('chama update com decrement quando quantityUsed > 0', async () => {
    mockStoreLicense.findUnique.mockResolvedValueOnce(makeLicense({ quantityUsed: 2 }));
    mockStoreLicense.update.mockResolvedValueOnce({});
    await decrementLicenseUsed(STORE_ID);
    expect(mockStoreLicense.update).toHaveBeenCalledWith({
      where: { storeId: STORE_ID },
      data: { quantityUsed: { decrement: 1 } },
    });
  });
});
