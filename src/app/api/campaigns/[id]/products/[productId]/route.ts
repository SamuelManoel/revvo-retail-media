import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string; productId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id, productId } = await params;
  const where = session.isMaster ? { id } : { id, companyId: session.companyId };
  const campaign = await prisma.campaign.findFirst({ where, select: { id: true } });
  if (!campaign) return NextResponse.json({ message: 'Campanha não encontrada' }, { status: 404 });

  const cp = await prisma.campaignProduct.findUnique({
    where: { id: productId },
    select: { id: true, campaignId: true, ean: true, productName: true },
  });
  if (!cp || cp.campaignId !== campaign.id) {
    return NextResponse.json({ message: 'Produto não encontrado nesta campanha' }, { status: 404 });
  }

  await prisma.campaignProduct.delete({ where: { id: productId } });

  await prisma.campaignLog.create({
    data: {
      campaignId:  campaign.id,
      action:      'updated',
      description: `Produto removido: "${cp.productName}" (EAN ${cp.ean})`,
      userId:      session.userId,
      userName:    session.name,
    },
  });

  return NextResponse.json({ ok: true });
}
