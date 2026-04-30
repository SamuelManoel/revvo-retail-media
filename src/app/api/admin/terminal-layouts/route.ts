import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EMPTY_FOUND, EMPTY_IDLE, EMPTY_NOT_FOUND } from '@/lib/terminal-layout/EMPTY';

// GET /api/admin/terminal-layouts — lista todos (master)
export async function GET() {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const layouts = await prisma.terminalLayout.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { stores: true } } },
  });
  return NextResponse.json(layouts);
}

// POST /api/admin/terminal-layouts — cria novo
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  try {
    const body = await req.json();
    const { name, description, configFound, configNotFound, configIdle, isActive, thumbnailUrl } = body;

    if (!name?.trim()) {
      return NextResponse.json({ message: 'Nome obrigatório' }, { status: 400 });
    }

    const layout = await prisma.terminalLayout.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        configFound: configFound ?? EMPTY_FOUND,
        configNotFound: configNotFound ?? EMPTY_NOT_FOUND,
        configIdle: configIdle ?? EMPTY_IDLE,
        isActive: isActive ?? true,
        thumbnailUrl: thumbnailUrl ?? null,
      },
    });

    return NextResponse.json(layout, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar layout:', error);
    return NextResponse.json({ message: 'Erro ao criar layout' }, { status: 500 });
  }
}
