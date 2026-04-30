/**
 * Tipos compartilhados do layout de terminal.
 *
 * O layout é escrito em HTML-like com classes Tailwind (`<view class="...">`,
 * `<text class="...">`, `<image src="..." />`) e variáveis estilo template literal
 * (`${produto.preco1}`).
 *
 * O painel master e o app mobile parseiam o mesmo código com o mesmo parser e
 * renderizam: painel usa `<div>/<span>/<img>`, app usa `<View>/<Text>/<Image>`
 * — as classes Tailwind são processadas por Tailwind CSS no painel e por
 * NativeWind no app.
 *
 * Manter uma cópia idêntica em `revvo-smart-price-app/src/lib/layout-runtime/types.ts`.
 */

export type LayoutNode =
  | { type: 'element'; tag: string; classes: string; attrs: Record<string, string>; children: LayoutNode[] }
  | { type: 'text'; value: string };

export interface PriceParts {
  reais: string;     // parte inteira ("24")
  centavos: string;  // parte decimal com 2 dígitos ("90")
}

export interface RenderContext {
  produto: {
    ean: string;
    nome: string;
    preco1: number;
    preco2: number | null;
    preco3: number | null;
    image_url: string | null;
  } | null;
  store: {
    name: string;
    logoUrl: string | null;
  } | null;
  /** HH:mm — atualiza por minuto. */
  time: string;
  /** dd/mm/yyyy. */
  date: string;
  /** Dia da semana em pt-BR (ex: "segunda-feira"). */
  weekday: string;
  /** Atalhos para preço normal (preco1) — `${de.reais}` / `${de.centavos}`. */
  de: PriceParts;
  /** Atalhos para preço promocional (preco2). */
  por: PriceParts;
  /** Atalhos para preço fidelidade (preco3). */
  fid: PriceParts;
}

/** Variáveis e helpers expostos ao usuário no editor (auto-complete e validação). */
export const AVAILABLE_VARS = [
  'produto.ean',
  'produto.nome',
  'produto.preco1',
  'produto.preco2',
  'produto.preco3',
  'produto.image_url',
  'store.name',
  'store.logoUrl',
  'time',
  'date',
  'weekday',
  'de.reais',
  'de.centavos',
  'por.reais',
  'por.centavos',
  'fid.reais',
  'fid.centavos',
] as const;

export const AVAILABLE_HELPERS = [
  'formatPrice(produto.preco1)',
  'formatPrice(produto.preco2)',
  'formatPrice(produto.preco3)',
] as const;
