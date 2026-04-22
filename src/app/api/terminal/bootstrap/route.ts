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
        store: { select: { id: true, name: true, address: true } },
        company: { select: { id: true, name: true } },
      },
    });

    if (!terminal || terminal.isBlocked) {
      return NextResponse.json({ message: 'Terminal inativo ou bloqueado' }, { status: 403 });
    }

    const config = await prisma.configuration.findFirst();

    return NextResponse.json({
      terminal: {
        id: terminal.id,
        name: terminal.name,
        location: terminal.location,
        isPriceChecker: terminal.isPriceChecker,
        isMediaDisplay: terminal.isMediaDisplay,
      },
      store: terminal.store,
      company: terminal.company,
      config: { resetTime: config?.resetTime ?? 30 },
      endpoints: {
        productByEan: '/api/terminal/product/{ean}',
      },
    });
  } catch (error) {
    console.error('Erro ao buscar bootstrap:', error);
    return NextResponse.json({ message: 'Erro ao buscar bootstrap' }, { status: 500 });
  }
}
