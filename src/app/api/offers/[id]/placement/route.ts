import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/offers/[id]/placement
 *
 * Adiciona uma oferta existente em uma campanha numa determinada posição.
 * Faz shift dos itens subsequentes do mesmo terminal+campanha e propaga os
 * snapshots de produto pra `CampaignProduct` (idempotente).
 *
 * Body: { campaignId, terminalId?, position, duration? }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { products: true },
  });
  if (!offer) return NextResponse.json({ message: 'Oferta não encontrada' }, { status: 404 });
  if (!session.isMaster && offer.companyId !== session.companyId) {
    return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const { campaignId, terminalId, position, duration } = body ?? {};
  if (!campaignId) return NextResponse.json({ message: 'campaignId obrigatório' }, { status: 400 });

  // Duração: 3–300s, default 10. Mesmo range das imagens normais.
  let resolvedDuration = 10;
  if (duration !== undefined && duration !== null) {
    const n = Number(duration);
    if (!Number.isFinite(n)) return NextResponse.json({ message: 'duration inválida' }, { status: 400 });
    resolvedDuration = Math.min(300, Math.max(3, Math.round(n)));
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, companyId: true, storeId: true, terminalId: true, isActive: true },
  });
  if (!campaign) return NextResponse.json({ message: 'Campanha não encontrada' }, { status: 404 });
  if (!session.isMaster && campaign.companyId !== session.companyId) {
    return NextResponse.json({ message: 'Acesso não autorizado à campanha' }, { status: 403 });
  }
  if (campaign.companyId !== offer.companyId) {
    return NextResponse.json({ message: 'Oferta e campanha em empresas diferentes' }, { status: 400 });
  }

  const finalTerminalId = campaign.terminalId ?? terminalId;
  if (!finalTerminalId) {
    return NextResponse.json({ message: 'A campanha não tem terminal vinculado — informe terminalId' }, { status: 400 });
  }
  const term = await prisma.terminal.findUnique({
    where: { id: finalTerminalId },
    select: { id: true, companyId: true },
  });
  if (!term || term.companyId !== offer.companyId) {
    return NextResponse.json({ message: 'Terminal inválido' }, { status: 400 });
  }

  const pos = Number(position);
  if (!Number.isInteger(pos) || pos < 0) {
    return NextResponse.json({ message: 'position deve ser um inteiro ≥ 0' }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Evita duplicar a oferta no mesmo terminal+campanha
      const exists = await tx.terminalMedia.findFirst({
        where: { terminalId: finalTerminalId, campaignId, offerId: id },
        select: { id: true },
      });
      if (exists) {
        throw Object.assign(new Error('Esta oferta já está nessa campanha/terminal'), { status: 409 });
      }

      // Shift dos subsequentes
      await tx.terminalMedia.updateMany({
        where: {
          terminalId: finalTerminalId,
          campaignId,
          order: { gte: pos },
        },
        data: { order: { increment: 1 } },
      });

      // Cria o slot
      const tm = await tx.terminalMedia.create({
        data: {
          terminalId: finalTerminalId,
          campaignId,
          offerId: id,
          order: pos,
          duration: resolvedDuration,
        },
      });

      // Auto-popula CampaignProduct (idempotente)
      for (const p of offer.products) {
        await tx.campaignProduct.upsert({
          where: { campaignId_ean: { campaignId, ean: p.ean } },
          create: {
            campaignId,
            storeId:     offer.storeId,
            productId:   p.productId,
            ean:         p.ean,
            productName: p.productName,
            preco1:      p.preco1,
            preco2:      p.preco2,
            preco3:      p.preco3,
            imageUrl:    p.imageUrl,
          },
          update: {},
        });
      }

      await tx.campaignLog.create({
        data: {
          campaignId,
          action:      'updated',
          description: `Oferta "${offer.name}" adicionada na posição ${pos}`,
          userId:      session.userId,
          userName:    session.name,
        },
      });

      return tm;
    });

    return NextResponse.json({ ok: true, terminalMediaId: created.id }, { status: 201 });
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status === 409) return NextResponse.json({ message: err.message }, { status: 409 });
    console.error('Erro no placement:', e);
    return NextResponse.json({ message: 'Erro ao adicionar oferta na campanha' }, { status: 500 });
  }
}

/**
 * DELETE /api/offers/[id]/placement?terminalMediaId=...
 *
 * Remove uma colocação específica da oferta no playlist (TerminalMedia com offerId).
 * Também faz cleanup dos `CampaignProduct` cujos EANs vieram dessa oferta — só
 * quando nenhum OUTRO slot de oferta na mesma campanha ainda referencia o EAN.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const terminalMediaId = url.searchParams.get('terminalMediaId');
  if (!terminalMediaId) {
    return NextResponse.json({ message: 'terminalMediaId obrigatório' }, { status: 400 });
  }

  const tm = await prisma.terminalMedia.findUnique({
    where: { id: terminalMediaId },
    include: {
      offer: {
        include: { products: { select: { ean: true } } },
      },
      terminal: { select: { companyId: true, name: true } },
    },
  });
  if (!tm) return NextResponse.json({ message: 'Slot não encontrado' }, { status: 404 });
  if (tm.offerId !== id || !tm.offer) {
    return NextResponse.json({ message: 'Esse slot não é desta oferta' }, { status: 400 });
  }
  if (!session.isMaster && tm.terminal.companyId !== session.companyId) {
    return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
  }

  const campaignId = tm.campaignId;
  const offerEans = tm.offer.products.map((p) => p.ean);
  const offerName = tm.offer.name;

  try {
    await prisma.$transaction(async (tx) => {
      // Remove o slot
      await tx.terminalMedia.delete({ where: { id: terminalMediaId } });

      // Cleanup dos CampaignProducts: pra cada EAN da oferta, verifica se algum
      // OUTRO slot de oferta nesta mesma campanha ainda referencia esse EAN.
      // Se não, remove o CampaignProduct correspondente.
      if (campaignId && offerEans.length > 0) {
        const remainingOffers = await tx.terminalMedia.findMany({
          where: {
            campaignId,
            offerId: { not: null, notIn: [id] },
          },
          include: { offer: { select: { products: { select: { ean: true } } } } },
        });
        const stillReferenced = new Set<string>();
        for (const r of remainingOffers) {
          for (const p of r.offer?.products ?? []) stillReferenced.add(p.ean);
        }

        const toDelete = offerEans.filter((e) => !stillReferenced.has(e));
        if (toDelete.length > 0) {
          await tx.campaignProduct.deleteMany({
            where: { campaignId, ean: { in: toDelete } },
          });
        }

        await tx.campaignLog.create({
          data: {
            campaignId,
            action:      'updated',
            description: `Oferta "${offerName}" removida da campanha (${toDelete.length} produto(s) também)`,
            userId:      session.userId,
            userName:    session.name,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Erro ao remover placement:', e);
    return NextResponse.json({ message: 'Erro ao remover oferta da campanha' }, { status: 500 });
  }
}
