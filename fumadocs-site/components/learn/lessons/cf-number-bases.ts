import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on number bases. The repeated division of 45 by 2, the weights sum, the hex grouping of
 * 1101 1110 1010 1101 and the octal permission bits are all produced by real conversion code, not typed in.
 */

const N = 45;
const divisions = (() => {
  const out: { n: number; r: number }[] = [];
  let n = N;
  while (n > 0) {
    out.push({ n, r: n % 2 });
    n = Math.floor(n / 2);
  }
  return out;
})();
const BITS = divisions.map((d) => d.r).reverse(); // read the remainders from the bottom up
const WEIGHTS = BITS.map((_, i) => 2 ** (BITS.length - 1 - i));
const SUM = BITS.reduce((s, b, i) => s + b * WEIGHTS[i], 0);

const DEAD = 0xdead;
const dead16 = DEAD.toString(2).padStart(16, '0').split('');
const nibbles = [0, 1, 2, 3].map((k) => dead16.slice(k * 4, k * 4 + 4).join(''));
const hexOf = (nib: string) => parseInt(nib, 2).toString(16).toUpperCase();

const MODE = 0o755;
const modeBits = MODE.toString(2).padStart(9, '0').split('');
const perm = modeBits.map((b, i) => (b === '1' ? 'rwx'[i % 3] : '-'));

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const divide = (k: number): ArrayState => ({
  rows: [
    { label: 'number', cells: divisions.map((d, i) => (i < k ? d.n : '')), states: paint(divisions.length, (i) => (i === k - 1 ? 'active' : i < k ? 'done' : 'dim')), showIndex: false },
    { label: 'remainder', cells: divisions.map((d, i) => (i < k ? d.r : '')), states: paint(divisions.length, (i) => (i < k ? 'found' : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'Divide by', value: '2' },
    { label: 'Steps', value: `${k} of ${divisions.length}` },
    { label: 'Bits so far', value: divisions.slice(0, k).map((d) => d.r).reverse().join('') || '-' },
  ],
  note: k === divisions.length ? { text: 'the quotient reached 0: every remainder is a bit', tone: 'ok' } : { text: `${divisions[k - 1].n} / 2 = ${Math.floor(divisions[k - 1].n / 2)} remainder ${divisions[k - 1].r}`, tone: 'accent' },
});

const readUp = (): ArrayState => ({
  rows: [
    { label: 'bits', cells: BITS, states: paint(BITS.length, (i) => (BITS[i] ? 'found' : 'normal')), showIndex: false },
    { label: 'weight', cells: WEIGHTS, states: paint(BITS.length, (i) => (BITS[i] ? 'visited' : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'Binary', value: `0b${BITS.join('')}` },
    { label: 'Weights summed', value: WEIGHTS.filter((_, i) => BITS[i]).join('+') },
    { label: 'Decimal', value: String(SUM), tone: 'ok' },
  ],
  note: { text: `read the remainders upward: 0b${BITS.join('')} = ${WEIGHTS.filter((_, i) => BITS[i]).join(' + ')} = ${SUM}`, tone: 'ok' },
});

const hex = (k: number): ArrayState => ({
  rows: [
    { label: 'bits', cells: dead16, states: paint(16, (i) => (Math.floor(i / 4) === k ? 'active' : Math.floor(i / 4) < k ? 'done' : 'normal')), window: { from: k * 4, to: k * 4 + 3, label: `${nibbles[k]} = ${hexOf(nibbles[k])}`, tone: 'info' }, showIndex: false },
    { label: 'hex', cells: nibbles.map((n, i) => (i <= k ? hexOf(n) : '')), states: paint(4, (i) => (i <= k ? 'found' : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'Group size', value: '4 bits' },
    { label: 'Hex so far', value: nibbles.slice(0, k + 1).map(hexOf).join(''), tone: 'ok' },
    { label: 'Full value', value: `0x${DEAD.toString(16).toUpperCase()}` },
  ],
  note: { text: `group 4 bits from the right: ${nibbles[k]} is one hex digit, ${hexOf(nibbles[k])}`, tone: 'accent' },
});

const octal = (): ArrayState => ({
  rows: [
    { label: 'bits', cells: modeBits, states: paint(9, (i) => (modeBits[i] === '1' ? 'found' : 'dim')), showIndex: false },
    { label: 'permission', cells: perm, states: paint(9, (i) => (perm[i] === '-' ? 'dim' : 'done')), showIndex: false },
  ],
  stats: [
    { label: 'Octal', value: MODE.toString(8) },
    { label: 'Owner', value: perm.slice(0, 3).join('') },
    { label: 'Group, other', value: `${perm.slice(3, 6).join('')} ${perm.slice(6).join('')}` },
  ],
  note: { text: 'three bits make one octal digit, so 755 is rwx r-x r-x', tone: 'ok' },
});

export default defineLesson('array', {
  slug: 'cf-number-bases',
  objectives: [
    { text: 'How repeated division by 2 gives binary', step: 1 },
    { text: 'How to read the bits back as decimal', step: 2 },
    { text: 'How four bits make a hex digit', step: 3 },
    { text: 'Why Unix permissions are octal', step: 4 },
  ],
  steps: [
    {
      label: 'To binary',
      title: 'Divide by 2',
      tag: 'problem',
      body: ['To write 45 in binary, divide by 2 again and again and keep each **remainder**.', 'Stop when the quotient reaches 0.'],
      keyIdea: 'Each remainder is one bit, the first is the lowest.',
      frames: [1, 3, 6].map((k) => ({ state: divide(k), hold: k === 6 ? 3400 : 1600 })),
    },
    {
      label: 'Read back',
      title: 'Bottom up',
      tag: 'concept',
      body: ['Reading the remainders **from the bottom up** gives `101101`.', 'To go back, add the power of two for every 1 bit: 32 + 8 + 4 + 1 = 45.'],
      keyIdea: 'Binary is a sum of powers of two.',
      frames: [{ state: readUp(), hold: 4200 }],
    },
    {
      label: 'Hex',
      title: 'Four bits, one digit',
      tag: 'technique',
      body: ['Group bits in fours from the right. Each group is exactly one hex digit.', '`1101 1110 1010 1101` becomes `D E A D`.'],
      keyIdea: 'Two hex digits are one byte, which is why hex is used for colours, addresses and hashes.',
      frames: [0, 1, 2, 3].map((k) => ({ state: hex(k), hold: k === 3 ? 3400 : 1500 })),
    },
    {
      label: 'Octal',
      title: 'Three bits, one digit',
      tag: 'in practice',
      body: ['Octal groups bits in threes. A Unix permission is three bits: read, write, execute.', 'So `755` is `111 101 101`, which is `rwx r-x r-x`.'],
      keyIdea: 'chmod 755 is just three octal digits for owner, group and other.',
      frames: [{ state: octal(), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'Bases at a glance',
      tag: 'recap',
      body: [
        '- **To binary:** divide by 2, remainders bottom up.',
        '- **To decimal:** add the weights of the 1 bits.',
        '- **Hex:** four bits per digit.',
        '- **Octal:** three bits per digit.',
        '- **Prefixes:** `0b`, `0o`, `0x`.',
      ],
      keyIdea: 'Pick the base that matches the bit grouping you care about.',
      frames: [{ state: readUp() }],
    },
  ],
});
