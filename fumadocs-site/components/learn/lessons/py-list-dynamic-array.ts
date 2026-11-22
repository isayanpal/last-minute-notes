import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Python notes on list as a dynamic array. CPython's over-allocation formula, new_allocated = (newsize + (newsize >> 3) + 6) & ~3,
 * is run for real: capacity grows at lengths 1, 5, 9, 17, 25 and 33, exactly as the notes list. The pointer copies per resize and the shift cost of
 * insert(0) are counted from the same model.
 */

const grow = (newsize: number) => (newsize + (newsize >> 3) + 6) & ~3;

type Resize = { len: number; alloc: number; copied: number };
const resizes: Resize[] = [];
const capacityAt: number[] = [0];
{
  let alloc = 0;
  for (let n = 1; n <= 64; n++) {
    if (n > alloc) {
      const prev = alloc;
      alloc = grow(n);
      resizes.push({ len: n, alloc, copied: prev === 0 ? 0 : n - 1 });
    }
    capacityAt.push(alloc);
  }
}
const resizeLens = resizes.slice(0, 6).map((r) => r.len);
const copiesUpTo = (n: number) => resizes.filter((r) => r.len <= n).reduce((s, r) => s + r.copied, 0);
const growsAt = (n: number) => resizes.some((r) => r.len === n);

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const slots = (len: number, note: ArrayState['note']): ArrayState => {
  const cap = capacityAt[len] || 4;
  return {
    rows: [{ label: 'ob_item', cells: Array.from({ length: cap }, (_, i) => (i < len ? 'p' : '')), states: paint(cap, (i) => (i < len ? 'found' : 'dim')), pointers: len ? [{ i: len - 1, label: 'last', up: true }] : [], showIndex: false }],
    stats: [
      { label: 'len', value: String(len) },
      { label: 'allocated', value: String(cap), tone: 'ok' },
      { label: 'Resized now', value: len && growsAt(len) ? 'yes' : 'no', tone: len && growsAt(len) ? 'bad' : 'neutral' },
    ],
    note,
  };
};

const COUNTS = [8, 16, 32, 64];
const amortised = (): ArrayState => ({
  rows: [
    { label: 'appends', cells: COUNTS, bars: true, states: paint(4, () => 'visited'), pointers: COUNTS.map((n, i) => ({ i, label: `n=${n}` })), showIndex: false },
    { label: 'copies', cells: COUNTS.map(copiesUpTo), bars: true, states: paint(4, () => 'bad'), showIndex: false },
  ],
  stats: [
    { label: 'n = 64 appends', value: '64' },
    { label: 'Pointer copies', value: String(copiesUpTo(64)), tone: 'ok' },
    { label: 'Copies/append', value: (copiesUpTo(64) / 64).toFixed(2), tone: 'ok' },
  ],
  note: { text: `64 appends caused ${copiesUpTo(64)} pointer copies: a small constant each, so append is amortized O(1)`, tone: 'ok' },
});

const SIZES = [10, 20, 40, 80];
const shifts = (): ArrayState => ({
  rows: [
    { label: 'append', cells: SIZES.map(() => 0), bars: true, states: paint(4, () => 'found'), pointers: SIZES.map((n, i) => ({ i, label: `n=${n}` })), showIndex: false },
    { label: 'insert(0)', cells: SIZES, bars: true, states: paint(4, () => 'bad'), showIndex: false },
  ],
  stats: [
    { label: 'append shifts', value: '0', tone: 'ok' },
    { label: 'insert(0) shifts', value: 'n pointers', tone: 'bad' },
    { label: 'Use instead', value: 'deque' },
  ],
  note: { text: 'inserting at the front moves every pointer one slot right: O(n) per insert', tone: 'bad' },
});

export default defineLesson('array', {
  slug: 'py-list-dynamic-array',
  objectives: [
    { text: 'What a list actually stores', step: 1 },
    { text: 'When capacity grows', step: 2 },
    { text: 'Why append is amortized O(1)', step: 3 },
    { text: 'Why insert(0) is O(n)', step: 4 },
  ],
  steps: [
    {
      label: 'Pointers',
      title: 'An array of pointers',
      tag: 'problem',
      body: ['A `list` is a contiguous array of **pointers** to objects, not of the objects themselves. That is why it can hold mixed types.', 'It also has `allocated` spare slots beyond its length.'],
      keyIdea: 'A list of a million ints costs the pointers plus every int object.',
      frames: [{ state: slots(3, { text: 'three pointers in use, one spare slot already allocated', tone: 'accent' }), hold: 3600 }],
    },
    {
      label: 'Growth',
      title: 'Over-allocate by about 12.5%',
      tag: 'concept',
      body: ['When `append` runs out of room, CPython grows the array by about 12.5 percent plus a small constant.', `The capacity changes when the length reaches ${resizeLens.join(', ')}.`],
      keyIdea: 'Most appends just fill a spare slot.',
      frames: [1, 4, 5, 9].map((n) => ({ state: slots(n, { text: growsAt(n) ? `append number ${n} had no room: capacity became ${capacityAt[n]}` : `length ${n} still fits in ${capacityAt[n]} slots`, tone: growsAt(n) ? 'bad' : 'ok' }), hold: 2200 })),
    },
    {
      label: 'Amortized',
      title: 'Few copies, many appends',
      tag: 'technique',
      body: ['A resize copies the existing pointers, but resizes get rarer as the list grows.', `64 appends cost ${copiesUpTo(64)} pointer copies in total, about one per append.`],
      keyIdea: 'Amortized O(1): the occasional resize is spread over many appends.',
      frames: [{ state: amortised(), hold: 4600 }],
    },
    {
      label: 'insert(0)',
      title: 'The front is expensive',
      tag: 'trade-off',
      body: ['`xs.insert(0, x)` and `xs.pop(0)` shift **every** pointer, so they are O(n).', '`xs[i]` is O(1) pointer arithmetic, and `x in xs` is an O(n) scan.'],
      keyIdea: 'Use `collections.deque` for queues, and a `set` for repeated membership checks.',
      frames: [{ state: shifts(), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'list costs',
      tag: 'recap',
      body: [
        '- **Storage:** an array of pointers plus spare capacity.',
        '- **append, pop:** O(1) amortized.',
        '- **insert(0), pop(0):** O(n).',
        '- **in:** O(n), **index:** O(1), **slice:** O(k).',
        '- **sort:** O(n log n), Timsort.',
      ],
      keyIdea: '`nums = nums.sort()` sets nums to None, because sort works in place.',
      frames: [{ state: amortised() }],
    },
  ],
});
