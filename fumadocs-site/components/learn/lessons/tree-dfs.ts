import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import { patch, treeLayout } from '../engines/layouts';
import type { Frame } from '../types';

/*
 * Every frame comes from running the DFS code in the notes on the notes' own inputs.
 * Node ids match treeLayout: `t{index}` in the level-order input.
 */

type TNode = { id: string; val: number; left?: TNode; right?: TNode };
type Layout = { nodes: GraphNode[]; edges: GraphEdge[] };

/** Same construction as treeLayout, so ids line up with the drawn nodes. */
function build(values: (number | null)[]): TNode {
  const root: TNode = { id: 't0', val: values[0] as number };
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

function paint(layout: Layout, states: Record<string, ItemState>, tags: Record<string, string> = {}): Pick<GraphState, 'nodes' | 'edges'> {
  const changes: Record<string, Partial<GraphNode>> = {};
  for (const n of layout.nodes) changes[n.id] = { state: states[n.id], tag: tags[n.id] };
  const lit = (s?: ItemState) => s === 'path' || s === 'found' || s === 'done';
  return {
    nodes: patch(layout.nodes, changes),
    edges: layout.edges.map((e) => (lit(states[e.from]) && lit(states[e.to]) ? { ...e, state: states[e.to] === 'done' ? ('done' as const) : ('path' as const) } : e)),
  };
}

// The path sum tree from the notes, target 22.
const PS = [5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1];
const PS_LAYOUT = treeLayout(PS);
const PS_ROOT = build(PS);
const TARGET = 22;

type PathEvent = { path: TNode[]; rem: number[]; ok: boolean; found: number[][] };

/** pathSum from the notes, recording each leaf it reaches. */
function pathSumRun(): PathEvent[] {
  const events: PathEvent[] = [];
  const result: number[][] = [];
  const path: TNode[] = [];
  const rems: number[] = [];
  (function dfs(node: TNode | undefined, remaining: number) {
    if (!node) return;
    path.push(node);
    rems.push(remaining);
    const leaf = !node.left && !node.right;
    if (leaf) {
      const ok = remaining === node.val;
      if (ok) result.push(path.map((n) => n.val));
      events.push({ path: [...path], rem: [...rems], ok, found: result.map((r) => [...r]) });
    }
    dfs(node.left, remaining - node.val);
    dfs(node.right, remaining - node.val);
    path.pop();
    rems.pop();
  })(PS_ROOT, TARGET);
  return events;
}
const PATH_EVENTS = pathSumRun();

function problemFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [
    {
      hold: 1500,
      state: {
        ...paint(PS_LAYOUT, {}),
        stats: [
          { label: 'Target', value: String(TARGET) },
          { label: 'Leaves', value: '4' },
          { label: 'Paths found', value: '0' },
        ],
        note: { text: 'find every root-to-leaf path that sums to 22', tone: 'accent' },
      },
    },
  ];
  PATH_EVENTS.filter((e) => e.ok).forEach((e, k) => {
    const states: Record<string, ItemState> = {};
    e.path.forEach((n) => (states[n.id] = 'path'));
    states[e.path[e.path.length - 1].id] = 'found';
    frames.push({
      hold: 1800,
      state: {
        ...paint(PS_LAYOUT, states),
        stats: [
          { label: 'Target', value: String(TARGET) },
          { label: 'Path', value: e.path.map((n) => n.val).join('+') },
          { label: 'Paths found', value: String(k + 1), tone: 'ok' },
        ],
        note: { text: 'the answer is a whole path, not a level', tone: 'accent' },
      },
    });
  });
  return frames;
}

// Pass state down: remaining sum travels as a parameter.
function pathSumFrames(): Frame<GraphState>[] {
  return PATH_EVENTS.map((e) => {
    const states: Record<string, ItemState> = {};
    const tags: Record<string, string> = {};
    e.path.forEach((n, i) => {
      states[n.id] = 'path';
      tags[n.id] = `rem ${e.rem[i]}`;
    });
    const leaf = e.path[e.path.length - 1];
    states[leaf.id] = e.ok ? 'found' : 'bad';
    return {
      hold: 1500,
      state: {
        ...paint(PS_LAYOUT, states, tags),
        panels: [
          { title: 'path', kind: 'stack', items: e.path.map((n) => String(n.val)) },
          { title: 'result', kind: 'list', items: e.found.map((r) => `[${r.join(',')}]`) },
        ],
        stats: [
          { label: 'Leaf', value: String(leaf.val) },
          { label: 'remaining', value: String(e.rem[e.rem.length - 1]), hint: 'must equal the leaf' },
          { label: 'Match', value: e.ok ? 'yes' : 'no', tone: e.ok ? 'ok' : 'bad' },
        ],
        note: e.ok ? { text: 'save a copy: [...path]', tone: 'ok' } : { text: 'not 22: pop and try the next branch', tone: 'bad' },
      },
    };
  });
}

// A BST, used for the three orders and iterative inorder.
const BST = [4, 2, 6, 1, 3, 5, 7];
const BST_LAYOUT = treeLayout(BST);
const BST_ROOT = build(BST);

function order(kind: 'pre' | 'in' | 'post'): TNode[] {
  const out: TNode[] = [];
  (function visit(n?: TNode) {
    if (!n) return;
    if (kind === 'pre') out.push(n);
    visit(n.left);
    if (kind === 'in') out.push(n);
    visit(n.right);
    if (kind === 'post') out.push(n);
  })(BST_ROOT);
  return out;
}

function ordersFrames(): Frame<GraphState>[] {
  const kinds = [
    { k: 'pre' as const, name: 'Preorder', seq: 'node, L, R', use: 'pass info down' },
    { k: 'in' as const, name: 'Inorder', seq: 'L, node, R', use: 'sorted BST' },
    { k: 'post' as const, name: 'Postorder', seq: 'L, R, node', use: 'bubble up' },
  ];
  return kinds.map(({ k, name, seq, use }) => {
    const seqNodes = order(k);
    const tags: Record<string, string> = {};
    const states: Record<string, ItemState> = {};
    seqNodes.forEach((n, i) => {
      tags[n.id] = `#${i + 1}`;
      states[n.id] = 'visited';
    });
    states[seqNodes[0].id] = 'active';
    return {
      hold: 2400,
      state: {
        ...paint(BST_LAYOUT, states, tags),
        panels: [{ title: name, kind: 'list', items: [seqNodes.map((n) => n.val).join(' ')] }],
        stats: [
          { label: 'Order', value: name },
          { label: 'Visit', value: seq },
          { label: 'Use for', value: use },
        ],
        note: k === 'in' ? { text: 'inorder on a BST: 1 2 3 4 5 6 7, ascending', tone: 'ok' } : undefined,
      },
    };
  });
}

// Iterative inorder with an explicit stack.
function inorderFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  const result: TNode[] = [];
  const stack: TNode[] = [];
  let curr: TNode | undefined = BST_ROOT;
  while (curr || stack.length > 0) {
    while (curr) {
      stack.push(curr);
      curr = curr.left;
    }
    const top = stack.pop()!;
    result.push(top);
    const states: Record<string, ItemState> = {};
    stack.forEach((n) => (states[n.id] = 'visited'));
    result.forEach((n) => (states[n.id] = 'done'));
    states[top.id] = 'active';
    frames.push({
      hold: 1000,
      state: {
        ...paint(BST_LAYOUT, states),
        pointers: [{ node: top.id, label: 'pop', up: true }],
        panels: [
          { title: 'stack', kind: 'stack', items: stack.map((n) => String(n.val)) },
          { title: 'result', kind: 'list', items: [result.map((n) => n.val).join(' ')] },
        ],
        stats: [
          { label: 'Popped', value: String(top.val) },
          { label: 'Stack size', value: String(stack.length) },
          { label: 'Output', value: `${result.length} / 7` },
        ],
        note: result.length === 1 ? { text: 'push the whole left chain, then pop', tone: 'accent' } : undefined,
      },
    });
    curr = top.right;
  }
  frames[frames.length - 1].state.note = { text: 'ascending order, no recursion', tone: 'ok' };
  return frames;
}

// Return state up: max depth on [3, 9, 20, null, null, 15, 7].
const T1 = [3, 9, 20, null, null, 15, 7];
const T1_LAYOUT = treeLayout(T1);
const T1_ROOT = build(T1);

function depthFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  const h: Record<string, number> = {};
  const states: Record<string, ItemState> = {};
  const tags: Record<string, string> = {};
  (function maxDepth(n?: TNode): number {
    if (!n) return 0;
    const l = maxDepth(n.left);
    const r = maxDepth(n.right);
    h[n.id] = 1 + Math.max(l, r);
    Object.keys(states).forEach((id) => (states[id] = 'done'));
    states[n.id] = 'active';
    tags[n.id] = `h ${h[n.id]}`;
    frames.push({
      hold: 1200,
      state: {
        ...paint(T1_LAYOUT, { ...states }, { ...tags }),
        stats: [
          { label: 'Node', value: String(n.val) },
          { label: 'From children', value: `${l}, ${r}` },
          { label: 'Returns', value: `1 + ${Math.max(l, r)} = ${h[n.id]}` },
        ],
      },
    });
    return h[n.id];
  })(T1_ROOT);
  frames[frames.length - 1].state.note = { text: 'children answer first, the parent combines: postorder', tone: 'ok' };
  return frames;
}

// Global best: max path sum on [-10, 9, 20, null, null, 15, 7].
const MP = [-10, 9, 20, null, null, 15, 7];
const MP_LAYOUT = treeLayout(MP);
const MP_ROOT = build(MP);

function maxPathFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  const tags: Record<string, string> = {};
  const done = new Set<string>();
  let best = -Infinity;
  (function gain(n?: TNode): number {
    if (!n) return 0;
    const left = Math.max(0, gain(n.left));
    const right = Math.max(0, gain(n.right));
    const through = n.val + left + right;
    const improved = through > best;
    best = Math.max(best, through);
    const ret = n.val + Math.max(left, right);
    tags[n.id] = `gain ${ret}`;
    const states: Record<string, ItemState> = {};
    done.forEach((id) => (states[id] = 'done'));
    states[n.id] = 'active';
    done.add(n.id);
    frames.push({
      hold: 1500,
      state: {
        ...paint(MP_LAYOUT, states, { ...tags }),
        stats: [
          { label: 'Through node', value: `${n.val}+${left}+${right}=${through}` },
          { label: 'best', value: String(best), tone: improved ? 'ok' : 'neutral' },
          { label: 'Returns up', value: String(ret), hint: 'one side only' },
        ],
      },
    });
    return ret;
  })(MP_ROOT);
  const ids = { n15: 't5', n20: 't2', n7: 't6' };
  frames.push({
    state: {
      ...paint(MP_LAYOUT, { t0: 'dim', t1: 'dim', [ids.n15]: 'found', [ids.n20]: 'found', [ids.n7]: 'found' }, tags),
      edges: MP_LAYOUT.edges.map((e) => (e.from === 't2' ? { ...e, state: 'found' as const } : { ...e, state: 'dim' as const })),
      stats: [
        { label: 'Answer', value: String(best), tone: 'ok' },
        { label: 'Path', value: '15+20+7' },
        { label: 'Time', value: 'O(n)', hint: 'O(h) stack' },
      ],
      note: { text: 'the best path bends through 20: kept in a global', tone: 'ok' },
    },
  });
  return frames;
}

// BFS or DFS: a skewed chain and a wide tree.
const CHAIN: GraphNode[] = [0, 1, 2, 3, 4].map((i) => ({ id: `c${i}`, label: i + 1, x: 0.6 + i * 0.8, y: 0.3 + i * 1.2 }));
const WIDE: GraphNode[] = [
  { id: 'w0', label: 1, x: 7.4, y: 0.6 },
  { id: 'w1', label: 2, x: 5.9, y: 2.5 },
  { id: 'w2', label: 3, x: 8.9, y: 2.5 },
  { id: 'w3', label: 4, x: 5.2, y: 4.4 },
  { id: 'w4', label: 5, x: 6.5, y: 4.4 },
  { id: 'w5', label: 6, x: 8.3, y: 4.4 },
  { id: 'w6', label: 7, x: 9.6, y: 4.4 },
];
const SHAPE_EDGES: GraphEdge[] = [
  ...[0, 1, 2, 3].map((i) => ({ from: `c${i}`, to: `c${i + 1}` })),
  { from: 'w0', to: 'w1' },
  { from: 'w0', to: 'w2' },
  { from: 'w1', to: 'w3' },
  { from: 'w1', to: 'w4' },
  { from: 'w2', to: 'w5' },
  { from: 'w2', to: 'w6' },
];
const shapes = (st: Record<string, ItemState>, tags: Record<string, string> = {}): Pick<GraphState, 'nodes' | 'edges'> => paint({ nodes: [...CHAIN, ...WIDE], edges: SHAPE_EDGES }, st, tags);

const TRADE: Frame<GraphState>[] = [
  {
    hold: 2200,
    state: {
      ...shapes({ c0: 'bad', c1: 'bad', c2: 'bad', c3: 'bad', c4: 'bad' }, { c4: 'stack 5 deep' }),
      stats: [
        { label: 'Skewed tree', value: 'h = n', tone: 'bad' },
        { label: 'Recursive DFS', value: 'O(n) stack', tone: 'bad' },
        { label: 'Prefer', value: 'BFS / iterative' },
      ],
      note: { text: 'a 10^5 node chain can overflow the recursion stack', tone: 'bad' },
    },
  },
  {
    hold: 2200,
    state: {
      ...shapes({ w3: 'bad', w4: 'bad', w5: 'bad', w6: 'bad' }, { w4: 'BFS holds 4' }),
      stats: [
        { label: 'Wide tree', value: 'big levels', tone: 'bad' },
        { label: 'BFS', value: 'O(width)', tone: 'bad' },
        { label: 'Prefer', value: 'DFS' },
      ],
      note: { text: 'BFS keeps a whole level in memory', tone: 'bad' },
    },
  },
  {
    state: {
      ...shapes({ c0: 'visited', c1: 'visited', c2: 'visited', c3: 'visited', c4: 'visited', w0: 'done', w1: 'done', w2: 'done', w3: 'done', w4: 'done', w5: 'done', w6: 'done' }),
      stats: [
        { label: 'Fewest steps', value: 'BFS' },
        { label: 'Paths, subtrees', value: 'DFS' },
        { label: 'Both', value: 'O(n) time', tone: 'ok' },
      ],
    },
  },
];

const RECAP_ST: Record<string, ItemState> = { t0: 'done', t1: 'done', t2: 'found', t5: 'found', t6: 'found' };

export default defineLesson('graph', {
  slug: 'tree-dfs',
  objectives: [
    { text: 'Pick preorder, inorder or postorder from what each node needs', step: 2 },
    { text: 'Pass state down as parameters and backtrack', step: 4 },
    { text: 'Return state up from children (postorder)', step: 5 },
    { text: 'Keep a global best when the answer bends through a node', step: 6 },
    { text: 'Choose between BFS and DFS by tree shape', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Answers that live on paths',
      tag: 'problem',
      body: [
        'Find every root-to-leaf path in this tree that sums to **22**.',
        'Levels do not help here. You need to follow one path all the way down, remember it, then back up and try the next.',
      ],
      keyIdea: 'Path sums, heights, diameters, validity, all routes: anything about paths or subtrees wants DFS.',
      frames: problemFrames(),
    },
    {
      label: 'Three orders',
      title: 'When do you touch the node?',
      tag: 'concept',
      body: [
        '**Preorder** (node, left, right) passes information down. **Inorder** (left, node, right) gives sorted order in a BST. **Postorder** (left, right, node) needs the children first.',
        'Tags show the visit order on the BST `[4, 2, 6, 1, 3, 5, 7]`.',
      ],
      keyIdea: 'Choose the order from when you need the node relative to its children.',
      frames: ordersFrames(),
    },
    {
      label: 'Stack',
      title: 'Inorder with an explicit stack',
      tag: 'technique',
      body: [
        'Push the whole left chain, pop one node, output it, then move to its right child and repeat.',
        'Recursion depth can overflow on a 10^5 node skewed tree. The explicit stack does the same walk without it.',
      ],
      keyIdea: 'On a BST, inorder is ascending. That is why kth smallest and validate BST have inorder solutions.',
      frames: inorderFrames(),
    },
    {
      label: 'Pass down',
      title: 'Carry the remaining sum down',
      tag: 'technique',
      body: [
        'Pass `remaining` as a parameter. Push the node onto `path` before recursing and pop it after. That is backtracking on a tree.',
        'At a **leaf**, check `remaining === node.val` and save `[...path]`, a copy.',
      ],
      keyIdea: 'Path problems pass state down. Always pop after recursing, and save a copy, not the working array.',
      frames: pathSumFrames(),
    },
    {
      label: 'Return up',
      title: 'Children answer first',
      tag: 'technique',
      body: [
        'Max depth is the smallest postorder example: `1 + max(left, right)`.',
        'Each node waits for both children, then returns one number to its parent. Null returns the neutral value, 0.',
      ],
      keyIdea: 'Subtree properties return state up: height, gain, a boolean.',
      frames: depthFrames(),
    },
    {
      label: 'Global best',
      title: 'Max path sum: return one side, record both',
      tag: 'technique',
      body: [
        'Gains from children are clamped at 0. The best path **through** a node is `val + left + right`, recorded in a global.',
        'The parent only gets `val + max(left, right)`, because a path going up can continue into one child only.',
      ],
      keyIdea: 'When the answer bends through a node, keep it in a global. Start `best` at -Infinity, or an all-negative tree returns 0.',
      frames: maxPathFrames(),
    },
    {
      label: 'BFS or DFS',
      title: 'Let the tree shape decide',
      tag: 'trade-off',
      body: [
        'DFS uses **O(h)** stack, which is O(n) on a skewed tree. BFS uses **O(width)**, which is large on a wide tree.',
        'Shortest path or fewest steps: BFS. Paths and subtree aggregates: DFS.',
      ],
      keyIdea: 'Very deep tree: BFS or iterative DFS. Very wide tree: DFS.',
      frames: TRADE,
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Orders:** pre to pass down, in for sorted BST, post to bubble up.',
        '- **Three questions:** what goes down, what comes up, is there a global answer.',
        '- **Backtracking:** push before recursing, pop after, save a copy.',
        '- **Cost:** O(n) time, O(h) stack.',
        '- **Pitfalls:** empty tree, leaf vs null, unreset globals, `best = 0` on negative trees.',
      ],
      keyIdea: 'Every tree DFS answers: what do I pass down, what do I return up, and do I need a global.',
      frames: [
        {
          state: {
            ...paint(MP_LAYOUT, RECAP_ST),
            stats: [
              { label: 'Time', value: 'O(n)', tone: 'ok' },
              { label: 'Space', value: 'O(h)', hint: 'recursion stack' },
              { label: 'Max path', value: '42' },
            ],
          },
        },
      ],
    },
  ],
});
