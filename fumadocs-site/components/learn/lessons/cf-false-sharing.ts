import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on MESI and false sharing. A real two-core MESI model runs the events, so every state letter and the
 * invalidation counts (3 in four writes, 1,999 in 2,000, 0 when padded) are computed. The write count of 2,000 is an EXAMPLE value.
 */

type S = 'M' | 'E' | 'S' | 'I';
class Mesi {
  lines: Record<string, [S, S]> = {};
  invalidations = 0;
  private st(line: string): [S, S] {
    return (this.lines[line] ??= ['I', 'I']);
  }
  read(c: 0 | 1, line: string) {
    const st = this.st(line);
    if (st[c] !== 'I') return;
    const o = (1 - c) as 0 | 1;
    if (st[o] !== 'I') {
      st[o] = 'S'; // a Modified copy writes back and becomes Shared
      st[c] = 'S';
    } else st[c] = 'E';
  }
  write(c: 0 | 1, line: string) {
    const st = this.st(line);
    const o = (1 - c) as 0 | 1;
    if (st[c] === 'M') return;
    if (st[o] !== 'I') {
      st[o] = 'I';
      this.invalidations++;
    }
    st[c] = 'M';
  }
  snap(line: string): [S, S] {
    return [...this.st(line)] as [S, S];
  }
}

type Ev = { label: string; core: 0 | 1; op: 'r' | 'w'; line: string };
const run = (events: Ev[]) => {
  const m = new Mesi();
  const trace = events.map((e) => {
    if (e.op === 'r') m.read(e.core, e.line);
    else m.write(e.core, e.line);
    return { e, s: { ...Object.fromEntries(Object.keys(m.lines).map((l) => [l, m.snap(l)])) }, inv: m.invalidations };
  });
  return { trace, inv: m.invalidations };
};

const BASIC = run([
  { label: 'c0 rd', core: 0, op: 'r', line: 'L' },
  { label: 'c1 rd', core: 1, op: 'r', line: 'L' },
  { label: 'c0 wr', core: 0, op: 'w', line: 'L' },
  { label: 'c1 rd', core: 1, op: 'r', line: 'L' },
]);
const SHARED = run([
  { label: 'c0:a', core: 0, op: 'w', line: 'L' },
  { label: 'c1:b', core: 1, op: 'w', line: 'L' },
  { label: 'c0:a', core: 0, op: 'w', line: 'L' },
  { label: 'c1:b', core: 1, op: 'w', line: 'L' },
]);
const PADDED = run([
  { label: 'c0:a', core: 0, op: 'w', line: 'La' },
  { label: 'c1:b', core: 1, op: 'w', line: 'Lb' },
  { label: 'c0:a', core: 0, op: 'w', line: 'La' },
  { label: 'c1:b', core: 1, op: 'w', line: 'Lb' },
]);
const WRITES = 2000;
const bigRun = (padded: boolean) =>
  run(Array.from({ length: WRITES }, (_, i) => ({ label: '', core: (i % 2) as 0 | 1, op: 'w' as const, line: padded ? (i % 2 ? 'Lb' : 'La') : 'L' }))).inv;
const BIG_SHARED = bigRun(false);
const BIG_PADDED = bigRun(true);

const TONE: Record<S, ItemState> = { M: 'swap', E: 'found', S: 'visited', I: 'dim' };
const paint = (cells: S[]): Record<number, ItemState> => Object.fromEntries(cells.map((s, i) => [i, TONE[s]])) as Record<number, ItemState>;

const view = (r: ReturnType<typeof run>, k: number, lineFor: (core: 0 | 1) => string, rowLabels: [string, string], note: ArrayState['note'], lines = 'one, shared'): ArrayState => {
  const shown = r.trace.slice(0, k);
  const col = (core: 0 | 1) => shown.map((t) => (t.s[lineFor(core)] ?? ['I', 'I'])[core]);
  const c0 = col(0);
  const c1 = col(1);
  const n = r.trace.length;
  return {
    rows: [
      { label: 'event', cells: r.trace.map((t, i) => (i < k ? t.e.label : '')), states: Object.fromEntries(r.trace.map((_, i) => [i, i === k - 1 ? 'active' : i < k ? 'done' : 'dim'])) as Record<number, ItemState>, showIndex: false },
      { label: rowLabels[0], cells: [...c0, ...Array(n - k).fill('')], states: paint([...c0, ...Array(n - k).fill('I')]), showIndex: false },
      { label: rowLabels[1], cells: [...c1, ...Array(n - k).fill('')], states: paint([...c1, ...Array(n - k).fill('I')]), showIndex: false },
    ],
    stats: [
      { label: 'Invalidations', value: String(shown.length ? shown[shown.length - 1].inv : 0), tone: shown.length && shown[shown.length - 1].inv ? 'bad' : 'ok' },
      { label: 'Events', value: `${k} of ${n}` },
      { label: 'Cache line', value: lines },
    ],
    note,
  };
};

const scale = (): ArrayState => ({
  rows: [
    { label: 'same line', cells: [BIG_SHARED], states: { 0: 'bad' }, showIndex: false },
    { label: 'padded', cells: [BIG_PADDED], states: { 0: 'found' }, showIndex: false },
  ],
  stats: [
    { label: 'Writes', value: WRITES.toLocaleString('en-US') },
    { label: 'Same line', value: `${BIG_SHARED} invalid.`, tone: 'bad' },
    { label: 'Padded', value: `${BIG_PADDED} invalid.`, tone: 'ok' },
  ],
  note: { text: `${WRITES} alternating writes: ${BIG_SHARED} invalidations on one line, ${BIG_PADDED} with one line each`, tone: 'accent' },
});

export default defineLesson('array', {
  slug: 'cf-false-sharing',
  objectives: [
    { text: 'How MESI states change on reads and writes', step: 1 },
    { text: 'How two threads fight over one line', step: 2 },
    { text: 'How padding gives each thread its own line', step: 3 },
    { text: 'How large the cost becomes', step: 4 },
  ],
  steps: [
    {
      label: 'MESI',
      title: 'Four line states',
      tag: 'problem',
      body: ['Each core has a private cache, so the same line can live in several places. **MESI** keeps them consistent: Modified, Exclusive, Shared, Invalid.', 'A read of an unshared line gives Exclusive, a second reader makes both Shared, a write makes one Modified and the other Invalid.'],
      keyIdea: 'A write needs the line exclusively, so it invalidates every other copy.',
      frames: [1, 2, 3, 4].map((k) => ({ state: view(BASIC, k, () => 'L', ['core 0', 'core 1'], { text: ['core 0 reads: no other copy, so Exclusive', 'core 1 reads: both caches now hold it Shared', 'core 0 writes: it becomes Modified and core 1 is invalidated', 'core 1 reads again: the line goes back to Shared'][k - 1], tone: 'accent' }), hold: k === 4 ? 3400 : 1800 })),
    },
    {
      label: 'Same line',
      title: 'Different variables, one line',
      tag: 'concept',
      body: ['Thread 1 writes `a` and thread 2 writes `b`, but both sit in the same 64-byte line.', 'Every write invalidates the other core\'s copy, so the line bounces between cores.'],
      keyIdea: 'False sharing: no shared data logically, shared line physically.',
      frames: [1, 2, 3, 4].map((k) => ({ state: view(SHARED, k, () => 'L', ['core 0', 'core 1'], { text: k === 4 ? `${SHARED.inv} invalidations in 4 writes, and the line never stays put` : 'the line moves to the writing core and the other copy dies', tone: 'bad' }), hold: k === 4 ? 3600 : 1500 })),
    },
    {
      label: 'Padding',
      title: 'One line each',
      tag: 'technique',
      body: ['Pad or align each counter to its own line with `alignas(64)`, `@Contended` or a padding field.', 'Now each core keeps its line Modified and nothing is invalidated.'],
      keyIdea: 'Per-thread counters merged at the end avoid the problem entirely.',
      frames: [1, 2, 3, 4].map((k) => ({ state: view(PADDED, k, (c) => (c === 0 ? 'La' : 'Lb'), ['c0 line a', 'c1 line b'], { text: k === 4 ? `${PADDED.inv} invalidations: each thread owns its line` : 'each write stays in its own cache', tone: 'ok' }, 'two, own'), hold: k === 4 ? 3600 : 1500 })),
    },
    {
      label: 'Cost',
      title: 'At scale',
      tag: 'trade-off',
      body: [`With ${WRITES} alternating writes, one shared line takes ${BIG_SHARED} invalidations. Padded counters take none.`, 'Symptom: a program that gets slower with more threads, and coherence traffic in `perf c2c`.'],
      keyIdea: 'LongAdder in Java stripes counters to avoid contention.',
      frames: [{ state: scale(), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'MESI and false sharing',
      tag: 'recap',
      body: [
        '- **MESI:** Modified, Exclusive, Shared, Invalid.',
        '- **Write:** invalidates other copies.',
        '- **False sharing:** independent data in one line.',
        '- **Fix:** pad or align to the line size.',
        '- **Coherence:** orders one address, not many.',
      ],
      keyIdea: 'Lay out hot per-thread data on separate cache lines.',
      frames: [{ state: scale() }],
    },
  ],
});
