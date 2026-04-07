import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return NextResponse.json({ message: 'Não encontrada' }, { status: 404 });

  if (!session.isMaster && notification.companyId !== session.companyId) {
    return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return NextResponse.json({ message: 'Não encontrada' }, { status: 404 });

  if (!session.isMaster && notification.companyId !== session.companyId) {
    return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
  }

  await prisma.notification.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
