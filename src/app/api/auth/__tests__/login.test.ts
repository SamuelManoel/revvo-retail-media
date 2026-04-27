import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

// ── vi.hoisted ─────────────────────────────────────────────────────────────
const { mockCompanyFindUnique, mockUserFindUnique, mockCreateSession } = vi.hoisted(() => ({
  mockCompanyFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockCreateSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    company: { findUnique: mockCompanyFindUnique },
    user: { findUnique: mockUserFindUnique },
  },
}));

vi.mock('@/lib/auth', () => ({
  createSession: mockCreateSession,
  MASTER_COMPANY_SLUG: 'revvo',
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { POST } from '@/app/api/auth/login/route';

// ── Factories ──────────────────────────────────────────────────────────────
const HASHED_PASSWORD = bcrypt.hashSync('senha123', 4);

function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: 'company-001',
    name: 'Empresa Teste',
    slug: 'empresa-teste',
    conta: 'empresa-teste',
    status: 'ATIVO',
    ...overrides,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-001',
    name: 'Usuário Teste',
    email: 'usuario@teste.com',
    password: HASHED_PASSWORD,
    isActive: true,
    ...overrides,
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Testes ─────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompanyFindUnique.mockResolvedValue(makeCompany());
    mockUserFindUnique.mockResolvedValue(makeUser());
    mockCreateSession.mockResolvedValue(undefined);
  });

  describe('validação de campos obrigatórios', () => {
    it('retorna 400 quando conta está ausente', async () => {
      const res = await POST(makeRequest({ email: 'a@a.com', password: '123' }));
      expect(res.status).toBe(400);
    });

    it('retorna 400 quando email está ausente', async () => {
      const res = await POST(makeRequest({ conta: 'x', password: '123' }));
      expect(res.status).toBe(400);
    });

    it('retorna 400 quando password está ausente', async () => {
      const res = await POST(makeRequest({ conta: 'x', email: 'a@a.com' }));
      expect(res.status).toBe(400);
    });
  });

  describe('validação da empresa', () => {
    it('retorna 401 quando conta não existe', async () => {
      mockCompanyFindUnique.mockResolvedValueOnce(null);
      const res = await POST(makeRequest({ conta: 'inexistente', email: 'a@a.com', password: '123' }));
      expect(res.status).toBe(401);
    });

    it('retorna 403 quando empresa está INATIVA', async () => {
      mockCompanyFindUnique.mockResolvedValueOnce(makeCompany({ status: 'INATIVO' }));
      const res = await POST(makeRequest({ conta: 'empresa-teste', email: 'a@a.com', password: '123' }));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toMatch(/inativa/i);
    });
  });

  describe('validação do usuário', () => {
    it('retorna 401 quando usuário não existe na empresa', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);
      const res = await POST(makeRequest({ conta: 'empresa-teste', email: 'naoexiste@a.com', password: '123' }));
      expect(res.status).toBe(401);
    });

    it('retorna 403 quando usuário está inativo', async () => {
      mockUserFindUnique.mockResolvedValueOnce(makeUser({ isActive: false }));
      const res = await POST(makeRequest({ conta: 'empresa-teste', email: 'usuario@teste.com', password: 'senha123' }));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toMatch(/inativo/i);
    });
  });

  describe('verificação de senha', () => {
    it('retorna 401 quando senha está errada', async () => {
      const res = await POST(makeRequest({ conta: 'empresa-teste', email: 'usuario@teste.com', password: 'senha_errada' }));
      expect(res.status).toBe(401);
    });

    it('retorna 200 com dados do usuário quando senha correta', async () => {
      const res = await POST(makeRequest({ conta: 'empresa-teste', email: 'usuario@teste.com', password: 'senha123' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.email).toBe('usuario@teste.com');
      expect(body.user.id).toBe('user-001');
    });

    it('nunca retorna password no response', async () => {
      const res = await POST(makeRequest({ conta: 'empresa-teste', email: 'usuario@teste.com', password: 'senha123' }));
      const body = await res.json();
      expect(JSON.stringify(body)).not.toContain('password');
    });
  });

  describe('criação de sessão', () => {
    it('chama createSession com dados corretos', async () => {
      await POST(makeRequest({ conta: 'empresa-teste', email: 'usuario@teste.com', password: 'senha123' }));
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          companyId: 'company-001',
          email: 'usuario@teste.com',
          isMaster: false,
        })
      );
    });

    it('isMaster=true quando empresa slug é "revvo"', async () => {
      mockCompanyFindUnique.mockResolvedValueOnce(makeCompany({ slug: 'revvo' }));
      await POST(makeRequest({ conta: 'empresa-teste', email: 'usuario@teste.com', password: 'senha123' }));
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ isMaster: true })
      );
    });

    it('isMaster=false para slug diferente de "revvo"', async () => {
      mockCompanyFindUnique.mockResolvedValueOnce(makeCompany({ slug: 'outra-empresa' }));
      await POST(makeRequest({ conta: 'empresa-teste', email: 'usuario@teste.com', password: 'senha123' }));
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ isMaster: false })
      );
    });
  });

  describe('response de sucesso', () => {
    it('retorna dados do usuário e empresa aninhada', async () => {
      const res = await POST(makeRequest({ conta: 'empresa-teste', email: 'usuario@teste.com', password: 'senha123' }));
      const body = await res.json();
      expect(body.user.company.id).toBe('company-001');
      expect(body.user.company.slug).toBe('empresa-teste');
    });
  });
});
