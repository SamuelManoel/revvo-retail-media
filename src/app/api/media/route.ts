import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildMediaPath, getMediaType, sanitizeFileName } from '@/lib/upload';
import { getSession } from '@/lib/auth';
import { tenantId as toTenantId } from '@/lib/tenant-db';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const filterCompanyId = url.searchParams.get('companyId');
    const filterStoreId = url.searchParams.get('storeId');

    const where: {
      companyId?: string;
      storeId?: string | null;
    } = {};

    // Master pode filtrar por qualquer empresa; non-master fica preso à própria.
    if (session.isMaster) {
      if (filterCompanyId) where.companyId = filterCompanyId;
    } else {
      where.companyId = session.companyId;
      if (filterCompanyId && filterCompanyId !== session.companyId) {
        return NextResponse.json({ message: 'Acesso não autorizado' }, { status: 403 });
      }
    }

    // storeId == "none" filtra mídia de empresa (sem loja). Vazio = sem filtro de loja.
    if (filterStoreId === 'none') where.storeId = null;
    else if (filterStoreId) where.storeId = filterStoreId;

    const medias = await prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        store:   { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        _count: { select: { terminalMedias: true } },
        terminalMedias: {
          select: {
            terminalId: true,
            campaignId: true,
            terminal: { select: { id: true, name: true } },
            campaign: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Resumo de onde cada mídia está em uso (campanhas distintas + terminais distintos)
    const decorated = medias.map((m) => {
      const campaigns = new Map<string, { id: string; name: string }>();
      const terminals = new Map<string, { id: string; name: string }>();
      for (const tm of m.terminalMedias) {
        if (tm.campaign) campaigns.set(tm.campaign.id, tm.campaign);
        if (tm.terminal) terminals.set(tm.terminal.id, tm.terminal);
      }
      const { terminalMedias, _count, ...rest } = m;
      void terminalMedias;
      return {
        ...rest,
        usageCount: _count.terminalMedias,
        usedInCampaigns: Array.from(campaigns.values()),
        usedInTerminals: Array.from(terminals.values()),
      };
    });

    return NextResponse.json(decorated);
  } catch (error) {
    console.error('Erro ao listar mídias:', error);
    return NextResponse.json({ message: 'Erro interno ao listar mídias' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const storeIdRaw = formData.get('storeId');
    const storeId = typeof storeIdRaw === 'string' && storeIdRaw.trim() ? storeIdRaw.trim() : null;

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Arquivo é obrigatório' }, { status: 400 });
    }
    if (!storeId) {
      return NextResponse.json({ message: 'storeId é obrigatório (cada arquivo pertence a uma loja).' }, { status: 400 });
    }

    // Valida acesso à loja (master pode qualquer; non-master só própria company).
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, companyId: true },
    });
    if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });
    if (!session.isMaster && store.companyId !== session.companyId) {
      return NextResponse.json({ message: 'Acesso não autorizado a esta loja' }, { status: 403 });
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return NextResponse.json({ message: 'Apenas imagem ou vídeo são permitidos' }, { status: 400 });
    }

    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: isImage ? 'Imagem excede o limite de 5MB' : 'Vídeo excede o limite de 50MB' },
        { status: 400 },
      );
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET!;
    const safeFileName = sanitizeFileName(file.name);
    const path = buildMediaPath(safeFileName, { storeTenantId: toTenantId(store.id) });
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('Erro no upload para o Supabase Storage:', uploadError);
      return NextResponse.json({ message: 'Erro ao enviar arquivo para o storage' }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

    const media = await prisma.media.create({
      data: {
        bucket,
        path,
        url: publicUrlData.publicUrl || null,
        fileName: safeFileName,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        type: getMediaType(file.type),
        companyId: store.companyId,
        storeId: store.id,
      },
    });

    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    console.error('Erro ao fazer upload da mídia:', error);
    return NextResponse.json({ message: 'Erro interno ao fazer upload da mídia' }, { status: 500 });
  }
}
