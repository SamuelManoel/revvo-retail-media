import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

async function resolveMedia(id: string, companyId: string, isMaster: boolean) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return null;
  if (!isMaster && media.companyId && media.companyId !== companyId) return null;
  return media;
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  const { id } = await params;

  const media = await resolveMedia(id, session.companyId, session.isMaster);
  if (!media) return NextResponse.json({ message: 'Mídia não encontrada' }, { status: 404 });

  const { error: storageError } = await supabaseAdmin.storage
    .from(media.bucket)
    .remove([media.path]);

  if (storageError) {
    console.error('Erro ao remover arquivo do storage:', storageError);
  }

  await prisma.media.delete({ where: { id } });

  return NextResponse.json({ message: 'Mídia removida com sucesso' });
}
