import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// GET /api/campaigns/[id]/logs
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;

  // Verify access
  const campaign = await prisma.campaign.findFirst({
    where: session.isMaster ? { id } : { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ message: 'Campanha não encontrada' }, { status: 404 });

  const logs = await prisma.campaignLog.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(logs);
}
