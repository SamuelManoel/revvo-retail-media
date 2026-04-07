import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTerminalFromRequest } from '@/lib/terminal-auth';

export async function GET(req: NextRequest) {
  const payload = await getTerminalFromRequest(req);
  if (!payload) return NextResponse.json({ message: 'Token inválido' }, { status: 401 });

  try {
    const terminal = await prisma.terminal.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        location: true,
        isPriceChecker: true,
        isMediaDisplay: true,
        isBlocked: true,
      },
    });

    if (!terminal || terminal.isBlocked) {
      return NextResponse.json({ message: 'Terminal inativo ou bloqueado' }, { status: 403 });
    }

    const config = await prisma.configuration.findFirst();

    return NextResponse.json({
      terminalId: terminal.id,
      name: terminal.name,
      location: terminal.location,
      isPriceChecker: terminal.isPriceChecker,
      isMediaDisplay: terminal.isMediaDisplay,
      resetTime: config?.resetTime ?? 30,
    });
  } catch (error) {
    console.error('Erro ao buscar config:', error);
    return NextResponse.json({ message: 'Erro ao buscar config' }, { status: 500 });
  }
}
