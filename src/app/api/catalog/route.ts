import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listProducts } from '@/lib/tenant-db';

/**
 * GET /api/catalog
 * Retorna os produtos do catálogo da loja vinculada à empresa do usuário autenticado.
 * Query params: page, limit, q
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  try {
    // Resolve a loja da empresa do usuário
    const store = await prisma.store.findFirst({
      where: { companyId: session.companyId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!store) {
      return NextResponse.json({ message: 'Nenhuma loja encontrada para esta empresa' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page  = parseInt(searchParams.get('page')  ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const q     = searchParams.get('q') ?? undefined;
    const sortBy = searchParams.get('sortBy') ?? undefined;
    const sortOrder = (searchParams.get('sortOrder') ?? undefined) as 'asc' | 'desc' | undefined;

    const result = await listProducts(store.id, { page, limit, q, sortBy, sortOrder });

    return NextResponse.json({ storeId: store.id, store: store.name, ...result });
  } catch (error) {
    console.error('Erro ao buscar catálogo:', error);
    return NextResponse.json({ message: 'Erro ao buscar catálogo' }, { status: 500 });
  }
}
