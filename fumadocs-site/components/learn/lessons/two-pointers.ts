import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Every frame comes from running the real algorithm on the notes' examples.
 */

const NUMS = [1, 2, 3, 4, 6];
const TARGET = 6;
const HEIGHT = [1, 8, 6, 2, 5, 4, 8, 3, 7];

function range(from: number, to: number, st: ItemState): Record<number, ItemState> {
  const out: Record<number, ItemState> = {};
  for (let i = from; i <= to; i++) out[i] = st;
  return out;
}

/** Brute force: try every pair until one matches. */
function bruteFrames(): Frame<ArrayState>[] {
  const frames: Frame<ArrayState>[] = [];
  let checks = 0;
  for (let i = 0; i < NUMS.length; i++) {
    for (let j = i + 1; j < NUMS.length; j++) {
      checks++;
      const sum = NUMS[i] + NUMS[j];
      const hit = sum === TARGET;
      frames.push({
        hold: hit ? 1800 : 800,
        state: {
          rows: [
            {
              cells: NUMS,
              states: { [i]: hit ? 'found' : 'active', [j]: hit ? 'found' : 'active' },
              pointers: [
                { i, label: 'i', tone: 'info' },
                { i: j, label: 'j' },
              ],
            },
          ],
          stats: [
            { label: 'target', value: String(TARGET) },
            { label: 'sum', value: String(sum), tone: hit ? 'ok' : 'neutral' },
            { label: 'Pairs checked', value: String(checks), tone: checks > 3 ? 'bad' : 'neutral', hint: 'up to n²/2' },
          ],
          note: hit ? { text: `found [${i}, ${j}] after ${checks} checks, but the worst case is O(n²)`, tone: 'bad' } : undefined,
        },
      });
      if (hit) return frames;
    }
  }
  return frames;
}

/** Two Sum on a sorted array, opposite ends. */
function twoSumFrames(): Frame<ArrayState>[] {
  const frames: Frame<ArrayState>[] = [];
  let lo = 0;
  let hi = NUMS.length - 1;
  let checks = 0;
  const gone: Record<number, ItemState> = {};
  while (lo < hi) {
    const sum = NUMS[lo] + NUMS[hi];
    checks++;
    const hit = sum === TARGET;
    const why = hit
      ? { text: `${NUMS[lo]} + ${NUMS[hi]} = ${TARGET}: return [${lo}, ${hi}]`, tone: 'ok' as const }
      : sum < TARGET
        ? { text: `${sum} < ${TARGET}: ${NUMS[lo]} is too small with anything, lo++`, tone: 'accent' as const }
        : { text: `${sum} > ${TARGET}: ${NUMS[hi]} is too big with anything, hi--`, tone: 'accent' as const };
    frames.push({
      hold: 1700,
      state: {
        rows: [
          {
            cells: NUMS,
            states: { ...gone, ...range(lo, hi, 'normal'), [lo]: hit ? 'found' : 'active', [hi]: hit ? 'found' : 'active' },
            window: { from: lo, to: hi, label: `sum ${sum}`, tone: hit ? 'ok' : undefined },
            pointers: [
              { i: lo, label: 'lo', tone: 'info' },
              { i: hi, label: 'hi' },
            ],
          },
        ],
        stats: [
          { label: 'target', value: String(TARGET) },
          { label: 'sum', value: String(sum), tone: hit ? 'ok' : sum < TARGET ? 'neutral' : 'bad' },
          { label: 'Checks', value: String(checks), hint: 'at most n - 1' },
        ],
        note: why,
      },
    });
    if (hit) break;
    if (sum < TARGET) gone[lo++] = 'dim';
    else gone[hi--] = 'dim';
  }
  return frames;
}

/** Container with most water: always move the shorter line. */
function containerFrames(): Frame<ArrayState>[] {
  const frames: Frame<ArrayState>[] = [];
  let lo = 0;
  let hi = HEIGHT.length - 1;
  let best = 0;
  let bestAt: [number, number] = [0, 0];
  const gone: Record<number, ItemState> = {};
  while (lo < hi) {
    const area = Math.min(HEIGHT[lo], HEIGHT[hi]) * (hi - lo);
    if (area > best) {
      best = area;
      bestAt = [lo, hi];
    }
    const shorter = HEIGHT[lo] < HEIGHT[hi] ? lo : hi;
    frames.push({
      hold: 1100,
      state: {
        rows: [
          {
            cells: HEIGHT,
            bars: true,
            states: { ...gone, [lo]: 'active', [hi]: 'active', [shorter]: 'bad' },
            window: { from: lo, to: hi, label: `area ${area}`, tone: area === best ? 'ok' : undefined },
            pointers: [
              { i: lo, label: 'lo', tone: 'info' },
              { i: hi, label: 'hi' },
            ],
          },
        ],
        stats: [
          { label: 'area', value: `${Math.min(HEIGHT[lo], HEIGHT[hi])} x ${hi - lo}` },
          { label: 'best', value: String(best), tone: 'ok' },
          { label: 'Discard', value: `line ${shorter}`, hint: 'the shorter one' },
        ],
      },
    });
    gone[shorter] = 'dim';
    if (HEIGHT[lo] < HEIGHT[hi]) lo++;
    else hi--;
  }
  frames.push({
    state: {
      rows: [
        {
          cells: HEIGHT,
          bars: true,
          states: { ...range(0, HEIGHT.length - 1, 'dim'), [bestAt[0]]: 'found', [bestAt[1]]: 'found' },
          window: { from: bestAt[0], to: bestAt[1], label: `best ${best}`, tone: 'ok' },
        },
      ],
      stats: [
        { label: 'Answer', value: String(best), tone: 'ok' },
        { label: 'Lines', value: `${bestAt[0]} and ${bestAt[1]}` },
        { label: 'Time', value: 'O(n)', tone: 'ok' },
      ],
      note: { text: `min(8, 7) x 7 = ${best}`, tone: 'ok' },
    },
  });
  return frames;
}

/** Remove duplicates from a sorted array with read / write pointers. */
function dedupeFrames(): Frame<ArrayState>[] {
  const nums = [1, 1, 2, 3, 3, 4];
  const frames: Frame<ArrayState>[] = [];
  let write = 1;
  const snap = (read: number, kept: boolean | null) =>
    frames.push({
      hold: 1100,
      state: {
        rows: [
          {
            cells: [...nums],
            states: { ...range(0, write - 1, 'done'), ...(read < nums.length ? { [read]: kept === false ? 'dim' : 'active' } : {}) },
            window: { from: 0, to: write - 1, label: `unique ${write}`, tone: 'ok' },
            pointers: [
              ...(read < nums.length ? [{ i: read, label: 'read', tone: 'info' as const }] : []),
              { i: Math.min(write, nums.length - 1), label: 'write' },
            ],
          },
        ],
        stats: [
          { label: 'read', value: read < nums.length ? String(read) : 'done' },
          { label: 'write', value: String(write) },
          { label: 'Extra space', value: 'O(1)', tone: 'ok' },
        ],
        note:
          kept === null
            ? { text: `write = ${write} is the new length`, tone: 'ok' }
            : kept
              ? { text: `${nums[read]} is new: copy to slot ${write - 1}`, tone: 'accent' }
              : { text: `${nums[read]} repeats nums[write - 1]: skip` },
      },
    });
  for (let read = 1; read < nums.length; read++) {
    const keep = nums[read] !== nums[write - 1];
    if (keep) nums[write++] = nums[read];
    snap(read, keep);
  }
  snap(nums.length, null);
  return frames;
}

/** Dutch national flag: three regions, one pass. Cells keep ids so swaps glide. */
function flagFrames(): Frame<ArrayState>[] {
  const cells = [2, 0, 2, 1, 1, 0].map((v, k) => ({ v, id: `c${k}` }));
  const frames: Frame<ArrayState>[] = [];
  let low = 0;
  let mid = 0;
  let high = cells.length - 1;
  const snap = (note: ArrayState['note'], swapA?: number, swapB?: number) => {
    const states: Record<number, ItemState> = { ...range(0, low - 1, 'done'), ...range(high + 1, cells.length - 1, 'done') };
    if (mid <= high) states[mid] = 'active';
    if (swapA !== undefined) states[swapA] = 'swap';
    if (swapB !== undefined) states[swapB] = 'swap';
    frames.push({
      hold: 1100,
      state: {
        rows: [
          {
            cells: [...cells],
            states,
            pointers: [
              { i: Math.min(low, cells.length - 1), label: 'low', tone: 'ok', up: true },
              { i: Math.min(mid, cells.length - 1), label: 'mid' },
              { i: Math.max(high, 0), label: 'high', tone: 'info', up: true },
            ],
          },
        ],
        stats: [
          { label: 'low', value: String(low) },
          { label: 'mid', value: String(mid) },
          { label: 'high', value: String(high) },
        ],
        note,
      },
    });
  };
  snap({ text: '[0, low) zeros, [low, mid) ones, (high, n) twos' });
  while (mid <= high) {
    const v = cells[mid].v;
    if (v === 0) {
      [cells[low], cells[mid]] = [cells[mid], cells[low]];
      const a = low;
      low++;
      mid++;
      snap({ text: '0: swap with low, low++ and mid++', tone: 'accent' }, a, mid - 1);
    } else if (v === 1) {
      mid++;
      snap({ text: '1: already in the middle, mid++' });
    } else {
      [cells[mid], cells[high]] = [cells[high], cells[mid]];
      high--;
      snap({ text: '2: swap with high, high--, mid stays', tone: 'accent' }, mid, high + 1);
    }
  }
  frames[frames.length - 1].state.note = { text: 'sorted in one pass, O(1) space', tone: 'ok' };
  return frames;
}

/** Three Sum: sort (cells glide), then fix an anchor and run Two Sum II. */
function threeSumFrames(): Frame<ArrayState>[] {
  const input = [-1, 0, 1, 2, -1, -4];
  const tagged = input.map((v, k) => ({ v, id: `t${k}` }));
  const sorted = [...tagged].sort((a, b) => a.v - b.v);
  const frames: Frame<ArrayState>[] = [
    {
      hold: 1500,
      state: {
        rows: [{ cells: tagged }],
        stats: [
          { label: 'Sorted', value: 'no', tone: 'bad' },
          { label: 'Sort cost', value: 'O(n log n)' },
          { label: 'Triplets', value: '0' },
        ],
        note: { text: 'two pointers need sorted input' },
      },
    },
    {
      hold: 1600,
      state: {
        rows: [{ cells: sorted }],
        stats: [
          { label: 'Sorted', value: 'yes', tone: 'ok' },
          { label: 'Sort cost', value: 'O(n log n)' },
          { label: 'Triplets', value: '0' },
        ],
        note: { text: 'values moved: the original indices are gone', tone: 'bad' },
      },
    },
  ];
  const nums = sorted.map((c) => c.v);
  const found: string[] = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (nums[i] > 0) break;
    if (i > 0 && nums[i] === nums[i - 1]) {
      frames.push({
        hold: 1500,
        state: {
          rows: [{ cells: sorted, states: { [i]: 'dim', [i - 1]: 'visited' }, pointers: [{ i, label: 'i', tone: 'violet', up: true }] }],
          panels: [{ title: 'triplets', items: [...found] }],
          stats: [
            { label: 'anchor', value: String(nums[i]) },
            { label: 'Triplets', value: String(found.length), tone: 'ok' },
            { label: 'Time', value: 'O(n²)' },
          ],
          note: { text: 'same anchor as before: skip it, no repeats', tone: 'accent' },
        },
      });
      continue;
    }
    let lo = i + 1;
    let hi = nums.length - 1;
    while (lo < hi) {
      const sum = nums[i] + nums[lo] + nums[hi];
      if (sum === 0) {
        found.push(`[${nums[i]}, ${nums[lo]}, ${nums[hi]}]`);
        frames.push({
          hold: 1500,
          state: {
            rows: [
              {
                cells: sorted,
                states: { [i]: 'path', [lo]: 'found', [hi]: 'found' },
                pointers: [
                  { i, label: 'i', tone: 'violet', up: true },
                  { i: lo, label: 'lo', tone: 'info' },
                  { i: hi, label: 'hi' },
                ],
              },
            ],
            panels: [{ title: 'triplets', items: [...found], highlight: found.length - 1 }],
            stats: [
              { label: 'anchor', value: String(nums[i]) },
              { label: 'Triplets', value: String(found.length), tone: 'ok' },
              { label: 'Time', value: 'O(n²)' },
            ],
            note: { text: `${nums[i]} + ${nums[lo]} + ${nums[hi]} = 0`, tone: 'ok' },
          },
        });
        lo++;
        hi--;
        while (lo < hi && nums[lo] === nums[lo - 1]) lo++;
        while (lo < hi && nums[hi] === nums[hi + 1]) hi--;
      } else if (sum < 0) lo++;
      else hi--;
    }
  }
  return frames;
}

const TWO_SUM = twoSumFrames();

const RECAP: ArrayState = {
  rows: [
    { label: 'opposite', cells: NUMS, states: { 1: 'found', 3: 'found' }, pointers: [{ i: 1, label: 'lo', tone: 'info' }, { i: 3, label: 'hi' }], showIndex: false },
    { label: 'read/write', cells: [1, 2, 3, 4, 3, 4], states: range(0, 3, 'done'), window: { from: 0, to: 3, label: 'kept', tone: 'ok' }, showIndex: false },
    { label: 'partition', cells: [0, 0, 1, 1, 2, 2], states: { 0: 'done', 1: 'done', 4: 'done', 5: 'done' }, showIndex: false },
  ],
  stats: [
    { label: 'Time', value: 'O(n)', tone: 'ok' },
    { label: 'Space', value: 'O(1)', tone: 'ok' },
    { label: 'Pairs', value: 'lo < hi' },
  ],
};

export default defineLesson('array', {
  slug: 'two-pointers',
  objectives: [
    { text: 'Replace an O(n²) pair search with one inward pass', step: 3 },
    { text: 'Justify every pointer move by the pairs it rules out', step: 4 },
    { text: 'Compact an array in place with read and write pointers', step: 5 },
    { text: 'Partition into three regions with the Dutch national flag', step: 6 },
    { text: 'Know when sorting first is worth it', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Checking every pair',
      tag: 'problem',
      body: [
        'Find two numbers in the **sorted** array `[1, 2, 3, 4, 6]` that add up to **6**.',
        'Trying every pair works, but it ignores the fact that the array is sorted and costs O(n²) in the worst case.',
      ],
      keyIdea: 'Sorted input plus "find a pair" is the classic signal for two pointers.',
      frames: bruteFrames(),
    },
    {
      label: 'Both ends',
      title: 'Start at both ends',
      tag: 'concept',
      body: [
        'Put `lo` at the start and `hi` at the end. Their sum is 7, too big.',
        'Since the array is sorted, `nums[hi]` paired with **any** element at or after `lo` is even bigger. It can never be in the answer, so `hi` moves in.',
      ],
      keyIdea: 'Every pointer move must be justified: the pairs you skip cannot contain the answer.',
      frames: TWO_SUM.slice(0, 2),
    },
    {
      label: 'Two Sum',
      title: 'Two Sum II, start to finish',
      tag: 'technique',
      body: [
        'Sum too small: `lo++`. Sum too big: `hi--`. Equal: return the pair.',
        'Each step discards one element for good, so the loop runs at most n - 1 times. Use `lo < hi`, because a pair needs two different elements.',
      ],
      keyIdea: 'Opposite ends turn an O(n²) pair search into O(n) time and O(1) space.',
      frames: TWO_SUM,
    },
    {
      label: 'Container',
      title: 'Container with most water',
      tag: 'technique',
      body: [
        'Area is `min(height[lo], height[hi]) * (hi - lo)`. Record it, then move the **shorter** line.',
        'The area is capped by the shorter side. Moving the taller side only shrinks the width while the cap stays the same or drops, so the shorter line is finished.',
      ],
      keyIdea: 'If you cannot say why discarding a pointer is safe, the greedy move is wrong.',
      frames: containerFrames(),
    },
    {
      label: 'Read/write',
      title: 'Same direction: compact in place',
      tag: 'technique',
      body: [
        'Remove duplicates from a sorted array. `read` scans every value. `write` marks the next slot to fill.',
        'When `nums[read]` differs from the last kept value, copy it to `write` and advance. At the end `write` is the new length.',
      ],
      keyIdea: 'Read/write pointers filter an array in place with O(1) extra space.',
      frames: dedupeFrames(),
    },
    {
      label: 'Partition',
      title: 'Three regions: Dutch national flag',
      tag: 'technique',
      body: [
        'Sort `0`, `1`, `2` in one pass. `[0, low)` holds zeros, `[low, mid)` ones, `(high, n)` twos.',
        'A 0 swaps with `low`, a 1 just advances `mid`, a 2 swaps with `high`. After that swap `mid` **stays**: the value that came from `high` is unchecked.',
      ],
      keyIdea: 'Advancing mid after swapping with high is the classic Dutch flag bug.',
      frames: flagFrames(),
    },
    {
      label: 'Sort first?',
      title: 'Sorting has a price',
      tag: 'trade-off',
      body: [
        'Unsorted Two Sum should use a hash map: O(n) time, O(n) space. Sorting first costs O(n log n) and loses the original indices.',
        '**Three Sum** sorts anyway, fixes an anchor and runs Two Sum II on the rest, for O(n²). Skipping duplicate anchors is the part interviewers watch.',
      ],
      keyIdea: 'Sort when the output is values and the rest of the work dominates. Use a map when you need original indices.',
      frames: threeSumFrames(),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** sorted input and a pair or triplet, compare from both ends, or an in-place filter.',
        '- **Opposite ends:** move the pointer whose element can no longer be in the answer.',
        '- **Read/write:** `write` is the next slot and the final length.',
        '- **Partition:** low, mid, high, and `mid` stays after a swap with `high`.',
        '- **Pitfalls:** `lo <= hi` for pairs, and forgetting to skip duplicates in Three Sum.',
      ],
      keyIdea: 'Pick the shape first, then justify every move.',
      frames: [{ state: RECAP }],
    },
  ],
});
