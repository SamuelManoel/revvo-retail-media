import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTerminalFromRequest } from '@/lib/terminal-auth';

export async function GET(req: NextRequest) {
  const payload = await getTerminalFromRequest(req);
  if (!payload) return NextResponse.json({ message: 'Token inválido' }, { status: 401 });

  try {
    const terminal = await prisma.terminal.findUnique({ where: { id: payload.sub } });
    if (!terminal || terminal.isBlocked || !terminal.isMediaDisplay) {
      return NextResponse.json({ medias: [] });
    }

    const now = new Date();

    const terminalMedias = await prisma.terminalMedia.findMany({
      where: { terminalId: payload.sub },
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
    });
  } catch (error) {
    console.error('Erro ao buscar conteúdo:', error);
    return NextResponse.json({ message: 'Erro ao buscar conteúdo' }, { status: 500 });
  }
}
