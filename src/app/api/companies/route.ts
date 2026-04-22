import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type CreateCompanyBody = {
  name: string;
  legalName: string;
  cnpj: string;
  email: string;
  slug: string;
  conta: string;
  status?: string;
};

export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { terminals: true, users: true } },
      },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error('Erro ao listar companies:', error);
    return NextResponse.json(
      { message: 'Erro ao listar empresas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCompanyBody;

    const {
      name,
      legalName,
      cnpj,
      email,
      slug,
      conta,
      status = 'ATIVO',
    } = body;

    if (!name || !legalName || !cnpj || !email || !slug || !conta) {
      return NextResponse.json(
        { message: 'Todos os campos obrigatórios devem ser enviados' },
        { status: 400 }
      );
    }

    const company = await prisma.company.create({
      data: { name, legalName, cnpj, email, slug, conta, status },
    });

    return NextResponse.json(company, { status: 201 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Erro ao criar company:', error);

    if (error?.code === 'P2002') {
      return NextResponse.json(
        { message: 'CNPJ, e-mail, slug ou conta já cadastrado' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: 'Erro ao criar empresa' },
      { status: 500 }
    );
  }
}