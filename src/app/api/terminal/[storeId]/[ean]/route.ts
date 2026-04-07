import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ storeId: string; ean: string }> };

// GET /api/terminal/:storeId/:ean
// Endpoint público por loja — não exige Bearer token.
// O UUID da loja funciona como identificador de acesso.
export async function GET(_req: NextRequest, { params }: Params) {
  const { storeId, ean } = await params;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true },
  });

  if (!store) {
    return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });
  }

  const product = await prisma.product.findFirst({
    where: { storeId, ean, isActive: true },
    select: {
      id: true,
      ean: true,
      name: true,
      imageUrl: true,
      description: true,
      price: true,
      offerPrice: true,
      clubPrice: true,
      stock: true,
      updatedAt: true,
    },
  });

  if (!product) {
    return NextResponse.json({ message: 'Produto não encontrado' }, { status: 404 });
  }

  return NextResponse.json(product);
}
