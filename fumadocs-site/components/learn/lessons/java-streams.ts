import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Java notes on streams: lazy pipeline, one element at a time through every stage, short-circuiting limit,
 * and a stream that can be consumed once. A small lazy pipeline is run for real and records what each element did.
 */

const SOURCE = [1, 2, 3, 4, 5, 6];
type Trace = { value: number; passed: boolean; mapped?: number; emitted: boolean };

// nums.stream().filter(n -> n % 2 == 0).map(n -> n * n).limit(2)
function runPipeline(limit: number): { trace: Trace[]; out: number[] } {
  const trace: Trace[] = [];
  const out: number[] = [];
  for (const n of SOURCE) {
    if (out.length >= limit) break;
    if (n % 2 !== 0) {
      trace.push({ value: n, passed: false, emitted: false });
      continue;
    }
    const sq = n * n;
    out.push(sq);
    trace.push({ value: n, passed: true, mapped: sq, emitted: true });
  }
  return { trace, out };
}
const RUN = runPipeline(2);
const TOUCHED = RUN.trace.length;

const consumeTwice = (() => {
  let consumed = false;
  const terminal = () => {
    if (consumed) return 'IllegalStateException';
    consumed = true;
    return 'ok';
  };
  return [terminal(), terminal()];
})();

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

// Step 1: building a pipeline runs nothing.
const lazyState = (terminal: boolean): ArrayState => ({
  rows: [
    { label: 'source', cells: SOURCE, states: paint(6, () => (terminal ? 'visited' : 'normal')), showIndex: false },
    { label: 'filter', cells: SOURCE.map(() => ''), states: paint(6, () => 'dim'), showIndex: false },
    { label: 'map', cells: SOURCE.map(() => ''), states: paint(6, () => 'dim'), showIndex: false },
  ],
  stats: [
    { label: 'Pipeline', value: 'filter, map' },
    { label: 'Terminal op', value: terminal ? 'collect' : 'none', tone: terminal ? 'ok' : 'bad' },
    { label: 'Elements run', value: terminal ? 'about to' : '0', tone: terminal ? 'ok' : 'bad' },
  ],
  note: terminal ? { text: 'collect() is the terminal operation: now the pipeline runs', tone: 'ok' } : { text: 'filter and map are lazy: building the pipeline does no work', tone: 'bad' },
});

// Step 2: each element goes through the whole pipeline before the next starts.
const flowState = (upto: number): ArrayState => {
  const seen = RUN.trace.slice(0, upto + 1);
  const cur = seen[seen.length - 1];
  return {
    rows: [
      { label: 'source', cells: SOURCE, states: paint(6, (i) => (i === upto ? 'active' : i < upto ? 'visited' : 'normal')), showIndex: false },
      { label: 'filter', cells: SOURCE.map((_, i) => (i <= upto ? (RUN.trace[i].passed ? 'even' : 'drop') : '')), states: paint(6, (i) => (i > upto ? 'dim' : RUN.trace[i].passed ? 'found' : 'bad')), showIndex: false },
      { label: 'map', cells: SOURCE.map((_, i) => (i <= upto && RUN.trace[i].passed ? RUN.trace[i].mapped! : '')), states: paint(6, (i) => (i <= upto && RUN.trace[i].passed ? 'swap' : 'dim')), showIndex: false },
    ],
    stats: [
      { label: 'Element', value: String(cur.value) },
      { label: 'filter even', value: cur.passed ? 'passes' : 'dropped', tone: cur.passed ? 'ok' : 'bad' },
      { label: 'Collected', value: `[${RUN.trace.slice(0, upto + 1).filter((t) => t.emitted).map((t) => t.mapped).join(', ')}]` },
    ],
    note: cur.passed ? { text: `${cur.value} survives filter, map squares it to ${cur.mapped}`, tone: 'ok' } : { text: `${cur.value} is dropped by filter and never reaches map`, tone: 'bad' },
  };
};

// Step 3: limit(2) stops the pipeline early.
const shortState = (): ArrayState => ({
  rows: [
    { label: 'source', cells: SOURCE, states: paint(6, (i) => (i < TOUCHED ? 'visited' : 'dim')), showIndex: false },
    { label: 'collected', cells: RUN.out, states: paint(RUN.out.length, () => 'found'), showIndex: false },
  ],
  stats: [
    { label: 'limit', value: '2' },
    { label: 'Elements read', value: `${TOUCHED} of ${SOURCE.length}`, tone: 'ok' },
    { label: 'Never touched', value: SOURCE.slice(TOUCHED).join(', '), tone: 'ok' },
  ],
  note: { text: `after ${RUN.out.length} results limit is satisfied, so ${SOURCE.slice(TOUCHED).join(' and ')} are never read`, tone: 'ok' },
});

// Step 4: one terminal operation per stream.
const onceState = (phase: 1 | 2): ArrayState => ({
  rows: [
    { label: 'stream', cells: ['s'], states: { 0: phase === 1 ? 'active' : 'done' }, showIndex: false },
    { label: 'terminal 1', cells: [phase >= 1 ? consumeTwice[0] : ''], states: { 0: 'found' }, showIndex: false },
    { label: 'terminal 2', cells: [phase === 2 ? 'error' : ''], states: { 0: phase === 2 ? 'bad' : 'dim' }, showIndex: false },
  ],
  stats: [
    { label: '1st terminal', value: consumeTwice[0], tone: 'ok' },
    { label: '2nd terminal', value: phase === 2 ? 'exception' : '-', tone: phase === 2 ? 'bad' : 'neutral' },
    { label: 'Fix', value: phase === 2 ? 'new stream' : '-' },
  ],
  note: phase === 1 ? { text: 'a terminal operation consumes the stream', tone: 'accent' } : { text: 'reusing a consumed stream throws IllegalStateException: build a new one', tone: 'bad' },
});

export default defineLesson('array', {
  slug: 'java-streams',
  objectives: [
    { text: 'Why a stream does nothing until a terminal operation', step: 1 },
    { text: 'How each element flows through the whole pipeline', step: 2 },
    { text: 'How limit short-circuits the work', step: 3 },
    { text: 'Why a stream can be used once', step: 4 },
  ],
  steps: [
    {
      label: 'Lazy',
      title: 'Nothing runs yet',
      tag: 'problem',
      body: ['A stream is a **lazy pipeline**: source, intermediate operations such as `filter` and `map`, and one terminal operation.', 'Without the terminal operation, no element is processed.'],
      keyIdea: 'Intermediate operations describe the work, the terminal operation triggers it.',
      frames: [{ state: lazyState(false), hold: 2800 }, { state: lazyState(true), hold: 2600 }],
    },
    {
      label: 'One by one',
      title: 'Elements flow through together',
      tag: 'concept',
      body: ['Elements move **one at a time through the whole pipeline**, not stage by stage over the whole list.', 'Element 1 is filtered, mapped and collected before element 2 starts.'],
      keyIdea: 'No intermediate list is built between stages.',
      frames: [0, 1, 2, 3].map((k) => ({ state: flowState(k), hold: 1900 })),
    },
    {
      label: 'Short-circuit',
      title: 'limit stops early',
      tag: 'technique',
      body: ['`limit(2)` stops the pipeline once two results exist. The remaining elements are never read.', '`findFirst` and `anyMatch` short-circuit in the same way.'],
      keyIdea: 'Laziness means work you do not need is never done.',
      frames: [{ state: shortState(), hold: 4000 }],
    },
    {
      label: 'Once only',
      title: 'A stream is consumed once',
      tag: 'trade-off',
      body: ['After a terminal operation the stream is spent. Using it again throws `IllegalStateException`.', 'A stream is not a data structure and it never modifies its source.'],
      keyIdea: 'Need two passes? Create two streams from the source.',
      frames: [{ state: onceState(1), hold: 2400 }, { state: onceState(2), hold: 3400 }],
    },
    {
      label: 'Recap',
      title: 'Streams in one page',
      tag: 'recap',
      body: [
        '- **Shape:** source, intermediate operations, one terminal operation.',
        '- **Lazy:** nothing runs until the terminal operation.',
        '- **Per element:** each goes through the whole pipeline.',
        '- **Short-circuit:** `limit`, `findFirst` stop early.',
        '- **Single use:** reuse throws `IllegalStateException`.',
      ],
      keyIdea: 'Read a pipeline as a recipe, and ask which operation triggers it.',
      frames: [{ state: shortState() }],
    },
  ],
});
