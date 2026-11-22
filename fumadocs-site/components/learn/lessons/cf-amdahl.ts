import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';

/*
 * Follows the Computer Fundamentals notes on Amdahl's law and the CPU performance equation. Every value is the notes' formula evaluated:
 * speedup = 1 / ((1 - p) + p / s), and CPU time = instructions x CPI / clock rate with 2 billion instructions at CPI 1.5 on 3 GHz.
 */

const speedup = (p: number, s: number) => 1 / (1 - p + p / s);
const r = (n: number) => Math.round(n * 100) / 100;
const CORES = [2, 4, 8, 16, 64];
const P90 = 0.9;
const P99 = 0.99;

const cpuTime = (instr: number, cpi: number, ghz: number) => (instr * cpi) / (ghz * 1e9);
const BASE_T = cpuTime(2e9, 1.5, 3);
const HALF_CPI = cpuTime(2e9, 0.75, 3);
const FAST_CLK = cpuTime(2e9, 1.5, 4);

const speedups = (p: number, count: number, note: ArrayState['note'], limitNote: string): ArrayState => ({
  rows: [{ label: 'speedup', cells: CORES.slice(0, count).map((s) => r(speedup(p, s))), bars: true, states: { 0: 'found', 1: 'found', 2: 'found', 3: 'found', 4: 'found' }, pointers: CORES.slice(0, count).map((s, i) => ({ i, label: `${s}x` })), showIndex: false }],
  stats: [
    { label: 'Parallel part', value: `${Math.round(p * 100)}%` },
    { label: 'Best at last', value: `${r(speedup(p, CORES[count - 1]))}x`, tone: 'ok' },
    { label: 'Hard limit', value: limitNote, tone: 'bad' },
  ],
  note,
});

const time = (cells: number[], labels: string[], note: ArrayState['note']): ArrayState => ({
  rows: [{ label: 'seconds', cells: cells.map(r), bars: true, states: { 0: 'visited', 1: 'found', 2: 'found' }, pointers: labels.map((l, i) => ({ i, label: l })), showIndex: false }],
  stats: [
    { label: 'Instructions', value: '2 billion' },
    { label: 'CPI, clock', value: '1.5, 3 GHz' },
    { label: 'Baseline', value: `${r(BASE_T)} s`, tone: 'ok' },
  ],
  note,
});

export default defineLesson('array', {
  slug: 'cf-amdahl',
  objectives: [
    { text: 'Why serial work limits parallel speedup', step: 1 },
    { text: 'Where the limit comes from', step: 2 },
    { text: 'What a higher parallel fraction buys', step: 3 },
    { text: 'How the CPU time equation splits performance', step: 4 },
  ],
  steps: [
    {
      label: 'Serial part',
      title: '8 cores, not 8 times faster',
      tag: 'problem',
      body: ['Suppose 90 percent of a program parallelises perfectly and 10 percent is serial.', 'On 8 cores the speedup is 1 / (0.1 + 0.9 / 8) = 4.7, nowhere near 8.'],
      keyIdea: 'Speedup is limited by the part you do not improve.',
      frames: [{ state: speedups(P90, 3, { text: `8 cores give ${r(speedup(P90, 8))}x, not 8x`, tone: 'bad' }, '10x'), hold: 4600 }],
    },
    {
      label: 'The cap',
      title: 'Even infinite cores',
      tag: 'concept',
      body: ['As the number of cores grows the parallel part shrinks to nothing, and the serial 10 percent remains.', 'The speedup can never exceed 1 / 0.1 = 10.'],
      keyIdea: 'Amdahl\'s law: speedup = 1 / ((1 - p) + p / s).',
      frames: [{ state: speedups(P90, 5, { text: `64 cores reach ${r(speedup(P90, 64))}x, still under the cap of 10`, tone: 'bad' }, '10x'), hold: 4800 }],
    },
    {
      label: 'More parallel',
      title: 'Shrink the serial part',
      tag: 'technique',
      body: ['If 99 percent is parallel, the cap rises to 100 and 64 cores give about 39 times.', 'The cheapest gains often come from removing serial work, not adding cores.'],
      keyIdea: 'Gustafson\'s view: bigger machines solve bigger problems, so the serial share shrinks.',
      frames: [{ state: speedups(P99, 5, { text: `at 99 percent parallel, 64 cores give ${r(speedup(P99, 64))}x`, tone: 'ok' }, '100x'), hold: 4800 }],
    },
    {
      label: 'CPU time',
      title: 'Instructions x CPI x period',
      tag: 'in practice',
      body: ['CPU time = instruction count x CPI x clock period. Two billion instructions at CPI 1.5 on 3 GHz take 1 second.', 'Halving CPI helps as much as halving the instruction count, and a 4 GHz clock gives 0.75 s.'],
      keyIdea: 'Instruction count comes from the algorithm and compiler, CPI from the microarchitecture, clock rate from the process.',
      frames: [{ state: time([BASE_T, HALF_CPI, FAST_CLK], ['base', 'CPI/2', '4 GHz'], { text: `baseline ${r(BASE_T)} s, half the CPI ${r(HALF_CPI)} s, 4 GHz ${r(FAST_CLK)} s`, tone: 'accent' }), hold: 4800 }],
    },
    {
      label: 'Recap',
      title: 'Measuring speed',
      tag: 'recap',
      body: [
        '- **Amdahl:** the serial part caps speedup.',
        '- **Cap:** 1 / (1 - p).',
        '- **CPU time:** instructions x CPI x period.',
        '- **Contention and bandwidth:** add further limits.',
        '- **Measure:** use `perf stat` on the real program.',
      ],
      keyIdea: 'Find the serial fraction before buying more cores.',
      frames: [{ state: speedups(P90, 5, { text: 'the curve flattens toward 10x as cores grow', tone: 'accent' }, '10x') }],
    },
  ],
});
