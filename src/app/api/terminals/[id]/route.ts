import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { decrementLicenseUsed } from '@/lib/license';

type Params = { params: Promise<{ id: string }> };

const INCLUDE = {
  company: { select: { id: true, name: true, email: true } },
  store: { select: { id: true, name: true } },
  _count: { select: { terminalMedias: true } },
} as const;

async function resolveTerminal(id: string, companyId: string, isMaster: boolean) {
  const terminal = await prisma.terminal.findUnique({ where: { id }, include: INCLUDE });
  if (!terminal) return null;
  if (!isMaster && terminal.companyId !== companyId) return null;
  return terminal;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;
  const terminal = await resolveTerminal(id, session.companyId, session.isMaster);
  if (!terminal) return NextResponse.json({ message: 'Terminal não encontrado' }, { status: 404 });
  return NextResponse.json(terminal);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const terminal = await resolveTerminal(id, session.companyId, session.isMaster);
  if (!terminal) return NextResponse.json({ message: 'Terminal não encontrado' }, { status: 404 });

  try {
    const body = await req.json();
    const { name, ip, location, storeId, isPriceChecker, isMediaDisplay, isBlocked } = body;

    if (ip && ip !== terminal.ip) {
      const ipTaken = await prisma.terminal.findUnique({ where: { ip } });
      if (ipTaken) return NextResponse.json({ message: 'Já existe um terminal com esse IP' }, { status: 409 });
    }

    if (storeId && storeId !== terminal.storeId) {
      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });
      if (!session.isMaster && store.companyId !== session.companyId) {
        return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
      }
    }

    const updated = await prisma.terminal.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(ip !== undefined && { ip }),
        ...(location !== undefined && { location }),
        ...(storeId !== undefined && { storeId }),
        ...(isPriceChecker !== undefined && { isPriceChecker }),
        ...(isMediaDisplay !== undefined && { isMediaDisplay }),
        ...(isBlocked !== undefined && { isBlocked }),
      },
      include: INCLUDE,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao editar terminal:', error);
    return NextResponse.json({ message: 'Erro ao editar terminal' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const terminal = await resolveTerminal(id, session.companyId, session.isMaster);
  if (!terminal) return NextResponse.json({ message: 'Terminal não encontrado' }, { status: 404 });

  try {
    // Liberar licença se terminal estava ativo e tem loja
    if (terminal.isActive && terminal.storeId) {
      await decrementLicenseUsed(terminal.storeId);
    }

    await prisma.terminal.delete({ where: { id } });
    return NextResponse.json({ message: 'Terminal removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar terminal:', error);
    return NextResponse.json({ message: 'Erro ao deletar terminal' }, { status: 500 });
  }
}
