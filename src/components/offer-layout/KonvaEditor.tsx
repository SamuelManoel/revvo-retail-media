'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import type Konva_ from 'konva';
import {
  type KonvaStage as Stg,
  type KonvaNode,
  type KonvaTextNode,
  type KonvaRectNode,
  type KonvaImageNode,
  makeId,
} from '@/lib/offer-layout/konva-types';
import { buildMockOfferContext, interpolate } from '@/lib/offer-layout/interpolate';

const VARIABLE_PRESETS: Array<{ label: string; text: string; hideIfEmpty?: string }> = [
  { label: 'Nome do produto',    text: '${produto.nome}',    hideIfEmpty: 'produto.nome'  },
  { label: 'EAN do produto',     text: '${produto.ean}',     hideIfEmpty: 'produto.ean'   },
  { label: 'Preço 1 (R$)',       text: 'R$ ${de.reais},${de.centavos}',  hideIfEmpty: 'de'  },
  { label: 'Preço 2 (R$)',       text: 'R$ ${por.reais},${por.centavos}', hideIfEmpty: 'por' },
  { label: 'Preço 3 (R$)',       text: 'R$ ${fid.reais},${fid.centavos}', hideIfEmpty: 'fid' },
  { label: 'Nome da loja',       text: '${store.name}' },
  { label: 'Data',               text: '${now.date}' },
  { label: 'Hora',               text: '${now.time}' },
];

type Props = {
  stage: Stg;
  onChange: (next: Stg) => void;
  backgroundUrl: string | null;
};

export function KonvaEditor({ stage, onChange, backgroundUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva_.Stage>(null);
  const transformerRef = useRef<Konva_.Transformer>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [scale, setScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const ctx = buildMockOfferContext(); // contexto de exemplo só pra preview no editor

  useEffect(() => {
    function fit() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const sx = rect.width / stage.width;
      const sy = rect.height / stage.height;
      const s = Math.min(sx, sy, 1); // não amplia além do tamanho de design
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

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const sNode = stageRef.current?.findOne(`#${selectedId}`);
    tr.nodes(sNode ? [sNode] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, stage.nodes.length]);

  function update(nodeId: string, patch: Partial<KonvaNode>) {
    onChange({
      ...stage,
      nodes: stage.nodes.map((n) => n.id === nodeId ? ({ ...n, ...patch } as KonvaNode) : n),
    });
  }

  function remove(nodeId: string) {
    onChange({ ...stage, nodes: stage.nodes.filter((n) => n.id !== nodeId) });
    setSelectedId(null);
  }

  function addText(label?: string, text?: string, hideIfEmpty?: string) {
    const node: KonvaTextNode = {
      id: makeId('text'),
      type: 'text',
      x: stage.width / 2 - 200,
      y: stage.height / 2 - 30,
      width: 400,
      text: text ?? (label ?? 'Texto novo'),
      fontSize: 48,
      fontFamily: 'Inter, sans-serif',
      fontWeight: 'bold',
      fill: '#111111',
      align: 'center',
      hideIfEmpty,
    };
    onChange({ ...stage, nodes: [...stage.nodes, node] });
    setSelectedId(node.id);
  }

  function addRect() {
    const node: KonvaRectNode = {
      id: makeId('rect'),
      type: 'rect',
      x: stage.width / 2 - 150,
      y: stage.height / 2 - 75,
      width: 300, height: 150,
      fill: '#22c55e',
      cornerRadius: 16,
    };
    onChange({ ...stage, nodes: [...stage.nodes, node] });
    setSelectedId(node.id);
  }

  function addProductImage() {
    const node: KonvaImageNode = {
      id: makeId('img'),
      type: 'image',
      x: stage.width / 2 - 200,
      y: stage.height / 2 - 200,
      width: 400, height: 400,
      src: 'produto.image_url',
      isVariable: true,
      hideIfEmpty: 'produto.image_url',
    };
    onChange({ ...stage, nodes: [...stage.nodes, node] });
    setSelectedId(node.id);
  }

  const selectedNode = stage.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_260px]">
      {/* ───── Toolbox ───── */}
      <div className="space-y-3">
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Adicionar</p>
          <button onClick={addRect} className="w-full text-left text-sm rounded-md border border-border px-3 py-2 hover:border-accent/40 hover:text-accent transition-colors">
            Retângulo / fundo de cor
          </button>
          <button onClick={() => addText()} className="w-full text-left text-sm rounded-md border border-border px-3 py-2 hover:border-accent/40 hover:text-accent transition-colors">
            Texto livre
          </button>
          <button onClick={addProductImage} className="w-full text-left text-sm rounded-md border border-border px-3 py-2 hover:border-accent/40 hover:text-accent transition-colors">
            Imagem do produto (variável)
          </button>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-1">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Variáveis prontas</p>
          <p className="text-xs text-muted mb-2">Clique pra inserir como texto com auto-ocultar:</p>
          {VARIABLE_PRESETS.map((v) => (
            <button
              key={v.text}
              onClick={() => addText(v.label, v.text, v.hideIfEmpty)}
              className="w-full text-left text-xs rounded-md border border-border px-2 py-1.5 hover:border-accent/40 hover:text-accent transition-colors"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ───── Canvas ───── */}
      <div ref={containerRef} className="relative flex items-center justify-center bg-surface-secondary/40 rounded-lg border border-border overflow-hidden min-h-125">
        <Stage
          ref={stageRef}
          width={containerSize.width || 100}
          height={containerSize.height || 100}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={(e) => {
            // clicar fora deseleciona
            if (e.target === e.target.getStage()) setSelectedId(null);
          }}
        >
          <Layer>
            {/* fundo do canvas (branco se não tem imagem) */}
            <Rect x={0} y={0} width={stage.width} height={stage.height} fill="#ffffff" />
            {backgroundUrl && <BgImage url={backgroundUrl} width={stage.width} height={stage.height} />}

            {stage.nodes.map((node) => {
              if (node.type === 'rect') {
                return (
                  <Rect
                    key={node.id}
                    id={node.id}
                    x={node.x} y={node.y}
                    width={node.width} height={node.height}
                    fill={node.fill} stroke={node.stroke}
                    strokeWidth={node.strokeWidth ?? 0}
                    cornerRadius={node.cornerRadius ?? 0}
                    rotation={node.rotation ?? 0}
                    draggable
                    onClick={() => setSelectedId(node.id)}
                    onTap={() => setSelectedId(node.id)}
                    onDragEnd={(e) => update(node.id, { x: e.target.x(), y: e.target.y() })}
                    onTransformEnd={(e) => {
                      const n = e.target;
                      const sx = n.scaleX(); const sy = n.scaleY();
                      n.scaleX(1); n.scaleY(1);
                      update(node.id, {
                        x: n.x(), y: n.y(),
                        width: Math.max(4, n.width() * sx),
                        height: Math.max(4, n.height() * sy),
                        rotation: n.rotation(),
                      });
                    }}
                  />
                );
              }
              if (node.type === 'text') {
                const rendered = interpolate(node.text, ctx) || node.text;
                return (
                  <Text
                    key={node.id}
                    id={node.id}
                    x={node.x} y={node.y}
                    width={node.width}
                    text={rendered}
                    fontSize={node.fontSize}
                    fontFamily={node.fontFamily}
                    fontStyle={node.fontWeight === 'bold' ? 'bold' : 'normal'}
                    fill={node.fill}
                    align={node.align}
                    rotation={node.rotation ?? 0}
                    draggable
                    onClick={() => setSelectedId(node.id)}
                    onTap={() => setSelectedId(node.id)}
                    onDragEnd={(e) => update(node.id, { x: e.target.x(), y: e.target.y() })}
                    onTransformEnd={(e) => {
                      const n = e.target;
                      const sx = n.scaleX();
                      n.scaleX(1); n.scaleY(1);
                      update(node.id, {
                        x: n.x(), y: n.y(),
                        width: Math.max(20, n.width() * sx),
                        rotation: n.rotation(),
                      });
                    }}
                  />
                );
              }
              // image
              return (
                <DraggableImage
                  key={node.id}
                  node={node}
                  selected={selectedId === node.id}
                  onSelect={() => setSelectedId(node.id)}
                  onChange={(patch) => update(node.id, patch)}
                />
              );
            })}

            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio={false}
              boundBoxFunc={(_oldBox, newBox) => {
                if (newBox.width < 4 || newBox.height < 4) return _oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>

      {/* ───── Properties panel ───── */}
      <div className="space-y-3">
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Propriedades</p>
          {!selectedNode ? (
            <p className="text-xs text-muted">Selecione um elemento no canvas para editar.</p>
          ) : (
            <NodeProperties node={selectedNode} onChange={(patch) => update(selectedNode.id, patch)} onRemove={() => remove(selectedNode.id)} />
          )}
        </div>

        <div className="rounded-lg border border-border p-3 space-y-1.5 text-xs text-muted">
          <p className="font-semibold text-foreground">Dicas</p>
          <p>• Arraste pra mover. Use os cantos pra redimensionar.</p>
          <p>• Use os presets de variável pra inserir preço/nome com auto-ocultar.</p>
          <p>• Se uma variável for null/0 no momento da exibição, o nó some.</p>
        </div>
      </div>
    </div>
  );
}

function DraggableImage({
  node, selected, onSelect, onChange,
}: {
  node: Extract<KonvaNode, { type: 'image' }>;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<KonvaImageNode>) => void;
}) {
  // No editor mostramos placeholder quando é variável (sem produto real)
  const url = node.isVariable ? '' : node.src;
  const [img] = useImage(url || '', 'anonymous');
  return (
    <>
      {img ? (
        <KonvaImage
          id={node.id}
          image={img}
          x={node.x} y={node.y}
          width={node.width} height={node.height}
          rotation={node.rotation ?? 0}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
          onTransformEnd={(e) => {
            const n = e.target;
            const sx = n.scaleX(); const sy = n.scaleY();
            n.scaleX(1); n.scaleY(1);
            onChange({
              x: n.x(), y: n.y(),
              width: Math.max(20, n.width() * sx),
              height: Math.max(20, n.height() * sy),
              rotation: n.rotation(),
            });
          }}
        />
      ) : (
        <>
          <Rect
            id={node.id}
            x={node.x} y={node.y}
            width={node.width} height={node.height}
            fill="#e5e7eb"
            stroke={selected ? '#22c55e' : '#9ca3af'}
            strokeWidth={2}
            dash={[8, 6]}
            rotation={node.rotation ?? 0}
            draggable
            onClick={onSelect}
            onTap={onSelect}
            onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
            onTransformEnd={(e) => {
              const n = e.target;
              const sx = n.scaleX(); const sy = n.scaleY();
              n.scaleX(1); n.scaleY(1);
              onChange({
                x: n.x(), y: n.y(),
                width: Math.max(20, n.width() * sx),
                height: Math.max(20, n.height() * sy),
                rotation: n.rotation(),
              });
            }}
          />
          <Text
            x={node.x} y={node.y + node.height / 2 - 20}
            width={node.width}
            text={`{{ ${node.src} }}`}
            align="center"
            fontSize={28}
            fill="#6b7280"
            listening={false}
          />
        </>
      )}
    </>
  );
}

function BgImage({ url, width, height }: { url: string; width: number; height: number }) {
  const [img] = useImage(url, 'anonymous');
  if (!img) return null;
  return <KonvaImage image={img} x={0} y={0} width={width} height={height} listening={false} />;
}

function NodeProperties({
  node, onChange, onRemove,
}: {
  node: KonvaNode;
  onChange: (patch: Partial<KonvaNode>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <PropNumber label="X" value={node.x} onChange={(v) => onChange({ x: v })} />
        <PropNumber label="Y" value={node.y} onChange={(v) => onChange({ y: v })} />
        {'width' in node && (
          <PropNumber label="Largura" value={node.width} onChange={(v) => onChange({ width: v })} />
        )}
        {node.type !== 'text' && 'height' in node && (
          <PropNumber label="Altura" value={(node as KonvaRectNode | KonvaImageNode).height} onChange={(v) => onChange({ height: v })} />
        )}
      </div>

      {node.type === 'text' && (
        <>
          <label className="block">
            <span className="text-muted">Texto</span>
            <textarea
              rows={2}
              value={node.text}
              onChange={(e) => onChange({ text: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
            />
          </label>
          <PropNumber label="Tamanho da fonte" value={node.fontSize} onChange={(v) => onChange({ fontSize: v })} />
          <PropColor label="Cor" value={node.fill} onChange={(v) => onChange({ fill: v })} />
          <label className="block">
            <span className="text-muted">Alinhamento</span>
            <select
              value={node.align}
              onChange={(e) => onChange({ align: e.target.value as 'left' | 'center' | 'right' })}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </label>
          <label className="block">
            <span className="text-muted">Peso</span>
            <select
              value={node.fontWeight}
              onChange={(e) => onChange({ fontWeight: e.target.value as 'normal' | 'bold' })}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
            >
              <option value="normal">Normal</option>
              <option value="bold">Negrito</option>
            </select>
          </label>
        </>
      )}

      {node.type === 'rect' && (
        <>
          <PropColor label="Cor de preenchimento" value={node.fill ?? '#000000'} onChange={(v) => onChange({ fill: v })} />
          <PropNumber label="Borda arredondada" value={node.cornerRadius ?? 0} onChange={(v) => onChange({ cornerRadius: v })} />
        </>
      )}

      <label className="block">
        <span className="text-muted">Ocultar se a variável for vazia/0</span>
        <input
          type="text"
          value={'hideIfEmpty' in node ? (node.hideIfEmpty ?? '') : ''}
          onChange={(e) => onChange({ hideIfEmpty: e.target.value || undefined })}
          placeholder="ex: por, produto.image_url"
          className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
        />
      </label>

      <PropNumber label="Rotação (°)" value={node.rotation ?? 0} onChange={(v) => onChange({ rotation: v })} />

      <button
        onClick={onRemove}
        className="w-full mt-2 rounded-md border border-danger/30 text-danger px-2 py-1.5 text-xs hover:bg-danger/10"
      >
        Remover elemento
      </button>
    </div>
  );
}

function PropNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-muted">{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
      />
    </label>
  );
}

function PropColor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-muted">{label}</span>
      <div className="mt-1 flex gap-1.5">
        <input type="color" value={value.startsWith('#') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 rounded border border-border" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs"
        />
      </div>
    </label>
  );
}

// `Konva` import is used implicitly via react-konva; reference to keep tree-shake happy.
void Konva;
