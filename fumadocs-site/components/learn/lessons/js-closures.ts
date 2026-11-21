import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * The numbers are produced by running real closures at module load, so 1 2 3, 3 3 3 and 0 1 2 are what JavaScript actually returns.
 */

const makeCounter = () => {
  let count = 0;
  return () => ++count;
};
const counter = makeCounter();
const calls = [counter(), counter(), counter()];

const varFns: (() => number)[] = [];
{
  var i: number; // eslint-disable-line no-var
  for (i = 0; i < 3; i++) varFns.push(() => i);
}
const varOut = varFns.map((f) => f());

const letFns: (() => number)[] = [];
for (let j = 0; j < 3; j++) letFns.push(() => j);
const letOut = letFns.map((f) => f());

const a = makeCounter();
const b = makeCounter();
const aOut = [a(), a()];
const bOut = [b()];

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

// Step 1: a closure remembers its scope between calls.
const counterState = (n: number): ArrayState => ({
  rows: [
    { label: 'call', cells: ['#1', '#2', '#3'], states: paint(3, (k) => (k < n ? 'done' : 'dim')), showIndex: false },
    { label: 'count', cells: calls.map((v, k) => (k < n ? v : '-')), states: paint(3, (k) => (k < n ? 'found' : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'Returned', value: calls.slice(0, n).join(' ') || '-' },
    { label: 'count lives in', value: 'outer scope' },
    { label: 'Reset between calls', value: 'no', tone: 'ok' },
  ],
  note: { text: 'each counter() call updates the same count it remembered', tone: n === 3 ? 'ok' : 'accent' },
});

// Step 2: outer() is gone from the stack, but its scope stays alive on the heap.
const lifetime = (phase: 0 | 1 | 2): ArrayState => ({
  rows: [
    { label: 'call stack', cells: phase === 0 ? ['outer'] : ['-'], states: paint(1, () => (phase === 0 ? 'active' : 'dim')), showIndex: false },
    { label: 'scope: count', cells: phase === 2 ? [calls[0]] : [0], states: paint(1, () => (phase === 0 ? 'visited' : 'found')), showIndex: false },
    { label: 'inner holds', cells: phase === 0 ? ['-'] : ['yes'], states: paint(1, () => (phase === 0 ? 'dim' : 'active')), showIndex: false },
  ],
  stats: [
    { label: 'outer()', value: phase === 0 ? 'running' : 'finished', tone: phase === 0 ? 'neutral' : 'ok' },
    { label: 'count', value: phase === 2 ? 'alive: 1' : 'alive: 0', tone: 'ok' },
    { label: 'Freed?', value: 'if referenced' },
  ],
  note: phase === 0 ? { text: 'outer() creates count and returns inner', tone: 'accent' } : phase === 1 ? { text: 'its stack frame is gone, but inner still points at its scope', tone: 'ok' } : { text: 'counter() reads and updates count in that surviving scope', tone: 'ok' },
});

// Step 3: var gives every callback the same binding, let gives each iteration its own.
const loop = (kind: 'var' | 'let'): ArrayState => {
  const out = kind === 'var' ? varOut : letOut;
  return {
    rows: [
      { label: kind === 'var' ? 'shared i' : 'each i', cells: kind === 'var' ? [3] : [0, 1, 2], states: paint(kind === 'var' ? 1 : 3, () => (kind === 'var' ? 'bad' : 'found')), showIndex: false },
      { label: 'prints', cells: out, states: paint(3, () => (kind === 'var' ? 'bad' : 'found')), showIndex: false },
    ],
    stats: [
      { label: 'Binding', value: kind === 'var' ? 'one for all' : 'one per turn', tone: kind === 'var' ? 'bad' : 'ok' },
      { label: 'Output', value: out.join(' '), tone: kind === 'var' ? 'bad' : 'ok' },
      { label: 'Fix', value: kind === 'var' ? 'use let' : 'done', tone: kind === 'var' ? 'neutral' : 'ok' },
    ],
    note: kind === 'var' ? { text: 'the loop ends with i = 3 and all three callbacks read that one i', tone: 'bad' } : { text: 'each iteration closes over its own copy of i', tone: 'ok' },
  };
};

// Step 4: each call to the outer function creates a separate scope.
const independent = (n: 0 | 1 | 2): ArrayState => ({
  rows: [
    { label: 'counter a', cells: n === 0 ? ['-', '-'] : aOut, states: paint(2, (k) => (n === 0 ? 'dim' : 'found')), showIndex: false },
    { label: 'counter b', cells: n >= 2 ? bOut : ['-'], states: paint(1, () => (n >= 2 ? 'visited' : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'a() twice', value: n === 0 ? '-' : aOut.join(' ') },
    { label: 'b() once', value: n >= 2 ? bOut.join(' ') : '-' },
    { label: 'Scopes', value: 'one each', tone: 'ok' },
  ],
  note: n === 2 ? { text: 'a and b each got their own count: b starts at 1, not 3', tone: 'ok' } : { text: 'every outer() call makes a fresh scope', tone: 'accent' },
});

export default defineLesson('array', {
  slug: 'js-closures',
  objectives: [
    { text: 'What a closure remembers and where the data lives', step: 1 },
    { text: 'Why a finished function scope can stay alive', step: 2 },
    { text: 'Why var prints 3 3 3 and let prints 0 1 2', step: 3 },
    { text: 'That each call to the outer function makes its own scope', step: 4 },
  ],
  steps: [
    {
      label: 'Remembering',
      title: 'A function with memory',
      tag: 'problem',
      body: ['A **closure** is a function that remembers the scope it was created in, even after that scope has finished running.', '`outer()` returns `inner`, and `inner` keeps updating `count` on every call.'],
      keyIdea: 'Closures power data hiding, currying, memoization and event handlers.',
      frames: [{ state: counterState(1), hold: 1600 }, { state: counterState(2), hold: 1600 }, { state: counterState(3), hold: 3000 }],
    },
    {
      label: 'Lifetime',
      title: 'Scope outlives the call',
      tag: 'concept',
      body: ['When `outer()` finishes its stack frame is gone, but `inner` still references its scope, so `count` is never freed.', 'The variable lives as long as something can still reach it.'],
      keyIdea: 'Closures are also how memory leaks happen: a long-lived function keeps its whole scope alive.',
      frames: [{ state: lifetime(0), hold: 2200 }, { state: lifetime(1), hold: 2400 }, { state: lifetime(2), hold: 3000 }],
    },
    {
      label: 'var vs let',
      title: 'The classic loop trap',
      tag: 'trade-off',
      body: ['With `var i`, the loop has **one shared variable**. By the time the callbacks run, `i` is 3, so all three print 3.', 'With `let i`, every iteration gets **its own binding**, so they print 0, 1, 2.'],
      keyIdea: 'Prefer `let` and `const`. `var` is function-scoped, not block-scoped.',
      frames: [{ state: loop('var'), hold: 3200 }, { state: loop('let'), hold: 3200 }],
    },
    {
      label: 'Independent',
      title: 'One scope per call',
      tag: 'technique',
      body: ['Each call to `makeCounter()` creates a new `count`. Two counters never interfere.', 'That is what makes closures a clean way to hide private state.'],
      keyIdea: 'Private state without classes: the variable is reachable only through the returned function.',
      frames: [{ state: independent(0), hold: 1800 }, { state: independent(1), hold: 2000 }, { state: independent(2), hold: 3000 }],
    },
    {
      label: 'Recap',
      title: 'Closures in one page',
      tag: 'recap',
      body: [
        '- **Definition:** a function plus the scope it was created in.',
        '- **Lifetime:** the scope lives while the function can be reached.',
        '- **Loops:** `var` shares one binding, `let` makes one per iteration.',
        '- **Scopes:** each outer call creates a new one.',
        '- **Uses:** data hiding, currying, memoization, handlers.',
      ],
      keyIdea: 'If a callback sees a stale or surprising value, ask which binding it closed over.',
      frames: [{ state: loop('let') }],
    },
  ],
});
