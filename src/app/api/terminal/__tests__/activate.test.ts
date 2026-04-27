import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── vi.hoisted ─────────────────────────────────────────────────────────────
const {
  mockTerminalFindUnique,
  mockCredentialUpsert,
  mockTransaction,
  mockCheckLicense,
} = vi.hoisted(() => ({
  mockTerminalFindUnique: vi.fn(),
  mockCredentialUpsert: vi.fn(),
  mockTransaction: vi.fn(),
  mockCheckLicense: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    terminal: { findUnique: mockTerminalFindUnique },
    terminalCredential: { upsert: mockCredentialUpsert },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/license', () => ({
  checkLicenseAvailable: mockCheckLicense,
}));

import { POST } from '@/app/api/terminal/activate/route';

// ── Factories ──────────────────────────────────────────────────────────────
function makeTerminal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'terminal-uuid-001',
    name: 'Terminal 01',
    activationCode: 'ABCD1234',
    companyId: 'company-uuid-001',
    storeId: 'store-uuid-001',
    isActive: false,
    isBlocked: false,
    isPriceChecker: true,
    isMediaDisplay: false,
    ...overrides,
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/terminal/activate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Testes ─────────────────────────────────────────────────────────────────
describe('POST /api/terminal/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckLicense.mockResolvedValue({ ok: true });
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        terminalActivation: { create: vi.fn() },
        terminal: { update: vi.fn() },
        storeLicense: { update: vi.fn() },
      };
      return callback(tx);
    });
    mockCredentialUpsert.mockResolvedValue({});
  });

  it('retorna 400 quando activationCode não é fornecido', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/activationCode/i);
  });

  it('retorna 404 quando código de ativação não existe', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ activationCode: 'INVALIDO' }));
    expect(res.status).toBe(404);
  });

  it('retorna 403 quando terminal está bloqueado', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ isBlocked: true }));
    const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/bloqueado/i);
  });

  it('retorna 422 quando licença da loja não está disponível', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
    mockCheckLicense.mockResolvedValueOnce({ ok: false, reason: 'Limite de terminais atingido.' });

    const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.message).toMatch(/limite/i);
  });

  it('não verifica licença quando terminal não tem storeId', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ storeId: null }));
    const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
    expect(mockCheckLicense).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('normaliza activationCode para uppercase', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
    await POST(makeRequest({ activationCode: 'abcd1234' }));
    expect(mockTerminalFindUnique).toHaveBeenCalledWith({
      where: { activationCode: 'ABCD1234' },
    });
  });

  it('retorna 200 com token e dados do terminal na ativação bem-sucedida', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
    const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.terminalId).toBe('terminal-uuid-001');
    expect(body.name).toBe('Terminal 01');
    expect(body.isPriceChecker).toBe(true);
    expect(body.isMediaDisplay).toBe(false);
  });

  it('token retornado é um JWT válido (3 partes)', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
    const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
    const body = await res.json();
    expect(body.token.split('.')).toHaveLength(3);
  });

  it('salva credencial via upsert com status ACTIVE', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
    await POST(makeRequest({ activationCode: 'ABCD1234' }));

    expect(mockCredentialUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { terminalId: 'terminal-uuid-001' },
        create: expect.objectContaining({ status: 'ACTIVE' }),
        update: expect.objectContaining({ status: 'ACTIVE' }),
      })
    );
  });

  it('executa transação atômica após salvar credencial', async () => {
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
    await POST(makeRequest({ activationCode: 'ABCD1234' }));
    expect(mockTransaction).toHaveBeenCalled();
  });

  describe('verificações de licença (regra 6.3)', () => {
    it('retorna 422 quando status da licença não é "active"', async () => {
      mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
      mockCheckLicense.mockResolvedValueOnce({ ok: false, reason: 'Licença suspensa ou inativa.' });
      const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
      expect(res.status).toBe(422);
    });

    it('retorna 422 quando licença está expirada', async () => {
      mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());
      mockCheckLicense.mockResolvedValueOnce({ ok: false, reason: 'Licença expirada.' });
      const res = await POST(makeRequest({ activationCode: 'ABCD1234' }));
      expect(res.status).toBe(422);
    });
  });
});
