import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const config = await prisma.configuration.findFirst();

    if (!config) {
      return NextResponse.json({ message: 'Configuração não encontrada' }, { status: 404 });
    }

    const updated = await prisma.configuration.update({
      where: { id: config.id },
      data: { lastSync: new Date() },
    });

    return NextResponse.json({
      message: 'Carga gerada com sucesso',
      lastSync: updated.lastSync,
    });
  } catch (error) {
    console.error('Erro ao gerar carga:', error);
    return NextResponse.json({ message: 'Erro ao gerar carga' }, { status: 500 });
  }
}
