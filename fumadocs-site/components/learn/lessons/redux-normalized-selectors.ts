import { defineLesson } from '../define';
import type { ArrayRow, ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Follows the Redux Toolkit notes on normalized state, createEntityAdapter and createSelector.
 * Reference counts and recomputation counts are computed by running the update and the selector, not drawn by hand.
 */

const paint = (n: number, f: (i: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, f(i)])) as Record<number, ItemState>;

// Step 1: a nested update gives every object on the path a new reference.
const NESTED_PATH = ['users', 'user', 'posts', 'post', 'cmts', 'cmt'];
const NORMAL_PATH = ['comments', 'byId', 'c3'];
const pathRow = (label: string, path: string[], all: string[], tone: ItemState): ArrayRow => ({
  label,
  cells: all,
  states: paint(all.length, (i) => (path.includes(all[i]) ? tone : 'dim')),
  showIndex: false,
});
const nested: ArrayState = {
  rows: [pathRow('nested', NESTED_PATH, NESTED_PATH, 'bad')],
  stats: [
    { label: 'Edit', value: 'one comment' },
    { label: 'New references', value: String(NESTED_PATH.length), tone: 'bad' },
    { label: 'Subscribers hit', value: 'every ancestor' },
  ],
  note: { text: 'users.posts.comments: the whole path is copied, all of it looks changed', tone: 'bad' },
};

// Step 2: normalized. Flat tables keyed by id, so an edit touches one entity.
const normal: ArrayState = {
  rows: [
    { label: 'allIds', cells: ['c1', 'c2', 'c3', 'c4'], states: paint(4, () => 'done'), showIndex: false },
    { label: 'byId', cells: ['c1', 'c2', 'c3', 'c4'], states: paint(4, (i) => (i === 2 ? 'found' : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'Edit', value: 'c3 only' },
    { label: 'New references', value: String(NORMAL_PATH.length), tone: 'ok' },
    { label: 'Others', value: 'same refs', tone: 'ok' },
  ],
  note: { text: 'byId plus allIds: an update replaces one entity, the rest are shared', tone: 'ok' },
};

// Step 3: createEntityAdapter. addOne, updateOne and removeOne, run on a real id list.
type Ids = string[];
const adapterSteps: { op: string; ids: Ids; touched: string[] }[] = [];
{
  let ids: Ids = ['c1', 'c2', 'c3', 'c4'];
  adapterSteps.push({ op: 'start', ids: [...ids], touched: [] });
  ids = [...ids, 'c5'];
  adapterSteps.push({ op: 'addOne(c5)', ids: [...ids], touched: ['c5'] });
  adapterSteps.push({ op: 'updateOne(c3)', ids: [...ids], touched: ['c3'] });
  ids = ids.filter((i) => i !== 'c2');
  adapterSteps.push({ op: 'removeOne(c2)', ids: [...ids], touched: [] });
}
const adapter = (n: number): ArrayState => {
  const s = adapterSteps[n];
  return {
    rows: [{ label: 'ids', cells: s.ids, states: paint(s.ids.length, (i) => (s.touched.includes(s.ids[i]) ? 'found' : 'done')), showIndex: false }],
    panels: [{ title: 'adapter gives', kind: 'list', items: ['addOne', 'updateOne', 'removeOne', 'selectAll', 'selectById'], highlight: n === 0 ? undefined : n - 1 }],
    stats: [
      { label: 'Operation', value: s.op },
      { label: 'Entities', value: String(s.ids.length) },
      { label: 'You wrote', value: 'no reducers', tone: 'ok' },
    ],
    note: { text: n === 0 ? 'createEntityAdapter manages byId and allIds for you' : `${s.op}: normalized state stays consistent`, tone: 'accent' },
  };
};

// Step 4: derived data. A plain selector recomputes on every update, createSelector only when its inputs change.
type S = { items: number[]; filter: string; theme: string };
type Action = { label: string; apply: (s: S) => S };
const ACTIONS: Action[] = [
  { label: 'theme', apply: (s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }) },
  { label: 'theme', apply: (s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }) },
  { label: 'filt', apply: (s) => ({ ...s, filter: 'even' }) },
  { label: 'theme', apply: (s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }) },
  { label: 'theme', apply: (s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }) },
];
const simulate = () => {
  let s: S = { items: [1, 2, 3, 4], filter: 'all', theme: 'dark' };
  let lastItems: number[] | null = null;
  let lastFilter: string | null = null;
  let cached: number[] = [];
  const plain: number[] = [];
  const memo: number[] = [];
  const outRefs: number[] = [];
  let refId = 0;
  ACTIONS.forEach((a) => {
    s = a.apply(s);
    plain.push(1); // items.filter(...) runs on every update
    if (s.items !== lastItems || s.filter !== lastFilter) {
      cached = s.items.filter((n) => s.filter === 'all' || n % 2 === 0);
      lastItems = s.items;
      lastFilter = s.filter;
      refId++;
      memo.push(1);
    } else memo.push(0);
    outRefs.push(refId);
  });
  return { plain, memo, outRefs, last: cached };
};
const SIM = simulate();
const selectorState = (upTo: number, memo: boolean): ArrayState => {
  const n = upTo + 1;
  return {
    rows: [
      { label: 'action', cells: ACTIONS.map((a) => a.label), states: paint(ACTIONS.length, (i) => (i < n ? (ACTIONS[i].label === 'filt' ? 'swap' : 'done') : 'dim')), showIndex: false },
      {
        label: memo ? 'memoized' : 'plain',
        cells: (memo ? SIM.memo : SIM.plain).map((v, i) => (i < n ? v : 0)),
        states: paint(ACTIONS.length, (i) => (i >= n ? 'dim' : (memo ? SIM.memo : SIM.plain)[i] ? 'bad' : 'found')),
        bars: true,
        showIndex: false,
      },
    ],
    stats: [
      { label: 'Recomputes', value: String((memo ? SIM.memo : SIM.plain).slice(0, n).reduce((a, b) => a + b, 0)), tone: memo ? 'ok' : 'bad' },
      { label: 'Updates seen', value: String(n) },
      { label: 'Output ref', value: memo ? `r${SIM.outRefs[upTo]} (stable)` : 'new each time', tone: memo ? 'ok' : 'bad' },
    ],
    note: memo ? { text: 'inputs unchanged: cached output, same reference, no re-render', tone: 'ok' } : { text: 'every update reruns filter and returns a new array', tone: 'bad' },
  };
};
const selectorFrames = (memo: boolean): Frame<ArrayState>[] => [0, 2, 4].map((i) => ({ state: selectorState(i, memo), hold: i === 4 ? 3000 : 1700 }));

export default defineLesson('array', {
  slug: 'redux-normalized-selectors',
  objectives: [
    { text: 'Why nested state spreads a small edit across many references', step: 1 },
    { text: 'How a normalized byId and allIds shape limits updates', step: 2 },
    { text: 'What createEntityAdapter generates', step: 3 },
    { text: 'How createSelector avoids recomputing derived data', step: 4 },
  ],
  steps: [
    {
      label: 'Nested',
      title: 'One edit, six new references',
      tag: 'problem',
      body: ['With `users[].posts[].comments[]`, changing one comment gives every object along the path a new reference.', 'Any component subscribed to an ancestor now looks changed.'],
      keyIdea: 'Deeply nested state widens the blast radius of every update.',
      frames: [{ state: nested, hold: 3200 }],
    },
    {
      label: 'Normalized',
      title: 'Flat tables, keyed by id',
      tag: 'concept',
      body: ['Store `users`, `posts` and `comments` as separate `{ byId, allIds }` tables that refer to each other by id.', 'Editing comment `c3` replaces one entity, so updates are cheaper and reducers simpler.'],
      keyIdea: 'Normalization means faster updates, simpler reducers and fewer re-renders.',
      frames: [{ state: normal, hold: 3200 }],
    },
    {
      label: 'Entity adapter',
      title: 'createEntityAdapter',
      tag: 'technique',
      body: ['`createEntityAdapter` maintains the `byId` and `allIds` shape for you and generates `addOne`, `updateOne`, `removeOne` and selectors.', 'You stop writing the same collection reducers by hand.'],
      keyIdea: 'Use it for every normalized collection.',
      frames: [0, 1, 2, 3].map((i) => ({ state: adapter(i), hold: i === 3 ? 3000 : 1800 })),
    },
    {
      label: 'Selectors',
      title: 'Memoize derived data',
      tag: 'technique',
      body: ['A selector like `items.filter(...)` runs on every update and returns a fresh array, so components re-render each time.', '**`createSelector`** reruns only when an input selector returns a new value, otherwise it returns the cached reference.'],
      keyIdea: 'Five updates, only one changes the filter: the plain selector recomputes five times, createSelector twice (the first call, then the filter change).',
      frames: [...selectorFrames(false), ...selectorFrames(true)],
    },
    {
      label: 'Recap',
      title: 'Shape state for cheap updates',
      tag: 'recap',
      body: [
        '- **Normalize:** `byId` and `allIds` tables, refer by id.',
        '- **Adapter:** `createEntityAdapter` for collection operations.',
        '- **Derived data:** compute it with `createSelector`, do not store it.',
        '- **Smaller edits:** fewer new references, fewer re-renders.',
        '- **Avoid:** deep nesting and derived data inside Redux.',
      ],
      keyIdea: 'Store the minimum, derive the rest with memoized selectors.',
      frames: [{ state: selectorState(4, true) }],
    },
  ],
});
