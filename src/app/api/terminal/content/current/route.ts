import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTerminalFromRequest } from '@/lib/terminal-auth';

export async function GET(req: NextRequest) {
  const payload = await getTerminalFromRequest(req);
  if (!payload) return NextResponse.json({ message: 'Token inválido' }, { status: 401 });

  try {
    const terminal = await prisma.terminal.findUnique({
      where: { id: payload.sub },
      include: {
        store: {
          select: {
            terminalLayout: {
              select: {
                id: true, name: true,
                configFound: true, configNotFound: true, configIdle: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });
    if (!terminal || terminal.isBlocked) {
      return NextResponse.json({ medias: [], priceCheckerLayout: null });
    }

    const priceCheckerLayout = terminal.isPriceChecker
      ? (terminal.store?.terminalLayout ?? null)
      : null;

    if (!terminal.isMediaDisplay) {
      return NextResponse.json({ medias: [], priceCheckerLayout });
    }

    const now = new Date();

    // Filtra mídias avulsas (sem campanha) ou cuja campanha está ativa e dentro da janela.
    const terminalMedias = await prisma.terminalMedia.findMany({
      where: {
        terminalId: payload.sub,
        OR: [
          { campaignId: null },
          {
            campaign: {
              isActive: true,
              startsAt: { lte: now },
              endsAt: { gte: now },
            },
          },
        ],
      },
      orderBy: { order: 'asc' },
      include: { media: true },
    });

    return NextResponse.json({
      medias: terminalMedias.map((tm) => {
        const started = tm.startsAt == null || tm.startsAt <= now;
        const notEnded = tm.endsAt == null || tm.endsAt >= now;
        const expired = tm.endsAt != null && tm.endsAt < now;
        const active = started && notEnded;
        return {
          terminalMediaId: tm.id,
          order: tm.order,
          duration: tm.duration, // segundos para imagens; null para vídeos (toca até o fim)
          startsAt: tm.startsAt,
          endsAt: tm.endsAt,
          active,
          expired,
          media: {
            id: tm.media.id,
            url: tm.media.url,
            type: tm.media.type,
            fileName: tm.media.fileName,
            mimeType: tm.media.mimeType,
          },
        };
      }),
      priceCheckerLayout,
    });
  } catch (error) {
    console.error('Erro ao buscar conteúdo:', error);
    return NextResponse.json({ message: 'Erro ao buscar conteúdo' }, { status: 500 });
  }
}
