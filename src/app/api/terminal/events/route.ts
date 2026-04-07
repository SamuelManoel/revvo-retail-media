import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTerminalFromRequest } from '@/lib/terminal-auth';

export async function POST(req: NextRequest) {
  const payload = await getTerminalFromRequest(req);
  if (!payload) return NextResponse.json({ message: 'Token inválido' }, { status: 401 });

  try {
    const body = await req.json();
    const { type, payload: eventPayload } = body;

    if (!type) {
      return NextResponse.json({ message: 'type é obrigatório' }, { status: 400 });
    }

    await prisma.terminalEvent.create({
      data: {
        terminalId: payload.sub,
        type,
        payload: eventPayload ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao registrar evento:', error);
    return NextResponse.json({ message: 'Erro ao registrar evento' }, { status: 500 });
  }
}
