import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';

const userSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  companyId: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, name: true } },
} as const;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

    const users = await prisma.user.findMany({
      where: session.isMaster ? undefined : { companyId: session.companyId },
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json({ message: 'Erro ao listar usuários' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

    const body = await req.json();
    const { name, email, password } = body;

    // Não-master só pode criar na própria empresa
    const companyId = session.isMaster ? (body.companyId ?? session.companyId) : session.companyId;

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Campos obrigatórios: name, email, password' },
        { status: 400 }
      );
    }

    const exists = await prisma.user.findUnique({ where: { email_companyId: { email, companyId } } });
    if (exists) {
      return NextResponse.json({ message: 'Já existe um usuário com esse e-mail nesta empresa' }, { status: 409 });
    }

    const companyExists = await prisma.company.findUnique({ where: { id: companyId } });
    if (!companyExists) {
      return NextResponse.json({ message: 'Empresa não encontrada' }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, isActive: body.isActive ?? true, companyId },
      select: userSelect,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json({ message: 'Erro ao criar usuário' }, { status: 500 });
  }
}
