import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * A tiny event-loop simulator runs the notes' examples, so the queues and the output order on screen are computed, not drawn:
 *   Example 1: log A, setTimeout B, Promise.then C, log D  ->  A D C B
 *   Example 2: nested microtasks, Promise.then A (queues B), setTimeout C  ->  A B C
 * Rules: run the script to the end, drain all microtasks, take ONE macrotask, drain microtasks again, repeat.
 */

type Op = { t: 'log'; v: string } | { t: 'timeout'; name: string; cb: Op[] } | { t: 'then'; name: string; cb: Op[] };
type Task = { name: string; ops: Op[] };
type Snap = { stack: string[]; micro: string[]; macro: string[]; out: string[]; note: string };

function simulate(script: Op[]): Snap[] {
  const out: string[] = [];
  const micro: Task[] = [];
  const macro: Task[] = [];
  const snaps: Snap[] = [];
  const snap = (stack: string[], note: string) => snaps.push({ stack, micro: micro.map((t) => t.name), macro: macro.map((t) => t.name), out: [...out], note });
  const run = (ops: Op[], name: string, perOp: boolean) => {
    for (const op of ops) {
      if (op.t === 'log') {
        out.push(op.v);
        if (perOp) snap([name], `log ${op.v}`);
      } else if (op.t === 'timeout') {
        macro.push({ name: op.name, ops: op.cb });
        if (perOp) snap([name], `setTimeout hands ${op.name} to the Web API, then the macrotask queue`);
      } else {
        micro.push({ name: op.name, ops: op.cb });
        if (perOp) snap([name], `Promise.then queues ${op.name} as a microtask`);
      }
    }
  };
  run(script, 'main', true);
  snap([], 'call stack is empty');
  for (;;) {
    while (micro.length) {
      const t = micro.shift()!;
      run(t.ops, t.name, false);
      snap([t.name], `microtask ${t.name} ran`);
    }
    if (!macro.length) break;
    const t = macro.shift()!;
    run(t.ops, t.name, false);
    snap([t.name], `macrotask ${t.name} ran, then microtasks are drained again`);
  }
  return snaps;
}

const cells = (xs: string[]) => (xs.length ? xs : ['-']);
const dimIfEmpty = (xs: string[], on: ItemState): Record<number, ItemState> => Object.fromEntries(cells(xs).map((_, i) => [i, xs.length ? on : 'dim'])) as Record<number, ItemState>;
const view = (s: Snap, note?: string): ArrayState => ({
  rows: [
    { label: 'call stack', cells: cells(s.stack), states: dimIfEmpty(s.stack, 'active'), showIndex: false },
    { label: 'microtasks', cells: cells(s.micro), states: dimIfEmpty(s.micro, 'found'), showIndex: false },
    { label: 'macrotasks', cells: cells(s.macro), states: dimIfEmpty(s.macro, 'swap'), showIndex: false },
  ],
  panels: [{ title: 'console', kind: 'list', items: s.out.length ? s.out : ['(empty)'], highlight: s.out.length ? s.out.length - 1 : undefined }],
  stats: [
    { label: 'Output so far', value: s.out.join(' ') || '-' },
    { label: 'Microtasks', value: String(s.micro.length), tone: s.micro.length ? 'ok' : 'neutral' },
    { label: 'Macrotasks', value: String(s.macro.length) },
  ],
  note: { text: note ?? s.note, tone: 'accent' },
});
const frames = (snaps: Snap[], pick: number[], holds: number[] = []): Frame<ArrayState>[] => pick.map((i, k) => ({ state: view(snaps[i]), hold: holds[k] ?? 1700 }));

const EX1 = simulate([
  { t: 'log', v: 'A' },
  { t: 'timeout', name: 'B', cb: [{ t: 'log', v: 'B' }] },
  { t: 'then', name: 'C', cb: [{ t: 'log', v: 'C' }] },
  { t: 'log', v: 'D' },
]);
const EX2 = simulate([
  { t: 'then', name: 'A', cb: [{ t: 'log', v: 'A' }, { t: 'then', name: 'B', cb: [{ t: 'log', v: 'B' }] }] },
  { t: 'timeout', name: 'C', cb: [{ t: 'log', v: 'C' }] },
]);

// Step 1: the runtime, before any code has run.
const EMPTY: Snap = { stack: ['main'], micro: [], macro: [], out: [], note: 'one call stack, plus queues fed by the Web APIs' };

// Step 4: a busy stack delays everything, even a 0 ms timer.
const blockedSnaps: Snap[] = [
  { stack: ['main'], micro: [], macro: [], out: [], note: 'setTimeout(A, 0) registers a timer' },
  { stack: ['main'], micro: [], macro: ['A'], out: [], note: 'the timer is ready, but the stack is busy with the loop' },
  { stack: ['main'], micro: [], macro: ['A'], out: ['B'], note: 'the loop ends and B logs first' },
  { stack: ['A'], micro: [], macro: [], out: ['B', 'A'], note: 'only now can the event loop run A' },
];

export default defineLesson('array', {
  slug: 'js-event-loop',
  objectives: [
    { text: 'How a single-threaded language handles async work', step: 1 },
    { text: 'Why microtasks run before macrotasks, traced on A D C B', step: 2 },
    { text: 'Why microtasks that schedule microtasks still finish first', step: 3 },
    { text: 'How a long task on the call stack delays every timer', step: 4 },
  ],
  steps: [
    {
      label: 'Runtime',
      title: 'One thread, many queues',
      tag: 'problem',
      body: ['JavaScript has a **single call stack**. Async work is handled by Web APIs, task queues and the **event loop**.', 'Timers and network calls run outside the stack. When they finish, their callbacks wait in a queue.'],
      keyIdea: 'The loop pushes a task onto the stack only when the stack is empty.',
      frames: [{ state: view(EMPTY), hold: 3200 }],
    },
    {
      label: 'Output order',
      title: 'Microtasks beat macrotasks',
      tag: 'concept',
      body: ['`Promise.then` callbacks are **microtasks**. `setTimeout` callbacks are **macrotasks**.', 'After the script ends, the loop drains all microtasks, then takes one macrotask.'],
      keyIdea: 'Order of execution: call stack, microtask queue, macrotask queue.',
      frames: frames(EX1, [1, 2, 3, 5, 6], [1700, 1700, 2000, 1900, 3200]),
    },
    {
      label: 'Nested micro',
      title: 'Microtasks can queue microtasks',
      tag: 'technique',
      body: ['Microtask `A` schedules microtask `B`. The loop keeps draining until the microtask queue is empty.', 'So `B` runs before the timer `C`, even though `C` was registered at 0 ms.'],
      keyIdea: 'An endless chain of microtasks can starve macrotasks and rendering.',
      frames: frames(EX2, [0, 1, 3, 4, 5], [1700, 1700, 1900, 1900, 3200]),
    },
    {
      label: 'Blocking',
      title: 'A busy stack delays everything',
      tag: 'trade-off',
      body: ['A timer of 0 ms only means "as soon as possible". It still waits for the call stack to be free.', 'A long synchronous loop holds the stack, so the timer fires late.'],
      keyIdea: 'Never run long synchronous work on the main thread: split it up or move it to a worker.',
      frames: frames(blockedSnaps, [0, 1, 2, 3], [1800, 2200, 2000, 3200]),
    },
    {
      label: 'Recap',
      title: 'The event loop cycle',
      tag: 'recap',
      body: [
        '- **Script:** runs to completion on the call stack.',
        '- **Microtasks:** `then`, `catch`, `finally`, `queueMicrotask` drain fully first.',
        '- **Macrotasks:** `setTimeout`, `setInterval` run one per turn.',
        '- **Loop:** drain microtasks, take one macrotask, repeat.',
        '- **Never block** the stack: timers and rendering wait behind it.',
      ],
      keyIdea: 'When predicting output, list the script, then the microtask queue, then the macrotask queue.',
      frames: [{ state: view(EX1[EX1.length - 1]) }],
    },
  ],
});
