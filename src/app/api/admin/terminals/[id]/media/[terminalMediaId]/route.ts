import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string; terminalMediaId: string }> };

async function resolveTM(terminalId: string, tmId: string, companyId: string, isMaster: boolean) {
  const terminal = await prisma.terminal.findUnique({ where: { id: terminalId } });
  if (!terminal) return null;
  if (!isMaster && terminal.companyId !== companyId) return null;
  const tm = await prisma.terminalMedia.findUnique({
    where: { id: tmId },
    include: { media: true },
  });
  if (!tm || tm.terminalId !== terminalId) return null;
  return tm;
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id, terminalMediaId } = await params;

  const tm = await resolveTM(id, terminalMediaId, session.companyId, session.isMaster);
  if (!tm) return NextResponse.json({ message: 'Vínculo não encontrado' }, { status: 404 });

  try {
    const body = await req.json();
    const { startsAt, endsAt, campaignId } = body;

    const updated = await prisma.terminalMedia.update({
      where: { id: terminalMediaId },
      data: {
        ...(startsAt !== undefined && { startsAt: startsAt ? new Date(startsAt) : null }),
        ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
        ...(campaignId !== undefined && { campaignId: campaignId || null }),
      },
      include: { media: true, campaign: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar vínculo:', error);
    return NextResponse.json({ message: 'Erro ao atualizar vínculo' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id, terminalMediaId } = await params;

  const tm = await resolveTM(id, terminalMediaId, session.companyId, session.isMaster);
  if (!tm) return NextResponse.json({ message: 'Vínculo não encontrado' }, { status: 404 });

  const mediaId = tm.mediaId;

  await prisma.terminalMedia.delete({ where: { id: terminalMediaId } });

  // Apaga a mídia do DB e do storage se não estiver vinculada a nenhum outro terminal
  const remaining = await prisma.terminalMedia.count({ where: { mediaId } });
  if (remaining === 0) {
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (media) {
      await supabaseAdmin.storage.from(media.bucket).remove([media.path]);
      await prisma.media.delete({ where: { id: mediaId } });
    }
  }

  return NextResponse.json({ message: 'Mídia removida com sucesso' });
}
