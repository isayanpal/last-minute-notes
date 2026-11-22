import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on the address breakdown of a 32 KB, 8-way set-associative cache with 64-byte lines and 32-bit
 * addresses: 512 lines, 64 sets, 6 offset bits, 6 index bits, 20 tag bits. A real set-associative LRU cache model then runs addresses
 * that are a multiple of 4 KB apart, which all map to one set, and counts the hits.
 */

const SIZE = 32 * 1024;
const LINE = 64;
const ADDR_BITS = 32;
const log2 = (n: number) => Math.log2(n);

const geometry = (ways: number) => {
  const lines = SIZE / LINE;
  const sets = lines / ways;
  const offset = log2(LINE);
  const index = log2(sets);
  return { lines, sets, offset, index, tag: ADDR_BITS - index - offset, ways };
};
const SET8 = geometry(8);
const DIRECT = geometry(1);
const FULL = geometry(SIZE / LINE);

const setOf = (addr: number, g = SET8) => (addr >> g.offset) & (g.sets - 1);

/** A tiny LRU set-associative cache: counts hits and misses for a stream of addresses. */
class Cache {
  sets: number[][];
  hits = 0;
  misses = 0;
  constructor(private g: ReturnType<typeof geometry>) {
    this.sets = Array.from({ length: g.sets }, () => []);
  }
  access(addr: number) {
    const set = this.sets[setOf(addr, this.g)];
    const block = addr >> this.g.offset;
    const i = set.indexOf(block);
    if (i >= 0) {
      set.splice(i, 1);
      set.push(block);
      this.hits++;
      return 'hit';
    }
    this.misses++;
    if (set.length === this.g.ways) set.shift(); // evict the least recently used line
    set.push(block);
    return 'miss';
  }
}
const STRIDE = SET8.sets * LINE; // 4 KB: addresses this far apart share a set
const run = (n: number, passes = 3) => {
  const c = new Cache(SET8);
  const second: string[] = [];
  for (let p = 0; p < passes; p++) for (let k = 0; k < n; k++) {
    const r = c.access(k * STRIDE);
    if (p === 1) second.push(r);
  }
  return { second, hits: c.hits, misses: c.misses, sets: Array.from({ length: n }, (_, k) => setOf(k * STRIDE)) };
};
const EIGHT = run(8);
const NINE = run(9);

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const counts = (): ArrayState => ({
  rows: [{ label: 'cache', cells: [32, 64, 512, 64], pointers: [{ i: 0, label: 'KB' }, { i: 1, label: 'line' }, { i: 2, label: 'lines' }, { i: 3, label: 'sets' }], states: paint(4, (i) => (i >= 2 ? 'found' : 'visited')), showIndex: false }],
  stats: [
    { label: 'Lines', value: String(SET8.lines), hint: '32 KB / 64 B' },
    { label: 'Ways', value: String(SET8.ways) },
    { label: 'Sets', value: `${SET8.lines} / ${SET8.ways} = ${SET8.sets}`, tone: 'ok' },
  ],
  note: { text: 'a 32 KB cache of 64-byte lines holds 512 lines, grouped into 64 sets of 8 ways', tone: 'accent' },
});

const bitsView = (g: ReturnType<typeof geometry>, label: string, note: string): ArrayState => ({
  rows: [{ label: 'address', cells: [g.tag, g.index, g.offset], pointers: [{ i: 0, label: 'tag' }, { i: 1, label: 'index' }, { i: 2, label: 'offset' }], states: { 0: 'visited', 1: 'swap', 2: 'found' }, showIndex: false }],
  stats: [
    { label: 'Organisation', value: label },
    { label: 'Tag, index', value: `${g.tag}, ${g.index} bits` },
    { label: 'Offset', value: `${g.offset} bits`, tone: 'ok' },
  ],
  note: { text: note, tone: 'ok' },
});

const conflict = (e: ReturnType<typeof run>, n: number): ArrayState => {
  const misses = e.second.filter((x) => x === 'miss').length;
  return {
    rows: [
      { label: 'address k', cells: e.sets.map((_, k) => k), states: paint(n, () => 'normal'), showIndex: false },
      { label: 'set', cells: e.sets, states: paint(n, () => 'swap'), showIndex: false },
      { label: '2nd pass', cells: e.second, states: paint(n, (i) => (e.second[i] === 'hit' ? 'found' : 'bad')), showIndex: false },
    ],
    stats: [
      { label: 'Stride', value: `${STRIDE / 1024} KB` },
      { label: 'Lines in set', value: `${n} of ${SET8.ways}`, tone: n > SET8.ways ? 'bad' : 'ok' },
      { label: '2nd pass misses', value: `${misses} of ${n}`, tone: misses ? 'bad' : 'ok' },
    ],
    note: n > SET8.ways ? { text: `${n} lines fight over ${SET8.ways} ways: each access evicts the line needed next, so every access misses`, tone: 'bad' } : { text: `${n} lines fit in the set's ${SET8.ways} ways, so the second pass hits every time`, tone: 'ok' },
  };
};

export default defineLesson('array', {
  slug: 'cf-cache-address',
  objectives: [
    { text: 'How lines and sets follow from the cache size', step: 1 },
    { text: 'How an address splits into tag, index and offset', step: 2 },
    { text: 'How direct-mapped and fully associative differ', step: 3 },
    { text: 'Why a 4 KB stride thrashes one set', step: 4 },
  ],
  steps: [
    {
      label: 'Geometry',
      title: 'Lines and sets',
      tag: 'problem',
      body: ['Take a **32 KB, 8-way** cache with **64-byte lines** and 32-bit addresses.', 'It has 32 KB / 64 B = 512 lines, grouped into 512 / 8 = 64 sets.'],
      keyIdea: 'A block can go anywhere within one set, and only that set is searched.',
      frames: [{ state: counts(), hold: 4200 }],
    },
    {
      label: 'Bit fields',
      title: 'Tag, index, offset',
      tag: 'concept',
      body: ['The **offset** picks the byte in the line: log2(64) = 6 bits. The **index** picks the set: log2(64) = 6 bits.', 'The remaining 32 - 6 - 6 = 20 bits are the **tag**.'],
      keyIdea: 'A lookup uses the index to pick a set, then compares the tag in all 8 ways in parallel.',
      frames: [{ state: bitsView(SET8, '8-way', 'a lookup indexes one of 64 sets, compares 20 tag bits, then uses 6 offset bits'), hold: 4400 }],
    },
    {
      label: 'Variants',
      title: 'Direct-mapped and fully associative',
      tag: 'technique',
      body: ['**Direct-mapped** has 512 sets, so 9 index bits and 17 tag bits. **Fully associative** has one set, so 0 index bits and 26 tag bits.', 'More associativity means fewer conflicts but more tags to compare.'],
      keyIdea: 'Fully associative is only practical for tiny caches like TLBs.',
      frames: [{ state: bitsView(DIRECT, 'direct', 'one line per set: 9 index bits and 17 tag bits'), hold: 3400 }, { state: bitsView(FULL, 'fully assoc.', 'no index at all: 26 tag bits, every tag is compared'), hold: 3600 }],
    },
    {
      label: 'Conflicts',
      title: 'A 4 KB stride',
      tag: 'trade-off',
      body: ['Addresses that differ by sets x line size = 64 x 64 = **4 KB** all map to the same set.', 'Eight such lines fit the 8 ways. A ninth makes the set thrash.'],
      keyIdea: 'Walking a column of a matrix with 4 KB rows uses one set only.',
      frames: [{ state: conflict(EIGHT, 8), hold: 3800 }, { state: conflict(NINE, 9), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Cache addressing',
      tag: 'recap',
      body: [
        '- **Lines:** size / line size.',
        '- **Sets:** lines / ways.',
        '- **Offset, index, tag:** 6, 6 and 20 bits here.',
        '- **Conflict misses:** too many hot blocks in one set.',
        '- **Fixes:** higher associativity, padding, a different layout.',
      ],
      keyIdea: 'Powers of two strides are the classic way to hit conflict misses.',
      frames: [{ state: bitsView(SET8, '8-way', 'tag 20, index 6, offset 6: the layout of the notes\' example') }],
    },
  ],
});
