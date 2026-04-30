import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTerminalFromRequest } from '@/lib/terminal-auth';
import { recordTenantScan } from '@/lib/tenant-db';

/**
 * Registra um scan (bipagem) feito pelo terminal.
 * Insere uma linha em `<tenant_loja>.product_scans` para alimentar relatórios.
 *
 * Body esperado:
 *   { ean: string, found: boolean, productName?: string,
 *     preco1?: number, preco2?: number, preco3?: number, scannedAt?: ISO string }
 */
export async function POST(req: NextRequest) {
  const payload = await getTerminalFromRequest(req);
  if (!payload) return NextResponse.json({ message: 'Token inválido' }, { status: 401 });

  try {
    const body = await req.json();
    const { ean, found, productName, preco1, preco2, preco3, scannedAt } = body ?? {};
    if (typeof ean !== 'string' || ean.trim().length === 0) {
      return NextResponse.json({ message: 'ean é obrigatório' }, { status: 400 });
    }
    if (typeof found !== 'boolean') {
      return NextResponse.json({ message: 'found (boolean) é obrigatório' }, { status: 400 });
    }

    const terminal = await prisma.terminal.findUnique({
      where: { id: payload.sub },
      select: { id: true, storeId: true, isBlocked: true },
    });
    if (!terminal || terminal.isBlocked || !terminal.storeId) {
      return NextResponse.json({ message: 'Terminal sem loja vinculada' }, { status: 400 });
    }

    await recordTenantScan({
      storeId: terminal.storeId,
      terminalId: terminal.id,
      ean: ean.trim(),
      found,
      productName: typeof productName === 'string' ? productName : null,
      preco1: typeof preco1 === 'number' ? preco1 : null,
      preco2: typeof preco2 === 'number' ? preco2 : null,
      preco3: typeof preco3 === 'number' ? preco3 : null,
      scannedAt: typeof scannedAt === 'string' ? new Date(scannedAt) : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao registrar scan:', error);
    return NextResponse.json({ message: 'Erro ao registrar scan' }, { status: 500 });
  }
}
