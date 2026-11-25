import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import type { Frame } from '../types';

/*
 * Frames come from running Kahn's algorithm from the notes: in-degrees, the queue and the order are the real values.
 * Edge [a, b] means "a must come before b".
 */

type G = { nodes: { id: number; label: string; x: number; y: number }[]; edges: [number, number][] };

// The four courses from the notes: 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3.
const DAG: G = {
  nodes: [
    { id: 0, label: 'C0', x: 1, y: 3 },
    { id: 1, label: 'C1', x: 4.2, y: 1.2 },
    { id: 2, label: 'C2', x: 4.2, y: 4.8 },
    { id: 3, label: 'C3', x: 7.4, y: 3 },
  ],
  edges: [[0, 1], [0, 2], [1, 3], [2, 3]],
};

// A graph with a cycle: 1 -> 2 -> 1, reachable from 0.
const CYCLIC: G = {
  nodes: [
    { id: 0, label: 'C0', x: 1, y: 3 },
    { id: 1, label: 'C1', x: 4.2, y: 1.4 },
    { id: 2, label: 'C2', x: 4.2, y: 4.6 },
  ],
  edges: [[0, 1], [1, 2], [2, 1]],
};

const toNodes = (g: G, states: Record<number, ItemState>, indeg: number[]): GraphNode[] =>
  g.nodes.map((n) => ({ id: String(n.id), label: n.label, x: n.x, y: n.y, state: states[n.id] ?? 'normal', tag: `in ${indeg[n.id]}` }));
const toEdges = (g: G, done: Set<number>, cycle: boolean): GraphEdge[] =>
  g.edges.map(([a, b]) => ({ from: String(a), to: String(b), directed: true, state: cycle && !done.has(a) && !done.has(b) ? 'bad' : done.has(a) ? 'visited' : 'normal', curve: g.edges.some(([x, y]) => x === b && y === a) ? 0.6 : undefined }));

function kahn(g: G): Frame<GraphState>[] {
  const n = g.nodes.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  const indeg = new Array<number>(n).fill(0);
  for (const [a, b] of g.edges) {
    adj[a].push(b);
    indeg[b]++;
  }
  const queue: number[] = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) queue.push(i);
  const order: number[] = [];
  const done = new Set<number>();
  const frames: Frame<GraphState>[] = [];
  const snap = (cur: number | undefined, note: GraphState['note'], waiting: number[] = [], final?: 'ok' | 'cycle') => {
    const states: Record<number, ItemState> = {};
    for (const o of order) states[o] = 'done';
    for (const q of queue.slice(head)) states[q] = 'active';
    if (cur !== undefined) states[cur] = 'found';
    if (final === 'cycle') for (let i = 0; i < n; i++) if (!done.has(i)) states[i] = 'bad';
    frames.push({
      hold: 1900,
      state: {
        nodes: toNodes(g, states, indeg),
        edges: toEdges(g, done, final === 'cycle'),
        panels: [
          { title: 'queue', kind: 'queue', items: queue.slice(head).map((i) => g.nodes[i].label) },
          { title: 'order', kind: 'list', items: order.map((i) => g.nodes[i].label) },
        ],
        stats: [
          { label: 'Queue', value: `${queue.length - head} ready` },
          { label: 'Ordered', value: `${order.length} of ${n}`, tone: final === 'cycle' ? 'bad' : order.length === n ? 'ok' : 'neutral' },
          { label: 'Waiting', value: waiting.length ? waiting.map((i) => g.nodes[i].label).join(' ') : '-' },
        ],
        note,
      },
    });
  };
  let head = 0;
  snap(undefined, { text: 'in-degree 0: no prerequisites, ready to start', tone: 'accent' });
  while (head < queue.length) {
    const node = queue[head];
    order.push(node);
    done.add(node);
    const released: number[] = [];
    for (const next of adj[node]) if (--indeg[next] === 0) {
      queue.push(next);
      released.push(next);
    }
    head++;
    snap(node, { text: released.length ? `pop ${g.nodes[node].label}: ${released.map((i) => g.nodes[i].label).join(', ')} reach 0 and join the queue` : `pop ${g.nodes[node].label}: nothing newly ready`, tone: 'accent' });
  }
  if (order.length === n) frames[frames.length - 1].state.note = { text: `order has all ${n}: a valid schedule`, tone: 'ok' };
  else snap(undefined, { text: `order has ${order.length} of ${n}: the rest wait on each other, so there is a cycle`, tone: 'bad' }, g.nodes.filter((x) => !done.has(x.id)).map((x) => x.id), 'cycle');
  return frames;
}

const dagFrames = kahn(DAG);
const cycleFrames = kahn(CYCLIC);

const indegOf = (g: G) => {
  const d = new Array<number>(g.nodes.length).fill(0);
  for (const [, b] of g.edges) d[b]++;
  return d;
};

export default defineLesson('isoGraph', {
  slug: 'topological-sort',
  pseudocode: [
    'indegree[v] = number of prerequisites of v',
    'queue = every v with indegree 0',
    'while queue is not empty:',
    '    u = dequeue, add u to order',
    '    for each v after u:',
    '        indegree[v] = indegree[v] - 1',
    '        if indegree[v] == 0: enqueue v',
    'if order has fewer than n nodes: a cycle',
  ],
  objectives: [
    { text: 'When a dependency problem is a topological sort', step: 1 },
    { text: 'In-degree: how many prerequisites a node still waits on', step: 2 },
    { text: "Kahn's algorithm with a queue", step: 3 },
    { text: 'Spotting a cycle when the order comes up short', step: 4 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'What can start first?',
      tag: 'problem',
      body: [
        'Courses have prerequisites. C0 comes before C1 and C2, and both come before C3. You want an order that respects every edge.',
        'Such an order exists **if and only if** the graph has no cycle.',
      ],
      keyIdea: 'Keywords: order, before, after, prerequisite, dependency, "can all be finished".',
      frames: [{ state: { nodes: toNodes(DAG, {}, indegOf(DAG)).map((n) => ({ ...n, tag: undefined })), edges: toEdges(DAG, new Set(), false), stats: [{ label: 'Nodes', value: '4' }, { label: 'Edges', value: '4' }, { label: 'Cycle?', value: 'no', tone: 'ok' }], note: { text: 'an edge a to b means a must come before b', tone: 'accent' } } }],
    },
    {
      label: 'In-degree',
      title: 'Count what each node waits on',
      tag: 'concept',
      code: [1, 2],
      body: [
        'Build the adjacency list and the **in-degree** of every node: how many prerequisites it still waits on.',
        'Every node with in-degree 0 can start right now. C0 is the only one here.',
      ],
      keyIdea: 'In-degree falls as prerequisites are completed. Zero means ready.',
      frames: [{ state: { nodes: toNodes(DAG, { 0: 'active' }, indegOf(DAG)), edges: toEdges(DAG, new Set(), false), stats: [{ label: 'In-degrees', value: '0 1 1 2' }, { label: 'Ready', value: 'C0', tone: 'ok' }, { label: 'Build cost', value: 'O(V + E)' }], note: { text: 'queue every node whose in-degree is 0', tone: 'accent' } } }],
    },
    {
      label: "Kahn's",
      title: 'Pop, order, release',
      tag: 'technique',
      code: [3, 4, 5, 6, 7],
      body: [
        'Pop a node, append it to the order, and decrement the in-degree of everything that depends on it. Anything reaching 0 joins the queue.',
        'When the queue is empty the order is complete. It runs in O(V + E).',
      ],
      keyIdea: 'The order is usually not unique. C1 and C2 can swap, and any order that respects the edges is valid.',
      frames: dagFrames,
    },
    {
      label: 'Cycle',
      title: 'A short order means a cycle',
      tag: 'trade-off',
      code: [8],
      body: [
        'Here C1 and C2 each wait on the other. After C0 is popped, neither reaches in-degree 0, so the queue empties with the order short.',
        'If `order.length < n`, the leftover nodes are stuck in a cycle. That is also how you answer "can all courses be finished?".',
      ],
      keyIdea: 'Cycle detection comes free. A DFS alternative uses three colours: white, grey (on the current path) and black.',
      frames: cycleFrames,
    },
    {
      label: 'Variants',
      title: 'Which order do you need?',
      tag: 'in practice',
      body: [
        'Ask whether any valid order is fine or a particular one is needed. For the **lexicographically smallest** order, swap the queue for a min-heap.',
        'Other uses: build systems, task scheduling, resolving package installs, alien dictionary, and parallel schedules by processing the queue level by level.',
      ],
      keyIdea: 'Directed, acyclic, order matters: reach for topological sort.',
      frames: [{ state: dagFrames.at(-1)!.state }],
    },
    {
      label: 'Recap',
      title: 'The algorithm',
      tag: 'recap',
      body: [
        '- **When:** a directed graph of dependencies, or "is there a cycle in this directed graph".',
        '- **Setup:** adjacency list plus in-degree per node.',
        '- **Loop:** queue the zero in-degree nodes, pop, order, decrement neighbours, queue new zeros.',
        '- **Result:** `order.length === n` means valid, otherwise a cycle.',
        '- **Cost:** O(V + E) time and space. Use a min-heap for the smallest order.',
      ],
      keyIdea: 'Count prerequisites, start with the free ones, and let each finished node free up the next.',
      frames: [{ state: dagFrames.at(-1)!.state }],
    },
  ],
});
