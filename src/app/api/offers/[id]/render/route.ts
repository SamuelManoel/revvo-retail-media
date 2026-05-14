import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { renderAndUploadOffer } from '@/lib/offer-layout/render-and-upload';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/offers/[id]/render — força o re-render da oferta.
 * Útil quando o layout for atualizado pelo master e quisermos refletir nas ofertas
 * que já o usam, ou se a renderização inicial falhou.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  });
  if (!offer) return NextResponse.json({ message: 'Oferta não encontrada' }, { status: 404 });
  if (!session.isMaster && offer.companyId !== session.companyId) {
    return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
  }

  const url = await renderAndUploadOffer(offer.id);
  if (!url) return NextResponse.json({ message: 'Falha ao renderizar' }, { status: 500 });
  return NextResponse.json({ ok: true, renderedImageUrl: url });
}
