import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Python notes on iterators and generators. Real JavaScript iterators and generators model the same behaviour: an iterator is
 * exhausted after one pass, a generator body resumes at each next() and send(), a lazy pipeline reads only as many lines as it needs
 * (counted by instrumentation), and yield from forwards values and returns the sub-generator's result.
 */

// Step 1: iterators are single pass.
const it = [1, 2, 3][Symbol.iterator]();
const FIRST = [...it];
const SECOND = [...it];

// Step 2: the generator lifecycle with send and return.
const log: string[] = [];
function* gen(): Generator<number, string, string> {
  const x: string = yield 1;
  log.push(`got ${x}`);
  yield 2;
  return 'done';
}
const g = gen();
const calls: { call: string; yields: string; state: string; full: string }[] = [{ call: 'gen()', yields: '-', state: 'new', full: 'Created' }];
{
  const a = g.next();
  calls.push({ call: 'next', yields: String(a.value), state: 'wait', full: 'Suspended' });
  const b = g.next('hi');
  calls.push({ call: 'send', yields: String(b.value), state: 'wait', full: 'Suspended' });
  const c = g.next();
  calls.push({ call: 'next', yields: c.done ? 'stop' : String(c.value), state: 'done', full: 'Closed' });
}

// Step 3: a lazy pipeline reads only what it needs.
const LINES = ['ok', 'ok', 'ERR', 'ok', 'ERR', 'ok', 'ok', 'ok'];
let consumed = 0;
function* readLines() {
  for (const l of LINES) {
    consumed++;
    yield l;
  }
}
function* onlyErrors(lines: Iterable<string>) {
  for (const l of lines) if (l === 'ERR') yield l;
}
const pipe = onlyErrors(readLines());
const afterFirst = (() => {
  pipe.next();
  return consumed;
})();
const afterSecond = (() => {
  pipe.next();
  return consumed;
})();
const afterAll = (() => {
  [...pipe];
  return consumed;
})();

// Step 4: yield from.
function* inner(): Generator<number, string, void> {
  yield 1;
  yield 2;
  return 'done';
}
function* outer(): Generator<number | string, void, void> {
  const result = yield* inner();
  yield result;
}
const FROM = [...outer()];

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const passes = (): ArrayState => ({
  rows: [
    { label: '1st list()', cells: FIRST, states: paint(3, () => 'found'), showIndex: false },
    { label: '2nd list()', cells: SECOND.length ? SECOND : ['[]'], states: paint(3, () => 'bad'), showIndex: false },
  ],
  stats: [
    { label: 'First pass', value: `[${FIRST.join(', ')}]`, tone: 'ok' },
    { label: 'Second pass', value: `[${SECOND.join(', ')}]`, tone: 'bad' },
    { label: 'Reusable', value: 'no', tone: 'bad' },
  ],
  note: { text: 'an iterator is single pass: once exhausted, iterating it again gives nothing', tone: 'bad' },
});

const life = (k: number): ArrayState => ({
  rows: [
    { label: 'call', cells: calls.map((c, i) => (i <= k ? c.call : '')), states: paint(4, (i) => (i === k ? 'active' : i < k ? 'done' : 'dim')), showIndex: false },
    { label: 'yields', cells: calls.map((c, i) => (i <= k ? c.yields : '')), states: paint(4, (i) => (i <= k ? 'found' : 'dim')), showIndex: false },
    { label: 'state', cells: calls.map((c, i) => (i <= k ? c.state : '')), states: paint(4, (i) => (i <= k ? 'visited' : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'State', value: calls[k].full.slice(0, 14) },
    { label: 'Yielded', value: calls[k].yields },
    { label: 'Printed', value: k >= 2 ? log[0] : '-', tone: k >= 2 ? 'ok' : 'neutral' },
  ],
  note: [{ text: 'calling gen() runs nothing: it only creates the generator object', tone: 'accent' as const }, { text: 'next() runs to the first yield and suspends the frame', tone: 'accent' as const }, { text: 'send("hi") resumes: x becomes "hi", it prints, then yields 2', tone: 'ok' as const }, { text: 'the body returned "done": that becomes the StopIteration value', tone: 'ok' as const }][k],
});

const lazy = (read: number, got: number): ArrayState => ({
  rows: [
    { label: 'lines', cells: LINES, states: paint(8, (i) => (i < read ? (LINES[i] === 'ERR' ? 'found' : 'visited') : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'Errors found', value: String(got), tone: 'ok' },
    { label: 'Lines read', value: `${read} of ${LINES.length}`, tone: read < LINES.length ? 'ok' : 'neutral' },
    { label: 'Memory', value: 'one line' },
  ],
  note: read < LINES.length ? { text: `the pipeline read ${read} lines to find error number ${got}, the rest were never touched`, tone: 'ok' } : { text: 'only exhausting the pipeline reads every line', tone: 'accent' },
});

const delegated = (): ArrayState => ({
  rows: [{ label: 'outer()', cells: FROM.map(String), states: paint(FROM.length, (i) => (i === FROM.length - 1 ? 'swap' : 'found')), showIndex: false }],
  stats: [
    { label: 'From inner', value: FROM.slice(0, 2).join(', '), tone: 'ok' },
    { label: 'inner returned', value: String(FROM[2]), tone: 'ok' },
    { label: 'Forwarded', value: 'next, send' },
  ],
  note: { text: 'yield from forwards the values and hands back the sub-generator\'s return value', tone: 'ok' },
});

export default defineLesson('array', {
  slug: 'py-generators',
  objectives: [
    { text: 'Why an iterator can only be used once', step: 1 },
    { text: 'How a generator resumes where it paused', step: 2 },
    { text: 'How a lazy pipeline reads only what it needs', step: 3 },
    { text: 'What yield from does', step: 4 },
  ],
  steps: [
    {
      label: 'Iterators',
      title: 'One pass only',
      tag: 'problem',
      body: ['An iterator has `__next__` and raises `StopIteration` when done. `iter([1, 2, 3])` is single pass.', 'The same is true of `map`, `zip`, `filter` and generator objects.'],
      keyIdea: 'A `range` is a reusable iterable, an iterator over it is not.',
      frames: [{ state: passes(), hold: 4200 }],
    },
    {
      label: 'Generators',
      title: 'A paused function',
      tag: 'concept',
      body: ['A function with `yield` returns a **generator**. Each `next()` resumes it until the next `yield`, keeping its locals in a suspended frame.', '`send(x)` makes the paused `yield` evaluate to `x`, and `return` becomes the `StopIteration` value.'],
      keyIdea: 'Locals survive between yields.',
      frames: [0, 1, 2, 3].map((k) => ({ state: life(k), hold: k === 3 ? 3800 : 2200 })),
    },
    {
      label: 'Pipelines',
      title: 'Lazy, one item at a time',
      tag: 'technique',
      body: ['`only_errors(read_lines(path))` chains two generators. Nothing runs until you ask for a value.', 'Asking for the first error reads only as many lines as it takes to find one.'],
      keyIdea: 'Constant memory, even for a 50 GB file.',
      frames: [{ state: lazy(afterFirst, 1), hold: 3200 }, { state: lazy(afterSecond, 2), hold: 3200 }, { state: lazy(afterAll, 2), hold: 3600 }],
    },
    {
      label: 'yield from',
      title: 'Delegate to a sub-generator',
      tag: 'in practice',
      body: ['`result = yield from inner()` forwards `next`, `send`, `throw` and `close` to `inner`, and gets its return value.', 'It was the basis of coroutines before `async` and `await`.'],
      keyIdea: 'async and await use the same suspended-frame machinery.',
      frames: [{ state: delegated(), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'Iterators and generators',
      tag: 'recap',
      body: [
        '- **Iterator:** single pass, `StopIteration` at the end.',
        '- **Generator:** a function you can pause.',
        '- **Pipeline:** lazy stages, constant memory.',
        '- **send, return:** two-way, with a final value.',
        '- **yield from:** delegation.',
      ],
      keyIdea: 'Reach for a generator when you can process items one at a time.',
      frames: [{ state: lazy(afterFirst, 1) }],
    },
  ],
});
