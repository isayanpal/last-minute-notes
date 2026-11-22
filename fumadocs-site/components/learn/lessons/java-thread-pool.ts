import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the Java notes on ThreadPoolExecutor: core threads first, then the queue, then extra threads up to the maximum,
 * then the rejection policy. The placement of every task comes from running that decision rule for real.
 */

const CORE = 2;
const MAX = 4;
const QUEUE = 2;
const TASKS = 7;

type Place = 'core' | 'queue' | 'extra' | 'rejected';
type Snap = { core: string[]; extra: string[]; queue: string[]; rejected: string[]; last: Place };

function simulate(): Snap[] {
  const core: string[] = [];
  const extra: string[] = [];
  const queue: string[] = [];
  const rejected: string[] = [];
  const snaps: Snap[] = [];
  for (let n = 1; n <= TASKS; n++) {
    const id = `T${n}`;
    let last: Place;
    if (core.length + extra.length < CORE) {
      core.push(id);
      last = 'core';
    } else if (queue.length < QUEUE) {
      queue.push(id);
      last = 'queue';
    } else if (core.length + extra.length < MAX) {
      extra.push(id);
      last = 'extra';
    } else {
      rejected.push(id);
      last = 'rejected';
    }
    snaps.push({ core: [...core], extra: [...extra], queue: [...queue], rejected: [...rejected], last });
  }
  return snaps;
}
const SNAPS = simulate();
const DEST: Record<Place, string> = { core: 'core', queue: 'queue', extra: 'extra', rejected: 'rej' };

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

// Step 1: a thread per task has no ceiling.
const unbounded = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'sub', label: 'Tasks', sub: 'submitted', kind: 'client', x: 0.2, y: 1.7, status: 'active' },
    { id: 'th', label: 'One thread each', sub: phase === 1 ? 'no upper limit' : 'new thread per task', kind: 'worker', x: 4.4, y: 1.7, status: phase === 1 ? 'hot' : 'active', meter: { value: phase === 1 ? 1 : 0.3, label: phase === 1 ? 'full' : 'growing', tone: phase === 1 ? 'bad' : 'info' } },
  ],
  links: [{ from: 'sub', to: 'th' }],
  packets: [hop('sub', 'th', 'task', 0, phase === 1 ? 'bad' : 'req'), hop('sub', 'th', 'task', 0.3, phase === 1 ? 'bad' : 'req')],
  stats: [
    { label: 'Thread cost', value: 'high' },
    { label: 'Limit', value: phase === 1 ? 'none' : '-', tone: phase === 1 ? 'bad' : 'neutral' },
    { label: 'Failure', value: phase === 1 ? 'OutOfMemory' : '-', tone: phase === 1 ? 'bad' : 'neutral' },
  ],
  note: phase === 1 ? { text: 'unbounded threads exhaust memory: "unable to create native thread"', tone: 'bad' } : { text: 'creating a thread per task is expensive', tone: 'accent' },
});

// Steps 2 to 4: the pool after k tasks.
const pool = (k: number): FlowState => {
  const s = SNAPS[k - 1];
  const dest = DEST[s.last];
  const label = `T${k}`;
  return {
    nodes: [
      { id: 'sub', label: 'submit()', sub: `${k} of ${TASKS} tasks`, kind: 'client', x: 0.1, y: 1.7, status: 'active' },
      { id: 'core', label: 'Core threads', sub: `core size ${CORE}`, kind: 'worker', x: 2.8, y: 0.3, status: s.last === 'core' ? 'active' : 'normal', items: s.core },
      { id: 'queue', label: 'Work queue', sub: `capacity ${QUEUE}`, kind: 'queue', x: 2.8, y: 1.7, status: s.last === 'queue' ? 'active' : 'normal', items: s.queue, meter: { value: s.queue.length / QUEUE, label: `${s.queue.length} of ${QUEUE}`, tone: s.queue.length === QUEUE ? 'bad' : 'info' } },
      { id: 'extra', label: 'Extra threads', sub: `up to max ${MAX}`, kind: 'worker', x: 2.8, y: 3.2, status: s.last === 'extra' ? 'active' : 'normal', items: s.extra },
      { id: 'rej', label: 'Rejected', sub: 'rejection policy', kind: 'external', x: 5.6, y: 1.7, status: s.last === 'rejected' ? 'down' : 'dim', items: s.rejected },
    ],
    links: [{ from: 'sub', to: 'core' }, { from: 'sub', to: 'queue' }, { from: 'sub', to: 'extra' }, { from: 'sub', to: 'rej', dashed: true }],
    packets: [hop('sub', dest, label, 0, s.last === 'rejected' ? 'bad' : s.last === 'queue' ? 'data' : 'ok')],
    stats: [
      { label: 'Threads', value: `${s.core.length + s.extra.length} of ${MAX}` },
      { label: 'Queued', value: `${s.queue.length} of ${QUEUE}` },
      { label: 'Rejected', value: String(s.rejected.length), tone: s.rejected.length ? 'bad' : 'neutral' },
    ],
    note:
      s.last === 'core'
        ? { text: `${label}: fewer than ${CORE} threads exist, so a new core thread starts`, tone: 'ok' }
        : s.last === 'queue'
          ? { text: `${label}: core threads are busy, so it waits in the queue`, tone: 'accent' }
          : s.last === 'extra'
            ? { text: `${label}: the queue is full, so an extra thread starts (below max ${MAX})`, tone: 'ok' }
            : { text: `${label}: queue full and ${MAX} threads busy, so the rejection policy runs`, tone: 'bad' },
  };
};

export default defineLesson('flow', {
  slug: 'java-thread-pool',
  objectives: [
    { text: 'Why a thread per task does not scale', step: 1 },
    { text: 'Why core threads start first', step: 2 },
    { text: 'Why the queue fills before extra threads start', step: 3 },
    { text: 'What happens when the pool and queue are both full', step: 4 },
  ],
  steps: [
    {
      label: 'Why a pool',
      title: 'Threads are not free',
      tag: 'problem',
      body: ['Starting a thread per task is expensive and has no ceiling. Under load it can end in `OutOfMemoryError`.', 'A **thread pool** reuses a bounded set of threads.'],
      keyIdea: 'Bound the threads and bound the queue, or load can take the process down.',
      frames: [{ state: unbounded(0), hold: 2400 }, { state: unbounded(1), hold: 3400 }],
    },
    {
      label: 'Core',
      title: 'Core threads first',
      tag: 'concept',
      body: [`The pool here has core size ${CORE}, max ${MAX} and a queue of ${QUEUE}. While fewer than ${CORE} threads exist, every new task **starts a new thread**.`, 'Core threads are kept alive.'],
      keyIdea: 'Step 1 of submission: below corePoolSize, start a thread.',
      frames: [{ state: pool(1), hold: 2400 }, { state: pool(2), hold: 3000 }],
    },
    {
      label: 'Queue',
      title: 'The queue comes before extra threads',
      tag: 'trade-off',
      body: ['With the core threads busy, new tasks go into the **queue**, not into extra threads.', 'Extra threads only start once the queue is **full**, which surprises many people.'],
      keyIdea: 'An unbounded queue means maximumPoolSize is never used.',
      frames: [{ state: pool(3), hold: 2400 }, { state: pool(4), hold: 3200 }],
    },
    {
      label: 'Extra, reject',
      title: 'Extra threads, then rejection',
      tag: 'technique',
      body: [`When the queue is full and threads are below the maximum of ${MAX}, an **extra thread** starts.`, 'When both are full, the **rejection policy** applies: `AbortPolicy` throws, `CallerRunsPolicy` makes the caller run it.'],
      keyIdea: 'CallerRunsPolicy gives natural back-pressure.',
      frames: [{ state: pool(5), hold: 2200 }, { state: pool(6), hold: 2600 }, { state: pool(7), hold: 3800 }],
    },
    {
      label: 'Recap',
      title: 'How a pool takes a task',
      tag: 'recap',
      body: [
        '- **1:** fewer than core threads, start a thread.',
        '- **2:** otherwise queue the task.',
        '- **3:** queue full and below max, start an extra thread.',
        '- **4:** both full, apply the rejection policy.',
        '- **Sizing:** CPU-bound near the core count, I/O-bound more.',
      ],
      keyIdea: 'Order matters: core, queue, extra, reject.',
      frames: [{ state: pool(7) }],
    },
  ],
});
