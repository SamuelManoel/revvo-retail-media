import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

async function resolveStore(id: string, companyId: string, isMaster: boolean) {
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) return null;
  if (!isMaster && store.companyId !== companyId) return null;
  return store;
}

// GET /api/stores/:id/products?page=1&limit=50&q=
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const q = url.searchParams.get('q')?.trim() ?? '';

  const where = {
    storeId: id,
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { ean: { contains: q } },
      ],
    } : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ products, total, page, limit, pages: Math.ceil(total / limit) });
}

// POST /api/stores/:id/products — upsert único
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  try {
    const body = await req.json();
    const { ean, name, price, offerPrice, clubPrice, stock, imageUrl, isActive, externalId, hash, description } = body;

    if (!ean || !name || price === undefined) {
      return NextResponse.json({ message: 'Campos obrigatórios: ean, name, price' }, { status: 400 });
    }

    const data = {
      ean: String(ean),
      name,
      price,
      offerPrice: offerPrice ?? null,
      clubPrice: clubPrice ?? null,
      stock: stock ?? null,
      imageUrl: imageUrl ?? null,
      isActive: isActive ?? true,
      externalId: externalId ? String(externalId) : null,
      hash: hash ?? null,
      description: description ?? null,
    };

    // Upsert por storeId+ean
    const product = await prisma.product.upsert({
      where: { storeId_externalId: { storeId: id, externalId: String(externalId ?? ean) } },
      create: { storeId: id, ...data },
      update: data,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Erro ao salvar produto:', error);
    return NextResponse.json({ message: 'Erro ao salvar produto' }, { status: 500 });
  }
}

// DELETE /api/stores/:id/products — limpa catálogo
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  const { count } = await prisma.product.deleteMany({ where: { storeId: id } });
  return NextResponse.json({ message: `${count} produtos removidos` });
}
