/**
 * Layout helpers for lesson authors. Plain functions, safe to call at module load in lesson files.
 * Graph coordinates use the graph engine's units: x from 0 to 10, y from 0 to 6.
 */
import type { GraphEdge, GraphNode } from './graph';

export type Layout = { nodes: GraphNode[]; edges: GraphEdge[] };

/**
 * Binary tree from a LeetCode style level-order array (null = missing child).
 * Node ids are `t{index}` where index is the position in `values`.
 */
export function treeLayout(values: (number | string | null)[], opts: { top?: number; bottom?: number; left?: number; right?: number } = {}): Layout {
  const top = opts.top ?? 0.3;
  const bottom = opts.bottom ?? 5.4;
  const left = opts.left ?? 0.4;
  const right = opts.right ?? 9.6;
  type T = { idx: number; v: number | string; l?: T; r?: T; depth: number };
  if (!values.length || values[0] === null) return { nodes: [], edges: [] };
  const root: T = { idx: 0, v: values[0], depth: 0 };
  const queue: T[] = [root];
  let i = 1;
  while (queue.length && i < values.length) {
    const cur = queue.shift()!;
    for (const side of ['l', 'r'] as const) {
      if (i >= values.length) break;
      const v = values[i];
      if (v !== null) {
        const child: T = { idx: i, v, depth: cur.depth + 1 };
        cur[side] = child;
        queue.push(child);
      }
      i++;
    }
  }
  const order: T[] = [];
  const walk = (t?: T) => {
    if (!t) return;
    walk(t.l);
    order.push(t);
    walk(t.r);
  };
  walk(root);
  const maxDepth = Math.max(...order.map((t) => t.depth));
  const dy = maxDepth ? Math.min(1.6, (bottom - top) / maxDepth) : 0;
  const nodes: GraphNode[] = order.map((t, k) => ({
    id: `t${t.idx}`,
    label: t.v,
    x: left + ((k + 0.5) / order.length) * (right - left),
    y: top + t.depth * dy,
  }));
  const edges: GraphEdge[] = [];
  const link = (t?: T) => {
    if (!t) return;
    for (const c of [t.l, t.r]) {
      if (c) edges.push({ from: `t${t.idx}`, to: `t${c.idx}` });
      link(c);
    }
  };
  link(root);
  nodes.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return { nodes, edges };
}

/** Singly linked list laid out left to right. Node ids are `{prefix}{i}`, edges point forward. */
export function listLayout(values: (number | string)[], opts: { y?: number; prefix?: string; left?: number; right?: number } = {}): Layout {
  const y = opts.y ?? 2.6;
  const prefix = opts.prefix ?? 'n';
  const left = opts.left ?? 0.6;
  const right = opts.right ?? 9.4;
  const n = values.length;
  const nodes: GraphNode[] = values.map((v, i) => ({
    id: `${prefix}${i}`,
    label: v,
    x: n > 1 ? left + (i * (right - left)) / (n - 1) : (left + right) / 2,
    y,
    shape: 'box',
  }));
  const edges: GraphEdge[] = values.slice(1).map((_, i) => ({ from: `${prefix}${i}`, to: `${prefix}${i + 1}`, directed: true }));
  return { nodes, edges };
}

/** Points evenly spaced on a circle, handy for small general graphs. */
export function circleLayout(ids: string[], labels?: (string | number)[], opts: { cx?: number; cy?: number; rx?: number; ry?: number } = {}): GraphNode[] {
  const cx = opts.cx ?? 5;
  const cy = opts.cy ?? 2.9;
  const rx = opts.rx ?? 3.6;
  const ry = opts.ry ?? 2.4;
  return ids.map((id, i) => {
    const a = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
    return { id, label: labels?.[i] ?? id, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/** Return a copy of `nodes` with some fields overridden per id, e.g. states during a traversal. */
export function patch<T extends { id: string }>(items: T[], changes: Record<string, Partial<T>>): T[] {
  return items.map((it) => (changes[it.id] ? { ...it, ...changes[it.id] } : it));
}
