import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the Java notes on race conditions and synchronized: count++ is read, add, write, so two threads can read the
 * same old value. The final counts come from running both schedules through a small step interpreter.
 */

type Op = 'read' | 'write';
type Step = { t: 'a' | 'b'; op: Op };

/** Run two threads that each do read, add one, write. Returns the final value for a given interleaving. */
function run(schedule: Step[]): { final: number; reads: Record<string, number | undefined> } {
  let count = 0;
  const local: Record<string, number | undefined> = {};
  for (const s of schedule) {
    if (s.op === 'read') local[s.t] = count;
    else count = (local[s.t] as number) + 1;
  }
  return { final: count, reads: local };
}

const RACY: Step[] = [
  { t: 'a', op: 'read' },
  { t: 'b', op: 'read' },
  { t: 'a', op: 'write' },
  { t: 'b', op: 'write' },
];
const LOCKED: Step[] = [
  { t: 'a', op: 'read' },
  { t: 'a', op: 'write' },
  { t: 'b', op: 'read' },
  { t: 'b', op: 'write' },
];
const racyFinal = run(RACY).final;
const lockedFinal = run(LOCKED).final;

const ACTORS: SeqState['actors'] = [
  { id: 'a', label: 'Thread a', kind: 'worker' },
  { id: 'mem', label: 'count', kind: 'db' },
  { id: 'b', label: 'Thread b', kind: 'worker' },
];

const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });

// Step 2: the lost update, built from the real schedule.
const racyMessages = (): SeqMessage[] => {
  let count = 0;
  const local: Record<string, number> = {};
  const out: SeqMessage[] = [];
  for (const s of RACY) {
    const name = s.t === 'a' ? 'a' : 'b';
    if (s.op === 'read') {
      local[name] = count;
      out.push(m(name, 'mem', `read count (${count})`, 'req'));
    } else {
      count = local[name] + 1;
      out.push(m(name, 'mem', `write ${count}`, 'bad'));
    }
  }
  return out;
};
const RACY_MSGS = racyMessages();

const racy = (n: number): SeqState => ({
  actors: ACTORS,
  messages: RACY_MSGS.slice(0, n),
  stats: [
    { label: 'Increments', value: '2' },
    { label: 'count is', value: n >= 4 ? String(racyFinal) : '-', tone: n >= 4 ? 'bad' : 'neutral' },
    { label: 'Lost', value: n >= 4 ? String(2 - racyFinal) : '-', tone: n >= 4 ? 'bad' : 'neutral' },
  ],
  note: n >= 4 ? { text: `both threads read 0 and wrote 1: two increments, count is ${racyFinal}`, tone: 'bad' } : n >= 2 ? { text: 'thread b read before thread a wrote its result', tone: 'bad' } : { text: 'count++ is three steps: read, add one, write', tone: 'accent' },
});

// Step 3: synchronized serialises the two critical sections.
const SYNC_MSGS: SeqMessage[] = [
  m('a', 'mem', 'lock, read count (0)', 'violet'),
  m('b', 'mem', 'lock: BLOCKED', 'bad', true),
  m('a', 'mem', 'write 1, unlock', 'ok'),
  m('b', 'mem', 'lock, read count (1)', 'violet'),
  m('b', 'mem', 'write 2, unlock', 'ok'),
];
const synced = (n: number): SeqState => ({
  actors: ACTORS.map((a) => (a.id === 'b' && n === 2 ? { ...a, status: 'dim' as const, badge: { text: 'BLOCKED', tone: 'bad' as const } } : a)),
  messages: SYNC_MSGS.slice(0, n),
  stats: [
    { label: 'Lock holder', value: n <= 2 ? 'a' : n === 4 ? 'b' : 'none' },
    { label: 'Thread b', value: n === 2 ? 'BLOCKED' : n >= 4 ? 'running' : 'waiting', tone: n === 2 ? 'bad' : 'neutral' },
    { label: 'count is', value: n >= 5 ? String(lockedFinal) : '-', tone: n >= 5 ? 'ok' : 'neutral' },
  ],
  note: n >= 5 ? { text: `one thread at a time: count is ${lockedFinal}, and the lock also makes the writes visible`, tone: 'ok' } : n === 2 ? { text: 'thread b waits for the monitor, a BLOCKED thread state', tone: 'bad' } : { text: 'synchronized gives mutual exclusion plus visibility', tone: 'accent' },
});

// Step 4: compare-and-swap retries instead of locking.
const CAS_MSGS: SeqMessage[] = [
  m('a', 'mem', 'read 0, compute 1', 'req'),
  m('b', 'mem', 'read 0, compute 1', 'req'),
  m('a', 'mem', 'CAS(0, 1): swapped', 'ok'),
  m('b', 'mem', 'CAS(0, 1): failed', 'bad'),
  m('b', 'mem', 'retry: read 1, CAS(1, 2)', 'ok'),
];
const cas = (n: number): SeqState => ({
  actors: ACTORS,
  messages: CAS_MSGS.slice(0, n),
  stats: [
    { label: 'Blocking', value: 'none', tone: 'ok' },
    { label: 'Failed CAS', value: n >= 4 ? 'retries' : '-', tone: n >= 4 ? 'ok' : 'neutral' },
    { label: 'count is', value: n >= 5 ? '2' : '-', tone: n >= 5 ? 'ok' : 'neutral' },
  ],
  note: n >= 5 ? { text: 'the loser noticed the change, retried, and no update was lost', tone: 'ok' } : { text: 'compare-and-swap writes only if the value is still what you read', tone: 'accent' },
});

export default defineLesson('sequence', {
  slug: 'java-race-synchronized',
  objectives: [
    { text: 'Why count++ is not atomic', step: 1 },
    { text: 'How two threads lose an update', step: 2 },
    { text: 'How synchronized prevents it', step: 3 },
    { text: 'How an atomic CAS avoids locks', step: 4 },
  ],
  steps: [
    {
      label: 'count++',
      title: 'One line, three steps',
      tag: 'problem',
      body: ['`count++` reads the value, adds one, and writes it back. Another thread can run between those steps.', 'When the result depends on that timing, you have a **race condition**.'],
      keyIdea: 'A single Java statement is not automatically atomic.',
      frames: [{ state: racy(0), hold: 2600 }],
    },
    {
      label: 'Lost update',
      title: 'Two increments, one result',
      tag: 'concept',
      body: ['Both threads read the same old value, both add one, both write the same result.', 'One increment disappears. With 200,000 increments you usually end up with fewer.'],
      keyIdea: 'Lost updates are silent: no exception, just a wrong number.',
      frames: [{ state: racy(1), hold: 1400 }, { state: racy(2), hold: 1600 }, { state: racy(3), hold: 1600 }, { state: racy(4), hold: 3600 }],
    },
    {
      label: 'synchronized',
      title: 'One thread at a time',
      tag: 'technique',
      body: ['`synchronized` gives **mutual exclusion**: a second thread waits for the monitor, and shows as `BLOCKED`.', 'It also gives **visibility**: the next thread to take the lock sees the earlier writes.'],
      keyIdea: 'Keep synchronized blocks small, and prefer a private lock object.',
      frames: [1, 2, 3, 4, 5].map((n) => ({ state: synced(n), hold: n === 5 ? 3600 : 1500 })),
    },
    {
      label: 'Atomic',
      title: 'Compare and swap',
      tag: 'in practice',
      body: ['`AtomicInteger` uses hardware CAS: update only if the value is still what you read, otherwise retry.', 'No blocking and no deadlock, and faster under low or moderate contention.'],
      keyIdea: 'Atomic per operation: two separate atomic calls together are still not atomic.',
      frames: [1, 2, 3, 4, 5].map((n) => ({ state: cas(n), hold: n === 5 ? 3600 : 1500 })),
    },
    {
      label: 'Recap',
      title: 'Races and fixes',
      tag: 'recap',
      body: [
        '- **Race:** the result depends on thread timing.',
        '- **count++:** read, add, write, not atomic.',
        '- **synchronized:** exclusion plus visibility.',
        '- **Atomic classes:** lock-free CAS with retries.',
        '- **Cost:** locks can block and deadlock, CAS can spin under heavy contention.',
      ],
      keyIdea: 'Protect shared mutable state, or avoid sharing it.',
      frames: [{ state: synced(5) }],
    },
  ],
});
