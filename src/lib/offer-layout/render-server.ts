/**
 * Renderer server-side de OfferLayout (Konva stage JSON) → PNG.
 *
 * Estratégia: monta um SVG com os nós interpolados + imagens embutidas como
 * data URLs e usa `sharp` pra rasterizar. Sem dependência nativa adicional
 * (já temos sharp). Funciona em qualquer runtime Node.
 *
 * Limitações (v1 — aceitas):
 *   - Word-wrap automático de texto não é feito (single-line por nó).
 *   - Fontes do servidor podem diferir levemente de Inter no editor.
 *   - Filtros/sombras do Konva não são portadas.
 */

import sharp from 'sharp';
import {
  type KonvaStage,
  type KonvaNode,
} from './konva-types';
import {
  type OfferRenderContext,
  interpolate,
  resolvePath,
  shouldHide,
} from './interpolate';
import { cosmosImageProxyUrl } from '@/lib/cosmos';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Baixa uma URL e devolve `data:image/...;base64,...` ou null em caso de falha.
 * Usa headers de browser real — alguns CDNs (Cloudflare, etc.) bloqueiam fetches
 * sem User-Agent / Accept apropriados.
 */
async function fetchAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  // URLs do CDN do Cosmos vão pelo proxy weserv pra contornar o WAF.
  const finalUrl = cosmosImageProxyUrl(url) ?? url;
  try {
    const res = await fetch(finalUrl, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });
    const ct = res.headers.get('content-type') ?? '';
    if (!res.ok) {
      console.warn(`[fetchAsDataUrl] FALHA ${res.status} url=${url} ct=${ct}`);
      return null;
    }
    if (!ct.startsWith('image/')) {
      console.warn(`[fetchAsDataUrl] tipo inválido (não é imagem) url=${url} ct=${ct}`);
      return null;
    }
    const arr = new Uint8Array(await res.arrayBuffer());
    const buf = Buffer.from(arr);
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch (e) {
    console.warn(`[fetchAsDataUrl] exception url=${url}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Pré-resolve todas as imagens (background + nós com isVariable) pra que o SVG
 * não dependa de fetch externo (sharp não busca href:// em SVG por segurança).
 */
async function prefetchImages(
  stage: KonvaStage,
  context: OfferRenderContext,
  backgroundUrl: string | null,
): Promise<{ background: string | null; nodeImages: Map<string, string> }> {
  const bgPromise = fetchAsDataUrl(backgroundUrl);
  const nodeImages = new Map<string, string>();

  const imgPromises: Promise<void>[] = [];
  for (const node of stage.nodes) {
    if (node.type !== 'image') continue;
    if (shouldHide(node.hideIfEmpty, context)) continue;
    let url: string | null = node.src;
    if (node.isVariable) {
      const v = resolvePath(node.src, context);
      url = typeof v === 'string' && v ? v : null;
    }
    imgPromises.push(
      fetchAsDataUrl(url).then((data) => {
        if (data) nodeImages.set(node.id, data);
      }),
    );
  }
  const [background] = await Promise.all([bgPromise, ...imgPromises]);
  return { background, nodeImages };
}

function svgForNode(
  node: KonvaNode,
  context: OfferRenderContext,
  resolvedImages: Map<string, string>,
): string {
  if (shouldHide('hideIfEmpty' in node ? node.hideIfEmpty : undefined, context)) {
    return '';
  }

  const rotation = node.rotation ?? 0;
  const cx = node.x + node.width / 2;
  const cy = node.y + ('height' in node ? node.height : 0) / 2;
  const transform = rotation ? ` transform="rotate(${rotation} ${cx} ${cy})"` : '';

  if (node.type === 'rect') {
    const stroke = node.stroke ? ` stroke="${node.stroke}" stroke-width="${node.strokeWidth ?? 1}"` : '';
    const rx = node.cornerRadius ?? 0;
    return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${rx}" ry="${rx}" fill="${node.fill ?? 'none'}"${stroke}${transform} />`;
  }

  if (node.type === 'text') {
    const text = interpolate(node.text, context);
    if (!text) return '';
    const fontWeight = node.fontWeight === 'bold' ? '700' : '400';
    const anchor = node.align === 'center' ? 'middle' : node.align === 'right' ? 'end' : 'start';
    const tx = node.align === 'center' ? node.x + node.width / 2 :
               node.align === 'right'  ? node.x + node.width
                                       : node.x;
    // SVG baseline é o "alphabetic"; Konva é "top". Aproximar deslocando ~font-size * 0.85
    const ty = node.y + node.fontSize * 0.85;
    return `<text x="${tx}" y="${ty}" font-family="${node.fontFamily}" font-size="${node.fontSize}" font-weight="${fontWeight}" fill="${node.fill}" text-anchor="${anchor}"${transform}>${escapeXml(text)}</text>`;
  }

  // image
  const dataUrl = resolvedImages.get(node.id);
  if (!dataUrl) return ''; // imagem não disponível: omite
  return `<image x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" href="${dataUrl}" preserveAspectRatio="xMidYMid slice"${transform} />`;
}

export async function renderStageToPng(
  stage: KonvaStage,
  context: OfferRenderContext,
  backgroundUrl: string | null,
): Promise<Buffer> {
  const { background, nodeImages } = await prefetchImages(stage, context, backgroundUrl);

  const nodesSvg = stage.nodes.map((n) => svgForNode(n, context, nodeImages)).join('');
  const bgSvg = background
    ? `<image x="0" y="0" width="${stage.width}" height="${stage.height}" href="${background}" preserveAspectRatio="xMidYMid slice" />`
    : `<rect x="0" y="0" width="${stage.width}" height="${stage.height}" fill="#ffffff" />`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="0 0 ${stage.width} ${stage.height}">
  ${bgSvg}
  ${nodesSvg}
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png;
}
