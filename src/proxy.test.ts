import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

// ── Preparação do token de sessão ─────────────────────────────────────────
const SECRET = new TextEncoder().encode('revvo-smart-price-secret-change-in-production');

async function makeSessionToken(payload: Record<string, unknown>, expiresIn = '8h') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(SECRET);
}

// ── Importação do middleware ───────────────────────────────────────────────
// O middleware usa next/server diretamente; importamos após configurar o ambiente
import { proxy as middleware } from './proxy';

// ── Helpers ────────────────────────────────────────────────────────────────
function makeRequest(path: string, cookieToken?: string) {
  const url = `http://localhost${path}`;
  const headers: Record<string, string> = {};
  if (cookieToken) {
    headers['cookie'] = `revvo_session=${cookieToken}`;
  }
  return new NextRequest(url, { headers });
}

// ── Testes ─────────────────────────────────────────────────────────────────
describe('middleware', () => {
  describe('rotas públicas (sem autenticação)', () => {
    it('passa livre para /_next/static', async () => {
      const req = makeRequest('/_next/static/chunks/main.js');
      const res = await middleware(req);
      expect(res.status).not.toBe(302);
    });

    it('passa livre para /login', async () => {
      const req = makeRequest('/login');
      const res = await middleware(req);
      expect(res.status).not.toBe(302);
    });

    it('passa livre para /api/auth/login', async () => {
      const req = makeRequest('/api/auth/login');
      const res = await middleware(req);
      expect(res.status).not.toBe(302);
    });

    it('passa livre para /api/auth/logout', async () => {
      const req = makeRequest('/api/auth/logout');
      const res = await middleware(req);
      expect(res.status).not.toBe(302);
    });

    it('passa livre para /api/terminal/activate', async () => {
      const req = makeRequest('/api/terminal/activate');
      const res = await middleware(req);
      expect(res.status).not.toBe(302);
    });

    it('passa livre para /api/terminal/auth', async () => {
      const req = makeRequest('/api/terminal/auth');
      const res = await middleware(req);
      expect(res.status).not.toBe(302);
    });

    it('passa livre para /', async () => {
      const req = makeRequest('/');
      const res = await middleware(req);
      expect(res.status).not.toBe(302);
    });
  });

  describe('rotas protegidas — sem cookie', () => {
    it('redireciona /dashboard para /login quando sem cookie', async () => {
      const req = makeRequest('/dashboard');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('redireciona /api/users para /login quando sem cookie', async () => {
      const req = makeRequest('/api/users');
      const res = await middleware(req);
      expect(res.status).toBe(307);
    });
  });

  describe('rotas protegidas — cookie inválido', () => {
    it('redireciona e deleta cookie quando token inválido', async () => {
      const req = makeRequest('/dashboard', 'token.invalido.aqui');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });
  });

  describe('rotas protegidas — cookie válido', () => {
    it('passa /dashboard com sessão válida', async () => {
      const token = await makeSessionToken({ userId: 'u1', isMaster: false });
      const req = makeRequest('/dashboard', token);
      const res = await middleware(req);
      expect(res.status).not.toBe(302);
      expect(res.status).not.toBe(307);
    });

    it('passa /api/users com sessão válida', async () => {
      const token = await makeSessionToken({ userId: 'u1', isMaster: false });
      const req = makeRequest('/api/users', token);
      const res = await middleware(req);
      expect(res.status).not.toBe(302);
      expect(res.status).not.toBe(307);
    });
  });

  describe('rotas master-only', () => {
    it('retorna 403 para usuário não-master em /api/companies', async () => {
      const token = await makeSessionToken({ userId: 'u1', isMaster: false });
      const req = makeRequest('/api/companies', token);
      const res = await middleware(req);
      expect(res.status).toBe(403);
    });

    it('redireciona para /dashboard quando não-master acessa /empresas (página)', async () => {
      const token = await makeSessionToken({ userId: 'u1', isMaster: false });
      const req = makeRequest('/empresas', token);
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/dashboard');
    });

    it('master acessa /api/companies sem restrição', async () => {
      const token = await makeSessionToken({ userId: 'u1', isMaster: true });
      const req = makeRequest('/api/companies', token);
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
    });

    it('master acessa /licencas sem restrição', async () => {
      const token = await makeSessionToken({ userId: 'u1', isMaster: true });
      const req = makeRequest('/licencas', token);
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(307);
    });
  });
});
