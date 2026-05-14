/**
 * Esquema persistido do template do OfferLayout (Konva-based).
 *
 * Convenções:
 *   - O Stage tem dimensões "design" fixas (1080x1350 retrato, 1920x1080 paisagem).
 *     Esses números são canônicos; o renderer escala pra caber no destino.
 *   - Cada nó tem coordenadas em px (relativas ao Stage). x/y do canto sup-esq.
 *   - Variáveis em textos usam ${produto.nome}, ${por.reais}, etc. (mesmo parser que terminal).
 *   - Decisão #4: se uma variável resolver para null/0, o nó inteiro é ocultado no render.
 */

export const DESIGN_PORTRAIT  = { width: 1080, height: 1350 };
export const DESIGN_LANDSCAPE = { width: 1920, height: 1080 };

export function designSizeFor(orientation: 'portrait' | 'landscape') {
  return orientation === 'portrait' ? DESIGN_PORTRAIT : DESIGN_LANDSCAPE;
}

export type FontWeight = 'normal' | 'bold';
export type TextAlign  = 'left' | 'center' | 'right';

export type KonvaTextNode = {
  id: string;
  type: 'text';
  x: number; y: number;
  width: number;
  text: string;             // suporta interpolação ${...}
  fontSize: number;         // px no canvas de design
  fontFamily: string;
  fontWeight: FontWeight;
  fill: string;             // cor (#hex/rgba)
  align: TextAlign;
  lineHeight?: number;
  rotation?: number;
  /**
   * Se preenchido com o nome de uma variável (ex: "por.reais"), o nó inteiro
   * é OMITIDO no render quando a variável resolve para null/0. Permite que o
   * template tenha blocos "preço de" que somem quando não há preço de.
   */
  hideIfEmpty?: string;
};

export type KonvaRectNode = {
  id: string;
  type: 'rect';
  x: number; y: number;
  width: number; height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  rotation?: number;
};

export type KonvaImageNode = {
  id: string;
  type: 'image';
  x: number; y: number;
  width: number; height: number;
  /** URL fixa, OU caminho de variável (ex: "produto.image_url") avaliada no render. */
  src: string;
  isVariable?: boolean;
  rotation?: number;
  hideIfEmpty?: string;
};

export type KonvaNode = KonvaTextNode | KonvaRectNode | KonvaImageNode;

export type KonvaStage = {
  version: 1;
  width:  number;
  height: number;
  nodes:  KonvaNode[];
};

export function emptyStage(orientation: 'portrait' | 'landscape'): KonvaStage {
  const { width, height } = designSizeFor(orientation);
  return { version: 1, width, height, nodes: [] };
}

export function parseStage(json: string | null | undefined, orientation: 'portrait' | 'landscape'): KonvaStage {
  if (!json) return emptyStage(orientation);
  try {
    const obj = JSON.parse(json);
    if (obj && typeof obj === 'object' && Array.isArray(obj.nodes)) {
      return {
        version: 1,
        width:  Number(obj.width)  || designSizeFor(orientation).width,
        height: Number(obj.height) || designSizeFor(orientation).height,
        nodes:  obj.nodes,
      };
    }
  } catch { /* ignore — JSON inválido */ }
  return emptyStage(orientation);
}

export function serializeStage(stage: KonvaStage): string {
  return JSON.stringify(stage);
}

export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
