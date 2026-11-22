import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

const py = (xs: number[]) => `[${xs.join(', ')}]`;

/*
 * Follows the Python notes on mutable default arguments and nested list multiplication. A small model evaluates the default once, when
 * "def" runs, exactly like Python, and counts how many times it was built. The grid uses a real shared row reference, so every number
 * (add(1) and add(2) both showing [1, 2], one distinct row) is computed.
 */

/** def add(x, bucket=[]): ...  The default list is created once, when the function is defined. */
function defineBuggy() {
  let built = 0;
  const defaultBucket: number[] = (built++, []);
  return {
    add: (x: number, bucket?: number[]) => {
      const b = bucket ?? defaultBucket;
      b.push(x);
      return b; // returns the same object, like Python
    },
    built: () => built,
  };
}
/** def add(x, bucket=None): if bucket is None: bucket = [] ... */
function defineFixed() {
  return (x: number, bucket: number[] | null = null) => {
    const b = bucket ?? [];
    b.push(x);
    return b;
  };
}

const buggy = defineBuggy();
const r1 = buggy.add(1);
const snapshot1 = [...r1];
const r2 = buggy.add(2);
const SAME = r1 === r2;
const fixed = defineFixed();
const f1 = fixed(1);
const f2 = fixed(2);

// grid = [[0] * 3] * 3 versus [[0] * 3 for _ in range(3)]
const row = [0, 0, 0];
const shared: number[][] = [row, row, row]; // three references to ONE inner list
shared[0][0] = 1;
const comp: number[][] = [0, 1, 2].map(() => [0, 0, 0]);
comp[0][0] = 1;
const distinct = (g: number[][]) => new Set(g).size;

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const calls = (first: boolean, both: boolean): ArrayState => ({
  rows: [
    { label: 'add(1)', cells: first ? (both ? [...r1] : snapshot1) : [], states: paint(2, () => (both ? 'bad' : 'found')), showIndex: false },
    { label: 'add(2)', cells: both ? [...r2] : [], states: paint(2, () => 'bad'), showIndex: false },
  ],
  stats: [
    { label: 'add(1) shows', value: py(both ? r1 : snapshot1) },
    { label: 'add(2) shows', value: both ? py(r2) : '-', tone: both ? 'bad' : 'neutral' },
    { label: 'Same list', value: both ? String(SAME) : '-', tone: both ? 'bad' : 'neutral' },
  ],
  note: both ? { text: 'add(1) and add(2) returned the very same list, so the first result changed too', tone: 'bad' } : { text: 'the first call puts 1 in the default list', tone: 'accent' },
});

const once = (): ArrayState => ({
  rows: [{ label: 'default', cells: [buggy.built()], states: { 0: 'swap' }, showIndex: false }, { label: 'calls', cells: [2], states: { 0: 'visited' }, showIndex: false }],
  stats: [
    { label: 'Defaults built', value: String(buggy.built()), tone: 'bad' },
    { label: 'Function calls', value: '2' },
    { label: 'Evaluated', value: 'at def time' },
  ],
  note: { text: 'the default expression ran once, when def executed, and every call shares that list', tone: 'bad' },
});

const fix = (): ArrayState => ({
  rows: [
    { label: 'add(1)', cells: [...f1], states: { 0: 'found' }, showIndex: false },
    { label: 'add(2)', cells: [...f2], states: { 0: 'found' }, showIndex: false },
  ],
  stats: [
    { label: 'add(1) shows', value: py(f1), tone: 'ok' },
    { label: 'add(2) shows', value: py(f2), tone: 'ok' },
    { label: 'Same list', value: String(f1 === f2), tone: 'ok' },
  ],
  note: { text: 'use None as the default and create the list inside the function', tone: 'ok' },
});

const grid = (g: number[][], label: string, note: ArrayState['note']): ArrayState => ({
  rows: g.map((r, i) => ({ label: `row ${i}`, cells: r, states: paint(3, (c) => (r[c] === 1 ? 'bad' : 'visited')), showIndex: false })),
  stats: [
    { label: 'Built with', value: label },
    { label: 'Distinct rows', value: String(distinct(g)), tone: distinct(g) === 1 ? 'bad' : 'ok' },
    { label: 'Rows showing 1', value: String(g.filter((r) => r[0] === 1).length), tone: g.filter((r) => r[0] === 1).length > 1 ? 'bad' : 'ok' },
  ],
  note,
});

export default defineLesson('array', {
  slug: 'py-mutable-defaults',
  objectives: [
    { text: 'Why add(1) and add(2) share a list', step: 1 },
    { text: 'When a default value is evaluated', step: 2 },
    { text: 'How None as a default fixes it', step: 3 },
    { text: 'Why [[0] * 3] * 3 is one row three times', step: 4 },
  ],
  steps: [
    {
      label: 'The bug',
      title: 'A list that remembers',
      tag: 'problem',
      body: ['`def add(x, bucket=[])` appends to `bucket` and returns it. Call `add(1)` and you get `[1]`.', 'Call `add(2)` and the second result is `[1, 2]`, and the first result has changed too.'],
      keyIdea: 'Both calls returned the same list object.',
      frames: [{ state: calls(true, false), hold: 2600 }, { state: calls(true, true), hold: 4000 }],
    },
    {
      label: 'Why',
      title: 'Defaults are built once',
      tag: 'concept',
      body: ['A default value is evaluated **once**, when the `def` statement runs, not on every call.', 'A mutable default therefore becomes shared state that survives between calls.'],
      keyIdea: 'The default lives on the function object.',
      frames: [{ state: once(), hold: 4200 }],
    },
    {
      label: 'Fix',
      title: 'None as a sentinel',
      tag: 'technique',
      body: ['Default to `None` and create a fresh list inside the function when the argument is `None`.', 'Each call now gets its own list.'],
      keyIdea: 'Use an immutable default like `None`, `0` or `""`, or a sentinel object.',
      frames: [{ state: fix(), hold: 4000 }],
    },
    {
      label: 'Grids',
      title: 'The same trap in a grid',
      tag: 'trade-off',
      body: ['`[[0] * 3] * 3` repeats a **reference** to one inner list three times. Setting `grid[0][0] = 1` changes all three rows.', 'A list comprehension builds three separate rows.'],
      keyIdea: 'Multiplying a list copies references, not the objects inside.',
      frames: [{ state: grid(shared, '[[0]*3]*3', { text: 'three names for one row: all three show the 1', tone: 'bad' }), hold: 3600 }, { state: grid(comp, 'comprehension', { text: 'three separate rows: only row 0 changed', tone: 'ok' }), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Shared state surprises',
      tag: 'recap',
      body: [
        '- **Defaults:** evaluated once, at def time.',
        '- **Mutable default:** shared by every call.',
        '- **Fix:** default to `None`, build inside.',
        '- **List multiplication:** repeats references.',
        '- **Nested data:** build with a comprehension.',
      ],
      keyIdea: 'If two results change together, check whether they are one object.',
      frames: [{ state: fix() }],
    },
  ],
});
