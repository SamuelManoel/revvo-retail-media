import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTerminalFromRequest } from '@/lib/terminal-auth';

// GET /api/terminal/product?page=1&limit=50&q=
export async function GET(req: NextRequest) {
  const payload = await getTerminalFromRequest(req);
  if (!payload) return NextResponse.json({ message: 'Token inválido' }, { status: 401 });

  // Derivar storeId do terminal — nunca confiar no cliente
  const terminal = await prisma.terminal.findUnique({
    where: { id: payload.sub },
    select: { storeId: true, isBlocked: true, isActive: true },
  });

  if (!terminal || !terminal.isActive || terminal.isBlocked) {
    return NextResponse.json({ message: 'Terminal inativo ou bloqueado' }, { status: 403 });
  }

  if (!terminal.storeId) {
    return NextResponse.json({ products: [], total: 0, page: 1, limit: 50, pages: 0 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const q = url.searchParams.get('q')?.trim() ?? '';

  const where = {
    storeId: terminal.storeId,
    isActive: true,
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { ean: { contains: q } },
      ],
    } : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, ean: true, name: true, imageUrl: true,
        price: true, offerPrice: true, clubPrice: true,
        stock: true, updatedAt: true,
      },
    }),
  ]);

  return NextResponse.json({ products, total, page, limit, pages: Math.ceil(total / limit) });
}
