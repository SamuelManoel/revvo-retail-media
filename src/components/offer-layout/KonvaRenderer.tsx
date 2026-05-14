'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import {
  type KonvaStage as Stg,
  type KonvaNode,
} from '@/lib/offer-layout/konva-types';
import {
  interpolate,
  resolvePath,
  shouldHide,
  type OfferRenderContext,
} from '@/lib/offer-layout/interpolate';

type Props = {
  stage: Stg;
  context: OfferRenderContext;
  /** URL da imagem de fundo (se houver) — renderizada antes dos nós */
  backgroundUrl: string | null;
  /** Container CSS — o renderer faz scale pra caber */
  className?: string;
};

/**
 * Renderiza um KonvaStage com dados interpolados.
 * Faz scale fit-to-container preservando aspect ratio.
 */
export function KonvaRenderer({ stage, context, backgroundUrl, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function fit() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const sx = rect.width / stage.width;
      const sy = rect.height / stage.height;
      const s = Math.min(sx, sy);
      setScale(s > 0 ? s : 1);
      setContainerSize({ width: stage.width * s, height: stage.height * s });
    }
    fit();
    window.addEventListener('resize', fit);
    const ro = new ResizeObserver(fit);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', fit);
      ro.disconnect();
    };
  }, [stage.width, stage.height]);

  return (
    <div ref={containerRef} className={`relative flex items-center justify-center overflow-hidden ${className ?? ''}`}>
      <Stage width={containerSize.width} height={containerSize.height} scaleX={scale} scaleY={scale} listening={false}>
        <Layer>
          {backgroundUrl && (
            <BgImage url={backgroundUrl} width={stage.width} height={stage.height} />
          )}
          {stage.nodes.map((node) => {
            const hide = 'hideIfEmpty' in node ? node.hideIfEmpty : undefined;
            if (shouldHide(hide, context)) return null;
            return <RenderNode key={node.id} node={node} context={context} />;
          })}
        </Layer>
      </Stage>
    </div>
  );
}

function BgImage({ url, width, height }: { url: string; width: number; height: number }) {
  const [img] = useImage(url, 'anonymous');
  if (!img) return null;
  return <KonvaImage image={img} x={0} y={0} width={width} height={height} />;
}

function RenderNode({ node, context }: { node: KonvaNode; context: OfferRenderContext }) {
  if (node.type === 'rect') {
    return (
      <Rect
        x={node.x} y={node.y}
        width={node.width} height={node.height}
        fill={node.fill}
        stroke={node.stroke}
        strokeWidth={node.strokeWidth ?? 0}
        cornerRadius={node.cornerRadius ?? 0}
        rotation={node.rotation ?? 0}
      />
    );
  }
  if (node.type === 'text') {
    const txt = interpolate(node.text, context);
    return (
      <Text
        x={node.x} y={node.y}
        width={node.width}
        text={txt}
        fontSize={node.fontSize}
        fontFamily={node.fontFamily}
        fontStyle={node.fontWeight === 'bold' ? 'bold' : 'normal'}
        fill={node.fill}
        align={node.align}
        lineHeight={node.lineHeight ?? 1.2}
        rotation={node.rotation ?? 0}
      />
    );
  }
  // image
  let url = node.src;
  if (node.isVariable) {
    const resolved = resolvePath(node.src, context);
    if (typeof resolved !== 'string' || !resolved) return null;
    url = resolved;
  }
  return <ImgNode node={node} url={url} />;
}

function ImgNode({ node, url }: { node: Extract<KonvaNode, { type: 'image' }>; url: string }) {
  const [img] = useImage(url, 'anonymous');
  if (!img) return null;
  return (
    <KonvaImage
      image={img}
      x={node.x} y={node.y}
      width={node.width} height={node.height}
      rotation={node.rotation ?? 0}
    />
  );
}
