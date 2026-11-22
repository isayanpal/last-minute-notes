import { defineLesson } from '../define';
import type { GridState } from '../engines/grid';
import type { ItemState } from '../engines/common';

/*
 * Follows the TypeScript notes: { loading, data?, error? } allows combinations nobody meant,
 * and a status union has only the states you designed. The combinations are enumerated by real code.
 */

type Combo = { loading: boolean; data: boolean; error: boolean };
const COMBOS: Combo[] = Array.from({ length: 8 }, (_, n) => ({ loading: !!(n & 4), data: !!(n & 2), error: !!(n & 1) }));
// A combination is meaningful when at most one of the three signals is on (idle, loading, success, error).
const meaningful = (c: Combo) => [c.loading, c.data, c.error].filter(Boolean).length <= 1;
const VALID = COMBOS.filter(meaningful).length;
const IMPOSSIBLE = COMBOS.length - VALID;

const yn = (b: boolean) => (b ? 'T' : 'F');
const key = (r: number, c: number) => `${r},${c}`;

// Steps 1 and 2: the boolean flag design, optionally marking which rows are valid.
const flagsState = (mode: 'all' | 'valid' | 'invalid'): GridState => {
  const states: Record<string, ItemState> = {};
  COMBOS.forEach((c, r) => {
    const ok = meaningful(c);
    for (let col = 0; col < 4; col++) {
      states[key(r, col)] = mode === 'all' ? 'normal' : mode === 'valid' ? (ok ? 'found' : 'dim') : ok ? 'done' : 'bad';
    }
  });
  return {
    title: 'loading, data?, error? each on or off',
    colHeaders: ['load', 'data', 'err', 'valid'],
    rowHeaders: COMBOS.map((_, r) => `#${r + 1}`),
    cells: COMBOS.map((c) => [yn(c.loading), yn(c.data), yn(c.error), mode === 'all' ? '?' : meaningful(c) ? 'ok' : 'no']),
    states,
    stats: [
      { label: 'Combinations', value: String(COMBOS.length) },
      { label: 'You designed', value: mode === 'all' ? '?' : String(VALID), tone: mode === 'all' ? 'neutral' : 'ok' },
      { label: 'Impossible', value: mode === 'all' ? '?' : String(IMPOSSIBLE), tone: mode === 'all' ? 'neutral' : 'bad' },
    ],
    note:
      mode === 'all'
        ? { text: 'three independent fields give 2 x 2 x 2 possible states', tone: 'accent' }
        : mode === 'valid'
          ? { text: 'idle, loading, success and error are the four you meant', tone: 'ok' }
          : { text: 'the rest, like loading with an error, compile but make no sense', tone: 'bad' },
  };
};

// Steps 3 and 4: the status union.
const UNION = [
  { status: 'idle', data: false, error: false },
  { status: 'loading', data: false, error: false },
  { status: 'success', data: true, error: false },
  { status: 'error', data: false, error: true },
];
const unionState = (focus: 'all' | 'data' | 'error'): GridState => {
  const states: Record<string, ItemState> = {};
  UNION.forEach((u, r) => {
    states[key(r, 0)] = focus === 'all' ? 'found' : 'dim';
    states[key(r, 1)] = focus === 'data' ? (u.data ? 'found' : 'dim') : focus === 'all' ? 'found' : 'dim';
    states[key(r, 2)] = focus === 'error' ? (u.error ? 'found' : 'dim') : focus === 'all' ? 'found' : 'dim';
  });
  return {
    title: 'status: one of four variants',
    colHeaders: ['valid', 'data', 'error'],
    rowHeaders: UNION.map((u) => u.status),
    cells: UNION.map((u) => ['ok', u.data ? 'yes' : '-', u.error ? 'yes' : '-']),
    states,
    stats: [
      { label: 'States', value: String(UNION.length) },
      { label: 'Impossible', value: '0', tone: 'ok' },
      { label: 'Compiler', value: focus === 'all' ? 'checks all' : focus === 'data' ? 'data: success' : 'error: error', tone: 'ok' },
    ],
    note:
      focus === 'all'
        ? { text: 'four variants, so every state you can build is a state you meant', tone: 'ok' }
        : focus === 'data'
          ? { text: 'data exists only on the success variant, so you must check status first', tone: 'ok' }
          : { text: 'error exists only on the error variant, never next to data', tone: 'ok' },
  };
};

export default defineLesson('grid', {
  slug: 'ts-impossible-states',
  objectives: [
    { text: 'How independent fields multiply into states', step: 1 },
    { text: 'Which combinations nobody designed', step: 2 },
    { text: 'How a status union leaves only the real states', step: 3 },
    { text: 'How each variant carries its own data', step: 4 },
  ],
  steps: [
    {
      label: 'Flags',
      title: 'Independent fields multiply',
      tag: 'problem',
      body: ['`{ loading: boolean; data?: User[]; error?: string }` looks simple. Each field can be on or off independently.', 'Three fields mean **eight** possible states.'],
      keyIdea: 'Every extra independent field doubles the number of states you must reason about.',
      frames: [{ state: flagsState('all'), hold: 3200 }],
    },
    {
      label: 'Impossible',
      title: 'Half of them make no sense',
      tag: 'concept',
      body: ['You meant four states: idle, loading, success, error. The other four, like `data` and `error` both set, still compile.', 'Every component now has to guard against states that should never exist.'],
      keyIdea: 'If the type allows a state, some code will eventually produce it.',
      frames: [{ state: flagsState('valid'), hold: 2400 }, { state: flagsState('invalid'), hold: 3600 }],
    },
    {
      label: 'Union',
      title: 'Model the states, not the flags',
      tag: 'technique',
      body: ['A union of four variants, each with a `status` tag, has exactly four states.', 'There is no way to write `loading` together with `error`.'],
      keyIdea: 'Make impossible states unrepresentable.',
      frames: [{ state: unionState('all'), hold: 3400 }],
    },
    {
      label: 'Narrowing',
      title: 'Data lives on its variant',
      tag: 'in practice',
      body: ['`data` exists only on `success`, and `error` only on `error`. Reading `state.data` before checking `state.status` does not compile.', 'The compiler now enforces the correct UI logic.'],
      keyIdea: 'Cleaner UI code: a switch on status handles each state once, with the right data in hand.',
      frames: [{ state: unionState('data'), hold: 2800 }, { state: unionState('error'), hold: 3200 }],
    },
    {
      label: 'Recap',
      title: 'Designing state',
      tag: 'recap',
      body: [
        '- **Flags:** n independent fields give 2^n states.',
        '- **Cost:** most combinations are nonsense you must guard against.',
        '- **Union:** one tagged variant per real state.',
        '- **Payload:** each variant carries only its own data.',
        '- **Result:** the compiler enforces correctness.',
      ],
      keyIdea: 'Prefer a status union over a pile of booleans and optional fields.',
      frames: [{ state: unionState('all') }],
    },
  ],
});
