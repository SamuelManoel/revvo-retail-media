import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';

/**
 * POST /api/admin/mirror-image
 *
 * Recebe uma imagem em base64 (baixada pelo browser do usuário, que normalmente
 * consegue acessar CDNs protegidos por Cloudflare/WAF) e espelha no Supabase
 * Storage. Devolve a URL pública estável.
 *
 * Útil quando o backend não consegue fazer fetch direto da URL externa
 * (ex: Cosmos do Bluesoft é Cloudflare-protected).
 *
 * Body: { dataUrl: string, scope?: string, key?: string }
 *  - dataUrl: data:image/...;base64,... (gerado no browser via canvas/blob)
 *  - scope: subpasta (ex: 'product-mirror'). Default: 'mirrored'
 *  - key: identificador estável (ex: ean do produto). Se omitido, gera UUID.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) return NextResponse.json({ message: 'Storage não configurado' }, { status: 500 });

  try {
    const body = await req.json();
    const { dataUrl, scope, key } = body ?? {};
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return NextResponse.json({ message: 'dataUrl inválido (precisa começar com data:image/)' }, { status: 400 });
    }

    const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (!match) return NextResponse.json({ message: 'dataUrl mal formado' }, { status: 400 });

    const contentType = match[1];
    const base64 = match[2];
    const buf = Buffer.from(base64, 'base64');

    // Validações
    if (buf.byteLength > 5 * 1024 * 1024) {
      return NextResponse.json({ message: 'Imagem maior que 5MB' }, { status: 400 });
    }

    const ext = contentType.split('/')[1]?.replace('+xml', '') ?? 'png';
    const safeScope = (scope ?? 'mirrored').replace(/[^a-z0-9_-]/gi, '');
    const safeKey = (key ?? randomUUID()).replace(/[^a-z0-9._-]/gi, '');
    const path = `${safeScope}/${session.companyId}/${safeKey}.${ext}`;

    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buf, {
      upsert: true,
      contentType,
    });
    if (error) {
      console.error('mirror-image upload error:', error);
      return NextResponse.json({ message: 'Falha ao salvar imagem' }, { status: 500 });
    }

    const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl, path });
  } catch (e) {
    console.error('mirror-image exception:', e);
    return NextResponse.json({ message: 'Erro ao processar imagem' }, { status: 500 });
  }
}
