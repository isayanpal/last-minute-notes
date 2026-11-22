import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';

/*
 * Follows the Computer Fundamentals notes on average memory access time with the notes' numbers: one level (1 ns hit, 5 percent miss,
 * 100 ns penalty = 6 ns), a halved miss rate (3.5 ns), and two levels (L1 1 ns / 10 percent, L2 4 ns / 20 percent local, memory 80 ns = 3 ns).
 * Every AMAT is computed with the formula hit time + miss rate x miss penalty.
 */

const amat = (hit: number, miss: number, penalty: number) => hit + miss * penalty;
const r = (n: number) => Math.round(n * 100) / 100;

const ONE = { hit: 1, miss: 0.05, penalty: 100 };
const HALF = { ...ONE, miss: 0.025 };
const L2_AMAT = amat(4, 0.2, 80);
const TWO = amat(1, 0.1, L2_AMAT);
const NO_L2 = amat(1, 0.1, 80);
const GLOBAL_L2 = 0.1 * 0.2;

const bars = (hit: number, missTerm: number, total: number, labels: [string, string, string], note: ArrayState['note'], stats: ArrayState['stats']): ArrayState => ({
  rows: [{ label: 'ns', cells: [r(hit), r(missTerm), r(total)], bars: true, states: { 0: 'done', 1: 'bad', 2: 'found' }, pointers: [{ i: 0, label: labels[0] }, { i: 1, label: labels[1] }, { i: 2, label: labels[2], tone: 'ok' }], showIndex: false }],
  stats,
  note,
});

const one = (p: { hit: number; miss: number; penalty: number }, note: string): ArrayState =>
  bars(p.hit, p.miss * p.penalty, amat(p.hit, p.miss, p.penalty), ['hit', 'miss cost', 'AMAT'], { text: note, tone: 'accent' }, [
    { label: 'Miss rate', value: `${r(p.miss * 100)}%` },
    { label: 'Miss penalty', value: `${p.penalty} ns` },
    { label: 'AMAT', value: `${r(amat(p.hit, p.miss, p.penalty))} ns`, tone: 'ok' },
  ]);

export default defineLesson('array', {
  slug: 'cf-amat',
  objectives: [
    { text: 'How AMAT combines hit time, miss rate and penalty', step: 1 },
    { text: 'How strongly a small miss rate change matters', step: 2 },
    { text: 'How a second cache level cuts the penalty', step: 3 },
    { text: 'What local and global miss rates mean', step: 4 },
  ],
  steps: [
    {
      label: 'Formula',
      title: 'Hit time plus misses',
      tag: 'problem',
      body: ['**AMAT = hit time + miss rate x miss penalty.** With a 1 ns hit, 5 percent misses and a 100 ns penalty, that is 1 + 5 = 6 ns.', 'The hit looks fast, but misses dominate the average.'],
      keyIdea: 'The average is mostly miss cost.',
      frames: [{ state: one(ONE, `1 + 0.05 x 100 = ${r(amat(ONE.hit, ONE.miss, ONE.penalty))} ns`), hold: 4400 }],
    },
    {
      label: 'Miss rate',
      title: 'Halve the misses',
      tag: 'concept',
      body: ['Cut the miss rate from 5 percent to 2.5 percent and AMAT falls from 6 ns to 3.5 ns.', 'A small change in miss rate matters a lot, because the penalty is 100 times the hit time.'],
      keyIdea: 'Bigger caches, better layouts and prefetching all attack the miss rate.',
      frames: [{ state: one(HALF, `1 + 0.025 x 100 = ${r(amat(HALF.hit, HALF.miss, HALF.penalty))} ns`), hold: 4400 }],
    },
    {
      label: 'Two levels',
      title: 'Add an L2',
      tag: 'technique',
      body: ['L1 hits in 1 ns and misses 10 percent. L2 hits in 4 ns and misses 20 percent of what reaches it. Memory is 80 ns.', 'L2 AMAT is 4 + 0.2 x 80 = 20 ns, so the total is 1 + 0.1 x 20 = 3 ns.'],
      keyIdea: 'Each level\'s miss penalty is the next level\'s AMAT.',
      frames: [{ state: bars(1, 0.1 * L2_AMAT, TWO, ['L1 hit', 'miss cost', 'AMAT'], { text: `L2 AMAT = ${r(L2_AMAT)} ns, so total = 1 + 0.1 x ${r(L2_AMAT)} = ${r(TWO)} ns`, tone: 'ok' }, [{ label: 'L2 AMAT', value: `${r(L2_AMAT)} ns` }, { label: 'Total AMAT', value: `${r(TWO)} ns`, tone: 'ok' }, { label: 'L1 miss rate', value: '10%' }]), hold: 4600 }],
    },
    {
      label: 'Without L2',
      title: 'Three times worse',
      tag: 'trade-off',
      body: ['Without the L2, every L1 miss pays the full 80 ns: 1 + 0.1 x 80 = 9 ns.', 'The **local** miss rate of L2 is 20 percent, but its **global** miss rate is 0.1 x 0.2 = 2 percent of all accesses.'],
      keyIdea: 'Local divides by accesses to that level, global by all CPU accesses.',
      frames: [{ state: bars(1, 0.1 * 80, NO_L2, ['L1 hit', 'miss cost', 'AMAT'], { text: `no L2: ${r(NO_L2)} ns, ${r(NO_L2 / TWO)}x the ${r(TWO)} ns with it`, tone: 'bad' }, [{ label: 'AMAT, no L2', value: `${r(NO_L2)} ns`, tone: 'bad' }, { label: 'AMAT, with L2', value: `${r(TWO)} ns`, tone: 'ok' }, { label: 'L2 global miss', value: `${r(GLOBAL_L2 * 100)}%` }]), hold: 4600 }],
    },
    {
      label: 'Recap',
      title: 'AMAT',
      tag: 'recap',
      body: [
        '- **Formula:** hit time + miss rate x miss penalty.',
        '- **Miss penalty:** the next level\'s AMAT.',
        '- **Small changes:** a lower miss rate pays off a lot.',
        '- **Local vs global:** different denominators.',
        '- **Latency ladder:** memory is about 100 times slower than L1.',
      ],
      keyIdea: 'A cache level earns its place by cutting the penalty of the level above.',
      frames: [{ state: one(ONE, 'the same formula applies at every level of the hierarchy') }],
    },
  ],
});
