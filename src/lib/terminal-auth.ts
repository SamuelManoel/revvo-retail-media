import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';

const SECRET = new TextEncoder().encode(
  process.env.TERMINAL_JWT_SECRET ?? process.env.JWT_SECRET ?? 'revvo-terminal-secret-change-in-production'
);

const EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type TerminalTokenPayload = {
  sub: string;        // terminalId
  companyId: string;
  storeId: string | null;
  type: 'terminal';
};

export function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function generateTerminalToken(payload: Omit<TerminalTokenPayload, 'type'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'terminal' } as TerminalTokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setExpirationTime(`${EXPIRES_IN_SECONDS}s`)
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifyTerminalToken(token: string): Promise<TerminalTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const p = payload as unknown as TerminalTokenPayload;
    if (p.type !== 'terminal') return null;
    return p;
  } catch {
    return null;
  }
}

/**
 * Valida o Bearer JWT e verifica no DB que a credencial não foi revogada.
 * Retorna null se o token for inválido, expirado ou se a credencial estiver REVOKED.
 */
export async function getTerminalFromRequest(req: NextRequest): Promise<TerminalTokenPayload | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);

  const payload = await verifyTerminalToken(token);
  if (!payload) return null;

  // Verificação de revogação no DB — impede JWTs de terminais revogados
  try {
    const credential = await prisma.terminalCredential.findUnique({
      where: { terminalId: payload.sub },
      select: { status: true, token: true },
    });
    // Credencial removida, revogada, ou token diferente do atual
    if (!credential || credential.status === 'REVOKED' || credential.token !== token) {
      return null;
    }
  } catch {
    // Se DB estiver fora do ar, nega acesso por segurança
    return null;
  }

  return payload;
}
