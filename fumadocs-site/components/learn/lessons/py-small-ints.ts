import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Python notes on caching and interning: ints from -5 to 256 are preallocated singletons, other ints made at run time are
 * separate objects, and 1, 1.0 and True are one dict key. A small model of the int cache is compared with real object identity,
 * and the dict is built with real numeric key normalisation.
 */

const cache = new Map<number, object>();
for (let n = -5; n <= 256; n++) cache.set(n, { n });
/** int(...) at run time: cached for -5..256, a fresh object otherwise. */
const makeInt = (n: number): object => cache.get(n) ?? { n };
const isSame = (n: number) => makeInt(n) === makeInt(n);

const SAMPLES = [-6, -5, 0, 256, 257];
const RESULTS = SAMPLES.map(isSame);
const equal = (n: number) => n === n;

// {1: 'a', 1.0: 'b', True: 'c'}: equal keys with equal hashes are one key.
const dict = new Map<number, string>();
for (const [k, v] of [[1, 'a'], [1.0, 'b'], [Number(true), 'c']] as [number, string][]) dict.set(k, v);

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const table = (upto: number, note: ArrayState['note']): ArrayState => ({
  rows: [
    { label: 'int(n)', cells: SAMPLES.map((n, i) => (i < upto ? n : '')), states: paint(5, (i) => (i < upto ? 'normal' : 'dim')), showIndex: false },
    { label: 'x == y', cells: SAMPLES.map((n, i) => (i < upto ? (equal(n) ? 'yes' : 'no') : '')), states: paint(5, (i) => (i < upto ? 'visited' : 'dim')), showIndex: false },
    { label: 'x is y', cells: SAMPLES.map((_, i) => (i < upto ? (RESULTS[i] ? 'yes' : 'no') : '')), states: paint(5, (i) => (i < upto ? (RESULTS[i] ? 'found' : 'bad') : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'Cached range', value: '-5 to 256' },
    { label: 'is True for', value: SAMPLES.filter((_, i) => i < upto && RESULTS[i]).join(', ') || '-', tone: 'ok' },
    { label: 'is False for', value: SAMPLES.filter((_, i) => i < upto && !RESULTS[i]).join(', ') || '-', tone: 'bad' },
  ],
  note,
});

const keys = (): ArrayState => ({
  rows: [
    { label: 'key', cells: ['1', '1.0', 'True'], states: paint(3, () => 'normal'), showIndex: false },
    { label: 'value', cells: ['a', 'b', 'c'], states: paint(3, () => 'visited'), showIndex: false },
    { label: 'dict', cells: [`${[...dict.keys()][0]}:${[...dict.values()][0]}`], states: { 0: 'found' }, showIndex: false },
  ],
  stats: [
    { label: 'Keys inserted', value: '3' },
    { label: 'Keys stored', value: String(dict.size), tone: 'ok' },
    { label: 'Final value', value: [...dict.values()][0], tone: 'ok' },
  ],
  note: { text: '1, 1.0 and True are equal with equal hashes: one key, first key kept, last value wins', tone: 'ok' },
});

export default defineLesson('array', {
  slug: 'py-small-ints',
  objectives: [
    { text: 'The difference between == and is', step: 1 },
    { text: 'Which ints are cached singletons', step: 2 },
    { text: 'Why is must not compare values', step: 3 },
    { text: 'Why 1, 1.0 and True are one dict key', step: 4 },
  ],
  steps: [
    {
      label: 'is vs ==',
      title: 'Same value, same object?',
      tag: 'problem',
      body: ['`==` compares values through `__eq__`. `is` compares **identity**: whether both names point at one object.', 'For ints the two can disagree.'],
      keyIdea: 'Use `is` for `None`, `True`, `False` and sentinels, `==` for everything else.',
      frames: [{ state: table(4, { text: '256 is 256, but compare it with a larger number next', tone: 'accent' }), hold: 3000 }, { state: table(5, { text: '257 == 257 is True, yet two int("257") objects are not the same object', tone: 'bad' }), hold: 4000 }],
    },
    {
      label: 'The cache',
      title: 'Preallocated -5 to 256',
      tag: 'concept',
      body: ['CPython preallocates the ints from **-5 to 256** as singletons, so every `256` is the same object.', 'Outside that range each run-time int is a separate object.'],
      keyIdea: 'The boundaries are -6 (not cached), -5 (cached), 256 (cached) and 257 (not cached).',
      frames: [{ state: table(5, { text: `identity holds for ${SAMPLES.filter((_, i) => RESULTS[i]).join(', ')} and fails for ${SAMPLES.filter((_, i) => !RESULTS[i]).join(', ')}`, tone: 'ok' }), hold: 4400 }],
    },
    {
      label: 'Not values',
      title: 'An implementation detail',
      tag: 'trade-off',
      body: ['None of this is a language guarantee. Interned strings and cached ints are optimisations.', 'Using `is` to compare numbers or strings will work in tests and fail in production.'],
      keyIdea: 'Never use `is` to compare values.',
      frames: [{ state: table(5, { text: 'a == b is always the right question for numbers and strings', tone: 'accent' }), hold: 3800 }],
    },
    {
      label: 'Dict keys',
      title: 'Equal keys are one key',
      tag: 'technique',
      body: ['`1 == 1.0 == True`, and they hash the same, so `{1: "a", 1.0: "b", True: "c"}` has **one** key.', 'The first key object stays and the last value wins.'],
      keyIdea: 'Equal keys must have equal hashes.',
      frames: [{ state: keys(), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Identity and equality',
      tag: 'recap',
      body: [
        '- **is:** same object.',
        '- **==:** same value.',
        '- **Small ints:** -5 to 256 are singletons.',
        '- **Never:** `is` for numbers or strings.',
        '- **Dict:** 1, 1.0 and True collapse into one key.',
      ],
      keyIdea: 'Identity is an optimisation detail, equality is the contract.',
      frames: [{ state: keys() }],
    },
  ],
});
