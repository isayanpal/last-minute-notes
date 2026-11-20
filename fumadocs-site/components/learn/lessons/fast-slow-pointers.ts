import { defineLesson } from '../define';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import { listLayout, patch } from '../engines/layouts';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * A list 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> back to 3.
 * The tail (1, 2) runs left to right, the cycle (3, 4, 5, 6) is a diamond on the right.
 * F = 2 (head to cycle start), C = 4 (cycle length). Every frame comes from running Floyd's loop on NEXT.
 */

const NODES: GraphNode[] = [
  { id: 'n1', label: 1, x: 0.5, y: 3.0 },
  { id: 'n2', label: 2, x: 2.2, y: 3.0 },
  { id: 'n3', label: 3, x: 3.9, y: 3.0 },
  { id: 'n4', label: 4, x: 5.8, y: 1.3 },
  { id: 'n5', label: 5, x: 7.7, y: 3.0 },
  { id: 'n6', label: 6, x: 5.8, y: 4.7 },
];
const NEXT: Record<string, string> = { n1: 'n2', n2: 'n3', n3: 'n4', n4: 'n5', n5: 'n6', n6: 'n3' };
const EDGES: GraphEdge[] = Object.entries(NEXT).map(([from, to]) => ({ from, to, directed: true }));
const CYCLE = ['n3', 'n4', 'n5', 'n6'];
const val = (id: string) => NODES.find((n) => n.id === id)!.label;

function scene(over: { states?: Record<string, ItemState>; edges?: Record<string, ItemState>; pointers?: GraphState['pointers']; stats: GraphState['stats']; note?: GraphState['note'] }): GraphState {
  const nodeChanges: Record<string, Partial<GraphNode>> = {};
  for (const [id, state] of Object.entries(over.states ?? {})) nodeChanges[id] = { state };
  return {
    nodes: patch(NODES, nodeChanges),
    edges: EDGES.map((e) => (over.edges?.[e.from] ? { ...e, state: over.edges[e.from] } : e)),
    pointers: over.pointers,
    stats: over.stats,
    note: over.note,
  };
}

const sf = (slow: string, fast: string, extra: GraphState['pointers'] = []): GraphState['pointers'] => [
  { node: slow, label: 'slow', tone: 'info' },
  { node: fast, label: 'fast', tone: 'accent', up: true },
  ...extra,
];

// Step 1: a single walker never reaches null.
function walkerFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  let curr = 'n1';
  const seen = new Set<string>();
  for (let step = 0; step < 8; step++) {
    const again = seen.has(curr);
    seen.add(curr);
    const states: Record<string, ItemState> = {};
    for (const s of seen) states[s] = 'visited';
    states[curr] = again ? 'bad' : 'active';
    frames.push({
      hold: 700,
      state: scene({
        states,
        pointers: [{ node: curr, label: 'curr' }],
        stats: [
          { label: 'Steps', value: String(step) },
          { label: 'Reached null', value: 'never', tone: step > 5 ? 'bad' : 'neutral' },
          { label: 'Visited set', value: `${seen.size} nodes`, hint: 'O(n) space' },
        ],
        note: again ? { text: `back at ${val(curr)}: a visited set would catch it, but costs O(n) space`, tone: 'bad' } : undefined,
      }),
    });
    curr = NEXT[curr];
  }
  return frames;
}

type Pos = { slow: string; fast: string; step: number };

/** Floyd phase 1: both start at head, slow +1, fast +2, compare after moving. */
function phase1(): Pos[] {
  const out: Pos[] = [{ slow: 'n1', fast: 'n1', step: 0 }];
  let slow = 'n1';
  let fast = 'n1';
  let step = 0;
  do {
    slow = NEXT[slow];
    fast = NEXT[NEXT[fast]];
    step++;
    out.push({ slow, fast, step });
  } while (slow !== fast);
  return out;
}
const P1 = phase1();
const MEET = P1[P1.length - 1].slow;

const detectState = (p: Pos): GraphState => {
  const met = p.step > 0 && p.slow === p.fast;
  return scene({
    states: met ? { [p.slow]: 'found' } : { [p.slow]: 'visited', [p.fast]: 'active' },
    pointers: sf(p.slow, p.fast),
    stats: [
      { label: 'Steps', value: String(p.step) },
      { label: 'slow / fast', value: `${val(p.slow)} / ${val(p.fast)}` },
      { label: 'Cycle', value: met ? 'yes' : '?', tone: met ? 'ok' : 'neutral' },
    ],
    note: met ? { text: `they meet at ${val(p.slow)}: there is a cycle`, tone: 'ok' } : p.step === 0 ? { text: 'both start at head' } : undefined,
  });
};

/** Forward distance along the cycle from a to b. */
function gap(a: string, b: string): number {
  return (CYCLE.indexOf(b) - CYCLE.indexOf(a) + CYCLE.length) % CYCLE.length;
}

const gapFrames: Frame<GraphState>[] = P1.filter((p) => CYCLE.includes(p.slow) && CYCLE.includes(p.fast)).map((p) => {
  const g = gap(p.fast, p.slow);
  const edges: Record<string, ItemState> = {};
  let at = p.fast;
  for (let k = 0; k < g; k++) {
    edges[at] = 'path';
    at = NEXT[at];
  }
  return {
    hold: 1800,
    state: scene({
      states: g === 0 ? { [p.slow]: 'found' } : { [p.slow]: 'visited', [p.fast]: 'active' },
      edges,
      pointers: sf(p.slow, p.fast),
      stats: [
        { label: 'Gap', value: `${g} step${g === 1 ? '' : 's'}`, tone: g === 0 ? 'ok' : 'neutral', hint: 'fast to slow' },
        { label: 'Per move', value: '-1', hint: 'fast +2, slow +1' },
        { label: 'Can skip 0?', value: 'no', tone: 'ok' },
      ],
      note: g === 0 ? { text: 'the gap went 2, 1, 0: it cannot jump over 0', tone: 'ok' } : { text: `fast is ${g} behind slow around the loop` },
    }),
  };
});

// Phase 2: probe from head, slow from the meeting point, both +1.
function phase2(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  let probe = 'n1';
  let slow = MEET;
  let step = 0;
  for (;;) {
    const done = probe === slow;
    frames.push({
      hold: done ? 2000 : 1400,
      state: scene({
        states: done ? { [probe]: 'found' } : { [probe]: 'active', [slow]: 'visited' },
        pointers: [
          { node: slow, label: 'slow', tone: 'info' },
          { node: probe, label: 'probe', tone: 'violet', up: true },
        ],
        stats: [
          { label: 'Phase 2 step', value: String(step) },
          { label: 'probe / slow', value: `${val(probe)} / ${val(slow)}` },
          { label: 'Cycle start', value: done ? String(val(probe)) : '?', tone: done ? 'ok' : 'neutral' },
        ],
        note: done ? { text: `they meet at ${val(probe)}: the cycle start`, tone: 'ok' } : step === 0 ? { text: 'probe at head, slow stays at the meeting point' } : undefined,
      }),
    });
    if (done) break;
    probe = NEXT[probe];
    slow = NEXT[slow];
    step++;
  }
  return frames;
}

// Step 6: the math. F = 2, a = 2, C = 4.
const F = 2;
const A = gap('n3', MEET);
const C = CYCLE.length;
const mathFrames: Frame<GraphState>[] = [
  {
    hold: 1800,
    state: scene({
      states: { n1: 'visited', n3: 'found' },
      edges: { n1: 'path', n2: 'path' },
      stats: [
        { label: 'F', value: String(F), tone: 'ok', hint: 'head to cycle start' },
        { label: 'a', value: '?' },
        { label: 'C', value: '?' },
      ],
      note: { text: `F = ${F}: distance from head to the cycle start` },
    }),
  },
  {
    hold: 1800,
    state: scene({
      states: { n3: 'found', [MEET]: 'active' },
      edges: { n3: 'visited', n4: 'visited' },
      stats: [
        { label: 'F', value: String(F) },
        { label: 'a', value: String(A), tone: 'ok', hint: 'start to meeting point' },
        { label: 'C', value: String(C) },
      ],
      note: { text: `slow walked F + a = ${F + A}, fast walked twice that, ${2 * (F + A)}` },
    }),
  },
  {
    hold: 2000,
    state: scene({
      states: { n3: 'found', [MEET]: 'active' },
      edges: { n3: 'done', n4: 'done', n5: 'done', n6: 'done' },
      stats: [
        { label: 'F + a', value: String(F + A) },
        { label: 'n · C', value: `1 · ${C}`, hint: 'whole laps' },
        { label: 'So F', value: `${C} - ${A} = ${F}`, tone: 'ok' },
      ],
      note: { text: 'fast also walked F + a + n·C, so F + a = n·C and F = n·C - a', tone: 'accent' },
    }),
  },
  {
    state: scene({
      states: { n3: 'found', [MEET]: 'visited', n1: 'visited' },
      edges: { n5: 'path', n6: 'path', n1: 'path', n2: 'path' },
      stats: [
        { label: 'From head', value: `${F} steps` },
        { label: 'From meet', value: `${F} steps` },
        { label: 'Both land on', value: String(val('n3')), tone: 'ok' },
      ],
      note: { text: 'walking F from the meeting point lands exactly on the cycle start', tone: 'ok' },
    }),
  },
];

// Step 7: middle of [1..6], second middle vs first middle.
const MID = listLayout([1, 2, 3, 4, 5, 6, 'null'], { y: 3 });
const midNodes = patch(MID.nodes, { n6: { state: 'dim' } });
function middleFrames(firstMiddle: boolean): Frame<GraphState>[] {
  const next = (k: number) => (k < 6 ? k + 1 : 6); // index 6 is the null box
  const frames: Frame<GraphState>[] = [];
  let slow = 0;
  let fast = 0;
  const cond = () => (firstMiddle ? fast < 6 && next(fast) < 6 && next(next(fast)) < 6 : fast < 6 && next(fast) < 6);
  const push = (done: boolean) =>
    frames.push({
      hold: done ? 2200 : 1000,
      state: {
        nodes: patch(midNodes, done ? { [`n${slow}`]: { state: 'found' } } : { [`n${slow}`]: { state: 'visited' }, [`n${fast}`]: { state: fast === 6 ? 'dim' : 'active' } }),
        edges: MID.edges,
        pointers: [
          { node: `n${slow}`, label: 'slow', tone: 'info' },
          { node: `n${fast}`, label: 'fast', tone: 'accent', up: true },
        ],
        stats: [
          { label: 'Loop while', value: firstMiddle ? 'next.next' : 'fast && next' },
          { label: 'slow at', value: String(MID.nodes[slow].label) },
          { label: 'Middle', value: done ? (firstMiddle ? 'first' : 'second') : '?', tone: done ? 'ok' : 'neutral' },
        ],
        note: done ? { text: firstMiddle ? 'first middle: 3, handy for splitting into halves' : 'fast hit null: slow is at 4, the second middle', tone: 'ok' } : undefined,
      },
    });
  push(false);
  while (cond()) {
    slow = next(slow);
    fast = next(next(fast));
    push(false);
  }
  frames.pop(); // replace the last frame with the answer frame
  push(true);
  return frames;
}

const RECAP: GraphState = scene({
  states: { n3: 'found', [MEET]: 'active' },
  edges: { n3: 'done', n4: 'done', n5: 'done', n6: 'done' },
  pointers: [
    { node: 'n3', label: 'cycle start', tone: 'ok' },
    { node: MEET, label: 'meet', tone: 'accent', up: true },
  ],
  stats: [
    { label: 'Time', value: 'O(n)', tone: 'ok' },
    { label: 'Space', value: 'O(1)', tone: 'ok' },
    { label: 'Speeds', value: '1 and 2' },
  ],
});

export default defineLesson('graph', {
  slug: 'fast-slow-pointers',
  objectives: [
    { text: 'Detect a cycle in O(1) space with two speeds', step: 3 },
    { text: 'Explain why the pointers must meet', step: 4 },
    { text: 'Find where the cycle starts with a second phase', step: 5 },
    { text: 'Derive F = n·C - a', step: 6 },
    { text: 'Pick the loop condition for the first or second middle', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'A list that never ends',
      tag: 'problem',
      body: [
        'Walk this list one node at a time and you never reach `null`: node 6 points back to 3.',
        'A hash set of visited nodes would catch it, but costs O(n) space. The problem asks for **O(1)**.',
      ],
      keyIdea: 'Cycle, loop, middle or "kth from the end" with O(1) space: think fast and slow pointers.',
      frames: walkerFrames(),
    },
    {
      label: 'Two speeds',
      title: 'Tortoise and hare',
      tag: 'concept',
      body: [
        'Start `slow` and `fast` at the head. Each move, `slow` steps 1 and `fast` steps 2.',
        'With a cycle, fast laps slow and they meet inside the loop. Without one, fast reaches the end.',
      ],
      keyIdea: 'Two pointers at different speeds turn "is there a loop" into "do they ever meet".',
      frames: P1.slice(0, 3).map((p) => ({ state: detectState(p), hold: 1400 })),
    },
    {
      label: 'Detect',
      title: 'Run until they meet',
      tag: 'technique',
      body: [
        'Loop while `fast` and `fast.next` exist: `fast.next.next` would throw on a null `fast.next`.',
        'Compare **after** moving. Both started at head, so comparing first would fire at once.',
      ],
      keyIdea: 'If they meet, there is a cycle. If fast hits null, there is not.',
      frames: P1.map((p) => ({ state: detectState(p), hold: 1300 })),
    },
    {
      label: 'Why meet',
      title: 'The gap shrinks by one',
      tag: 'concept',
      body: [
        'Once both are inside the cycle, fast gains exactly one node per move.',
        'The gap goes through every value down to 0 and cannot jump over it.',
      ],
      keyIdea: 'A gap that changes by exactly 1 per step must hit 0.',
      frames: gapFrames,
    },
    {
      label: 'Cycle start',
      title: 'Phase 2: find the entry',
      tag: 'technique',
      body: [
        'Meeting somewhere in the loop is not the answer: returning `slow` is a classic bug.',
        'Put a `probe` at the head and keep `slow` at the meeting point. Move both one step at a time. They meet at the cycle start.',
      ],
      keyIdea: 'Reset one pointer to head, move both at speed 1, and the meeting node is the cycle start.',
      frames: phase2(),
    },
    {
      label: 'The math',
      title: 'Why phase 2 works',
      tag: 'concept',
      body: [
        'Let `F` be head to cycle start, `C` the cycle length, `a` cycle start to meeting point.',
        'Slow walked `F + a`, fast walked `2(F + a)`, which is also `F + a + n·C`. So `F = n·C - a`.',
      ],
      keyIdea: 'Walking F steps from the meeting point lands exactly on the cycle start.',
      frames: mathFrames,
    },
    {
      label: 'Middle',
      title: 'Which middle?',
      tag: 'trade-off',
      body: [
        'No cycle: when fast reaches the end, slow is at the middle. For `[1..6]` that is the **second** middle, 4.',
        'To split a list into halves you want the first middle. Loop on `fast.next && fast.next.next` instead.',
      ],
      keyIdea: 'The loop condition decides which middle you get on an even length list.',
      frames: [...middleFrames(false), ...middleFrames(true)],
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** cycle, middle, kth from the end, happy number, with O(1) space.',
        '- **Detect:** slow +1, fast +2, loop while `fast && fast.next`, compare after moving.',
        '- **Start:** probe from head, slow from the meeting point, both +1.',
        '- **Middle:** where slow is when fast runs out.',
        '- **Beyond lists:** anything with a `next(x)`, like find the duplicate number.',
      ],
      keyIdea: 'Two speeds give you cycle detection, the cycle start and the middle with no extra memory.',
      frames: [{ state: RECAP }],
    },
  ],
});
