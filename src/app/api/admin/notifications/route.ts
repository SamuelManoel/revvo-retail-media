import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/notifications — lista todas as notificações (master)
export async function GET() {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { company: { select: { id: true, name: true } } },
  });

  return NextResponse.json(notifications);
}

// POST /api/admin/notifications — cria notificação (master)
// body: { title, body, type, actionLabel?, actionUrl?, companyId: string | 'all' }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const body = await req.json();
  const { title, body: msgBody, type = 'info', actionLabel, actionUrl, companyId } = body;

  if (!title?.trim() || !msgBody?.trim()) {
    return NextResponse.json({ message: 'Título e mensagem são obrigatórios' }, { status: 400 });
  }

  // "all" → cria uma notificação por empresa tenant ativa
  if (companyId === 'all') {
    const companies = await prisma.company.findMany({
      where: { type: 'tenant' },
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: companies.map((c) => ({
        title, body: msgBody, type,
        actionLabel: actionLabel || null,
        actionUrl:   actionUrl   || null,
        companyId:   c.id,
      })),
    });

    return NextResponse.json({ sent: companies.length }, { status: 201 });
  }

  const notification = await prisma.notification.create({
    data: {
      title, body: msgBody, type,
      actionLabel: actionLabel || null,
      actionUrl:   actionUrl   || null,
      companyId:   companyId   || null,
    },
    include: { company: { select: { id: true, name: true } } },
  });

  return NextResponse.json(notification, { status: 201 });
}
