import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Follows the Transactions and Concurrency notes: MVCC snapshots keep readers and writers apart, row locks are held until the
 * transaction ends, FOR UPDATE SKIP LOCKED lets workers share a queue, deadlocks need a consistent lock order, long transactions block cleanup.
 */

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };

function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

type Tone = 'ok' | 'bad' | 'accent';
const withBadge = (actors: SeqActor[], id: string, text: string, tone: Tone): SeqActor[] => actors.map((a) => (a.id === id ? { ...a, badge: { text, tone } } : a));

// Step 1: if readers lock, writers wait for them.
const LOCKING: SeqActor[] = [
  { id: 'r', label: 'Reader', kind: 'client' },
  { id: 'd', label: 'Row', kind: 'db' },
  { id: 'w', label: 'Writer', kind: 'worker' },
];
const lockFrames = reveal(LOCKING, [
  { msgs: [{ from: 'r', to: 'd', label: 'SELECT (shared lock)' }], actors: withBadge(LOCKING, 'd', 'S lock held', 'accent'), hold: 1800, stats: [{ label: 'Reader', value: 'locks the row' }, { label: 'Report', value: 'runs 30 s' }, { label: 'Writer', value: 'about to start' }] },
  { msgs: [{ from: 'w', to: 'd', label: 'UPDATE', lost: true, tone: 'bad' }], actors: withBadge(LOCKING, 'd', 'S lock held', 'bad'), hold: 3000, stats: [{ label: 'Writer', value: 'waits', tone: 'bad' }, { label: 'Cost', value: 'slow writes', tone: 'bad' }, { label: 'MVCC', value: 'avoids this' }], note: { text: 'a long report would stall every update to that row', tone: 'bad' } },
]);

// Step 2: MVCC. The reader keeps its snapshot, the writer creates a new version.
const MV: SeqActor[] = [
  { id: 'r', label: 'Reader T1', kind: 'client' },
  { id: 'd', label: 'Row versions', kind: 'db', badge: { text: 'v1 = 100', tone: 'accent' } },
  { id: 'w', label: 'Writer T2', kind: 'worker' },
];
const mvStats = (a: string, b: string): Stat[] => [{ label: 'Writers', value: 'never blocked', tone: 'ok' }, { label: 'T1 sees', value: a }, { label: 'New txn sees', value: b }];
const mvFrames = reveal(MV, [
  { msgs: [{ from: 'r', to: 'd', label: 'BEGIN, snapshot' }], hold: 1500, stats: mvStats('v1', 'v1') },
  { msgs: [{ from: 'w', to: 'd', label: 'UPDATE to 70 (v2)' }, { from: 'w', to: 'd', label: 'COMMIT', tone: 'ok' }], actors: withBadge(MV, 'd', 'v1 = 100, v2 = 70', 'accent'), hold: 2000, stats: mvStats('v1', 'v2') },
  { msgs: [{ from: 'r', to: 'd', label: 'SELECT balance' }, { from: 'd', to: 'r', label: '100 (v1)', dashed: true, tone: 'ok' }], actors: withBadge(MV, 'd', 'v1 = 100, v2 = 70', 'accent'), hold: 3000, stats: mvStats('v1 = 100', 'v2 = 70'), note: { text: 'readers do not block writers, writers do not block readers', tone: 'ok' } },
]);

// Step 3: write-write conflicts still need a lock, held until the transaction ends.
const WW: SeqActor[] = [
  { id: 'a', label: 'Txn A', kind: 'client' },
  { id: 'd', label: 'Row 1', kind: 'db' },
  { id: 'b', label: 'Txn B', kind: 'worker' },
];
const wwStats = (b: string, tone: 'ok' | 'bad' | 'neutral' = 'neutral'): Stat[] => [{ label: 'Lock', value: 'row, X mode' }, { label: 'Held until', value: 'COMMIT' }, { label: 'Txn B', value: b, tone }];
const wwFrames = reveal(WW, [
  { msgs: [{ from: 'a', to: 'd', label: 'UPDATE (row lock)' }], actors: withBadge(WW, 'd', 'locked by A', 'accent'), hold: 1700, stats: wwStats('not started') },
  { msgs: [{ from: 'b', to: 'd', label: 'UPDATE', lost: true, tone: 'bad' }], actors: withBadge(WW, 'd', 'locked by A', 'bad'), hold: 2000, stats: wwStats('waiting', 'bad'), note: { text: 'a second writer to the same row waits', tone: 'bad' } },
  { msgs: [{ from: 'a', to: 'd', label: 'COMMIT', tone: 'ok' }, { from: 'b', to: 'd', label: 'UPDATE proceeds', tone: 'ok' }], actors: withBadge(WW, 'd', 'locked by B', 'ok'), hold: 3000, stats: wwStats('runs now', 'ok'), note: { text: 'keep transactions short: locks live until the end', tone: 'ok' } },
]);

// Step 4: explicit locks. FOR UPDATE protects read-then-write, SKIP LOCKED shares a queue.
const Q: SeqActor[] = [
  { id: 'w1', label: 'Worker 1', kind: 'worker' },
  { id: 'j', label: 'jobs table', kind: 'db' },
  { id: 'w2', label: 'Worker 2', kind: 'worker' },
];
const qStats: Stat[] = [{ label: 'Clause', value: 'SKIP LOCKED' }, { label: 'Workers wait', value: 'never', tone: 'ok' }, { label: 'Used for', value: 'DB queues' }];
const queueFrames = reveal(Q, [
  { msgs: [{ from: 'w1', to: 'j', label: 'SELECT ... FOR UPDATE' }], actors: withBadge(Q, 'j', 'jobs 1-10 locked', 'accent'), hold: 1800, stats: qStats },
  { msgs: [{ from: 'w2', to: 'j', label: 'SELECT ... SKIP LOCKED' }, { from: 'j', to: 'w2', label: 'jobs 11-20', dashed: true, tone: 'ok' }], actors: withBadge(Q, 'j', 'two batches locked', 'ok'), hold: 3200, stats: qStats, note: { text: 'each worker gets a different batch, nobody waits', tone: 'ok' } },
]);

// Step 5: deadlock, detection and the consistent-order fix.
const DL: SeqActor[] = [
  { id: 't1', label: 'Txn 1', kind: 'client' },
  { id: 'ra', label: 'Row A', kind: 'db' },
  { id: 'rb', label: 'Row B', kind: 'db' },
  { id: 't2', label: 'Txn 2', kind: 'worker' },
];
const dlStats: Stat[] = [{ label: 'Detected by', value: 'wait-for graph' }, { label: 'Victim', value: 'rolled back' }, { label: 'Handle', value: 'retry txn', tone: 'ok' }];
const deadlockFrames = reveal(DL, [
  { msgs: [{ from: 't1', to: 'ra', label: 'lock A' }, { from: 't2', to: 'rb', label: 'lock B' }], hold: 1800, stats: dlStats },
  { msgs: [{ from: 't1', to: 'rb', label: 'wants B', lost: true, tone: 'bad' }, { from: 't2', to: 'ra', label: 'wants A', lost: true, tone: 'bad' }], hold: 2200, stats: dlStats, note: { text: 'each waits for the other: a cycle', tone: 'bad' } },
  { msgs: [{ from: 't2', to: 't2', label: 'abort', tone: 'bad' }, { from: 't1', to: 'rb', label: 'gets B', tone: 'ok' }], hold: 3000, stats: dlStats, note: { text: 'the database kills one transaction so the other can finish', tone: 'ok' } },
]);
const orderFrames = reveal(DL, [
  { msgs: [{ from: 't1', to: 'ra', label: 'lock A first' }, { from: 't2', to: 'ra', label: 'lock A first', lost: true, tone: 'accent' }], hold: 2200, stats: [{ label: 'Rule', value: 'same order', tone: 'ok' }, { label: 'Example', value: 'lower id first' }, { label: 'Cycles', value: 'impossible', tone: 'ok' }] },
  { msgs: [{ from: 't1', to: 'rb', label: 'then B', tone: 'ok' }, { from: 't2', to: 'ra', label: 'then A, then B', tone: 'ok' }], hold: 3000, stats: [{ label: 'Rule', value: 'same order', tone: 'ok' }, { label: 'Txn 2', value: 'just waits', tone: 'ok' }, { label: 'Cycles', value: 'impossible', tone: 'ok' }], note: { text: 'a consistent lock order prevents the cycle', tone: 'ok' } },
]);

// Step 6: long transactions hold back cleanup.
const LONG: SeqActor[] = [
  { id: 'l', label: 'Long txn', kind: 'client' },
  { id: 't', label: 'Table', kind: 'db' },
  { id: 'v', label: 'Vacuum', kind: 'worker' },
];
const longFrames = reveal(LONG, [
  { msgs: [{ from: 'l', to: 't', label: 'BEGIN, idle for hours' }], actors: withBadge(LONG, 't', 'old snapshot pinned', 'accent'), hold: 1800, stats: [{ label: 'Snapshot', value: 'still open' }, { label: 'Old versions', value: 'must be kept' }, { label: 'Idle in txn', value: 'holds locks', tone: 'bad' }] },
  { msgs: [{ from: 'v', to: 't', label: 'reclaim dead rows', lost: true, tone: 'bad' }], actors: withBadge(LONG, 't', 'bloat grows', 'bad'), hold: 3200, stats: [{ label: 'Vacuum / purge', value: 'blocked', tone: 'bad' }, { label: 'Result', value: 'bloat', tone: 'bad' }, { label: 'Guard', value: 'idle timeout' }], note: { text: 'one forgotten transaction can bloat the whole table', tone: 'bad' } },
]);

export default defineLesson('sequence', {
  slug: 'db-mvcc-locks',
  objectives: [
    { text: 'Why lock-based reads hurt writers', step: 1 },
    { text: 'How MVCC lets readers and writers coexist', step: 2 },
    { text: 'Why write-write conflicts still use row locks', step: 3 },
    { text: 'How FOR UPDATE and SKIP LOCKED are used', step: 4 },
    { text: 'What a deadlock is and how to prevent it', step: 5 },
    { text: 'Why long transactions are dangerous', step: 6 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Readers that block writers',
      tag: 'problem',
      body: ['If a reader takes a shared lock to keep the data stable, every writer to that row waits until the read ends.', 'A long report would then stall the application.'],
      keyIdea: 'Concurrency control has to keep reads consistent without making writes wait.',
      frames: lockFrames,
    },
    {
      label: 'MVCC',
      title: 'Keep several versions',
      tag: 'concept',
      body: ['**MVCC** keeps multiple versions of a row. A transaction reads the versions that were committed when its **snapshot** was taken.', 'The writer creates a new version and carries on. The reader still sees the old one.'],
      keyIdea: 'Reads take no locks, so reports never block writes. That is why snapshot isolation is so popular.',
      frames: mvFrames,
    },
    {
      label: 'Row locks',
      title: 'Writers still queue',
      tag: 'concept',
      body: ['MVCC removes most read locking, but two writers on one row still conflict. An `UPDATE` takes a row lock and holds it **until the transaction ends**.', 'The second writer waits for the first to commit or roll back.'],
      keyIdea: 'Long transactions mean long waits for everyone behind them.',
      frames: wwFrames,
    },
    {
      label: 'FOR UPDATE',
      title: 'Locks you ask for',
      tag: 'technique',
      body: ['`SELECT ... FOR UPDATE` locks the rows you read so you can read, decide and write with nobody changing them. `NOWAIT` fails instead of waiting.', '`SKIP LOCKED` lets many workers pull different jobs from one table without blocking each other.'],
      keyIdea: 'It works in PostgreSQL 9.5+, MySQL 8+, Oracle and SQL Server (`READPAST`).',
      frames: queueFrames,
    },
    {
      label: 'Deadlock',
      title: 'A cycle of waits',
      tag: 'trade-off',
      body: ['Two transactions each hold a lock the other needs. The database finds the cycle in its wait-for graph and aborts one as the victim.', 'Prevent them by locking in a **consistent order**, keeping transactions short, and indexing the `WHERE` columns so fewer rows are locked.'],
      keyIdea: 'Treat a deadlock error as retryable: catch it and rerun the whole transaction.',
      frames: [...deadlockFrames, ...orderFrames].slice(0, 5),
    },
    {
      label: 'Long txns',
      title: 'Old snapshots block cleanup',
      tag: 'in practice',
      body: ['A long-running or idle-in-transaction session pins an old snapshot, so old row versions cannot be removed.', 'PostgreSQL bloats until vacuum can catch up, and InnoDB grows its undo log. Idle sessions can also keep locks.'],
      keyIdea: 'Set `idle_in_transaction_session_timeout` and keep transactions short.',
      frames: longFrames,
    },
    {
      label: 'Recap',
      title: 'Concurrency in one page',
      tag: 'recap',
      body: [
        '- **MVCC:** readers see a snapshot, writers add versions.',
        '- **Row locks:** write-write conflicts wait until commit.',
        '- **FOR UPDATE:** protect read-then-write, `SKIP LOCKED` for queues.',
        '- **Deadlocks:** consistent lock order, short transactions, retry.',
        '- **Hygiene:** no long or idle transactions, watch vacuum and undo.',
      ],
      keyIdea: 'Most production lock trouble is a transaction that stayed open longer than anyone intended.',
      frames: [mvFrames[mvFrames.length - 1]],
    },
  ],
});
