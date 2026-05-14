/**
 * Resolve ${path.to.value} a partir de um RenderContext. Compartilhado
 * entre editor (preview com mock) e renderer (com dados reais da oferta).
 *
 * Convenção #4: se a variável for null, undefined, '' ou 0 (numérico),
 * considera-se "vazio". Nós com `hideIfEmpty` apontando para uma variável
 * vazia são OMITIDOS pelo renderer.
 */

export type PriceParts = { reais: string; centavos: string };
const EMPTY_PRICE: PriceParts = { reais: '—', centavos: '00' };

function priceParts(value: number | null | undefined): PriceParts {
  if (value == null) return EMPTY_PRICE;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return EMPTY_PRICE;
  const [r, c] = n.toFixed(2).split('.');
  return { reais: r, centavos: c };
}

export type OfferRenderContext = {
  /** Produto principal (oferta_item) ou primeiro produto em listas */
  produto: {
    ean: string;
    nome: string;
    preco1: number | null;
    preco2: number | null;
    preco3: number | null;
    image_url: string | null;
  } | null;
  /** Lista completa de produtos da oferta */
  produtos: {
    ean: string;
    nome: string;
    preco1: number | null;
    preco2: number | null;
    preco3: number | null;
    image_url: string | null;
  }[];
  store: { name: string; logoUrl: string | null } | null;
  oferta: {
    nome: string;
    tipo: string;
    leveX: number | null;
    pagueY: number | null;
    brindeText: string | null;
    brindeImageUrl: string | null;
  };
  /** Atalhos de preço do produto principal */
  de:  PriceParts;
  por: PriceParts;
  fid: PriceParts;
  now: { time: string; date: string; weekday: string };
};

export function buildOfferContext(args: {
  produto: OfferRenderContext['produto'];
  produtos: OfferRenderContext['produtos'];
  store: OfferRenderContext['store'];
  oferta: OfferRenderContext['oferta'];
  now?: Date;
}): OfferRenderContext {
  const now = args.now ?? new Date();
  return {
    produto:  args.produto,
    produtos: args.produtos,
    store:    args.store,
    oferta:   args.oferta,
    de:  priceParts(args.produto?.preco1 ?? null),
    por: priceParts(args.produto?.preco2 ?? null),
    fid: priceParts(args.produto?.preco3 ?? null),
    now: {
      time:    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date:    now.toLocaleDateString('pt-BR'),
      weekday: now.toLocaleDateString('pt-BR', { weekday: 'long' }),
    },
  };
}

/** Resolve um path tipo "produto.nome" ou "por.reais". */
export function resolvePath(expr: string, ctx: unknown): unknown {
  const parts = expr.split('.');
  let cursor: unknown = ctx;
  for (const p of parts) {
    if (cursor == null || typeof cursor !== 'object') return null;
    cursor = (cursor as Record<string, unknown>)[p];
  }
  return cursor;
}

export function interpolate(template: string, ctx: OfferRenderContext): string {
  if (!template) return '';
  return template.replace(/\$\{([^}]+)\}/g, (_, raw: string) => {
    const value = resolvePath(raw.trim(), ctx);
    if (value == null) return '';
    return String(value);
  });
}

/**
 * "Vazio" segundo a regra #4: null/undefined/''/0 (numérico) é considerado vazio.
 * Strings com placeholder `—` (default de PriceParts) também são consideradas vazias.
 */
export function isEmptyForRendering(value: unknown): boolean {
  if (value == null) return true;
  if (value === '') return true;
  if (typeof value === 'number') return value === 0;
  if (typeof value === 'string' && (value === '—' || value === '0' || value === '0.00')) return true;
  // PriceParts { reais: '—' } é "vazio"
  if (typeof value === 'object' && 'reais' in (value as Record<string, unknown>)) {
    const r = (value as Record<string, unknown>).reais;
    if (r === '—') return true;
    if (typeof r === 'string' && (r === '0' || r === '')) return true;
  }
  return false;
}

/** Avalia se um nó deve ser oculto baseado em `hideIfEmpty`. */
export function shouldHide(hideIfEmpty: string | undefined, ctx: OfferRenderContext): boolean {
  if (!hideIfEmpty) return false;
  return isEmptyForRendering(resolvePath(hideIfEmpty, ctx));
}

/** Contexto de mock pro editor mostrar preview com dados de exemplo. */
export function buildMockOfferContext(): OfferRenderContext {
  return buildOfferContext({
    produto: {
      ean: '7891000000000',
      nome: 'Produto de exemplo',
      preco1: 19.90,
      preco2: 14.90,
      preco3: 12.90,
      image_url: null,
    },
    produtos: [],
    store: { name: 'Loja Exemplo', logoUrl: null },
    oferta: {
      nome: 'Oferta exemplo',
      tipo: 'oferta_item',
      leveX: 3,
      pagueY: 2,
      brindeText: 'Brinde especial',
      brindeImageUrl: null,
    },
  });
}
