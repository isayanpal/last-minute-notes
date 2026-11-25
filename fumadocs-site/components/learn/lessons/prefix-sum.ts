import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Frames come from running subarraySum and the prefix build for real.
 * The prefix row has n + 1 cells, so it sits half a cell offset under nums: prefix[i] is the sum before nums[i].
 */

function range(from: number, to: number, st: ItemState): Record<number, ItemState> {
  const out: Record<number, ItemState> = {};
  for (let i = from; i <= to; i++) out[i] = st;
  return out;
}

// Step 1: a window over [1, -1, 0] cannot decide when to shrink.
const NEG = [1, -1, 0];
const windowFrames: Frame<ArrayState>[] = NEG.map((_, r) => {
  const sum = NEG.slice(0, r + 1).reduce((a, b) => a + b, 0);
  const prev = r > 0 ? NEG.slice(0, r).reduce((a, b) => a + b, 0) : null;
  const dropped = prev !== null && sum < prev;
  const move = prev === null ? 'first element' : sum > prev ? 'sum went up' : sum < prev ? 'sum went down' : 'sum stayed';
  return {
    hold: 1500,
    state: {
      rows: [{ cells: NEG, states: { ...range(0, r, 'active'), ...(NEG[r] < 0 ? { [r]: 'bad' as const } : {}) }, window: { from: 0, to: r, label: `sum ${sum}`, tone: dropped ? 'bad' : undefined } }],
      stats: [
        { label: 'k', value: '0' },
        { label: 'Window sum', value: String(sum), tone: dropped ? 'bad' : 'neutral' },
        { label: 'Grow by one', value: move, tone: dropped ? 'bad' : 'neutral' },
      ],
      note: dropped ? { text: 'growing made the sum smaller: no rule for when to shrink', tone: 'bad' } : r === 2 ? { text: 'subarrays summing to 0 hide everywhere', tone: 'bad' } : undefined,
    },
  };
});

// Step 2 and 3: build a prefix array, then answer range sums.
const NUMS = [3, -2, 5, -1, 2];
const PREFIX = NUMS.reduce<number[]>((p, n) => [...p, p[p.length - 1] + n], [0]);

function prefixRows(filled: number, numStates: Record<number, ItemState> = {}, preStates: Record<number, ItemState> = {}, pre?: ArrayState['rows'][number]['pointers']): ArrayState['rows'] {
  return [
    { label: 'nums', cells: NUMS, states: numStates, showIndex: true },
    { label: 'prefix', cells: PREFIX.map((v, i) => (i <= filled ? v : '')), states: { ...range(filled + 1, PREFIX.length - 1, 'dim'), ...preStates }, showIndex: true, pointers: pre },
  ];
}

const buildFrames: Frame<ArrayState>[] = PREFIX.map((v, i) => ({
  hold: 1000,
  state: {
    rows: prefixRows(i, i > 0 ? { [i - 1]: 'active' } : {}, { [i]: 'active' }),
    stats: [
      { label: 'i', value: String(i) },
      { label: `prefix[${i}]`, value: String(v), tone: 'ok' },
      { label: 'Rule', value: i === 0 ? 'empty = 0' : `${PREFIX[i - 1]} + ${NUMS[i - 1]}` },
    ],
    note: i === 0 ? { text: 'prefix[i] is the sum of the first i elements' } : undefined,
  },
}));

function query(a: number, b: number): Frame<ArrayState> {
  const sum = PREFIX[b + 1] - PREFIX[a];
  return {
    hold: 2200,
    state: {
      rows: [
        { ...prefixRows(PREFIX.length - 1)[0], states: range(a, b, 'active'), window: { from: a, to: b, label: `nums[${a}..${b}]` } },
        {
          ...prefixRows(PREFIX.length - 1)[1],
          states: { [b + 1]: 'found', [a]: 'bad' },
          pointers: [
            { i: a, label: `p[${a}]`, tone: 'bad' },
            { i: b + 1, label: `p[${b + 1}]`, tone: 'ok' },
          ],
        },
      ],
      stats: [
        { label: 'Range', value: `${a}..${b}` },
        { label: 'Sum', value: String(sum), tone: 'ok' },
        { label: 'Cost', value: 'O(1)', tone: 'ok', hint: 'after O(n) build' },
      ],
      note: { text: `prefix[${b + 1}] - prefix[${a}] = ${PREFIX[b + 1]} - ${PREFIX[a]} = ${sum}`, tone: 'accent' },
    },
  };
}

/** Run subarraySum and emit one frame per element (plus the start). */
function subarrayFrames(nums: number[], k: number, opts: { seed?: boolean } = {}): Frame<ArrayState>[] {
  const seed = opts.seed ?? true;
  const seen = new Map<number, number>(seed ? [[0, 1]] : []);
  const frames: Frame<ArrayState>[] = [];
  let prefix = 0;
  let count = 0;
  const mapItems = (hl?: number) => {
    const items = [...seen.entries()].map(([p, c]) => `${p} → ${c}`);
    const idx = hl === undefined ? undefined : [...seen.keys()].indexOf(hl);
    return { items, highlight: idx !== undefined && idx >= 0 ? idx : undefined };
  };
  const startMap = mapItems();
  frames.push({
    hold: 1300,
    state: {
      rows: [{ cells: nums }],
      panels: [{ title: 'prefix → count', kind: 'map', items: startMap.items }],
      stats: [
        { label: 'k', value: String(k) },
        { label: 'prefix', value: '0' },
        { label: 'count', value: '0' },
      ],
      note: seed ? { text: 'seed the map with the empty prefix: 0 → 1', tone: 'accent' } : { text: 'map starts empty', tone: 'bad' },
    },
  });
  nums.forEach((n, i) => {
    prefix += n;
    const need = prefix - k;
    const hits = seen.get(need) ?? 0;
    count += hits;
    const hl = mapItems(hits ? need : undefined);
    // Where do the matching subarrays start? Every earlier position whose prefix equals `need`.
    let starts: number[] = [];
    let p = 0;
    if (need === 0 && seed) starts.push(0);
    nums.slice(0, i).forEach((m, j) => {
      p += m;
      if (p === need) starts.push(j + 1);
    });
    if (!hits) starts = [];
    const states: Record<number, ItemState> = { [i]: 'active' };
    for (const s of starts) for (let t = s; t <= i; t++) states[t] = t === i ? 'found' : 'done';
    const first = starts[0];
    frames.push({
      hold: 1700,
      state: {
        rows: [
          {
            cells: nums,
            states,
            window: hits && first !== undefined ? { from: first, to: i, label: hits > 1 ? `${hits} new` : `sum ${k}`, tone: 'ok' } : undefined,
            pointers: [{ i, label: 'i' }],
          },
        ],
        panels: [{ title: 'prefix → count', kind: 'map', items: hl.items, highlight: hl.highlight }],
        stats: [
          { label: 'prefix', value: String(prefix) },
          { label: 'look up', value: `${prefix} - ${k} = ${need}`, tone: hits ? 'ok' : 'neutral' },
          { label: 'count', value: String(count), tone: 'ok' },
        ],
        note: hits ? { text: `${need} seen ${hits}x: +${hits} subarray${hits > 1 ? 's' : ''} ending at ${i}`, tone: 'ok' } : { text: `${need} not seen yet` },
      },
    });
    seen.set(prefix, (seen.get(prefix) ?? 0) + 1);
  });
  const end = mapItems();
  frames.push({
    state: {
      rows: [{ cells: nums, states: range(0, nums.length - 1, 'done') }],
      panels: [{ title: 'prefix → count', kind: 'map', items: end.items }],
      stats: [
        { label: 'k', value: String(k) },
        { label: 'Answer', value: String(count), tone: seed ? 'ok' : 'bad' },
        { label: 'Time', value: 'O(n)', tone: 'ok' },
      ],
      note: seed ? { text: `subarraySum = ${count}`, tone: 'ok' } : { text: `${count}, but the answer is 2: [1, 1] at index 0 was missed`, tone: 'bad' },
    },
  });
  return frames;
}

const ONES = subarrayFrames([1, 1, 1], 2);
const NO_SEED = subarrayFrames([1, 1, 1], 2, { seed: false });

// Step 4: the look-back idea, shown at i = 2 of [1, 1, 1].
const LOOKBACK: Frame<ArrayState>[] = [
  {
    hold: 1800,
    state: {
      rows: [
        { label: 'nums', cells: [1, 1, 1], states: range(0, 2, 'active'), window: { from: 0, to: 2, label: 'prefix 3' } },
        { label: 'prefix', cells: [0, 1, 2, 3], states: { 3: 'active' }, pointers: [{ i: 3, label: 'now' }] },
      ],
      stats: [
        { label: 'k', value: '2' },
        { label: 'prefix now', value: '3' },
        { label: 'need earlier', value: '3 - 2 = 1', tone: 'ok' },
      ],
      note: { text: 'which earlier prefix equals currentPrefix - k?' },
    },
  },
  {
    state: {
      rows: [
        { label: 'nums', cells: [1, 1, 1], states: { 0: 'dim', 1: 'found', 2: 'found' }, window: { from: 1, to: 2, label: 'sum 2', tone: 'ok' } },
        { label: 'prefix', cells: [0, 1, 2, 3], states: { 1: 'bad', 3: 'found' }, pointers: [{ i: 1, label: 'p = 1', tone: 'bad' }, { i: 3, label: 'now', tone: 'ok' }] },
      ],
      stats: [
        { label: 'k', value: '2' },
        { label: 'prefix now', value: '3' },
        { label: 'Found', value: 'nums[1..2]', tone: 'ok' },
      ],
      note: { text: '3 - 1 = 2: the part after that prefix sums to k', tone: 'ok' },
    },
  },
];

const RECAP: ArrayState = {
  rows: [
    { label: 'nums', cells: NUMS, states: range(1, 3, 'active'), window: { from: 1, to: 3, label: 'sum 2' }, showIndex: false },
    { label: 'prefix', cells: PREFIX, states: { 1: 'bad', 4: 'found' }, showIndex: false },
  ],
  panels: [{ title: 'seed', kind: 'map', items: ['0 → 1'], highlight: 0 }],
  stats: [
    { label: 'Time', value: 'O(n)', tone: 'ok' },
    { label: 'Space', value: 'O(n)', hint: 'the map' },
    { label: 'Negatives', value: 'fine', tone: 'ok' },
  ],
};

export default defineLesson('isoArray', {
  slug: 'prefix-sum',
  pseudocode: [
    'seen = {0: 1}',
    'sum = 0, count = 0',
    'for x in a:',
    '    sum = sum + x',
    '    count = count + seen[sum - k]',
    '    seen[sum] = seen[sum] + 1',
    'return count',
  ],
  objectives: [
    { text: 'See why negative numbers break a sliding window', step: 1 },
    { text: 'Build a prefix array and answer range sums in O(1)', step: 3 },
    { text: 'Count subarrays summing to k with a hash map of prefixes', step: 5 },
    { text: 'Remember the empty prefix seed, 0 → 1', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Negatives break the window',
      tag: 'problem',
      code: [3],
      body: [
        'Count subarrays of `[1, -1, 0]` that sum to **0**.',
        'A sliding window needs the sum to move in one direction as it grows. Here adding `-1` makes it **smaller**, so there is no rule for when to shrink.',
      ],
      keyIdea: 'Negative numbers with a sum target rule out the sliding window. Reach for prefix sums.',
      frames: windowFrames,
    },
    {
      label: 'Prefix',
      title: 'Running totals',
      tag: 'concept',
      code: [4],
      body: [
        '`prefix[i]` is the sum of the first `i` elements, so `prefix[0] = 0` and the array has n + 1 entries.',
        'Each entry is the previous one plus one number: an O(n) pass.',
      ],
      keyIdea: 'A prefix array turns "sum of a range" into "difference of two numbers".',
      frames: buildFrames,
    },
    {
      label: 'Range sum',
      title: 'Any range in O(1)',
      tag: 'technique',
      code: [4],
      body: ['The sum of `nums[a..b]` is `prefix[b + 1] - prefix[a]`.', 'Everything before `a` cancels out. Negative numbers do not matter at all.'],
      keyIdea: 'Range sum = prefix[b + 1] - prefix[a]. O(n) to build, O(1) per query.',
      frames: [query(1, 3), query(0, 4), query(2, 2)],
    },
    {
      label: 'Look back',
      title: 'Which earlier prefix do I need?',
      tag: 'concept',
      code: [5],
      body: [
        'Subarray sum equals **k**. A subarray ending here sums to k if some earlier prefix equals `currentPrefix - k`.',
        'In `[1, 1, 1]` with k = 2, the prefix at the end is 3, so we need an earlier prefix of 1.',
      ],
      keyIdea: 'Do not search for subarrays. Search for the earlier prefix that would complete one.',
      frames: LOOKBACK,
    },
    {
      label: 'Hash map',
      title: 'Count prefixes as you go',
      tag: 'technique',
      code: [5, 6],
      body: [
        'Keep a map from each prefix to how many times it has occurred. At each element: add to `prefix`, add `seen[prefix - k]` to the count, then record `prefix`.',
        '`[1, 1, 1]` with k = 2 gives **2**.',
      ],
      keyIdea: 'Look up before you insert, so a subarray never matches itself.',
      frames: ONES,
    },
    {
      label: 'The seed',
      title: 'The line people forget',
      tag: 'trade-off',
      code: [1],
      body: [
        'Without the initial `0 → 1` entry, a subarray that **starts at index 0** has no earlier prefix to match.',
        'Here `[1, 1]` at the very start is missed and the answer comes out as 1 instead of 2.',
      ],
      keyIdea: 'Seed the map with the empty prefix: new Map([[0, 1]]).',
      frames: NO_SEED,
    },
    {
      label: 'Negatives',
      title: 'Negatives and zeros are fine',
      tag: 'in practice',
      code: [4, 5],
      body: [
        'Back to `[1, -1, 0]` with k = 0. The same loop finds **3** subarrays: `[1, -1]`, `[1, -1, 0]` and `[0]`.',
        'The map does not care which way the sum moves.',
      ],
      keyIdea: 'Prefix sums plus a hash map handle any sign, in O(n) time and O(n) space.',
      frames: subarrayFrames(NEG, 0),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **When:** subarray sums with negative numbers, where a sliding window fails.',
        '- **Range sum:** `prefix[b + 1] - prefix[a]`.',
        '- **Sum equals k:** count earlier prefixes equal to `prefix - k` in a map.',
        '- **Seed:** start the map with `0 → 1`.',
        '- **Also:** longest subarray with sum k, equal 0s and 1s (map 0 to -1), 2D prefix sums.',
      ],
      keyIdea: 'Prefix sums turn subarray questions into lookups of earlier totals.',
      frames: [{ state: RECAP }],
    },
  ],
});
