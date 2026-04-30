import { parse, HTMLElement, NodeType, type Node } from 'node-html-parser';
import type { LayoutNode } from './types';

/**
 * Tags suportadas. Tags PascalCase (`View`, `Text`, `Image`) são normalizadas.
 * - `view`   → container (`div` no web, `View` no RN)
 * - `text`   → texto     (`span` no web, `Text` no RN)
 * - `image`  → imagem    (`img` no web, `Image` no RN)
 * - `row`    → atalho `view` com `flex-row`
 * - `column` → atalho `view` com `flex-col`
 */
const SUPPORTED_TAGS = new Set(['view', 'text', 'image', 'row', 'column']);

interface ParseResult {
  nodes: LayoutNode[];
  errors: string[];
}

/**
 * Pré-processador tolerante a JSX/RN puro:
 * - Remove comentários JSX `{/* ... *​/}`.
 * - Converte `source={{ uri: '...' }}` (e variantes com backtick) em `src="..."`.
 * - Desencapsula `{`...${var}...`}` para texto direto (mantém `${var}`).
 * - Converte `{'\n'}` em quebra de linha real.
 * - Converte expressões `{`${var}`}` simples em `${var}`.
 */
function preprocessJsxLike(s: string): string {
  // 1) comentários JSX
  s = s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
  // 2) source={{ uri: 'literal' }} → src="literal"
  s = s.replace(/source\s*=\s*\{\{\s*uri\s*:\s*['"]([^'"]+)['"]\s*\}\}/g, 'src="$1"');
  // 3) source={{ uri: `tpl` }} → src="tpl"
  s = s.replace(/source\s*=\s*\{\{\s*uri\s*:\s*`([^`]+)`\s*\}\}/g, 'src="$1"');
  // 4) source={{ uri: variavel }} (sem aspas) → src="${variavel}"
  s = s.replace(/source\s*=\s*\{\{\s*uri\s*:\s*([^}]+?)\s*\}\}/g, (_m, expr) => {
    const e = String(expr).trim().replace(/^`|`$/g, '');
    return `src="\${${e}}"`;
  });
  // 5) {'\n'} | {"\n"} | {`\n`} → \n
  s = s.replace(/\{\s*['"`]\\n['"`]\s*\}/g, '\n');
  // 6) {`...${...}...`} → ...${...}... (mantendo o template literal por dentro)
  s = s.replace(/\{`([\s\S]*?)`\}/g, '$1');
  return s;
}

/** Parseia o código (HTML-like ou JSX-like) para uma árvore JSON serializável. */
export function parseLayout(source: string): ParseResult {
  const errors: string[] = [];
  if (!source.trim()) return { nodes: [], errors };

  const pre = preprocessJsxLike(source);
  const root = parse(pre, { lowerCaseTagName: true, voidTag: { tags: ['image', 'img', 'br', 'hr'] } });
  const nodes = root.childNodes.flatMap((n) => convert(n, errors));
  return { nodes, errors };
}

function convert(node: Node, errors: string[]): LayoutNode[] {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const value = node.rawText;
    if (!value || !value.trim()) return [];
    return [{ type: 'text', value }];
  }

  if (node.nodeType !== NodeType.ELEMENT_NODE) return [];

  const el = node as HTMLElement;
  const tag = el.rawTagName.toLowerCase();

  if (!SUPPORTED_TAGS.has(tag)) {
    errors.push(`Tag desconhecida: <${tag}>. Tags válidas: ${Array.from(SUPPORTED_TAGS).join(', ')}.`);
    return el.childNodes.flatMap((c) => convert(c, errors));
  }

  const attrs: Record<string, string> = {};
  let classes = '';
  for (const [k, v] of Object.entries(el.attributes)) {
    const key = k.toLowerCase();
    if (key === 'class' || key === 'classname') {
      classes = (classes + ' ' + (v ?? '')).trim();
    } else if (key === 'resizemode') {
      attrs.mode = v ?? '';
    } else {
      attrs[key] = v ?? '';
    }
  }

  // Atalhos: row/column → view com classe extra
  let resolvedTag = tag;
  if (tag === 'row') {
    resolvedTag = 'view';
    classes = ('flex-row ' + classes).trim();
  } else if (tag === 'column') {
    resolvedTag = 'view';
    classes = ('flex-col ' + classes).trim();
  }

  const children = el.childNodes.flatMap((c) => convert(c, errors));

  return [{ type: 'element', tag: resolvedTag, classes, attrs, children }];
}
