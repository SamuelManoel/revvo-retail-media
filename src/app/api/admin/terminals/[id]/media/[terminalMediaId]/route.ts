import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string; terminalMediaId: string }> };

async function resolveTM(terminalId: string, tmId: string, companyId: string, isMaster: boolean) {
  const terminal = await prisma.terminal.findUnique({ where: { id: terminalId } });
  if (!terminal) return null;
  if (!isMaster && terminal.companyId !== companyId) return null;
  const tm = await prisma.terminalMedia.findUnique({
    where: { id: tmId },
    include: { media: true, offer: { select: { id: true, name: true } } },
  });
  if (!tm || tm.terminalId !== terminalId) return null;
  return tm;
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id, terminalMediaId } = await params;

  const tm = await resolveTM(id, terminalMediaId, session.companyId, session.isMaster);
  if (!tm) return NextResponse.json({ message: 'Vínculo não encontrado' }, { status: 404 });

  try {
    const body = await req.json();
    const { startsAt, endsAt, campaignId, duration, enterAnimation } = body;
    const isOfferSlot = !!tm.offer && !tm.media;
    const tmMedia = tm.media; // possivelmente null em slot de oferta
    const label = tmMedia?.fileName ?? tm.offer?.name ?? 'item';

    // Slot de mídia: vídeo ignora duração; imagem aceita 3–300s.
    // Slot de oferta: também aceita 3–300s (sempre, ofertas são imagens).
    let durationData: { duration: number | null } | undefined;
    if (duration !== undefined) {
      if (tmMedia && tmMedia.type !== 'image') {
        durationData = { duration: null };
      } else if (duration === null) {
        durationData = { duration: 10 };
      } else {
        const num = Number(duration);
        if (!Number.isFinite(num)) {
          return NextResponse.json({ message: 'Duração inválida' }, { status: 400 });
        }
        durationData = { duration: Math.min(300, Math.max(3, Math.round(num))) };
      }
    }

    // Em slot de oferta só permitimos editar a duração e a animação de entrada
    // (datas/campaignId continuam sob controle do flow de placement).
    if (isOfferSlot && (startsAt !== undefined || endsAt !== undefined || campaignId !== undefined)) {
      return NextResponse.json({ message: 'Slot de oferta aceita apenas alteração de duração e animação' }, { status: 400 });
    }

    const ALLOWED_ANIMATIONS = ['none', 'fade', 'zoom', 'bounce', 'slideLeft', 'slideUp'] as const;
    let animationData: { enterAnimation: string } | undefined;
    if (enterAnimation !== undefined) {
      if (typeof enterAnimation !== 'string' || !ALLOWED_ANIMATIONS.includes(enterAnimation as typeof ALLOWED_ANIMATIONS[number])) {
        return NextResponse.json({ message: 'Animação inválida' }, { status: 400 });
      }
      animationData = { enterAnimation };
    }

    const updated = await prisma.terminalMedia.update({
      where: { id: terminalMediaId },
      data: {
        ...(!isOfferSlot && startsAt !== undefined && { startsAt: startsAt ? new Date(startsAt) : null }),
        ...(!isOfferSlot && endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
        ...(!isOfferSlot && campaignId !== undefined && { campaignId: campaignId || null }),
        ...durationData,
        ...animationData,
      },
      include: { media: true, offer: { select: { id: true, name: true } }, campaign: { select: { id: true, name: true } } },
    });

    if (durationData && tm.campaignId && durationData.duration !== tm.duration) {
      await prisma.campaignLog.create({
        data: {
          campaignId:  tm.campaignId,
          action:      'updated',
          description: `Duração de "${label}" alterada de ${tm.duration ?? '—'}s para ${durationData.duration ?? '—'}s`,
          userId:      session.userId,
          userName:    session.name,
          diff: {
            'Duração (s)': {
              from: tm.duration == null ? null : String(tm.duration),
              to:   durationData.duration == null ? null : String(durationData.duration),
            },
          },
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar vínculo:', error);
    return NextResponse.json({ message: 'Erro ao atualizar vínculo' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id, terminalMediaId } = await params;

  const tm = await resolveTM(id, terminalMediaId, session.companyId, session.isMaster);
  if (!tm) return NextResponse.json({ message: 'Vínculo não encontrado' }, { status: 404 });

  const campaignId   = tm.campaignId;
  const terminalName = (await prisma.terminal.findUnique({ where: { id }, select: { name: true } }))?.name ?? id;

  // Remove o slot (TerminalMedia). Não apaga a Offer/Media em si — só desvincula.
  await prisma.terminalMedia.delete({ where: { id: terminalMediaId } });

  // Audit log
  if (campaignId) {
    const itemLabel = tm.media?.fileName ?? tm.offer?.name ?? 'item';
    await prisma.campaignLog.create({
      data: {
        campaignId,
        action:      'media_removed',
        description: `${tm.offer ? 'Oferta' : 'Mídia'} "${itemLabel}" removida do terminal "${terminalName}"`,
        userId:      session.userId,
        userName:    session.name,
      },
    });
  }

  // Se era mídia: apaga arquivo do storage caso não esteja em outro terminal
  if (tm.media && tm.mediaId) {
    const mediaId = tm.mediaId;
    const remaining = await prisma.terminalMedia.count({ where: { mediaId } });
    if (remaining === 0) {
      const media = await prisma.media.findUnique({ where: { id: mediaId } });
      if (media) {
        await supabaseAdmin.storage.from(media.bucket).remove([media.path]);
        await prisma.media.delete({ where: { id: mediaId } });
      }
    }
  }

  return NextResponse.json({ message: tm.offer ? 'Oferta removida da campanha' : 'Mídia removida com sucesso' });
}
