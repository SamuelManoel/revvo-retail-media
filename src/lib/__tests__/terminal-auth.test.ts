import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateActivationCode, generateTerminalToken, verifyTerminalToken, getTerminalFromRequest } from '../terminal-auth';
import { NextRequest } from 'next/server';

// ── Mock do Prisma ──────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    terminalCredential: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
const mockPrisma = prisma as unknown as {
  terminalCredential: { findUnique: ReturnType<typeof vi.fn> };
};

// ── generateActivationCode ─────────────────────────────────────────────────
describe('generateActivationCode', () => {
  it('gera código com 8 caracteres', () => {
    const code = generateActivationCode();
    expect(code).toHaveLength(8);
  });

  it('gera código apenas com caracteres permitidos (sem 0, O, I, 1)', () => {
    const ALLOWED = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
    const FORBIDDEN = /[0OI1]/;

    for (let i = 0; i < 100; i++) {
      const code = generateActivationCode();
      expect(ALLOWED.test(code)).toBe(true);
      expect(FORBIDDEN.test(code)).toBe(false);
    }
  });

  it('gera códigos variados (não é constante)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateActivationCode()));
    expect(codes.size).toBeGreaterThan(1);
  });

  it('retorna somente letras maiúsculas e dígitos', () => {
    const code = generateActivationCode();
    expect(code).toMatch(/^[A-Z2-9]+$/);
  });
});

// ── generateTerminalToken / verifyTerminalToken ────────────────────────────
describe('generateTerminalToken + verifyTerminalToken', () => {
  const payload = {
    sub: 'terminal-uuid-123',
    companyId: 'company-uuid-456',
    storeId: 'store-uuid-789',
  };

  it('gera token válido e verificável', async () => {
    const token = await generateTerminalToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT format
  });

  it('verifica e retorna payload correto', async () => {
    const token = await generateTerminalToken(payload);
    const result = await verifyTerminalToken(token);

    expect(result).not.toBeNull();
    expect(result!.sub).toBe(payload.sub);
    expect(result!.companyId).toBe(payload.companyId);
    expect(result!.storeId).toBe(payload.storeId);
    expect(result!.type).toBe('terminal');
  });

  it('retorna null para token inválido', async () => {
    const result = await verifyTerminalToken('token.invalido.aqui');
    expect(result).toBeNull();
  });

  it('retorna null para token com tipo errado (web session)', async () => {
    // Simula um token assinado pelo mesmo secret mas sem type=terminal
    const { SignJWT } = await import('jose');
    const SECRET = new TextEncoder().encode(
      process.env.TERMINAL_JWT_SECRET ?? process.env.JWT_SECRET ?? 'revvo-terminal-secret-change-in-production'
    );
    const badToken = await new SignJWT({ sub: 'x', type: 'web' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(SECRET);

    const result = await verifyTerminalToken(badToken);
    expect(result).toBeNull();
  });

  it('funciona com storeId nulo', async () => {
    const token = await generateTerminalToken({ sub: 't1', companyId: 'c1', storeId: null });
    const result = await verifyTerminalToken(token);
    expect(result!.storeId).toBeNull();
  });
});

// ── getTerminalFromRequest ─────────────────────────────────────────────────
describe('getTerminalFromRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna null quando Authorization header está ausente', async () => {
    const req = new NextRequest('http://localhost/api/test');
    const result = await getTerminalFromRequest(req);
    expect(result).toBeNull();
  });

  it('retorna null quando Authorization não começa com Bearer', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: 'Basic abc123' },
    });
    const result = await getTerminalFromRequest(req);
    expect(result).toBeNull();
  });

  it('retorna null para token Bearer inválido', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: 'Bearer token.invalido.aqui' },
    });
    const result = await getTerminalFromRequest(req);
    expect(result).toBeNull();
  });

  it('retorna null se credencial não existe no banco', async () => {
    const token = await generateTerminalToken({ sub: 't1', companyId: 'c1', storeId: null });
    mockPrisma.terminalCredential.findUnique.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await getTerminalFromRequest(req);
    expect(result).toBeNull();
  });

  it('retorna null se credencial está REVOKED', async () => {
    const token = await generateTerminalToken({ sub: 't1', companyId: 'c1', storeId: null });
    mockPrisma.terminalCredential.findUnique.mockResolvedValueOnce({
      status: 'REVOKED',
      token,
    });

    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await getTerminalFromRequest(req);
    expect(result).toBeNull();
  });

  it('retorna null se o token no banco é diferente (token antigo após reautenticação)', async () => {
    const token = await generateTerminalToken({ sub: 't1', companyId: 'c1', storeId: null });
    mockPrisma.terminalCredential.findUnique.mockResolvedValueOnce({
      status: 'ACTIVE',
      token: 'outro.token.diferente',
    });

    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await getTerminalFromRequest(req);
    expect(result).toBeNull();
  });

  it('retorna payload válido quando tudo está correto', async () => {
    const token = await generateTerminalToken({ sub: 't1', companyId: 'c1', storeId: 's1' });
    mockPrisma.terminalCredential.findUnique.mockResolvedValueOnce({
      status: 'ACTIVE',
      token,
    });

    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await getTerminalFromRequest(req);

    expect(result).not.toBeNull();
    expect(result!.sub).toBe('t1');
    expect(result!.companyId).toBe('c1');
    expect(result!.storeId).toBe('s1');
  });

  it('nega acesso (fail-closed) se o banco lançar exceção', async () => {
    const token = await generateTerminalToken({ sub: 't1', companyId: 'c1', storeId: null });
    mockPrisma.terminalCredential.findUnique.mockRejectedValueOnce(new Error('DB unavailable'));

    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await getTerminalFromRequest(req);
    expect(result).toBeNull();
  });
});
