import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on IEEE 754. The bit patterns come from real typed arrays: -5.75 is encoded by hand and checked against
 * Float32 (0xC0B80000), 0.1 as a float is 0x3DCCCCCD, and 0.1 + 0.2 is compared with 0.3 in real doubles.
 */

const f32bits = (x: number) => {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setFloat32(0, x);
  return dv.getUint32(0).toString(2).padStart(32, '0');
};
const f64hex = (x: number) => {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  return dv.getBigUint64(0).toString(16).toUpperCase().padStart(16, '0');
};
const hex32 = (bits: string) => parseInt(bits, 2).toString(16).toUpperCase().padStart(8, '0');

// Encoding -5.75 by hand: sign, normalise, exponent + 127, mantissa bits.
const VALUE = -5.75;
const sign = VALUE < 0 ? '1' : '0';
const abs = Math.abs(VALUE);
const intBits = Math.floor(abs).toString(2); // 101
const fracBits = (() => {
  let f = abs - Math.floor(abs);
  let s = '';
  while (f > 0 && s.length < 23) {
    f *= 2;
    s += f >= 1 ? '1' : '0';
    f -= f >= 1 ? 1 : 0;
  }
  return s;
})(); // 11
const shift = intBits.length - 1; // normalise to 1.xxx x 2^shift
const exponent = (shift + 127).toString(2).padStart(8, '0');
const mantissa = (intBits.slice(1) + fracBits).padEnd(23, '0');
const MANUAL = sign + exponent + mantissa;
const CHECK = f32bits(VALUE);

const TENTH = f32bits(0.1);
const SUM = 0.1 + 0.2;
const SUM_HEX = f64hex(SUM).split('');
const THREE_HEX = f64hex(0.3).split('');

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const problem = (): ArrayState => ({
  rows: [
    { label: '0.1+0.2', cells: SUM_HEX, states: paint(16, (i) => (SUM_HEX[i] !== THREE_HEX[i] ? 'bad' : 'visited')), showIndex: false },
    { label: '0.3', cells: THREE_HEX, states: paint(16, (i) => (SUM_HEX[i] !== THREE_HEX[i] ? 'bad' : 'visited')), showIndex: false },
  ],
  stats: [
    { label: 'Equals 0.3', value: String(SUM === 0.3), tone: 'bad' },
    { label: 'Apart by', value: `${BigInt(`0x${f64hex(SUM)}`) - BigInt(`0x${f64hex(0.3)}`)} ulp` },
    { label: 'Hex digits', value: 'last differs' },
  ],
  note: { text: `0.1 + 0.2 prints as ${SUM}: the last hex digit differs, so it is another double`, tone: 'bad' },
});

const layout = (): ArrayState => ({
  rows: [
    { label: 'sign', cells: [CHECK[0]], states: { 0: 'swap' }, showIndex: false },
    { label: 'exponent', cells: CHECK.slice(1, 9).split(''), states: paint(8, () => 'visited'), showIndex: false },
    { label: 'mantissa', cells: CHECK.slice(9, 17).split(''), states: paint(8, () => 'found'), showIndex: false },
  ],
  stats: [
    { label: 'Fields', value: '1 + 8 + 23' },
    { label: 'Bias', value: '127' },
    { label: 'Formula', value: '1.m * 2^(e-b)' },
  ],
  note: { text: 'a float is a sign, an exponent with bias 127 and 23 mantissa bits (first 8 shown, the rest are 0)', tone: 'accent' },
});

const encode = (k: number): ArrayState => {
  const notes = [
    `negative, so the sign bit is ${sign}`,
    `5.75 = ${intBits}.${fracBits} in binary, which normalises to 1.${intBits.slice(1)}${fracBits} x 2^${shift}`,
    `exponent = ${shift} + 127 = ${shift + 127} = ${exponent}`,
    `mantissa = the bits after the leading 1: ${intBits.slice(1)}${fracBits} then zeros`,
  ];
  return {
    rows: [
      { label: 'sign', cells: k >= 0 ? [sign] : [], states: { 0: 'swap' }, showIndex: false },
      { label: 'exponent', cells: k >= 2 ? exponent.split('') : [], states: paint(8, () => 'visited'), showIndex: false },
      { label: 'mantissa', cells: k >= 3 ? mantissa.slice(0, 8).split('') : [], states: paint(8, () => 'found'), showIndex: false },
    ],
    stats: [
      { label: 'Value', value: String(VALUE) },
      { label: 'Exponent', value: k >= 1 ? `2^${shift}` : '-' },
      { label: 'Hex', value: k >= 3 ? `0x${hex32(MANUAL)}` : '-', tone: k >= 3 ? 'ok' : 'neutral' },
    ],
    note: { text: k === 3 ? `${notes[k]}. Result 0x${hex32(MANUAL)}, matching Float32: ${MANUAL === CHECK}` : notes[k], tone: k === 3 ? 'ok' : 'accent' },
  };
};

const tenth = (): ArrayState => {
  const h = hex32(TENTH).split('');
  return {
    rows: [{ label: '0.1 as hex', cells: h, states: paint(8, (i) => (h[i] === 'C' ? 'swap' : 'visited')), showIndex: false }],
    stats: [
      { label: '0.1 float', value: `0x${h.join('')}` },
      { label: 'Pattern', value: 'repeating C' },
      { label: 'Exact?', value: 'no', tone: 'bad' },
    ],
    note: { text: '0.1 is 0.000110011... in binary, repeating forever like 1/3, so it must be rounded', tone: 'bad' },
  };
};

const SPECIAL = [
  { c: 'NaN', r: String(Number.NaN !== Number.NaN) },
  { c: '1/-0', r: 1 / -0 === -Infinity ? '-Inf' : '?' },
  { c: '1e16', r: String(1e16 + 1 === 1e16) },
  { c: '2^53', r: String(2 ** 53 + 1 === 2 ** 53) },
];
const special = (): ArrayState => ({
  rows: [
    { label: 'case', cells: SPECIAL.map((s) => s.c), states: paint(4, () => 'normal'), showIndex: false },
    { label: 'result', cells: SPECIAL.map((s) => s.r), states: paint(4, () => 'found'), showIndex: false },
  ],
  stats: [
    { label: 'NaN != NaN', value: SPECIAL[0].r },
    { label: '1 / -0.0', value: String(1 / -0) },
    { label: '2^53 + 1 same', value: SPECIAL[3].r },
  ],
  note: { text: 'never compare floats with ==, and integers are exact in a double only up to 2^53', tone: 'ok' },
});

export default defineLesson('array', {
  slug: 'cf-ieee754',
  objectives: [
    { text: 'Why 0.1 + 0.2 is not 0.3', step: 1 },
    { text: 'The three fields of a float', step: 2 },
    { text: 'How to encode -5.75 by hand', step: 3 },
    { text: 'Why 0.1 cannot be stored exactly', step: 4 },
  ],
  steps: [
    {
      label: 'The surprise',
      title: '0.1 + 0.2',
      tag: 'problem',
      body: ['In double precision `0.1 + 0.2` is `0.30000000000000004`, not `0.3`.', 'Comparing the raw bits shows two different numbers, not a printing quirk.'],
      keyIdea: 'Floating point stores binary fractions, and most decimal fractions are not exact in binary.',
      frames: [{ state: problem(), hold: 4400 }],
    },
    {
      label: 'Fields',
      title: 'Sign, exponent, mantissa',
      tag: 'concept',
      body: ['A float is scientific notation in base 2: `(-1)^sign x 1.mantissa x 2^(exponent - bias)`.', 'A single uses 1, 8 and 23 bits with bias 127, a double uses 1, 11 and 52 with bias 1023.'],
      keyIdea: 'The leading 1 of the mantissa is implied, so it is not stored.',
      frames: [{ state: layout(), hold: 4400 }],
    },
    {
      label: 'Encode',
      title: 'Encode -5.75',
      tag: 'technique',
      body: ['Write the sign, convert to binary, normalise, add the bias to the exponent, and keep the bits after the leading 1.', 'The result is `0xC0B80000`, and a real `Float32` agrees.'],
      keyIdea: 'Follow the recipe once by hand and the format stops being magic.',
      frames: [0, 1, 2, 3].map((k) => ({ state: encode(k), hold: k === 3 ? 4400 : 2400 })),
    },
    {
      label: 'Rounding',
      title: 'A repeating fraction',
      tag: 'trade-off',
      body: ['0.1 in binary repeats `0011` forever, so it is **rounded** to the nearest float, `0x3DCCCCCD`.', 'The same happens to 0.2, and the two rounding errors do not cancel.'],
      keyIdea: 'Compare with a tolerance, and use integers or decimals for money.',
      frames: [{ state: tenth(), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Floating point rules',
      tag: 'recap',
      body: [
        '- **Layout:** sign, biased exponent, mantissa.',
        '- **Inexact:** most decimal fractions repeat in binary.',
        '- **Compare:** with a tolerance, never `==`.',
        '- **Special:** NaN, infinity, signed zero, subnormals.',
        '- **Integers:** exact in a double only up to 2^53.',
      ],
      keyIdea: 'Large IDs are sent as strings in JSON because of that 2^53 limit.',
      frames: [{ state: special() }],
    },
  ],
});
