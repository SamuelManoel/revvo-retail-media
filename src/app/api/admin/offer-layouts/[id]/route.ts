import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isOfferLayoutCategory, isOfferLayoutOrientation } from '@/lib/offer-layout/categories';
import { renderAndUploadOffer } from '@/lib/offer-layout/render-and-upload';

/**
 * Campos do layout que afetam o PNG renderizado. Quando algum desses mudar,
 * a gente reagenda o render das ofertas que usam esse layout.
 */
const RENDER_AFFECTING_FIELDS = new Set([
  'template',
  'backgroundUrl',
  'orientation',
]);

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });
  const { id } = await params;

  const layout = await prisma.offerLayout.findUnique({
    where: { id },
    include: { _count: { select: { offers: true } } },
  });
  if (!layout) return NextResponse.json({ message: 'Layout não encontrado' }, { status: 404 });
  return NextResponse.json(layout);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });
  const { id } = await params;

  const existing = await prisma.offerLayout.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ message: 'Layout não encontrado' }, { status: 404 });

  const body = await req.json();
  const { name, description, category, orientation, backgroundUrl, template, isActive, thumbnailUrl } = body ?? {};

  const data: Record<string, unknown> = {};

  if (name !== undefined) {
    if (!String(name).trim()) return NextResponse.json({ message: 'Nome inválido' }, { status: 400 });
    data.name = String(name).trim();
  }
  if (description !== undefined) data.description = description?.trim() || null;
  if (category !== undefined) {
    if (!isOfferLayoutCategory(category)) return NextResponse.json({ message: 'Categoria inválida' }, { status: 400 });
    data.category = category;
  }
  if (orientation !== undefined) {
    if (!isOfferLayoutOrientation(orientation)) return NextResponse.json({ message: 'Orientação inválida' }, { status: 400 });
    data.orientation = orientation;
  }
  if (backgroundUrl !== undefined) data.backgroundUrl = backgroundUrl || null;
  if (template !== undefined) data.template = typeof template === 'string' ? template : '';
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl || null;

  const updated = await prisma.offerLayout.update({
    where: { id },
    data,
    include: { _count: { select: { offers: true } } },
  });

  // Re-render automático das ofertas que usam este layout quando algum campo
  // que afeta o PNG mudou (template / fundo / orientação).
  const needsRerender = Object.keys(data).some((k) => RENDER_AFFECTING_FIELDS.has(k));
  let rerendered = 0;
  let rerenderFailed = 0;
  if (needsRerender) {
    const offers = await prisma.offer.findMany({
      where: { layoutId: id, isActive: true },
      select: { id: true },
    });
    // Roda em paralelo com limite implícito (Promise.allSettled).
    // Pra layouts com muitas ofertas, considerar fila em background no futuro.
    const results = await Promise.allSettled(
      offers.map((o) => renderAndUploadOffer(o.id)),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) rerendered++;
      else rerenderFailed++;
    }
  }

  return NextResponse.json({
    ...updated,
    _rerender: needsRerender ? { triggered: true, ok: rerendered, failed: rerenderFailed } : { triggered: false },
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });
  const { id } = await params;

  const offerCount = await prisma.offer.count({ where: { layoutId: id } });
  if (offerCount > 0) {
    return NextResponse.json(
      { message: `Layout em uso por ${offerCount} oferta(s). Desative em vez de excluir.` },
      { status: 409 },
    );
  }

  try {
    await prisma.offerLayout.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Layout não encontrado' }, { status: 404 });
  }
}
