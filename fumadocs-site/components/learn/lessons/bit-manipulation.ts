import { defineLesson } from '../define';
import type { ArrayRow, ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Every bit row is computed from the real integer, so the 1s and 0s on screen match the operation.
 */

const WIDTH = 8;
const bits = (n: number): string[] => n.toString(2).padStart(WIDTH, '0').split('');
const bitStates = (b: string[]): Record<number, ItemState> => Object.fromEntries(b.map((v, i) => [i, v === '1' ? 'active' : 'dim'])) as Record<number, ItemState>;
const row = (label: string, n: number, over: Partial<ArrayRow> = {}): ArrayRow => ({ label, cells: bits(n), states: bitStates(bits(n)), showIndex: false, ...over });

// Step 1: a number is a row of bits.
const BASICS: ArrayState = {
  rows: [row('11', 11)],
  panels: [{ title: 'operators', kind: 'list', items: ['a & b  and', 'a | b  or', 'a ^ b  xor', '~a    not', 'a << k shift', 'a >> k shift'] }],
  stats: [{ label: 'Value', value: '11' }, { label: 'Binary', value: '00001011' }, { label: 'Set bits', value: '3' }],
  note: { text: '8 + 2 + 1 = 11', tone: 'accent' },
};

// Step 2: XOR cancels pairs. Real running value for single number.
function xorFrames(): Frame<ArrayState>[] {
  const nums = [4, 1, 2, 1, 2];
  const frames: Frame<ArrayState>[] = [];
  let acc = 0;
  nums.forEach((n, i) => {
    const before = acc;
    acc ^= n;
    frames.push({
      hold: 1700,
      state: {
        rows: [
          { label: 'nums', cells: nums, states: { ...Object.fromEntries(nums.map((_, k) => [k, k < i ? 'done' : 'normal'])), [i]: 'active' } as Record<number, ItemState>, showIndex: true },
          row('acc', acc, { label: 'acc bits' }),
        ],
        stats: [{ label: 'acc before', value: String(before) }, { label: 'xor with', value: String(n) }, { label: 'acc now', value: String(acc), tone: 'ok' }],
        note: { text: `${before} ^ ${n} = ${acc}${i === nums.length - 1 ? ': the pairs cancelled, 4 is left' : ''}`, tone: i === nums.length - 1 ? 'ok' : 'accent' },
      },
    });
  });
  return frames;
}

// Step 3: n &= n - 1 clears the lowest set bit.
function popcountFrames(): Frame<ArrayState>[] {
  let n = 11;
  let count = 0;
  const frames: Frame<ArrayState>[] = [];
  while (n !== 0) {
    const prev = n;
    const minus = n - 1;
    n &= n - 1;
    count++;
    frames.push({
      hold: 2000,
      state: {
        rows: [row('n', prev), row('n - 1', minus, { states: Object.fromEntries(bits(minus).map((v, i) => [i, v === '1' ? 'visited' : 'dim'])) as Record<number, ItemState> }), row('n & (n-1)', n, { states: Object.fromEntries(bits(n).map((v, i) => [i, v === '1' ? 'found' : 'dim'])) as Record<number, ItemState> })],
        stats: [{ label: 'n', value: `${prev} to ${n}` }, { label: 'Count', value: String(count), tone: 'ok' }, { label: 'Loops left', value: String(n.toString(2).split('1').length - 1) }],
        note: { text: 'n - 1 flips the lowest set bit and the zeros after it, & clears them', tone: 'accent' },
      },
    });
  }
  frames[frames.length - 1].state.note = { text: `n is 0: ${count} set bits, one loop per set bit`, tone: 'ok' };
  return frames;
}

// Step 4: power of two.
const pow2 = (n: number): ArrayState => {
  const r = n & (n - 1);
  const ok = n > 0 && r === 0;
  return {
    rows: [row('n', n), row('n - 1', n - 1, { states: Object.fromEntries(bits(n - 1).map((v, i) => [i, v === '1' ? 'visited' : 'dim'])) as Record<number, ItemState> }), row('n & (n-1)', r, { states: Object.fromEntries(bits(r).map((v, i) => [i, v === '1' ? 'bad' : 'dim'])) as Record<number, ItemState> })],
    stats: [{ label: 'n', value: String(n) }, { label: 'n & (n - 1)', value: String(r), tone: ok ? 'ok' : 'bad' }, { label: 'Power of 2?', value: ok ? 'yes' : 'no', tone: ok ? 'ok' : 'bad' }],
    note: ok ? { text: 'exactly one set bit: clearing it leaves 0', tone: 'ok' } : { text: 'more than one set bit: something remains', tone: 'bad' },
  };
};

// Step 5: 32-bit signed integers in JavaScript.
const SIGNED: ArrayState = {
  rows: [{ label: '1 << 31', cells: ['1', '0', '0', '...', '0'], states: { 0: 'bad', 1: 'dim', 2: 'dim', 3: 'dim', 4: 'dim' }, showIndex: false }],
  stats: [{ label: '1 << 31', value: '-2147483648', tone: 'bad' }, { label: 'Fix', value: '>>> 0' }, { label: '64 bit', value: 'BigInt' }],
  note: { text: 'bitwise operators use 32-bit signed integers', tone: 'bad' },
};

export default defineLesson('isoArray', {
  slug: 'bit-manipulation',
  pseudocode: [
    'xor all numbers: pairs cancel, the single one stays',
    'n & (n - 1) clears the lowest set bit',
    'count bits: repeat n = n & (n - 1) until n is 0',
    'power of two: n > 0 and n & (n - 1) == 0',
    'use >>> 0 when 32-bit signed values surprise you',
  ],
  objectives: [
    { text: 'Read a number as a row of bits', step: 1 },
    { text: 'XOR cancels pairs: single number in one pass', step: 2 },
    { text: 'n & (n - 1) clears the lowest set bit', step: 3 },
    { text: 'Power of two and the 32-bit signed trap', step: 4 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Numbers are rows of bits',
      tag: 'problem',
      body: [
        'Bit tricks turn "find the odd one out", "count set bits" and "is it a power of two" into one pass with O(1) extra space.',
        'Every trick starts from seeing the number as bits: `11` is `00001011`.',
      ],
      keyIdea: 'Reach for bits when the problem mentions parity, pairs, subsets of a small set, or constant space.',
      frames: [{ state: BASICS }],
    },
    {
      label: 'XOR',
      title: 'Pairs cancel themselves',
      tag: 'technique',
      code: [1],
      body: [
        '`a ^ a = 0` and `a ^ 0 = a`. XOR every number together and each value that appears twice cancels out.',
        'In `[4, 1, 2, 1, 2]` the 1s and 2s cancel and `4` remains. One pass, no hash map.',
      ],
      keyIdea: 'XOR is commutative, so order does not matter. Great for "every element appears twice except one".',
      frames: xorFrames(),
    },
    {
      label: 'Clear lowest bit',
      title: 'n & (n - 1) drops one set bit',
      tag: 'technique',
      code: [2, 3],
      body: [
        'Subtracting 1 flips the lowest set bit and every zero after it. AND-ing with the original clears exactly that lowest set bit.',
        'Count how many times you can do it before reaching 0, and you have the set-bit count in one loop per set bit.',
      ],
      keyIdea: 'In real code prefer `Integer.bitCount(n)`. In an interview, this loop is the answer.',
      frames: popcountFrames(),
    },
    {
      label: 'Power of two',
      title: 'Exactly one set bit',
      tag: 'technique',
      code: [4],
      body: [
        'A power of two has one set bit. Clearing it with `n & (n - 1)` leaves 0, so `n > 0 && (n & (n - 1)) === 0` is the test.',
        'The `n > 0` guard matters, because 0 would otherwise pass.',
      ],
      keyIdea: 'Compare 16 and 12. 16 collapses to 0, 12 leaves 8.',
      frames: [{ state: pow2(16), hold: 2600 }, { state: pow2(12) }],
    },
    {
      label: 'JS traps',
      title: '32-bit signed surprises',
      tag: 'trade-off',
      code: [5],
      body: [
        'JavaScript bitwise operators work on **32-bit signed** integers. `1 << 31` is negative, and values above 2^31 - 1 truncate silently.',
        'Use `>>> 0` for unsigned behaviour or `BigInt` when you need 64 bits. In Java, `1 << 32` wraps to `1` for an `int`.',
      ],
      keyIdea: 'Know your language\'s integer width before you trust a shift.',
      frames: [{ state: SIGNED }],
    },
    {
      label: 'Recap',
      title: 'The four tricks',
      tag: 'recap',
      body: [
        '- **XOR:** pairs cancel, so a single value survives.',
        '- **`n & (n - 1)`:** clears the lowest set bit. Counts bits and tests powers of two.',
        '- **Masks:** bit `i` of a mask means "include item `i`", handy for subsets up to about 20.',
        '- **Widths:** 32-bit signed in JavaScript, wrap-around in Java.',
        '- **Library:** `Integer.bitCount`, `Long.numberOfTrailingZeros`.',
      ],
      keyIdea: 'A small set of identities solves most bit questions in constant space.',
      frames: [{ state: popcountFrames().at(-1)!.state }],
    },
  ],
});
