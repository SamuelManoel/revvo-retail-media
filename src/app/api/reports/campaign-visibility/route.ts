import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * Relatório de horas visíveis por campanha.
 *
 * Cálculo: cada heartbeat de um terminal vinculado à campanha (via TerminalMedia)
 * dentro do período da campanha (interseccionado com o filtro from..to) ≈ 15 min de tela.
 * Tempo estimado = heartbeats * heartbeatIntervalSec / 3600.
 *
 * Aprox. razoável quando o terminal está ligado e exibindo a playlist.
 */

const HEARTBEAT_INTERVAL_SEC = 15 * 60; // mesmo default do app

function parseDateOr(d: string | null, fallback: Date): Date {
  if (!d) return fallback;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get('storeId');
  if (!storeId) return NextResponse.json({ message: 'storeId é obrigatório' }, { status: 400 });

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, companyId: true, name: true },
  });
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });
  if (!session.isMaster && store.companyId !== session.companyId) {
    return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
  }

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = parseDateOr(url.searchParams.get('from'), defaultFrom);
  const to   = parseDateOr(url.searchParams.get('to'),   now);

  // Campanhas dessa loja cuja janela cruza o filtro
  const campaigns = await prisma.campaign.findMany({
    where: {
      storeId,
      startsAt: { lte: to },
      endsAt:   { gte: from },
    },
    select: {
      id: true, name: true, isActive: true, startsAt: true, endsAt: true,
      terminalMedias: {
        select: { terminalId: true },
        distinct: ['terminalId'],
      },
    },
    orderBy: { startsAt: 'desc' },
  });

  const results = await Promise.all(
    campaigns.map(async (c) => {
      const effStart = c.startsAt > from ? c.startsAt : from;
      const effEnd   = c.endsAt   < to   ? c.endsAt   : to;
      const terminalIds = Array.from(new Set(c.terminalMedias.map((tm) => tm.terminalId)));

      let heartbeats = 0;
      let perTerminal: { terminalId: string; heartbeats: number }[] = [];
      if (terminalIds.length > 0 && effEnd > effStart) {
        const grouped = await prisma.terminalHeartbeat.groupBy({
          by: ['terminalId'],
          where: {
            terminalId: { in: terminalIds },
            createdAt: { gte: effStart, lte: effEnd },
          },
          _count: { _all: true },
        });
        perTerminal = grouped.map((g) => ({ terminalId: g.terminalId, heartbeats: g._count._all }));
        heartbeats = perTerminal.reduce((acc, p) => acc + p.heartbeats, 0);
      }

      const estimatedHours = +((heartbeats * HEARTBEAT_INTERVAL_SEC) / 3600).toFixed(2);

      return {
        id: c.id,
        name: c.name,
        isActive: c.isActive,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        effectiveFrom: effStart,
        effectiveTo: effEnd,
        terminalCount: terminalIds.length,
        heartbeats,
        estimatedHours,
        perTerminal,
      };
    }),
  );

  // Resolve nomes dos terminais para o detalhamento
  const allTerminalIds = Array.from(new Set(results.flatMap((r) => r.perTerminal.map((p) => p.terminalId))));
  const terminals = allTerminalIds.length === 0
    ? []
    : await prisma.terminal.findMany({
        where: { id: { in: allTerminalIds } },
        select: { id: true, name: true },
      });
  const tMap = new Map(terminals.map((t) => [t.id, t.name]));
  const decorated = results.map((r) => ({
    ...r,
    perTerminal: r.perTerminal
      .map((p) => ({ ...p, name: tMap.get(p.terminalId) ?? p.terminalId, hours: +((p.heartbeats * HEARTBEAT_INTERVAL_SEC) / 3600).toFixed(2) }))
      .sort((a, b) => b.heartbeats - a.heartbeats),
  }));

  return NextResponse.json({
    from, to,
    heartbeatIntervalSec: HEARTBEAT_INTERVAL_SEC,
    campaigns: decorated,
  });
}
