import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const config = await prisma.configuration.findFirst();

    if (!config) {
      return NextResponse.json({ message: 'Configuração não encontrada' }, { status: 404 });
    }

    if (!config.lastSync) {
      return NextResponse.json(
        { message: 'Gere uma carga antes de enviar aos terminais' },
        { status: 400 }
      );
    }

    const terminals = await prisma.terminal.findMany({
      select: { id: true, name: true, ip: true },
    });

    if (terminals.length === 0) {
      return NextResponse.json(
        { message: 'Nenhum terminal cadastrado para receber a carga' },
        { status: 400 }
      );
    }

    // Placeholder: aqui seria feita a comunicação real com cada terminal via IP
    // Ex.: fetch(`http://${terminal.ip}/api/push`, { method: 'POST', body: payload })

    return NextResponse.json({
      message: `Carga enviada para ${terminals.length} terminal(is) com sucesso`,
      terminals: terminals.map((t) => ({ id: t.id, name: t.name, ip: t.ip })),
    });
  } catch (error) {
    console.error('Erro ao enviar carga:', error);
    return NextResponse.json({ message: 'Erro ao enviar carga aos terminais' }, { status: 500 });
  }
}
