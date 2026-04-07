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

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  const integration = await prisma.storeIntegration.findUnique({ where: { storeId: id } });
  return NextResponse.json(integration ?? null);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  try {
    const body = await req.json();
    const {
      baseUrl, token,
      endpointProductByEan, endpointCatalog,
      endpointFullLoad, endpointIncremental,
      isActive,
    } = body;

    if (!baseUrl) return NextResponse.json({ message: 'baseUrl é obrigatório' }, { status: 400 });

    const data = {
      baseUrl,
      token: token ?? null,
      endpointProductByEan: endpointProductByEan ?? '/terminal/product/{ean}',
      endpointCatalog: endpointCatalog ?? '/terminal/product',
      endpointFullLoad: endpointFullLoad ?? null,
      endpointIncremental: endpointIncremental ?? null,
      isActive: isActive ?? true,
    };

    const integration = await prisma.storeIntegration.upsert({
      where: { storeId: id },
      create: { storeId: id, ...data },
      update: data,
    });

    return NextResponse.json(integration);
  } catch (error) {
    console.error('Erro ao salvar integração:', error);
    return NextResponse.json({ message: 'Erro ao salvar integração' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  await prisma.storeIntegration.deleteMany({ where: { storeId: id } });
  return NextResponse.json({ message: 'Integração removida' });
}
