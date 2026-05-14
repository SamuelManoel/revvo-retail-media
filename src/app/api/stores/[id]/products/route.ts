import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  listProducts,
  upsertProduct,
  deleteAllProducts,
} from '@/lib/tenant-db';
import { canonicalizeProductImage, tryFetchProductImageFromCosmos } from '@/lib/cosmos-cache';

type Params = { params: Promise<{ id: string }> };

async function resolveStore(storeId: string, companyId: string, isMaster: boolean) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return null;
  if (!isMaster && store.companyId !== companyId) return null;
  return store;
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '50');
  const q = searchParams.get('q') ?? undefined;
  const sortBy = searchParams.get('sortBy') ?? undefined;
  const sortOrder = (searchParams.get('sortOrder') ?? undefined) as 'asc' | 'desc' | undefined;
  const hasPreco1 = searchParams.get('hasPreco1') === 'true';
  const hasPreco2 = searchParams.get('hasPreco2') === 'true';
  const hasPreco3 = searchParams.get('hasPreco3') === 'true';

  try {
    const result = await listProducts(id, { page, limit, q, sortBy, sortOrder, hasPreco1, hasPreco2, hasPreco3 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    return NextResponse.json({ message: 'Erro ao listar produtos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  try {
    const body = await req.json();
    const { ean, produto, preco1, preco2, preco3, codigoProduto, imageUrl, status } = body;

    if (!ean || !produto || preco1 === undefined) {
      return NextResponse.json(
        { message: 'Campos obrigatórios: ean, produto, preco1' },
        { status: 400 }
      );
    }

    const { product, created } = await upsertProduct(id, {
      ean,
      produto,
      preco1: Number(preco1),
      preco2: preco2 !== undefined ? Number(preco2) : null,
      preco3: preco3 !== undefined ? Number(preco3) : null,
      codigoProduto: codigoProduto ?? null,
      imageUrl: imageUrl ?? null,
      status: status !== undefined ? Boolean(status) : undefined,
    });

    // Garante que a imagem fique no path canônico `product-images/{ean}.{ext}`
    // (compartilhado entre tenants). Síncrono — o proxy weserv cacheia, então
    // chamadas seguintes com o mesmo EAN são rápidas.
    if (!product.image_url) {
      const cosmosUrl = await tryFetchProductImageFromCosmos(id, product.ean);
      if (cosmosUrl) product.image_url = cosmosUrl;
    } else if (!product.image_url.includes(`/product-images/${product.ean}.`)) {
      const canonical = await canonicalizeProductImage({
        storeId: id,
        ean: product.ean,
        sourceUrl: product.image_url,
      });
      if (canonical) product.image_url = canonical;
    }

    return NextResponse.json(product, { status: created ? 201 : 200 });
  } catch (error) {
    console.error('Erro ao salvar produto:', error);
    return NextResponse.json({ message: 'Erro ao salvar produto' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  try {
    const count = await deleteAllProducts(id);
    return NextResponse.json({ message: `${count} produto(s) removido(s)` });
  } catch (error) {
    console.error('Erro ao limpar catálogo:', error);
    return NextResponse.json({ message: 'Erro ao limpar catálogo' }, { status: 500 });
  }
}
