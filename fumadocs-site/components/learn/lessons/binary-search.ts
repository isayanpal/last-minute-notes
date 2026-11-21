import { defineLesson } from '../define';
import type { ArrayRow, ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Frames come from running the real firstTrue template, so every lo, mid and hi on screen is what the code would hold.
 */

const range = (from: number, to: number, st: ItemState): Record<number, ItemState> => {
  const out: Record<number, ItemState> = {};
  for (let i = from; i <= to; i++) out[i] = st;
  return out;
};

type Cells = (number | string)[];

/** One frame per loop iteration of firstTrue over [0, n), plus a final frame on the answer. */
function traceFirstTrue(cells: Cells, isTrue: (i: number) => boolean, opts: { second?: { label: string; cells: Cells }; checkLabel: (i: number) => string; answerNote: string }): Frame<ArrayState>[] {
  const n = cells.length;
  const frames: Frame<ArrayState>[] = [];
  let lo = 0;
  let hi = n;
  let checks = 0;
  const rowsFor = (states: Record<number, ItemState>, pointers: NonNullable<ArrayRow['pointers']>, win?: ArrayRow['window']): ArrayRow[] => {
    const rows: ArrayRow[] = [{ label: opts.second ? 'value' : undefined, cells, states, pointers, window: win, showIndex: true }];
    if (opts.second) rows.push({ label: opts.second.label, cells: opts.second.cells, states, showIndex: false });
    return rows;
  };
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    checks++;
    const states: Record<number, ItemState> = { ...range(0, lo - 1, 'dim'), ...range(hi, n - 1, 'done'), ...range(lo, hi - 1, 'normal'), [mid]: 'active' };
    const hit = isTrue(mid);
    frames.push({
      hold: 1500,
      state: {
        rows: rowsFor(states, [
          { i: lo, label: 'lo', tone: 'info' },
          { i: mid, label: 'mid', tone: 'accent', up: true },
          ...(hi < n ? [{ i: hi, label: 'hi', tone: 'info' as const }] : []),
        ], { from: lo, to: hi - 1, label: `${hi - lo} left`, tone: 'accent' }),
        stats: [
          { label: 'lo / hi', value: `${lo} / ${hi}` },
          { label: 'Check', value: opts.checkLabel(mid), tone: hit ? 'ok' : 'bad' },
          { label: 'Checks so far', value: String(checks) },
        ],
        note: hit ? { text: 'true: mid may be the answer, so hi = mid', tone: 'accent' } : { text: 'false: mid is too small, so lo = mid + 1', tone: 'accent' },
      },
    });
    if (hit) hi = mid;
    else lo = mid + 1;
  }
  frames.push({
    state: {
      rows: rowsFor({ ...range(0, lo - 1, 'dim'), ...(lo < n ? { ...range(lo, n - 1, 'done'), [lo]: 'found' as ItemState } : {}) }, lo < n ? [{ i: lo, label: 'answer', tone: 'ok' }] : []),
      stats: [{ label: 'Answer index', value: String(lo), tone: 'ok' }, { label: 'Checks', value: String(checks), tone: 'ok' }, { label: 'Linear scan', value: `${lo + 1} checks` }],
      note: { text: opts.answerNote, tone: 'ok' },
    },
  });
  return frames;
}

// A sorted array and the first index with value >= 56.
const SORTED: Cells = [2, 5, 8, 12, 16, 23, 38, 45, 56, 72, 91, 99];
const TARGET = 56;
const sortedTrace = () => traceFirstTrue(SORTED, (i) => (SORTED[i] as number) >= TARGET, { checkLabel: (i) => `${SORTED[i]} ≥ ${TARGET}`, answerNote: 'first index where value >= 56' });

// Step 3: lower and upper bound on duplicates.
const DUPS: Cells = [1, 2, 2, 2, 3];
const bounds = (which: 'lower' | 'upper'): ArrayState => {
  const idx = which === 'lower' ? 1 : 4;
  return {
    rows: [
      {
        cells: DUPS,
        states: { 0: 'dim', 1: which === 'lower' ? 'found' : 'path', 2: 'path', 3: 'path', 4: which === 'upper' ? 'found' : 'normal' },
        pointers: [{ i: idx, label: which === 'lower' ? 'lowerBound' : 'upperBound', tone: 'ok' }],
        window: { from: 1, to: 3, label: 'all the 2s', tone: 'accent' },
        showIndex: true,
      },
    ],
    stats: which === 'lower'
      ? [{ label: 'Predicate', value: 'x ≥ 2' }, { label: 'Result', value: '1', tone: 'ok' }, { label: 'Means', value: 'first 2' }]
      : [{ label: 'Predicate', value: 'x > 2' }, { label: 'Result', value: '4', tone: 'ok' }, { label: 'Last 2 at', value: 'upper - 1' }],
    note: which === 'lower' ? { text: 'insert position is also lowerBound', tone: 'accent' } : { text: 'first and last position = lowerBound, upperBound - 1', tone: 'accent' },
  };
};

// Step 4: rotated sorted array search for a target.
function rotatedFrames(): Frame<ArrayState>[] {
  const nums = [4, 5, 6, 7, 0, 1, 2];
  const target = 0;
  const frames: Frame<ArrayState>[] = [];
  let lo = 0;
  let hi = nums.length - 1;
  let steps = 0;
  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1);
    steps++;
    const leftSorted = nums[lo] <= nums[mid];
    const sortedFrom = leftSorted ? lo : mid;
    const sortedTo = leftSorted ? mid : hi;
    const found = nums[mid] === target;
    let decision: string;
    let nlo = lo;
    let nhi = hi;
    if (found) decision = 'found it';
    else if (leftSorted) {
      if (nums[lo] <= target && target < nums[mid]) {
        nhi = mid - 1;
        decision = `target in [${nums[lo]}, ${nums[mid]}): go left`;
      } else {
        nlo = mid + 1;
        decision = `target not in [${nums[lo]}, ${nums[mid]}): go right`;
      }
    } else if (nums[mid] < target && target <= nums[hi]) {
      nlo = mid + 1;
      decision = `target in (${nums[mid]}, ${nums[hi]}]: go right`;
    } else {
      nhi = mid - 1;
      decision = `target not in (${nums[mid]}, ${nums[hi]}]: go left`;
    }
    frames.push({
      hold: 1800,
      state: {
        rows: [
          {
            cells: nums,
            states: { ...range(0, lo - 1, 'dim'), ...range(hi + 1, nums.length - 1, 'dim'), ...range(sortedFrom, sortedTo, 'visited'), [mid]: found ? 'found' : 'active' },
            pointers: [
              { i: lo, label: 'lo', tone: 'info' },
              { i: mid, label: 'mid', tone: 'accent', up: true },
              { i: hi, label: 'hi', tone: 'info' },
            ],
            window: { from: sortedFrom, to: sortedTo, label: leftSorted ? 'left half sorted' : 'right half sorted', tone: 'ok' },
          },
        ],
        stats: [
          { label: 'Target', value: String(target) },
          { label: 'Sorted half', value: leftSorted ? 'left' : 'right' },
          { label: 'Step', value: String(steps) },
        ],
        note: { text: decision, tone: found ? 'ok' : 'accent' },
      },
    });
    if (found) break;
    lo = nlo;
    hi = nhi;
  }
  return frames;
}

// Step 5: minimum in a rotated array, compare mid with hi.
function minFrames(): Frame<ArrayState>[] {
  const nums = [4, 5, 6, 7, 0, 1, 2];
  const frames: Frame<ArrayState>[] = [];
  let lo = 0;
  let hi = nums.length - 1;
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    const right = nums[mid] > nums[hi];
    frames.push({
      hold: 1800,
      state: {
        rows: [
          {
            cells: nums,
            states: { ...range(0, lo - 1, 'dim'), ...range(hi + 1, nums.length - 1, 'dim'), [mid]: 'active', [hi]: 'visited' },
            pointers: [
              { i: lo, label: 'lo', tone: 'info' },
              { i: mid, label: 'mid', tone: 'accent', up: true },
              { i: hi, label: 'hi', tone: 'info' },
            ],
            window: { from: lo, to: hi, label: 'search range', tone: 'accent' },
          },
        ],
        stats: [
          { label: 'Compare', value: `${nums[mid]} vs ${nums[hi]}` },
          { label: 'Drop is', value: right ? 'right of mid' : 'at or left', tone: 'ok' },
          { label: 'Move', value: right ? 'lo = mid + 1' : 'hi = mid' },
        ],
        note: { text: right ? 'mid is bigger than the right end: the minimum is to the right' : 'mid could be the minimum, keep it', tone: 'accent' },
      },
    });
    if (right) lo = mid + 1;
    else hi = mid;
  }
  frames.push({
    state: {
      rows: [{ cells: nums, states: { ...range(0, nums.length - 1, 'dim'), [lo]: 'found' }, pointers: [{ i: lo, label: 'min', tone: 'ok' }], showIndex: true }],
      stats: [{ label: 'Minimum', value: String(nums[lo]), tone: 'ok' }, { label: 'Rotations', value: String(lo), hint: 'index of min' }, { label: 'Why hi', value: 'unambiguous' }],
      note: { text: 'compare with the right end, not the left', tone: 'ok' },
    },
  });
  return frames;
}

// Step 6: binary search on the answer (Koko eating bananas).
const PILES = [3, 6, 7, 11];
const H = 8;
const hoursAt = (k: number) => PILES.reduce((sum, p) => sum + Math.ceil(p / k), 0);
const SPEEDS: Cells = Array.from({ length: 11 }, (_, i) => i + 1);
const HOURS: Cells = SPEEDS.map((k) => hoursAt(k as number));
const answerFrames = () =>
  traceFirstTrue(SPEEDS, (i) => hoursAt(i + 1) <= H, {
    second: { label: 'hours', cells: HOURS },
    checkLabel: (i) => `${HOURS[i]} h ≤ ${H}`,
    answerNote: 'smallest speed that finishes in 8 hours is 4',
  });

export default defineLesson('array', {
  slug: 'binary-search',
  objectives: [
    { text: 'One template: the first index where a predicate turns true', step: 2 },
    { text: 'Lower bound, upper bound, first and last position', step: 3 },
    { text: 'Searching rotated arrays by finding the sorted half', step: 4 },
    { text: 'Binary search on the answer with no array at all', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Halve the search space',
      tag: 'problem',
      body: [
        'In a sorted array, a linear scan to find 56 touches 9 elements. Each check in a binary search throws away **half** of what is left.',
        'The same idea applies to rotated arrays, and to problems with no array: any question of the form "smallest X that works".',
      ],
      keyIdea: 'If the data is sorted or the answer is monotonic, and the problem says O(log n), think binary search.',
      frames: [
        {
          state: {
            rows: [{ cells: SORTED, states: { ...range(0, 7, 'visited'), 8: 'found' }, pointers: [{ i: 8, label: 'target 56', tone: 'ok' }], showIndex: true }],
            stats: [{ label: 'Linear scan', value: '9 checks', tone: 'bad' }, { label: 'Halving', value: '4 checks', tone: 'ok' }, { label: 'n = 1M', value: '20 checks' }],
            note: { text: 'a linear scan visits every element before the target', tone: 'bad' },
          },
        },
      ],
    },
    {
      label: 'Template',
      title: 'First index where it becomes true',
      tag: 'technique',
      body: [
        'Search the half-open range `[lo, hi)`. If `isTrue(mid)`, then `hi = mid`, because mid could be the answer. Otherwise `lo = mid + 1`, because mid is too small.',
        'The predicate shape is `false, false, ..., true, true`. The loop stops with `lo` on the first true.',
      ],
      keyIdea: 'Learn this one loop. Every variant below is only a different predicate.',
      frames: sortedTrace(),
    },
    {
      label: 'Bounds',
      title: 'Lower bound and upper bound',
      tag: 'technique',
      body: [
        '`lowerBound` uses the predicate `x >= target`. `upperBound` uses `x > target`.',
        'First and last position of a target are `lowerBound` and `upperBound - 1`. An insert position is `lowerBound`.',
      ],
      keyIdea: 'Write `lo + ((hi - lo) >> 1)` instead of `(lo + hi) / 2`. It avoids integer overflow in Java, C++ and Go.',
      frames: [{ state: bounds('lower'), hold: 2600 }, { state: bounds('upper') }],
    },
    {
      label: 'Rotated',
      title: 'One half is always sorted',
      tag: 'technique',
      body: [
        'In `[4, 5, 6, 7, 0, 1, 2]` one half around `mid` is always sorted. Find it, then check whether the target lies inside that half.',
        'If it does, search there. If not, search the other half.',
      ],
      keyIdea: 'With duplicates, `nums[lo] === nums[mid] === nums[hi]` hides the sorted half. Shrink both ends, and say the worst case is O(n).',
      frames: rotatedFrames(),
    },
    {
      label: 'Rotated min',
      title: 'Compare mid with the right end',
      tag: 'technique',
      body: [
        'To find the minimum, compare `nums[mid]` with `nums[hi]`. If mid is bigger, the drop is to its right. Otherwise mid could be the minimum, so keep it.',
        'Comparing with `lo` is ambiguous for an array that is not rotated. Comparing with `hi` never is.',
      ],
      keyIdea: 'The index of the minimum is also the number of rotations.',
      frames: minFrames(),
    },
    {
      label: 'On the answer',
      title: 'Search an answer space',
      tag: 'in practice',
      body: [
        'Koko eats bananas from piles `[3, 6, 7, 11]` and must finish in 8 hours. More speed never takes more hours, so feasibility is monotonic in speed.',
        'Binary search the speed with `hoursAt(k) <= 8`. No array is built, the predicate does the work.',
      ],
      keyIdea: 'Same shape: ship packages in D days, split array largest sum, bouquets, aggressive cows. The check must be monotonic.',
      frames: answerFrames(),
    },
    {
      label: 'Recap',
      title: 'Pitfalls and the pattern',
      tag: 'recap',
      body: [
        '- **Template:** `[lo, hi)`, `hi = mid` on true, `lo = mid + 1` on false, answer is `lo`.',
        '- **Variants:** lower bound, upper bound, first and last position, insert position.',
        '- **Rotated:** one half is sorted. Min: compare `mid` with `hi`.',
        '- **Answer space:** write `isFeasible(x)`, prove it is monotonic, search `x`.',
        '- **Bugs:** `lo = mid` loops forever, mixing closed and half-open ranges, non-monotonic checks, an upper bound that excludes the answer.',
      ],
      keyIdea: 'Pick one template and never mix it with another.',
      frames: [{ state: sortedTrace().at(-1)!.state }],
    },
  ],
});
