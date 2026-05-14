// Categorias de OfferLayout. Mantém em arquivo separado para reuso na UI/API.
//
// Histórico: começamos com 4 categorias (oferta_item, leve_x_pague_y,
// compre_ganhe_brinde, outro), mas hoje só "oferta_item" está em uso.
// Os labels das categorias antigas permanecem mapeados para que dados
// legados ainda apareçam corretamente em telas que usam o LABEL.
export const OFFER_LAYOUT_CATEGORIES = ['oferta_item'] as const;

export type OfferLayoutCategory = (typeof OFFER_LAYOUT_CATEGORIES)[number];

export function isOfferLayoutCategory(v: unknown): v is OfferLayoutCategory {
  return typeof v === 'string' && (OFFER_LAYOUT_CATEGORIES as readonly string[]).includes(v);
}

/** Labels — inclui categorias legadas pra dados existentes não quebrarem o display. */
export const OFFER_LAYOUT_CATEGORY_LABEL: Record<string, string> = {
  oferta_item:          'Oferta de item',
  // legado (somente leitura — não pode ser criado mais)
  leve_x_pague_y:       'Leve X pague Y (legado)',
  compre_ganhe_brinde:  'Compre e ganhe brinde (legado)',
  outro:                'Outro (legado)',
};

export const OFFER_LAYOUT_ORIENTATIONS = ['portrait', 'landscape'] as const;
export type OfferLayoutOrientation = (typeof OFFER_LAYOUT_ORIENTATIONS)[number];
export function isOfferLayoutOrientation(v: unknown): v is OfferLayoutOrientation {
  return typeof v === 'string' && (OFFER_LAYOUT_ORIENTATIONS as readonly string[]).includes(v);
}
