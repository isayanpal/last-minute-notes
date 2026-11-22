import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on bitwise operations: AND, OR, XOR on 6 and 3, shifts, and the tricks
 * x & -x (lowest set bit) and x &= x - 1 (clear the lowest set bit, count bits). Every row is computed with real integer operations.
 */

const b4 = (n: number) => (n & 0xf).toString(2).padStart(4, '0').split('');
const b8 = (n: number) => (n & 0xff).toString(2).padStart(8, '0').split('');
const int8 = (n: number) => (n << 24) >> 24;

const A = 6;
const B = 3;
const OPS = [
  { sym: '&', name: 'AND', r: A & B },
  { sym: '|', name: 'OR', r: A | B },
  { sym: '^', name: 'XOR', r: A ^ B },
];

const X = 12;
const LOWEST = X & -X;
const CLEARED = X & (X - 1);
const POW2 = X > 0 && (X & (X - 1)) === 0;
const popcount = (n: number) => {
  const trace: number[] = [n];
  let c = 0;
  while (n) {
    n &= n - 1;
    trace.push(n);
    c++;
  }
  return { count: c, trace };
};
const PC = popcount(X);

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;
const row = (label: string, b: string[], tone: ItemState = 'visited'): ArrayState['rows'][number] => ({ label, cells: b, states: paint(b.length, (i) => (b[i] === '1' ? tone : 'normal')), showIndex: false });

const logic = (i: number): ArrayState => {
  const op = OPS[i];
  return {
    rows: [row('a = 6', b4(A)), row('b = 3', b4(B)), row(`a ${op.sym} b`, b4(op.r), 'found')],
    stats: [
      { label: 'Operator', value: `${op.name} (${op.sym})` },
      { label: 'Result', value: `${op.r}`, tone: 'ok' },
      { label: 'Binary', value: b4(op.r).join(''), tone: 'ok' },
    ],
    note: { text: op.name === 'AND' ? '1 only where both bits are 1' : op.name === 'OR' ? '1 where either bit is 1' : '1 where the bits differ', tone: 'ok' },
  };
};

const shift = (kind: 'left' | 'right'): ArrayState => {
  const left = kind === 'left';
  const start = left ? 3 : -5;
  const result = left ? 3 << 2 : -5 >> 1;
  return {
    rows: [row(left ? '3' : '-5', b8(start)), row(left ? '3 << 2' : '-5 >> 1', b8(result), 'found')],
    stats: [
      { label: 'Operation', value: left ? '3 << 2' : '-5 >> 1' },
      { label: 'Result', value: String(result), tone: 'ok' },
      { label: 'Meaning', value: left ? 'x 2^2' : 'divide by 2' },
    ],
    note: left ? { text: 'a left shift by k multiplies by 2^k: 3 becomes 12', tone: 'ok' } : { text: 'an arithmetic right shift keeps the sign and rounds toward negative infinity: -5 becomes -3', tone: 'ok' },
  };
};

const lowest = (): ArrayState => ({
  rows: [row('x = 12', b8(X)), row('-x', b8(-X), 'info' as ItemState), row('x & -x', b8(LOWEST), 'found')],
  stats: [
    { label: 'x', value: String(X) },
    { label: 'x & -x', value: String(LOWEST), tone: 'ok' },
    { label: 'Meaning', value: 'lowest set bit' },
  ],
  note: { text: `-x flips everything above the lowest 1, so x & -x keeps only that bit: ${LOWEST}`, tone: 'ok' },
});

const clearLowest = (k: number): ArrayState => {
  const cur = PC.trace[k];
  return {
    rows: [row('x', b8(cur)), row('x - 1', b8(Math.max(0, cur - 1)), 'info' as ItemState), row('x & (x-1)', b8(cur ? cur & (cur - 1) : 0), 'found')],
    stats: [
      { label: 'Iteration', value: String(k + 1) },
      { label: 'x becomes', value: String(cur ? cur & (cur - 1) : 0) },
      { label: 'Bits counted', value: String(Math.min(k + 1, PC.count)), tone: 'ok' },
    ],
    note: { text: k + 1 === PC.count ? `x reached 0 after ${PC.count} steps, so 12 has ${PC.count} set bits` : 'x & (x - 1) clears the lowest set bit', tone: 'ok' },
  };
};

const recap = (): ArrayState => ({
  rows: [row('x = 12', b8(X)), row('x & (x-1)', b8(CLEARED), 'found')],
  stats: [
    { label: 'Power of 2?', value: POW2 ? 'yes' : 'no', tone: POW2 ? 'ok' : 'neutral' },
    { label: 'Set bits', value: String(PC.count) },
    { label: 'Even or odd', value: X & 1 ? 'odd' : 'even' },
  ],
  note: { text: `x & (x - 1) is ${CLEARED}, not 0, so 12 is not a power of two`, tone: 'ok' },
});

export default defineLesson('array', {
  slug: 'cf-bitwise',
  objectives: [
    { text: 'How AND, OR and XOR combine bits', step: 1 },
    { text: 'What shifts do to a value', step: 2 },
    { text: 'How x & -x finds the lowest set bit', step: 3 },
    { text: 'How x &= x - 1 counts bits', step: 4 },
  ],
  steps: [
    {
      label: 'AND OR XOR',
      title: 'Combine bit by bit',
      tag: 'problem',
      body: ['Bitwise operators work on each bit position separately. Take `6` and `3`.', '`&` keeps bits set in both, `|` keeps bits set in either, `^` keeps bits that differ.'],
      keyIdea: 'XOR of two equal values is 0, so pairs cancel out.',
      frames: [0, 1, 2].map((i) => ({ state: logic(i), hold: 2800 })),
    },
    {
      label: 'Shifts',
      title: 'Multiply and divide by 2',
      tag: 'concept',
      body: ['`x << k` multiplies by 2^k. `x >> k` divides by 2^k, and the arithmetic version keeps the sign.', 'In Java and JavaScript `>>>` shifts in zeros instead.'],
      keyIdea: '`-5 >> 1` is -3: it rounds toward negative infinity.',
      frames: [{ state: shift('left'), hold: 3400 }, { state: shift('right'), hold: 3800 }],
    },
    {
      label: 'Lowest bit',
      title: 'x & -x',
      tag: 'technique',
      body: ['In two\'s complement, `-x` is `~x + 1`. That flips every bit above the lowest 1 and keeps the lowest 1.', 'So `x & -x` isolates the lowest set bit.'],
      keyIdea: 'This is the trick behind Fenwick trees.',
      frames: [{ state: lowest(), hold: 4200 }],
    },
    {
      label: 'Count bits',
      title: 'x &= x - 1',
      tag: 'technique',
      body: ['Subtracting 1 turns the lowest 1 into 0 and the zeros below it into 1s. AND with `x` clears just that lowest 1.', 'Loop until `x` is 0 and count the iterations: that is **popcount**.'],
      keyIdea: 'The loop runs once per set bit, not once per bit position.',
      frames: [0, 1].map((k) => ({ state: clearLowest(k), hold: k === 1 ? 3800 : 2400 })),
    },
    {
      label: 'Recap',
      title: 'Bit tricks',
      tag: 'recap',
      body: [
        '- **Check bit k:** `(x >> k) & 1`.',
        '- **Set, clear, toggle:** `| (1<<k)`, `& ~(1<<k)`, `^ (1<<k)`.',
        '- **Lowest set bit:** `x & -x`.',
        '- **Power of two:** `x > 0 && (x & (x-1)) == 0`.',
        '- **Uses:** flags, masks, bitmaps, hashes.',
      ],
      keyIdea: 'Permission flags like `O_RDONLY | O_CREAT` are just OR-ed bits.',
      frames: [{ state: recap() }],
    },
  ],
});
