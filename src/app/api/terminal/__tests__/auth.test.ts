import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── vi.hoisted ─────────────────────────────────────────────────────────────
const {
  mockTerminalFindUnique,
  mockLicenseFindUnique,
  mockCredentialUpsert,
} = vi.hoisted(() => ({
  mockTerminalFindUnique: vi.fn(),
  mockLicenseFindUnique: vi.fn(),
  mockCredentialUpsert: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    terminal: { findUnique: mockTerminalFindUnique },
    storeLicense: { findUnique: mockLicenseFindUnique },
    terminalCredential: { upsert: mockCredentialUpsert },
  },
}));

import { POST } from '@/app/api/terminal/auth/route';

// ── Factories ──────────────────────────────────────────────────────────────
const STORE_ID = 'store-uuid-001';
const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
const pastDate = new Date(Date.now() - 1000);

function makeTerminal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'terminal-uuid-001',
    companyId: 'company-uuid-001',
    storeId: STORE_ID,
    activationCode: 'ABCD1234',
    isActive: true,
    isBlocked: false,
    ...overrides,
  };
}

function makeLicense(overrides: Record<string, unknown> = {}) {
  return {
    storeId: STORE_ID,
    status: 'active',
    expiresAt: futureDate,
    ...overrides,
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/terminal/auth', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Testes ─────────────────────────────────────────────────────────────────
describe('POST /api/terminal/auth (re-autenticação)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCredentialUpsert.mockResolvedValue({});
  });

  it('retorna 400 quando activationCode não é fornecido', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('retorna 404 quando terminal não existe', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ activationCode: 'INVALIDO' }));
    expect(res.status).toBe(404);
  });

  it('retorna 404 quando terminal não está ativo (isActive=false)', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ isActive: false }));
    const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
    expect(res.status).toBe(404);
  });

  it('retorna 403 quando terminal está bloqueado', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ isBlocked: true }));
    const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/bloqueado/i);
  });

  describe('verificação de licença na re-autenticação (regra 8.2)', () => {
    it('retorna 403 quando licença não existe', async () => {
      mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
      mockLicenseFindUnique.mockResolvedValueOnce(null);

      const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
      expect(res.status).toBe(403);
    });

    it('retorna 403 quando status da licença não é "active"', async () => {
      mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
      mockLicenseFindUnique.mockResolvedValueOnce(makeLicense({ status: 'suspended' }));

      const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
      expect(res.status).toBe(403);
    });

    it('retorna 403 quando licença está expirada (data passada)', async () => {
      mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
      mockLicenseFindUnique.mockResolvedValueOnce(makeLicense({ expiresAt: pastDate }));

      const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
      expect(res.status).toBe(403);
    });

    it('não verifica licença quando terminal não tem storeId', async () => {
      mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ storeId: null }));
      const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
      expect(mockLicenseFindUnique).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });

  describe('re-autenticação bem-sucedida', () => {
    beforeEach(() => {
      mockTerminalFindUnique.mockResolvedValue(makeTerminal());
      mockLicenseFindUnique.mockResolvedValue(makeLicense());
    });

    it('retorna 200 com novo token', async () => {
      const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(typeof body.token).toBe('string');
    });

    it('token é um JWT válido (3 partes)', async () => {
      const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
      const body = await res.json();
      expect(body.token.split('.')).toHaveLength(3);
    });

    it('atualiza credencial via upsert com status ACTIVE', async () => {
      await POST(makeRequest({ activationCode: 'ABCD1234' }));
      expect(mockCredentialUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { terminalId: 'terminal-uuid-001' },
          update: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );
    });

    it('normaliza activationCode para uppercase', async () => {
      await POST(makeRequest({ activationCode: 'abcd1234' }));
      expect(mockTerminalFindUnique).toHaveBeenCalledWith({
        where: { activationCode: 'ABCD1234' },
      });
    });
  });
});
