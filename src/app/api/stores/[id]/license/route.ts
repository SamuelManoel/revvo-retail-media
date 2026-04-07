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

  const license = await prisma.storeLicense.findUnique({
    where: { storeId: id },
    include: {
      renewals: { orderBy: { createdAt: 'desc' } },
    },
  });

  return NextResponse.json(license);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  if (!session.isMaster) return NextResponse.json({ message: 'Acesso restrito ao master' }, { status: 403 });
  const { id } = await params;

  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  const existing = await prisma.storeLicense.findUnique({ where: { storeId: id } });
  if (existing) return NextResponse.json({ message: 'Loja já possui licença' }, { status: 409 });

  try {
    const body = await req.json();
    const { quantityTotal, startsAt, expiresAt } = body;

    if (!quantityTotal || !startsAt || !expiresAt) {
      return NextResponse.json({ message: 'Campos obrigatórios: quantityTotal, startsAt, expiresAt' }, { status: 400 });
    }

    const license = await prisma.storeLicense.create({
      data: {
        storeId: id,
        quantityTotal: Number(quantityTotal),
        startsAt: new Date(startsAt),
        expiresAt: new Date(expiresAt),
        status: 'active',
      },
      include: { renewals: true },
    });

    return NextResponse.json(license, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar licença:', error);
    return NextResponse.json({ message: 'Erro ao criar licença' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  if (!session.isMaster) return NextResponse.json({ message: 'Acesso restrito ao master' }, { status: 403 });
  const { id } = await params;

  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  const license = await prisma.storeLicense.findUnique({ where: { storeId: id } });
  if (!license) return NextResponse.json({ message: 'Loja não possui licença' }, { status: 404 });

  try {
    await prisma.storeLicense.delete({ where: { storeId: id } });
    return NextResponse.json({ message: 'Licença removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover licença:', error);
    return NextResponse.json({ message: 'Erro ao remover licença' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  if (!session.isMaster) return NextResponse.json({ message: 'Acesso restrito ao master' }, { status: 403 });
  const { id } = await params;

  const store = await resolveStore(id, session.companyId, session.isMaster);
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  const license = await prisma.storeLicense.findUnique({ where: { storeId: id } });
  if (!license) return NextResponse.json({ message: 'Loja não possui licença' }, { status: 404 });

  try {
    const body = await req.json();
    const { newExpiresAt, addQuantity, removeQuantity, status } = body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;

    if (newExpiresAt) {
      updateData.expiresAt = new Date(newExpiresAt);
      if (new Date(newExpiresAt) > new Date()) updateData.status = 'active';
    }

    if (addQuantity && Number(addQuantity) > 0) {
      updateData.quantityTotal = license.quantityTotal + Number(addQuantity);
    }

    if (removeQuantity && Number(removeQuantity) > 0) {
      const newTotal = license.quantityTotal - Number(removeQuantity);
      if (newTotal < license.quantityUsed) {
        return NextResponse.json(
          { message: `Não é possível reduzir abaixo do uso atual (${license.quantityUsed})` },
          { status: 422 },
        );
      }
      updateData.quantityTotal = Math.max(newTotal, 1);
    }

    const [updated] = await prisma.$transaction([
      prisma.storeLicense.update({ where: { storeId: id }, data: updateData }),
      ...(newExpiresAt || addQuantity
        ? [prisma.licenseRenewal.create({
            data: {
              storeLicenseId: license.id,
              previousExpiresAt: license.expiresAt,
              newExpiresAt: newExpiresAt ? new Date(newExpiresAt) : license.expiresAt,
              addedQuantity: Number(addQuantity ?? 0),
            },
          })]
        : []),
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao renovar licença:', error);
    return NextResponse.json({ message: 'Erro ao renovar licença' }, { status: 500 });
  }
}
