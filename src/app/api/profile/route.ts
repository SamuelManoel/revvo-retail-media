import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true, isActive: true, companyId: true, company: { select: { id: true, name: true } } },
    });

    if (!user) return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    return NextResponse.json({ message: 'Erro ao buscar perfil' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

    const body = await req.json();
    const { name, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });

    const data: { name?: string; password?: string } = {};

    if (name) data.name = name;

    if (currentPassword && newPassword) {
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return NextResponse.json({ message: 'Senha atual incorreta' }, { status: 401 });
      data.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'Nada a atualizar' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.userId },
      data,
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ message: 'Perfil atualizado com sucesso', user: updated });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    return NextResponse.json({ message: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}
