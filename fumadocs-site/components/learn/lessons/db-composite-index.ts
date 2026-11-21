import { defineLesson } from '../define';
import type { ArrayRow, ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * A composite index is a sorted list of entries. Each query below is run against that list:
 * the index can seek only over the leading predicates, everything read inside the seek range counts as an entry read.
 * Entries are shown as "a" then "b", for example 2C is a = 2, b = C.
 */

type Entry = { a: number; b: string };
const AS = [1, 2, 3];
const BS = ['A', 'B', 'C', 'D'];
const ALL: Entry[] = AS.flatMap((a) => BS.map((b) => ({ a, b })));
const byAB = [...ALL].sort((x, y) => x.a - y.a || x.b.localeCompare(y.b));
const byBA = [...ALL].sort((x, y) => x.b.localeCompare(y.b) || x.a - y.a);
const label = (e: Entry, order: 'ab' | 'ba') => (order === 'ab' ? `${e.a}${e.b}` : `${e.b}${e.a}`);

type Run = { read: number[]; match: number[] };
/** `lead` is the part of the predicate the index can seek on, `full` is the whole predicate. null lead means a full scan. */
function run(list: Entry[], lead: ((e: Entry) => boolean) | null, full: (e: Entry) => boolean): Run {
  const idx = list.map((_, i) => i);
  const read = lead ? idx.slice(idx.findIndex((i) => lead(list[i])), idx.map((i) => lead(list[i])).lastIndexOf(true) + 1) : idx;
  return { read, match: idx.filter((i) => full(list[i])) };
}
const states = (n: number, r: Run): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, r.match.includes(i) ? 'found' : r.read.includes(i) ? 'visited' : 'dim'])) as Record<number, ItemState>;
const row = (list: Entry[], order: 'ab' | 'ba', r: Run, name: string): ArrayRow => ({ label: name, cells: list.map((e) => label(e, order)), states: states(list.length, r), showIndex: false });
const stats = (r: Run, verdict: string, tone: 'ok' | 'bad'): ArrayState['stats'] => [
  { label: 'Entries read', value: `${r.read.length} of ${ALL.length}`, tone: r.read.length > r.match.length * 2 ? 'bad' : 'ok' },
  { label: 'Matches', value: String(r.match.length) },
  { label: 'Index use', value: verdict, tone },
];

// Step 1: without an index every row is read. With one, a sorted structure narrows the range.
const noIndex = run(byAB, null, (e) => e.a === 2);
const seek = run(byAB, (e) => e.a === 2, (e) => e.a === 2);
const scanState: ArrayState = { rows: [row(byAB, 'ab', noIndex, 'full scan')], stats: stats(noIndex, 'none', 'bad'), note: { text: 'no index: every entry is examined to find a = 2', tone: 'bad' } };
const seekState: ArrayState = { rows: [row(byAB, 'ab', seek, 'index seek')], stats: stats(seek, 'seek', 'ok'), note: { text: 'sorted by a: jump to the first 2, stop after the last', tone: 'ok' } };

// Step 2: composite order. Sorted by a, then b within each a.
const sorted: ArrayState = {
  rows: [row(byAB, 'ab', { read: byAB.map((_, i) => i), match: [] }, 'index (a, b)')],
  stats: [{ label: 'Sorted by', value: 'a, then b' }, { label: 'Same a', value: 'b in order' }, { label: 'Entries', value: String(ALL.length) }],
  note: { text: 'all 1s, then all 2s, each group ordered by b', tone: 'accent' },
};

// Step 3: leftmost prefix rule.
const prefix = (q: 'a' | 'ab' | 'b'): ArrayState => {
  const r = q === 'a' ? run(byAB, (e) => e.a === 2, (e) => e.a === 2) : q === 'ab' ? run(byAB, (e) => e.a === 2 && e.b === 'C', (e) => e.a === 2 && e.b === 'C') : run(byAB, null, (e) => e.b === 'C');
  const title = q === 'a' ? 'WHERE a = 2' : q === 'ab' ? 'WHERE a = 2 AND b = C' : 'WHERE b = C';
  return {
    rows: [row(byAB, 'ab', r, 'index (a, b)')],
    stats: stats(r, q === 'b' ? 'scan' : 'seek', q === 'b' ? 'bad' : 'ok'),
    note: { text: `${title}: ${q === 'b' ? 'matches are scattered, no leading column to seek on' : 'a leftmost prefix, one contiguous range'}`, tone: q === 'b' ? 'bad' : 'ok' },
  };
};

// Step 4: equality first, then range. The same query on two column orders.
const q4 = (e: Entry) => e.b === 'C' && e.a >= 2;
const badOrder = run(byAB, (e) => e.a >= 2, q4);
const goodOrder = run(byBA, (e) => e.b === 'C' && e.a >= 2, q4);
const order = (good: boolean): ArrayState => ({
  rows: [good ? row(byBA, 'ba', goodOrder, 'index (b, a)') : row(byAB, 'ab', badOrder, 'index (a, b)')],
  stats: [
    { label: 'Query', value: 'b = C, a >= 2' },
    { label: 'Entries read', value: `${(good ? goodOrder : badOrder).read.length} of ${ALL.length}`, tone: good ? 'ok' : 'bad' },
    { label: 'Equality col', value: good ? 'first' : 'second', tone: good ? 'ok' : 'bad' },
  ],
  note: good ? { text: 'equality first: the seek is exact, the range sits inside it', tone: 'ok' } : { text: 'after a range on a, b cannot narrow the seek', tone: 'bad' },
});

// Step 5: a function on the indexed column. The index order is the raw order, not the lower() order.
const EMAILS = ['Al', 'bo', 'Cy', 'dee', 'Ed', 'fay'];
const rawSorted = [...EMAILS].sort();
const lowerOfRaw = rawSorted.map((e) => e.toLowerCase());
const lowerSorted = [...EMAILS.map((e) => e.toLowerCase())].sort();
const inOrder = (xs: string[]) => xs.map((v, i) => i === 0 || xs[i - 1] <= v);
const fn = (kind: 'raw' | 'expr'): ArrayState => {
  const rows: ArrayRow[] =
    kind === 'raw'
      ? [
          { label: 'raw index', cells: rawSorted, states: Object.fromEntries(rawSorted.map((_, i) => [i, 'active'])) as Record<number, ItemState>, showIndex: false },
          { label: 'lower(email)', cells: lowerOfRaw, states: Object.fromEntries(inOrder(lowerOfRaw).map((ok, i) => [i, ok ? 'found' : 'bad'])) as Record<number, ItemState>, showIndex: false },
        ]
      : [{ label: 'lower index', cells: lowerSorted, states: Object.fromEntries(lowerSorted.map((_, i) => [i, 'found'])) as Record<number, ItemState>, showIndex: false }];
  const sortedOk = inOrder(lowerOfRaw).every(Boolean);
  return {
    rows,
    stats: [
      { label: 'Predicate', value: "lower()='bo'" },
      { label: 'Raw order', value: sortedOk ? 'same' : 'differs', tone: kind === 'expr' ? 'ok' : sortedOk ? 'ok' : 'bad' },
      { label: 'Plan', value: kind === 'raw' ? 'scan all' : 'seek', tone: kind === 'raw' ? 'bad' : 'ok' },
    ],
    note: kind === 'raw' ? { text: 'uppercase sorts before lowercase, so lower() is not in index order', tone: 'bad' } : { text: 'an expression index stores lower(email) in sorted order', tone: 'ok' },
  };
};

// Step 6: covering index. No table fetch when the index holds every needed column.
const fetches = (covering: boolean): ArrayState => {
  const hits = [0, 1, 2];
  return {
    rows: [
      { label: covering ? 'covering' : 'index (user)', cells: ['u7', 'u7', 'u7'], states: Object.fromEntries(hits.map((i) => [i, 'found'])) as Record<number, ItemState>, showIndex: false },
      { label: 'table fetch', cells: covering ? ['-', '-', '-'] : ['row', 'row', 'row'], states: Object.fromEntries(hits.map((i) => [i, covering ? 'dim' : 'bad'])) as Record<number, ItemState>, showIndex: false },
    ],
    stats: [
      { label: 'Index hits', value: '3' },
      { label: 'Table fetches', value: covering ? '0' : '3', tone: covering ? 'ok' : 'bad' },
      { label: 'Plan', value: covering ? 'index-only' : 'index + heap', tone: covering ? 'ok' : 'neutral' },
    ],
    note: covering ? { text: 'INCLUDE (total) keeps the payload in the leaf: no table access', tone: 'ok' } : { text: 'each index hit costs a random table lookup', tone: 'accent' },
  };
};

export default defineLesson('array', {
  slug: 'db-composite-index',
  objectives: [
    { text: 'How a sorted index turns a scan into a seek', step: 1 },
    { text: 'What a composite index is sorted by', step: 2 },
    { text: 'The leftmost prefix rule, tested on real entries', step: 3 },
    { text: 'Why equality columns go before range columns', step: 4 },
    { text: 'Why a function on a column defeats the index', step: 5 },
    { text: 'How a covering index skips the table', step: 6 },
  ],
  steps: [
    {
      label: 'Scan, seek',
      title: 'Sorted entries narrow the search',
      tag: 'problem',
      body: ['Without an index the engine **scans** every row. A sorted index lets it **seek** to the first match and stop after the last.', 'Below, 12 index entries and the query `a = 2`.'],
      keyIdea: 'Green are matches, blue are entries the engine had to read, dim ones it never touched.',
      frames: [{ state: scanState, hold: 2200 }, { state: seekState, hold: 3000 }],
    },
    {
      label: 'Composite',
      title: 'Sorted by a, then b',
      tag: 'concept',
      body: ['A composite index on `(a, b)` sorts by `a` first and by `b` within each `a`.', 'That order decides which queries can seek.'],
      keyIdea: 'One composite index usually beats several single-column indexes.',
      frames: [{ state: sorted, hold: 3000 }],
    },
    {
      label: 'Leftmost prefix',
      title: 'Which queries can seek',
      tag: 'technique',
      body: ['`a` alone and `a, b` use the index: their matches form one contiguous range.', '`b` alone cannot: the 3 matches are scattered across all three `a` groups, so the engine reads every entry.'],
      keyIdea: 'The index serves a leftmost prefix of its columns, and `b` alone is not one.',
      frames: [{ state: prefix('a'), hold: 2200 }, { state: prefix('ab'), hold: 2200 }, { state: prefix('b'), hold: 3200 }],
    },
    {
      label: 'Column order',
      title: 'Equality first, range last',
      tag: 'technique',
      body: ['For `b = C AND a >= 2`, an index on `(a, b)` must read everything from the first `a >= 2`, because after a range the next column cannot narrow the seek.', 'An index on `(b, a)` seeks to `C` exactly, then applies the range inside it.'],
      keyIdea: 'Rule of thumb: equality columns, then the sort column, then range columns.',
      frames: [{ state: order(false), hold: 3000 }, { state: order(true), hold: 3200 }],
    },
    {
      label: 'Sargable',
      title: 'Functions hide the order',
      tag: 'trade-off',
      body: ['The index is sorted by the raw value. `lower(email)` is not in that order (uppercase sorts first), so the engine cannot binary search and falls back to scanning the index.', 'Fix it with an **expression index**, or rewrite the predicate so the column stays bare.'],
      keyIdea: 'Same for `price * 1.2 > 100`: move the math to the constant side. Leading wildcards and implicit casts fail the same way.',
      frames: [{ state: fn('raw'), hold: 3200 }, { state: fn('expr'), hold: 3000 }],
    },
    {
      label: 'Covering',
      title: 'Never touch the table',
      tag: 'technique',
      body: ['If the index holds every column the query needs, the engine answers from the index alone: an **index-only scan**.', 'In PostgreSQL and SQL Server use `INCLUDE (total)`. In MySQL add the column to the key.'],
      keyIdea: 'Avoid `SELECT *`: it blocks index-only scans and moves more data.',
      frames: [{ state: fetches(false), hold: 2600 }, { state: fetches(true), hold: 3000 }],
    },
    {
      label: 'Recap',
      title: 'Designing an index',
      tag: 'recap',
      body: [
        '- **Seek** needs sorted order: leftmost prefix of a composite index.',
        '- **Order columns:** equality, then sort, then range.',
        '- **Keep columns bare:** no functions, math or leading wildcards on indexed columns.',
        '- **Cover** hot queries with `INCLUDE`.',
        '- **Verify** with `EXPLAIN`: look for `SEARCH` with a condition, not just an index name.',
      ],
      keyIdea: 'Every index slows writes. Add the ones real queries need and drop the unused ones.',
      frames: [{ state: order(true) }],
    },
  ],
});
