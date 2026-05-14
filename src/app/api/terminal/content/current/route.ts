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

    // Slots de mídia OU slots de oferta cuja campanha está ativa.
    // Oferta entra na playlist como se fosse uma imagem (a `renderedImageUrl`).
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
      include: {
        media: true,
        offer: {
          select: {
            id: true, name: true, kind: true, isActive: true,
            renderedImageUrl: true, renderedAt: true,
            layout: { select: { orientation: true } },
          },
        },
      },
    });

    return NextResponse.json({
      medias: terminalMedias
        .map((tm) => {
          const started = tm.startsAt == null || tm.startsAt <= now;
          const notEnded = tm.endsAt == null || tm.endsAt >= now;
          const expired = tm.endsAt != null && tm.endsAt < now;
          const active = started && notEnded;

          // Slot de mídia normal
          if (tm.media) {
            const m = tm.media;
            return {
              terminalMediaId: tm.id,
              order: tm.order,
              duration: tm.duration,
              enterAnimation: tm.enterAnimation,
              startsAt: tm.startsAt,
              endsAt: tm.endsAt,
              active,
              expired,
              source: 'media' as const,
              media: {
                id: m.id, url: m.url, type: m.type, fileName: m.fileName, mimeType: m.mimeType,
              },
            };
          }

          // Slot de oferta — só entra se está renderizado e ativo
          if (tm.offer && tm.offer.isActive && tm.offer.renderedImageUrl) {
            return {
              terminalMediaId: tm.id,
              order: tm.order,
              duration: tm.duration ?? 10, // ofertas são imagens; default 10s
              enterAnimation: tm.enterAnimation,
              startsAt: tm.startsAt,
              endsAt: tm.endsAt,
              active,
              expired,
              source: 'offer' as const,
              offer: {
                id: tm.offer.id,
                name: tm.offer.name,
                kind: tm.offer.kind,
                renderedAt: tm.offer.renderedAt,
                orientation: tm.offer.layout.orientation,
              },
              // Mantém a forma `media` pra compat — o app trata como imagem comum.
              media: {
                id: `offer-${tm.offer.id}`,
                url: tm.offer.renderedImageUrl,
                type: 'image',
                fileName: `${tm.offer.name}.png`,
                mimeType: 'image/png',
              },
            };
          }

          // Slot inválido (oferta sem render ou desativada) — omite
          return null;
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
      priceCheckerLayout,
    });
  } catch (error) {
    console.error('Erro ao buscar conteúdo:', error);
    return NextResponse.json({ message: 'Erro ao buscar conteúdo' }, { status: 500 });
  }
}
