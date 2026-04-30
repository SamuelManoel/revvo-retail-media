import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/terminal-layouts — lista layouts ativos disponíveis para escolha (qualquer usuário autenticado)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const layouts = await prisma.terminalLayout.findMany({
    where: { isActive: true, isPublic: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      thumbnailUrl: true,
      configFound: true,
      configNotFound: true,
      configIdle: true,
    },
  });
  return NextResponse.json(layouts);
}
