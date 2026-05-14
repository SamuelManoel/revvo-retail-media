/**
 * Mirror sob-demanda de imagens do Cosmos pra Supabase Storage.
 *
 * Quando o pipeline de render da oferta encontra uma URL apontando pro
 * `cdn-cosmos.bluesoft.com.br` (bloqueado por Cloudflare server-side),
 * passa por aqui: baixamos via proxy weserv, subimos pra
 * `product-images/{ean}.{ext}` (compartilhado entre todas as lojas, já que
 * a imagem do produto é a mesma globalmente) e atualizamos
 * `tenant.products.image_url` — assim renders futuros já usam o nosso
 * Storage direto, sem depender do proxy.
 */

import { supabaseAdmin } from './supabase-admin';
import { updateTenantProductImageUrl } from './tenant-db';
import { downloadCosmosProductImage } from './cosmos';

const CDN_HOST = 'cdn-cosmos.bluesoft.com.br';

function isAlreadyCached(url: string): boolean {
  return url.includes('/storage/v1/object/public/');
}

function isCosmosUrl(url: string): boolean {
  return url.includes(CDN_HOST);
}

/**
 * Baixa a imagem do produto do Cosmos (via proxy weserv), sobe pro nosso
 * Storage em `product-images/{ean}.{ext}` e atualiza `tenant.products.image_url`.
 * Retorna a URL pública ou null se o Cosmos não tem essa imagem.
 * Nunca lança.
 */
async function downloadAndCache(storeId: string, ean: string): Promise<string | null> {
  if (!ean) return null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) return null;

  const img = await downloadCosmosProductImage(ean);
  if (!img) return null;

  const ext = (img.contentType.split('/')[1] ?? 'jpg')
    .replace('+xml', '')
    .replace('jpeg', 'jpg');
  const path = `product-images/${ean}.${ext}`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, img.buf, { contentType: img.contentType, upsert: true });
  if (upErr) {
    console.warn(`[cosmos-cache] upload falhou ean=${ean}: ${upErr.message}`);
    return null;
  }

  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  const url = pub.publicUrl ?? null;
  if (!url) return null;

  await updateTenantProductImageUrl(storeId, ean, url).catch(() => {});
  return url;
}

/**
 * Garante que a imagem do produto esteja mirrorada no nosso Storage.
 * Retorna a URL final (cached) ou a original se não for caso de cache.
 * Nunca lança — em caso de falha, devolve a URL original.
 */
export async function ensureProductImageCached(args: {
  storeId: string;
  ean: string;
  imageUrl: string | null | undefined;
}): Promise<string | null> {
  const { storeId, ean, imageUrl } = args;
  if (!imageUrl) return null;
  if (isAlreadyCached(imageUrl)) return imageUrl;
  if (!isCosmosUrl(imageUrl)) return imageUrl;
  if (!ean) return imageUrl;

  const cached = await downloadAndCache(storeId, ean);
  return cached ?? imageUrl;
}

/**
 * Tenta buscar a imagem do produto no Cosmos pelo EAN e mirrora pro Storage.
 * Usado no cadastro de produto: se o usuário não informou imagem, a gente
 * tenta puxar do Cosmos automaticamente. Retorna a URL final ou null se
 * não há imagem disponível.
 */
export async function tryFetchProductImageFromCosmos(
  storeId: string,
  ean: string,
): Promise<string | null> {
  return downloadAndCache(storeId, ean);
}

/**
 * Canonicaliza uma URL de imagem fornecida pelo usuário (upload, link externo, etc):
 * baixa os bytes, sobe pra `product-images/{ean}.{ext}` (sobrescrevendo o arquivo
 * canônico — todos os tenants que apontam pra esse path veem a imagem nova) e
 * atualiza `tenant.products.image_url` da loja chamadora.
 *
 * - Se `sourceUrl` já for o path canônico (`product-images/{ean}`) não faz nada
 *   e devolve a própria URL.
 * - Se a URL apontar pro Cosmos, usa o proxy weserv pra baixar.
 * - Retorna a URL canônica final ou `null` em falha.
 */
export async function canonicalizeProductImage(args: {
  storeId: string;
  ean: string;
  sourceUrl: string;
}): Promise<string | null> {
  const { storeId, ean, sourceUrl } = args;
  if (!sourceUrl || !ean) return null;

  // Já é o path canônico do EAN — nada a fazer.
  if (sourceUrl.includes(`/product-images/${ean}.`)) return sourceUrl;

  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) return null;

  // Cosmos passa pelo proxy (Cloudflare bloqueia fetch direto).
  const { cosmosImageProxyUrl } = await import('./cosmos');
  const fetchUrl = cosmosImageProxyUrl(sourceUrl) ?? sourceUrl;

  let buf: Buffer;
  let contentType: string;
  try {
    const res = await fetch(fetchUrl, { cache: 'no-store', redirect: 'follow' });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return null;
    const arr = new Uint8Array(await res.arrayBuffer());
    buf = Buffer.from(arr);
    contentType = ct;
  } catch {
    return null;
  }

  const ext = (contentType.split('/')[1] ?? 'jpg')
    .replace('+xml', '')
    .replace('jpeg', 'jpg');
  const path = `product-images/${ean}.${ext}`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buf, { contentType, upsert: true });
  if (upErr) {
    console.warn(`[cosmos-cache] canonicalize upload falhou ean=${ean}: ${upErr.message}`);
    return null;
  }

  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  const url = pub.publicUrl ?? null;
  if (!url) return null;

  await updateTenantProductImageUrl(storeId, ean, url).catch(() => {});
  return url;
}
