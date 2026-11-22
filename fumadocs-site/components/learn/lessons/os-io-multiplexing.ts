import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the OS notes on I/O multiplexing and the C10K problem. The work per wakeup is computed for each API:
 * select and poll scan every descriptor (select is capped at 1,024), epoll returns only the ready ones. A real readiness model
 * then shows level-triggered versus edge-triggered behaviour when the app reads less than arrived.
 */

const THREAD_STACK_MB = 1; // the notes say often 1 to 8 MB reserved, this is the low end
const CONNECTIONS = 10_000;
const stackMb = CONNECTIONS * THREAD_STACK_MB;

const FD_SETSIZE = 1024;
const cost = {
  select: (n: number, _ready: number): number | null => (n > FD_SETSIZE ? null : n),
  poll: (n: number, _ready: number): number => n,
  epoll: (_n: number, ready: number): number => ready,
};
const SMALL = { n: 1000, ready: 5 };
const BIG = { n: 10_000, ready: 5 };

// Level versus edge: 100 bytes arrive, the app reads 40 bytes per wakeup.
const ARRIVED = 100;
const READ = 40;
function wakeups(mode: 'level' | 'edge' | 'edge-drain'): { events: number; left: number[] } {
  let left = ARRIVED;
  const trace: number[] = [];
  let reported = false;
  for (let i = 0; i < 4; i++) {
    const ready = mode === 'level' ? left > 0 : !reported && left > 0; // edge only reports the change to ready
    if (!ready) {
      trace.push(left);
      continue;
    }
    reported = true;
    left = mode === 'edge-drain' ? 0 : Math.max(0, left - READ);
    trace.push(left);
  }
  return { events: trace.filter((_, i) => (mode === 'level' ? true : i === 0)).length, left: trace };
}
const LEVEL = wakeups('level');
const EDGE = wakeups('edge');
const DRAIN = wakeups('edge-drain');

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const c10k = (): ArrayState => ({
  rows: [
    { label: 'threads', cells: [CONNECTIONS], states: { 0: 'bad' }, showIndex: false },
    { label: 'event loop', cells: [1], states: { 0: 'found' }, showIndex: false },
  ],
  stats: [
    { label: 'Connections', value: CONNECTIONS.toLocaleString('en-US') },
    { label: 'Stack reserve', value: `${(stackMb / 1024).toFixed(1)} GB`, tone: 'bad' },
    { label: 'Per thread', value: `${THREAD_STACK_MB} MB` },
  ],
  note: { text: `a thread per connection reserves about ${(stackMb / 1024).toFixed(1)} GB of stacks and pays for every context switch`, tone: 'bad' },
});

const scanning = (n: number, ready: number, note: ArrayState['note']): ArrayState => {
  const s = cost.select(n, ready);
  const rows: ArrayState['rows'] = [
    {
      label: 'checks',
      cells: [s ?? 0, cost.poll(n, ready), cost.epoll(n, ready)],
      bars: true,
      states: paint(3, (i) => (i === 2 ? 'found' : i === 0 && s === null ? 'dim' : 'bad')),
      pointers: [{ i: 0, label: 'select', tone: s === null ? 'neutral' : 'bad' }, { i: 1, label: 'poll', tone: 'bad' }, { i: 2, label: 'epoll', tone: 'ok' }],
      showIndex: false,
    },
  ];
  return {
    rows,
    stats: [
      { label: 'Connections', value: n.toLocaleString('en-US') },
      { label: 'Ready now', value: String(ready), tone: 'ok' },
      { label: 'select', value: s === null ? 'over 1,024 fds' : String(s), tone: s === null ? 'bad' : 'neutral' },
    ],
    note,
  };
};

const trigger = (mode: 'level' | 'edge' | 'edge-drain'): ArrayState => {
  const t = mode === 'level' ? LEVEL : mode === 'edge' ? EDGE : DRAIN;
  const label = mode === 'level' ? 'level' : mode === 'edge' ? 'edge' : 'edge+drain';
  return {
    rows: [
      { label: 'wakeup', cells: ['1', '2', '3', '4'], states: paint(4, () => 'normal'), showIndex: false },
      { label, cells: t.left, states: paint(4, (i) => (t.left[i] === 0 ? 'found' : mode === 'edge' ? 'bad' : 'visited')), showIndex: false },
    ],
    stats: [
      { label: 'Arrived', value: `${ARRIVED} bytes` },
      { label: 'Read per wakeup', value: `${READ} bytes` },
      { label: 'Left at end', value: `${t.left[t.left.length - 1]} bytes`, tone: t.left[t.left.length - 1] === 0 ? 'ok' : 'bad' },
    ],
    note:
      mode === 'level'
        ? { text: 'level-triggered keeps reporting the fd while data remains, so partial reads are fine', tone: 'ok' }
        : mode === 'edge'
          ? { text: 'edge-triggered reports only the change to ready: 60 bytes are stuck and no event will come', tone: 'bad' }
          : { text: 'read until EAGAIN and edge-triggered drains everything in one wakeup', tone: 'ok' },
  };
};

export default defineLesson('array', {
  slug: 'os-io-multiplexing',
  objectives: [
    { text: 'Why a thread per connection stops scaling', step: 1 },
    { text: 'What select and poll cost per wakeup', step: 2 },
    { text: 'Why epoll scales with ready descriptors', step: 3 },
    { text: 'How level and edge triggering differ', step: 4 },
  ],
  steps: [
    {
      label: 'C10K',
      title: 'Ten thousand connections',
      tag: 'problem',
      body: ['Serving 10,000 connections with a thread each means 10,000 stacks, often 1 to 8 MB reserved apiece, plus constant context switching.', 'An event loop serves them from one thread by waiting on many descriptors at once.'],
      keyIdea: 'I/O multiplexing: block on many file descriptors, then read the ready ones.',
      frames: [{ state: c10k(), hold: 4200 }],
    },
    {
      label: 'select, poll',
      title: 'Scan everything',
      tag: 'concept',
      body: ['`select` and `poll` take the full set of descriptors on every call, and the kernel scans **all** of them.', 'With 1,000 connections and 5 ready, they do 1,000 checks to find 5.'],
      keyIdea: 'Cost is O(n) per call, and select is capped at 1,024 descriptors.',
      frames: [{ state: scanning(SMALL.n, SMALL.ready, { text: 'select and poll check every fd, epoll returns just the 5 that are ready', tone: 'accent' }), hold: 4400 }],
    },
    {
      label: 'epoll',
      title: 'A ready list',
      tag: 'technique',
      body: ['With `epoll` you **register** descriptors once and the kernel keeps a ready list. `epoll_wait` returns only ready ones.', 'At 10,000 connections the gap is 10,000 checks against 5, and select cannot even be used.'],
      keyIdea: 'Cost is O(ready), which is why nginx, Redis and Node.js scale.',
      frames: [{ state: scanning(BIG.n, BIG.ready, { text: 'poll still scans 10,000 fds, select is over its 1,024 limit, epoll does 5 units of work', tone: 'ok' }), hold: 4600 }],
    },
    {
      label: 'Triggers',
      title: 'Level versus edge',
      tag: 'trade-off',
      body: ['**Level-triggered** reports a descriptor while data remains. **Edge-triggered** reports only when it **becomes** ready.', 'If an edge-triggered reader stops early, the rest of the data is never announced again.'],
      keyIdea: 'With EPOLLET you must read until EAGAIN.',
      frames: [{ state: trigger('level'), hold: 3200 }, { state: trigger('edge'), hold: 3600 }, { state: trigger('edge-drain'), hold: 3400 }],
    },
    {
      label: 'Recap',
      title: 'I/O multiplexing',
      tag: 'recap',
      body: [
        '- **C10K:** a thread per connection does not scale.',
        '- **select and poll:** O(n) per call.',
        '- **epoll:** O(ready), scales to millions.',
        '- **Level:** forgiving. **Edge:** read until EAGAIN.',
        '- **Completion based:** io_uring and IOCP tell you the read is done.',
      ],
      keyIdea: 'Readiness says you can read now, completion says it is already read.',
      frames: [{ state: scanning(BIG.n, BIG.ready, { text: 'the work a wakeup costs depends on the API, not on the load', tone: 'accent' }) }],
    },
  ],
});
