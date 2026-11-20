import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Frames come from running the notes' loops. Cells carry ids so every swap glides.
 */

type C = { v: number; id: string };
const tag = (vals: number[]): C[] => vals.map((v, k) => ({ v, id: `c${k}` }));

/** Values 1..n: x belongs at index x - 1. Emits one frame per loop iteration. */
function sortFrames(input: number[], limit?: number): Frame<ArrayState>[] {
  const cells = tag(input);
  const frames: Frame<ArrayState>[] = [];
  const home = (c: C) => c.v - 1;
  let i = 0;
  let swaps = 0;
  const placed = () => {
    const st: Record<number, ItemState> = {};
    cells.forEach((c, k) => {
      if (home(c) === k) st[k] = 'done';
    });
    return st;
  };
  frames.push({
    hold: 1400,
    state: {
      rows: [{ cells: [...cells], states: { ...placed(), 0: 'active' }, pointers: [{ i: 0, label: 'i' }, { i: home(cells[0]), label: 'home', tone: 'info', up: true }] }],
      stats: [
        { label: 'i', value: '0' },
        { label: 'Swaps', value: '0' },
        { label: 'Rule', value: 'x lives at x-1' },
      ],
      note: { text: `${cells[0].v} belongs at index ${home(cells[0])}` },
    },
  });
  while (i < cells.length) {
    const h = home(cells[i]);
    if (cells[i].v !== cells[h].v) {
      const moved = cells[i].v;
      [cells[i], cells[h]] = [cells[h], cells[i]];
      swaps++;
      frames.push({
        hold: 1300,
        state: {
          rows: [{ cells: [...cells], states: { ...placed(), [i]: 'swap', [h]: 'found' }, pointers: [{ i, label: 'i' }, { i: home(cells[i]), label: 'home', tone: 'info', up: true }] }],
          stats: [
            { label: 'i', value: String(i) },
            { label: 'Swaps', value: String(swaps), tone: 'ok', hint: 'at most n' },
            { label: 'Placed', value: String(moved), tone: 'ok' },
          ],
          note: { text: `swap ${moved} to index ${h}, stay on i = ${i}`, tone: 'accent' },
        },
      });
    } else {
      i++;
      if (i < cells.length) {
        frames.push({
          hold: 1000,
          state: {
            rows: [{ cells: [...cells], states: { ...placed(), [i]: 'active' }, pointers: [{ i, label: 'i' }, { i: home(cells[i]), label: 'home', tone: 'info', up: true }] }],
            stats: [
              { label: 'i', value: String(i) },
              { label: 'Swaps', value: String(swaps) },
              { label: 'Rule', value: 'x lives at x-1' },
            ],
            note: { text: `index ${i - 1} is home: i++` },
          },
        });
      }
    }
    if (limit !== undefined && frames.length >= limit) return frames;
  }
  frames.push({
    state: {
      rows: [{ cells: [...cells], states: placed() }],
      stats: [
        { label: 'Swaps', value: String(swaps), tone: 'ok' },
        { label: 'Time', value: 'O(n)', tone: 'ok' },
        { label: 'Space', value: 'O(1)', tone: 'ok' },
      ],
      note: { text: 'every value is home', tone: 'ok' },
    },
  });
  return frames;
}

/** Missing number: values 0..n, n has no index and is skipped. Follows the notes' dry run row by row. */
function missingFrames(): { sort: Frame<ArrayState>[]; scan: Frame<ArrayState>[] } {
  const cells = tag([4, 0, 3, 1]);
  const n = cells.length;
  const sort: Frame<ArrayState>[] = [];
  let i = 0;
  let row = 0;
  while (i < n) {
    const h = cells[i].v;
    row++;
    const before = cells.map((c) => c.v).join(', ');
    let action: string;
    const states: Record<number, ItemState> = {};
    if (h < n && cells[i].v !== cells[h].v) {
      [cells[i], cells[h]] = [cells[h], cells[i]];
      states[i] = 'swap';
      states[h] = 'found';
      action = `${h} belongs at ${h}: swap`;
    } else if (h >= n) {
      states[i] = 'bad';
      action = `${h} is out of range: skip, i = ${i + 1}`;
      i++;
    } else {
      states[i] = 'done';
      action = `${h} is home: i = ${i + 1}`;
      i++;
    }
    sort.push({
      hold: 1500,
      state: {
        rows: [{ cells: [...cells], states, pointers: [{ i: Math.min(i, n - 1), label: 'i' }] }],
        stats: [
          { label: 'Row', value: `${row} of 7` },
          { label: 'Before', value: `[${before}]` },
          { label: 'n', value: String(n), hint: 'value n has no index' },
        ],
        note: { text: action, tone: states[i] === 'bad' || action.includes('out of range') ? 'bad' : 'accent' },
      },
    });
  }
  const scan: Frame<ArrayState>[] = [];
  for (let k = 0; k < n; k++) {
    const ok = cells[k].v === k;
    const states: Record<number, ItemState> = {};
    for (let t = 0; t < k; t++) states[t] = 'done';
    states[k] = ok ? 'active' : 'bad';
    scan.push({
      hold: ok ? 900 : 2400,
      state: {
        rows: [{ cells: [...cells], states, pointers: [{ i: k, label: 'k' }] }],
        stats: [
          { label: 'k', value: String(k) },
          { label: 'nums[k]', value: String(cells[k].v), tone: ok ? 'neutral' : 'bad' },
          { label: 'Missing', value: ok ? '?' : String(k), tone: ok ? 'neutral' : 'ok' },
        ],
        note: ok ? { text: `nums[${k}] = ${k}: fine` } : { text: `index ${k} holds ${cells[k].v}: ${k} is missing`, tone: 'ok' },
      },
    });
    if (!ok) break;
  }
  return { sort, scan };
}

const MISSING = missingFrames();

// Step 6: duplicates. Comparing positions loops forever, comparing values does not.
const DUP_FRAMES: Frame<ArrayState>[] = [
  {
    hold: 1500,
    state: {
      rows: [{ label: 'i != home', cells: tag([2, 2]), states: { 0: 'swap', 1: 'swap' }, pointers: [{ i: 0, label: 'i' }, { i: 1, label: 'home', tone: 'info', up: true }] }],
      stats: [
        { label: 'Check', value: 'positions', tone: 'bad' },
        { label: 'Swaps', value: '1' },
        { label: 'Progress', value: 'none', tone: 'bad' },
      ],
      note: { text: 'i = 0, home = 1: positions differ, swap', tone: 'bad' },
    },
  },
  {
    hold: 1500,
    state: {
      rows: [{ label: 'i != home', cells: [{ v: 2, id: 'c1' }, { v: 2, id: 'c0' }], states: { 0: 'swap', 1: 'swap' }, pointers: [{ i: 0, label: 'i' }, { i: 1, label: 'home', tone: 'info', up: true }] }],
      stats: [
        { label: 'Check', value: 'positions', tone: 'bad' },
        { label: 'Swaps', value: '2' },
        { label: 'Progress', value: 'none', tone: 'bad' },
      ],
      note: { text: 'still [2, 2], still different positions: swaps forever', tone: 'bad' },
    },
  },
  {
    hold: 1800,
    state: {
      rows: [{ label: 'values', cells: tag([2, 2]), states: { 0: 'active', 1: 'done' }, pointers: [{ i: 0, label: 'i' }, { i: 1, label: 'home', tone: 'info', up: true }] }],
      stats: [
        { label: 'Check', value: 'values', tone: 'ok' },
        { label: 'nums[i]', value: '= nums[home]' },
        { label: 'Progress', value: 'i++', tone: 'ok' },
      ],
      note: { text: 'nums[0] === nums[1]: a duplicate of what is home, move on', tone: 'ok' },
    },
  },
];

// Disappeared numbers: run the core loop for real, then mark the slots that hold the wrong value.
function disappeared(): Frame<ArrayState> {
  const nums = [4, 3, 2, 7, 8, 2, 3, 1];
  let i = 0;
  while (i < nums.length) {
    const h = nums[i] - 1;
    if (nums[i] !== nums[h]) [nums[i], nums[h]] = [nums[h], nums[i]];
    else i++;
  }
  const states: Record<number, ItemState> = {};
  const missing: number[] = [];
  nums.forEach((v, k) => {
    if (v !== k + 1) {
      states[k] = 'bad';
      missing.push(k + 1);
    } else states[k] = 'done';
  });
  return {
    state: {
      rows: [{ label: 'sorted', cells: nums, states }],
      stats: [
        { label: 'Values', value: '1..8' },
        { label: 'Missing', value: missing.join(', '), tone: 'ok' },
        { label: 'Space', value: 'O(1)', tone: 'ok' },
      ],
      note: { text: `wrong value at index ${missing.map((m) => m - 1).join(' and ')}: ${missing.join(' and ')} never appear`, tone: 'accent' },
    },
  };
}

const FULL = sortFrames([3, 1, 5, 4, 2]);

export default defineLesson('array', {
  slug: 'cyclic-sort',
  objectives: [
    { text: 'Spot the known-range signal: values in 1..n or 0..n', step: 1 },
    { text: 'Swap each value to its home index in O(n) and O(1) space', step: 3 },
    { text: 'Find a missing number with a final scan', step: 5 },
    { text: 'Compare values, not positions, to survive duplicates', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Find the missing number',
      tag: 'problem',
      body: [
        '`[4, 0, 3, 1]` holds n = 4 distinct numbers from `0..4`. Which one is missing?',
        'A hash set costs O(n) space and sorting costs O(n log n). The values are in a **known range**, and that is the clue.',
      ],
      keyIdea: 'Numbers in a range tied to the array length can index the array themselves.',
      frames: [
        {
          hold: 1800,
          state: {
            rows: [{ cells: tag([4, 0, 3, 1]) }],
            stats: [
              { label: 'n', value: '4' },
              { label: 'Range', value: '0..4' },
              { label: 'Goal', value: 'O(n), O(1)', tone: 'ok' },
            ],
            note: { text: 'n + 1 possible values, n slots: exactly one is missing' },
          },
        },
        {
          state: {
            rows: [{ cells: tag([4, 0, 3, 1]), states: { 0: 'bad', 1: 'active', 2: 'active', 3: 'active' } }],
            stats: [
              { label: 'Hash set', value: 'O(n) space', tone: 'bad' },
              { label: 'Sort', value: 'O(n log n)', tone: 'bad' },
              { label: 'Cyclic sort', value: 'O(n), O(1)', tone: 'ok' },
            ],
            note: { text: 'each value already names the index it belongs at', tone: 'accent' },
          },
        },
      ],
    },
    {
      label: 'Homes',
      title: 'Every value has a home',
      tag: 'concept',
      body: [
        'With values `1..n`, the number `x` belongs at index `x - 1`.',
        'If the current value is not at home, swap it there and **stay** on `i`: the value that just arrived has not been placed yet.',
      ],
      keyIdea: 'Swap until the value at i is home, then move on.',
      frames: sortFrames([3, 1, 5, 4, 2], 4),
    },
    {
      label: 'Full sort',
      title: 'Cyclic sort, start to finish',
      tag: 'technique',
      body: ['Sort `[3, 1, 5, 4, 2]`. Each swap puts at least one value in its final place, so there are at most n swaps.', 'The `while` loop looks nested with the swaps, but the total work is O(n).'],
      keyIdea: 'At most n swaps plus n increments: O(n) time, O(1) space.',
      frames: FULL,
    },
    {
      label: 'Missing',
      title: 'Missing number: the dry run',
      tag: 'technique',
      body: [
        'For `0..n` the home of `x` is index `x` itself. The value `n` has no index, so it is skipped.',
        'Follow the seven rows of the dry run on `[4, 0, 3, 1]`.',
      ],
      keyIdea: 'Guard the range: only swap values that have a home inside the array.',
      frames: MISSING.sort,
    },
    {
      label: 'Final scan',
      title: 'The first wrong slot is the answer',
      tag: 'technique',
      body: ['After the swaps, scan for the first index where `nums[k] !== k`. If every slot matches, the answer is `n`.', 'Index 2 holds 4, so **2** is missing.'],
      keyIdea: 'Sort into homes, then the gaps tell you what is missing.',
      frames: MISSING.scan,
    },
    {
      label: 'Duplicates',
      title: 'Compare values, not positions',
      tag: 'trade-off',
      body: [
        'With `i !== home` the array `[2, 2]` swaps forever. Checking `nums[i] !== nums[home]` sees the duplicate and moves on.',
        'The same loop finds all disappeared numbers. It mutates the input, so say so. Sum formula and XOR are O(1) space alternatives for the single missing number.',
      ],
      keyIdea: 'Value comparison keeps the loop finite when the array has duplicates.',
      frames: [...DUP_FRAMES, disappeared()],
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** values in a known range like `1..n` or `0..n`, with O(n) time and O(1) space.',
        '- **Loop:** swap `nums[i]` to its home and stay on `i`, otherwise `i++`.',
        '- **Homes:** `nums[i] - 1` for `1..n`, `nums[i]` for `0..n`, with a range guard.',
        '- **Answer:** scan for the first index holding the wrong value.',
        '- **Not for:** ranges not bounded by the array length. Use a hash set.',
      ],
      keyIdea: 'Let each value index the array, then read the gaps.',
      frames: [{ state: FULL[FULL.length - 1].state }],
    },
  ],
});
