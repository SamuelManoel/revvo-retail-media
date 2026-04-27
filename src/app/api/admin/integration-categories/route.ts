import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const categories = await prisma.integrationCategory.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ message: 'Nome obrigatório' }, { status: 400 });

  try {
    const category = await prisma.integrationCategory.create({ data: { name: name.trim() } });
    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === 'P2002') return NextResponse.json({ message: 'Categoria já existe' }, { status: 409 });
    return NextResponse.json({ message: 'Erro ao criar categoria' }, { status: 500 });
  }
}
