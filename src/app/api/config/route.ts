import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function getOrCreateConfig() {
  const existing = await prisma.configuration.findFirst();
  if (existing) return existing;
  return prisma.configuration.create({ data: {} });
}

export async function GET() {
  try {
    const config = await getOrCreateConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    return NextResponse.json({ message: 'Erro ao buscar configuração' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { resetTime } = body;

    if (resetTime !== undefined && (typeof resetTime !== 'number' || resetTime < 1)) {
      return NextResponse.json(
        { message: 'resetTime deve ser um número maior que 0' },
        { status: 400 }
      );
    }

    const config = await getOrCreateConfig();

    const updated = await prisma.configuration.update({
      where: { id: config.id },
      data: { ...(resetTime !== undefined && { resetTime }) },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    return NextResponse.json({ message: 'Erro ao atualizar configuração' }, { status: 500 });
  }
}
