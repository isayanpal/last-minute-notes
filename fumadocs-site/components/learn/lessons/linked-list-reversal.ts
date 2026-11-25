import { defineLesson } from '../define';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Boxes on one row: a "null" box on each side so prev = null and curr = null have somewhere to point.
 * Edges are rebuilt from the `next` map every frame, so a flipped pointer redraws in the other direction.
 * Every frame comes from running the notes' loops on that map.
 */

const VALUES = [1, 2, 3, 4, 5];
const IDS = VALUES.map((_, i) => `n${i}`);
const NULL_L = 'nullL';
const NULL_R = 'nullR';

type Next = Record<string, string | undefined>;
type Ptr = NonNullable<GraphState['pointers']>[number];

function row(order: string[], labels: Record<string, string | number>): GraphNode[] {
  const left = 0.4;
  const right = 9.6;
  const stepX = (right - left) / (order.length - 1);
  return order.map((id, k) => ({ id, label: labels[id], x: left + k * stepX, y: 3, shape: 'box' }));
}

const LABELS: Record<string, string | number> = { [NULL_L]: 'null', [NULL_R]: 'null', D: 'dummy' };
IDS.forEach((id, i) => (LABELS[id] = VALUES[i]));

function scene(order: string[], next: Next, opts: { states?: Record<string, ItemState>; edgeStates?: Record<string, ItemState>; pointers?: Ptr[]; stats: GraphState['stats']; note?: GraphState['note'] }): GraphState {
  const nodes = row(order, LABELS).map((n) => ({
    ...n,
    state: opts.states?.[n.id] ?? (n.id === NULL_L || n.id === NULL_R ? ('dim' as const) : ('normal' as const)),
  }));
  const edges: GraphEdge[] = [];
  for (const id of order) {
    const to = next[id];
    if (to) edges.push({ from: id, to, directed: true, state: opts.edgeStates?.[id] });
  }
  return { nodes, edges, pointers: opts.pointers, stats: opts.stats, note: opts.note };
}

const ORDER = [NULL_L, ...IDS, NULL_R];
const initialNext = (): Next => {
  const next: Next = {};
  IDS.forEach((id, i) => (next[id] = IDS[i + 1] ?? NULL_R));
  return next;
};

const val = (id: string | undefined) => (id === undefined ? '-' : id === NULL_L || id === NULL_R ? 'null' : String(LABELS[id]));

type Snap = { next: Next; prev: string; curr: string; saved?: string; phase: 'start' | 'save' | 'flip' | 'prev' | 'curr'; iter: number; flipped?: string };

/** Iterative reversal, a snapshot after each of the four statements. */
function reverseSnaps(): Snap[] {
  const next = initialNext();
  let prev = NULL_L;
  let curr = IDS[0];
  let iter = 0;
  const out: Snap[] = [{ next: { ...next }, prev, curr, phase: 'start', iter }];
  while (curr !== NULL_R) {
    iter++;
    const saved = next[curr]!;
    out.push({ next: { ...next }, prev, curr, saved, phase: 'save', iter });
    next[curr] = prev;
    out.push({ next: { ...next }, prev, curr, saved, phase: 'flip', iter, flipped: curr });
    prev = curr;
    out.push({ next: { ...next }, prev, curr, saved, phase: 'prev', iter });
    curr = saved;
    out.push({ next: { ...next }, prev, curr, saved, phase: 'curr', iter });
  }
  return out;
}

const NOTE: Record<Snap['phase'], (s: Snap) => string> = {
  start: () => 'prev = null, curr = head',
  save: (s) => `next = curr.next (${val(s.saved)}): save the rest`,
  flip: (s) => `curr.next = prev: ${val(s.curr)} now points to ${val(s.prev)}`,
  prev: (s) => `prev = curr (${val(s.prev)})`,
  curr: (s) => `curr = next (${val(s.curr)})`,
};

function snapState(s: Snap, opts: { note?: GraphState['note'] } = {}): GraphState {
  const states: Record<string, ItemState> = {};
  // Nodes already flipped (behind prev) are done.
  IDS.forEach((id) => {
    if (s.next[id] !== undefined && IDS.indexOf(id) < IDS.indexOf(s.curr === NULL_R ? IDS[IDS.length - 1] : s.curr) && s.curr !== id) states[id] = 'done';
  });
  if (s.curr === NULL_R) IDS.forEach((id) => (states[id] = 'done'));
  if (s.curr !== NULL_R) states[s.curr] = 'active';
  if (s.prev !== NULL_L && s.curr !== NULL_R) states[s.prev] = 'visited';
  if (s.curr === NULL_R) states[s.prev] = 'found';
  const pointers: Ptr[] = [
    { node: s.prev, label: 'prev', tone: 'info' },
    { node: s.curr, label: 'curr', tone: 'accent' },
  ];
  if (s.saved && s.phase !== 'curr') pointers.push({ node: s.saved, label: 'next', tone: 'violet', up: true });
  const done = s.curr === NULL_R;
  return scene(ORDER, s.next, {
    states,
    edgeStates: s.flipped ? { [s.flipped]: 'path' } : undefined,
    pointers: done ? [...pointers, { node: s.prev, label: 'new head', tone: 'ok', up: true }] : pointers,
    stats: [
      { label: 'Iteration', value: String(s.iter) },
      { label: 'prev / curr', value: `${val(s.prev)} / ${val(s.curr)}` },
      { label: 'Extra space', value: 'O(1)', tone: 'ok' },
    ],
    note: opts.note ?? (done ? { text: 'curr is null: return prev, the new head', tone: 'ok' } : { text: NOTE[s.phase](s), tone: s.phase === 'flip' ? 'accent' : 'neutral' }),
  });
}

const SNAPS = reverseSnaps();
const ends = SNAPS.filter((s) => s.phase === 'start' || s.phase === 'curr');

const reversedNext = (): Next => {
  const next: Next = {};
  IDS.forEach((id, i) => (next[id] = i === 0 ? NULL_L : IDS[i - 1]));
  return next;
};

// Step 1: before and after.
const PROBLEM: Frame<GraphState>[] = [
  {
    hold: 1800,
    state: scene(ORDER, initialNext(), {
      pointers: [{ node: IDS[0], label: 'head', tone: 'accent' }],
      stats: [
        { label: 'List', value: '1 → ... → 5' },
        { label: 'Copy to array', value: 'O(n) space', tone: 'bad' },
        { label: 'Goal', value: 'O(1) space', tone: 'ok' },
      ],
      note: { text: 'reverse it without copying the values anywhere' },
    }),
  },
  {
    state: scene(ORDER, reversedNext(), {
      states: Object.fromEntries(IDS.map((id) => [id, 'done' as const])),
      pointers: [{ node: IDS[4], label: 'head', tone: 'ok' }],
      stats: [
        { label: 'List', value: '5 → ... → 1' },
        { label: 'Nodes moved', value: '0', tone: 'ok' },
        { label: 'Pointers flipped', value: '5', tone: 'ok' },
      ],
      note: { text: 'same nodes, every next pointer flipped', tone: 'ok' },
    }),
  },
];

// Step 5: flip before saving and the rest of the list is gone.
const LOST: Frame<GraphState>[] = [
  { hold: 1500, state: snapState(SNAPS[0], { note: { text: 'flip first, save later?' } }) },
  {
    state: scene(ORDER, { ...initialNext(), [IDS[0]]: NULL_L }, {
      states: { [IDS[0]]: 'active', ...Object.fromEntries(IDS.slice(1).map((id) => [id, 'bad' as const])) },
      edgeStates: { [IDS[0]]: 'path' },
      pointers: [
        { node: NULL_L, label: 'prev', tone: 'info' },
        { node: IDS[0], label: 'curr', tone: 'accent' },
      ],
      stats: [
        { label: 'curr.next', value: 'null', tone: 'bad' },
        { label: 'Reachable', value: '1 node', tone: 'bad' },
        { label: 'Lost', value: '2 → 5', tone: 'bad' },
      ],
      note: { text: 'nothing references 2 any more: the rest of the list is lost', tone: 'bad' },
    }),
  },
];

// Step 6: reverse positions 2..4 with head insertion behind a dummy node.
function sublistFrames(): Frame<GraphState>[] {
  const left = 2;
  const right = 4;
  const next: Next = { D: IDS[0], ...initialNext() };
  const frames: Frame<GraphState>[] = [];
  const order = () => {
    const out = ['D'];
    let at = next.D;
    while (at && at !== NULL_R) {
      out.push(at);
      at = next[at];
    }
    return [...out, NULL_R];
  };
  let before = 'D';
  for (let i = 1; i < left; i++) before = next[before]!;
  const start = next[before]!;
  let then = next[start]!;
  const snap = (iter: number, moving: boolean, note: string, tone: 'accent' | 'ok' | 'neutral' = 'neutral') => {
    const ord = order();
    const seg = ord.slice(left, right + 1);
    const states: Record<string, ItemState> = { D: 'dim' };
    seg.forEach((id) => (states[id] = 'visited'));
    if (moving) states[then] = 'swap';
    frames.push({
      hold: moving ? 1500 : 1700,
      state: scene(ord, next, {
        states,
        pointers: [
          { node: before, label: 'before', tone: 'info' },
          { node: start, label: 'start', tone: 'ok' },
          ...(iter < right - left || moving ? [{ node: then, label: 'then', tone: 'violet' as const, up: true }] : []),
        ],
        stats: [
          { label: 'Moves', value: `${iter} of ${right - left}` },
          { label: 'List', value: ord.slice(1, -1).map((id) => LABELS[id]).join(',') },
          { label: 'Segment', value: `${left}..${right}` },
        ],
        note: { text: note, tone },
      }),
    });
  };
  snap(0, false, 'before = 1, start = 2, then = 3');
  for (let i = 0; i < right - left; i++) {
    snap(i, true, `move ${LABELS[then]} to the front of the segment`, 'accent');
    next[start] = next[then];
    next[then] = next[before];
    next[before] = then;
    then = next[start]!;
    snap(i + 1, false, i + 1 === right - left ? 'done: 1, 4, 3, 2, 5' : `${order().slice(1, -1).map((id) => LABELS[id]).join(', ')}`, i + 1 === right - left ? 'ok' : 'neutral');
  }
  return frames;
}

const LAST = SNAPS[SNAPS.length - 1];

export default defineLesson('isoGraph', {
  slug: 'linked-list-reversal',
  pseudocode: [
    'prev = null',
    'curr = head',
    'while curr:',
    '    next = curr.next',
    '    curr.next = prev',
    '    prev = curr',
    '    curr = next',
    'return prev',
  ],
  objectives: [
    { text: 'Reverse a list in place with prev, curr and next', step: 3 },
    { text: 'Return prev as the new head', step: 4 },
    { text: 'Save next before overwriting curr.next', step: 5 },
    { text: 'Reverse a sublist with a dummy node and head insertion', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Reverse without copying',
      tag: 'problem',
      code: [1, 2],
      body: [
        'Reverse `1 → 2 → 3 → 4 → 5` using O(1) extra space, so copying into an array is out.',
        'The nodes stay where they are. Only the `next` pointers change direction.',
      ],
      keyIdea: 'Reversing a list means flipping every next pointer, one node at a time.',
      frames: PROBLEM,
    },
    {
      label: 'Three refs',
      title: 'prev, curr and a saved next',
      tag: 'concept',
      code: [1, 2, 4],
      body: [
        'Start with `prev = null` and `curr = head`.',
        'Each iteration flips `curr.next` to point back at `prev`, then both slide one node right. A third reference, `next`, keeps the rest of the list reachable.',
      ],
      keyIdea: 'Three references: what you have reversed (prev), what you are flipping (curr), what is left (next).',
      frames: [
        { state: snapState(SNAPS[0]), hold: 1500 },
        { state: snapState(SNAPS[4], { note: { text: 'after one iteration: 1 points to null, prev and curr moved right', tone: 'accent' } }) },
      ],
    },
    {
      label: 'One step',
      title: 'Four statements, in order',
      tag: 'technique',
      code: [4, 5, 6, 7],
      body: [
        'Watch the second iteration slowly: **save** `next = curr.next`, **flip** `curr.next = prev`, then `prev = curr` and `curr = next`.',
        'The order matters: save before you overwrite.',
      ],
      keyIdea: 'Save, flip, advance prev, advance curr.',
      frames: SNAPS.filter((s) => s.iter === 2).map((s) => ({ state: snapState(s), hold: 1500 })),
    },
    {
      label: 'Full run',
      title: 'Reverse the whole list',
      tag: 'technique',
      code: [3, 4, 5, 6, 7],
      body: ['Repeat until `curr` is null. Every node is visited once: O(n) time, O(1) space.', 'Return `prev`, not `head`. The old head is now the tail.'],
      keyIdea: 'When curr falls off the end, prev is the new head.',
      frames: ends.map((s) => ({ state: snapState(s), hold: 1200 })),
    },
    {
      label: 'Save first',
      title: 'Flip before saving and you lose it',
      tag: 'trade-off',
      code: [4, 5],
      body: [
        'Overwrite `curr.next` before saving it and nothing references the rest of the list any more.',
        'The recursive version is shorter but uses O(n) stack, and must set `head.next = null` or it leaves a cycle.',
      ],
      keyIdea: 'Iterative reversal is O(1) space. Recursion costs O(n) stack.',
      frames: LOST,
    },
    {
      label: 'Sublist',
      title: 'Reverse positions 2 to 4',
      tag: 'in practice',
      code: [3, 4, 5, 6, 7],
      body: [
        'Walk to the node **before** the segment. Then repeatedly take the node after `start` and move it to the front of the segment.',
        'A dummy node in front makes `left = 1` work without a special case.',
      ],
      keyIdea: 'Head insertion reverses a sublist in one pass: right - left moves.',
      frames: sublistFrames(),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** reverse a list, a sublist or k-groups in O(1) space, or a palindrome or reorder check.',
        '- **Loop:** save next, flip `curr.next = prev`, advance prev, advance curr.',
        '- **Return:** `prev`, or `dummy.next` when a dummy is used.',
        '- **Sublist:** dummy node, walk to `before`, head-insert `right - left` times.',
        '- **Pitfalls:** overwriting `curr.next` before saving it, off by one on positions.',
      ],
      keyIdea: 'Every reversal variant is the same pointer flip with different boundaries.',
      frames: [{ state: { ...snapState(LAST), note: undefined } }],
    },
  ],
});
