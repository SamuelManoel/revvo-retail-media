import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const CAMPAIGN_INCLUDE = {
  store:    { select: { id: true, name: true } },
  terminal: { select: { id: true, name: true } },
  terminalMedias: {
    orderBy: { order: 'asc' as const },
    include: {
      media:    { select: { id: true, url: true, fileName: true, mimeType: true, type: true, size: true } },
      terminal: { select: { id: true, name: true } },
    },
  },
};

// GET /api/campaigns
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const storeId = req.nextUrl.searchParams.get('storeId') ?? undefined;

  const where = {
    ...(session.isMaster ? {} : { companyId: session.companyId }),
    ...(storeId ? { storeId } : {}),
  };

  const campaigns = await prisma.campaign.findMany({
    where,
    orderBy: { startsAt: 'desc' },
    include: CAMPAIGN_INCLUDE,
  });

  return NextResponse.json(campaigns);
}

// POST /api/campaigns
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const body = await req.json();
  const { name, startsAt, endsAt, storeId, terminalId, thumbnail } = body;

  if (!name?.trim() || !startsAt || !endsAt) {
    return NextResponse.json({ message: 'name, startsAt e endsAt são obrigatórios' }, { status: 400 });
  }

  const companyId = session.companyId;

  if (storeId) {
    const storeWhere = session.isMaster ? { id: storeId } : { id: storeId, companyId };
    const store = await prisma.store.findFirst({ where: storeWhere, select: { id: true } });
    if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: name.trim(),
      startsAt:   new Date(startsAt),
      endsAt:     new Date(endsAt),
      companyId,
      storeId:    storeId    || null,
      terminalId: terminalId || null,
      thumbnail:  thumbnail  || null,
    },
    include: CAMPAIGN_INCLUDE,
  });

  // Audit log
  await prisma.campaignLog.create({
    data: {
      campaignId:  campaign.id,
      action:      'created',
      description: `Campanha criada: "${campaign.name}"`,
      userId:      session.userId,
      userName:    session.name,
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
