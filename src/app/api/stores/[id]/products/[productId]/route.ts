import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateProduct, deleteProduct } from '@/lib/tenant-db';

type Params = { params: Promise<{ id: string; productId: string }> };

async function resolveStore(storeId: string, companyId: string, isMaster: boolean) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return null;
  if (!isMaster && store.companyId !== companyId) return null;
  return store;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id, productId } = await params;
  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  try {
    const body = await req.json();
    const { ean, produto, preco1, preco2, preco3, codigoProduto } = body;

    const updated = await updateProduct(id, productId, {
      ...(ean !== undefined && { ean }),
      ...(produto !== undefined && { produto }),
      ...(preco1 !== undefined && { preco1: Number(preco1) }),
      ...(preco2 !== undefined && { preco2: Number(preco2) }),
      ...(preco3 !== undefined && { preco3: Number(preco3) }),
      ...(codigoProduto !== undefined && { codigoProduto }),
    });

    if (!updated) return NextResponse.json({ message: 'Produto não encontrado' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao editar produto:', error);
    return NextResponse.json({ message: 'Erro ao editar produto' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id, productId } = await params;
  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  try {
    const deleted = await deleteProduct(id, productId);
    if (!deleted) return NextResponse.json({ message: 'Produto não encontrado' }, { status: 404 });
    return NextResponse.json({ message: 'Produto removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    return NextResponse.json({ message: 'Erro ao deletar produto' }, { status: 500 });
  }
}
