import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Database Internals and Transactions notes: log first then pages, commit returns after the log fsync,
 * ARIES recovery (analysis, redo, undo), checkpoints, group commit and the durability knobs.
 * Layout: Client (x 0.1), Buffer pool (x 2.5, top), WAL (x 2.5, bottom), Data files (x 5.3, top).
 */

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req', dur = 0.55): Packet => ({ from, to, label, delay, tone, dur });

const CLIENT: FlowNode = { id: 'c', label: 'Client', kind: 'client', x: 0.1, y: 1.7 };
const POOL: FlowNode = { id: 'p', label: 'Buffer pool', sub: 'pages in memory', kind: 'cache', x: 2.5, y: 0.5 };
const WAL: FlowNode = { id: 'w', label: 'WAL', sub: 'sequential log', kind: 'storage', x: 2.5, y: 2.9 };
const DATA: FlowNode = { id: 'd', label: 'Data files', sub: 'random pages', kind: 'db', x: 5.3, y: 0.5 };
const LINKS = [{ from: 'c', to: 'p' }, { from: 'c', to: 'w' }, { from: 'p', to: 'd' }];

// Step 1: writing the data page on every commit is slow, and keeping it only in memory is unsafe.
const problem = (mode: 'slow' | 'unsafe'): FlowState => ({
  nodes: [
    CLIENT,
    { ...POOL, items: mode === 'unsafe' ? ['page 7 *'] : undefined, status: mode === 'unsafe' ? 'hot' : 'normal' },
    { ...WAL, status: 'dim' },
    { ...DATA, status: mode === 'slow' ? 'hot' : 'normal', meter: mode === 'slow' ? { value: 0.9, label: 'random I/O', tone: 'bad' } : undefined },
  ],
  links: LINKS,
  packets: mode === 'slow' ? [hop('c', 'p', 'UPDATE', 0), hop('p', 'd', 'write page', 0.6, 'bad')] : [hop('c', 'p', 'UPDATE', 0), hop('p', 'c', 'OK?', 0.6, 'ok')],
  stats: mode === 'slow' ? [{ label: 'Per commit', value: 'random write', tone: 'bad' }, { label: 'Commit', value: 'slow', tone: 'bad' }, { label: 'Safe', value: 'yes' }] : [{ label: 'Commit', value: 'fast' }, { label: 'Page', value: 'only in RAM', tone: 'bad' }, { label: 'On crash', value: 'change lost', tone: 'bad' }],
  note: mode === 'slow' ? { text: 'flushing data pages on every commit makes commit slow', tone: 'bad' } : { text: 'answering OK from memory alone would lose committed data', tone: 'bad' },
});

// Step 2: write-ahead. Log record first, fsync, then acknowledge. The page is written later.
const commit = (phase: 0 | 1 | 2): FlowState => ({
  nodes: [
    CLIENT,
    { ...POOL, items: phase >= 0 ? ['page 7 *'] : undefined, sub: 'dirty page' },
    { ...WAL, status: phase === 1 ? 'active' : 'normal', items: phase >= 1 ? ['T1 update', 'T1 commit'] : ['T1 update'] },
    { ...DATA, status: phase === 2 ? 'active' : 'dim', items: phase === 2 ? ['page 7'] : undefined },
  ],
  links: LINKS,
  packets: phase === 0 ? [hop('c', 'p', 'UPDATE', 0), hop('c', 'w', 'log record', 0.1, 'data', 0.8)] : phase === 1 ? [hop('w', 'c', 'fsync done: OK', 0, 'ok', 0.8)] : [hop('p', 'd', 'lazy write', 0, 'data', 1)],
  stats: [
    { label: 'Order', value: 'log, then page', tone: 'ok' },
    { label: 'Commit returns', value: phase >= 1 ? 'after fsync' : 'not yet' },
    { label: 'Page write', value: phase === 2 ? 'background' : 'later' },
  ],
  note: phase === 0 ? { text: 'the change is logged sequentially, the page stays in memory', tone: 'accent' } : phase === 1 ? { text: 'commit is acknowledged once the log is on disk', tone: 'ok' } : { text: 'a checkpoint writes dirty pages lazily', tone: 'accent' },
});

// Step 3: a crash loses memory, but the log survives.
const crash: FlowState = {
  nodes: [
    CLIENT,
    { ...POOL, status: 'down', sub: 'memory lost', items: undefined },
    { ...WAL, status: 'active', items: ['T1 commit', 'T2 update'] },
    { ...DATA, items: ['old pg 7'] },
  ],
  links: LINKS,
  stats: [
    { label: 'Dirty pages', value: 'lost', tone: 'bad' },
    { label: 'Log', value: 'survived', tone: 'ok' },
    { label: 'T1', value: 'committed' },
  ],
  note: { text: 'T1 was acknowledged but its page never reached the data file', tone: 'bad' },
};

// Step 4: ARIES. Analysis, redo, undo. T1 committed, T2 did not.
const recovery = (stage: 'analysis' | 'redo' | 'undo'): FlowState => ({
  nodes: [
    { id: 'w', label: 'WAL', sub: 'T1 commit, T2 open', kind: 'storage', x: 0.3, y: 1.7, status: 'active', items: ['T1 commit', 'T2 update'] },
    { id: 'r', label: 'Recovery', sub: stage, kind: 'worker', x: 2.8, y: 1.7, status: 'active' },
    { id: 'd', label: 'Data files', sub: stage === 'analysis' ? 'stale' : stage === 'redo' ? 'T1 reapplied' : 'consistent', kind: 'db', x: 5.3, y: 1.7, items: stage === 'analysis' ? undefined : stage === 'redo' ? ['T1', 'T2'] : ['T1'] },
  ],
  links: [{ from: 'w', to: 'r' }, { from: 'r', to: 'd' }],
  packets:
    stage === 'analysis' ? [hop('w', 'r', 'scan log', 0)] : stage === 'redo' ? [hop('w', 'r', 'T1, T2 changes', 0), hop('r', 'd', 'repeat history', 0.6, 'data')] : [hop('r', 'd', 'roll back T2', 0, 'bad')],
  stats:
    stage === 'analysis'
      ? [{ label: 'Step', value: '1 analysis' }, { label: 'From', value: 'checkpoint' }, { label: 'Finds', value: 'dirty, active' }]
      : stage === 'redo'
        ? [{ label: 'Step', value: '2 redo' }, { label: 'Skips', value: 'LSN newer' }, { label: 'Replay', value: 'idempotent', tone: 'ok' }]
        : [{ label: 'Step', value: '3 undo' }, { label: 'Rolls back', value: 'T2 (open)', tone: 'bad' }, { label: 'Then', value: 'open', tone: 'ok' }],
  note: stage === 'analysis' ? { text: 'scan the log to learn which pages and transactions were active', tone: 'accent' } : stage === 'redo' ? { text: 'repeat history: reapply every logged change the page lacks', tone: 'accent' } : { text: 'undo the loser: T2 never committed', tone: 'ok' },
});

// Step 5: group commit and checkpoints trade latency, throughput and recovery time.
const group = (grouped: boolean): FlowState => ({
  nodes: [
    { id: 't1', label: 'Txn 1', kind: 'client', x: 0.1, y: 0.6, size: 'sm' },
    { id: 't2', label: 'Txn 2', kind: 'client', x: 0.1, y: 1.7, size: 'sm' },
    { id: 't3', label: 'Txn 3', kind: 'client', x: 0.1, y: 2.8, size: 'sm' },
    { id: 'w', label: 'WAL', sub: grouped ? '1 fsync' : '3 fsyncs', kind: 'storage', x: 4.2, y: 1.7, meter: { value: grouped ? 0.3 : 0.9, label: grouped ? 'fsync load' : 'fsync load', tone: grouped ? 'ok' : 'bad' } },
  ],
  links: [{ from: 't1', to: 'w' }, { from: 't2', to: 'w' }, { from: 't3', to: 'w' }],
  packets: [hop('t1', 'w', 'commit', 0, 'data', 0.7), hop('t2', 'w', 'commit', 0.1, 'data', 0.7), hop('t3', 'w', 'commit', 0.2, 'data', 0.7)],
  stats: [
    { label: 'Flushes', value: grouped ? '1 for 3' : '3 for 3', tone: grouped ? 'ok' : 'bad' },
    { label: 'Commit cost', value: 'fsync cost' },
    { label: 'Synchronous', value: 'off = faster' },
  ],
  note: grouped ? { text: 'group commit amortizes one fsync over many commits', tone: 'ok' } : { text: 'one fsync per commit is the main latency in write-heavy OLTP', tone: 'bad' },
});

export default defineLesson('flow', {
  slug: 'db-wal-recovery',
  objectives: [
    { text: 'Why commit cannot write data pages or rely on memory alone', step: 1 },
    { text: 'The write-ahead rule and when commit returns', step: 2 },
    { text: 'What a crash loses and what survives', step: 3 },
    { text: 'The three phases of ARIES-style recovery', step: 4 },
    { text: 'How group commit and settings trade speed for safety', step: 5 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Fast and safe commits',
      tag: 'problem',
      body: ['Writing the changed data page on every commit means slow **random I/O**. Acknowledging from memory alone is fast but loses data in a crash.', 'The database needs commit that is both fast and durable.'],
      keyIdea: 'The answer is a small sequential log, written before anything else.',
      frames: [{ state: problem('slow'), hold: 2800 }, { state: problem('unsafe'), hold: 3000 }],
    },
    {
      label: 'Write-ahead',
      title: 'Log first, page later',
      tag: 'concept',
      body: ['**WAL rule:** the log record for a change must reach durable storage before the changed page does, and before commit is acknowledged.', 'The log is sequential and small, so the `fsync` is cheap. Dirty pages are written lazily in the background.'],
      keyIdea: 'Commit means "the log is on disk", not "the page is on disk".',
      frames: [{ state: commit(0), hold: 2200 }, { state: commit(1), hold: 2400 }, { state: commit(2), hold: 2800 }],
    },
    {
      label: 'Crash',
      title: 'Memory dies, the log lives',
      tag: 'concept',
      body: ['After a crash the buffer pool is gone, so a committed change may exist only in the log.', 'The data files may even hold half-written pages, which PostgreSQL covers with full-page images and InnoDB with a doublewrite buffer.'],
      keyIdea: 'The log tells the engine exactly what to redo and what to undo.',
      frames: [{ state: crash, hold: 3200 }],
    },
    {
      label: 'Recovery',
      title: 'Analysis, redo, undo',
      tag: 'technique',
      body: ['**Analysis** scans the log from the last checkpoint. **Redo** repeats history. **Undo** rolls back transactions that never committed.', 'Each page stores the LSN of its last change, so redo skips what the page already has and replay is idempotent.'],
      keyIdea: 'A checkpoint bounds recovery time: replay starts there, not at the beginning of time.',
      frames: [{ state: recovery('analysis'), hold: 2400 }, { state: recovery('redo'), hold: 2800 }, { state: recovery('undo'), hold: 3000 }],
    },
    {
      label: 'Cost',
      title: 'The price of fsync',
      tag: 'trade-off',
      body: ['`fsync` per commit dominates write latency. **Group commit** lets concurrent commits share one flush.', 'Relaxing it (`synchronous_commit = off`) trades a short loss window for throughput and never corrupts data.'],
      keyIdea: 'The same log feeds replication, change data capture and point-in-time recovery.',
      frames: [{ state: group(false), hold: 2800 }, { state: group(true), hold: 3000 }],
    },
    {
      label: 'Recap',
      title: 'Durability in one page',
      tag: 'recap',
      body: [
        '- **Rule:** log record on disk before the page and before commit returns.',
        '- **Why:** sequential log writes are cheap, random page writes are not.',
        '- **Recovery:** analysis, redo, undo, starting at a checkpoint.',
        '- **Tuning:** group commit, `synchronous_commit`, flush settings.',
        '- **Reuse:** replication, CDC and PITR all read the log.',
      ],
      keyIdea: 'Never turn off `fsync`. If you need speed, relax commit durability knowingly.',
      frames: [{ state: commit(1) }],
    },
  ],
});
