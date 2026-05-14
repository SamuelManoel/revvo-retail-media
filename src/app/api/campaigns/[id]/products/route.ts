import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getProductByEan } from '@/lib/tenant-db';

type Params = { params: Promise<{ id: string }> };

/**
 * Lista os produtos vinculados à campanha (snapshots).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const where = session.isMaster ? { id } : { id, companyId: session.companyId };
  const campaign = await prisma.campaign.findFirst({ where, select: { id: true } });
  if (!campaign) return NextResponse.json({ message: 'Campanha não encontrada' }, { status: 404 });

  const products = await prisma.campaignProduct.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: 'asc' },
    include: { store: { select: { id: true, name: true } } },
  });
  return NextResponse.json(products);
}

/**
 * Adiciona um produto à campanha. Body: { storeId, ean }.
 * Faz snapshot dos preços/nome a partir da tabela tenant<store>.products.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const where = session.isMaster ? { id } : { id, companyId: session.companyId };
  const campaign = await prisma.campaign.findFirst({ where });
  if (!campaign) return NextResponse.json({ message: 'Campanha não encontrada' }, { status: 404 });

  const body = await req.json();
  const { storeId, ean } = body ?? {};
  if (!storeId || !ean) {
    return NextResponse.json({ message: 'storeId e ean são obrigatórios' }, { status: 400 });
  }

  // Valida acesso à loja
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, companyId: true, name: true },
  });
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });
  if (!session.isMaster && store.companyId !== session.companyId) {
    return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
  }

  // Busca produto no tenant
  const tenantProduct = await getProductByEan(storeId, String(ean).trim());
  if (!tenantProduct) {
    return NextResponse.json({ message: `Produto com EAN ${ean} não encontrado em ${store.name}` }, { status: 404 });
  }

  try {
    const created = await prisma.campaignProduct.create({
      data: {
        campaignId: campaign.id,
        storeId: store.id,
        productId: tenantProduct.id,
        ean: tenantProduct.ean,
        productName: tenantProduct.produto,
        preco1: tenantProduct.preco1 ? tenantProduct.preco1 : null,
        preco2: tenantProduct.preco2 ?? null,
        preco3: tenantProduct.preco3 ?? null,
        imageUrl: tenantProduct.image_url ?? null,
      },
      include: { store: { select: { id: true, name: true } } },
    });

    await prisma.campaignLog.create({
      data: {
        campaignId: campaign.id,
        action:      'updated',
        description: `Produto adicionado: "${created.productName}" (EAN ${created.ean})`,
        userId:      session.userId,
        userName:    session.name,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') {
      return NextResponse.json({ message: 'Esse produto já está na campanha' }, { status: 409 });
    }
    console.error('Erro ao adicionar produto à campanha:', e);
    return NextResponse.json({ message: 'Erro ao adicionar produto' }, { status: 500 });
  }
}
