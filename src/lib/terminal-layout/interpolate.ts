import type { PriceParts, RenderContext } from './types';

const EMPTY_PARTS: PriceParts = { reais: '—', centavos: '00' };

function priceParts(value: number | null | undefined): PriceParts {
  if (value == null || isNaN(Number(value))) return EMPTY_PARTS;
  const fixed = Number(value).toFixed(2);
  const [r, c] = fixed.split('.');
  return { reais: r, centavos: c };
}

/** Substitui `${...}` no texto pelo valor resolvido a partir do `RenderContext`. */
export function interpolate(template: string, ctx: RenderContext): string {
  if (!template) return template;
  return template.replace(/\$\{([^}]+)\}/g, (_, raw: string) => {
    const value = resolve(raw.trim(), ctx);
    return value == null ? '' : String(value);
  });
}

function resolve(expr: string, ctx: RenderContext): unknown {
  // helper(arg) — ex: formatPrice(produto.preco1)
  const fnMatch = expr.match(/^(\w+)\((.+)\)$/);
  if (fnMatch) {
    const [, fn, arg] = fnMatch;
    const value = resolve(arg.trim(), ctx);
    if (fn === 'formatPrice') return formatPriceBR(value);
    return '';
  }

  // path com pontos — produto.preco1, store.name
  const path = expr.split('.');
  let cursor: unknown = ctx as unknown as Record<string, unknown>;
  for (const part of path) {
    if (cursor == null || typeof cursor !== 'object') return '';
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

export function formatPriceBR(value: unknown): string {
  if (value == null || value === '' || isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Constrói um RenderContext com `time/date/weekday` e atalhos `de/por/fid`. */
export function buildContext(args: {
  produto: RenderContext['produto'];
  store: RenderContext['store'];
  now?: Date;
}): RenderContext {
  const now = args.now ?? new Date();
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('pt-BR');
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
  return {
    produto: args.produto,
    store: args.store,
    time, date, weekday,
    de:  priceParts(args.produto?.preco1 ?? null),
    por: priceParts(args.produto?.preco2 ?? null),
    fid: priceParts(args.produto?.preco3 ?? null),
  };
}
