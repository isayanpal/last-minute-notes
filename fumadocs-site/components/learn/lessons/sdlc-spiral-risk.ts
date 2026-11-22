import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the SDLC notes on the Spiral model: every loop does plan, risk analysis, engineering and evaluation, each loop is wider and costlier,
 * and the risk step comes before real engineering. The cost units are EXAMPLE values (loop n costs twice loop n-1). The wasted cost of finding
 * a risk in loop 1 or at the end is summed from those loops.
 */

const LOOPS = [1, 2, 4, 8]; // cost of each wider loop, in example units
const TOTAL = LOOPS.reduce((a, b) => a + b, 0);
const WASTE_EARLY = LOOPS[0]; // a throwaway prototype in the first loop
const WASTE_LATE = TOTAL; // everything was built before the unknown was tested

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const steps = (active: number, note: ArrayState['note']): ArrayState => ({
  rows: [{ label: 'one loop', cells: ['plan', 'risk', 'build', 'eval'], states: paint(4, (i) => (i === active ? 'active' : i < active ? 'done' : 'normal')), showIndex: false }],
  stats: [
    { label: 'Activities', value: '4 per loop' },
    { label: 'First real step', value: 'risk analysis', tone: 'ok' },
    { label: 'Loops here', value: String(LOOPS.length) },
  ],
  note,
});

const widening = (): ArrayState => ({
  rows: [{ label: 'loop cost', cells: LOOPS, bars: true, states: paint(4, () => 'visited'), pointers: LOOPS.map((_, i) => ({ i, label: `loop ${i + 1}` })), showIndex: false }],
  stats: [
    { label: 'Loop 1 costs', value: String(LOOPS[0]) },
    { label: 'Loop 4 costs', value: String(LOOPS[3]) },
    { label: 'Total', value: String(TOTAL) },
  ],
  note: { text: 'each loop is wider and costlier, so unknowns are best settled in the cheap early loops', tone: 'accent' },
});

const found = (early: boolean): ArrayState => ({
  rows: [
    { label: 'spent', cells: early ? [LOOPS[0]] : LOOPS.map((_, i) => LOOPS.slice(0, i + 1).reduce((a, b) => a + b, 0)), bars: true, states: early ? { 0: 'found' } : paint(4, (i) => (i === 3 ? 'bad' : 'visited')), pointers: early ? [{ i: 0, label: 'prototype' }] : LOOPS.map((_, i) => ({ i, label: `loop ${i + 1}` })), showIndex: false },
  ],
  stats: [
    { label: 'Risk found in', value: early ? 'loop 1' : 'the end', tone: early ? 'ok' : 'bad' },
    { label: 'Wasted', value: String(early ? WASTE_EARLY : WASTE_LATE), tone: early ? 'ok' : 'bad' },
    { label: 'Share of total', value: `${Math.round(((early ? WASTE_EARLY : WASTE_LATE) / TOTAL) * 100)}%` },
  ],
  note: early ? { text: `a throwaway prototype in loop 1 showed the matching algorithm cannot take bursts, at a cost of ${WASTE_EARLY}`, tone: 'ok' } : { text: `found only after building everything, the same problem wastes all ${WASTE_LATE} units`, tone: 'bad' },
});

export default defineLesson('array', {
  slug: 'sdlc-spiral-risk',
  objectives: [
    { text: 'What happens in each loop', step: 1 },
    { text: 'Why loops get wider', step: 2 },
    { text: 'What finding a risk early saves', step: 3 },
    { text: 'What finding it late costs', step: 4 },
  ],
  steps: [
    {
      label: 'A loop',
      title: 'Plan, risk, build, evaluate',
      tag: 'problem',
      body: ['The **Spiral** model repeats four activities: plan, risk analysis, engineering and evaluation.', 'Risk analysis comes **before** any real engineering in each loop.'],
      keyIdea: 'Spiral is iterative development with explicit risk handling.',
      frames: [0, 1, 2, 3].map((i) => ({ state: steps(i, [{ text: 'objectives, alternatives and constraints', tone: 'accent' as const }, { text: 'prototype the riskiest unknown first', tone: 'ok' as const }, { text: 'build and test this loop\'s deliverable', tone: 'accent' as const }, { text: 'the customer reviews the result', tone: 'accent' as const }][i]), hold: i === 3 ? 2800 : 1600 })),
    },
    {
      label: 'Wider loops',
      title: 'Each pass costs more',
      tag: 'concept',
      body: ['Every loop is wider than the last, so it costs more. The first loop is a small prototype.', 'The cost units here are examples that double each loop.'],
      keyIdea: 'Resolve the unknowns while loops are still cheap.',
      frames: [{ state: widening(), hold: 4200 }],
    },
    {
      label: 'Found early',
      title: 'A throwaway prototype',
      tag: 'technique',
      body: ['A fintech team spends loop 1 on a throwaway prototype to test whether the matching algorithm handles order bursts.', 'It does not, and the team learns that for a fraction of the project cost.'],
      keyIdea: 'Prototype the riskiest assumption before committing.',
      frames: [{ state: found(true), hold: 4400 }],
    },
    {
      label: 'Found late',
      title: 'The same risk at the end',
      tag: 'trade-off',
      body: ['Without risk analysis the team builds everything and discovers the problem at the end.', 'All of the effort is already spent.'],
      keyIdea: 'Late discovery is the expensive one.',
      frames: [{ state: found(false), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'The Spiral model',
      tag: 'recap',
      body: [
        '- **Four activities** per loop.',
        '- **Risk first:** before engineering.',
        '- **Wider loops:** costlier each time.',
        '- **Best for:** large, high-risk, high-cost projects.',
        '- **Cost:** more process overhead.',
      ],
      keyIdea: `Early risk work cost ${WASTE_EARLY} here against ${WASTE_LATE}.`,
      frames: [{ state: found(true) }],
    },
  ],
});
