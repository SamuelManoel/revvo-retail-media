import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTerminalFromRequest } from '@/lib/terminal-auth';

// GET /api/terminal/layout — retorna o layout configurado para a loja do terminal
export async function GET(req: NextRequest) {
  const payload = await getTerminalFromRequest(req);
  if (!payload) return NextResponse.json({ message: 'Token inválido' }, { status: 401 });

  const terminal = await prisma.terminal.findUnique({
    where: { id: payload.sub },
    select: {
      isBlocked: true,
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
    return NextResponse.json({ message: 'Terminal inativo ou bloqueado' }, { status: 403 });
  }

  const layout = terminal.store?.terminalLayout;

  if (!layout) {
    return NextResponse.json({
      id: null, name: 'default',
      configFound: '', configNotFound: '', configIdle: '',
      updatedAt: null,
    });
  }

  return NextResponse.json(layout);
}
