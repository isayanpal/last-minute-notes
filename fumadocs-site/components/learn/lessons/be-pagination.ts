import { defineLesson } from '../define';
import type { ArrayRow, ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Every page below comes from running the real query on the real list, so duplicates, gaps and skipped rows are not drawn by hand.
 * The list is newest first. Page size is 4, as in the notes example.
 */

const LIMIT = 4;
const st = (m: Record<number, ItemState>) => m;
const paint = (n: number, f: (i: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, f(i)])) as Record<number, ItemState>;

// Step 1: why paginate at all.
const BASE = Array.from({ length: 11 }, (_, i) => 11 - i);
const unbounded = (bounded: boolean): ArrayState => ({
  rows: [
    {
      label: 'orders',
      cells: BASE,
      states: paint(BASE.length, (i) => (bounded && i >= LIMIT ? 'dim' : 'active')),
      window: bounded ? { from: 0, to: LIMIT - 1, label: `limit=${LIMIT}`, tone: 'ok' } : undefined,
    },
  ],
  stats: [
    { label: 'Returned', value: bounded ? `${LIMIT} rows` : 'every row', tone: bounded ? 'ok' : 'bad' },
    { label: 'Max page size', value: bounded ? 'enforced' : 'none', tone: bounded ? 'ok' : 'bad' },
    { label: 'Filters', value: 'allowlisted' },
  ],
  note: bounded ? { text: 'always paginate with a maximum page size', tone: 'ok' } : { text: 'one request could return a million rows', tone: 'bad' },
});

// Step 2: offset cost. The database reads offset + limit rows and throws offset away.
const offsetCost = (page: number): ArrayState => {
  const offset = (page - 1) * LIMIT;
  const read = Math.min(offset + LIMIT, BASE.length);
  return {
    rows: [
      {
        label: 'scanned',
        cells: BASE,
        states: paint(BASE.length, (i) => (i < offset ? 'bad' : i < read ? 'found' : 'dim')),
        window: { from: offset, to: read - 1, label: `offset=${offset}`, tone: 'ok' },
      },
    ],
    stats: [
      { label: 'Rows read', value: String(read), tone: read > 8 ? 'bad' : 'neutral' },
      { label: 'Discarded', value: String(offset), tone: offset ? 'bad' : 'neutral' },
      { label: 'Returned', value: String(read - offset), tone: 'ok' },
    ],
    note: { text: page === 1 ? 'page 1 is cheap' : 'the database reads and drops every earlier row, slower at depth', tone: page === 1 ? 'ok' : 'bad' },
  };
};

// Step 3: data changes between page requests. Offset shifts, so rows repeat.
const offsetPage = (list: number[], offset: number) => list.slice(offset, offset + LIMIT);
const afterInsert = [12, ...BASE];
const drift = (phase: 0 | 1 | 2): ArrayState => {
  const list = phase === 0 ? BASE : afterInsert;
  const p1 = offsetPage(BASE, 0);
  const p2 = offsetPage(list, LIMIT);
  const dup = p2.filter((id) => p1.includes(id));
  const rows: ArrayRow[] = [
    {
      label: 'orders',
      cells: list,
      states: paint(list.length, (i) => {
        if (phase === 0) return i < LIMIT ? 'found' : 'normal';
        if (phase === 1) return list[i] === 12 ? 'swap' : i < LIMIT + 1 ? 'found' : 'normal';
        return i >= LIMIT && i < LIMIT * 2 ? (dup.includes(list[i]) ? 'bad' : 'visited') : 'dim';
      }),
      window: phase === 2 ? { from: LIMIT, to: LIMIT * 2 - 1, label: `offset=${LIMIT}`, tone: dup.length ? 'bad' : 'ok' } : phase === 0 ? { from: 0, to: LIMIT - 1, label: 'page 1', tone: 'ok' } : undefined,
    },
  ];
  return {
    rows,
    stats: [
      { label: 'Page 1', value: p1.join(' ') },
      { label: 'Page 2', value: phase === 2 ? p2.join(' ') : '?', tone: dup.length && phase === 2 ? 'bad' : 'neutral' },
      { label: 'Duplicates', value: phase === 2 ? dup.join(', ') : '-', tone: dup.length && phase === 2 ? 'bad' : 'neutral' },
    ],
    note:
      phase === 0
        ? { text: 'client reads page 1', tone: 'accent' }
        : phase === 1
          ? { text: 'a new order 12 arrives at the top', tone: 'accent' }
          : { text: `offset ${LIMIT} now lands on ${dup.join(', ')} again: a delete would cause a gap`, tone: 'bad' },
  };
};

// Step 4: keyset. "after id 9" does not care what was inserted above.
const keyset = (phase: 0 | 1 | 2): ArrayState => {
  const list = phase === 0 ? BASE : afterInsert;
  const p1 = BASE.slice(0, LIMIT);
  const last = p1[p1.length - 1];
  const p2 = list.filter((id) => id < last).slice(0, LIMIT);
  const cursorAt = list.indexOf(last);
  return {
    rows: [
      {
        label: 'orders',
        cells: list,
        states: paint(list.length, (i) => {
          if (phase === 0) return i < LIMIT ? 'found' : 'normal';
          if (phase === 1) return list[i] === 12 ? 'swap' : list[i] >= last ? 'found' : 'normal';
          return p2.includes(list[i]) ? 'found' : list[i] >= last ? 'dim' : 'normal';
        }),
        pointers: phase >= 1 ? [{ i: cursorAt, label: `cursor ${last}`, tone: 'accent', up: true }] : undefined,
      },
    ],
    stats: [
      { label: 'Page 1', value: p1.join(' ') },
      { label: 'Page 2', value: phase === 2 ? p2.join(' ') : '?', tone: phase === 2 ? 'ok' : 'neutral' },
      { label: 'Duplicates', value: phase === 2 ? '0' : '-', tone: phase === 2 ? 'ok' : 'neutral' },
    ],
    note:
      phase === 0
        ? { text: 'client reads page 1 and keeps the last id as the cursor', tone: 'accent' }
        : phase === 1
          ? { text: `order 12 arrives, the cursor still points at ${last}`, tone: 'accent' }
          : { text: `WHERE id < ${last} LIMIT 4: stable and fast at any depth`, tone: 'ok' },
  };
};

// Step 5: a non-unique sort key needs a tiebreaker. 11 posts, several sharing a day.
const POSTS = Array.from({ length: 11 }, (_, i) => ({ id: i + 1, day: 20 - Math.floor(i / 3) }));
const SORTED = [...POSTS].sort((a, b) => b.day - a.day || b.id - a.id);
const pages = (composite: boolean) => {
  const out: number[][] = [];
  let cursor: { day: number; id: number } | null = null;
  while (out.length < 6) {
    const rest: typeof SORTED = cursor
      ? SORTED.filter((p) => (composite ? p.day < cursor!.day || (p.day === cursor!.day && p.id < cursor!.id) : p.day < cursor!.day))
      : SORTED;
    if (!rest.length) break;
    const page = rest.slice(0, LIMIT);
    out.push(page.map((p) => p.id));
    const last = page[page.length - 1];
    cursor = { day: last.day, id: last.id };
  }
  return out;
};
const tie = (composite: boolean): ArrayState => {
  const seen = pages(composite).flat();
  const missing = SORTED.filter((p) => !seen.includes(p.id)).map((p) => p.id);
  return {
    rows: [
      { label: 'day (May)', cells: SORTED.map((p) => p.day), states: paint(SORTED.length, (i) => (seen.includes(SORTED[i].id) ? 'found' : 'bad')) },
      { label: 'id', cells: SORTED.map((p) => p.id), states: paint(SORTED.length, (i) => (seen.includes(SORTED[i].id) ? 'found' : 'bad')), showIndex: false },
    ],
    stats: [
      { label: 'Sort key', value: composite ? 'day, id' : 'day only', tone: composite ? 'ok' : 'bad' },
      { label: 'Rows seen', value: `${seen.length} of ${SORTED.length}`, tone: composite ? 'ok' : 'bad' },
      { label: 'Skipped', value: missing.length ? missing.join(', ') : 'none', tone: missing.length ? 'bad' : 'ok' },
    ],
    note: composite ? { text: 'unique tiebreaker: every row appears exactly once', tone: 'ok' } : { text: 'rows sharing a day with the cursor row are skipped', tone: 'bad' },
  };
};

// Step 6: the cursor is opaque and signed.
const cursor = (forged: boolean): ArrayState => ({
  rows: [
    {
      label: 'cursor',
      cells: ['data', '.', forged ? 'sig?' : 'HMAC'],
      states: st({ 0: 'active', 1: 'dim', 2: forged ? 'bad' : 'found' }),
      showIndex: false,
    },
  ],
  panels: [
    {
      title: 'cursor',
      kind: 'list',
      items: ['day + id', 'signed (HMAC)', 'opaque to client', forged ? 'tag mismatch' : 'tag valid'],
      highlight: forged ? 3 : 1,
    },
  ],
  stats: [
    { label: 'Client may', value: 'pass it back' },
    { label: 'Forged', value: forged ? 'invalid cursor' : 'tamper fails', tone: forged ? 'bad' : 'neutral' },
    { label: 'Benefit', value: 'free to change' },
  ],
  note: forged ? { text: 'edited cursor fails the HMAC check, no expensive query runs', tone: 'bad' } : { text: 'clients must not build or read cursors', tone: 'accent' },
});

export default defineLesson('array', {
  slug: 'be-pagination',
  objectives: [
    { text: 'Why every collection endpoint needs a page limit', step: 1 },
    { text: 'The hidden cost of deep offset pages', step: 2 },
    { text: 'How inserts and deletes make offset pages repeat or skip', step: 3 },
    { text: 'How keyset cursors stay stable and fast', step: 4 },
    { text: 'Why the sort needs a unique tiebreaker', step: 5 },
    { text: 'Why cursors are opaque and signed', step: 6 },
  ],
  steps: [
    {
      label: 'Limits',
      title: 'Never return everything',
      tag: 'problem',
      body: ['A collection endpoint without a limit can return a million rows in one request.', '**Always paginate**, enforce a maximum page size, and allowlist filter and sort fields backed by indexes.'],
      keyIdea: 'The page limit protects the server, the network and the client at once.',
      frames: [{ state: unbounded(false), hold: 2000 }, { state: unbounded(true), hold: 2600 }],
    },
    {
      label: 'Offset',
      title: 'Offset gets slower with depth',
      tag: 'concept',
      body: ['`?offset=40&limit=20` is simple and allows jumping to page N.', 'But the database must read the skipped rows and then discard them. Page 3 reads three pages of rows to return one.'],
      keyIdea: 'Offset is fine for small, stable lists. It degrades as the offset grows.',
      frames: [{ state: offsetCost(1), hold: 1700 }, { state: offsetCost(2), hold: 1700 }, { state: offsetCost(3), hold: 2600 }],
    },
    {
      label: 'Drift',
      title: 'Offset pages shift under writes',
      tag: 'trade-off',
      body: ['Between two requests, a new row lands at the top. Offset 4 now points one row earlier, so the client sees a row **twice**.', 'A delete would shift the other way and the client would **miss** a row.'],
      keyIdea: 'Offset counts positions, and positions move when data changes.',
      frames: [{ state: drift(0), hold: 1800 }, { state: drift(1), hold: 1800 }, { state: drift(2), hold: 3000 }],
    },
    {
      label: 'Keyset',
      title: 'Cursor: continue after this row',
      tag: 'technique',
      body: ['Keyset pagination asks for rows **after the last one seen**: `WHERE id < 8 LIMIT 4` on an indexed key.', 'Inserts above the cursor change nothing, and the cost is the same on page 1 and page 1000.'],
      keyIdea: 'Trade-off: no jumping to page N, and the sort must be deterministic.',
      frames: [{ state: keyset(0), hold: 1800 }, { state: keyset(1), hold: 1800 }, { state: keyset(2), hold: 3000 }],
    },
    {
      label: 'Tiebreaker',
      title: 'A unique sort key',
      tag: 'technique',
      body: ['If many rows share a `created_at`, a cursor on the date alone skips the rest of that day.', 'Sort by `(created_at, id)` and compare both, so the cursor names exactly one row.'],
      keyIdea: 'Fetch one extra row to know whether another page exists without a `COUNT(*)`.',
      frames: [{ state: tie(false), hold: 2800 }, { state: tie(true), hold: 3000 }],
    },
    {
      label: 'Cursor',
      title: 'Opaque and tamper-proof',
      tag: 'in practice',
      body: ['Return `next_cursor` as an opaque string. Clients pass it back and never build or parse it, so you can change the implementation.', 'Sign it with an HMAC so a client cannot forge a cursor to reach other data or trigger expensive queries.'],
      keyIdea: 'Return a total count only if you must: `COUNT(*)` on a big table is slow.',
      frames: [{ state: cursor(false), hold: 2200 }, { state: cursor(true), hold: 2800 }],
    },
    {
      label: 'Recap',
      title: 'Choosing a pagination style',
      tag: 'recap',
      body: [
        '- **Always:** a max page size and allowlisted filters.',
        '- **Offset:** simple, jump to page N, slow deep, drifts under writes.',
        '- **Keyset:** fast at any depth, stable, no random access.',
        '- **Sort:** unique tiebreaker such as `(created_at, id)`.',
        '- **Cursor:** opaque, signed, with a `has_more` flag.',
      ],
      keyIdea: 'Feeds and large tables want cursors. Small admin tables are fine with offset.',
      frames: [{ state: keyset(2) }],
    },
  ],
});
