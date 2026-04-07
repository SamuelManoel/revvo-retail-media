import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { generateActivationCode } from '@/lib/terminal-auth';
import { checkLicenseAvailable } from '@/lib/license';

const INCLUDE = {
  company: { select: { id: true, name: true } },
  store: { select: { id: true, name: true } },
  _count: { select: { terminalMedias: true } },
} as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  try {
    const where = session.isMaster ? {} : { companyId: session.companyId };
    const terminals = await prisma.terminal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: INCLUDE,
    });
    return NextResponse.json(terminals);
  } catch (error) {
    console.error('Erro ao listar terminais:', error);
    return NextResponse.json({ message: 'Erro ao listar terminais' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      name, ip, location,
      storeId, companyId: bodyCompanyId,
      isPriceChecker = true, isMediaDisplay = false,
    } = body;

    if (!name || !location) {
      return NextResponse.json({ message: 'Campos obrigatórios: name, location' }, { status: 400 });
    }

    // Derivar companyId: master pode especificar, non-master usa o da session
    let companyId = session.isMaster && bodyCompanyId ? bodyCompanyId : session.companyId;

    // Se storeId fornecido, derivar e validar companyId do store
    if (storeId) {
      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });
      if (!session.isMaster && store.companyId !== session.companyId) {
        return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
      }
      companyId = store.companyId;

      // Verificar licença
      const licenseCheck = await checkLicenseAvailable(storeId);
      if (!licenseCheck.ok) {
        return NextResponse.json({ message: licenseCheck.reason }, { status: 422 });
      }
    }

    if (ip) {
      const ipTaken = await prisma.terminal.findUnique({ where: { ip } });
      if (ipTaken) return NextResponse.json({ message: 'Já existe um terminal com esse IP' }, { status: 409 });
    }

    // Gerar código de ativação único
    let activationCode: string;
    let attempts = 0;
    do {
      activationCode = generateActivationCode();
      const exists = await prisma.terminal.findUnique({ where: { activationCode } });
      if (!exists) break;
      attempts++;
    } while (attempts < 5);

    const terminal = await prisma.terminal.create({
      data: {
        name,
        ip: ip || null,
        location,
        storeId: storeId || null,
        companyId,
        isPriceChecker,
        isMediaDisplay,
        activationCode,
      },
      include: INCLUDE,
    });

    // Licença é consumida apenas na ativação do dispositivo, não aqui.

    return NextResponse.json(terminal, { status: 201 });
  } catch (error) {
    console.error('Erro ao cadastrar terminal:', error);
    return NextResponse.json({ message: 'Erro ao criar terminal' }, { status: 500 });
  }
}
