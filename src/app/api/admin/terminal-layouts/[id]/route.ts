import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/terminal-layouts/:id
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const { id } = await params;
  const layout = await prisma.terminalLayout.findUnique({
    where: { id },
    include: { _count: { select: { stores: true } } },
  });
  if (!layout) return NextResponse.json({ message: 'Layout não encontrado' }, { status: 404 });
  return NextResponse.json(layout);
}

// PATCH /api/admin/terminal-layouts/:id
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, description, configFound, configNotFound, configIdle, isActive, thumbnailUrl } = body;

  try {
    const layout = await prisma.terminalLayout.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(configFound !== undefined && { configFound }),
        ...(configNotFound !== undefined && { configNotFound }),
        ...(configIdle !== undefined && { configIdle }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl: thumbnailUrl ?? null }),
      },
    });
    return NextResponse.json(layout);
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === 'P2025') return NextResponse.json({ message: 'Layout não encontrado' }, { status: 404 });
    console.error('Erro ao atualizar layout:', error);
    return NextResponse.json({ message: 'Erro ao atualizar layout' }, { status: 500 });
  }
}

// DELETE /api/admin/terminal-layouts/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const { id } = await params;

  // Conta lojas que usam o layout — só impede se houver
  const inUse = await prisma.store.count({ where: { terminalLayoutId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { message: `Não é possível excluir: ${inUse} loja(s) usam esse layout` },
      { status: 409 }
    );
  }

  try {
    await prisma.terminalLayout.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === 'P2025') return NextResponse.json({ message: 'Layout não encontrado' }, { status: 404 });
    console.error('Erro ao deletar layout:', error);
    return NextResponse.json({ message: 'Erro ao deletar layout' }, { status: 500 });
  }
}
