import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTerminalFromRequest } from '@/lib/terminal-auth';

export async function POST(req: NextRequest) {
  const payload = await getTerminalFromRequest(req);
  if (!payload) return NextResponse.json({ message: 'Token inválido' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { ip, appVersion } = body;

    await prisma.$transaction([
      prisma.terminalHeartbeat.create({
        data: { terminalId: payload.sub, ip: ip || null, appVersion: appVersion || null },
      }),
      prisma.terminal.update({
        where: { id: payload.sub },
        data: { lastSeenAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao registrar heartbeat:', error);
    return NextResponse.json({ message: 'Erro ao registrar heartbeat' }, { status: 500 });
  }
}
