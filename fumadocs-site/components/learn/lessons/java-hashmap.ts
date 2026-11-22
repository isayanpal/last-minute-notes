import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import { indexFor, SimMap, spread, stringHash } from './shared/javaHash';

/*
 * Follows the Java notes on HashMap internals: hashCode, spread, (n - 1) & hash, chaining, resize at 0.75, treeify at 8.
 * Every bucket number comes from running Java's real hash arithmetic on the keys.
 */

const NAMES = ['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jon', 'Kim', 'Leo', 'Mia'];

const build = (n: number): SimMap => {
  const m = new SimMap();
  NAMES.slice(0, n).forEach((k) => m.put(k));
  return m;
};

// The first two names that share a bucket in the 16 bucket table.
const COLLISION = (() => {
  const seen = new Map<number, string>();
  for (const k of NAMES) {
    const i = indexFor(stringHash(k), 16);
    const other = seen.get(i);
    if (other) return { first: other, second: k, index: i, order: NAMES.indexOf(k) + 1 };
    seen.set(i, k);
  }
  throw new Error('no collision found in the demo keys');
})();

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const tableRows = (m: SimMap, mark?: { index: number; tone?: ItemState }) => {
  const label = `bucket`;
  return [
    { label, cells: m.table.map((b) => b[0] ?? ''), states: paint(m.capacity, (i) => (mark && mark.index === i ? mark.tone ?? 'active' : m.table[i].length ? 'done' : 'normal')), showIndex: true },
    { label: 'in chain', cells: m.table.map((b) => (b.length ? b.length : '')), states: paint(m.capacity, (i) => (m.table[i].length > 1 ? 'swap' : m.table[i].length ? 'visited' : 'dim')), showIndex: false },
  ];
};

// Step 1: scanning is O(n), hashing jumps straight to a bucket.
const FULL = build(12);
const scanState = (k: number | 'hash'): ArrayState => {
  const target = 'Leo';
  const at = NAMES.indexOf(target);
  if (k === 'hash') {
    const idx = indexFor(stringHash(target), FULL.capacity);
    return {
      rows: tableRows(FULL, { index: idx, tone: 'found' }).slice(0, 1).map((r) => ({ ...r, pointers: [{ i: idx, label: target, tone: 'ok' as const, up: false }] })),
      stats: [
        { label: 'Key', value: `"${target}"` },
        { label: 'Bucket', value: String(idx), tone: 'ok' },
        { label: 'Compares', value: String(FULL.table[idx].indexOf(target) + 1), tone: 'ok' },
      ],
      note: { text: 'hash the key, jump to its bucket, compare only what is there', tone: 'ok' },
    };
  }
  return {
    rows: [
      {
        label: 'scan',
        cells: NAMES.slice(0, 12),
        states: paint(12, (i) => (i === k ? (i === at ? 'found' : 'active') : i < k ? 'visited' : 'normal')),
        pointers: [{ i: Math.min(k, 11), label: 'i', up: false }],
        showIndex: false,
      },
    ],
    stats: [
      { label: 'Looking for', value: `"${target}"` },
      { label: 'Compares', value: String(Math.min(k, at) + 1), tone: 'bad' },
      { label: 'Cost', value: 'grows with N', tone: 'bad' },
    ],
    note: { text: 'a list has to compare key after key until it finds a match', tone: 'bad' },
  };
};

// Step 2: hashCode, spread, index.
const hashState = (phase: 1 | 2 | 3): ArrayState => {
  const key = 'Ann';
  const h = stringHash(key);
  const sp = spread(h);
  const idx = indexFor(h, 16);
  const m = new SimMap();
  if (phase === 3) m.put(key);
  return {
    rows: tableRows(m, phase === 3 ? { index: idx, tone: 'found' } : undefined).slice(0, 1).map((r) => ({ ...r, pointers: phase === 3 ? [{ i: idx, label: 'put', tone: 'ok' as const, up: false }] : [] })),
    stats: [
      { label: 'hashCode', value: String(h) },
      { label: 'Spread', value: phase >= 2 ? String(sp) : '-', tone: phase >= 2 ? 'ok' : 'neutral' },
      { label: '(n-1) & hash', value: phase === 3 ? String(idx) : '-', tone: phase === 3 ? 'ok' : 'neutral' },
    ],
    note: phase === 1 ? { text: '"Ann".hashCode() = 65*31*31 + 110*31 + 110', tone: 'accent' } : phase === 2 ? { text: 'h ^ (h >>> 16) mixes the high bits into the low ones', tone: 'accent' } : { text: `with 16 buckets the index is hash & 15, so "Ann" lands in bucket ${idx}`, tone: 'ok' },
  };
};

// Step 3: two keys, one bucket, a chain.
const chainState = (phase: 1 | 2): ArrayState => {
  const m = new SimMap();
  const upto = phase === 1 ? COLLISION.order - 1 : COLLISION.order;
  NAMES.slice(0, upto).forEach((k) => m.put(k));
  return {
    rows: tableRows(m, { index: COLLISION.index, tone: phase === 2 ? 'swap' : 'active' }),
    stats: [
      { label: 'Key', value: `"${phase === 1 ? COLLISION.first : COLLISION.second}"` },
      { label: 'Bucket', value: String(COLLISION.index), tone: 'ok' },
      { label: 'Chain length', value: phase === 2 ? '2' : '1', tone: phase === 2 ? 'bad' : 'ok' },
    ],
    note: phase === 1 ? { text: `"${COLLISION.first}" is the first key stored in bucket ${COLLISION.index}`, tone: 'accent' } : { text: `"${COLLISION.second}" also hashes to bucket ${COLLISION.index}: the bucket holds a chain, and equals() tells them apart`, tone: 'bad' },
  };
};

// Step 4: the 13th entry pushes size above 0.75 * 16 and doubles the table.
const before = build(12);
const after = build(13);
const resizeState = (phase: 0 | 1 | 2): ArrayState => {
  if (phase === 0) {
    return {
      rows: tableRows(before),
      stats: [
        { label: 'size', value: '12' },
        { label: 'Threshold', value: '16 x 0.75 = 12' },
        { label: 'Buckets', value: '16' },
      ],
      note: { text: '12 entries: the table is exactly at its limit', tone: 'accent' },
    };
  }
  if (phase === 1) {
    return {
      rows: tableRows(before, { index: indexFor(stringHash(NAMES[12]), 16), tone: 'bad' }),
      stats: [
        { label: 'size', value: '13', tone: 'bad' },
        { label: 'Threshold', value: '12' },
        { label: 'Action', value: 'resize', tone: 'bad' },
      ],
      note: { text: `putting "${NAMES[12]}" makes size 13, above 12: time to resize`, tone: 'bad' },
    };
  }
  const lo = after.table.slice(0, 16);
  const hi = after.table.slice(16);
  const moved = NAMES.slice(0, 13).filter((k) => indexFor(stringHash(k), 32) !== indexFor(stringHash(k), 16)).length;
  return {
    rows: [
      { label: 'new 0-15', cells: lo.map((b) => b[0] ?? ''), states: paint(16, (i) => (lo[i].length ? 'found' : 'normal')), showIndex: true },
      { label: 'new 16-31', cells: hi.map((b) => b[0] ?? ''), states: paint(16, (i) => (hi[i].length ? 'found' : 'normal')), showIndex: false },
    ],
    stats: [
      { label: 'Buckets', value: '32', tone: 'ok' },
      { label: 'Entries moved', value: String(moved), tone: 'ok' },
      { label: 'Every node', value: 'rehashed' },
    ],
    note: { text: 'the table doubles and each node is placed again with (32 - 1) & hash', tone: 'ok' },
  };
};

// Step 5: a long chain becomes a tree only when the table is big enough.
const treeDecision = (table: number) => (table >= 64 ? 'treeify' : 'resize');
const treeState = (table: 16 | 64): ArrayState => ({
  rows: [
    { label: 'chain', cells: [1, 2, 3, 4, 5, 6, 7, 8], states: paint(8, (i) => (i === 7 ? (table === 64 ? 'swap' : 'bad') : 'visited')), pointers: [{ i: 7, label: '8th node', tone: table === 64 ? 'violet' : 'bad', up: false }], showIndex: false },
    { label: 'table', cells: [16, 32, 64], states: paint(3, (i) => ((i === 0 && table === 16) || (i === 2 && table === 64) ? 'active' : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'Chain length', value: '8' },
    { label: 'Table size', value: String(table) },
    { label: 'Action', value: treeDecision(table), tone: table === 64 ? 'ok' : 'neutral' },
  ],
  note: table === 64 ? { text: 'table of 64 or more: the bucket becomes a red-black tree, O(log n)', tone: 'ok' } : { text: 'table under 64: the HashMap resizes instead of treeifying', tone: 'accent' },
});

export default defineLesson('array', {
  slug: 'java-hashmap',
  objectives: [
    { text: 'Why a hash jump beats scanning', step: 1 },
    { text: 'How hashCode becomes a bucket index', step: 2 },
    { text: 'What a collision and a chain are', step: 3 },
    { text: 'When the table resizes and what moves', step: 4 },
    { text: 'When a long chain becomes a tree', step: 5 },
  ],
  steps: [
    {
      label: 'Why hash',
      title: 'Jump, do not scan',
      tag: 'problem',
      body: ['Finding a key in a list means comparing it with each element. A `HashMap` instead computes where the key must live and looks only there.', 'The structure is an **array of buckets**.'],
      keyIdea: 'Hashing turns a search into an index calculation.',
      frames: [...[0, 3, 6, 9, 11].map((k) => ({ state: scanState(k), hold: 900 })), { state: scanState('hash'), hold: 3200 }],
    },
    {
      label: 'Index',
      title: 'hashCode to bucket',
      tag: 'concept',
      body: ['`put` takes `key.hashCode()`, spreads it with `h ^ (h >>> 16)`, then computes `(n - 1) & hash`.', 'The table length `n` is always a power of two, so that mask is a fast modulo.'],
      keyIdea: 'Spreading lets the high bits of the hash influence the bucket.',
      frames: [{ state: hashState(1), hold: 2200 }, { state: hashState(2), hold: 2200 }, { state: hashState(3), hold: 3200 }],
    },
    {
      label: 'Collision',
      title: 'Two keys, one bucket',
      tag: 'concept',
      body: [`Different keys can land in the same bucket. Here "${COLLISION.first}" and "${COLLISION.second}" both map to bucket ${COLLISION.index}.`, 'The bucket keeps a **chain**, and a lookup walks it comparing with `equals`.'],
      keyIdea: 'Equal hash codes do not mean equal keys, and `equals` makes the final decision.',
      frames: [{ state: chainState(1), hold: 2400 }, { state: chainState(2), hold: 3600 }],
    },
    {
      label: 'Resize',
      title: 'Double at 0.75',
      tag: 'technique',
      body: ['The default capacity is 16 and the load factor is 0.75. When `size` goes above 12, the table doubles to 32.', 'Every node is **rehashed** into the new table, so some keys change bucket.'],
      keyIdea: 'Pre-size the map when you know the expected count to avoid repeated resizes.',
      frames: [{ state: resizeState(0), hold: 2200 }, { state: resizeState(1), hold: 2600 }, { state: resizeState(2), hold: 3600 }],
    },
    {
      label: 'Treeify',
      title: 'Long chains become trees',
      tag: 'trade-off',
      body: ['When a bucket reaches **8 nodes** and the table has at least **64** buckets, it converts to a red-black tree, so the worst case drops from O(n) to O(log n).', 'If the table is smaller than 64, it resizes instead.'],
      keyIdea: 'A bad hashCode, like a constant, still hurts: one bucket takes everything.',
      frames: [{ state: treeState(16), hold: 3200 }, { state: treeState(64), hold: 3400 }],
    },
    {
      label: 'Recap',
      title: 'HashMap in one page',
      tag: 'recap',
      body: [
        '- **Structure:** an array of buckets, each a chain or tree.',
        '- **Index:** `(n - 1) & (h ^ (h >>> 16))`.',
        '- **Collision:** same bucket, `equals` picks the key.',
        '- **Resize:** doubles when size exceeds capacity x 0.75, rehashing every node.',
        '- **Treeify:** 8 nodes and a table of 64 or more.',
      ],
      keyIdea: 'Lookup goes hash to bucket first, then `equals` inside the bucket.',
      frames: [{ state: resizeState(2) }],
    },
  ],
});
