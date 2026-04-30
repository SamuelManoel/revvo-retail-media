import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

async function resolveTerminal(id: string, companyId: string, isMaster: boolean) {
  const terminal = await prisma.terminal.findUnique({ where: { id } });
  if (!terminal) return null;
  if (!isMaster && terminal.companyId !== companyId) return null;
  return terminal;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const terminal = await resolveTerminal(id, session.companyId, session.isMaster);
  if (!terminal) return NextResponse.json({ message: 'Terminal não encontrado' }, { status: 404 });

  if (!terminal.isMediaDisplay) {
    return NextResponse.json({ message: 'Terminal não é do tipo mídia' }, { status: 400 });
  }

  const terminalMedias = await prisma.terminalMedia.findMany({
    where: { terminalId: id },
    orderBy: { order: 'asc' },
    include: { media: true, campaign: { select: { id: true, name: true } } },
  });

  return NextResponse.json(terminalMedias);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const terminal = await resolveTerminal(id, session.companyId, session.isMaster);
  if (!terminal) return NextResponse.json({ message: 'Terminal não encontrado' }, { status: 404 });

  if (!terminal.isMediaDisplay) {
    return NextResponse.json({ message: 'Terminal não é do tipo mídia' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { mediaId, startsAt, endsAt, campaignId, duration } = body;

    if (!mediaId) return NextResponse.json({ message: 'mediaId é obrigatório' }, { status: 400 });

    // Validar que a mídia pertence à mesma company
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return NextResponse.json({ message: 'Mídia não encontrada' }, { status: 404 });
    if (!session.isMaster && media.companyId && media.companyId !== session.companyId) {
      return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
    }

    // Pegar a maior ordem atual
    const maxOrder = await prisma.terminalMedia.findFirst({
      where: { terminalId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    // Imagem usa duração (default 10s, range 3–300); vídeo toca o tempo do arquivo (null)
    const isImage = media.type === 'image';
    let resolvedDuration: number | null = null;
    if (isImage) {
      const raw = typeof duration === 'number' ? duration : 10;
      resolvedDuration = Math.min(300, Math.max(3, Math.round(raw)));
    }

    const terminalMedia = await prisma.terminalMedia.create({
      data: {
        terminalId: id,
        mediaId,
        order: (maxOrder?.order ?? -1) + 1,
        duration: resolvedDuration,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        campaignId: campaignId || null,
      },
      include: { media: true, terminal: { select: { id: true, name: true } }, campaign: { select: { id: true, name: true } } },
    });

    // Audit log when media is linked to a campaign
    if (campaignId) {
      await prisma.campaignLog.create({
        data: {
          campaignId,
          action:      'media_added',
          description: `Mídia "${terminalMedia.media.fileName}" adicionada no terminal "${terminalMedia.terminal.name}"`,
          userId:      session.userId,
          userName:    session.name,
        },
      });
    }

    return NextResponse.json(terminalMedia, { status: 201 });
  } catch (error) {
    const e = error as { code?: string };
    if (e?.code === 'P2002') {
      return NextResponse.json({ message: 'Mídia já vinculada a este terminal nesta campanha' }, { status: 409 });
    }
    console.error('Erro ao vincular mídia:', error);
    return NextResponse.json({ message: 'Erro ao vincular mídia' }, { status: 500 });
  }
}
