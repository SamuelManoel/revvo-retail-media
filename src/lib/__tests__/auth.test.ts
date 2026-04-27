import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, getSession, destroySession, MASTER_COMPANY_SLUG } from '../auth';

// ── vi.hoisted garante que as variáveis existem antes do hoisting de vi.mock ─
const { mockSet, mockGet, mockDelete } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockGet: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: mockSet,
    get: mockGet,
    delete: mockDelete,
  }),
}));

const VALID_PAYLOAD = {
  userId: 'user-uuid-001',
  companyId: 'company-uuid-001',
  name: 'Samuel Teste',
  email: 'samuel@teste.com',
  isMaster: false,
};

// ── MASTER_COMPANY_SLUG ───────────────────────────────────────────────────
describe('MASTER_COMPANY_SLUG', () => {
  it('tem valor padrão "revvo" quando variável de ambiente não está definida', () => {
    expect(MASTER_COMPANY_SLUG).toBe('revvo');
  });
});

// ── createSession ─────────────────────────────────────────────────────────
describe('createSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama cookies().set com o cookie correto', async () => {
    await createSession(VALID_PAYLOAD);
    expect(mockSet).toHaveBeenCalledWith(
      'revvo_session',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 8,
        path: '/',
      })
    );
  });

  it('o token gerado é um JWT de 3 partes', async () => {
    await createSession(VALID_PAYLOAD);
    const token: string = mockSet.mock.calls[0][1];
    expect(token.split('.')).toHaveLength(3);
  });

  it('token é uma string JWT válida', async () => {
    await createSession(VALID_PAYLOAD);
    const token: string = mockSet.mock.calls[0][1];
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });
});

// ── getSession ─────────────────────────────────────────────────────────────
describe('getSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna null quando cookie não existe', async () => {
    mockGet.mockReturnValueOnce(undefined);
    const session = await getSession();
    expect(session).toBeNull();
  });

  it('retorna null para token inválido', async () => {
    mockGet.mockReturnValueOnce({ value: 'token.invalido.aqui' });
    const session = await getSession();
    expect(session).toBeNull();
  });

  it('retorna payload correto para token válido', async () => {
    // Cria token real
    await createSession(VALID_PAYLOAD);
    const token: string = mockSet.mock.calls[0][1];
    vi.clearAllMocks();

    mockGet.mockReturnValueOnce({ value: token });
    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session!.userId).toBe(VALID_PAYLOAD.userId);
    expect(session!.companyId).toBe(VALID_PAYLOAD.companyId);
    expect(session!.email).toBe(VALID_PAYLOAD.email);
    expect(session!.isMaster).toBe(false);
  });

  it('retorna null para token de outra chave secreta', async () => {
    const { SignJWT } = await import('jose');
    const WRONG_SECRET = new TextEncoder().encode('chave-errada');
    const badToken = await new SignJWT({ userId: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(WRONG_SECRET);

    mockGet.mockReturnValueOnce({ value: badToken });
    const session = await getSession();
    expect(session).toBeNull();
  });

  it('preserva flag isMaster=true', async () => {
    await createSession({ ...VALID_PAYLOAD, isMaster: true });
    const token: string = mockSet.mock.calls[0][1];
    vi.clearAllMocks();

    mockGet.mockReturnValueOnce({ value: token });
    const session = await getSession();
    expect(session!.isMaster).toBe(true);
  });
});

// ── destroySession ────────────────────────────────────────────────────────
describe('destroySession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama cookies().delete com o nome correto do cookie', async () => {
    await destroySession();
    expect(mockDelete).toHaveBeenCalledWith('revvo_session');
  });
});
