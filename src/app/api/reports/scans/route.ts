import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  reportScansHourly,
  reportScansDaily,
  reportScansByTerminal,
  reportTopItems,
  reportNotFound,
} from '@/lib/tenant-db';

const ALLOWED_TYPES = ['hourly', 'daily', 'by-terminal', 'top-items', 'not-found'] as const;
type ReportType = (typeof ALLOWED_TYPES)[number];

function parseDateOr(d: string | null, fallback: Date): Date {
  if (!d) return fallback;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const url = new URL(req.url);
  const type = (url.searchParams.get('type') as ReportType | null) ?? 'hourly';
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ message: `type inválido. Use: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 });
  }

  const storeId = url.searchParams.get('storeId');
  if (!storeId) return NextResponse.json({ message: 'storeId é obrigatório' }, { status: 400 });

  // Valida acesso à loja: master pode qualquer; non-master só própria company.
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, companyId: true, name: true },
  });
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });
  if (!session.isMaster && store.companyId !== session.companyId) {
    return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
  }

  // Janela: default últimos 7 dias
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const from = parseDateOr(url.searchParams.get('from'), defaultFrom);
  const to = parseDateOr(url.searchParams.get('to'), now);
  const terminalId = url.searchParams.get('terminalId') || undefined;
  const limit = url.searchParams.get('limit');
  const limitNum = limit ? Math.max(1, Math.min(500, parseInt(limit, 10) || 50)) : undefined;

  try {
    if (type === 'hourly') {
      const rows = await reportScansHourly({ storeId, from, to, terminalId });
      return NextResponse.json({ from, to, rows });
    }
    if (type === 'daily') {
      const rows = await reportScansDaily({ storeId, from, to, terminalId });
      return NextResponse.json({ from, to, rows });
    }
    if (type === 'by-terminal') {
      const rows = await reportScansByTerminal({ storeId, from, to });
      // Resolve nomes dos terminais
      const ids = rows.map((r) => r.terminal_id);
      const terminals = ids.length === 0
        ? []
        : await prisma.terminal.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, ip: true },
          });
      const map = new Map(terminals.map((t) => [t.id, t]));
      const decorated = rows.map((r) => ({
        ...r,
        terminal: map.get(r.terminal_id) ?? null,
      }));
      return NextResponse.json({ from, to, rows: decorated });
    }
    if (type === 'top-items') {
      const rows = await reportTopItems({ storeId, from, to, limit: limitNum });
      return NextResponse.json({ from, to, rows });
    }
    if (type === 'not-found') {
      const rows = await reportNotFound({ storeId, from, to, limit: limitNum });
      const ids = Array.from(new Set(rows.map((r) => r.last_terminal_id)));
      const terminals = ids.length === 0
        ? []
        : await prisma.terminal.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          });
      const map = new Map(terminals.map((t) => [t.id, t]));
      const decorated = rows.map((r) => ({
        ...r,
        last_terminal: map.get(r.last_terminal_id) ?? null,
      }));
      return NextResponse.json({ from, to, rows: decorated });
    }
    return NextResponse.json({ message: 'type inválido' }, { status: 400 });
  } catch (e) {
    console.error('Erro no relatório:', e);
    return NextResponse.json({ message: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
