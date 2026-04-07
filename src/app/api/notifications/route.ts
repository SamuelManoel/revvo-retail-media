import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const where = session.isMaster ? {} : { companyId: session.companyId };
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(notifications);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const body = await req.json();
  const { title, body: msgBody, type = 'info', actionLabel, actionUrl, companyId } = body;

  if (!title || !msgBody) {
    return NextResponse.json({ message: 'title e body são obrigatórios' }, { status: 400 });
  }

  // Non-master can only create for their own company
  const targetCompanyId = session.isMaster && companyId ? companyId : session.companyId;

  const notification = await prisma.notification.create({
    data: { title, body: msgBody, type, actionLabel: actionLabel ?? null, actionUrl: actionUrl ?? null, companyId: targetCompanyId },
  });

  return NextResponse.json(notification, { status: 201 });
}
