import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Redux Toolkit notes: configureStore, createSlice with loginSuccess and logout, Immer drafts,
 * useSelector subscriptions. The loop is UI, slice actions, reducer, store, selectors, back to the UI.
 * Layout: top row UI, actions, reducer. Bottom row selector and store.
 */

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req', dur = 0.7): Packet => ({ from, to, label, delay, tone, dur });

// Step 1: many components need the same state.
const shared = (store: boolean): FlowState => ({
  nodes: store
    ? [
        { id: 'h', label: 'Header', kind: 'client', x: 0.1, y: 0.4, size: 'sm' },
        { id: 'c', label: 'Cart', kind: 'client', x: 0.1, y: 1.7, size: 'sm' },
        { id: 'p', label: 'Profile', kind: 'client', x: 0.1, y: 3.0, size: 'sm' },
        { id: 's', label: 'Store', sub: 'single truth', kind: 'db', x: 4.3, y: 1.7, status: 'active', items: ['user', 'cart'] },
      ]
    : [
        { id: 'a', label: 'App', sub: 'owns user', kind: 'service', x: 0.1, y: 1.7 },
        { id: 'l', label: 'Layout', sub: 'passes it on', kind: 'worker', x: 1.9, y: 1.7, status: 'hot' },
        { id: 'p', label: 'Page', sub: 'passes it on', kind: 'worker', x: 3.7, y: 1.7, status: 'hot' },
        { id: 'h', label: 'Header', sub: 'needs user', kind: 'client', x: 5.5, y: 1.7 },
      ],
  links: store ? [{ from: 'h', to: 's' }, { from: 'c', to: 's' }, { from: 'p', to: 's' }] : [{ from: 'a', to: 'l' }, { from: 'l', to: 'p' }, { from: 'p', to: 'h' }],
  packets: store ? [hop('s', 'h', 'user', 0, 'res'), hop('s', 'c', 'cart', 0.2, 'res'), hop('s', 'p', 'user', 0.4, 'res')] : [hop('a', 'l', 'user', 0), hop('l', 'p', 'user', 0.7), hop('p', 'h', 'user', 1.4)],
  stats: store
    ? [{ label: 'State lives', value: 'one store', tone: 'ok' }, { label: 'Read by', value: 'any component' }, { label: 'Writes', value: 'via actions' }]
    : [{ label: 'Prop drilling', value: '3 hops', tone: 'bad' }, { label: 'Middle layers', value: 'just relay', tone: 'bad' }, { label: 'Shared by', value: 'many' }],
  note: store ? { text: 'a single source of truth: any component can read it', tone: 'ok' } : { text: 'when many components share state, lifting it up gets painful', tone: 'bad' },
});

// Step 2: one-way data flow. Highlight each stage in turn.
const NODES: FlowNode[] = [
  { id: 'ui', label: 'UI', sub: 'component', kind: 'client', x: 0.2, y: 0.4 },
  { id: 'ac', label: 'Slice actions', sub: 'what happened', kind: 'gateway', x: 3.0, y: 0.4 },
  { id: 're', label: 'Reducer', sub: 'how state changes', kind: 'worker', x: 5.8, y: 0.4 },
  { id: 'st', label: 'Store', sub: 'state tree', kind: 'db', x: 5.8, y: 2.9 },
  { id: 'se', label: 'Selector', sub: 'reads a slice', kind: 'cache', x: 3.0, y: 2.9 },
];
const FLOW_LINKS = [{ from: 'ui', to: 'ac' }, { from: 'ac', to: 're' }, { from: 're', to: 'st' }, { from: 'st', to: 'se' }, { from: 'se', to: 'ui' }];
const ORDER = ['ui', 'ac', 're', 'st', 'se'];
const LABELS = ['dispatch(loginSuccess(payload))', 'action: { type, payload }', 'pure function, Immer inside', 'new state saved', 'only new data goes up'];
const loop = (i: number): FlowState => ({
  nodes: NODES.map((n) => ({ ...n, status: n.id === ORDER[i] ? 'active' : 'normal' })),
  links: FLOW_LINKS,
  packets: i < 4 ? [{ from: ORDER[i], to: ORDER[i + 1], label: ['dispatch', 'action', 'new state', 'subscribe'][i], tone: i === 2 ? 'ok' : 'req', dur: 0.8 }] : [{ from: 'se', to: 'ui', label: 'new data', tone: 'res', dur: 0.8 }],
  stats: [
    { label: 'Direction', value: 'one way' },
    { label: 'Reducers', value: 'pure, sync', tone: 'ok' },
    { label: 'Step', value: `${i + 1} of 5` },
  ],
  note: { text: LABELS[i], tone: 'accent' },
});

// Step 3: a slice bundles initial state, reducers and the generated action creators.
const slice = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'sl', label: 'authSlice', sub: 'createSlice', kind: 'service', x: 0.3, y: 1.7, status: 'active', items: ['user', 'token'] },
    { id: 'ac', label: 'loginSuccess', sub: 'action creator', kind: 'gateway', x: 3.0, y: 0.5, items: phase === 1 ? ['login'] : undefined },
    { id: 'lo', label: 'logout', sub: 'action creator', kind: 'gateway', x: 3.0, y: 2.9 },
    { id: 'st', label: 'Store', sub: 'configureStore', kind: 'db', x: 5.7, y: 1.7, items: phase === 1 ? ['user set'] : ['user null'] },
  ],
  links: [{ from: 'sl', to: 'ac' }, { from: 'sl', to: 'lo' }, { from: 'ac', to: 'st' }, { from: 'lo', to: 'st', dashed: true }],
  packets: phase === 1 ? [hop('ac', 'st', 'dispatch', 0, 'ok')] : [],
  stats: [
    { label: 'You write', value: 'reducers' },
    { label: 'RTK generates', value: 'actions' },
    { label: 'Boilerplate', value: 'none', tone: 'ok' },
  ],
  note: phase === 1 ? { text: 'dispatch(loginSuccess(payload)) replaces a hand-written action object', tone: 'ok' } : { text: 'one call creates the reducer and its action creators', tone: 'accent' },
});

// Step 4: Immer. Write mutable-looking code, get an immutable update that shares untouched parts.
const immer = (phase: 0 | 1 | 2): FlowState => ({
  nodes: [
    { id: 'old', label: 'Old state', sub: 'frozen', kind: 'storage', x: 0.2, y: 1.7, items: ['count 0', 'user', 'token'] },
    { id: 'dr', label: 'Draft', sub: 'state.count += 1', kind: 'worker', x: 2.9, y: 0.4, status: phase === 0 ? 'active' : phase === 1 ? 'active' : 'dim' },
    { id: 'new', label: 'New state', sub: phase === 2 ? 'shares refs' : 'not built yet', kind: 'db', x: 5.7, y: 1.7, status: phase === 2 ? 'active' : 'dim', items: phase === 2 ? ['count 1', 'user', 'token'] : undefined },
  ],
  links: [{ from: 'old', to: 'dr' }, { from: 'dr', to: 'new' }, { from: 'old', to: 'new', dashed: true, label: 'shared' }],
  packets: phase === 0 ? [hop('old', 'dr', 'copy-on-write', 0)] : phase === 1 ? [hop('dr', 'dr', 'record change', 0, 'data')] : [hop('dr', 'new', 'apply diff', 0, 'ok')],
  stats: [
    { label: 'You write', value: 'mutations' },
    { label: 'Result', value: 'immutable', tone: 'ok' },
    { label: 'Unchanged', value: phase === 2 ? 'same refs' : '-', tone: phase === 2 ? 'ok' : 'neutral' },
  ],
  note: phase === 0 ? { text: 'inside a reducer you edit a draft, not the real state', tone: 'accent' } : phase === 1 ? { text: 'Immer records exactly what changed', tone: 'accent' } : { text: 'immutability enables change detection and time-travel debugging', tone: 'ok' },
});

// Step 5: selectors. Only components whose selected value changed re-render.
const subs = (changed: boolean): FlowState => ({
  nodes: [
    { id: 'st', label: 'Store', sub: changed ? 'cart changed' : 'state tree', kind: 'db', x: 0.3, y: 1.7, status: changed ? 'active' : 'normal', items: ['user', 'cart'] },
    { id: 'h', label: 'Header', sub: 'select: user', kind: 'client', x: 4.8, y: 0.5, status: changed ? 'dim' : 'normal' },
    { id: 'c', label: 'Cart', sub: 'select: cart', kind: 'client', x: 4.8, y: 2.9, status: changed ? 'hot' : 'normal', badge: changed ? { text: 're-renders', tone: 'bad' } : undefined },
  ],
  links: [{ from: 'st', to: 'h' }, { from: 'st', to: 'c' }],
  packets: changed ? [hop('st', 'c', 'cart', 0, 'bad')] : [],
  stats: [
    { label: 'Header', value: changed ? 'skipped' : 'subscribed', tone: changed ? 'ok' : 'neutral' },
    { label: 'Cart', value: changed ? 're-renders' : 'subscribed', tone: changed ? 'bad' : 'neutral' },
    { label: 'Compared by', value: 'reference' },
  ],
  note: changed ? { text: 'useSelector compares the selected value and skips unchanged components', tone: 'ok' } : { text: 'each component subscribes through its selector', tone: 'accent' },
});

export default defineLesson('flow', {
  slug: 'redux-data-flow',
  objectives: [
    { text: 'Why shared state needs a single source of truth', step: 1 },
    { text: 'The one-way loop of dispatch, reducer, store and selector', step: 2 },
    { text: 'What createSlice generates for you', step: 3 },
    { text: 'How Immer turns mutations into immutable updates', step: 4 },
    { text: 'How selectors decide which components update', step: 5 },
  ],
  steps: [
    {
      label: 'Why Redux',
      title: 'Shared state without drilling',
      tag: 'problem',
      body: ['When many components need the same state, passing it through layers of props means middle components only relay it.', 'Redux gives it one home, with **predictable updates** and good debugging (logs, time travel).'],
      keyIdea: 'Use it when state is shared widely and its transitions are complex. Otherwise keep it local.',
      frames: [{ state: shared(false), hold: 3000 }, { state: shared(true), hold: 3000 }],
    },
    {
      label: 'One-way loop',
      title: 'Dispatch, reduce, select',
      tag: 'concept',
      body: ['The UI **dispatches** an action describing what happened. A **reducer** describes how state changes and the **store** keeps the result.', 'Selectors hand the new data back to the UI. Data only moves one way around the loop.'],
      keyIdea: 'Actions say what happened. Reducers say how state changes, and must be pure and synchronous.',
      frames: [0, 1, 2, 3, 4].map((i) => ({ state: loop(i), hold: 1500 })),
    },
    {
      label: 'createSlice',
      title: 'Reducers and actions in one',
      tag: 'technique',
      body: ['`createSlice` takes a name, initial state and reducers, and generates the action creators. `configureStore` wires slices together with DevTools and thunk by default.', 'No more separate action types or switch statements.'],
      keyIdea: 'Export `slice.actions` for dispatching and `slice.reducer` for the store.',
      frames: [{ state: slice(0), hold: 2600 }, { state: slice(1), hold: 2800 }],
    },
    {
      label: 'Immer',
      title: 'Mutable code, immutable result',
      tag: 'technique',
      body: ['Inside a slice reducer `state.count += 1` is safe. Immer gives you a **draft**, records the change, and produces a new state.', 'Parts that did not change keep the same reference.'],
      keyIdea: 'Immutability enables change detection, time-travel debugging and predictable updates.',
      frames: [{ state: immer(0), hold: 2200 }, { state: immer(1), hold: 2000 }, { state: immer(2), hold: 3000 }],
    },
    {
      label: 'Selectors',
      title: 'Subscribe to a slice',
      tag: 'concept',
      body: ['`useSelector` reads part of the state and subscribes the component to it. React re-renders it only when the selected value changes.', '`useDispatch` gives you `dispatch` to send actions.'],
      keyIdea: 'Select the smallest slice you need, so unrelated updates do not re-render you.',
      frames: [{ state: subs(false), hold: 2200 }, { state: subs(true), hold: 3200 }],
    },
    {
      label: 'Recap',
      title: 'Redux Toolkit in one loop',
      tag: 'recap',
      body: [
        '- **Store:** single source of truth from `configureStore`.',
        '- **Slice:** `createSlice` gives reducers and action creators.',
        '- **Reducers:** pure and synchronous, Immer handles immutability.',
        '- **Selectors:** `useSelector` subscribes to a minimal slice.',
        '- **Async:** goes in thunks or RTK Query, not reducers.',
      ],
      keyIdea: 'Redux is a client-side cache of state, not a database.',
      frames: [{ state: loop(4) }],
    },
  ],
});
