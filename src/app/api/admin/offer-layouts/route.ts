import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isOfferLayoutCategory, isOfferLayoutOrientation } from '@/lib/offer-layout/categories';

// GET /api/admin/offer-layouts?category=...
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const url = new URL(req.url);
  const category = url.searchParams.get('category');

  const layouts = await prisma.offerLayout.findMany({
    where: category ? { category } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { offers: true } } },
  });
  return NextResponse.json(layouts);
}

// POST /api/admin/offer-layouts
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  try {
    const body = await req.json();
    const { name, description, category, orientation, backgroundUrl, template, isActive, thumbnailUrl } = body ?? {};

    if (!name?.trim()) {
      return NextResponse.json({ message: 'Nome obrigatório' }, { status: 400 });
    }
    if (!isOfferLayoutCategory(category)) {
      return NextResponse.json({ message: 'Categoria inválida' }, { status: 400 });
    }
    if (orientation !== undefined && !isOfferLayoutOrientation(orientation)) {
      return NextResponse.json({ message: 'Orientação inválida' }, { status: 400 });
    }

    const layout = await prisma.offerLayout.create({
      data: {
        name:          name.trim(),
        description:   description?.trim() || null,
        category,
        orientation:   orientation ?? 'portrait',
        backgroundUrl: backgroundUrl ?? null,
        template:      typeof template === 'string' ? template : '',
        isActive:      isActive ?? true,
        thumbnailUrl:  thumbnailUrl ?? null,
      },
    });

    return NextResponse.json(layout, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar offer layout:', error);
    return NextResponse.json({ message: 'Erro ao criar layout' }, { status: 500 });
  }
}
