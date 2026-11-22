import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the TypeScript notes: any switches checking off, unknown forces a check, typeof / instanceof / in narrow.
 * The runtime results come from running real JavaScript at module load, including the typeof null trap.
 */

const anyCrash = (() => {
  try {
    (10 as unknown as { toUpperCase(): string }).toUpperCase();
    return false;
  } catch (e) {
    return e instanceof TypeError;
  }
})();
const upper = 'hi'.toUpperCase();

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

// Step 1: any turns the checker off, the crash moves to runtime.
const anyState = (phase: 0 | 1 | 2): ArrayState => ({
  rows: [
    { label: 'value: any', cells: [10], states: { 0: 'active' }, showIndex: false },
    { label: 'compiler', cells: [phase >= 1 ? 'pass' : '-'], states: { 0: phase >= 1 ? 'found' : 'dim' }, showIndex: false },
    { label: 'runtime', cells: [phase >= 2 ? (anyCrash ? 'crash' : 'ok') : '-'], states: { 0: phase >= 2 ? 'bad' : 'dim' }, showIndex: false },
  ],
  stats: [
    { label: 'Call', value: 'toUpperCase()' },
    { label: 'Compile time', value: phase >= 1 ? 'no error' : '-', tone: phase >= 1 ? 'bad' : 'neutral' },
    { label: 'Run time', value: phase >= 2 ? 'TypeError' : '-', tone: phase >= 2 ? 'bad' : 'neutral' },
  ],
  note: phase === 2 ? { text: 'any compiled a call that cannot work, so the bug shipped', tone: 'bad' } : { text: 'any accepts every operation without checking', tone: 'accent' },
});

// Step 2: unknown accepts every value but allows nothing until narrowed.
const unknownState = (phase: 0 | 1 | 2): ArrayState => ({
  rows: [
    { label: 'unknown', cells: [phase === 2 ? 'hi' : 10], states: { 0: 'active' }, showIndex: false },
    { label: 'compiler', cells: [phase === 0 ? '-' : phase === 1 ? 'error' : 'pass'], states: { 0: phase === 0 ? 'dim' : phase === 1 ? 'bad' : 'found' }, showIndex: false },
    { label: 'runtime', cells: [phase === 2 ? upper : '-'], states: { 0: phase === 2 ? 'found' : 'dim' }, showIndex: false },
  ],
  stats: [
    { label: 'Direct use', value: phase === 0 ? '-' : 'blocked', tone: phase === 0 ? 'neutral' : 'ok' },
    { label: 'After typeof', value: phase === 2 ? 'string' : '-', tone: phase === 2 ? 'ok' : 'neutral' },
    { label: 'Result', value: phase === 2 ? upper : '-', tone: phase === 2 ? 'ok' : 'neutral' },
  ],
  note: phase === 0 ? { text: 'unknown is the safe top type: anything can be assigned to it', tone: 'accent' } : phase === 1 ? { text: 'compile error: you must prove the type before you use it', tone: 'bad' } : { text: 'if (typeof value === "string") narrows it, so the call is safe', tone: 'ok' },
});

// Step 3: typeof narrowing, run on real values.
const VALUES: unknown[] = [42, 'hi', true, null, [1, 2]];
const LABELS = ['42', 'hi', 'true', 'null', 'arr'];
const TYPEOF = VALUES.map((v) => typeof v);
const IS_STRING = VALUES.map((v) => typeof v === 'string');

const typeofState = (k: number): ArrayState => ({
  rows: [
    { label: 'value', cells: LABELS, states: paint(5, (i) => (i === k ? 'active' : i < k ? 'visited' : 'normal')), showIndex: false },
    { label: 'is string', cells: LABELS.map((_, i) => (i <= k ? (IS_STRING[i] ? 'yes' : 'no') : '-')), states: paint(5, (i) => (i > k ? 'dim' : IS_STRING[i] ? 'found' : 'done')), showIndex: false },
  ],
  panels: [{ title: 'typeof value', kind: 'list', items: TYPEOF.slice(0, k + 1).map((t, i) => `${LABELS[i]}: ${t}`), highlight: k }],
  stats: [
    { label: 'Check', value: 'typeof v' },
    { label: 'Strings', value: String(IS_STRING.slice(0, k + 1).filter(Boolean).length), tone: 'ok' },
    { label: 'Checked', value: `${k + 1} of 5` },
  ],
  note: k === 3 ? { text: 'typeof null is "object", an old JavaScript quirk to remember', tone: 'bad' } : { text: 'each branch gets the narrowed type inside the if', tone: 'accent' },
});

// Step 4: instanceof and in narrow object types.
const OBJS: unknown[] = [new Date(0), new Error('x'), { radius: 1 }, { size: 2 }];
const OBJ_LABELS = ['Date', 'Error', '{r}', '{s}'];
const IS_DATE = OBJS.map((v) => v instanceof Date);
const HAS_RADIUS = OBJS.map((v) => typeof v === 'object' && v !== null && 'radius' in v);

const objectState = (phase: 1 | 2): ArrayState => ({
  rows: [
    { label: 'value', cells: OBJ_LABELS, states: paint(4, () => 'normal'), showIndex: false },
    { label: 'is Date', cells: IS_DATE.map((b) => (b ? 'yes' : 'no')), states: paint(4, (i) => (IS_DATE[i] ? 'found' : 'done')), showIndex: false },
    ...(phase === 2 ? [{ label: 'has radius', cells: HAS_RADIUS.map((b) => (b ? 'yes' : 'no')), states: paint(4, (i) => (HAS_RADIUS[i] ? 'found' : 'done')), showIndex: false }] : []),
  ],
  stats: [
    { label: phase === 1 ? 'Check' : 'Checks', value: phase === 1 ? 'instanceof' : 'in, instanceof' },
    { label: 'Date matches', value: String(IS_DATE.filter(Boolean).length), tone: 'ok' },
    { label: 'Radius matches', value: phase === 2 ? String(HAS_RADIUS.filter(Boolean).length) : '-', tone: phase === 2 ? 'ok' : 'neutral' },
  ],
  note: phase === 1 ? { text: 'instanceof narrows to a class: Date methods become available', tone: 'ok' } : { text: '"radius" in v narrows to the shape that has that property', tone: 'ok' },
});

export default defineLesson('array', {
  slug: 'ts-unknown-narrowing',
  objectives: [
    { text: 'Why any moves the bug to runtime', step: 1 },
    { text: 'How unknown forces you to check first', step: 2 },
    { text: 'How typeof narrows, and the typeof null trap', step: 3 },
    { text: 'How instanceof and in narrow objects', step: 4 },
  ],
  steps: [
    {
      label: 'any',
      title: 'any switches the checker off',
      tag: 'problem',
      body: ['A value typed `any` accepts every operation, so `v.toUpperCase()` compiles even when `v` is `10`.', 'The mistake is not caught at compile time, it crashes later at runtime.'],
      keyIdea: 'any is not a type, it is an opt-out from type checking.',
      frames: [{ state: anyState(0), hold: 1800 }, { state: anyState(1), hold: 1800 }, { state: anyState(2), hold: 3200 }],
    },
    {
      label: 'unknown',
      title: 'unknown forces a check',
      tag: 'concept',
      body: ['`unknown` also accepts any value, but you cannot call anything on it until you **narrow** it.', 'The check proves the type to the compiler, and the call becomes safe.'],
      keyIdea: 'Prefer `unknown` over `any`, always.',
      frames: [{ state: unknownState(0), hold: 1800 }, { state: unknownState(1), hold: 2200 }, { state: unknownState(2), hold: 3200 }],
    },
    {
      label: 'typeof',
      title: 'Narrowing with typeof',
      tag: 'technique',
      body: ['`typeof value === "string"` narrows inside the `if`. The compiler follows the control flow, not just the declaration.', 'It works for strings, numbers and booleans, but `typeof null` is `"object"`.'],
      keyIdea: 'Narrow with the cheapest check that proves the type, then use the value.',
      frames: [0, 1, 2, 3, 4].map((k) => ({ state: typeofState(k), hold: k === 3 ? 2800 : 1500 })),
    },
    {
      label: 'in, instanceof',
      title: 'Narrowing objects',
      tag: 'technique',
      body: ['`instanceof` narrows to a class such as `Date`. The `in` operator narrows to the variant that has a given property.', 'Both are checked at runtime, so the narrowing is real.'],
      keyIdea: 'For your own shapes, write a type guard: `(v): v is User` tells the compiler what true proves.',
      frames: [{ state: objectState(1), hold: 2800 }, { state: objectState(2), hold: 3200 }],
    },
    {
      label: 'Recap',
      title: 'Check before you use',
      tag: 'recap',
      body: [
        '- **any:** no checking, the crash moves to runtime.',
        '- **unknown:** accepts anything, allows nothing until narrowed.',
        '- **typeof:** narrows primitives, and `typeof null` is `"object"`.',
        '- **instanceof and in:** narrow classes and object shapes.',
        '- **Type guards:** `value is T` lets you reuse a check.',
      ],
      keyIdea: 'Not narrowing unknown, and overusing any, are the two classic interview traps.',
      frames: [{ state: unknownState(2) }],
    },
  ],
});
