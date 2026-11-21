import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the Replication, Sharding and Operations notes: expand, migrate, contract, batched backfills,
 * lock_timeout so a waiting ALTER cannot queue every query behind it, and CREATE INDEX CONCURRENTLY.
 * Timings are illustrative, the order of the phases is the point.
 */

const bar = (id: string, from: number, to: number, label: string, extra: Partial<TimelineBar> = {}): TimelineBar => ({ id, from, to, label, ...extra });
const ILLUSTRATIVE = { text: 'illustrative timings', tone: 'neutral' as const };

// Step 1: code and schema deploy at different moments. A rename breaks whichever side is old.
const rename = (): TimelineState => ({
  from: 0,
  to: 60,
  unit: 's',
  ticks: [0, 10, 20, 30, 40, 50, 60],
  lanes: [
    { label: 'Schema', bars: [bar('s1', 0, 20, 'old column', { tone: 'data' }), bar('s2', 20, 60, 'renamed', { tone: 'ok' })] },
    { label: 'Old code', bars: [bar('o1', 0, 20, 'works', { tone: 'ok' }), bar('o2', 20, 40, 'errors', { tone: 'bad', state: 'bad' })] },
    { label: 'New code', bars: [bar('n1', 0, 40, 'not deployed yet', { tone: 'data', state: 'dim' }), bar('n2', 40, 60, 'works', { tone: 'ok' })] },
  ],
  markers: [{ at: 20, label: 'ALTER RENAME', tone: 'bad' }],
  stats: [
    { label: 'Deploy gap', value: '~20 s', tone: 'bad' },
    { label: 'Requests failing', value: 'old code', tone: 'bad' },
    { label: 'Rule', value: 'old + new' },
  ],
  note: ILLUSTRATIVE,
});

// Step 2: expand, migrate, contract. Every phase works with old and new code.
const emc = (upTo: number): TimelineState => {
  const phases = [
    { lane: '1 Expand', label: 'add nullable cols', from: 0, to: 10, tone: 'info' as const },
    { lane: '2 Dual write', label: 'write both shapes', from: 10, to: 20, tone: 'info' as const },
    { lane: '3 Backfill', label: 'copy old rows', from: 20, to: 35, tone: 'data' as const },
    { lane: '4 Switch reads', label: 'read new cols', from: 35, to: 45, tone: 'ok' as const },
    { lane: '5 Contract', label: 'drop old', from: 45, to: 55, tone: 'accent' as const },
  ];
  return {
    from: 0,
    to: 60,
    unit: '',
    ticks: [0, 10, 20, 30, 40, 50, 60],
    lanes: phases.map((p, i) => ({ label: p.lane, bars: i < upTo ? [bar(`p${i}`, p.from, p.to, p.label, { tone: p.tone })] : [] })),
    stats: [
      { label: 'Phase', value: phases[Math.max(0, upTo - 1)].lane },
      { label: 'Old code', value: upTo >= 5 ? 'retired' : 'still works', tone: 'ok' },
      { label: 'Downtime', value: 'none', tone: 'ok' },
    ],
    note: { text: upTo === 5 ? 'contract only after every reader uses the new columns' : 'each step is safe for both old and new code', tone: upTo === 5 ? 'ok' : 'accent' },
  };
};

// Step 3: backfill in small batches instead of one huge UPDATE.
const backfill = (batched: boolean): TimelineState => ({
  from: 0,
  to: 60,
  unit: 's',
  ticks: [0, 10, 20, 30, 40, 50, 60],
  lanes: batched
    ? [
        { label: 'Backfill', bars: [0, 1, 2, 3, 4, 5].map((i) => bar(`b${i}`, 5 + i * 9, 9 + i * 9, '', { tone: 'ok' })) },
        { label: 'Other writes', bars: [bar('w', 0, 60, 'keep flowing', { tone: 'ok' })] },
        { label: 'Replica lag', bars: [bar('r', 0, 60, 'small, steady', { tone: 'ok' })] },
      ]
    : [
        { label: 'Backfill', bars: [bar('b', 5, 50, 'one huge UPDATE', { tone: 'bad', state: 'bad' })] },
        { label: 'Other writes', bars: [bar('w1', 0, 5, 'ok', { tone: 'ok' }), bar('w2', 5, 50, 'blocked by row locks', { tone: 'bad', state: 'bad' })] },
        { label: 'Replica lag', bars: [bar('r', 5, 60, 'grows, then drains', { tone: 'bad', state: 'bad' })] },
      ],
  stats: [
    { label: 'Locks', value: batched ? 'short' : 'long', tone: batched ? 'ok' : 'bad' },
    { label: 'Replication', value: batched ? 'keeps up' : 'lags', tone: batched ? 'ok' : 'bad' },
    { label: 'Bloat', value: batched ? 'bounded' : 'big', tone: batched ? 'ok' : 'bad' },
  ],
  note: batched ? { text: 'batch by key range, commit between batches', tone: 'ok' } : ILLUSTRATIVE,
});

// Step 4: lock_timeout. A waiting ALTER queues every query behind it.
const lockWait = (timeout: boolean): TimelineState => ({
  from: 0,
  to: 60,
  unit: 's',
  ticks: [0, 10, 20, 30, 40, 50, 60],
  lanes: [
    { label: 'Long query', bars: [bar('q', 0, 40, 'holds a lock', { tone: 'data' })] },
    { label: 'ALTER', bars: timeout ? [bar('a', 10, 13, '', { tone: 'accent' }), bar('a2', 13, 20, 'gives up, retry', { tone: 'ok' })] : [bar('a', 10, 40, 'waits for the lock', { tone: 'accent' })] },
    { label: 'Other queries', bars: timeout ? [bar('o', 0, 60, 'unaffected', { tone: 'ok' })] : [bar('o1', 0, 10, 'ok', { tone: 'ok' }), bar('o2', 10, 40, 'queued behind ALTER', { tone: 'bad', state: 'bad' }), bar('o3', 40, 60, 'ok', { tone: 'ok' })] },
  ],
  markers: [{ at: 10, label: 'ALTER starts', tone: 'accent' }],
  stats: [
    { label: 'lock_timeout', value: timeout ? '3 s' : 'none', tone: timeout ? 'ok' : 'bad' },
    { label: 'App queries', value: timeout ? 'fine' : 'outage', tone: timeout ? 'ok' : 'bad' },
    { label: 'Then', value: timeout ? 'retry' : 'wait' },
  ],
  note: timeout ? { text: 'a 3 s timeout turns an outage into a retry', tone: 'ok' } : { text: 'every new query waits behind the blocked ALTER', tone: 'bad' },
});

// Step 5: safer versions of risky operations. CREATE INDEX CONCURRENTLY.
const index = (concurrent: boolean): TimelineState => ({
  from: 0,
  to: 60,
  unit: 's',
  ticks: [0, 10, 20, 30, 40, 50, 60],
  lanes: [
    { label: 'Index build', bars: [bar('i', 10, 40, concurrent ? 'CONCURRENTLY' : 'CREATE INDEX', { tone: concurrent ? 'ok' : 'data' })] },
    { label: 'Writes', bars: concurrent ? [bar('w', 0, 60, 'keep flowing', { tone: 'ok' })] : [bar('w1', 0, 10, 'ok', { tone: 'ok' }), bar('w2', 10, 40, 'blocked', { tone: 'bad', state: 'bad' }), bar('w3', 40, 60, 'ok', { tone: 'ok' })] },
  ],
  stats: [
    { label: 'Writes', value: concurrent ? 'allowed' : 'blocked', tone: concurrent ? 'ok' : 'bad' },
    { label: 'Build', value: concurrent ? 'slower' : 'faster' },
    { label: 'Also', value: 'NOT VALID' },
  ],
  note: concurrent ? { text: 'slower build, but no write outage', tone: 'ok' } : ILLUSTRATIVE,
});

export default defineLesson('timeline', {
  slug: 'db-migrations',
  objectives: [
    { text: 'Why schema and code changes must work with both versions', step: 1 },
    { text: 'The five phases of expand, migrate, contract', step: 2 },
    { text: 'Why backfills run in small batches', step: 3 },
    { text: 'How lock_timeout stops a blocked ALTER becoming an outage', step: 4 },
    { text: 'Safer versions of risky operations', step: 5 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Code and schema never deploy together',
      tag: 'problem',
      body: ['The schema changes at one moment and the code at another. A plain rename breaks the old code until the new code is live.', 'Every change must work with **both the old and the new** version of the application.'],
      keyIdea: 'Rename, retype and drop are the dangerous words. Add is usually safe.',
      frames: [{ state: rename(), hold: 3200 }],
    },
    {
      label: 'Expand, contract',
      title: 'Five safe phases',
      tag: 'technique',
      body: ['**Expand** with a nullable column, **dual write** from new code, **backfill** old rows, **switch reads**, then **contract** by dropping the old column later.', 'At every moment both versions of the code work.'],
      keyIdea: 'Contract last, and only after nothing reads the old column.',
      frames: [1, 2, 3, 4, 5].map((n) => ({ state: emc(n), hold: n === 5 ? 3000 : 1500 })),
    },
    {
      label: 'Backfill',
      title: 'Small batches, short locks',
      tag: 'technique',
      body: ['One giant `UPDATE` holds locks for a long time, bloats the table and makes replicas lag.', 'Backfill by key range in small batches, committing between them, and verify no unmigrated rows remain before switching reads.'],
      keyIdea: 'A long `UPDATE` hurts writers, replicas and vacuum at once.',
      frames: [{ state: backfill(false), hold: 3000 }, { state: backfill(true), hold: 3200 }],
    },
    {
      label: 'lock_timeout',
      title: 'A waiting ALTER blocks everyone',
      tag: 'trade-off',
      body: ['An `ALTER` needs a strong lock. If a long query holds a lock, the `ALTER` waits, and every new query queues behind it.', 'Set **`lock_timeout`** (for example 3 seconds) so the migration gives up and retries instead of causing an outage.'],
      keyIdea: 'The migration should be the thing that fails, never the application.',
      frames: [{ state: lockWait(false), hold: 3200 }, { state: lockWait(true), hold: 3200 }],
    },
    {
      label: 'Safer ops',
      title: 'Swap risky for safe',
      tag: 'in practice',
      body: ['`CREATE INDEX` blocks writes, so use `CREATE INDEX CONCURRENTLY`. A check or foreign key scans the table under a lock, so add it `NOT VALID` and then `VALIDATE`.', 'A column type change rewrites the table: add a new column, dual write, backfill, swap.'],
      keyIdea: 'On MySQL, use online DDL, or gh-ost and pt-online-schema-change for the rest.',
      frames: [{ state: index(false), hold: 2800 }, { state: index(true), hold: 3000 }],
    },
    {
      label: 'Recap',
      title: 'Zero-downtime migration rules',
      tag: 'recap',
      body: [
        '- **Compatible:** every step works with old and new code.',
        '- **Phases:** expand, dual write, backfill, switch reads, contract.',
        '- **Backfill** in batches, verify before switching.',
        '- **Always** set `lock_timeout` and retry.',
        '- **Prefer** concurrent and `NOT VALID` forms, and keep migrations forward-only.',
      ],
      keyIdea: 'Run migrations in CI against production-like data and test restores rather than relying on down-migrations.',
      frames: [{ state: emc(5) }],
    },
  ],
});
