import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: { select: { terminals: true, users: true } },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            createdAt: true,
          },
        },
        terminals: {
          select: {
            id: true,
            name: true,
            ip: true,
            location: true,
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ message: 'Empresa não encontrada' }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error('Erro ao buscar empresa:', error);
    return NextResponse.json({ message: 'Erro ao buscar empresa' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { name, legalName, cnpj, email, slug, conta, status } = body;

    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(legalName !== undefined && { legalName }),
        ...(cnpj !== undefined && { cnpj }),
        ...(email !== undefined && { email }),
        ...(slug !== undefined && { slug }),
        ...(conta !== undefined && { conta }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json(updated);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Erro ao editar empresa:', error);

    if (error?.code === 'P2002') {
      return NextResponse.json(
        { message: 'CNPJ, e-mail, slug ou conta já cadastrado' },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: 'Erro ao editar empresa' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.company.delete({ where: { id } });

    return NextResponse.json({ message: 'Empresa removida com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar empresa:', error);
    return NextResponse.json({ message: 'Erro ao deletar empresa' }, { status: 500 });
  }
}
