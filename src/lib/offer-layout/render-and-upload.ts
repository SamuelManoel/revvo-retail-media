import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensureProductImageCached } from '@/lib/cosmos-cache';
import { parseStage } from './konva-types';
import { buildOfferContext } from './interpolate';
import { renderStageToPng } from './render-server';

/**
 * Renderiza a oferta dada, sobe o PNG no bucket e grava o URL em
 * `Offer.renderedImageUrl`. Retorna o URL público (ou null em falha).
 *
 * Idempotente — chamável em criação ou em "regerar". Cada chamada gera um path
 * com timestamp pra evitar cache-busting no app/CDN.
 */
export async function renderAndUploadOffer(offerId: string): Promise<string | null> {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      products: true,
      layout: true,
      store: { select: { name: true } },
    },
  });
  if (!offer) return null;

  const stage = parseStage(offer.layout.template, offer.layout.orientation as 'portrait' | 'landscape');

  // Pré-cacheia imagens do Cosmos: URLs do CDN do Bluesoft viram URLs do
  // nosso Supabase Storage, persistindo no snapshot da oferta e no tenant.
  const cachedImageUrls = await Promise.all(
    offer.products.map((p) =>
      ensureProductImageCached({ storeId: offer.storeId, ean: p.ean, imageUrl: p.imageUrl }),
    ),
  );
  await Promise.all(
    offer.products.map((p, i) => {
      const cached = cachedImageUrls[i];
      if (!cached || cached === p.imageUrl) return Promise.resolve();
      return prisma.offerProduct.update({ where: { id: p.id }, data: { imageUrl: cached } });
    }),
  );

  // Constrói o contexto a partir dos snapshots dos produtos da oferta.
  const productos = offer.products.map((p, i) => ({
    ean:  p.ean,
    nome: p.productName,
    preco1: p.preco1 != null ? Number(p.preco1) : null,
    preco2: p.preco2 != null ? Number(p.preco2) : null,
    preco3: p.preco3 != null ? Number(p.preco3) : null,
    image_url: cachedImageUrls[i] ?? p.imageUrl ?? null,
  }));
  const principal = productos[0] ?? null;

  const ctx = buildOfferContext({
    produto: principal,
    produtos: productos,
    store: { name: offer.store.name, logoUrl: null },
    oferta: {
      nome:           offer.name,
      tipo:           offer.kind,
      leveX:          offer.leveX,
      pagueY:         offer.pagueY,
      brindeText:     offer.brindeText,
      brindeImageUrl: offer.brindeImageUrl,
    },
  });

  let png: Buffer;
  try {
    png = await renderStageToPng(stage, ctx, offer.layout.backgroundUrl);
  } catch (e) {
    console.error('[renderOffer] falha no renderStageToPng:', e);
    return null;
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) {
    console.error('[renderOffer] SUPABASE_STORAGE_BUCKET não configurado');
    return null;
  }
  const path = `offers/${offer.id}/v${Date.now()}.png`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, png, { contentType: 'image/png', upsert: true });
  if (upErr) {
    console.error('[renderOffer] erro no upload:', upErr);
    return null;
  }

  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  const url = pub.publicUrl;
  if (!url) return null;

  await prisma.offer.update({
    where: { id: offer.id },
    data: { renderedImageUrl: url, renderedAt: new Date() },
  });
  return url;
}
