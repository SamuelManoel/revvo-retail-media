import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildMediaPath, getMediaType, sanitizeFileName } from '@/lib/upload';
import { getSession } from '@/lib/auth';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  try {
    const where = session.isMaster ? {} : { companyId: session.companyId };
    const medias = await prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(medias);
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

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Arquivo é obrigatório' }, { status: 400 });
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
    const path = buildMediaPath(safeFileName);
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
        companyId: session.companyId,
      },
    });

    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    console.error('Erro ao fazer upload da mídia:', error);
    return NextResponse.json({ message: 'Erro interno ao fazer upload da mídia' }, { status: 500 });
  }
}
