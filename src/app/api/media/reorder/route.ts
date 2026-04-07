import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json() as { items: { id: string; order: number }[] };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: 'Lista de itens inválida' }, { status: 400 });
    }

    await prisma.$transaction(
      items.map(({ id, order }) =>
        prisma.media.update({ where: { id }, data: { order } }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao reordenar mídias:', error);
    return NextResponse.json({ message: 'Erro interno ao reordenar mídias' }, { status: 500 });
  }
}
