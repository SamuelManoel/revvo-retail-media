import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string; productId: string }> };

async function resolveProduct(storeId: string, productId: string, companyId: string, isMaster: boolean) {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId },
    include: { store: { select: { companyId: true } } },
  });
  if (!product) return null;
  if (!isMaster && product.store.companyId !== companyId) return null;
  return product;
}

// PATCH /api/stores/:id/products/:productId
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id, productId } = await params;

  const product = await resolveProduct(id, productId, session.companyId, session.isMaster);
  if (!product) return NextResponse.json({ message: 'Produto não encontrado' }, { status: 404 });

  try {
    const body = await req.json();
    const { ean, name, price, offerPrice, clubPrice, stock, imageUrl, isActive, description } = body;

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(ean !== undefined && { ean: String(ean) }),
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price }),
        ...(offerPrice !== undefined && { offerPrice: offerPrice ?? null }),
        ...(clubPrice !== undefined && { clubPrice: clubPrice ?? null }),
        ...(stock !== undefined && { stock: stock ?? null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl ?? null }),
        ...(isActive !== undefined && { isActive }),
        ...(description !== undefined && { description: description ?? null }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    return NextResponse.json({ message: 'Erro ao atualizar produto' }, { status: 500 });
  }
}

// DELETE /api/stores/:id/products/:productId
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id, productId } = await params;

  const product = await resolveProduct(id, productId, session.companyId, session.isMaster);
  if (!product) return NextResponse.json({ message: 'Produto não encontrado' }, { status: 404 });

  await prisma.product.delete({ where: { id: productId } });
  return NextResponse.json({ message: 'Produto removido' });
}
