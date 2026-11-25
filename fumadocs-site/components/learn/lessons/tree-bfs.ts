import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import { patch, treeLayout } from '../engines/layouts';
import type { Frame } from '../types';

/*
 * Frames come from running the real level-array BFS from the notes, so every level, view and depth is correct.
 * Node ids match treeLayout: `t{index}` in the level-order input.
 */

type TNode = { id: string; val: number; left?: TNode; right?: TNode };

/** Same construction as treeLayout, so ids line up with the drawn nodes. */
function build(values: (number | null)[]): TNode | undefined {
  if (!values.length || values[0] === null) return undefined;
  const root: TNode = { id: 't0', val: values[0] };
  const queue: TNode[] = [root];
  let i = 1;
  while (queue.length && i < values.length) {
    const cur = queue.shift()!;
    for (const side of ['left', 'right'] as const) {
      if (i >= values.length) break;
      const v = values[i];
      if (v !== null) {
        const child: TNode = { id: `t${i}`, val: v };
        cur[side] = child;
        queue.push(child);
      }
      i++;
    }
  }
  return root;
}

const children = (n: TNode) => [n.left, n.right].filter((c): c is TNode => !!c);
const vals = (level: TNode[]) => level.map((n) => n.val).join(', ');

/** All levels of the tree, top to bottom, using the two-array style. */
function levelsOf(root: TNode): TNode[][] {
  const out: TNode[][] = [];
  let level = [root];
  while (level.length) {
    out.push(level);
    level = level.flatMap(children);
  }
  return out;
}

const T1 = [3, 9, 20, null, null, 15, 7];
const T1_LAYOUT = treeLayout(T1);
const T1_ROOT = build(T1)!;
const T1_LEVELS = levelsOf(T1_ROOT);

function paint(nodes: GraphNode[], states: Record<string, ItemState>, tags: Record<string, string> = {}): GraphNode[] {
  const changes: Record<string, Partial<GraphNode>> = {};
  for (const n of nodes) {
    const c: Partial<GraphNode> = {};
    if (states[n.id]) c.state = states[n.id];
    if (tags[n.id]) c.tag = tags[n.id];
    changes[n.id] = c;
  }
  return patch(nodes, changes);
}

const edgeStates = (edges: GraphEdge[], states: Record<string, ItemState>): GraphEdge[] =>
  edges.map((e) => (states[e.to] && states[e.to] !== 'normal' && states[e.to] !== 'dim' ? { ...e, state: 'visited' as const } : e));

// Step 1: the question. Highlight the rows the answer wants.
function problemFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [
    {
      hold: 1500,
      state: {
        nodes: T1_LAYOUT.nodes,
        edges: T1_LAYOUT.edges,
        panels: [{ title: 'want', kind: 'list', items: [] }],
        stats: [
          { label: 'Nodes', value: '5' },
          { label: 'Levels', value: '3' },
          { label: 'Output rows', value: '3' },
        ],
        note: { text: 'return the values row by row', tone: 'accent' },
      },
    },
  ];
  const rows: string[] = [];
  T1_LEVELS.forEach((level, d) => {
    rows.push(`[${vals(level)}]`);
    const states: Record<string, ItemState> = {};
    const tags: Record<string, string> = {};
    T1_LEVELS.forEach((l, dd) => l.forEach((n) => (states[n.id] = dd < d ? 'done' : dd === d ? 'active' : 'normal')));
    level.forEach((n) => (tags[n.id] = `level ${d}`));
    frames.push({
      hold: 1200,
      state: {
        nodes: paint(T1_LAYOUT.nodes, states, tags),
        edges: T1_LAYOUT.edges,
        panels: [{ title: 'want', kind: 'list', items: [...rows], highlight: d }],
        stats: [
          { label: 'Level', value: String(d) },
          { label: 'Nodes here', value: String(level.length) },
          { label: 'Output rows', value: `${d + 1} / 3` },
        ],
      },
    });
  });
  frames[frames.length - 1].state.note = { text: 'a node does not know its depth: the traversal must track it', tone: 'accent' };
  return frames;
}

/** Level-order run. `upto` limits how many levels are shown, `withNext` adds the child-collecting frame. */
function levelOrderFrames(root: TNode, layout: { nodes: GraphNode[]; edges: GraphEdge[] }, opts: { upto?: number } = {}): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  const result: string[] = [];
  const done = new Set<string>();
  let level = [root];
  let d = 0;
  const limit = opts.upto ?? Infinity;
  while (level.length > 0 && d < limit) {
    result.push(`[${vals(level)}]`);
    const states: Record<string, ItemState> = {};
    done.forEach((id) => (states[id] = 'done'));
    level.forEach((n) => (states[n.id] = 'active'));
    frames.push({
      hold: 1100,
      state: {
        nodes: paint(layout.nodes, states),
        edges: edgeStates(layout.edges, states),
        panels: [
          { title: 'level', kind: 'queue', items: level.map((n) => String(n.val)) },
          { title: 'result', kind: 'list', items: [...result], highlight: result.length - 1 },
        ],
        stats: [
          { label: 'Level', value: String(d) },
          { label: 'level.length', value: String(level.length), hint: 'nodes in this level' },
          { label: 'Rows', value: String(result.length) },
        ],
        note: { text: `push [${vals(level)}] as one row`, tone: 'accent' },
      },
    });
    const next = level.flatMap(children);
    level.forEach((n) => done.add(n.id));
    if (next.length) {
      const st2: Record<string, ItemState> = {};
      done.forEach((id) => (st2[id] = 'done'));
      next.forEach((n) => (st2[n.id] = 'visited'));
      frames.push({
        hold: 1100,
        state: {
          nodes: paint(layout.nodes, st2),
          edges: edgeStates(layout.edges, st2),
          panels: [
            { title: 'next', kind: 'queue', items: next.map((n) => String(n.val)) },
            { title: 'result', kind: 'list', items: [...result] },
          ],
          stats: [
            { label: 'Level', value: String(d) },
            { label: 'next.length', value: String(next.length) },
            { label: 'Rows', value: String(result.length) },
          ],
          note: { text: 'collect left and right children, then level = next' },
        },
      });
    }
    level = next;
    d++;
  }
  return frames;
}

const LEVEL_RUN = levelOrderFrames(T1_ROOT, T1_LAYOUT);
const finalStates: Record<string, ItemState> = Object.fromEntries(T1_LAYOUT.nodes.map((n) => [n.id, 'done' as const]));
LEVEL_RUN.push({
  state: {
    nodes: paint(T1_LAYOUT.nodes, finalStates),
    edges: edgeStates(T1_LAYOUT.edges, finalStates),
    panels: [
      { title: 'level', kind: 'queue', items: [] },
      { title: 'result', kind: 'list', items: T1_LEVELS.map((l) => `[${vals(l)}]`) },
    ],
    stats: [
      { label: 'Result', value: '3 rows', tone: 'ok' },
      { label: 'Time', value: 'O(n)' },
      { label: 'Space', value: 'O(w)', hint: 'widest level' },
    ],
    note: { text: 'next is empty: [[3], [9, 20], [15, 7]]', tone: 'ok' },
  },
});

// Step 2: one level becomes the next, shown on the first two levels only.
const CONCEPT = levelOrderFrames(T1_ROOT, T1_LAYOUT, { upto: 2 }).slice(0, 3);

// Step 4: right side view of [1, 2, 3, null, 5, null, 4].
const T2 = [1, 2, 3, null, 5, null, 4];
const T2_LAYOUT = treeLayout(T2);
const T2_ROOT = build(T2)!;

function rightViewFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  const view: number[] = [];
  const done = new Set<string>();
  const seen = new Set<string>();
  let level = [T2_ROOT];
  let d = 0;
  while (level.length > 0) {
    const last = level[level.length - 1];
    view.push(last.val);
    seen.add(last.id);
    const states: Record<string, ItemState> = {};
    done.forEach((id) => (states[id] = seen.has(id) ? 'found' : 'dim'));
    level.forEach((n) => (states[n.id] = 'active'));
    states[last.id] = 'found';
    frames.push({
      hold: 1300,
      state: {
        nodes: paint(T2_LAYOUT.nodes, states, { [last.id]: 'seen' }),
        edges: T2_LAYOUT.edges,
        pointers: [{ node: last.id, label: 'level[len - 1]', up: true }],
        panels: [
          { title: 'level', kind: 'queue', items: level.map((n) => String(n.val)), highlight: level.length - 1 },
          { title: 'view', kind: 'list', items: view.map(String), highlight: view.length - 1 },
        ],
        stats: [
          { label: 'Level', value: String(d) },
          { label: 'Last node', value: String(last.val), tone: 'ok' },
          { label: 'View', value: `[${view.join(', ')}]` },
        ],
      },
    });
    level.forEach((n) => done.add(n.id));
    level = level.flatMap(children);
    d++;
  }
  frames[frames.length - 1].state.note = { text: 'right side view: [1, 3, 4]', tone: 'ok' };
  return frames;
}

// Step 5: minimum depth stops at the first leaf.
function minDepthFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  const seenIds = new Set<string>();
  let depth = 1;
  let level = [T1_ROOT];
  while (level.length > 0) {
    const next: TNode[] = [];
    for (const node of level) {
      seenIds.add(node.id);
      const leaf = !node.left && !node.right;
      const states: Record<string, ItemState> = {};
      seenIds.forEach((id) => (states[id] = 'visited'));
      states[node.id] = leaf ? 'found' : 'active';
      frames.push({
        hold: leaf ? 1600 : 1000,
        state: {
          nodes: paint(T1_LAYOUT.nodes, states, { [node.id]: leaf ? 'leaf' : `depth ${depth}` }),
          edges: edgeStates(T1_LAYOUT.edges, states),
          pointers: [{ node: node.id, label: 'node', up: true }],
          stats: [
            { label: 'depth', value: String(depth), tone: leaf ? 'ok' : 'neutral' },
            { label: 'Is leaf', value: leaf ? 'yes' : 'no', tone: leaf ? 'ok' : 'neutral' },
            { label: 'Nodes seen', value: `${seenIds.size} / 5` },
          ],
          note: leaf ? { text: `first leaf at depth ${depth}: return now`, tone: 'ok' } : undefined,
        },
      });
      if (leaf) {
        // Show the part of the tree BFS never touched.
        const st: Record<string, ItemState> = {};
        T1_LAYOUT.nodes.forEach((n) => (st[n.id] = seenIds.has(n.id) ? 'visited' : 'dim'));
        st[node.id] = 'found';
        frames.push({
          state: {
            nodes: paint(T1_LAYOUT.nodes, st, { [node.id]: 'leaf' }),
            edges: edgeStates(T1_LAYOUT.edges, st),
            stats: [
              { label: 'minDepth', value: String(depth), tone: 'ok' },
              { label: 'Nodes seen', value: `${seenIds.size} / 5` },
              { label: 'Skipped', value: String(5 - seenIds.size), tone: 'ok' },
            ],
            note: { text: '15 and 7 are never visited', tone: 'ok' },
          },
        });
        return frames;
      }
      next.push(...children(node));
    }
    level = next;
    depth++;
  }
  return frames;
}

// Step 6: memory is the widest level. A complete tree of 15 nodes.
const FULL = Array.from({ length: 15 }, (_, i) => i + 1);
const FULL_LAYOUT = treeLayout(FULL);
const FULL_LEVELS = levelsOf(build(FULL)!);

function widthFrames(): Frame<GraphState>[] {
  const done = new Set<string>();
  return FULL_LEVELS.map((level, d) => {
    const states: Record<string, ItemState> = {};
    done.forEach((id) => (states[id] = 'done'));
    level.forEach((n) => (states[n.id] = 'active'));
    level.forEach((n) => done.add(n.id));
    const last = d === FULL_LEVELS.length - 1;
    return {
      hold: last ? 2000 : 1000,
      state: {
        nodes: paint(FULL_LAYOUT.nodes, states),
        edges: edgeStates(FULL_LAYOUT.edges, states),
        stats: [
          { label: 'In memory', value: `${level.length} nodes`, tone: last ? 'bad' : 'neutral' },
          { label: 'n', value: '15' },
          { label: 'Space', value: 'O(w)', hint: 'w = widest level' },
        ],
        note: last ? { text: 'last level of a complete tree: about n / 2 nodes at once', tone: 'bad' } : undefined,
      },
    };
  });
}

// Step 7: multi-source BFS on the rotting oranges grid.
const ORANGES = [
  [2, 1, 1],
  [1, 1, 0],
  [0, 1, 1],
];
const cellId = (r: number, c: number) => `g${r}${c}`;
const CELL_NODES: GraphNode[] = ORANGES.flatMap((row, r) => row.map((v, c) => ({ id: cellId(r, c), label: v, x: 2 + c * 2, y: 0.6 + r * 1.9, shape: 'box' as const })));
const CELL_EDGES: GraphEdge[] = [];
ORANGES.forEach((row, r) =>
  row.forEach((v, c) => {
    if (!v) return;
    if (c + 1 < row.length && row[c + 1]) CELL_EDGES.push({ from: cellId(r, c), to: cellId(r, c + 1) });
    if (r + 1 < ORANGES.length && ORANGES[r + 1][c]) CELL_EDGES.push({ from: cellId(r, c), to: cellId(r + 1, c) });
  }),
);

function orangeFrames(): Frame<GraphState>[] {
  const grid = ORANGES.map((r) => [...r]);
  const rotAt: Record<string, number> = {};
  let fresh = 0;
  let queue: [number, number][] = [];
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v === 2) {
        queue.push([r, c]);
        rotAt[cellId(r, c)] = 0;
      } else if (v === 1) fresh++;
    }),
  );
  const frames: Frame<GraphState>[] = [];
  const snap = (minutes: number, wave: [number, number][]) => {
    const waveIds = new Set(wave.map(([r, c]) => cellId(r, c)));
    const nodes = CELL_NODES.map((n) => {
      const r = Number(n.id[1]);
      const c = Number(n.id[2]);
      const v = grid[r][c];
      const state: ItemState = v === 0 ? 'dim' : v === 1 ? 'path' : waveIds.has(n.id) ? 'active' : 'bad';
      return { ...n, label: v, state, tag: rotAt[n.id] !== undefined ? `min ${rotAt[n.id]}` : undefined };
    });
    frames.push({
      hold: 1300,
      state: {
        nodes,
        edges: CELL_EDGES,
        panels: [{ title: 'queue', kind: 'queue', items: wave.map(([r, c]) => `(${r},${c})`) }],
        stats: [
          { label: 'Minute', value: String(minutes) },
          { label: 'Fresh left', value: String(fresh), tone: fresh === 0 ? 'ok' : 'neutral' },
          { label: 'This wave', value: String(wave.length) },
        ],
      },
    });
  };
  snap(0, queue);
  frames[0].state.note = { text: 'start with every rotten orange in the queue', tone: 'accent' };
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let minutes = 0;
  while (queue.length > 0 && fresh > 0) {
    const next: [number, number][] = [];
    for (const [r, c] of queue) {
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3 && grid[nr][nc] === 1) {
          grid[nr][nc] = 2;
          fresh--;
          next.push([nr, nc]);
        }
      }
    }
    queue = next;
    minutes++;
    next.forEach(([r, c]) => (rotAt[cellId(r, c)] = minutes));
    snap(minutes, next);
  }
  frames[frames.length - 1].state.note = { text: `no fresh oranges left after ${minutes} minutes`, tone: 'ok' };
  return frames;
}

const RECAP_STATES: Record<string, ItemState> = Object.fromEntries(T1_LAYOUT.nodes.map((n) => [n.id, 'done' as const]));
const RECAP: GraphState = {
  nodes: paint(T1_LAYOUT.nodes, RECAP_STATES, Object.fromEntries(T1_LEVELS.flatMap((l, d) => l.map((n) => [n.id, `level ${d}`])))),
  edges: edgeStates(T1_LAYOUT.edges, RECAP_STATES),
  panels: [{ title: 'result', kind: 'list', items: T1_LEVELS.map((l) => `[${vals(l)}]`) }],
  stats: [
    { label: 'Time', value: 'O(n)', tone: 'ok' },
    { label: 'Space', value: 'O(w)', hint: 'widest level' },
    { label: 'Per level', value: 'one row' },
  ],
};

export default defineLesson('isoGraph', {
  slug: 'tree-bfs',
  pseudocode: [
    'queue = [root]',
    'while queue is not empty:',
    '    size = length of queue',
    '    repeat size times:',
    '        node = dequeue',
    '        visit node',
    '        enqueue node.left and node.right',
    '    the level is finished',
  ],
  objectives: [
    { text: 'Recognise "by level" problems that want BFS', step: 1 },
    { text: 'Run the level-array template without shift()', step: 3 },
    { text: 'Adapt it for right side view and minimum depth', step: 5 },
    { text: 'Use multi-source BFS for "distance to nearest X"', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Answer the tree row by row',
      tag: 'problem',
      code: [1],
      body: [
        'Return the values of `[3, 9, 20, null, null, 15, 7]` grouped **by level**: `[[3], [9, 20], [15, 7]]`.',
        'Nodes only point to their children. Nothing tells you which row a node sits on, so the traversal has to keep the rows apart.',
      ],
      keyIdea: 'Level order, "by row", "depth k", side views, minimum depth, and unweighted shortest paths all point to BFS.',
      frames: problemFrames(),
    },
    {
      label: 'Levels',
      title: 'Process one full level at a time',
      tag: 'concept',
      code: [3, 4],
      body: [
        'Keep the current level as an array. Read all its values as one row.',
        'Then build `next` from the left and right children of every node in the level, and replace `level` with `next`.',
      ],
      keyIdea: 'The level boundary is explicit: everything in `level` has the same depth, everything in `next` is one deeper.',
      frames: CONCEPT,
    },
    {
      label: 'Full run',
      title: 'Level order, start to finish',
      tag: 'technique',
      code: [2, 3, 4, 5, 6, 7, 8],
      body: [
        'Each pass of the loop pushes one row and builds the next level. When `next` is empty, the tree is done.',
        'Every node is read once and pushed once, so the run is **O(n)**.',
      ],
      keyIdea: 'Two arrays instead of `queue.shift()`: O(1) per node and no off-by-one on level sizes.',
      frames: LEVEL_RUN,
    },
    {
      label: 'Right view',
      title: 'Right side view: the last of each level',
      tag: 'technique',
      code: [6],
      body: [
        'Standing on the right of `[1, 2, 3, null, 5, null, 4]`, you see the **last node of every level**.',
        'Same loop, but each level contributes `level[level.length - 1]` instead of the whole row. The left view takes the first node.',
      ],
      keyIdea: 'Most BFS variants keep the loop and change only what you record per level.',
      frames: rightViewFrames(),
    },
    {
      label: 'Min depth',
      title: 'Minimum depth stops at the first leaf',
      tag: 'technique',
      code: [6, 7],
      body: [
        'BFS visits nodes in order of depth, so the **first leaf** it meets is the shallowest one.',
        'Return right there. On the example, 9 is a leaf at depth 2 and the nodes below 20 are never visited.',
      ],
      keyIdea: 'Shallowest-first order lets BFS stop early, which beats DFS on skewed trees.',
      frames: minDepthFrames(),
    },
    {
      label: 'Memory',
      title: 'BFS holds a whole level',
      tag: 'trade-off',
      code: [3],
      body: [
        'Time is O(n). Space is **O(w)**, the widest level, which is up to n / 2 for a complete tree.',
        'With `queue.shift()` each pop is O(n) on large arrays, so a 10^5 node tree can go quadratic. The two-array style avoids it.',
      ],
      keyIdea: 'Wide trees cost BFS memory. Weighted shortest paths need Dijkstra, not BFS.',
      frames: widthFrames(),
    },
    {
      label: 'Multi-source',
      title: 'Many starts at once: rotting oranges',
      tag: 'in practice',
      code: [1],
      body: [
        'Every minute, each rotten orange (2) rots its fresh (1) neighbours. Start the queue with **all** rotten oranges at once.',
        'Each BFS layer is one minute. Mark a cell when it is pushed, not when it is popped, so it never enters twice.',
      ],
      keyIdea: 'Multi-source BFS solves "distance to nearest X" in one pass instead of one BFS per cell.',
      frames: orangeFrames(),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** by level, row, depth k, side view, minimum depth, unweighted shortest path.',
        '- **Template:** `level = [root]`, push its values, build `next` from the children, repeat.',
        '- **Variants:** record the last (right view), stop at the first leaf (min depth), seed many sources (grids).',
        '- **Cost:** O(n) time, O(w) space for the widest level.',
        '- **Pitfalls:** reading `queue.length` while pushing to it, BFS on weighted graphs, marking visited on pop.',
      ],
      keyIdea: 'BFS explores by distance from the start, one layer at a time.',
      frames: [{ state: RECAP }],
    },
  ],
});
