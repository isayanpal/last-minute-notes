import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on the call stack: each call pushes a frame, each return pops one, and deep recursion overflows.
 * A real recursive factorial records every call and return, so the stack contents and the results 1, 2, 6, 24 are computed.
 * The 64-byte frame size and the 8 MB stack are EXAMPLE values for the overflow depth.
 */

type Ev = { kind: 'call' | 'return'; n: number; value?: number };
const events: Ev[] = [];
const fact = (n: number): number => {
  events.push({ kind: 'call', n });
  const v = n <= 1 ? 1 : n * fact(n - 1);
  events.push({ kind: 'return', n, value: v });
  return v;
};
const RESULT = fact(4);

const snapshots: { stack: number[]; ev: Ev }[] = [];
{
  const stack: number[] = [];
  for (const ev of events) {
    if (ev.kind === 'call') stack.push(ev.n);
    else stack.pop(); // the returning frame is popped
    snapshots.push({ stack: [...stack], ev });
  }
}

const FRAME_BYTES = 64;
const STACK_BYTES = 8 * 1024 * 1024;
const MAX_DEPTH = Math.floor(STACK_BYTES / FRAME_BYTES);
const recurse = (depth: number) => (depth <= MAX_DEPTH ? 'ok' : 'overflow');

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const view = (k: number, note: ArrayState['note']): ArrayState => {
  const s = snapshots[k - 1];
  const cells = [0, 1, 2, 3].map((i) => (s.stack[i] !== undefined ? `f(${s.stack[i]})` : ''));
  const rets = events.filter((e, i) => i < k && e.kind === 'return');
  return {
    rows: [
      { label: 'stack', cells, states: paint(4, (i) => (s.stack[i] === undefined ? 'dim' : i === s.stack.length - 1 ? (s.ev.kind === 'return' ? 'found' : 'active') : 'visited')), pointers: s.stack.length ? [{ i: s.stack.length - 1, label: 'top', up: true }] : [], showIndex: false },
      { label: 'returned', cells: [1, 2, 3, 4].map((_, i) => (rets[i] ? rets[i].value! : '')), states: paint(4, (i) => (rets[i] ? 'found' : 'dim')), showIndex: false },
    ],
    stats: [
      { label: 'Depth', value: String(s.stack.length) },
      { label: s.ev.kind === 'call' ? 'Called' : 'Returned', value: s.ev.kind === 'call' ? `fact(${s.ev.n})` : `${s.ev.value}`, tone: s.ev.kind === 'return' ? 'ok' : 'neutral' },
      { label: 'Frames pushed', value: String(events.slice(0, k).filter((e) => e.kind === 'call').length) },
    ],
    note,
  };
};

const frame = (): ArrayState => ({
  rows: [{ label: 'frame f(3)', cells: ['args', 'ret', 'rbp', 'n'], states: { 0: 'visited', 1: 'swap', 2: 'visited', 3: 'found' }, showIndex: false }],
  panels: [{ title: 'one frame', kind: 'list', items: ['arguments (extra)', 'return address', 'saved frame ptr', 'local n = 3', 'temporaries'] }],
  stats: [
    { label: 'Pushed by', value: 'CALL' },
    { label: 'Stack grows', value: 'down' },
    { label: 'Pointer', value: 'rsp' },
  ],
  note: { text: 'a frame holds the return address, saved registers and locals, freed by moving the stack pointer', tone: 'accent' },
});

const overflow = (depth: number): ArrayState => ({
  rows: [
    { label: 'recurse to', cells: [depth >= 200_000 ? '200k' : '100k'], states: { 0: recurse(depth) === 'ok' ? 'found' : 'bad' }, showIndex: false },
    { label: 'result', cells: [recurse(depth) === 'ok' ? 'ok' : 'crash'], states: { 0: recurse(depth) === 'ok' ? 'found' : 'bad' }, showIndex: false },
  ],
  stats: [
    { label: 'Stack', value: `${STACK_BYTES / 1024 / 1024} MB` },
    { label: 'Frame', value: `${FRAME_BYTES} B` },
    { label: 'Max depth', value: MAX_DEPTH.toLocaleString('en-US'), tone: 'ok' },
  ],
  note: recurse(depth) === 'ok' ? { text: `${depth.toLocaleString('en-US')} frames of ${FRAME_BYTES} B fit in 8 MB`, tone: 'ok' } : { text: `${depth.toLocaleString('en-US')} frames need more than 8 MB: stack overflow`, tone: 'bad' },
});

export default defineLesson('array', {
  slug: 'cf-call-stack',
  objectives: [
    { text: 'How each call pushes a frame', step: 1 },
    { text: 'How returns unwind the stack', step: 2 },
    { text: 'What a frame contains', step: 3 },
    { text: 'Why deep recursion overflows', step: 4 },
  ],
  steps: [
    {
      label: 'Calls',
      title: 'Push a frame per call',
      tag: 'problem',
      body: ['`fact(4)` calls `fact(3)`, which calls `fact(2)`, and so on. Each call pushes a **stack frame**.', 'The stack holds four frames at the deepest point.'],
      keyIdea: 'Calling is cheap: it moves the stack pointer.',
      frames: [1, 2, 3, 4].map((k) => ({ state: view(k, { text: `fact(${k === 1 ? 4 : 5 - k}) is called`, tone: 'accent' }), hold: k === 4 ? 2400 : 1400 })),
    },
    {
      label: 'Returns',
      title: 'Unwind from the top',
      tag: 'concept',
      body: ['`fact(1)` returns 1 and its frame is popped. Then `fact(2)` returns 2, `fact(3)` returns 6 and `fact(4)` returns 24.', 'Each result is available only after the call above it has returned.'],
      keyIdea: 'Last in, first out.',
      frames: [5, 6, 7, 8].map((k) => ({ state: view(k, { text: k === 8 ? `fact(4) returned ${RESULT} and the stack is empty` : 'the top frame returns its value and is popped', tone: 'ok' }), hold: k === 8 ? 3400 : 1500 })),
    },
    {
      label: 'A frame',
      title: 'What is inside',
      tag: 'technique',
      body: ['A frame holds extra arguments, the **return address** pushed by `CALL`, the saved frame pointer, callee-saved registers and local variables.', 'A **calling convention** says which registers carry arguments and the return value.'],
      keyIdea: 'Overwriting the return address is the classic buffer overflow attack.',
      frames: [{ state: frame(), hold: 4600 }],
    },
    {
      label: 'Overflow',
      title: 'The stack is small',
      tag: 'trade-off',
      body: ['The stack is small and fixed: 8 MB for the main thread on Linux, often 512 KB to 1 MB for other threads.', 'With 64-byte frames (an example) 8 MB holds 131,072 frames, so deeper recursion overflows.'],
      keyIdea: 'Java, Python and most JavaScript engines do not guarantee tail call optimisation, so use iteration for deep recursion.',
      frames: [{ state: overflow(100_000), hold: 3200 }, { state: overflow(200_000), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'The call stack',
      tag: 'recap',
      body: [
        '- **Call:** push a frame.',
        '- **Return:** pop it.',
        '- **Frame:** return address, saved registers, locals.',
        '- **Limit:** small, so deep recursion overflows.',
        '- **Heap:** for data that outlives a call.',
      ],
      keyIdea: 'Stack allocation is nearly free, heap allocation needs an allocator and a collector.',
      frames: [{ state: view(8, { text: 'every push was matched by a pop', tone: 'ok' }) }],
    },
  ],
});
