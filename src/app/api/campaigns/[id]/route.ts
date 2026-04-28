import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

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

// PATCH /api/campaigns/[id] — update name, dates, storeId, terminalId
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const where = session.isMaster ? { id } : { id, companyId: session.companyId };

  const existing = await prisma.campaign.findFirst({ where });
  if (!existing) return NextResponse.json({ message: 'Campanha não encontrada' }, { status: 404 });

  const body = await req.json();
  const { name, startsAt, endsAt, storeId, terminalId, thumbnail } = body;

  // Build diff for audit log
  type DiffEntry = { from: string | null; to: string | null };
  const diff: Record<string, DiffEntry> = {};

  const data: Record<string, unknown> = {};

  if (name !== undefined && name.trim() !== existing.name) {
    diff['Nome'] = { from: existing.name, to: name.trim() };
    data.name = name.trim();
  }
  if (startsAt !== undefined) {
    const newDate = new Date(startsAt);
    if (newDate.toISOString() !== existing.startsAt.toISOString()) {
      diff['Data de início'] = {
        from: existing.startsAt.toISOString().slice(0, 10),
        to:   newDate.toISOString().slice(0, 10),
      };
      data.startsAt = newDate;
    }
  }
  if (endsAt !== undefined) {
    const newDate = new Date(endsAt);
    if (newDate.toISOString() !== existing.endsAt.toISOString()) {
      diff['Data de término'] = {
        from: existing.endsAt.toISOString().slice(0, 10),
        to:   newDate.toISOString().slice(0, 10),
      };
      data.endsAt = newDate;
    }
  }
  if (storeId !== undefined && storeId !== existing.storeId) {
    diff['Loja'] = { from: existing.storeId, to: storeId || null };
    data.storeId = storeId || null;
  }
  if (terminalId !== undefined && terminalId !== existing.terminalId) {
    diff['Terminal'] = { from: existing.terminalId, to: terminalId || null };
    data.terminalId = terminalId || null;
  }
  if (thumbnail !== undefined && thumbnail !== existing.thumbnail) {
    diff['Thumbnail'] = { from: existing.thumbnail, to: thumbnail || null };
    data.thumbnail = thumbnail || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: 'Nenhuma alteração detectada' }, { status: 400 });
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data,
    include: CAMPAIGN_INCLUDE,
  });

  // Build human-readable description
  const changes = Object.entries(diff)
    .map(([field, { from, to }]) => `${field}: "${from}" → "${to}"`)
    .join('; ');

  await prisma.campaignLog.create({
    data: {
      campaignId:  id,
      action:      'updated',
      description: `Campanha atualizada — ${changes}`,
      userId:      session.userId,
      userName:    session.name,
      diff,
    },
  });

  return NextResponse.json(campaign);
}

// DELETE /api/campaigns/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const where = session.isMaster ? { id } : { id, companyId: session.companyId };

  try {
    await prisma.campaign.delete({ where });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: 'Campanha não encontrada' }, { status: 404 });
  }
}
