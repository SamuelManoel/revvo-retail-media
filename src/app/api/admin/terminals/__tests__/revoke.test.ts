import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── vi.hoisted ─────────────────────────────────────────────────────────────
const { mockGetSession, mockRevokeTerminalLicense } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRevokeTerminalLicense: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSession: mockGetSession }));
vi.mock('@/lib/revoke-license', () => ({ revokeTerminalLicense: mockRevokeTerminalLicense }));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { POST } from '@/app/api/admin/terminals/[id]/revoke/route';

// ── Factories ──────────────────────────────────────────────────────────────
function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-001',
    companyId: 'company-001',
    name: 'Admin',
    email: 'admin@teste.com',
    isMaster: false,
    ...overrides,
  };
}

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/terminals/terminal-001/revoke', { method: 'POST' });
}

function makeParams(id = 'terminal-001') {
  return { params: Promise.resolve({ id }) };
}

// ── Testes ─────────────────────────────────────────────────────────────────
describe('POST /api/admin/terminals/[id]/revoke', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 401 quando não há sessão', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('retorna 404 quando terminal não encontrado', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession());
    mockRevokeTerminalLicense.mockResolvedValueOnce({ ok: false, reason: 'Terminal não encontrado' });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Terminal não encontrado');
  });

  it('retorna 403 quando usuário não tem acesso', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession());
    mockRevokeTerminalLicense.mockResolvedValueOnce({ ok: false, reason: 'Acesso não autorizado' });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it('retorna 422 quando terminal já está inativo', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession());
    mockRevokeTerminalLicense.mockResolvedValueOnce({ ok: false, reason: 'Terminal já está inativo' });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(422);
  });

  it('retorna 200 com dados de revogação bem-sucedida', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession());
    mockRevokeTerminalLicense.mockResolvedValueOnce({
      ok: true,
      terminalId: 'terminal-001',
      newActivationCode: 'NEWCODE1',
      licenseFreed: true,
    });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.terminalId).toBe('terminal-001');
    expect(body.newActivationCode).toBe('NEWCODE1');
    expect(body.licenseFreed).toBe(true);
    expect(body.message).toBe('Terminal revogado com sucesso');
  });

  it('passa userId, companyId e isMaster da sessão para revokeTerminalLicense', async () => {
    const session = makeSession({ userId: 'user-abc', companyId: 'company-xyz', isMaster: false });
    mockGetSession.mockResolvedValueOnce(session);
    mockRevokeTerminalLicense.mockResolvedValueOnce({
      ok: true, terminalId: 'terminal-001', newActivationCode: 'X', licenseFreed: false,
    });

    await POST(makeRequest(), makeParams('terminal-001'));

    expect(mockRevokeTerminalLicense).toHaveBeenCalledWith(
      'terminal-001', 'user-abc', 'company-xyz', false
    );
  });

  it('passa isMaster=true quando sessão é master', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession({ isMaster: true }));
    mockRevokeTerminalLicense.mockResolvedValueOnce({
      ok: true, terminalId: 'terminal-001', newActivationCode: 'X', licenseFreed: true,
    });

    await POST(makeRequest(), makeParams('terminal-001'));

    expect(mockRevokeTerminalLicense).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), expect.any(String), true
    );
  });

  it('licenseFreed=false é retornado quando terminal não tinha storeId', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession());
    mockRevokeTerminalLicense.mockResolvedValueOnce({
      ok: true, terminalId: 'terminal-001', newActivationCode: 'X', licenseFreed: false,
    });

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.licenseFreed).toBe(false);
  });
});
