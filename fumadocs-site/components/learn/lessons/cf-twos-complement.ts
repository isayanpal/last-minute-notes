import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on signed integers. Every bit pattern comes from real 8-bit arithmetic: invert and add 1,
 * the negative weight of the top bit, and wraparound on overflow (127 + 1 = -128, 0 - 1 = 255 unsigned).
 */

const bits = (n: number) => (n & 0xff).toString(2).padStart(8, '0').split('');
const int8 = (n: number) => (n << 24) >> 24;
const uint8 = (n: number) => n & 0xff;

const MINUS5_SIGN_MAG = ['1', '0', '0', '0', '0', '1', '0', '1']; // sign bit, then magnitude 5
const MINUS5_ONES = bits(~5);
const MINUS5_TWOS = bits(-5);
const PLUS_ZERO = bits(0);
const MINUS_ZERO_SIGN_MAG = ['1', '0', '0', '0', '0', '0', '0', '0'];

const THIRTEEN = bits(13);
const INVERTED = bits(~13);
const NEGATED = bits(~13 + 1);
const NEG13 = int8(parseInt(NEGATED.join(''), 2));

const WEIGHTS = [-128, 64, 32, 16, 8, 4, 2, 1];
const weightSum = (b: string[]) => b.reduce((s, x, i) => s + (x === '1' ? WEIGHTS[i] : 0), 0);

const MAX = bits(127);
const WRAPPED = bits(int8(127 + 1));
const WRAPPED_VALUE = int8(127 + 1);
const ZERO_MINUS_ONE = uint8(0 - 1);
const ABS_MIN = int8(-int8(-128));

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;
const row = (label: string, b: string[], tone: ItemState = 'visited'): ArrayState['rows'][number] => ({ label, cells: b, states: paint(8, (i) => (i === 0 ? 'swap' : b[i] === '1' ? tone : 'normal')), showIndex: false });

const schemes = (k: number): ArrayState => ({
  rows: [
    row('sign-mag', k >= 0 ? MINUS5_SIGN_MAG : []),
    ...(k >= 1 ? [row('1s comp', MINUS5_ONES)] : []),
    ...(k >= 2 ? [row('2s comp', MINUS5_TWOS, 'found')] : []),
  ],
  stats: [
    { label: 'Value', value: '-5' },
    { label: 'Zeros', value: k >= 2 ? '1' : '2', tone: k >= 2 ? 'ok' : 'bad' },
    { label: 'Used today', value: k >= 2 ? 'two\'s comp' : '-', tone: k >= 2 ? 'ok' : 'neutral' },
  ],
  note: k === 0 ? { text: `sign-magnitude has two zeros: ${PLUS_ZERO.join('')} and ${MINUS_ZERO_SIGN_MAG.join('')}`, tone: 'bad' } : k === 1 ? { text: 'one\'s complement flips every bit, and still has two zeros', tone: 'bad' } : { text: 'two\'s complement: one zero, and the same adder works for signed and unsigned', tone: 'ok' },
});

const negate = (k: number): ArrayState => ({
  rows: [row('13', THIRTEEN), ...(k >= 1 ? [row('~13', INVERTED, 'info' as ItemState)] : []), ...(k >= 2 ? [row('~13 + 1', NEGATED, 'found')] : [])],
  stats: [
    { label: 'Step', value: k === 0 ? 'start' : k === 1 ? 'invert' : 'add 1' },
    { label: 'Result', value: k >= 2 ? String(NEG13) : '-', tone: k >= 2 ? 'ok' : 'neutral' },
    { label: 'Check 13 + (-13)', value: k >= 2 ? String(int8(13 + NEG13)) : '-', tone: k >= 2 ? 'ok' : 'neutral' },
  ],
  note: k === 2 ? { text: `inverting and adding 1 gives ${NEGATED.join('')}, which is -13; adding 13 drops the carry and leaves 0`, tone: 'ok' } : k === 1 ? { text: 'invert every bit', tone: 'accent' } : { text: 'to negate in two\'s complement: invert all bits, then add 1', tone: 'accent' },
});

const weights = (): ArrayState => ({
  rows: [{ label: 'weight', cells: WEIGHTS, states: paint(8, (i) => (NEGATED[i] === '1' ? 'visited' : 'dim')), showIndex: false }, row('bits', NEGATED, 'found')],
  stats: [
    { label: 'Pattern', value: NEGATED.join('') },
    { label: 'Top bit weight', value: '-128', tone: 'bad' },
    { label: 'Sum of weights', value: String(weightSum(NEGATED)), tone: 'ok' },
  ],
  note: { text: `the sign bit counts as -128: ${WEIGHTS.filter((_, i) => NEGATED[i] === '1').join(' + ')} = ${weightSum(NEGATED)}`, tone: 'ok' },
});

const overflow = (kind: 'int8' | 'uint8'): ArrayState => ({
  rows:
    kind === 'int8'
      ? [row('127', MAX), row('127 + 1', WRAPPED, 'bad')]
      : [row('0', bits(0)), row('0 - 1', bits(ZERO_MINUS_ONE), 'bad')],
  stats: [
    { label: 'Type', value: kind },
    { label: 'Result', value: kind === 'int8' ? String(WRAPPED_VALUE) : String(ZERO_MINUS_ONE), tone: 'bad' },
    { label: 'Exception', value: 'none' },
  ],
  note: kind === 'int8' ? { text: 'the carry flips the sign bit: 01111111 + 1 = 10000000, which is -128', tone: 'bad' } : { text: 'unsigned 0 minus 1 wraps to the largest value, 255', tone: 'bad' },
});

const range = (): ArrayState => ({
  rows: [row('-128', bits(-128), 'info' as ItemState), row('-(-128)', bits(-int8(-128)), 'bad')],
  stats: [
    { label: '8-bit range', value: '-128 to 127' },
    { label: 'abs(-128)', value: String(ABS_MIN), tone: 'bad' },
    { label: 'Negatives', value: 'one extra', tone: 'bad' },
  ],
  note: { text: 'there is one more negative than positive, so negating the minimum gives the minimum again', tone: 'bad' },
});

export default defineLesson('array', {
  slug: 'cf-twos-complement',
  objectives: [
    { text: 'Why sign-magnitude and one\'s complement lost', step: 1 },
    { text: 'How to negate with invert and add 1', step: 2 },
    { text: 'Why the top bit has a negative weight', step: 3 },
    { text: 'How fixed-width integers wrap on overflow', step: 4 },
  ],
  steps: [
    {
      label: 'Schemes',
      title: 'Three ways to write -5',
      tag: 'problem',
      body: ['Early machines used sign-magnitude and one\'s complement. Both have **two zeros**, and addition needs special cases.', 'Two\'s complement has one zero, and the same adder handles signed and unsigned numbers.'],
      keyIdea: 'Every modern CPU uses two\'s complement.',
      frames: [0, 1, 2].map((k) => ({ state: schemes(k), hold: k === 2 ? 3800 : 2200 })),
    },
    {
      label: 'Negate',
      title: 'Invert, then add 1',
      tag: 'technique',
      body: ['To get -13, write 13, **invert every bit**, then **add 1**.', 'Check it: `11110011 + 00001101` carries out of the top and leaves 0.'],
      keyIdea: 'Subtraction reuses the adder: A - B = A + (~B) + 1.',
      frames: [0, 1, 2].map((k) => ({ state: negate(k), hold: k === 2 ? 4200 : 1800 })),
    },
    {
      label: 'Sign bit',
      title: 'A negative weight',
      tag: 'concept',
      body: ['In two\'s complement the top bit has a **negative weight**, -128 for 8 bits.', 'Add the weights of the 1 bits and you get the value.'],
      keyIdea: 'Widening a signed value copies the sign bit into the new high bits.',
      frames: [{ state: weights(), hold: 4400 }],
    },
    {
      label: 'Overflow',
      title: 'Wrap around',
      tag: 'trade-off',
      body: ['Fixed-width integers wrap. `127 + 1` in 8 bits is `-128`, and unsigned `0 - 1` is 255.', 'In C signed overflow is undefined behaviour, Java wraps silently, Rust panics in debug builds.'],
      keyIdea: 'Overflow does not raise an error, so check ranges yourself.',
      frames: [{ state: overflow('int8'), hold: 3600 }, { state: overflow('uint8'), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Two\'s complement',
      tag: 'recap',
      body: [
        '- **Negate:** invert all bits, add 1.',
        '- **Top bit:** negative weight.',
        '- **Range:** -128 to 127 for 8 bits.',
        '- **Asymmetric:** abs of the minimum overflows.',
        '- **Overflow:** wraps, no exception.',
      ],
      keyIdea: 'A binary search midpoint `(lo + hi) / 2` can overflow, use `lo + (hi - lo) / 2`.',
      frames: [{ state: range() }],
    },
  ],
});
