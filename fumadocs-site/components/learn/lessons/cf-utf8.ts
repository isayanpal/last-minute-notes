import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on Unicode and UTF-8. A hand-written UTF-8 encoder is checked against the real TextEncoder,
 * the emoji lengths are measured with real string APIs (bytes, UTF-16 units, code points, graphemes), and the normalisation example runs for real.
 */

const encode = (cp: number): number[] => {
  if (cp < 0x80) return [cp];
  if (cp < 0x800) return [0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)];
  if (cp < 0x10000) return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)];
  return [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)];
};
const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const bin = (n: number) => n.toString(2).padStart(8, '0');

const CHARS = ['A', 'é', '€', '😀'];
const CP = CHARS.map((c) => c.codePointAt(0)!);
const BYTES = CP.map(encode);
const MATCHES = CHARS.every((c, i) => Array.from(new TextEncoder().encode(c)).join() === BYTES[i].join());

const EMOJI = '😀';
const LENGTHS = {
  utf8: new TextEncoder().encode(EMOJI).length,
  utf16: EMOJI.length,
  points: [...EMOJI].length,
  graphemes: [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(EMOJI)].length,
};

const COMPOSED: string = 'é';
const DECOMPOSED: string = 'é';
const SAME_NFC = COMPOSED.normalize('NFC') === DECOMPOSED.normalize('NFC');


const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const lengths = (): ArrayState => ({
  rows: [{ label: 'length', cells: [LENGTHS.utf8, LENGTHS.utf16, LENGTHS.points, LENGTHS.graphemes], pointers: [{ i: 0, label: 'bytes' }, { i: 1, label: 'units' }, { i: 2, label: 'points' }, { i: 3, label: 'glyphs' }], states: paint(4, (i) => (i === 0 ? 'bad' : 'found')), showIndex: false }],
  stats: [
    { label: 'UTF-8 bytes', value: String(LENGTHS.utf8) },
    { label: 'JS .length', value: String(LENGTHS.utf16), tone: 'bad' },
    { label: 'Python len', value: String(LENGTHS.points) },
  ],
  note: { text: `one emoji is ${LENGTHS.utf8} bytes, ${LENGTHS.utf16} UTF-16 units, ${LENGTHS.points} code point and ${LENGTHS.graphemes} user-visible character`, tone: 'bad' },
});

const sizes = (): ArrayState => ({
  rows: [
    { label: 'char', cells: CHARS, states: paint(4, () => 'normal'), showIndex: false },
    { label: 'code point', cells: CP.map((c) => (c.toString(16).toUpperCase())), states: paint(4, () => 'visited'), showIndex: false },
    { label: 'bytes', cells: BYTES.map((b) => b.length), states: paint(4, (i) => (BYTES[i].length > 1 ? 'swap' : 'found')), showIndex: false },
  ],
  stats: [
    { label: 'ASCII', value: '1 byte', tone: 'ok' },
    { label: 'Range', value: '1 to 4 bytes' },
    { label: 'Encoder check', value: MATCHES ? 'matches' : 'differs', tone: MATCHES ? 'ok' : 'bad' },
  ],
  note: { text: 'ASCII stays one byte, and higher code points need two, three or four', tone: 'accent' },
});

const euro = (k: number): ArrayState => ({
  rows: BYTES[2].map((byte, i) => ({
    label: `byte ${i + 1}`,
    cells: i <= k ? bin(byte).split('') : [],
    states: paint(8, (j) => (i === k ? (j < (i === 0 ? 4 : 2) ? 'swap' : 'active') : 'done')),
    showIndex: false,
  })),
  stats: [
    { label: 'Code point', value: `U+${CP[2].toString(16).toUpperCase()}` },
    { label: 'Pattern', value: '1110xxxx...' },
    { label: 'Bytes so far', value: BYTES[2].slice(0, k + 1).map(hex).join(' '), tone: 'ok' },
  ],
  note: { text: k === 0 ? 'a 3-byte character starts with 1110, then 4 payload bits (purple is the marker)' : k === 1 ? 'each continuation byte starts with 10 and carries 6 more bits' : `the three bytes are ${BYTES[2].map(hex).join(' ')}`, tone: 'accent' },
});

const normal = (): ArrayState => ({
  rows: [
    { label: 'composed', cells: [COMPOSED.codePointAt(0)!.toString(16).toUpperCase()], states: { 0: 'found' }, showIndex: false },
    { label: 'decomposed', cells: [...DECOMPOSED].map((c) => c.codePointAt(0)!.toString(16).toUpperCase()), states: paint(2, () => 'swap'), showIndex: false },
  ],
  stats: [
    { label: 'Same text', value: 'looks equal' },
    { label: 'Equal as is', value: String(COMPOSED === DECOMPOSED), tone: 'bad' },
    { label: 'Equal after NFC', value: String(SAME_NFC), tone: 'ok' },
  ],
  note: { text: 'é can be one code point or e plus a combining accent: normalise before comparing', tone: 'ok' },
});

export default defineLesson('array', {
  slug: 'cf-utf8',
  objectives: [
    { text: 'Why string length is ambiguous', step: 1 },
    { text: 'How many bytes UTF-8 uses per character', step: 2 },
    { text: 'How a code point becomes UTF-8 bytes', step: 3 },
    { text: 'Why you normalise before comparing', step: 4 },
  ],
  steps: [
    {
      label: 'Length',
      title: 'One emoji, four lengths',
      tag: 'problem',
      body: ['The string "😀" is 4 UTF-8 bytes, 2 UTF-16 code units, 1 code point and 1 grapheme.', 'JavaScript and Java report 2, Python reports 1.'],
      keyIdea: 'Truncating by bytes or UTF-16 units can cut a character in half.',
      frames: [{ state: lengths(), hold: 4400 }],
    },
    {
      label: 'UTF-8',
      title: 'One to four bytes',
      tag: 'concept',
      body: ['**Unicode** assigns each character a code point. **UTF-8** is how that number becomes bytes: 1 byte for ASCII, up to 4 for emoji.', 'ASCII text is unchanged, which made UTF-8 the default.'],
      keyIdea: 'Unicode is the character set, UTF-8 and UTF-16 are encodings.',
      frames: [{ state: sizes(), hold: 4400 }],
    },
    {
      label: 'Encoding',
      title: 'Encode the euro sign',
      tag: 'technique',
      body: ['U+20AC needs three bytes: `1110xxxx 10xxxxxx 10xxxxxx`. The code point bits fill the x positions.', 'The result is `E2 82 AC`, and the real `TextEncoder` agrees.'],
      keyIdea: 'Continuation bytes always start with 10, so boundaries can be found from any byte.',
      frames: [0, 1, 2].map((k) => ({ state: euro(k), hold: k === 2 ? 4000 : 2200 })),
    },
    {
      label: 'Normalise',
      title: 'Two ways to write é',
      tag: 'trade-off',
      body: ['`é` is one code point, or `e` plus a combining accent. They look identical and compare unequal.', 'Normalise to NFC before comparing or storing.'],
      keyIdea: 'MySQL needs utf8mb4 for emoji, its old utf8 holds only 3 bytes.',
      frames: [{ state: normal(), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Text encoding',
      tag: 'recap',
      body: [
        '- **Code point:** a number for each character.',
        '- **UTF-8:** 1 to 4 bytes, ASCII compatible.',
        '- **UTF-16:** 2 or 4 bytes, used by Java and JavaScript.',
        '- **Length:** bytes, units, code points and graphemes differ.',
        '- **Compare:** after normalisation.',
      ],
      keyIdea: 'Always know which length you mean.',
      frames: [{ state: lengths() }],
    },
  ],
});
