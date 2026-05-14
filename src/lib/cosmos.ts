/**
 * Cliente para baixar imagens de produto do CDN do Bluesoft Cosmos.
 *
 * URL canônica: https://cdn-cosmos.bluesoft.com.br/products/{ean}
 *
 * Esse CDN é protegido por Cloudflare WAF e bloqueia fetches server-side
 * (403 mesmo com headers de browser). Para contornar, roteamos via proxy
 * público de imagens `images.weserv.nl`, que busca da origem, re-serve com
 * CORS aberto e ainda cacheia. Tradeoff: dependência de serviço terceiro
 * gratuito (sem SLA). Se sair do ar, o caminho é trocar por proxy próprio
 * (Cloudflare Worker, por ex.).
 */

const CDN_HOST = 'cdn-cosmos.bluesoft.com.br';
const CDN_BASE = `https://${CDN_HOST}/products`;
const WESERV = 'https://images.weserv.nl/';

/**
 * Reescreve uma URL do CDN do Cosmos para passar por `images.weserv.nl`.
 * URLs que não são do Cosmos voltam intactas. Usar em qualquer ponto
 * server-side (e em URLs renderizadas no browser) que precise consumir
 * essas imagens.
 */
export function cosmosImageProxyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes(CDN_HOST)) return url;
  const stripped = url.replace(/^https?:\/\//, '');
  return `${WESERV}?url=${encodeURIComponent(stripped)}`;
}

/**
 * Baixa a imagem do produto do CDN do Cosmos pelo EAN, via proxy.
 * Retorna `null` se 404, content-type não é imagem, ou erro de rede.
 */
export async function downloadCosmosProductImage(
  ean: string,
  _token?: string,
): Promise<{ buf: Buffer; contentType: string; sourceUrl: string } | null> {
  if (!ean) return null;
  const sourceUrl = `${CDN_BASE}/${encodeURIComponent(ean)}`;
  const fetchUrl = cosmosImageProxyUrl(sourceUrl) ?? sourceUrl;
  try {
    const res = await fetch(fetchUrl, { cache: 'no-store', redirect: 'follow' });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return null;
    const arr = new Uint8Array(await res.arrayBuffer());
    return { buf: Buffer.from(arr), contentType: ct, sourceUrl };
  } catch {
    return null;
  }
}
