import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateTerminalToken } from '@/lib/terminal-auth';

// Re-autenticação: renova o token de um terminal já ativo.
// Não consome licença — o slot já está ocupado desde a ativação.
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

    if (!terminal || !terminal.isActive) {
      return NextResponse.json({ message: 'Terminal não encontrado ou inativo' }, { status: 404 });
    }

    if (terminal.isBlocked) {
      return NextResponse.json({ message: 'Terminal bloqueado' }, { status: 403 });
    }

    // Verificar se a licença da loja ainda é válida
    if (terminal.storeId) {
      const license = await prisma.storeLicense.findUnique({ where: { storeId: terminal.storeId } });
      if (!license || license.status !== 'active' || license.expiresAt < new Date()) {
        return NextResponse.json({ message: 'Licença da loja expirada ou suspensa' }, { status: 403 });
      }
    }

    const token = await generateTerminalToken({
      sub: terminal.id,
      companyId: terminal.companyId,
      storeId: terminal.storeId,
    });

    await prisma.terminalCredential.upsert({
      where: { terminalId: terminal.id },
      create: { terminalId: terminal.id, token, status: 'ACTIVE' },
      update: { token, status: 'ACTIVE', revokedAt: null },
    });

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Erro ao autenticar terminal:', error);
    return NextResponse.json({ message: 'Erro ao autenticar terminal' }, { status: 500 });
  }
}
