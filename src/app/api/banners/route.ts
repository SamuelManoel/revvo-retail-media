import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const terminals = await prisma.terminal.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(terminals, { status: 200 });
  } catch (error) {
    console.error('Erro ao listar terminais:', error);

    return NextResponse.json(
      { message: 'Erro ao listar terminais' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { name, ip, location, companyId } = body;

    if (!name || !ip || !location || !companyId) {
      return NextResponse.json(
        {
          message: 'Campos obrigatórios: name, ip, location, companyId',
        },
        { status: 400 }
      );
    }

    const terminalAlreadyExists = await prisma.terminal.findUnique({
      where: { ip },
    });

    if (terminalAlreadyExists) {
      return NextResponse.json(
        { message: 'Já existe um terminal com esse ip' },
        { status: 409 }
      );
    }

    const companyExists = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!companyExists) {
      return NextResponse.json(
        { message: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // const hashedPassword = await bcrypt.hash(password, 10);

    const terminal = await prisma.terminal.create({
      data: {
        name,
        location,
        ip,
        companyId,
      },
      select: {
        id: true,
        name: true,
        ip: true,
        location: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(terminal, { status: 201 });
  } catch (error) {
    console.error('Erro ao cadastrar terminal:', error);

    return NextResponse.json(
      { message: 'Erro ao criar terminal' },
      { status: 500 }
    );
  }
}