import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

const INCLUDE = {
  company: { select: { id: true, name: true } },
  license: {
    select: {
      id: true, quantityTotal: true, quantityUsed: true,
      startsAt: true, expiresAt: true, status: true,
    },
  },
  _count: { select: { terminals: true } },
} as const;

async function resolveStore(id: string, companyId: string, isMaster: boolean) {
  const store = await prisma.store.findUnique({ where: { id }, include: INCLUDE });
  if (!store) return null;
  if (!isMaster && store.companyId !== companyId) return null;
  return store;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;
  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });
  return NextResponse.json(store);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const existing = await resolveStore(id, session.companyId, session.isMaster);
  if (!existing) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  try {
    const body = await req.json();
    const { name, address } = body;
    const updated = await prisma.store.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
      },
      include: INCLUDE,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao editar loja:', error);
    return NextResponse.json({ message: 'Erro ao editar loja' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const existing = await resolveStore(id, session.companyId, session.isMaster);
  if (!existing) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  try {
    await prisma.store.delete({ where: { id } });
    return NextResponse.json({ message: 'Loja removida com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar loja:', error);
    return NextResponse.json({ message: 'Erro ao deletar loja' }, { status: 500 });
  }
}
