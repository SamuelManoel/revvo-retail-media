'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseLayout } from '@/lib/terminal-layout/parser';
import { interpolate } from '@/lib/terminal-layout/interpolate';
import type { LayoutNode, RenderContext } from '@/lib/terminal-layout/types';

interface Props {
  source: string;
  context: RenderContext;
  /** Largura visual fixa em px (opcional). Se omitida, ocupa 100% do container. */
  width?: number;
  /** Proporção (ratio width/height). 16/9 paisagem. */
  ratio?: number;
  /** Resolução lógica do terminal. */
  designWidth?: number;
}

const DEFAULT_DESIGN_WIDTH = 1920;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

function nodeToHtml(node: LayoutNode, ctx: RenderContext): string {
  if (node.type === 'text') return escapeHtml(interpolate(node.value, ctx));

  const { tag, classes, attrs, children } = node;

  if (tag === 'image') {
    const src = interpolate(attrs.src ?? '', ctx);
    const fit = attrs.mode === 'cover' ? 'object-cover' : attrs.mode === 'stretch' ? 'object-fill' : 'object-contain';
    const klass = `${classes} ${fit}`.trim();
    if (!src) {
      return `<div class="${escapeAttr(classes)} bg-slate-100 flex items-center justify-center text-xs text-slate-400">(sem URL)</div>`;
    }
    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(attrs.alt ?? '')}" class="${escapeAttr(klass)}" />`;
  }

  if (tag === 'text') {
    return `<span class="${escapeAttr(classes)}">${children.map((c) => nodeToHtml(c, ctx)).join('')}</span>`;
  }

  const hasDirection = /\bflex-(row|col)\b/.test(classes);
  const klass = `flex ${hasDirection ? '' : 'flex-col'} ${classes}`.replace(/\s+/g, ' ').trim();
  return `<div class="${escapeAttr(klass)}">${children.map((c) => nodeToHtml(c, ctx)).join('')}</div>`;
}

export default function Preview({
  source, context, width, ratio = 16 / 9, designWidth = DEFAULT_DESIGN_WIDTH,
}: Props) {
  const designHeight = Math.round(designWidth / ratio);
  const containerRef = useRef<HTMLDivElement>(null);
  // Quando `width` é fixo, usa direto; quando é fluido, mede via ResizeObserver
  const [measuredWidth, setMeasuredWidth] = useState<number>(width ?? 0);

  useEffect(() => {
    if (width != null) { setMeasuredWidth(width); return; }
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setMeasuredWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const effWidth = measuredWidth || width || 800;
  const effHeight = Math.round(effWidth / ratio);
  const scale = effWidth / designWidth;

  const { nodes, errors } = useMemo(() => {
    try { return parseLayout(source); }
    catch (e) { return { nodes: [], errors: [e instanceof Error ? e.message : 'erro de parse'] }; }
  }, [source]);

  const innerHtml = useMemo(
    () => nodes.map((n) => nodeToHtml(n, context)).join(''),
    [nodes, context]
  );

  const srcDoc = useMemo(
    () => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
  *, *::before, *::after { box-sizing: border-box; min-width: 0; min-height: 0; }
  /* Screen = tela do terminal. Flex-col para que flex-1 do root funcione. */
  #screen { width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
</style>
</head>
<body><div id="screen">${innerHtml}</div></body>
</html>`,
    [innerHtml]
  );

  return (
    <div
      ref={containerRef}
      style={width != null ? { width, height: effHeight } : { width: '100%', aspectRatio: `${ratio}` }}
      className="rounded-2xl border border-border overflow-hidden relative shadow-sm bg-white"
    >
      {effWidth > 0 && (
        <iframe
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          width={designWidth}
          height={designHeight}
          style={{
            width: designWidth,
            height: designHeight,
            border: 0,
            display: 'block',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          title="preview"
        />
      )}
      {errors.length > 0 && (
        <div className="absolute bottom-0 inset-x-0 bg-danger/10 text-danger text-[11px] px-3 py-1.5 max-h-24 overflow-auto">
          {errors.slice(0, 3).map((e, i) => <div key={i}>⚠ {e}</div>)}
          {errors.length > 3 && <div>+{errors.length - 3} avisos</div>}
        </div>
      )}
    </div>
  );
}
