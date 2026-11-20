import { defineLesson } from '../define';
import type { ArrayState, Cell } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Bars show log10 of the operation count, so a bar of 8 means 10^8 operations.
 * Every bar is computed from the real formula for the chosen n, so the numbers stay honest.
 */

const BUDGET = 8; // about 10^8 simple operations per second

type Cx = '1' | 'log n' | 'n' | 'nlogn' | 'n²' | 'n³' | '2^n' | 'n!';

function log10Fact(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log10(i);
  return s;
}

const LOG_OPS: Record<Cx, (n: number) => number> = {
  '1': () => 0,
  'log n': (n) => Math.log10(Math.log2(n)),
  n: (n) => Math.log10(n),
  nlogn: (n) => Math.log10(n * Math.log2(n)),
  'n²': (n) => 2 * Math.log10(n),
  'n³': (n) => 3 * Math.log10(n),
  '2^n': (n) => n * Math.log10(2),
  'n!': (n) => log10Fact(n),
};

const r1 = (x: number) => Math.round(x * 10) / 10;

function fmtN(n: number): string {
  const e = Math.log10(n);
  return Number.isInteger(e) && e >= 3 ? `10^${e}` : String(n);
}

type Bar = Cx | 'budget';

/** Bars for one n. `idOf` lets a bar keep its id while its complexity changes, so it morphs. */
function bars(n: number, list: Bar[], idOf: (b: Bar, i: number) => string = (b) => b): ArrayState['rows'] {
  const values: Cell[] = [];
  const names: Cell[] = [];
  const states: Record<number, ItemState> = {};
  list.forEach((b, i) => {
    const v = b === 'budget' ? BUDGET : r1(LOG_OPS[b](n));
    values.push({ v, id: `v-${idOf(b, i)}` });
    names.push({ v: b === 'budget' ? '1 sec' : b, id: `n-${idOf(b, i)}` });
    states[i] = b === 'budget' ? 'active' : v > BUDGET ? 'bad' : 'done';
  });
  return [
    { label: '10^x ops', cells: values, states, bars: true, showIndex: false },
    { label: 'O( )', cells: names, states, showIndex: false },
  ];
}

const fits = (n: number, list: Cx[]) => list.filter((c) => LOG_OPS[c](n) <= BUDGET);

// Step 1: the estimate that kills nested loops at n = 10^5.
const PROBLEM: Frame<ArrayState>[] = [
  {
    hold: 1600,
    state: {
      rows: bars(1e5, ['budget']),
      stats: [
        { label: 'n', value: '10^5' },
        { label: 'Budget', value: '~10^8 ops/s' },
        { label: 'Idea', value: 'nested loops' },
      ],
      note: { text: 'a machine does roughly 10^8 simple operations per second' },
    },
  },
  {
    state: {
      rows: bars(1e5, ['n²', 'budget']),
      stats: [
        { label: 'n', value: '10^5' },
        { label: 'n² ops', value: '10^10', tone: 'bad' },
        { label: 'Time', value: '~100 s', tone: 'bad', hint: '10^10 / 10^8' },
      ],
      note: { text: 'O(n²) at n = 10^5 is 100 times over budget', tone: 'bad' },
    },
  },
];

// Step 2: the complexity ladder at n = 10^5, one bar at a time.
const LADDER: Bar[] = ['log n', 'n', 'nlogn', 'budget', 'n²'];
const ladderFrames: Frame<ArrayState>[] = LADDER.map((_, k) => {
  const shown = LADDER.slice(0, k + 1);
  const last = shown[shown.length - 1];
  const v = last === 'budget' ? BUDGET : r1(LOG_OPS[last](1e5));
  return {
    hold: 1100,
    state: {
      rows: bars(1e5, shown),
      stats: [
        { label: 'n', value: '10^5' },
        { label: last === 'budget' ? 'Budget' : `O(${last})`, value: `10^${v}`, tone: last === 'budget' ? 'neutral' : v > BUDGET ? 'bad' : 'ok' },
        { label: 'Fits', value: fits(1e5, shown.filter((b): b is Cx => b !== 'budget')).pop() ?? '-', tone: 'ok' },
      ],
      note: k === LADDER.length - 1 ? { text: 'n log n fits, n² does not: the target is O(n log n)', tone: 'accent' } : undefined,
    },
  };
});

// Step 3: the lookup table from the notes.
const TABLE: { n: string; cx: string; how: string }[] = [
  { n: '12', cx: 'n!', how: 'permutations, brute force backtracking' },
  { n: '25', cx: '2^n', how: 'subsets, bitmask DP' },
  { n: '500', cx: 'n³', how: 'triple loops, Floyd-Warshall' },
  { n: '5000', cx: 'n²', how: 'nested loops, 2D DP' },
  { n: '10^5', cx: 'nlogn', how: 'sort, heap, binary search, sweep line' },
  { n: '10^6', cx: 'n', how: 'hash map, two pointers, sliding window' },
  { n: '10^9', cx: 'log n', how: 'binary search on answer, math formula' },
];

function tableState(at: number | null): ArrayState {
  const states: Record<number, ItemState> = {};
  TABLE.forEach((_, i) => {
    states[i] = at === null ? 'done' : i === at ? 'active' : i < at ? 'dim' : 'normal';
  });
  const row = at === null ? null : TABLE[at];
  return {
    rows: [
      { label: 'n at most', cells: TABLE.map((t) => t.n), states, pointers: at === null ? [] : [{ i: at, label: 'n', up: true }], showIndex: false },
      { label: 'target', cells: TABLE.map((t) => t.cx), states, showIndex: false },
    ],
    stats: row
      ? [
          { label: 'n at most', value: row.n },
          { label: 'Target', value: `O(${row.cx})`, tone: 'ok' },
          { label: 'Budget', value: '~10^8 ops' },
        ]
      : [
          { label: 'Small n', value: 'exponential ok' },
          { label: 'Big n', value: 'O(n) or less' },
          { label: 'Budget', value: '~10^8 ops/s' },
        ],
    note: row ? { text: `typical: ${row.how}`, tone: 'accent' } : undefined,
  };
}

// Step 4: small n, exponential is allowed.
const SMALL: Bar[] = ['n³', '2^n', 'n!', 'budget'];
const smallFrames: Frame<ArrayState>[] = [10, 20, 25].map((n) => ({
  hold: 1700,
  state: {
    rows: bars(n, SMALL),
    stats: [
      { label: 'n', value: String(n) },
      { label: '2^n', value: `10^${r1(LOG_OPS['2^n'](n))}`, tone: LOG_OPS['2^n'](n) <= BUDGET ? 'ok' : 'bad' },
      { label: 'n!', value: `10^${r1(LOG_OPS['n!'](n))}`, tone: LOG_OPS['n!'](n) <= BUDGET ? 'ok' : 'bad' },
    ],
    note:
      n === 10
        ? { text: 'n ≤ 12: even n! permutations fit' }
        : n === 20
          ? { text: 'n ≤ 25: n! is hopeless, 2^n subsets still fit', tone: 'accent' }
          : { text: '2^25 is about 3 x 10^7: bitmask DP territory', tone: 'accent' },
  },
}));

// Step 5: huge n, even linear is too slow.
const BIG: Bar[] = ['1', 'log n', 'n', 'nlogn', 'budget'];
const bigFrames: Frame<ArrayState>[] = [1e6, 1e9].map((n) => ({
  hold: 2000,
  state: {
    rows: bars(n, BIG),
    stats: [
      { label: 'n', value: fmtN(n) },
      { label: 'O(n)', value: `10^${r1(LOG_OPS.n(n))}`, tone: LOG_OPS.n(n) <= BUDGET ? 'ok' : 'bad' },
      { label: 'Fits', value: fits(n, ['1', 'log n', 'n', 'nlogn']).pop() ?? '-', tone: 'ok' },
    ],
    note:
      n === 1e6
        ? { text: 'n = 10^6: O(n) with a hash map, two pointers or a window' }
        : { text: 'n = 10^9: only O(log n) or O(1) survive', tone: 'bad' },
  },
}));

// Step 6: an O(n²) idea at n = 10^5 means a pattern exists.
const IDEAS: { cx: Cx; how: string }[] = [
  { cx: 'n²', how: 'first idea: nested loops' },
  { cx: 'nlogn', how: 'sort first, or use a heap' },
  { cx: 'n', how: 'hash map, two pointers, sliding window' },
];
const ideaFrames: Frame<ArrayState>[] = IDEAS.map(({ cx, how }, k) => {
  const v = r1(LOG_OPS[cx](1e5));
  return {
    hold: 1800,
    state: {
      rows: bars(1e5, [cx, 'budget'], (b) => (b === 'budget' ? 'budget' : 'idea')),
      stats: [
        { label: 'n', value: '10^5' },
        { label: 'Idea', value: `O(${cx})`, tone: v > BUDGET ? 'bad' : 'ok' },
        { label: 'Ops', value: `10^${v}`, tone: v > BUDGET ? 'bad' : 'ok' },
      ],
      note: { text: how, tone: k === 0 ? 'bad' : 'ok' },
    },
  };
});

export default defineLesson('array', {
  slug: 'complexity',
  objectives: [
    { text: 'Use the 10^8 operations per second budget', step: 2 },
    { text: 'Map the input size to a target complexity', step: 3 },
    { text: 'Recognise when exponential search is allowed', step: 4 },
    { text: 'Treat an O(n²) idea at n = 10^5 as a hint that a pattern exists', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Will nested loops pass?',
      tag: 'problem',
      body: [
        'The input has **n = 10^5** items and your first idea is two nested loops.',
        'That is 10^10 operations. A machine does roughly **10^8** simple operations per second, so it needs about 100 seconds.',
      ],
      keyIdea: 'Estimate before you code: operations divided by 10^8 is roughly the run time in seconds.',
      frames: PROBLEM,
    },
    {
      label: 'Budget',
      title: 'Line every complexity up against the budget',
      tag: 'concept',
      body: [
        'Each bar is the operation count at n = 10^5, written as a power of ten. A bar of 8 is the one-second budget.',
        'Anything taller than the budget is too slow. The tallest bar that still fits is your target.',
      ],
      keyIdea: 'Work out which complexity is allowed from n, then look for an algorithm with that cost.',
      frames: ladderFrames,
    },
    {
      label: 'The table',
      title: 'n tells you the target',
      tag: 'technique',
      body: [
        'Read the constraint, find the largest n in the table, and the complexity under it is what the problem expects.',
        'Each row also hints at the techniques that usually reach that complexity.',
      ],
      keyIdea: 'The constraints are a hint the problem setter gives you on purpose.',
      frames: [...TABLE.map((_, i) => ({ state: tableState(i), hold: 1300 })), { state: tableState(null) }],
    },
    {
      label: 'Small n',
      title: 'Tiny n allows exponential work',
      tag: 'technique',
      body: [
        'When n is at most 10 to 12, **O(n!)** permutations fit. At 20 to 25, **O(2^n)** subsets or bitmask DP fit, but n! explodes.',
        'A very small limit is the problem telling you brute force search is fine.',
      ],
      keyIdea: 'n ≤ 12 suggests permutations, n ≤ 25 suggests subsets or bitmask DP.',
      frames: smallFrames,
    },
    {
      label: 'Huge n',
      title: 'Huge n needs log n or a formula',
      tag: 'technique',
      body: [
        'At n = 10^6 a single pass, **O(n)**, still fits.',
        'At n = 10^9 or more even reading every value is over budget. Only **O(log n)** or **O(1)** survive: binary search on the answer or a math formula.',
      ],
      keyIdea: 'If n is 10^9, you are not meant to touch every value.',
      frames: bigFrames,
    },
    {
      label: 'O(n²) hint',
      title: 'Too slow means a pattern exists',
      tag: 'trade-off',
      body: [
        'If your first idea is O(n²) and n is 10^5, the problem is telling you a pattern exists.',
        'Sorting, a heap or binary search gets you to O(n log n). A hash map, two pointers or a sliding window gets you to O(n).',
      ],
      keyIdea: 'Do not optimise the nested loop. Replace it with the pattern the constraint is pointing at.',
      frames: ideaFrames,
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Budget:** roughly 10^8 simple operations per second.',
        '- **n ≤ 12:** O(n!). **n ≤ 25:** O(2^n). **n ≤ 500:** O(n³). **n ≤ 5000:** O(n²).',
        '- **n ≤ 10^5:** O(n log n). **n ≤ 10^6:** O(n). **n ≥ 10^9:** O(log n) or O(1).',
        '- **Hint:** an O(n²) idea at n = 10^5 means a faster pattern exists.',
      ],
      keyIdea: 'Read n first. It narrows the search for an algorithm before you write any code.',
      frames: [{ state: tableState(null) }],
    },
  ],
});
