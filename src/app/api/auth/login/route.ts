import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession, MASTER_COMPANY_SLUG } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, conta } = await req.json();

    if (!email || !password || !conta) {
      return NextResponse.json(
        { message: 'Conta, e-mail e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // 1. Localizar a empresa pelo identificador de conta
    const company = await prisma.company.findUnique({
      where: { conta },
      select: { id: true, name: true, status: true, slug: true, conta: true },
    });

    if (!company) {
      return NextResponse.json(
        { message: 'Conta, e-mail ou senha inválidos' },
        { status: 401 }
      );
    }

    if (company.status !== 'ATIVO') {
      return NextResponse.json(
        { message: 'Empresa inativa. Contate o suporte.' },
        { status: 403 }
      );
    }

    // 2. Localizar o usuário pelo email dentro dessa empresa
    const user = await prisma.user.findUnique({
      where: { email_companyId: { email, companyId: company.id } },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'Conta, e-mail ou senha inválidos' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { message: 'Usuário inativo. Contate o administrador.' },
        { status: 403 }
      );
    }

    // 3. Verificar senha
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { message: 'Conta, e-mail ou senha inválidos' },
        { status: 401 }
      );
    }

    const isMaster = company.slug === MASTER_COMPANY_SLUG;

    await createSession({
      userId: user.id,
      companyId: company.id,
      name: user.name,
      email: user.email,
      isMaster,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        companyId: company.id,
        company: { id: company.id, name: company.name, status: company.status, slug: company.slug },
      },
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}
