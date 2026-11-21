import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import type { Frame } from '../types';

/*
 * Frames come from running the real UnionFind class from the notes (path halving plus union by rank).
 * The forest is laid out from the live parent array, so every frame shows the actual structure.
 */

const N = 6;

/** Draw the parent array as a forest: roots on top, children below, edges pointing child to parent. */
function forest(parent: number[], rank: number[], states: Record<number, ItemState> = {}): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const kids: number[][] = Array.from({ length: parent.length }, () => []);
  parent.forEach((p, i) => p !== i && kids[p].push(i));
  const roots = parent.map((p, i) => (p === i ? i : -1)).filter((i) => i >= 0);
  const depthOf = new Map<number, number>();
  const leafOrder: number[] = [];
  const walk = (i: number, d: number) => {
    depthOf.set(i, d);
    if (!kids[i].length) leafOrder.push(i);
    kids[i].forEach((c) => walk(c, d + 1));
  };
  roots.forEach((r) => walk(r, 0));
  const xs = new Map<number, number>();
  leafOrder.forEach((l, k) => xs.set(l, 0.6 + ((k + 0.5) / leafOrder.length) * 8.8));
  const place = (i: number): number => {
    if (xs.has(i)) return xs.get(i)!;
    const cs = kids[i].map(place);
    const x = (Math.min(...cs) + Math.max(...cs)) / 2;
    xs.set(i, x);
    return x;
  };
  roots.forEach(place);
  const maxD = Math.max(...depthOf.values());
  const dy = Math.min(1.7, 4.4 / Math.max(maxD, 1));
  return {
    nodes: parent.map((p, i) => ({ id: `n${i}`, label: i, x: xs.get(i)!, y: 0.8 + depthOf.get(i)! * dy, state: states[i] ?? (p === i ? 'visited' : 'normal'), tag: p === i && rank[i] > 0 ? `rank ${rank[i]}` : undefined })),
    edges: parent.flatMap((p, i) => (p === i ? [] : [{ from: `n${i}`, to: `n${p}`, directed: true }])),
  };
}

const parentPanel = (parent: number[]) => ({ title: 'parent[]', kind: 'map' as const, items: parent.map((p, i) => `${i} -> ${p}`) });

class UnionFind {
  parent = Array.from({ length: N }, (_, i) => i);
  rank = new Array<number>(N).fill(0);
  components = N;
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): boolean {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return false;
    if (this.rank[ra] < this.rank[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    if (this.rank[ra] === this.rank[rb]) this.rank[ra]++;
    this.components--;
    return true;
  }
}

const OPS: [number, number][] = [[0, 1], [2, 3], [1, 3], [4, 5], [0, 3], [3, 5]];

function unionFrames(): Frame<GraphState>[] {
  const uf = new UnionFind();
  const frames: Frame<GraphState>[] = [];
  const f0 = forest(uf.parent, uf.rank);
  frames.push({ hold: 1500, state: { ...f0, panels: [parentPanel(uf.parent)], stats: [{ label: 'Components', value: String(N) }, { label: 'Each node', value: 'its own root' }, { label: 'Next', value: 'union(0, 1)' }], note: { text: 'start: six groups of one', tone: 'accent' } } });
  for (const [a, b] of OPS) {
    const ra = uf.find(a);
    const rb = uf.find(b);
    const merged = uf.union(a, b);
    const root = uf.find(a);
    const f = forest(uf.parent, uf.rank, merged ? { [root]: 'found', [ra === root ? rb : ra]: 'active' } : { [ra]: 'bad' });
    frames.push({
      hold: 2300,
      state: {
        ...f,
        panels: [parentPanel(uf.parent)],
        stats: [
          { label: 'union', value: `(${a}, ${b})` },
          { label: 'Roots', value: `${ra} and ${rb}` },
          { label: 'Components', value: String(uf.components), tone: merged ? 'ok' : 'neutral' },
        ],
        note: merged ? { text: `different roots: attach root ${root === ra ? rb : ra} under root ${root}`, tone: 'accent' } : { text: `same root ${ra}: already connected, this edge closes a cycle`, tone: 'bad' },
      },
    });
  }
  return frames;
}

// Path halving on a deliberately deep chain 4 -> 3 -> 2 -> 1 -> 0.
function halvingFrames(): Frame<GraphState>[] {
  const parent = [0, 0, 1, 2, 3, 5];
  const rank = new Array<number>(N).fill(0);
  const frames: Frame<GraphState>[] = [];
  const snap = (x: number, note: string, flash: Record<number, ItemState> = {}) => {
    const f = forest(parent, rank, { [x]: 'active', ...flash });
    frames.push({ hold: 2200, state: { ...f, panels: [parentPanel(parent)], stats: [{ label: 'find', value: '(4)' }, { label: 'At', value: String(x) }, { label: 'Depth of 4', value: String(depthOf(parent, 4)), tone: depthOf(parent, 4) > 2 ? 'bad' : 'ok' }], note: { text: note, tone: 'accent' } } });
  };
  let x = 4;
  snap(x, 'a long chain: find(4) must walk 4 steps');
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    snap(x, `parent[${x}] = its grandparent ${parent[x]}: skip a level`, { [parent[x]]: 'found' });
    x = parent[x];
  }
  snap(x, `reached the root ${x}: the chain is now about half as deep`);
  return frames;
}
const depthOf = (parent: number[], i: number) => {
  let d = 0;
  while (parent[i] !== i) {
    i = parent[i];
    d++;
  }
  return d;
};

const UNION_FRAMES = unionFrames();
const HALVING = halvingFrames();

export default defineLesson('graph', {
  slug: 'union-find',
  objectives: [
    { text: 'Model groups as a forest where the root names the group', step: 2 },
    { text: 'Union by rank keeps trees shallow', step: 3 },
    { text: 'Path halving flattens a chain during find', step: 4 },
    { text: 'Detect a cycle when union returns false', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Which things are connected?',
      tag: 'problem',
      body: [
        'You merge groups ("these two are friends") and ask "are these two in the same group?" many times.',
        'Re-running a graph search for each question costs O(n). **Union-Find** answers both in near constant time.',
      ],
      keyIdea: 'Use it for dynamic connectivity: friend circles, redundant connections, Kruskal, accounts merge, number of islands II.',
      frames: [UNION_FRAMES[0]],
    },
    {
      label: 'The forest',
      title: 'Every node points to a parent',
      tag: 'concept',
      body: [
        'Keep a `parent` array. A node whose parent is itself is a **root**, and the root names the group.',
        '`find(x)` follows parents up to the root. Two nodes are connected exactly when their roots match.',
      ],
      keyIdea: 'Merging two groups is one pointer change: attach one root under the other.',
      frames: [UNION_FRAMES[1], UNION_FRAMES[2]],
    },
    {
      label: 'Union by rank',
      title: 'Attach the shorter tree',
      tag: 'technique',
      body: [
        '`union(a, b)` finds both roots. If they differ, hang the lower **rank** (roughly height) under the higher one, and bump the rank only on a tie.',
        'This keeps trees shallow, so `find` stays fast. Each merge lowers the component count by one.',
      ],
      keyIdea: 'Always attach a root to a root. Never attach a root to a non-root, or the shape degrades.',
      frames: [UNION_FRAMES[3], UNION_FRAMES[4]],
    },
    {
      label: 'Path halving',
      title: 'Flatten while you search',
      tag: 'technique',
      body: [
        'During `find`, set each visited node\'s parent to its **grandparent** before stepping up. A long chain gets about half as deep every time it is searched.',
        'With rank plus path compression, each operation is effectively constant time (inverse Ackermann).',
      ],
      keyIdea: 'Path halving needs no recursion and no second pass. The structure repairs itself on use.',
      frames: HALVING,
    },
    {
      label: 'Cycles',
      title: 'Union returns false: a cycle',
      tag: 'trade-off',
      body: [
        'If both roots are already equal, the nodes were connected before this edge, so adding it closes a cycle. `union` returns `false`.',
        'That is cycle detection in an undirected graph for free, the heart of "redundant connection" and Kruskal\'s minimum spanning tree.',
      ],
      keyIdea: 'Process edges in order, and the first edge whose union returns false is a redundant one.',
      frames: [UNION_FRAMES[5], UNION_FRAMES[6]],
    },
    {
      label: 'Recap',
      title: 'The structure in one page',
      tag: 'recap',
      body: [
        '- **State:** `parent[]`, `rank[]`, and a `components` counter.',
        '- **find:** climb to the root, halving the path as you go.',
        '- **union:** find both roots, attach lower rank under higher, return false when already joined.',
        '- **Use for:** connected components, cycle detection, Kruskal, accounts merge, islands II.',
        '- **Cost:** near O(1) per operation, O(n) memory.',
      ],
      keyIdea: 'When the question is "same group?" and groups only merge, reach for Union-Find, not BFS.',
      frames: [UNION_FRAMES[6]],
    },
  ],
});
