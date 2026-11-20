import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';
import type { Frame, Note, Stat } from '../types';

/*
 * Each anomaly is a short schedule: two transaction lanes plus a lane for the committed value.
 * Bars appear one per frame in time order, so the interleaving plays out left to right.
 */

type Placed = [lane: number, bar: TimelineBar];
type Beat = { show: number; note?: Note; stats?: Stat[]; markers?: TimelineState['markers']; hold?: number };

const AXIS = { from: 0, to: 12, ticks: [] as number[] };

function schedule(lanes: string[], bars: Placed[], beats: Beat[]): Frame<TimelineState>[] {
  let stats: Stat[] | undefined;
  return beats.map((b) => {
    stats = b.stats ?? stats;
    const shown = bars.slice(0, b.show);
    return {
      hold: b.hold ?? 1300,
      state: {
        ...AXIS,
        lanes: lanes.map((label, li) => ({ label, bars: shown.filter(([l]) => l === li).map(([, bar]) => bar) })),
        markers: b.markers,
        note: b.note,
        stats,
      },
    };
  });
}

const bar = (id: string, from: number, to: number, label: string, tone: TimelineBar['tone'] = 'info', state?: TimelineBar['state']): TimelineBar => ({ id, from, to, label, tone, state });
const TX = ['T1', 'T2', 'committed'];

// ---------- Dirty read ----------
const DIRTY: Placed[] = [
  [2, bar('c0', 0, 12, 'x = 10', 'neutral')],
  [0, bar('w', 0.3, 3.3, 'write x = 20', 'data')],
  [1, bar('r', 3.6, 6.6, 'reads x = 20', 'bad', 'bad')],
  [0, bar('ab', 6.9, 9.9, 'ROLLBACK', 'bad', 'bad')],
];
const DIRTY_FIXED: Placed[] = [...DIRTY.slice(0, 2), [1, bar('r', 3.6, 6.6, 'reads x = 10', 'ok')], DIRTY[3]];

// ---------- Non-repeatable read ----------
const NONREP: Placed[] = [
  [2, bar('c0', 0, 5.2, 'x = 10', 'neutral')],
  [0, bar('r1', 0.3, 2.8, 'read x = 10')],
  [1, bar('w', 3.0, 5.2, 'write 20, commit', 'data')],
  [2, bar('c1', 5.2, 12, 'x = 20', 'neutral')],
  [0, bar('r2', 5.6, 8.6, 'read x = 20', 'bad', 'bad')],
];
const NONREP_FIXED: Placed[] = [...NONREP.slice(0, 4), [0, bar('r2', 5.6, 8.6, 'read x = 10', 'ok')]];

// ---------- Phantom ----------
const PHANTOM: Placed[] = [
  [2, bar('c0', 0, 5.6, '2 rows', 'neutral')],
  [0, bar('q1', 0.3, 3.0, 'count on-call: 2')],
  [1, bar('ins', 3.2, 5.6, 'insert, commit', 'data')],
  [2, bar('c1', 5.6, 12, '3 rows', 'neutral')],
  [0, bar('q2', 6.0, 9.0, 'count on-call: 3', 'bad', 'bad')],
];

// ---------- Lost update ----------
const LOST: Placed[] = [
  [2, bar('c0', 0, 7.4, 'n = 5', 'neutral')],
  [0, bar('r1', 0.3, 2.6, 'read n = 5')],
  [1, bar('r2', 2.8, 5.1, 'read n = 5')],
  [0, bar('w1', 5.3, 7.4, 'write n = 6', 'data')],
  [2, bar('c1', 7.4, 12, 'n = 6', 'bad', 'bad')],
  [1, bar('w2', 7.6, 9.9, 'write n = 6', 'bad', 'bad')],
];
const ATOMIC: Placed[] = [
  [2, bar('c0', 0, 3.0, 'n = 5', 'neutral')],
  [0, bar('a1', 0.3, 3.0, 'SET n = n + 1', 'ok')],
  [2, bar('c1', 3.0, 6.0, 'n = 6', 'neutral')],
  [1, bar('a2', 3.2, 6.0, 'SET n = n + 1', 'ok')],
  [2, bar('c2', 6.0, 12, 'n = 7', 'ok')],
];

// ---------- Write skew ----------
const SKEW_LANES = ['T1 Alice', 'T2 Bob', 'on call'];
const SKEW: Placed[] = [
  [2, bar('c0', 0, 8, 'Alice, Bob', 'neutral')],
  [0, bar('r1', 0.3, 3.0, 'read: 2 on call')],
  [1, bar('r2', 1.4, 4.1, 'read: 2 on call')],
  [0, bar('w1', 4.3, 7.0, 'Alice off, commit', 'data')],
  [1, bar('w2', 5.3, 8.0, 'Bob off, commit', 'data')],
  [2, bar('c1', 8, 12, 'nobody', 'bad', 'bad')],
];
const SERIAL: Placed[] = [
  [2, bar('c0', 0, 7.0, 'Alice, Bob', 'neutral')],
  [0, bar('r1', 0.3, 3.0, 'read: 2 on call')],
  [1, bar('r2', 1.4, 4.1, 'read: 2 on call')],
  [0, bar('w1', 4.3, 7.0, 'Alice off, commit', 'data')],
  [2, bar('c1', 7.0, 12, 'Bob', 'ok')],
  [1, bar('w2', 5.3, 8.0, 'abort, retry', 'bad', 'bad')],
  [1, bar('r3', 8.4, 11.6, 'read: 1 on call', 'ok')],
];

// ---------- The level matrix ----------
const ANOMALIES = ['dirty', 'non-repeat', 'phantom', 'lost upd', 'skew'];
type Cell = 'ok' | 'bad' | 'partly';
const LEVELS: { name: string; cells: Cell[]; prevents: string }[] = [
  { name: 'Read uncommitted', cells: ['bad', 'bad', 'bad', 'bad', 'bad'], prevents: '0 of 5' },
  { name: 'Read committed', cells: ['ok', 'bad', 'bad', 'bad', 'bad'], prevents: '1 of 5' },
  { name: 'Snapshot', cells: ['ok', 'ok', 'partly', 'partly', 'bad'], prevents: '2, plus some' },
  { name: 'Serializable', cells: ['ok', 'ok', 'ok', 'ok', 'ok'], prevents: '5 of 5' },
];
function matrix(rows: number): TimelineState {
  const lvl = LEVELS[rows - 1];
  return {
    from: 0,
    to: 5,
    ticks: [],
    lanes: LEVELS.map((l, li) => ({
      label: l.name,
      bars:
        li < rows
          ? l.cells.map((c, i) =>
              bar(`${li}-${i}`, i + 0.05, i + 0.95, ANOMALIES[i], c === 'ok' ? 'ok' : c === 'partly' ? 'data' : 'bad', li === rows - 1 ? 'active' : undefined),
            )
          : [],
    })),
    stats: [
      { label: 'Level', value: lvl.name.replace('Read uncommitted', 'Read uncomm.') },
      { label: 'Prevents', value: lvl.prevents, tone: rows === 4 ? 'ok' : rows === 1 ? 'bad' : 'neutral' },
      { label: 'Legend', value: 'green = safe' },
    ],
    note:
      rows === 3
        ? { text: 'snapshot: readers never block writers, but write skew slips through', tone: 'accent' }
        : rows === 2
          ? { text: 'default in PostgreSQL and Oracle' }
          : rows === 4
            ? { text: 'names differ across databases: read the docs, not the label', tone: 'accent' }
            : undefined,
  };
}

export default defineLesson('timeline', {
  slug: 'isolation-levels',
  objectives: [
    { text: 'Recognise dirty reads and non-repeatable reads', step: 3 },
    { text: 'See how lost updates happen and three ways to fix them', step: 5 },
    { text: 'Explain write skew and why snapshot isolation allows it', step: 6 },
    { text: 'Map each isolation level to the anomalies it prevents', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Read data that never existed',
      tag: 'problem',
      body: [
        'Isolation defines what concurrent transactions can see of each other.',
        'Here T1 writes `x = 20` but has not committed. T2 reads 20 and acts on it. Then T1 rolls back. This is a **dirty read**.',
      ],
      keyIdea: 'Every isolation level is a promise about which of these anomalies cannot happen.',
      frames: [
        ...schedule(TX, DIRTY, [
          { show: 2, stats: [{ label: 'Level', value: 'read uncomm.' }, { label: 'x committed', value: '10' }] },
          { show: 3, stats: [{ label: 'Level', value: 'read uncomm.' }, { label: 'T2 saw', value: '20', tone: 'bad' }] },
          { show: 4, markers: [{ at: 6.9, label: 'T1 aborts', tone: 'bad' }], note: { text: 'T2 used a value that was never committed', tone: 'bad' }, hold: 2200 },
        ]),
      ],
    },
    {
      label: 'Read committed',
      title: 'Only read committed data',
      tag: 'concept',
      body: [
        '**Read committed** only lets you see committed values, so T2 reads the old `x = 10` while T1 is in flight.',
        'It is the default in PostgreSQL and Oracle, and it prevents dirty reads. It does not stop the value changing under you between two reads.',
      ],
      keyIdea: 'Read committed: no dirty reads. Everything else can still happen.',
      frames: schedule(TX, DIRTY_FIXED, [
        { show: 3, stats: [{ label: 'Level', value: 'read committed' }, { label: 'T2 saw', value: '10', tone: 'ok' }], note: { text: 'uncommitted writes are invisible', tone: 'ok' }, hold: 1800 },
        { show: 4, markers: [{ at: 6.9, label: 'T1 aborts' }], note: { text: 'the rollback does not affect T2', tone: 'ok' } },
      ]),
    },
    {
      label: 'Non-repeatable',
      title: 'Same row, two different values',
      tag: 'technique',
      body: [
        'T1 reads `x = 10`. T2 writes 20 and commits. T1 reads again and gets 20. A **non-repeatable read**.',
        '**Snapshot isolation** gives each transaction a consistent snapshot, so T1 keeps seeing 10 for its whole life.',
      ],
      keyIdea: 'Snapshot isolation (PostgreSQL "repeatable read") prevents non-repeatable reads, and readers do not block writers.',
      frames: [
        ...schedule(TX, NONREP, [
          { show: 2, stats: [{ label: 'Level', value: 'read committed' }, { label: 'T1 reads', value: '10' }] },
          { show: 4, hold: 1600 },
          { show: 5, stats: [{ label: 'Level', value: 'read committed' }, { label: 'T1 reads', value: '10, then 20', tone: 'bad' }], note: { text: 'same row read twice, different values', tone: 'bad' }, hold: 2000 },
        ]),
        ...schedule(TX, NONREP_FIXED, [
          { show: 5, stats: [{ label: 'Level', value: 'snapshot' }, { label: 'T1 reads', value: '10, 10', tone: 'ok' }], note: { text: 'T1 keeps reading its snapshot', tone: 'ok' } },
        ]),
      ],
    },
    {
      label: 'Phantom',
      title: 'Same query, different set of rows',
      tag: 'technique',
      body: [
        'A **phantom** is the set version: T1 counts doctors on call and gets 2. T2 inserts a new one and commits. The same query now returns 3.',
        'Snapshot isolation mostly prevents phantoms. Serializable prevents them fully.',
      ],
      keyIdea: 'Locking existing rows cannot stop phantoms, because the new row did not exist yet.',
      frames: schedule(TX, PHANTOM, [
        { show: 2, stats: [{ label: 'Level', value: 'read committed' }, { label: 'Rows', value: '2' }] },
        { show: 4, stats: [{ label: 'Level', value: 'read committed' }, { label: 'Rows', value: '3' }], hold: 1600 },
        { show: 5, note: { text: 'same query twice returns a different set of rows', tone: 'bad' } },
      ]),
    },
    {
      label: 'Lost update',
      title: 'Two increments, one survives',
      tag: 'technique',
      body: [
        'Both transactions read `n = 5`, add one, and write 6. One increment is gone. A **lost update**.',
        'Fixes: an atomic increment `SET n = n + 1`, `SELECT ... FOR UPDATE`, or compare-and-set with a version.',
      ],
      keyIdea: 'Read-modify-write in application code is the classic source of lost updates. Push the arithmetic into the database.',
      frames: [
        ...schedule(TX, LOST, [
          { show: 3, stats: [{ label: 'Increments', value: '2' }, { label: 'n', value: '5' }] },
          { show: 5, stats: [{ label: 'Increments', value: '2' }, { label: 'n', value: '6' }] },
          { show: 6, stats: [{ label: 'Increments', value: '2' }, { label: 'n', value: '6', tone: 'bad', hint: 'expected 7' }], note: { text: 'T2 overwrote T1 with the same stale result', tone: 'bad' }, hold: 2000 },
        ]),
        ...schedule(TX, ATOMIC, [
          { show: 5, stats: [{ label: 'Increments', value: '2' }, { label: 'n', value: '7', tone: 'ok' }], note: { text: 'atomic increment: the database does read and write together', tone: 'ok' } },
        ]),
      ],
    },
    {
      label: 'Write skew',
      title: 'Both doctors go off duty',
      tag: 'technique',
      body: [
        'Rule: at least one doctor on call. Alice and Bob each check, see 2 on call, and each takes themself off.',
        'They wrote **different rows**, so nothing conflicts, yet together they break the rule. **Snapshot isolation allows this.**',
      ],
      keyIdea: 'Write skew: two transactions read overlapping data and write different rows, jointly violating an invariant.',
      frames: schedule(SKEW_LANES, SKEW, [
        { show: 3, stats: [{ label: 'Level', value: 'snapshot' }, { label: 'Invariant', value: '>= 1 on call' }] },
        { show: 4, hold: 1300 },
        { show: 5, hold: 1500 },
        {
          show: 6,
          stats: [{ label: 'Level', value: 'snapshot' }, { label: 'On call', value: '0', tone: 'bad' }],
          markers: [{ at: 8, label: '0 on call', tone: 'bad' }],
          note: { text: 'no row conflict, invariant broken', tone: 'bad' },
        },
      ]),
    },
    {
      label: 'Levels',
      title: 'Which level prevents what',
      tag: 'trade-off',
      body: [
        'Each level up prevents more anomalies. Snapshot stops dirty and non-repeatable reads, mostly stops phantoms, often stops lost updates, and allows write skew.',
        '**Serializable** prevents all five, via serial execution, two-phase locking, or SSI (PostgreSQL). It costs throughput or aborts and retries.',
      ],
      keyIdea: 'Pick the weakest level that keeps your invariants, and know which anomalies remain.',
      frames: [1, 2, 3, 4].map((n) => ({ state: matrix(n), hold: n === 4 ? 2400 : 1900 })),
    },
    {
      label: 'Recap',
      title: 'Serializable catches the skew',
      tag: 'recap',
      body: [
        '- **Dirty read:** stopped by read committed.',
        '- **Non-repeatable read, phantom:** stopped by snapshot (phantoms mostly).',
        '- **Lost update:** atomic increment, `FOR UPDATE`, or a version check.',
        '- **Write skew:** survives snapshot. Needs serializable.',
        '- **Serializable:** one transaction aborts and retries, and sees the new state.',
      ],
      keyIdea: 'Do not trust the level name. Check your database documentation for what it actually prevents.',
      frames: schedule(SKEW_LANES, SERIAL, [
        {
          show: 7,
          stats: [
            { label: 'Level', value: 'serializable' },
            { label: 'On call', value: '1', tone: 'ok' },
            { label: 'Cost', value: 'abort + retry' },
          ],
          markers: [{ at: 8, label: 'conflict', tone: 'bad' }],
          note: { text: 'T2 is aborted, retries, and sees only Bob on call', tone: 'ok' },
        },
      ]),
    },
  ],
});
