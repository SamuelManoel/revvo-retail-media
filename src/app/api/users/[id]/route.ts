import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const session = await getSession();
    const body = await req.json();
    const { name, email, isActive, password, isOwner } = body;

    const data: Record<string, unknown> = {};

    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (isActive !== undefined) data.isActive = isActive;
    if (password !== undefined) {
      data.password = await bcrypt.hash(password, 10);
    }
    // isOwner só pode ser alterado pelo master
    if (isOwner !== undefined && session?.isMaster) {
      data.isOwner = isOwner;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        isOwner: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Erro ao editar usuário:', error);

    if (error?.code === 'P2002') {
      return NextResponse.json(
        { message: 'E-mail já cadastrado nesta empresa' },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: 'Erro ao editar usuário' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const session = await getSession();

    const user = await prisma.user.findUnique({
      where: { id },
      select: { isOwner: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
    }

    // Proprietário só pode ser excluído pelo master
    if (user.isOwner && !session?.isMaster) {
      return NextResponse.json(
        { message: 'Apenas o master pode excluir o proprietário da empresa' },
        { status: 403 }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: 'Usuário removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    return NextResponse.json({ message: 'Erro ao deletar usuário' }, { status: 500 });
  }
}
