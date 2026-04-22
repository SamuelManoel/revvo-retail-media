import { NextRequest, NextResponse } from 'next/server';
import { getTerminalFromRequest } from '@/lib/terminal-auth';
import { getProductByEan } from '@/lib/tenant-db';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ ean: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const payload = await getTerminalFromRequest(req);
  if (!payload) return NextResponse.json({ message: 'Token inválido' }, { status: 401 });

  const terminal = await prisma.terminal.findUnique({
    where: { id: payload.sub },
    select: { isActive: true, isBlocked: true, storeId: true },
  });

  if (!terminal || !terminal.isActive || terminal.isBlocked) {
    return NextResponse.json({ message: 'Terminal inativo ou bloqueado' }, { status: 403 });
  }

  if (!terminal.storeId) {
    return NextResponse.json({ message: 'Terminal sem loja vinculada' }, { status: 404 });
  }

  const { ean } = await params;

  try {
    const product = await getProductByEan(terminal.storeId, ean);
    if (!product) return NextResponse.json({ message: 'Produto não encontrado' }, { status: 404 });
    return NextResponse.json(product);
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    return NextResponse.json({ message: 'Erro ao buscar produto' }, { status: 500 });
  }
}
