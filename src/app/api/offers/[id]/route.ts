import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getProductByEan } from '@/lib/tenant-db';
import { renderAndUploadOffer } from '@/lib/offer-layout/render-and-upload';

type Params = { params: Promise<{ id: string }> };

async function resolveOffer(id: string, companyId: string, isMaster: boolean) {
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) return null;
  if (!isMaster && offer.companyId !== companyId) return null;
  return offer;
}

const OFFER_KINDS = ['oferta_item'] as const;
function isOfferKind(v: unknown): v is (typeof OFFER_KINDS)[number] {
  return typeof v === 'string' && (OFFER_KINDS as readonly string[]).includes(v);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      store:    { select: { id: true, name: true, companyId: true } },
      company:  { select: { id: true, name: true } },
      layout:   true,
      products: { orderBy: { createdAt: 'asc' } },
      terminalMedias: {
        select: {
          id: true, order: true,
          terminal: { select: { id: true, name: true } },
          campaign: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!offer) return NextResponse.json({ message: 'Oferta não encontrada' }, { status: 404 });
  if (!session.isMaster && offer.company.id !== session.companyId) {
    return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
  }
  return NextResponse.json(offer);
}

/**
 * PATCH /api/offers/[id] — edição.
 *
 * Body (todos opcionais):
 *   { name, isActive, layoutId, productEans?: string[] }
 *
 * Quando `productEans` vem, a lista atual de snapshots é substituída.
 * Mudanças em layout ou produtos disparam re-render automático.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const existing = await resolveOffer(id, session.companyId, session.isMaster);
  if (!existing) return NextResponse.json({ message: 'Oferta não encontrada' }, { status: 404 });

  const body = await req.json();
  const {
    name, isActive,
    layoutId, productEans,
  } = body ?? {};

  const data: Record<string, unknown> = {};

  if (name !== undefined) {
    if (!String(name).trim()) return NextResponse.json({ message: 'Nome inválido' }, { status: 400 });
    data.name = String(name).trim();
  }
  if (isActive !== undefined) data.isActive = Boolean(isActive);

  // Apenas oferta_item é suportado atualmente — não aceita mais mudanças de kind.
  void isOfferKind; // mantém helper exportado pra futuro reuso

  // Layout (verifica existência e que está ativo)
  let snapshotsToReplace: Array<{
    ean: string; productName: string;
    preco1: number | null; preco2: number | null; preco3: number | null;
    imageUrl: string | null; productId: string | null;
  }> | null = null;

  if (layoutId !== undefined && layoutId !== existing.layoutId) {
    const layout = await prisma.offerLayout.findUnique({ where: { id: layoutId } });
    if (!layout)        return NextResponse.json({ message: 'Layout não encontrado' }, { status: 404 });
    if (!layout.isActive) return NextResponse.json({ message: 'Layout inativo' },       { status: 400 });
    data.layoutId = layoutId;
  }

  // Produtos: substituir lista inteira (snapshot novo)
  if (productEans !== undefined) {
    if (!Array.isArray(productEans) || productEans.length === 0) {
      return NextResponse.json({ message: 'Informe ao menos um produto' }, { status: 400 });
    }
    const unique = Array.from(new Set(productEans.map((e: unknown) => String(e).trim()).filter(Boolean)));
    snapshotsToReplace = [];
    for (const ean of unique) {
      const p = await getProductByEan(existing.storeId, ean);
      if (!p) {
        return NextResponse.json({ message: `Produto EAN ${ean} não encontrado na loja` }, { status: 404 });
      }
      snapshotsToReplace.push({
        ean: p.ean,
        productName: p.produto,
        preco1: p.preco1 ? Number(p.preco1) : null,
        preco2: p.preco2 != null ? Number(p.preco2) : null,
        preco3: p.preco3 != null ? Number(p.preco3) : null,
        imageUrl: p.image_url ?? null,
        productId: p.id,
      });
    }
  }

  if (Object.keys(data).length === 0 && snapshotsToReplace === null) {
    return NextResponse.json({ message: 'Nenhuma alteração' }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.offer.update({ where: { id }, data });
    }
    if (snapshotsToReplace) {
      await tx.offerProduct.deleteMany({ where: { offerId: id } });
      await tx.offerProduct.createMany({
        data: snapshotsToReplace.map((s) => ({
          offerId: id,
          ean: s.ean,
          productName: s.productName,
          preco1: s.preco1,
          preco2: s.preco2,
          preco3: s.preco3,
          imageUrl: s.imageUrl,
          productId: s.productId,
        })),
      });
    }
    return tx.offer.findUnique({
      where: { id },
      include: {
        store:    { select: { id: true, name: true, companyId: true } },
        company:  { select: { id: true, name: true } },
        layout:   true,
        products: { orderBy: { createdAt: 'asc' } },
      },
    });
  });

  // Re-render quando algo que afeta o PNG mudou
  const affectsRender =
    snapshotsToReplace !== null ||
    'layoutId' in data;

  if (affectsRender) {
    await renderAndUploadOffer(id).catch((e) => console.error('[PATCH offer] render falhou:', e));
  }

  // Re-busca pra trazer renderedImageUrl atualizado
  const fresh = await prisma.offer.findUnique({
    where: { id },
    include: {
      store:    { select: { id: true, name: true, companyId: true } },
      company:  { select: { id: true, name: true } },
      layout:   true,
      products: { orderBy: { createdAt: 'asc' } },
    },
  });

  return NextResponse.json(fresh ?? updated);
}

// DELETE: soft-delete (isActive=false) — preserva histórico de campanha e snapshots.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const existing = await resolveOffer(id, session.companyId, session.isMaster);
  if (!existing) return NextResponse.json({ message: 'Oferta não encontrada' }, { status: 404 });

  if (!existing.isActive) {
    return NextResponse.json({ message: 'Oferta já está inativa' }, { status: 400 });
  }

  await prisma.offer.update({ where: { id }, data: { isActive: false } });

  // Logs nas campanhas onde a oferta está
  const tms = await prisma.terminalMedia.findMany({
    where: { offerId: id, campaignId: { not: null } },
    select: { campaignId: true },
    distinct: ['campaignId'],
  });
  for (const tm of tms) {
    if (!tm.campaignId) continue;
    await prisma.campaignLog.create({
      data: {
        campaignId:  tm.campaignId,
        action:      'updated',
        description: `Oferta "${existing.name}" desativada`,
        userId:      session.userId,
        userName:    session.name,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
