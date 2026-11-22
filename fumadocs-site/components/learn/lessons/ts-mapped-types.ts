import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the TypeScript notes: keyof gives the key union, a mapped type rebuilds an object type one key at a time,
 * and the utility types (Partial, Required, Pick, Omit) are mapped types. The results come from real runtime analogues over a field list.
 */

type Field = { k: string; t: string; opt?: boolean; ro?: boolean };
const USER: Field[] = [
  { k: 'id', t: 'number' },
  { k: 'name', t: 'string' },
  { k: 'age', t: 'number' },
];

const partial = (fs: Field[]): Field[] => fs.map((f) => ({ ...f, opt: true }));
const pick = (fs: Field[], keys: string[]): Field[] => fs.filter((f) => keys.includes(f.k));
const omit = (fs: Field[], keys: string[]): Field[] => fs.filter((f) => !keys.includes(f.k));
const show = (f: Field) => `${f.k}${f.opt ? '?' : ''}`;
const line = (f: Field) => `${show(f)}: ${f.t}`;

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

// Step 1: a hand-written copy goes stale when the source type changes.
const driftState = (phase: 0 | 1): ArrayState => ({
  rows: [
    { label: 'User', cells: phase === 1 ? ['id', 'name', 'age', 'email'] : ['id', 'name', 'age'], states: paint(4, (i) => (phase === 1 && i === 3 ? 'active' : 'done')), showIndex: false },
    { label: 'UserUpdate', cells: phase === 1 ? ['id', 'name', 'age', '-'] : ['id', 'name', 'age'], states: paint(4, (i) => (phase === 1 && i === 3 ? 'bad' : 'visited')), showIndex: false },
  ],
  panels: [{ title: 'hand-written copy', kind: 'list', items: phase === 1 ? ['User: 4 fields', 'UserUpdate: 3 fields', 'email is missing'] : ['User: 3 fields', 'UserUpdate: 3 fields', 'in sync, for now'], highlight: phase === 1 ? 2 : undefined }],
  stats: [
    { label: 'Copies', value: '2 types' },
    { label: 'In sync', value: phase === 1 ? 'no' : 'yes', tone: phase === 1 ? 'bad' : 'ok' },
    { label: 'Fix', value: phase === 1 ? 'derive it' : '-' },
  ],
  note: phase === 1 ? { text: 'someone added email to User and forgot the copy', tone: 'bad' } : { text: 'a second type that repeats the first can drift', tone: 'accent' },
});

// Step 2: keyof builds a union of the keys.
const keyofState = (k: number): ArrayState => ({
  rows: [
    { label: 'User', cells: USER.map((f) => f.k), states: paint(3, (i) => (i === k ? 'active' : i < k ? 'done' : 'normal')), showIndex: false },
  ],
  panels: [{ title: 'keyof User', kind: 'list', items: USER.slice(0, k + 1).map((f) => `"${f.k}"`), highlight: k }],
  stats: [
    { label: 'Type', value: 'keyof User' },
    { label: 'Union size', value: String(k + 1), tone: 'ok' },
    { label: 'Values', value: 'key names' },
  ],
  note: { text: 'keyof User is the union "id" | "name" | "age"', tone: k === 2 ? 'ok' : 'accent' },
});

// Step 3: a mapped type visits each key and rebuilds the field.
const mappedState = (k: number): ArrayState => ({
  rows: [
    { label: 'K in keyof', cells: USER.map((f) => f.k), states: paint(3, (i) => (i === k ? 'active' : i < k ? 'visited' : 'normal')), showIndex: false },
    { label: 'readonly', cells: USER.map((f, i) => (i <= k ? f.k : '-')), states: paint(3, (i) => (i <= k ? 'swap' : 'dim')), showIndex: false },
  ],
  panels: [{ title: 'ReadonlyUser', kind: 'list', items: USER.slice(0, k + 1).map((f) => line(f)), highlight: k }],
  stats: [
    { label: 'Rule', value: 'readonly K' },
    { label: 'Visited', value: `${k + 1} of 3`, tone: 'ok' },
    { label: 'Value type', value: 'User[K]' },
  ],
  note: { text: 'each key is copied with a readonly modifier and its own value type', tone: k === 2 ? 'ok' : 'accent' },
});

// Step 4: the utility types are mapped types you do not have to write.
type Util = { name: string; fields: Field[]; note: string };
const UTILS: Util[] = [
  { name: 'Partial', fields: partial(USER), note: 'every field becomes optional' },
  { name: 'Pick', fields: pick(USER, ['id', 'name']), note: 'keep only id and name' },
  { name: 'Omit', fields: omit(USER, ['id']), note: 'everything except id' },
];
const utilState = (u: number): ArrayState => {
  const { name, fields, note } = UTILS[u];
  const kept = new Set(fields.map((f) => f.k));
  return {
    rows: [
      { label: 'User', cells: USER.map((f) => f.k), states: paint(3, (i) => (kept.has(USER[i].k) ? 'done' : 'dim')), showIndex: false },
      { label: name, cells: fields.map(show), states: paint(3, () => 'found'), showIndex: false },
    ],
    panels: [{ title: `${name}<User>`, kind: 'list', items: fields.map(line) }],
    stats: [
      { label: 'Utility', value: name, tone: 'ok' },
      { label: 'Fields kept', value: `${fields.length} of 3` },
      { label: 'Written by you', value: 'one word' },
    ],
    note: { text: note, tone: 'ok' },
  };
};

export default defineLesson('array', {
  slug: 'ts-mapped-types',
  objectives: [
    { text: 'Why hand-copied types drift from their source', step: 1 },
    { text: 'What keyof produces', step: 2 },
    { text: 'How a mapped type rebuilds an object type key by key', step: 3 },
    { text: 'How Partial, Pick and Omit are built on that', step: 4 },
  ],
  steps: [
    {
      label: 'Drift',
      title: 'Copies fall out of sync',
      tag: 'problem',
      body: ['An update payload usually looks like the user type with fewer rules. Writing it by hand means two types to keep aligned.', 'Add a field to one and the other is silently wrong.'],
      keyIdea: 'Derive types from one source of truth instead of repeating them.',
      frames: [{ state: driftState(0), hold: 2200 }, { state: driftState(1), hold: 3400 }],
    },
    {
      label: 'keyof',
      title: 'keyof gives the key names',
      tag: 'concept',
      body: ['`keyof User` is a union of the property names: `"id" | "name" | "age"`.', 'It is the list a mapped type walks.'],
      keyIdea: '`keyof` works on types, `typeof` takes the type of a value.',
      frames: [0, 1, 2].map((k) => ({ state: keyofState(k), hold: k === 2 ? 3000 : 1700 })),
    },
    {
      label: 'Mapped',
      title: 'Rebuild the type key by key',
      tag: 'technique',
      body: ['`{ readonly [K in keyof User]: User[K] }` visits each key `K`, adds `readonly`, and keeps the value type `User[K]`.', 'This is the foundation of the utility types.'],
      keyIdea: 'A mapped type is a loop over keys, written in the type system.',
      frames: [0, 1, 2].map((k) => ({ state: mappedState(k), hold: k === 2 ? 3200 : 1800 })),
    },
    {
      label: 'Utilities',
      title: 'Partial, Pick and Omit',
      tag: 'in practice',
      body: ['`Partial<User>` makes every field optional, `Pick<User, "id" | "name">` keeps some, `Omit<User, "id">` drops some.', '`Required` reverses `Partial`, and `Record<K, V>` builds an object type from a key union.'],
      keyIdea: 'Use the built-ins first, and reach for a custom mapped type only when they do not fit.',
      frames: [0, 1, 2].map((u) => ({ state: utilState(u), hold: 2800 })),
    },
    {
      label: 'Recap',
      title: 'Deriving types',
      tag: 'recap',
      body: [
        '- **Problem:** hand-copied types drift.',
        '- **keyof:** the union of a type\'s key names.',
        '- **Mapped type:** loop over keys and rebuild each field.',
        '- **Utilities:** Partial, Required, Pick, Omit, Record.',
        '- **Rule:** one source of truth, derived everywhere else.',
      ],
      keyIdea: 'When a type looks like another type with a twist, derive it.',
      frames: [{ state: utilState(0) }],
    },
  ],
});
