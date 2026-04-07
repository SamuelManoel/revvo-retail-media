import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTerminalFromRequest } from '@/lib/terminal-auth';

type Params = { params: Promise<{ ean: string }> };

// GET /api/terminal/product/:ean
export async function GET(req: NextRequest, { params }: Params) {
  const payload = await getTerminalFromRequest(req);
  if (!payload) return NextResponse.json({ message: 'Token inválido' }, { status: 401 });

  const { ean } = await params;

  const terminal = await prisma.terminal.findUnique({
    where: { id: payload.sub },
    select: { storeId: true, isBlocked: true, isActive: true },
  });

  if (!terminal || !terminal.isActive || terminal.isBlocked) {
    return NextResponse.json({ message: 'Terminal inativo ou bloqueado' }, { status: 403 });
  }

  if (!terminal.storeId) {
    return NextResponse.json({ message: 'Produto não encontrado' }, { status: 404 });
  }

  const product = await prisma.product.findFirst({
    where: { storeId: terminal.storeId, ean, isActive: true },
    select: {
      id: true, ean: true, name: true, imageUrl: true, description: true,
      price: true, offerPrice: true, clubPrice: true,
      stock: true, updatedAt: true,
    },
  });

  if (!product) {
    return NextResponse.json({ message: 'Produto não encontrado' }, { status: 404 });
  }

  return NextResponse.json(product);
}
