import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/auth';
import { sanitizeFileName } from '@/lib/upload';

const MAX_SIZE = 8 * 1024 * 1024; // 8MB pra fundos
const VALID_PREFIXES = ['image/'];

/**
 * Upload de uma imagem de fundo pra um OfferLayout. Salva em
 * `layouts/offers/<yyyy>/<mm>/<ts>-<file>` no bucket. Retorna a URL pública.
 *
 * Não cria registro em `Media` — é só um arquivo que vive vinculado ao layout.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Arquivo é obrigatório' }, { status: 400 });
    }
    if (!VALID_PREFIXES.some((p) => file.type.startsWith(p))) {
      return NextResponse.json({ message: 'Apenas imagens' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ message: 'Imagem excede o limite de 8MB' }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET!;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const safe = sanitizeFileName(file.name);
    const path = `layouts/offers/${year}/${month}/${Date.now()}-${safe}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (upErr) {
      console.error('Erro no upload do fundo:', upErr);
      return NextResponse.json({ message: 'Erro ao enviar imagem' }, { status: 500 });
    }

    const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl, path }, { status: 201 });
  } catch (error) {
    console.error('Erro no upload:', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}
