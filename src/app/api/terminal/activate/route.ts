import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateTerminalToken } from '@/lib/terminal-auth';
import { checkLicenseAvailable } from '@/lib/license';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { activationCode } = body;

    if (!activationCode) {
      return NextResponse.json({ message: 'activationCode é obrigatório' }, { status: 400 });
    }

    const terminal = await prisma.terminal.findUnique({
      where: { activationCode: activationCode.toUpperCase() },
    });

    if (!terminal) {
      return NextResponse.json({ message: 'Código de ativação inválido' }, { status: 404 });
    }

    if (terminal.isBlocked) {
      return NextResponse.json({ message: 'Terminal bloqueado' }, { status: 403 });
    }

    // Verificar licença da loja antes de ativar.
    // O slot é consumido na ativação — não na criação do terminal.
    if (terminal.storeId) {
      const licenseCheck = await checkLicenseAvailable(terminal.storeId);
      if (!licenseCheck.ok) {
        return NextResponse.json({ message: licenseCheck.reason }, { status: 422 });
      }
    }

    // Gerar token
    const token = await generateTerminalToken({
      sub: terminal.id,
      companyId: terminal.companyId,
      storeId: terminal.storeId,
    });

    // Salvar/atualizar credencial
    await prisma.terminalCredential.upsert({
      where: { terminalId: terminal.id },
      create: { terminalId: terminal.id, token, status: 'ACTIVE' },
      update: { token, status: 'ACTIVE', revokedAt: null },
    });

    // Transação: registrar ativação + marcar ativo + consumir slot de licença
    await prisma.$transaction(async (tx) => {
      await tx.terminalActivation.create({
        data: { terminalId: terminal.id, status: 'USED' },
      });

      await tx.terminal.update({
        where: { id: terminal.id },
        data: { isActive: true, isBlocked: false, revokedAt: null, revokedBy: null },
      });

      // Consome 1 slot da licença da loja atomicamente
      if (terminal.storeId) {
        await tx.storeLicense.update({
          where: { storeId: terminal.storeId },
          data: { quantityUsed: { increment: 1 } },
        });
      }
    });

    return NextResponse.json({
      token,
      terminalId: terminal.id,
      name: terminal.name,
      isPriceChecker: terminal.isPriceChecker,
      isMediaDisplay: terminal.isMediaDisplay,
    });
  } catch (error) {
    console.error('Erro ao ativar terminal:', error);
    return NextResponse.json({ message: 'Erro ao ativar terminal' }, { status: 500 });
  }
}
