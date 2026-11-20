import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';
import type { Frame } from '../types';

/*
 * One lane per input interval, plus a "merged" lane that grows as the real merge loop runs.
 * Bars keep stable ids so a growing merged interval stretches instead of popping.
 */

type Iv = [number, number];
const lbl = ([s, e]: Iv) => `[${s}, ${e}]`;

const INPUT: Iv[] = [
  [1, 3],
  [2, 6],
  [8, 10],
  [15, 18],
];

const base = (over: Partial<TimelineState> & Pick<TimelineState, 'lanes'>): TimelineState => ({ from: 0, to: 20, ticks: [0, 5, 10, 15, 20], ...over });

const inputLanes = (ivs: Iv[], state: (k: number) => TimelineBar['state'] = () => 'normal', prefix = 'in') =>
  ivs.map((iv, k) => ({ label: `#${k + 1}`, bars: [{ id: `${prefix}${k}`, from: iv[0], to: iv[1], label: lbl(iv), state: state(k) }] }));

// Step 1: the problem, bars appear one at a time.
const problemFrames: Frame<TimelineState>[] = [
  ...INPUT.map((_, k) => ({
    hold: 700,
    state: base({
      lanes: inputLanes(INPUT.slice(0, k + 1)),
      stats: [
        { label: 'Intervals', value: String(k + 1) },
        { label: 'Overlaps', value: k >= 1 ? '1' : '0', tone: k >= 1 ? ('bad' as const) : ('neutral' as const) },
        { label: 'Goal', value: 'merge them' },
      ],
    }),
  })),
  {
    state: base({
      lanes: inputLanes(INPUT, (k) => (k < 2 ? 'active' : 'dim')),
      stats: [
        { label: 'Intervals', value: '4' },
        { label: 'Overlaps', value: '1', tone: 'bad' },
        { label: 'Answer', value: '3 blocks', tone: 'ok' },
      ],
      note: { text: '[2, 6] starts before [1, 3] ends: they collide', tone: 'bad' },
    }),
  },
];

// Step 2: the six ways two intervals can relate (a1 <= b1 after sorting).
const RELATIONS: { name: string; a: Iv; b: Iv; overlap: string }[] = [
  { name: 'disjoint', a: [2, 6], b: [10, 14], overlap: 'no: a2 < b1' },
  { name: 'touching', a: [2, 8], b: [8, 14], overlap: 'ask: a2 == b1' },
  { name: 'partial', a: [2, 10], b: [7, 16], overlap: 'yes' },
  { name: 'b inside a', a: [2, 16], b: [6, 11], overlap: 'yes: b2 <= a2' },
  { name: 'same start', a: [2, 12], b: [2, 7], overlap: 'yes' },
  { name: 'same', a: [2, 10], b: [2, 10], overlap: 'yes' },
];
const relationFrames: Frame<TimelineState>[] = RELATIONS.map((r, k) => ({
  hold: 1500,
  state: base({
    lanes: [
      { label: 'a', bars: [{ id: 'a', from: r.a[0], to: r.a[1], label: lbl(r.a), tone: 'info' }] },
      { label: 'b', bars: [{ id: 'b', from: r.b[0], to: r.b[1], label: lbl(r.b), tone: 'violet' }] },
    ],
    stats: [
      { label: 'Case', value: `${k + 1}. ${r.name}` },
      { label: 'Overlap?', value: r.overlap, tone: r.overlap.startsWith('yes') ? 'ok' : r.overlap.startsWith('no') ? 'bad' : 'neutral' },
      { label: 'Sorted by', value: 'start' },
    ],
  }),
}));

// Step 3: one comparison, b1 <= a2.
function compare(a: Iv, b: Iv): Frame<TimelineState>[] {
  const overlap = b[0] <= a[1];
  const merged: Iv = [a[0], Math.max(a[1], b[1])];
  return [
    {
      hold: 1700,
      state: base({
        lanes: [
          { label: 'last', bars: [{ id: 'a', from: a[0], to: a[1], label: lbl(a), tone: 'info' }] },
          { label: 'cur', bars: [{ id: 'b', from: b[0], to: b[1], label: lbl(b), tone: 'violet', state: 'active' }] },
          { label: 'merged', bars: [{ id: 'm0', from: a[0], to: a[1], label: lbl(a), tone: 'ok' }] },
        ],
        markers: [{ at: a[1], label: `a2 = ${a[1]}`, tone: overlap ? 'ok' : 'bad' }],
        stats: [
          { label: 'Test', value: `${b[0]} <= ${a[1]}?` },
          { label: 'Result', value: overlap ? 'overlap' : 'gap', tone: overlap ? 'ok' : 'bad' },
          { label: 'Compares', value: '1' },
        ],
      }),
    },
    {
      hold: 1800,
      state: base({
        lanes: [
          { label: 'last', bars: [{ id: 'a', from: a[0], to: a[1], label: lbl(a), tone: 'info', state: 'dim' }] },
          { label: 'cur', bars: [{ id: 'b', from: b[0], to: b[1], label: lbl(b), tone: 'violet', state: 'dim' }] },
          {
            label: 'merged',
            bars: overlap
              ? [{ id: 'm0', from: merged[0], to: merged[1], label: lbl(merged), tone: 'ok', state: 'active' }]
              : [
                  { id: 'm0', from: a[0], to: a[1], label: lbl(a), tone: 'ok' },
                  { id: 'm1', from: b[0], to: b[1], label: lbl(b), tone: 'ok', state: 'active' },
                ],
          },
        ],
        stats: [
          { label: 'Test', value: `${b[0]} <= ${a[1]}?` },
          { label: 'Result', value: overlap ? 'overlap' : 'gap', tone: overlap ? 'ok' : 'bad' },
          { label: 'Action', value: overlap ? 'extend end' : 'push cur' },
        ],
        note: overlap
          ? { text: `merged = [a1, max(a2, b2)] = ${lbl(merged)}`, tone: 'ok' }
          : { text: 'no overlap: last is finished, push cur', tone: 'accent' },
      }),
    },
  ];
}

/** The real merge loop, one frame per interval. */
function mergeFrames(input: Iv[], opts: { sort?: boolean; useMax?: boolean } = {}): { frames: Frame<TimelineState>[]; result: Iv[] } {
  const sort = opts.sort ?? true;
  const useMax = opts.useMax ?? true;
  const ivs = input.map((iv, k) => ({ iv, k }));
  if (sort) ivs.sort((x, y) => x.iv[0] - y.iv[0]);
  const merged: { iv: Iv; id: string }[] = [];
  const frames: Frame<TimelineState>[] = [];
  ivs.forEach(({ iv }, step) => {
    const [start, end] = iv;
    const last = merged[merged.length - 1];
    const overlap = !!last && start <= last.iv[1];
    if (overlap) last.iv = [last.iv[0], useMax ? Math.max(last.iv[1], end) : end];
    else merged.push({ iv: [start, end], id: `m${merged.length}` });
    const changed = overlap ? last.id : merged[merged.length - 1].id;
    frames.push({
      hold: 1500,
      state: base({
        lanes: [
          ...ivs.map(({ iv: v }, j) => ({ label: `#${j + 1}`, bars: [{ id: `in${j}`, from: v[0], to: v[1], label: lbl(v), state: j === step ? ('active' as const) : j < step ? ('dim' as const) : ('normal' as const) }] })),
          { label: 'merged', bars: merged.map((m) => ({ id: m.id, from: m.iv[0], to: m.iv[1], label: lbl(m.iv), tone: 'ok' as const, state: m.id === changed ? ('active' as const) : ('normal' as const) })) },
        ],
        markers: last ? [{ at: overlap ? last.iv[1] : start, label: overlap ? `end ${last.iv[1]}` : `gap at ${start}`, tone: overlap ? 'ok' : 'accent' }] : undefined,
        stats: [
          { label: 'cur', value: lbl(iv) },
          { label: 'Overlap', value: !last ? 'first' : overlap ? 'yes' : 'no', tone: overlap ? 'ok' : 'neutral' },
          { label: 'Merged', value: String(merged.length) },
        ],
      }),
    });
  });
  return { frames, result: merged.map((m) => m.iv) };
}

const MAIN = mergeFrames(INPUT);
MAIN.frames[MAIN.frames.length - 1].state.note = { text: `${MAIN.result.map(lbl).join(', ')}: O(n log n) sort + O(n) scan`, tone: 'ok' };

// Step 5: the "b inside a" case needs Math.max.
const WRONG = mergeFrames(
  [
    [1, 10],
    [2, 3],
  ],
  { useMax: false },
);
const RIGHT = mergeFrames([
  [1, 10],
  [2, 3],
]);
const maxFrames: Frame<TimelineState>[] = [
  { ...WRONG.frames[0], hold: 1200 },
  { hold: 2000, state: { ...WRONG.frames[1].state, lanes: WRONG.frames[1].state.lanes.map((l) => (l.label === 'merged' ? { ...l, bars: l.bars.map((b) => ({ ...b, state: 'bad' as const })) } : l)), note: { text: 'last.end = cur.end shrinks it to [1, 3]', tone: 'bad' } } },
  { state: { ...RIGHT.frames[1].state, note: { text: 'max(10, 3) keeps [1, 10]', tone: 'ok' } } },
];

// Step 6: insert interval, three phases, no sort.
function insertFrames(): Frame<TimelineState>[] {
  const intervals: Iv[] = [
    [1, 3],
    [6, 9],
  ];
  const add: Iv = [2, 5];
  const frames: Frame<TimelineState>[] = [];
  const result: { iv: Iv; id: string }[] = [];
  const lanes = (active: number | null, phase: string) => [
    ...intervals.map((iv, j) => ({ label: `#${j + 1}`, bars: [{ id: `in${j}`, from: iv[0], to: iv[1], label: lbl(iv), state: j === active ? ('active' as const) : ('normal' as const) }] })),
    { label: 'new', bars: [{ id: 'new', from: add[0], to: add[1], label: lbl(add), tone: 'violet' as const, state: phase === 'merge' ? ('active' as const) : ('normal' as const) }] },
    { label: 'result', bars: result.map((r) => ({ id: r.id, from: r.iv[0], to: r.iv[1], label: lbl(r.iv), tone: 'ok' as const })) },
  ];
  const push = (active: number | null, phase: string, note: string, markers?: TimelineState['markers']) =>
    frames.push({
      hold: 1900,
      state: base({
        to: 12,
        ticks: [0, 3, 6, 9, 12],
        lanes: lanes(active, phase),
        markers,
        stats: [
          { label: 'Phase', value: phase },
          { label: 'Sort', value: 'not needed', tone: 'ok' },
          { label: 'Result', value: String(result.length) },
        ],
        note: { text: note, tone: 'accent' },
      }),
    });
  const n = intervals.length;
  let i = 0;
  push(0, '1. copy', `${lbl(intervals[0])} ends at 3, not before 2: nothing to copy`, [{ at: add[0], label: 'new starts 2', tone: 'violet' }]);
  while (i < n && intervals[i][1] < add[0]) result.push({ iv: intervals[i], id: `r${i++}` });
  let [s, e] = add;
  while (i < n && intervals[i][0] <= e) {
    s = Math.min(s, intervals[i][0]);
    e = Math.max(e, intervals[i][1]);
    i++;
  }
  result.push({ iv: [s, e], id: 'rnew' });
  push(0, '2. merge', `overlaps grow it to ${lbl([s, e])}; [6, 9] starts after 5`, [{ at: e, label: `end ${e}`, tone: 'ok' }]);
  while (i < n) result.push({ iv: intervals[i], id: `r${i++}` });
  push(1, '3. copy rest', `${result.map((r) => lbl(r.iv)).join(', ')} in O(n)`);
  return frames;
}

// Step 7: the sort is not optional.
const UNSORTED: Iv[] = [
  [1, 4],
  [8, 9],
  [2, 3],
];
const NOSORT = mergeFrames(UNSORTED, { sort: false });
const SORTED = mergeFrames(UNSORTED);
const lastNoSort = NOSORT.frames[NOSORT.frames.length - 1].state;
const sortFrames: Frame<TimelineState>[] = [
  { ...NOSORT.frames[1], hold: 1300 },
  {
    hold: 2600,
    state: {
      ...lastNoSort,
      lanes: lastNoSort.lanes.map((l) => (l.label === 'merged' ? { ...l, bars: l.bars.map((b, j) => (j === l.bars.length - 1 ? { ...b, state: 'bad' as const } : b)) } : l)),
      markers: undefined,
      stats: [
        { label: 'Sorted', value: 'no', tone: 'bad' },
        { label: 'Compared to', value: '[8, 9]', tone: 'bad' },
        { label: 'Should meet', value: '[1, 4]' },
      ],
      note: { text: '[2, 3] only meets the last block, so it never merges into [1, 4]', tone: 'bad' },
    },
  },
  {
    state: {
      ...SORTED.frames[SORTED.frames.length - 1].state,
      stats: [
        { label: 'Sorted', value: 'by start', tone: 'ok' },
        { label: 'Merged', value: String(SORTED.result.length), tone: 'ok' },
        { label: 'Cost', value: 'O(n log n)' },
      ],
      note: { text: 'sorted first: [1, 4], [8, 9]', tone: 'ok' },
    },
  },
];

// Recap: minimum meeting rooms for [[0, 30], [5, 10], [15, 20]] is 2.
const ROOMS: TimelineState = {
  from: 0,
  to: 30,
  ticks: [0, 10, 20, 30],
  lanes: [
    { label: 'room 1', bars: [{ from: 0, to: 30, label: '[0, 30]' }] },
    { label: 'room 2', bars: [{ from: 5, to: 10, label: '[5, 10]', tone: 'violet' }, { from: 15, to: 20, label: '[15, 20]', tone: 'violet' }] },
  ],
  stats: [
    { label: 'Merge', value: 'O(n log n)' },
    { label: 'Insert', value: 'O(n)' },
    { label: 'Rooms here', value: '2', tone: 'ok' },
  ],
  note: { text: 'variant: minimum meeting rooms, sort starts and ends' },
};

export default defineLesson('timeline', {
  slug: 'merge-intervals',
  objectives: [
    { text: 'Name the six ways two intervals relate', step: 2 },
    { text: 'Reduce every case to one comparison after sorting by start', step: 3 },
    { text: 'Merge overlapping intervals in one sweep', step: 4 },
    { text: 'Insert an interval in three phases without sorting', step: 6 },
    { text: 'Explain why the sort is not optional', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Overlapping intervals',
      tag: 'problem',
      body: [
        'Merge `[[1, 3], [2, 6], [8, 10], [15, 18]]` so that no two intervals overlap.',
        'Keywords like overlap, merge, schedule, meeting rooms or conflicts all point at this pattern.',
      ],
      keyIdea: 'Input is a list of [start, end] pairs and the question is about collisions: think merge intervals.',
      frames: problemFrames,
    },
    {
      label: 'Six cases',
      title: 'Six ways two intervals relate',
      tag: 'concept',
      body: [
        'Take `a = [a1, a2]` and `b = [b1, b2]` with `a1 <= b1`. They can be disjoint, touching, partially overlapping, nested, share a start, or be identical.',
        'Touching, like `[1, 3]` and `[3, 5]`, depends on the problem. Ask.',
      ],
      keyIdea: 'Six cases look like six branches, but sorting collapses them.',
      frames: relationFrames,
    },
    {
      label: 'One test',
      title: 'Sort, then ask one question',
      tag: 'concept',
      body: [
        'Once sorted by start, everything reduces to: **does `b1 <= a2`?**',
        'Yes: they overlap and the merged interval is `[a1, max(a2, b2)]`. No: `a` is finished.',
      ],
      keyIdea: 'If touching should not merge, change <= to <.',
      frames: [...compare([1, 3], [2, 6]), ...compare([1, 6], [8, 10])],
    },
    {
      label: 'Merge run',
      title: 'One sweep after the sort',
      tag: 'technique',
      body: [
        'Walk the sorted list. Compare each interval with the **last** merged one: extend its end or push a new block.',
        'The answer is `[[1, 6], [8, 10], [15, 18]]`.',
      ],
      keyIdea: 'O(n log n) for the sort, O(n) for the scan, O(n) output space.',
      frames: MAIN.frames,
    },
    {
      label: 'Keep max',
      title: 'Nested intervals need max',
      tag: 'technique',
      body: [
        'Merge `[[1, 10], [2, 3]]`. Setting `last.end = cur.end` would shrink `[1, 10]` to `[1, 3]`.',
        '`Math.max(last.end, cur.end)` handles the "b inside a" case.',
      ],
      keyIdea: 'Forgetting max is the most common merge bug.',
      frames: maxFrames,
    },
    {
      label: 'Insert',
      title: 'Insert into a sorted list',
      tag: 'technique',
      body: [
        'Insert `[2, 5]` into `[[1, 3], [6, 9]]`. The list is already sorted and non-overlapping, so skip the sort.',
        'Copy intervals that end before it, grow `[s, e]` over the ones that overlap, then copy the rest.',
      ],
      keyIdea: 'Three phases: before, overlapping, after. O(n) time.',
      frames: insertFrames(),
    },
    {
      label: 'Why sort',
      title: 'The sort is not optional',
      tag: 'trade-off',
      body: [
        'Without sorting, `[[1, 4], [8, 9], [2, 3]]` never merges `[2, 3]` into `[1, 4]`: it is only compared with the last block.',
        'The O(n log n) sort is what makes the single comparison valid. Also note it mutates the caller\'s array: copy first if they reuse it.',
      ],
      keyIdea: 'Merge compares with the last block only, which is correct only after sorting by start.',
      frames: sortFrames,
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** [start, end] pairs plus overlap, merge, insert, schedule or rooms.',
        '- **Merge:** sort by start, then `cur.start <= last.end` extends with `max`, otherwise push.',
        '- **Insert:** before, overlap, after. No sort, O(n).',
        '- **Variants:** meeting rooms sort starts and ends separately. Minimum removals sort by end.',
        '- **Pitfalls:** `arr.sort()` without a comparator, forgetting `max`.',
      ],
      keyIdea: 'Sort first, then each interval only needs to look at the last merged block.',
      frames: [{ state: ROOMS }],
    },
  ],
});
