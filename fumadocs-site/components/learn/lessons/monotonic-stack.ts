import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Frames come from running dailyTemperatures for real.
 * Row 1 is the temperatures, row 2 the answers filling in, and the side panel is the stack of unresolved indices.
 */

const TEMPS = [73, 74, 75, 71, 69, 72, 76, 73];
const N = TEMPS.length;

type Event =
  | { kind: 'start'; i: number }
  | { kind: 'pop'; i: number; j: number }
  | { kind: 'push'; i: number };

type Snap = { ev: Event; stack: number[]; answer: (number | null)[]; pushes: number; pops: number };

/** Run the algorithm, recording a snapshot after every pop and every push. `greater` false gives next colder. */
function run(greater = true): Snap[] {
  const answer: (number | null)[] = new Array(N).fill(null);
  const stack: number[] = [];
  const snaps: Snap[] = [];
  let pushes = 0;
  let pops = 0;
  const beats = (a: number, b: number) => (greater ? a > b : a < b);
  for (let i = 0; i < N; i++) {
    snaps.push({ ev: { kind: 'start', i }, stack: [...stack], answer: [...answer], pushes, pops });
    while (stack.length > 0 && beats(TEMPS[i], TEMPS[stack[stack.length - 1]])) {
      const j = stack.pop()!;
      answer[j] = i - j;
      pops++;
      snaps.push({ ev: { kind: 'pop', i, j }, stack: [...stack], answer: [...answer], pushes, pops });
    }
    stack.push(i);
    pushes++;
    snaps.push({ ev: { kind: 'push', i }, stack: [...stack], answer: [...answer], pushes, pops });
  }
  return snaps;
}

function stateOf(s: Snap, opts: { greater?: boolean; finalZeros?: boolean } = {}): ArrayState {
  const greater = opts.greater ?? true;
  const i = s.ev.i;
  const states: Record<number, ItemState> = {};
  for (let k = 0; k < N; k++) if (s.answer[k] !== null) states[k] = 'done';
  for (const k of s.stack) states[k] = 'visited';
  states[i] = 'active';
  const ansStates: Record<number, ItemState> = {};
  s.answer.forEach((a, k) => {
    if (a !== null) ansStates[k] = 'done';
    else if (opts.finalZeros) ansStates[k] = 'dim';
  });
  let note: ArrayState['note'];
  const pointers: NonNullable<ArrayState['rows'][number]['pointers']> = [{ i, label: 'i' }];
  if (s.ev.kind === 'pop') {
    const j = s.ev.j;
    states[j] = 'found';
    ansStates[j] = 'found';
    pointers.push({ i: j, label: 'j', tone: 'ok', up: true });
    note = { text: `${TEMPS[i]} ${greater ? '>' : '<'} ${TEMPS[j]}: pop ${j}, answer[${j}] = ${i} - ${j} = ${i - j}`, tone: 'ok' };
  } else if (s.ev.kind === 'push') {
    note = { text: `push ${i}: its ${greater ? 'warmer' : 'colder'} day is still unknown` };
  } else {
    const top = s.stack[s.stack.length - 1];
    note = top === undefined ? { text: 'stack is empty' } : { text: `compare ${TEMPS[i]} with top ${TEMPS[top]}` };
  }
  return {
    rows: [
      { label: 'temps', cells: TEMPS, states, pointers },
      { label: 'answer', cells: s.answer.map((a) => (a === null ? (opts.finalZeros ? 0 : '') : a)), states: ansStates, showIndex: false },
    ],
    panels: [{ title: 'stack', kind: 'stack', items: s.stack.map((k) => `${k}: ${TEMPS[k]}`), highlight: s.stack.length - 1 }],
    stats: [
      { label: 'i', value: String(i) },
      { label: 'Pushes', value: String(s.pushes) },
      { label: 'Pops', value: String(s.pops), tone: s.ev.kind === 'pop' ? 'ok' : 'neutral' },
    ],
    note,
  };
}

const SNAPS = run();

// Step 1: brute force, day 2 scans right until it finds something warmer.
function bruteFrames(): Frame<ArrayState>[] {
  const frames: Frame<ArrayState>[] = [];
  const i = 2;
  for (let j = i + 1; j < N; j++) {
    const hit = TEMPS[j] > TEMPS[i];
    frames.push({
      hold: hit ? 1900 : 800,
      state: {
        rows: [
          {
            label: 'temps',
            cells: TEMPS,
            states: { [i]: 'active', [j]: hit ? 'found' : 'bad' },
            window: { from: i, to: j, label: hit ? `${j - i} days` : 'scanning', tone: hit ? 'ok' : undefined },
            pointers: [
              { i, label: 'day' },
              { i: j, label: 'j', tone: 'info' },
            ],
          },
        ],
        stats: [
          { label: 'Day', value: `${i}: ${TEMPS[i]}` },
          { label: 'Checks', value: String(j - i), tone: j - i > 2 ? 'bad' : 'neutral' },
          { label: 'Worst case', value: 'O(n²)', tone: 'bad' },
        ],
        note: hit ? { text: `76 is the first warmer day, ${j - i} days later. Every day may rescan the rest.`, tone: 'bad' } : undefined,
      },
    });
    if (hit) break;
  }
  return frames;
}

// Per-day frames for the full run: the last snapshot of each i.
const perDay = Array.from({ length: N }, (_, i) => SNAPS.filter((s) => s.ev.i === i).pop()!);

// Step 3: zoom into day 5 and day 6, every pop shown.
const zoom = SNAPS.filter((s) => s.ev.i === 5 || s.ev.i === 6);

// Step 5: work per day as bars, filled one day at a time.
function workFrames(): Frame<ArrayState>[] {
  const popsPer = Array.from({ length: N }, (_, i) => SNAPS.filter((s) => s.ev.kind === 'pop' && s.ev.i === i).length);
  const depth = perDay.map((s) => s.stack.length);
  const frames: Frame<ArrayState>[] = [];
  for (let d = 0; d < N; d++) {
    const total = popsPer.slice(0, d + 1).reduce((a, b) => a + b, 0);
    frames.push({
      hold: d === N - 1 ? 2400 : 650,
      state: {
        rows: [
          { label: 'pops', cells: popsPer.map((p, k) => (k <= d ? p : 0)), bars: true, states: { [d]: 'active' }, showIndex: true },
          { label: 'stack size', cells: depth.map((p, k) => (k <= d ? p : '')), states: { [d]: 'active' }, showIndex: false },
        ],
        stats: [
          { label: 'Pushes', value: String(d + 1), hint: 'one per index' },
          { label: 'Pops', value: String(total), hint: 'at most one per index' },
          { label: 'Total', value: d === N - 1 ? `${d + 1 + total} ≤ 2n` : String(d + 1 + total), tone: d === N - 1 ? 'ok' : 'neutral' },
        ],
        note: d === N - 1 ? { text: 'some days pop two, most pop none: the total is O(n)', tone: 'ok' } : undefined,
      },
    });
  }
  return frames;
}

// Step 6: leftovers stay 0.
const LAST = SNAPS[SNAPS.length - 1];
const leftoverFrames: Frame<ArrayState>[] = [
  { hold: 1800, state: { ...stateOf(LAST), note: { text: 'scan done: indices 6 and 7 are still on the stack' } } },
  {
    state: {
      ...stateOf(LAST, { finalZeros: true }),
      stats: [
        { label: 'Leftovers', value: '6, 7' },
        { label: 'Answer', value: '0', tone: 'ok', hint: 'from fill(0)' },
        { label: 'Answer row', value: 'complete', tone: 'ok' },
      ],
      note: { text: 'no warmer day ever came: their answer stays 0', tone: 'accent' },
    },
  },
];

// Step 7: flip the comparison for the next colder day. The stack becomes increasing.
const COLD = run(false);
const coldPerDay = Array.from({ length: N }, (_, i) => COLD.filter((s) => s.ev.i === i).pop()!);
const coldFrames: Frame<ArrayState>[] = coldPerDay.map((s) => ({ hold: 1000, state: stateOf(s, { greater: false }) }));
coldFrames[coldFrames.length - 1] = {
  state: { ...stateOf(COLD[COLD.length - 1], { greater: false, finalZeros: true }), note: { text: 'same loop, < instead of >: the stack is now increasing', tone: 'accent' } },
};

const RECAP: ArrayState = stateOf(LAST, { finalZeros: true });
RECAP.note = undefined;
RECAP.stats = [
  { label: 'Time', value: 'O(n)', tone: 'ok' },
  { label: 'Space', value: 'O(n)', hint: 'the stack' },
  { label: 'Each index', value: 'in once, out once' },
];

export default defineLesson('array', {
  slug: 'monotonic-stack',
  objectives: [
    { text: 'See why scanning right from every day is O(n²)', step: 1 },
    { text: 'Keep unresolved indices on a decreasing stack', step: 2 },
    { text: 'Resolve answers when a new element breaks the order', step: 3 },
    { text: 'Argue the O(n) bound: one push and one pop per index', step: 5 },
    { text: 'Flip the comparison for next smaller', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'How long until a warmer day?',
      tag: 'problem',
      body: [
        'For each day in `[73, 74, 75, 71, 69, 72, 76, 73]`, how many days until a warmer one?',
        'Scanning right from every day works, but day 2 alone checks four days before finding 76. In the worst case that is O(n²).',
      ],
      keyIdea: '"Next greater" or "next smaller" for every element is the signal for a monotonic stack.',
      frames: bruteFrames(),
    },
    {
      label: 'The stack',
      title: 'Park the unresolved days',
      tag: 'concept',
      body: [
        'Keep a stack of **indices whose answer is still unknown**. Their temperatures are always decreasing from bottom to top.',
        'Day 0 waits. Day 1 is warmer, so it resolves day 0 and takes its place.',
      ],
      keyIdea: 'The stack holds indices, not values, so the answer can be a distance: i - j.',
      frames: SNAPS.slice(0, 6).map((s) => ({ state: stateOf(s), hold: 1200 })),
    },
    {
      label: 'Pop',
      title: 'One warm day resolves many',
      tag: 'technique',
      body: [
        'When `temps[i]` is greater than the top, the top has found its next warmer day: pop it and set `answer[j] = i - j`. Repeat while it keeps winning.',
        'Day 6 (76) pops both 72 and 75 at once.',
      ],
      keyIdea: 'A new element that breaks the order resolves every element it pops.',
      frames: zoom.map((s) => ({ state: stateOf(s), hold: 1300 })),
    },
    {
      label: 'Full run',
      title: 'Daily temperatures, every day',
      tag: 'technique',
      body: ['Each day: pop everything colder than today and record the distance, then push today.', 'The answers fill in out of order, whenever a warmer day shows up.'],
      keyIdea: 'Pop while the new element beats the top, then push it.',
      frames: perDay.map((s) => ({ state: stateOf(s), hold: 1100 })),
    },
    {
      label: 'Why O(n)',
      title: 'In once, out once',
      tag: 'concept',
      body: [
        'The `while` inside the `for` looks like O(n²). But every index is **pushed once** and **popped at most once**.',
        'Here: 8 pushes and 6 pops, no matter how they are spread across days.',
      ],
      keyIdea: 'Count total pushes and pops, not work per iteration: the scan is O(n).',
      frames: workFrames(),
    },
    {
      label: 'Leftovers',
      title: 'Never resolved means 0',
      tag: 'technique',
      body: ['When the scan ends, whatever is still on the stack never saw a warmer day.', 'The answer array starts filled with `0`, so those slots are already correct: `[1, 1, 4, 2, 1, 1, 0, 0]`.'],
      keyIdea: 'Initialise the answer with the "not found" value and leftovers take care of themselves.',
      frames: leftoverFrames,
    },
    {
      label: 'Flip it',
      title: 'Increasing or decreasing',
      tag: 'trade-off',
      body: [
        'For the next **smaller** element, flip the comparison. The stack now keeps increasing values.',
        'Which order to keep is the only decision: it follows from what the popped element is waiting for.',
      ],
      keyIdea: 'Next greater: decreasing stack. Next smaller: increasing stack.',
      frames: coldFrames,
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** next greater or smaller element, for every position.',
        '- **Stack:** indices whose answer is unknown, kept in monotonic order.',
        '- **Loop:** pop while the new element breaks the order and record the answer, then push.',
        '- **Cost:** O(n), each index pushed once and popped once.',
        '- **Also solves:** next greater element, stock span, largest rectangle in a histogram, trapping rain water, remove K digits.',
      ],
      keyIdea: 'Elements wait on the stack until the element that answers them arrives.',
      frames: [{ state: RECAP }],
    },
  ],
});
