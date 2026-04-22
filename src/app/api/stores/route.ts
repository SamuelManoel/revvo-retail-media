import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createStoreSchema } from '@/lib/tenant-db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  try {
    const where = session.isMaster ? {} : { companyId: session.companyId };
    const stores = await prisma.store.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        license: {
          select: {
            id: true, quantityTotal: true, quantityUsed: true,
            startsAt: true, expiresAt: true, status: true,
          },
        },
        _count: { select: { terminals: true } },
      },
    });
    return NextResponse.json(stores);
  } catch (error) {
    console.error('Erro ao listar lojas:', error);
    return NextResponse.json({ message: 'Erro ao listar lojas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, address, companyId: bodyCompanyId } = body;

    if (!name) {
      return NextResponse.json({ message: 'Nome é obrigatório' }, { status: 400 });
    }

    // Master pode criar para qualquer company; non-master só para a própria
    const targetCompanyId = session.isMaster && bodyCompanyId ? bodyCompanyId : session.companyId;

    if (!session.isMaster) {
      if (bodyCompanyId && bodyCompanyId !== session.companyId) {
        return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
      }
    }

    const company = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (!company) return NextResponse.json({ message: 'Empresa não encontrada' }, { status: 404 });

    const store = await prisma.store.create({
      data: { name, address: address || null, companyId: targetCompanyId },
      include: {
        company: { select: { id: true, name: true } },
        license: true,
        _count: { select: { terminals: true } },
      },
    });

    await createStoreSchema(store.id);

    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar loja:', error);
    return NextResponse.json({ message: 'Erro ao criar loja' }, { status: 500 });
  }
}
