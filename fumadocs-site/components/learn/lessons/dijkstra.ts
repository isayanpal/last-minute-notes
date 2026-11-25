import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import type { Frame } from '../types';

/*
 * Frames come from running the notes' Dijkstra: a min-heap of [distance, node] pairs and the `d > dist[u]` stale check.
 */

const NODES = [
  { id: 0, x: 0.9, y: 3 },
  { id: 1, x: 3.7, y: 1.2 },
  { id: 2, x: 3.9, y: 4.8 },
  { id: 3, x: 7.4, y: 3 },
];
const EDGES: [number, number, number][] = [[0, 1, 1], [0, 2, 4], [1, 2, 2], [2, 3, 1], [1, 3, 6]];
const INF = Infinity;
const fmt = (d: number) => (d === INF ? '∞' : String(d));

const gnodes = (dist: number[], states: Record<number, ItemState>): GraphNode[] => NODES.map((n) => ({ id: `n${n.id}`, label: n.id, x: n.x, y: n.y, state: states[n.id] ?? 'normal', tag: fmt(dist[n.id]) }));
const gedges = (marked: Set<string> = new Set(), bad: Set<string> = new Set()): GraphEdge[] =>
  EDGES.map(([a, b, w]) => ({ from: `n${a}`, to: `n${b}`, directed: true, label: String(w), state: bad.has(`${a}-${b}`) ? 'bad' : marked.has(`${a}-${b}`) ? 'path' : 'normal' }));

const panels = (dist: number[], heap: [number, number][]) => [
  { title: 'heap (d, node)', kind: 'queue' as const, items: [...heap].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([d, n]) => `${d},${n}`) },
  { title: 'dist[]', kind: 'map' as const, items: dist.map((d, i) => `${i}: ${fmt(d)}`) },
];

function trace(): Frame<GraphState>[] {
  const graph: [number, number][][] = NODES.map(() => []);
  for (const [a, b, w] of EDGES) graph[a].push([b, w]);
  const dist = new Array<number>(NODES.length).fill(INF);
  dist[0] = 0;
  const heap: [number, number][] = [[0, 0]];
  const finalized = new Set<number>();
  const frames: Frame<GraphState>[] = [];
  const snap = (cur: number | undefined, note: GraphState['note'], opts: { marked?: Set<string>; stale?: boolean; hold?: number; stats?: GraphState['stats'] } = {}) => {
    const states: Record<number, ItemState> = {};
    for (const f of finalized) states[f] = 'done';
    for (const [, n] of heap) if (!finalized.has(n)) states[n] = 'visited';
    if (cur !== undefined) states[cur] = opts.stale ? 'bad' : 'active';
    frames.push({
      hold: opts.hold ?? 2200,
      state: {
        nodes: gnodes(dist, states),
        edges: gedges(opts.marked),
        panels: panels(dist, heap),
        stats: opts.stats ?? [{ label: 'Finalized', value: String(finalized.size) }, { label: 'In heap', value: String(heap.length) }, { label: 'Target 3', value: fmt(dist[3]), tone: dist[3] === INF ? 'neutral' : 'ok' }],
        note,
      },
    });
  };
  snap(undefined, { text: 'dist[source] = 0, everything else infinity, push (0, source)', tone: 'accent' }, { hold: 1800 });
  while (heap.length) {
    heap.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [d, u] = heap.shift()!;
    if (d > dist[u]) {
      snap(u, { text: `pop (${d}, ${u}): dist[${u}] is already ${dist[u]}, a stale entry, skip`, tone: 'bad' }, { stale: true, hold: 2000, stats: [{ label: 'Popped', value: `${d}, ${u}` }, { label: 'Best known', value: fmt(dist[u]), tone: 'ok' }, { label: 'Action', value: 'skip stale', tone: 'bad' }] });
      continue;
    }
    finalized.add(u);
    const marked = new Set<string>();
    const lines: string[] = [];
    for (const [v, w] of graph[u]) {
      if (d + w < dist[v]) {
        lines.push(`${v}: ${fmt(dist[v])} to ${d + w}`);
        dist[v] = d + w;
        heap.push([dist[v], v]);
        marked.add(`${u}-${v}`);
      }
    }
    snap(u, { text: lines.length ? `pop (${d}, ${u}), relax: ${lines.join(', ')}` : `pop (${d}, ${u}): nothing to improve`, tone: 'accent' }, { marked });
  }
  return frames;
}

const T = trace();

// Step 1: hop count is not distance.
const hopsVsWeight = (weighted: boolean): GraphState => ({
  nodes: gnodes([INF, INF, INF, INF], weighted ? { 0: 'found', 1: 'path', 2: 'path' } : { 0: 'found', 2: 'path' }).map((n) => ({ ...n, tag: undefined })),
  edges: gedges(weighted ? new Set(['0-1', '1-2']) : new Set(['0-2'])),
  stats: weighted
    ? [{ label: 'Path 0, 1, 2', value: '1 + 2 = 3', tone: 'ok' }, { label: 'Direct edge', value: '4' }, { label: 'Hops', value: '2 vs 1' }]
    : [{ label: 'BFS to node 2', value: '1 hop' }, { label: 'Cost of it', value: '4', tone: 'bad' }, { label: 'Cheaper way', value: 'exists' }],
  note: weighted ? { text: 'more hops, less cost: weights change the answer', tone: 'ok' } : { text: 'BFS minimises edges, not total weight', tone: 'bad' },
});

// Step 5: negative edges break the finalize rule.
const NEG_NODES = [
  { id: 0, x: 0.9, y: 3 },
  { id: 1, x: 7.4, y: 1.4 },
  { id: 2, x: 4.2, y: 4.8 },
];
const negScene = (phase: 'finalized' | 'truth'): GraphState => ({
  nodes: NEG_NODES.map((n) => ({ id: `n${n.id}`, label: n.id, x: n.x, y: n.y, state: (phase === 'finalized' ? (n.id === 1 ? 'bad' : n.id === 0 ? 'done' : 'normal') : n.id === 1 ? 'found' : 'done') as ItemState, tag: n.id === 0 ? '0' : n.id === 1 ? (phase === 'finalized' ? '2 (wrong)' : '1') : '5' })),
  edges: [
    { from: 'n0', to: 'n1', directed: true, label: '2' },
    { from: 'n0', to: 'n2', directed: true, label: '5' },
    { from: 'n2', to: 'n1', directed: true, label: '-4', state: phase === 'truth' ? 'path' : 'normal' },
  ],
  stats: phase === 'finalized'
    ? [{ label: 'Node 1', value: 'finalized at 2', tone: 'bad' }, { label: 'Dijkstra', value: 'never revisits' }, { label: 'Edge', value: '2 to 1 is -4' }]
    : [{ label: 'True cost to 1', value: '5 - 4 = 1', tone: 'ok' }, { label: 'Dijkstra said', value: '2', tone: 'bad' }, { label: 'Use', value: 'Bellman-Ford' }],
  note: phase === 'finalized' ? { text: 'the first pop of a node is assumed final', tone: 'bad' } : { text: 'a negative edge can improve a node already finalized', tone: 'bad' },
});

export default defineLesson('isoGraph', {
  slug: 'dijkstra',
  pseudocode: [
    'dist[all] = infinity, dist[start] = 0',
    'heap = [(0, start)]',
    'while heap is not empty:',
    '    (d, u) = pop the nearest',
    '    if d > dist[u]: skip (stale)',
    '    for each edge (u, v, w):',
    '        if d + w < dist[v]:',
    '            dist[v] = d + w',
    '            push (dist[v], v)',
  ],
  objectives: [
    { text: 'Why BFS fails once edges have different costs', step: 1 },
    { text: 'The min-heap loop: pop the nearest, relax its edges', step: 3 },
    { text: 'Why stale heap entries are skipped, not decreased', step: 4 },
    { text: 'The non-negative weight requirement', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Hops are not cost',
      tag: 'problem',
      body: [
        'BFS finds the path with the fewest **edges**. With weighted edges the cheapest path can use more of them.',
        'Node 0 reaches node 2 directly for 4, or through node 1 for 1 + 2 = 3.',
      ],
      keyIdea: 'Weighted shortest path from one source with non-negative weights: Dijkstra.',
      frames: [{ state: hopsVsWeight(false), hold: 2400 }, { state: hopsVsWeight(true) }],
    },
    {
      label: 'The idea',
      title: 'Always expand the nearest',
      tag: 'concept',
      code: [2, 4],
      body: [
        'Keep `dist[]` as the best known distance to every node, starting at infinity except the source at 0. A **min-heap** of `[distance, node]` always yields the closest unfinished node.',
        'When a node is popped first, no shorter path can exist, because every edge is non-negative.',
      ],
      keyIdea: 'Popping the minimum finalizes it. Relaxing its edges offers better distances to its neighbours.',
      frames: [T[0]],
    },
    {
      label: 'The loop',
      title: 'Pop, relax, push',
      tag: 'technique',
      code: [3, 4, 6, 7, 8, 9],
      body: [
        'Pop the smallest `(d, u)`. For each edge `u to v` of weight `w`, if `d + w < dist[v]`, update `dist[v]` and push the new pair.',
        'Node 1 is popped at 1, which improves node 2 from 4 to 3 and sets node 3 to 7.',
      ],
      keyIdea: 'Each relaxation is a candidate path. The heap makes sure the best candidate is processed first.',
      frames: [T[1], T[2], T[3]],
    },
    {
      label: 'Stale entries',
      title: 'No decrease-key needed',
      tag: 'technique',
      code: [5],
      body: [
        'Node 2 was pushed at distance 4 and later at 3. Binary heaps cannot decrease a key, so the old pair `(4, 2)` stays in the heap.',
        'When it pops, `d > dist[u]` says a shorter path was already found, so it is skipped. Same for `(7, 3)`.',
      ],
      keyIdea: 'The check `if (d > dist[u]) continue` replaces decrease-key. Time is O((V + E) log V).',
      frames: T.slice(4),
    },
    {
      label: 'Negatives',
      title: 'Why weights must be non-negative',
      tag: 'trade-off',
      code: [7],
      body: [
        'Dijkstra finalizes a node the first time it is popped. A negative edge can make a longer route cheaper after that point.',
        'With negative weights use **Bellman-Ford**. Large weights may need `long` distances to avoid overflow.',
      ],
      keyIdea: 'No negative edges, no problem. Otherwise Dijkstra can give a wrong answer without warning.',
      frames: [{ state: negScene('finalized'), hold: 2600 }, { state: negScene('truth') }],
    },
    {
      label: 'Recap',
      title: 'Dijkstra in a nutshell',
      tag: 'recap',
      body: [
        '- **Use when:** shortest path, one source, non-negative weights. BFS if all edges cost the same.',
        '- **State:** `dist[]` at infinity, min-heap of `[distance, node]`.',
        '- **Loop:** pop, skip if stale, relax each edge, push improvements.',
        '- **Cost:** O((V + E) log V) time, O(V + E) space.',
        '- **Not for:** negative edges (Bellman-Ford). Use `long` for big weights.',
      ],
      keyIdea: 'Expand the closest unfinished node, and trust it, because nothing can be closer.',
      frames: [T.at(-1)!],
    },
  ],
});
