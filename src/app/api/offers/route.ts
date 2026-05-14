import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getProductByEan } from '@/lib/tenant-db';
import { renderAndUploadOffer } from '@/lib/offer-layout/render-and-upload';

const OFFER_KINDS = ['oferta_item'] as const;
type OfferKind = (typeof OFFER_KINDS)[number];
function isOfferKind(v: unknown): v is OfferKind {
  return typeof v === 'string' && (OFFER_KINDS as readonly string[]).includes(v);
}

const OFFER_INCLUDE = {
  store:    { select: { id: true, name: true } },
  company:  { select: { id: true, name: true } },
  layout:   { select: { id: true, name: true, category: true, orientation: true, backgroundUrl: true, template: true } },
  products: { orderBy: { createdAt: 'asc' as const } },
  terminalMedias: {
    select: {
      id: true, order: true,
      terminal:  { select: { id: true, name: true } },
      campaign:  { select: { id: true, name: true } },
    },
  },
};

// GET /api/offers?storeId=&companyId=&kind=&isActive=
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const url = new URL(req.url);
  const storeId    = url.searchParams.get('storeId');
  const companyId  = url.searchParams.get('companyId');
  const kind       = url.searchParams.get('kind');
  const onlyActive = url.searchParams.get('isActive') === 'true';

  const where: {
    storeId?: string;
    companyId?: string;
    kind?: string;
    isActive?: boolean;
  } = {};

  if (session.isMaster) {
    if (companyId) where.companyId = companyId;
  } else {
    where.companyId = session.companyId;
    if (companyId && companyId !== session.companyId) {
      return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
    }
  }
  if (storeId) where.storeId = storeId;
  if (kind && isOfferKind(kind)) where.kind = kind;
  if (onlyActive) where.isActive = true;

  const offers = await prisma.offer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: OFFER_INCLUDE,
  });

  return NextResponse.json(offers);
}

/**
 * POST /api/offers
 * Body:
 *   {
 *     name,
 *     storeId, layoutId,
 *     productEans: string[],
 *     placement?: { campaignId, terminalId?, position, duration? }
 *   }
 *
 * Cria uma oferta de item (único tipo suportado) com snapshot dos produtos.
 * Se `placement` for fornecido, cria TerminalMedia com offerId e auto-popula
 * CampaignProduct (idempotente).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      name, storeId, layoutId,
      productEans,
      placement,
    } = body ?? {};

    if (!name?.trim()) return NextResponse.json({ message: 'Nome obrigatório' }, { status: 400 });
    if (!storeId || !layoutId) {
      return NextResponse.json({ message: 'storeId e layoutId são obrigatórios' }, { status: 400 });
    }
    if (!Array.isArray(productEans) || productEans.length === 0) {
      return NextResponse.json({ message: 'Selecione ao menos um produto' }, { status: 400 });
    }

    // Único tipo suportado hoje
    const kind: OfferKind = 'oferta_item';

    // Loja e empresa
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, companyId: true },
    });
    if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });
    if (!session.isMaster && store.companyId !== session.companyId) {
      return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
    }

    // Layout existe e está ativo
    const layout = await prisma.offerLayout.findUnique({ where: { id: layoutId } });
    if (!layout) return NextResponse.json({ message: 'Layout não encontrado' }, { status: 404 });
    if (!layout.isActive) return NextResponse.json({ message: 'Layout inativo' }, { status: 400 });

    // Busca cada produto no tenant da loja
    const uniqueEans = Array.from(new Set(productEans.map((e: unknown) => String(e).trim()).filter(Boolean)));
    type Snapshot = {
      ean: string; productName: string;
      preco1: number | null; preco2: number | null; preco3: number | null;
      imageUrl: string | null;
      productId: string | null;
    };
    const snapshots: Snapshot[] = [];
    for (const ean of uniqueEans) {
      const p = await getProductByEan(storeId, ean);
      if (!p) {
        return NextResponse.json({ message: `Produto com EAN ${ean} não encontrado nesta loja` }, { status: 404 });
      }
      snapshots.push({
        ean: p.ean,
        productName: p.produto,
        preco1: p.preco1 ? Number(p.preco1) : null,
        preco2: p.preco2 != null ? Number(p.preco2) : null,
        preco3: p.preco3 != null ? Number(p.preco3) : null,
        imageUrl: p.image_url ?? null,
        productId: p.id,
      });
    }

    // Validação de placement (se houver)
    type Placement = { campaignId: string; terminalId: string; position: number };
    let resolvedPlacement: Placement | null = null;
    if (placement) {
      const { campaignId, terminalId, position } = placement;
      if (!campaignId) return NextResponse.json({ message: 'campaignId obrigatório no placement' }, { status: 400 });
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, companyId: true, storeId: true, terminalId: true, isActive: true },
      });
      if (!campaign) return NextResponse.json({ message: 'Campanha não encontrada' }, { status: 404 });
      if (!session.isMaster && campaign.companyId !== session.companyId) {
        return NextResponse.json({ message: 'Acesso não autorizado à campanha' }, { status: 403 });
      }
      // Resolve o terminal: prioriza campaign.terminalId, depois o explícito
      const finalTerminalId = campaign.terminalId ?? terminalId;
      if (!finalTerminalId) {
        return NextResponse.json({ message: 'A campanha não tem terminal vinculado — informe terminalId no placement' }, { status: 400 });
      }
      const term = await prisma.terminal.findUnique({
        where: { id: finalTerminalId },
        select: { id: true, companyId: true },
      });
      if (!term || term.companyId !== store.companyId) {
        return NextResponse.json({ message: 'Terminal inválido ou de outra empresa' }, { status: 400 });
      }
      const pos = Number(position);
      if (!Number.isInteger(pos) || pos < 0) {
        return NextResponse.json({ message: 'position deve ser um inteiro ≥ 0' }, { status: 400 });
      }
      resolvedPlacement = { campaignId, terminalId: finalTerminalId, position: pos };
    }

    // ── Tudo OK, cria em transaction ──────────────────────────────────────────
    const offer = await prisma.$transaction(async (tx) => {
      const created = await tx.offer.create({
        data: {
          name: name.trim(),
          kind,
          companyId: store.companyId,
          storeId:   store.id,
          layoutId:  layout.id,
          leveX:          null,
          pagueY:         null,
          brindeText:     null,
          brindeImageUrl: null,
          products: {
            create: snapshots.map((s) => ({
              ean:         s.ean,
              productName: s.productName,
              preco1:      s.preco1,
              preco2:      s.preco2,
              preco3:      s.preco3,
              imageUrl:    s.imageUrl,
              productId:   s.productId,
            })),
          },
        },
        include: OFFER_INCLUDE,
      });

      if (resolvedPlacement) {
        // Shift: empurra todo TerminalMedia com order >= position desse terminal+campanha
        await tx.terminalMedia.updateMany({
          where: {
            terminalId: resolvedPlacement.terminalId,
            campaignId: resolvedPlacement.campaignId,
            order: { gte: resolvedPlacement.position },
          },
          data: { order: { increment: 1 } },
        });

        // Insere o slot de oferta
        await tx.terminalMedia.create({
          data: {
            terminalId: resolvedPlacement.terminalId,
            campaignId: resolvedPlacement.campaignId,
            offerId:    created.id,
            order:      resolvedPlacement.position,
          },
        });

        // Auto-popula CampaignProduct (idempotente — skip se já existir)
        for (const s of snapshots) {
          await tx.campaignProduct.upsert({
            where: { campaignId_ean: { campaignId: resolvedPlacement.campaignId, ean: s.ean } },
            create: {
              campaignId:  resolvedPlacement.campaignId,
              storeId:     store.id,
              productId:   s.productId,
              ean:         s.ean,
              productName: s.productName,
              preco1:      s.preco1,
              preco2:      s.preco2,
              preco3:      s.preco3,
              imageUrl:    s.imageUrl,
            },
            update: {}, // nunca atualiza um snapshot existente
          });
        }

        // Log na campanha
        await tx.campaignLog.create({
          data: {
            campaignId:  resolvedPlacement.campaignId,
            action:      'updated',
            description: `Oferta "${created.name}" adicionada na posição ${resolvedPlacement.position}`,
            userId:      session.userId,
            userName:    session.name,
          },
        });
      }

      return created;
    });

    // Renderiza a PNG da oferta (best-effort: se falhar, a oferta foi criada e
    // a UI pode chamar /api/offers/[id]/render depois).
    await renderAndUploadOffer(offer.id).catch((e) => {
      console.error('[POST /api/offers] render falhou:', e);
    });

    // Re-busca pra incluir renderedImageUrl atualizado
    const fresh = await prisma.offer.findUnique({
      where: { id: offer.id },
      include: OFFER_INCLUDE,
    });

    return NextResponse.json(fresh ?? offer, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar oferta:', error);
    return NextResponse.json({ message: 'Erro ao criar oferta' }, { status: 500 });
  }
}
