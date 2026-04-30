import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import type { SessionPayload } from '@/lib/auth';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'revvo-smart-price-secret-change-in-production'
);

// Rotas que só o master pode acessar
const MASTER_ONLY_PATHS = ['/empresas', '/api/companies', '/licencas'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Passa livre: assets, login, auth, rotas públicas de terminal (Bearer auth própria)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/logout') ||
    pathname.startsWith('/api/terminal/') ||
    pathname === '/api/config' ||           // config global pública (lida pelo app sem auth)
    pathname === '/' ||
    pathname === '/login'
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('revvo_session')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  let session: SessionPayload;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    session = payload as unknown as SessionPayload;
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete('revvo_session');
    return res;
  }

  // Bloqueia rotas master-only para usuários comuns
  const isMasterRoute = MASTER_ONLY_PATHS.some((p) => pathname.startsWith(p));
  if (isMasterRoute && !session.isMaster) {
    // API → 403, página → redireciona para dashboard
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
