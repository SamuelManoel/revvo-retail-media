import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const terminal = await prisma.terminal.findUnique({ where: { id } });
  if (!terminal) return NextResponse.json({ message: 'Terminal não encontrado' }, { status: 404 });
  if (!session.isMaster && terminal.companyId !== session.companyId) {
    return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
  }

  try {
    const { items } = await req.json() as { items: { id: string; order: number }[] };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: 'Lista de itens inválida' }, { status: 400 });
    }

    await prisma.$transaction(
      items.map(({ id: tmId, order }) =>
        prisma.terminalMedia.update({
          where: { id: tmId },
          data: { order },
        }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao reordenar mídias:', error);
    return NextResponse.json({ message: 'Erro ao reordenar mídias' }, { status: 500 });
  }
}
