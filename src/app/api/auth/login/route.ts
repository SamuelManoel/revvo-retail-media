import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession, MASTER_COMPANY_SLUG } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'E-mail e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        company: { select: { id: true, name: true, status: true, slug: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'E-mail ou senha inválidos' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { message: 'Usuário inativo. Contate o administrador.' },
        { status: 403 }
      );
    }

    if (user.company.status !== 'ATIVO') {
      return NextResponse.json(
        { message: 'Empresa inativa. Contate o suporte.' },
        { status: 403 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { message: 'E-mail ou senha inválidos' },
        { status: 401 }
      );
    }

    const isMaster = user.company.slug === MASTER_COMPANY_SLUG;

    await createSession({
      userId: user.id,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      isMaster,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyId: user.companyId,
        company: user.company,
      },
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}
