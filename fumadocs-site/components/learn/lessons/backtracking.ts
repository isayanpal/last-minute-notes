import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import type { Frame } from '../types';

/*
 * Frames come from running the real backtracking code from the notes and recording every choose, record and undo.
 * The decision tree is laid out from the nodes the run actually visits, so it always matches the algorithm.
 */

type TNode = { id: string; label: string; parent?: string; depth: number; skip?: boolean; found?: boolean; dead?: boolean };
type Ev = { type: 'enter' | 'exit' | 'skip'; id: string; path: number[]; results: string[]; popped?: number };
type Run = { nodes: TNode[]; events: Ev[] };

const show = (p: number[]) => `[${p.join(',')}]`;
const lab = (p: number[]) => (p.length ? p.join('') : '{}');

/** Subsets via choose, explore, un-choose. With `dedupe`, applies the sort-and-skip rule from the notes. */
function subsetsRun(nums: number[], dedupe: boolean, withExits: boolean): Run {
  const nodes: TNode[] = [{ id: 'r', label: '{}', depth: 0 }];
  const events: Ev[] = [];
  const path: number[] = [];
  const results: string[] = [];
  const dfs = (id: string, start: number, depth: number) => {
    results.push(show(path));
    events.push({ type: 'enter', id, path: [...path], results: [...results] });
    for (let i = start; i < nums.length; i++) {
      const cid = `${id}/${i}`;
      if (dedupe && i > start && nums[i] === nums[i - 1]) {
        nodes.push({ id: cid, label: lab([...path, nums[i]]), parent: id, depth: depth + 1, skip: true });
        events.push({ type: 'skip', id: cid, path: [...path], results: [...results] });
        continue;
      }
      nodes.push({ id: cid, label: lab([...path, nums[i]]), parent: id, depth: depth + 1 });
      path.push(nums[i]);
      dfs(cid, i + 1, depth + 1);
      const popped = path.pop()!;
      if (withExits) events.push({ type: 'exit', id: cid, path: [...path], results: [...results], popped });
    }
  };
  dfs('r', 0, 0);
  return { nodes, events };
}

/** Combination sum: numbers may be reused, so the recursion passes `i`, not `i + 1`. */
function comboRun(candidates: number[], target: number): Run {
  const nodes: TNode[] = [{ id: 'r', label: '{}', depth: 0 }];
  const events: Ev[] = [];
  const path: number[] = [];
  const results: string[] = [];
  const dfs = (id: string, start: number, remaining: number, depth: number) => {
    const node = nodes.find((n) => n.id === id)!;
    if (remaining === 0) {
      results.push(show(path));
      node.found = true;
    } else if (!candidates.slice(start).some((c) => c <= remaining)) node.dead = true;
    events.push({ type: 'enter', id, path: [...path], results: [...results] });
    if (remaining === 0) return;
    for (let i = start; i < candidates.length; i++) {
      if (candidates[i] > remaining) continue;
      const cid = `${id}/${i}`;
      nodes.push({ id: cid, label: lab([...path, candidates[i]]), parent: id, depth: depth + 1 });
      path.push(candidates[i]);
      dfs(cid, i, remaining - candidates[i], depth + 1);
      path.pop();
    }
  };
  dfs('r', 0, target, 0);
  return { nodes, events };
}

/** Lay the visited nodes out as a tree: leaves spread across x, parents centred over their children. */
function layout(nodes: TNode[]): { gnodes: GraphNode[]; edges: GraphEdge[] } {
  const kids = new Map<string, TNode[]>();
  for (const n of nodes) if (n.parent) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n]);
  const leaves = nodes.filter((n) => !(kids.get(n.id)?.length));
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const xs = new Map<string, number>();
  leaves.forEach((n, i) => xs.set(n.id, 0.5 + ((i + 0.5) / leaves.length) * 9));
  const place = (id: string): number => {
    if (xs.has(id)) return xs.get(id)!;
    const cs = kids.get(id)!.map((c) => place(c.id));
    const x = (Math.min(...cs) + Math.max(...cs)) / 2;
    xs.set(id, x);
    return x;
  };
  place('r');
  const dy = Math.min(1.5, 4.8 / Math.max(maxDepth, 1));
  return {
    gnodes: nodes.map((n) => ({ id: n.id, label: n.label, x: xs.get(n.id)!, y: 0.4 + n.depth * dy, shape: 'box' as const })),
    edges: nodes.filter((n) => n.parent).map((n) => ({ from: n.parent!, to: n.id })),
  };
}

const paint = (nodes: GraphNode[], states: Record<string, ItemState>, tags: Record<string, string> = {}): GraphNode[] =>
  nodes.map((n) => ({ ...n, state: states[n.id] ?? 'dim', tag: tags[n.id] }));

/** One frame per recorded event. */
function frames(run: Run, opts: { hold: number; target?: number }): Frame<GraphState>[] {
  const { gnodes, edges } = layout(run.nodes);
  const info = new Map(run.nodes.map((n) => [n.id, n]));
  const states: Record<string, ItemState> = {};
  const tags: Record<string, string> = {};
  let current: string | undefined;
  const settle = (id: string | undefined) => {
    if (!id) return;
    const n = info.get(id)!;
    states[id] = n.found ? 'found' : n.dead ? 'bad' : 'visited';
  };
  return run.events.map((ev): Frame<GraphState> => {
    let note: GraphState['note'];
    let action = '';
    if (ev.type === 'enter') {
      settle(current);
      current = ev.id;
      const n = info.get(ev.id)!;
      states[ev.id] = 'active';
      if (n.found) {
        states[ev.id] = 'found';
        note = { text: `remaining 0: record a COPY ${show(ev.path)}`, tone: 'ok' };
        action = 'record';
      } else if (n.dead) {
        states[ev.id] = 'bad';
        note = { text: 'dead end: nothing fits, go back', tone: 'bad' };
        action = 'dead end';
      } else {
        note = { text: ev.id === 'r' ? 'start: record the empty subset' : opts.target === undefined ? `choose, then record ${show(ev.path)}` : `choose ${ev.path.at(-1)}, remaining ${opts.target - ev.path.reduce((a, b) => a + b, 0)}`, tone: 'accent' };
        action = 'choose';
      }
    } else if (ev.type === 'skip') {
      states[ev.id] = 'bad';
      tags[ev.id] = 'skip';
      note = { text: 'same value as the previous choice at this level: skip', tone: 'bad' };
      action = 'skip';
    } else {
      settle(current);
      const parent = info.get(ev.id)!.parent!;
      current = parent;
      states[parent] = 'active';
      note = { text: `undo: pop ${ev.popped}, back to ${show(ev.path)}`, tone: 'accent' };
      action = 'undo';
    }
    return {
      hold: opts.hold,
      state: {
        nodes: paint(gnodes, states, tags),
        edges,
        panels: [
          { title: 'path', kind: 'stack', items: [...ev.path].reverse().map(String) },
          { title: 'results', kind: 'list', items: ev.results.slice(-6) },
        ],
        stats: [
          { label: 'Path', value: show(ev.path) },
          { label: 'Action', value: action, tone: action === 'record' ? 'ok' : action === 'dead end' || action === 'skip' ? 'bad' : 'neutral' },
          { label: 'Results', value: String(ev.results.length), tone: ev.results.length ? 'ok' : 'neutral' },
        ],
        note,
      },
    };
  });
}

const SUBSETS = subsetsRun([1, 2, 3], false, true);
const SUBSET_TREE = layout(SUBSETS.nodes);
const LABEL_TO_ID = new Map(SUBSETS.nodes.map((n) => [n.label, n.id]));

// Step 2: the iterative doubling approach, painted onto the same tree.
function doublingFrames(): Frame<GraphState>[] {
  const nums = [1, 2, 3];
  let result: number[][] = [[]];
  const out: Frame<GraphState>[] = [];
  const snap = (label: string, added: number[][], note: string) => {
    const states: Record<string, ItemState> = {};
    for (const s of result) states[LABEL_TO_ID.get(lab(s))!] = 'visited';
    for (const s of added) states[LABEL_TO_ID.get(lab(s))!] = 'active';
    out.push({
      hold: 2200,
      state: {
        nodes: paint(SUBSET_TREE.gnodes, states),
        edges: SUBSET_TREE.edges,
        panels: [{ title: 'result', kind: 'list', items: result.slice(-6).map(show) }],
        stats: [{ label: 'After', value: label }, { label: 'Subsets', value: String(result.length), tone: 'ok' }, { label: 'Pattern', value: 'doubles' }],
        note: { text: note, tone: 'accent' },
      },
    });
  };
  snap('start', [[]], 'start with one subset: the empty one');
  for (const n of nums) {
    const added = result.map((s) => [...s, n]);
    result = [...result, ...added];
    snap(`add ${n}`, added, `copy every subset and append ${n}: ${result.length} subsets now`);
  }
  return out;
}

const COMBO = comboRun([2, 3, 6, 7], 7);
const DUP = subsetsRun([1, 2, 2], true, false);

export default defineLesson('graph', {
  slug: 'backtracking',
  objectives: [
    { text: 'Why the output is exponential and n must be small', step: 1 },
    { text: 'The choose, explore, undo template', step: 3 },
    { text: 'Reusing numbers in combination sum, and recording a copy', step: 4 },
    { text: 'How sorting plus a skip rule removes duplicate subsets', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Every subset of [1, 2, 3]',
      tag: 'problem',
      body: [
        'List every subset, combination or arrangement. Each element is either in or out, so the answer has **2^n** subsets.',
        'The output itself is exponential, which is why these problems come with n of about 20 or less.',
      ],
      keyIdea: 'The choices form a tree. Backtracking walks that tree depth first, and the tree here has 8 nodes for 8 subsets.',
      frames: [{ state: { nodes: paint(SUBSET_TREE.gnodes, { r: 'active' }), edges: SUBSET_TREE.edges, stats: [{ label: 'n', value: '3' }, { label: 'Subsets', value: '2^3 = 8' }, { label: 'n = 20', value: '1M subsets' }], note: { text: 'each node is one subset, children extend it', tone: 'accent' } } }],
    },
    {
      label: 'Doubling',
      title: 'Iterative: copy and append',
      tag: 'technique',
      body: [
        'Start with `[[]]`. For each element, copy every existing subset and append the element.',
        'The count doubles each round, so the work is O(n × 2^n) because every subset is copied.',
      ],
      keyIdea: 'Best for plain subsets and subsets with duplicates. It does not prune, so it suits few constraints.',
      frames: doublingFrames(),
    },
    {
      label: 'Template',
      title: 'Choose, explore, undo',
      tag: 'technique',
      body: [
        'Backtracking: record a **copy** of the state when it is complete, otherwise for each valid choice apply it, recurse, and **undo** it.',
        'The undo step is what lets one shared `path` array serve every branch. Watch the stack pop as the walk returns.',
      ],
      keyIdea: 'Push `[...path]`, never `path`. Otherwise every result aliases one array that ends up empty.',
      frames: frames(SUBSETS, { hold: 900 }),
    },
    {
      label: 'Combination sum',
      title: 'Reuse numbers, prune early',
      tag: 'technique',
      body: [
        'For `[2, 3, 6, 7]` and target 7, pass `i` (not `i + 1`) so a number can be reused, and pass `start` forward so `[2, 3]` and `[3, 2]` do not both appear.',
        'Skip any candidate bigger than the remaining amount. Dead ends return immediately, which is the point of backtracking over brute force.',
      ],
      keyIdea: 'The answers are `[2, 2, 3]` and `[7]`. Pruning keeps the tree to 10 nodes instead of every possible sum.',
      frames: frames(COMBO, { hold: 1300, target: 7 }),
    },
    {
      label: 'Duplicates',
      title: 'Sort, then skip repeats',
      tag: 'trade-off',
      body: [
        'For `[1, 2, 2]` the subset `[2]` must appear once. Sort first, then inside the loop skip with `if (i > start && nums[i] === nums[i - 1]) continue`.',
        'It means: never pick the same value twice at the same level, but allow it at different depths, so `[2, 2]` is still produced.',
      ],
      keyIdea: 'Without sorting first, equal values are not adjacent and the skip rule misses them.',
      frames: frames(DUP, { hold: 1500 }),
    },
    {
      label: 'Growth rates',
      title: 'Know what to quote',
      tag: 'in practice',
      body: [
        'Subsets: **2^n**, n up to about 20. Permutations: **n!**, n up to about 9 or 10. Combinations C(n, k) depend on k.',
        'Report time as O(n × 2^n) for subsets, since each result is copied. Say it, interviewers listen for it.',
      ],
      keyIdea: 'Prune with a cheap check as early as possible: `open < n` for parentheses, `candidate <= remaining` for sums.',
      frames: [{ state: { nodes: paint(SUBSET_TREE.gnodes, Object.fromEntries(SUBSET_TREE.gnodes.map((n) => [n.id, 'done' as ItemState]))), edges: SUBSET_TREE.edges, stats: [{ label: 'Subsets', value: '2^n' }, { label: 'Permutations', value: 'n!' }, { label: 'Copy cost', value: '× n' }], note: { text: 'the answer size is the lower bound on time', tone: 'accent' } } }],
    },
    {
      label: 'Recap',
      title: 'The backtracking checklist',
      tag: 'recap',
      body: [
        '- **When:** all subsets, combinations, permutations, with small n.',
        '- **Iterative:** `[[]]`, then copy and append per element, for subsets.',
        '- **Template:** if complete, record a copy. Else loop: skip invalid, apply, recurse, undo.',
        '- **Combinations:** pass `start` to avoid reordering, pass `i` to allow reuse.',
        '- **Duplicates:** sort, then skip equal neighbours at the same level.',
        '- **Pitfalls:** pushing `path` not a copy, forgetting to undo `used` flags, quoting O(2^n) instead of O(n × 2^n).',
      ],
      keyIdea: 'Choose, explore, undo. Everything else is deciding which choices are valid.',
      frames: [{ state: frames(SUBSETS, { hold: 900 }).at(-1)!.state }],
    },
  ],
});
