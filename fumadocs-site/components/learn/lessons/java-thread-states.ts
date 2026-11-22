import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the Java notes on the thread lifecycle. The state after each event is computed by folding the events
 * through a real transition table, including the rule that a ReentrantLock wait shows up as WAITING, not BLOCKED.
 */

type St = 'NEW' | 'RUNNABLE' | 'BLOCKED' | 'WAITING' | 'TIMED_WAITING' | 'TERMINATED';
type Ev = { name: string; from: St; to: St };

const EVENTS: Ev[] = [
  { name: 'start()', from: 'NEW', to: 'RUNNABLE' },
  { name: 'monitor busy', from: 'RUNNABLE', to: 'BLOCKED' },
  { name: 'lock acquired', from: 'BLOCKED', to: 'RUNNABLE' },
  { name: 'wait()', from: 'RUNNABLE', to: 'WAITING' },
  { name: 'notify()', from: 'WAITING', to: 'RUNNABLE' },
  { name: 'sleep(100)', from: 'RUNNABLE', to: 'TIMED_WAITING' },
  { name: 'timeout', from: 'TIMED_WAITING', to: 'RUNNABLE' },
  { name: 'lock() busy', from: 'RUNNABLE', to: 'WAITING' },
  { name: 'unpark', from: 'WAITING', to: 'RUNNABLE' },
  { name: 'run() ends', from: 'RUNNABLE', to: 'TERMINATED' },
];

/** Fold the first k events, checking each one starts from the current state. */
const stateAt = (k: number): { cur: St; prev: St | null; ev: Ev | null } => {
  let cur: St = 'NEW';
  let prev: St | null = null;
  let ev: Ev | null = null;
  for (let i = 0; i < k; i++) {
    if (EVENTS[i].from !== cur) throw new Error(`event ${EVENTS[i].name} does not start from ${cur}`);
    prev = cur;
    cur = EVENTS[i].to;
    ev = EVENTS[i];
  }
  return { cur, prev, ev };
};

const POS: Record<St, { x: number; y: number }> = {
  NEW: { x: 0.1, y: 1.7 },
  RUNNABLE: { x: 2.2, y: 1.7 },
  BLOCKED: { x: 4.4, y: 0.3 },
  WAITING: { x: 4.4, y: 1.7 },
  TIMED_WAITING: { x: 4.4, y: 3.1 },
  TERMINATED: { x: 2.2, y: 3.2 },
};
const SUB: Record<St, string> = {
  NEW: 'start() not called',
  RUNNABLE: 'running or ready',
  BLOCKED: 'synchronized only',
  WAITING: 'wait, join, park',
  TIMED_WAITING: 'sleep, timed wait',
  TERMINATED: 'run() finished',
};
const ORDER: St[] = ['NEW', 'RUNNABLE', 'BLOCKED', 'WAITING', 'TIMED_WAITING', 'TERMINATED'];

const view = (k: number): FlowState => {
  const { cur, prev, ev } = stateAt(k);
  const packets: Packet[] = prev && ev ? [{ from: prev, to: cur, label: ev.name, tone: cur === 'BLOCKED' ? 'bad' : cur === 'RUNNABLE' ? 'ok' : 'data', dur: 0.7 }] : [];
  return {
    nodes: ORDER.map((s) => ({ id: s, label: s, sub: SUB[s], kind: s === 'RUNNABLE' ? 'worker' : s === 'TERMINATED' ? 'storage' : s === 'NEW' ? 'client' : 'queue', x: POS[s].x, y: POS[s].y, status: s === cur ? (s === 'BLOCKED' ? 'hot' : 'active') : 'dim' })),
    links: [
      { from: 'NEW', to: 'RUNNABLE' },
      { from: 'RUNNABLE', to: 'BLOCKED' },
      { from: 'RUNNABLE', to: 'WAITING' },
      { from: 'RUNNABLE', to: 'TIMED_WAITING' },
      { from: 'RUNNABLE', to: 'TERMINATED' },
    ],
    packets,
    stats: [
      { label: 'State', value: cur, tone: cur === 'BLOCKED' ? 'bad' : cur === 'TERMINATED' ? 'neutral' : 'ok' },
      { label: 'Event', value: ev ? ev.name : '-' },
      { label: 'Events run', value: `${k} of ${EVENTS.length}` },
    ],
    note:
      cur === 'NEW'
        ? { text: 'the Thread object exists but start() has not been called', tone: 'accent' }
        : ev && ev.name === 'start()'
          ? { text: 'start() makes the thread runnable: running, or ready and waiting for a CPU', tone: 'ok' }
          : cur === 'BLOCKED'
            ? { text: 'another thread holds the synchronized monitor, so this one is BLOCKED', tone: 'bad' }
            : ev && ev.name === 'lock() busy'
              ? { text: 'a ReentrantLock wait shows up as WAITING, not BLOCKED', tone: 'accent' }
              : cur === 'WAITING'
                ? { text: 'waiting with no timeout until notify, a thread end or unpark', tone: 'accent' }
                : cur === 'TIMED_WAITING'
                  ? { text: 'waiting with a timeout: sleep, or a timed wait or join', tone: 'accent' }
                  : cur === 'TERMINATED'
                    ? { text: 'run() has finished and a thread cannot be restarted', tone: 'neutral' }
                    : { text: 'back to RUNNABLE: eligible for the CPU again', tone: 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'java-thread-states',
  objectives: [
    { text: 'What NEW and RUNNABLE mean', step: 1 },
    { text: 'What BLOCKED is, and the one thing that causes it', step: 2 },
    { text: 'The difference between WAITING and TIMED_WAITING', step: 3 },
    { text: 'Why a ReentrantLock wait is not BLOCKED', step: 4 },
  ],
  steps: [
    {
      label: 'NEW, RUNNABLE',
      title: 'Six states, one at a time',
      tag: 'problem',
      body: ['A thread is always in exactly one of six states. It is `NEW` until `start()` is called, then `RUNNABLE`: running **or** ready and waiting for the CPU.', 'Java does not separate those two.'],
      keyIdea: 'Calling `run()` directly does not start a thread, only `start()` does.',
      frames: [{ state: view(0), hold: 2200 }, { state: view(1), hold: 3000 }],
    },
    {
      label: 'BLOCKED',
      title: 'Waiting for a monitor',
      tag: 'technique',
      body: ['`BLOCKED` means one thing: the thread is trying to enter a `synchronized` block whose monitor another thread holds.', 'Once the lock is acquired it returns to `RUNNABLE`.'],
      keyIdea: 'BLOCKED is specifically about synchronized monitors.',
      frames: [{ state: view(2), hold: 2800 }, { state: view(3), hold: 2800 }],
    },
    {
      label: 'WAITING',
      title: 'Waiting, with or without a timeout',
      tag: 'technique',
      body: ['`wait()`, `join()` and `LockSupport.park()` put a thread in `WAITING` until something wakes it.', '`sleep(ms)` and timed versions of wait and join use `TIMED_WAITING`, and end on timeout or wake-up.'],
      keyIdea: 'Indefinite wait is WAITING, a wait with a deadline is TIMED_WAITING.',
      frames: [4, 5, 6, 7].map((k) => ({ state: view(k), hold: 2200 })),
    },
    {
      label: 'ReentrantLock',
      title: 'A lock that is not a monitor',
      tag: 'trade-off',
      body: ['A thread waiting on a `ReentrantLock` shows up as `WAITING`, not `BLOCKED`, because `BLOCKED` is only for monitors.', 'Read thread dumps with that in mind.'],
      keyIdea: 'Seeing no BLOCKED threads does not mean no one is waiting on a lock.',
      frames: [{ state: view(8), hold: 3200 }, { state: view(9), hold: 2800 }],
    },
    {
      label: 'Recap',
      title: 'The thread lifecycle',
      tag: 'recap',
      body: [
        '- **NEW:** created, not started.',
        '- **RUNNABLE:** running or ready.',
        '- **BLOCKED:** waiting for a synchronized monitor.',
        '- **WAITING and TIMED_WAITING:** wait, join, park, sleep.',
        '- **TERMINATED:** `run()` finished.',
      ],
      keyIdea: 'Every wait ends by returning to RUNNABLE, and only TERMINATED is final.',
      frames: [{ state: view(10) }],
    },
  ],
});
