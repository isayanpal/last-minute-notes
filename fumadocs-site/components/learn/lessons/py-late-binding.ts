import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

const py = (xs: number[]) => `[${xs.join(', ')}]`;

/*
 * Follows the Python notes on closures and the late-binding loop bug. A closure captures a variable (a cell), not a value, so every lambda
 * reads the cell when it is called. A real shared cell and a default-argument capture reproduce [2, 2, 2] and [0, 1, 2].
 */

type Cell = { v: number };
const cell: Cell = { v: -1 };
const late: (() => number)[] = [];
const history: number[] = [];
for (const i of [0, 1, 2]) {
  cell.v = i; // the loop rebinds the single variable i
  history.push(cell.v);
  late.push(() => cell.v); // the lambda keeps a reference to the cell, not to the value
}
const LATE = late.map((f) => f());

const early: (() => number)[] = [];
for (const i of [0, 1, 2]) {
  early.push(((captured: number) => () => captured)(i)); // lambda i=i: the default is evaluated at definition time
}
const EARLY = early.map((f) => f());

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const result = (vals: number[], label: string, note: ArrayState['note']): ArrayState => ({
  rows: [
    { label: 'lambda', cells: ['f0', 'f1', 'f2'], states: paint(3, () => 'normal'), showIndex: false },
    { label: 'returns', cells: vals, states: paint(3, (i) => (vals[i] === i ? 'found' : 'bad')), showIndex: false },
  ],
  stats: [
    { label: 'Built with', value: label },
    { label: 'Result', value: py(vals), tone: vals.every((v, i) => v === i) ? 'ok' : 'bad' },
    { label: 'Expected', value: '[0, 1, 2]' },
  ],
  note,
});

const cells = (k: number): ArrayState => ({
  rows: [
    { label: 'loop turn', cells: [0, 1, 2].map((i) => (i <= k ? i : '')), states: paint(3, (i) => (i === k ? 'active' : i < k ? 'done' : 'dim')), showIndex: false },
    { label: 'cell i', cells: [0, 1, 2].map((i) => (i <= k ? history[i] : '')), states: paint(3, (i) => (i === k ? 'swap' : i < k ? 'visited' : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'Cells', value: '1', tone: 'bad' },
    { label: 'Lambdas', value: String(Math.min(k + 1, 3)) },
    { label: 'Cell holds', value: String(history[k]) },
  ],
  note: k === 2 ? { text: 'the loop ended with the cell holding 2, and all three lambdas point at that one cell', tone: 'bad' } : { text: 'each turn overwrites the same cell, and the new lambda also points at it', tone: 'accent' },
});

export default defineLesson('array', {
  slug: 'py-late-binding',
  objectives: [
    { text: 'What [lambda: i for i in range(3)] returns', step: 1 },
    { text: 'Why: closures capture a cell, not a value', step: 2 },
    { text: 'How a default argument binds the value early', step: 3 },
    { text: 'How partial gives the same result', step: 4 },
  ],
  steps: [
    {
      label: 'The bug',
      title: 'Three lambdas, one answer',
      tag: 'problem',
      body: ['`fns = [lambda: i for i in range(3)]` looks like it makes functions returning 0, 1 and 2.', 'Calling them all gives `[2, 2, 2]`.'],
      keyIdea: 'This is the late-binding closure bug.',
      frames: [{ state: result(LATE, 'lambda: i', { text: 'every lambda returned 2, the value i had at the end of the loop', tone: 'bad' }), hold: 4000 }],
    },
    {
      label: 'Cells',
      title: 'Variables, not values',
      tag: 'concept',
      body: ['A closure captures the **variable**, stored in a cell shared by the outer scope and the inner function.', 'The loop keeps writing to one cell, and the lambdas read it only when called.'],
      keyIdea: 'Closures capture variables, which is the root of the bug.',
      frames: [0, 1, 2].map((k) => ({ state: cells(k), hold: k === 2 ? 3800 : 1700 })),
    },
    {
      label: 'Default arg',
      title: 'Bind at definition time',
      tag: 'technique',
      body: ['`lambda i=i: i` uses a default argument. Defaults are evaluated when the lambda is **defined**, so each one stores its own value.', 'Now the results are `[0, 1, 2]`.'],
      keyIdea: 'A default argument copies the current value into the function.',
      frames: [{ state: result(EARLY, 'lambda i=i', { text: 'each lambda captured the value at definition, so they differ', tone: 'ok' }), hold: 4000 }],
    },
    {
      label: 'partial',
      title: 'functools.partial',
      tag: 'in practice',
      body: ['`partial(print, i)` also freezes the **value** of `i` when it is created.', 'Closures are a lightweight alternative to a class with one method, as long as you remember they capture variables.'],
      keyIdea: 'Use a default argument, `partial`, or a factory function to bind early.',
      frames: [{ state: result(EARLY, 'partial(f, i)', { text: 'partial stores the value at creation, so the results are 0, 1, 2', tone: 'ok' }), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Closures capture variables',
      tag: 'recap',
      body: [
        '- **Closure:** a function plus the variables it captured.',
        '- **Cell:** where a captured variable lives.',
        '- **Late binding:** the value is read when called.',
        '- **Early binding:** default argument or `partial`.',
        '- **Loops:** the variable is shared by every iteration.',
      ],
      keyIdea: 'If every callback sees the last value, you captured the loop variable.',
      frames: [{ state: result(LATE, 'lambda: i', { text: 'the same loop with and without early binding gives [2, 2, 2] and [0, 1, 2]', tone: 'accent' }) }],
    },
  ],
});
