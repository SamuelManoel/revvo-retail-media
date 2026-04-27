import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const { id } = await params;
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ message: 'Nome obrigatório' }, { status: 400 });

  try {
    const category = await prisma.integrationCategory.update({
      where: { id },
      data: { name: name.trim(), updatedAt: new Date() },
    });
    return NextResponse.json(category);
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === 'P2025') return NextResponse.json({ message: 'Categoria não encontrada' }, { status: 404 });
    if (e?.code === 'P2002') return NextResponse.json({ message: 'Já existe uma categoria com esse nome' }, { status: 409 });
    return NextResponse.json({ message: 'Erro ao atualizar categoria' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const { id } = await params;

  // Verifica se há integrações usando essa categoria
  const category = await prisma.integrationCategory.findUnique({ where: { id } });
  if (!category) return NextResponse.json({ message: 'Categoria não encontrada' }, { status: 404 });

  const inUse = await prisma.integration.count({ where: { category: category.name } });
  if (inUse > 0) {
    return NextResponse.json(
      { message: `Não é possível excluir: ${inUse} integração(ões) usam essa categoria` },
      { status: 409 }
    );
  }

  await prisma.integrationCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
