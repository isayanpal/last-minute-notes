import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Timings are illustrative, the shapes follow the notes: thread-per-request is capped by its pool, Node runs JS on one thread
 * and hands I/O to the OS and libuv, microtasks run between callbacks, and CPU-bound work belongs in worker threads.
 * The ordering step uses the order printed by the notes demo: sync, nextTick, promise, immediate, timeout.
 */

const bar = (id: string, from: number, to: number, label: string, extra: Partial<TimelineBar> = {}): TimelineBar => ({ id, from, to, label, ...extra });
const ILLUSTRATIVE = { text: 'illustrative timings', tone: 'neutral' as const };

// Step 1: three requests that each wait 300 ms on a database. Two models handle them differently.
const threads = (): TimelineState => ({
  from: 0,
  to: 700,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500, 600, 700],
  lanes: [
    { label: 'Thread 1', bars: [bar('a', 0, 300, 'request A (waiting)', { tone: 'data' })] },
    { label: 'Thread 2', bars: [bar('b', 0, 300, 'request B (waiting)', { tone: 'data' })] },
    { label: 'Queue', bars: [bar('q', 0, 300, 'request C waits', { tone: 'bad', state: 'bad' }), bar('c', 300, 600, 'request C', { tone: 'data' })] },
  ],
  stats: [
    { label: 'Model', value: 'thread each' },
    { label: 'Pool size', value: '2 threads' },
    { label: 'Request C ends', value: '600 ms', tone: 'bad' },
  ],
  note: { text: 'blocked threads sit idle while waiting, and the pool caps concurrency', tone: 'bad' },
});
const loop = (): TimelineState => ({
  from: 0,
  to: 700,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500, 600, 700],
  lanes: [
    { label: 'Main thread', bars: [bar('m1', 0, 20, '', { tone: 'ok' }), bar('m2', 20, 40, '', { tone: 'ok' }), bar('m3', 40, 60, '', { tone: 'ok' }), bar('m4', 320, 360, 'replies', { tone: 'ok' })] },
    { label: 'Database', bars: [bar('d1', 20, 320, 'A, B, C wait together', { tone: 'data' })] },
  ],
  stats: [
    { label: 'Model', value: 'event loop' },
    { label: 'Threads', value: '1' },
    { label: 'All three end', value: '~360 ms', tone: 'ok' },
  ],
  note: { text: 'waiting costs no thread, so one thread serves many requests', tone: 'ok' },
});

// Step 2: JS on one thread, I/O handed off, callbacks queued back.
const handoff = (): TimelineState => ({
  from: 0,
  to: 600,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500, 600],
  lanes: [
    { label: 'Main thread', bars: [bar('j1', 0, 40, 'run JS', { tone: 'ok' }), bar('j2', 240, 300, 'callback', { tone: 'ok' }), bar('j3', 400, 450, 'callback', { tone: 'ok' })] },
    { label: 'libuv pool', bars: [bar('f', 40, 240, 'file read', { tone: 'data' })] },
    { label: 'OS network', bars: [bar('n', 40, 400, 'socket I/O', { tone: 'data' })] },
  ],
  markers: [{ at: 240, label: 'ready', tone: 'accent' }],
  stats: [
    { label: 'JS runs on', value: '1 thread' },
    { label: 'libuv pool', value: '4 threads' },
    { label: 'Best for', value: 'I/O-bound', tone: 'ok' },
  ],
  note: { text: 'finished I/O queues a callback for the main thread', tone: 'accent' },
});

// Step 3: ordering. Microtasks run between callbacks, then timers, poll, check.
const ORDER = [
  { lane: 'Sync code', label: 'sync', tone: 'ok' as const },
  { lane: 'nextTick', label: 'nextTick', tone: 'accent' as const },
  { lane: 'Promise', label: 'promise', tone: 'accent' as const },
  { lane: 'Check phase', label: 'immediate', tone: 'data' as const },
  { lane: 'Timers phase', label: 'timeout 0', tone: 'data' as const },
];
const order = (n: number): TimelineState => ({
  from: 0,
  to: 5,
  unit: '',
  ticks: [0, 1, 2, 3, 4, 5],
  lanes: ORDER.map((o, i) => ({ label: o.lane, bars: i < n ? [bar(`o${i}`, i, i + 1, o.label, { tone: o.tone })] : [] })),
  stats: [
    { label: 'Microtasks', value: 'run first' },
    { label: 'In an I/O cb', value: 'immediate wins' },
    { label: 'Timers', value: 'min delay' },
  ],
  note: n === 5 ? { text: 'printed order: sync, nextTick, promise, immediate, timeout', tone: 'ok' } : { text: 'microtasks drain between every callback', tone: 'accent' },
});

// Step 4: synchronous CPU work stalls everyone. A worker thread does not.
const blocked = (worker: boolean): TimelineState => ({
  from: 0,
  to: 600,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500, 600],
  lanes: worker
    ? [
        { label: 'Main thread', bars: [bar('m1', 50, 70, '', { tone: 'ok' }), bar('m2', 100, 120, '', { tone: 'ok' }), bar('m3', 150, 170, '', { tone: 'ok' }), bar('m4', 450, 480, 'result', { tone: 'ok' })] },
        { label: 'Worker thread', bars: [bar('w', 70, 450, 'fib(38)', { tone: 'data' })] },
        { label: 'Request B', bars: [bar('b', 100, 120, 'fast', { tone: 'ok' })] },
      ]
    : [
        { label: 'Main thread', bars: [bar('m', 50, 450, 'fib(38) blocks the loop', { tone: 'bad', state: 'bad' })] },
        { label: 'Request B', bars: [bar('b', 100, 450, 'waits for the loop', { tone: 'bad', state: 'bad' })] },
        { label: 'Timer 10 ms', bars: [bar('t', 60, 450, 'fires 400 ms late', { tone: 'bad', state: 'bad' })] },
      ],
  markers: [{ at: 100, label: 'request B', tone: 'accent' }],
  stats: [
    { label: 'Loop lag', value: worker ? '< 100 ms' : '~400 ms', tone: worker ? 'ok' : 'bad' },
    { label: 'Blocking', value: worker ? 'none' : 'every request', tone: worker ? 'ok' : 'bad' },
    { label: 'Also blocks', value: 'big JSON.parse' },
  ],
  note: worker ? { text: 'offload CPU work to worker_threads, the loop stays responsive', tone: 'ok' } : ILLUSTRATIVE,
});

// Step 5: one process uses one core. Cluster or replicas use all of them.
const cores = (all: boolean): TimelineState => ({
  from: 0,
  to: 100,
  unit: '%',
  ticks: [0, 25, 50, 75, 100],
  lanes: [1, 2, 3, 4].map((c) => ({
    label: `Core ${c}`,
    bars: c === 1 || all ? [bar(`c${c}`, 0, 100, all ? `process ${c}` : 'node process', { tone: 'ok' })] : [bar(`c${c}`, 0, 100, 'idle', { tone: 'data', state: 'dim' })],
  })),
  stats: [
    { label: 'Processes', value: all ? '4' : '1' },
    { label: 'Cores used', value: all ? '4 of 4' : '1 of 4', tone: all ? 'ok' : 'bad' },
    { label: 'Modern default', value: 'replicas' },
  ],
  note: all ? { text: 'cluster, PM2 or one container per core; state must live outside', tone: 'ok' } : { text: 'a single Node process is limited to one core of JS', tone: 'bad' },
});

// Step 6: a crash. Log, exit, and let the supervisor start a clean process.
const crash = (): TimelineState => ({
  from: 0,
  to: 600,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500, 600],
  lanes: [
    { label: 'Process 1', bars: [bar('p1', 0, 250, 'serving', { tone: 'ok' }), bar('p2', 250, 300, 'crash', { tone: 'bad', state: 'bad' }), bar('p3', 400, 600, 'serving', { tone: 'ok' })] },
    { label: 'Supervisor', bars: [bar('s', 300, 400, 'restart', { tone: 'accent' })] },
    { label: 'Process 2', bars: [bar('r', 0, 600, 'serving, takes the traffic', { tone: 'ok' })] },
  ],
  markers: [{ at: 250, label: 'unhandled', tone: 'bad' }],
  stats: [
    { label: 'On uncaught error', value: 'log + exit', tone: 'ok' },
    { label: 'Why', value: 'state suspect' },
    { label: 'Users', value: 'see no outage', tone: 'ok' },
  ],
  note: { text: 'exit and restart clean, a replica covers the gap', tone: 'ok' },
});

export default defineLesson('timeline', {
  slug: 'be-event-loop',
  objectives: [
    { text: 'How thread-per-request and the event loop use waiting time', step: 1 },
    { text: 'How Node hands I/O off and queues callbacks back', step: 2 },
    { text: 'The order of sync code, microtasks, immediates and timers', step: 3 },
    { text: 'Why CPU-bound code stalls every request', step: 4 },
    { text: 'How to use more than one core', step: 5 },
    { text: 'What to do on an unhandled error', step: 6 },
  ],
  steps: [
    {
      label: 'Models',
      title: 'Waiting is the real workload',
      tag: 'problem',
      body: ['Most backend time is spent **waiting** on databases and other services. A thread-per-request server parks a thread for every wait and is capped by its pool.', 'An **event loop** keeps one thread and does other work while I/O is pending.'],
      keyIdea: 'Async I/O makes the database and downstream services the limit, not the web server.',
      frames: [{ state: threads(), hold: 2800 }, { state: loop(), hold: 3000 }],
    },
    {
      label: 'Event loop',
      title: 'One thread, I/O handed off',
      tag: 'concept',
      body: ['Node runs your JavaScript on **one thread**. File and network work goes to the OS or **libuv** (a pool of 4 threads by default).', 'When I/O finishes, a callback is queued for the main thread.'],
      keyIdea: 'Great at I/O-bound work. CPU-bound work needs care.',
      frames: [{ state: handoff(), hold: 3200 }],
    },
    {
      label: 'Order',
      title: 'What runs first',
      tag: 'concept',
      body: ['**Microtasks** (`process.nextTick`, resolved promises, `await` continuations) run between every callback.', 'Then the loop moves through timers, poll and check. Inside an I/O callback, `setImmediate` always beats `setTimeout 0`.'],
      keyIdea: 'Timers guarantee a minimum delay, not an exact one.',
      frames: [1, 2, 3, 4, 5].map((n) => ({ state: order(n), hold: n === 5 ? 2800 : 1200 })),
    },
    {
      label: 'Blocking',
      title: 'One slow loop stalls everyone',
      tag: 'trade-off',
      body: ['A big `JSON.parse`, a loop over millions of items, a catastrophic regex or synchronous `crypto` blocks every request on that process.', 'Move CPU-bound work to **`worker_threads`**, ideally with a pool such as Piscina.'],
      keyIdea: 'Measure event-loop lag: a healthy 10 ms timer should fire about every 10 ms.',
      frames: [{ state: blocked(false), hold: 3000 }, { state: blocked(true), hold: 3000 }],
    },
    {
      label: 'Scaling',
      title: 'One process, one core',
      tag: 'technique',
      body: ['A single Node process uses one core for JavaScript. Use **`cluster`** or PM2, or the modern default: one process per container and scale replicas.', 'Shared state (sessions, caches) must live outside the process.'],
      keyIdea: 'Use streams with backpressure for big data, and `AsyncLocalStorage` to carry request context.',
      frames: [{ state: cores(false), hold: 2400 }, { state: cores(true), hold: 2800 }],
    },
    {
      label: 'Failure',
      title: 'Crash on purpose, restart clean',
      tag: 'in practice',
      body: ['Always handle promise rejections. On `uncaughtException` or `unhandledRejection`, **log and exit** and let the supervisor start a clean process.', 'Handle `SIGTERM` for a graceful shutdown so deploys do not drop requests.'],
      keyIdea: 'After an uncaught error, in-memory state may be corrupt, so continuing is the risky choice.',
      frames: [{ state: crash(), hold: 3200 }],
    },
    {
      label: 'Recap',
      title: 'Node concurrency in one page',
      tag: 'recap',
      body: [
        '- **Model:** one JS thread, I/O handed to the OS and libuv.',
        '- **Order:** sync, microtasks, then timers, poll, check.',
        '- **Never block:** CPU work goes to worker threads.',
        '- **Scale:** replicas or cluster, state outside the process.',
        '- **Fail:** handle rejections, log and exit on uncaught errors.',
      ],
      keyIdea: 'Event loop lag is the health metric that tells you the loop is being blocked.',
      frames: [{ state: blocked(true) }],
    },
  ],
});
