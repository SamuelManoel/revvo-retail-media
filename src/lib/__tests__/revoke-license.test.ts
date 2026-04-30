import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── vi.hoisted: variáveis disponíveis antes do hoisting de vi.mock ─────────
const {
  mockTerminalFindUnique,
  mockTransaction,
  mockTerminalUpdate,
  mockCredentialUpdate,
  mockActivationUpdate,
  mockStoreLicenseFindUnique,
  mockStoreLicenseUpdate,
  mockActivationCodeHistoryCreate,
} = vi.hoisted(() => ({
  mockTerminalFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
  mockTerminalUpdate: vi.fn(),
  mockCredentialUpdate: vi.fn(),
  mockActivationUpdate: vi.fn(),
  mockStoreLicenseFindUnique: vi.fn(),
  mockStoreLicenseUpdate: vi.fn(),
  mockActivationCodeHistoryCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    terminal: { findUnique: mockTerminalFindUnique },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/terminal-auth', () => ({
  generateActivationCode: vi.fn().mockResolvedValue('NEWCODE1'),
}));

import { revokeTerminalLicense } from '../revoke-license';

// ── Factories ───────────────────────────────────────────────────────────────
const TERMINAL_ID = 'terminal-uuid-001';
const USER_ID = 'user-uuid-001';
const COMPANY_ID = 'company-uuid-001';
const STORE_ID = 'store-uuid-001';

function makeTerminal(overrides: Record<string, unknown> = {}) {
  return {
    id: TERMINAL_ID,
    companyId: COMPANY_ID,
    storeId: STORE_ID,
    isActive: true,
    isBlocked: false,
    activationCode: 'OLDCODE1',
    credential: { id: 'cred-1', status: 'ACTIVE', token: 'some.jwt.token' },
    activations: [{ id: 'act-1', activatedAt: new Date() }],
    ...overrides,
  };
}

// ── Testes ─────────────────────────────────────────────────────────────────
describe('revokeTerminalLicense', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Por padrão a transação executa o callback imediatamente
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        terminal: { update: mockTerminalUpdate },
        terminalCredential: { update: mockCredentialUpdate },
        terminalActivation: { update: mockActivationUpdate },
        storeLicense: {
          findUnique: mockStoreLicenseFindUnique,
          update: mockStoreLicenseUpdate,
        },
        activationCodeHistory: { create: mockActivationCodeHistoryCreate },
      };
      return callback(tx);
    });

    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal());

    mockTerminalUpdate.mockResolvedValue({});
    mockCredentialUpdate.mockResolvedValue({});
    mockActivationUpdate.mockResolvedValue({});
    mockStoreLicenseFindUnique.mockResolvedValue({ storeId: STORE_ID, quantityUsed: 2 });
    mockStoreLicenseUpdate.mockResolvedValue({});
  });

  it('retorna ok=false quando terminal não existe', async () => {
    mockTerminalFindUnique.mockReset();
    mockTerminalFindUnique.mockResolvedValueOnce(null);
    const result = await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toBe('Terminal não encontrado');
  });

  it('retorna ok=false quando usuário não-master tenta revogar terminal de outra empresa', async () => {
    mockTerminalFindUnique.mockReset();
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ companyId: 'outra-empresa' }));
    const result = await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toBe('Acesso não autorizado');
  });

  it('master pode revogar terminal de outra empresa', async () => {
    mockTerminalFindUnique.mockReset();
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ companyId: 'outra-empresa' }));
    const result = await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, true);
    expect(result.ok).toBe(true);
  });

  it('retorna ok=false quando terminal já está inativo', async () => {
    mockTerminalFindUnique.mockReset();
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ isActive: false }));
    const result = await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toBe('Terminal já está inativo');
  });

  it('revogação bem-sucedida retorna ok=true com newActivationCode e licenseFreed=true', async () => {
    const result = await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.terminalId).toBe(TERMINAL_ID);
      expect(result.newActivationCode).toBe('NEWCODE1');
      expect(result.licenseFreed).toBe(true);
    }
  });

  it('atualiza terminal com isActive=false, isBlocked=true e novo activationCode', async () => {
    await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(mockTerminalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TERMINAL_ID },
        data: expect.objectContaining({
          isActive: false,
          isBlocked: true,
          activationCode: 'NEWCODE1',
          revokedBy: USER_ID,
        }),
      })
    );
  });

  it('revoga credencial do terminal na transação', async () => {
    await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(mockCredentialUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { terminalId: TERMINAL_ID },
        data: expect.objectContaining({ status: 'REVOKED' }),
      })
    );
  });

  it('marca última ativação como REVOKED', async () => {
    await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(mockActivationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act-1' },
        data: expect.objectContaining({ status: 'REVOKED', revokedBy: USER_ID }),
      })
    );
  });

  it('decrementa quantityUsed da licença quando terminal tem storeId', async () => {
    const result = await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(mockStoreLicenseUpdate).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.licenseFreed).toBe(true);
  });

  it('licenseFreed=false quando terminal não tem storeId', async () => {
    mockTerminalFindUnique.mockReset();
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ storeId: null }));
    const result = await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.licenseFreed).toBe(false);
    expect(mockStoreLicenseUpdate).not.toHaveBeenCalled();
  });

  it('não tenta decrementar quando licença não existe para a loja', async () => {
    mockStoreLicenseFindUnique.mockResolvedValueOnce(null);
    const result = await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.licenseFreed).toBe(false);
  });

  it('não decrementa quando quantityUsed já é 0', async () => {
    mockStoreLicenseFindUnique.mockResolvedValueOnce({ storeId: STORE_ID, quantityUsed: 0 });
    const result = await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.licenseFreed).toBe(false);
    expect(mockStoreLicenseUpdate).not.toHaveBeenCalled();
  });

  it('não atualiza credencial quando terminal não tem credential', async () => {
    mockTerminalFindUnique.mockReset();
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ credential: null }));
    await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(mockCredentialUpdate).not.toHaveBeenCalled();
  });

  it('não atualiza ativação quando terminal não tem ativações', async () => {
    mockTerminalFindUnique.mockReset();
    mockTerminalFindUnique.mockResolvedValueOnce(makeTerminal({ activations: [] }));
    await revokeTerminalLicense(TERMINAL_ID, USER_ID, COMPANY_ID, false);
    expect(mockActivationUpdate).not.toHaveBeenCalled();
  });
});
