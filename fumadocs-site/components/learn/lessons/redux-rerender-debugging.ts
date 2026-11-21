import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * The re-render sets are computed. Each component has a real selector function, an action produces a new state object
 * with structural sharing, and a component re-renders only when its selector returns a different reference.
 * Follows the Debugging Redux Performance notes: whole-store selectors, inline derived data, monolithic slices, spread reducers.
 */

type State = { auth: { user: string }; settings: { theme: string }; ui: { modal: boolean }; items: number[] };
const S0: State = { auth: { user: 'ana' }, settings: { theme: 'dark' }, ui: { modal: false }, items: [1, 2, 3] };

/** An action that changes only ui.modal, sharing every other slice with the old state. */
const toggleModal = (s: State): State => ({ ...s, ui: { modal: !s.ui.modal } });
/** A reducer that spreads the whole state and rebuilds every slice, even though nothing changed. */
const sloppy = (s: State): State => ({ auth: { ...s.auth }, settings: { ...s.settings }, ui: { ...s.ui }, items: [...s.items] });

type Comp = { id: string; label: string; sel: string; select: (s: State) => unknown };
const BAD: Comp[] = [
  { id: 'h', label: 'Header', sel: 'auth.user', select: (s) => s.auth.user },
  { id: 'x', label: 'Sidebar', sel: 'state (whole)', select: (s) => s },
  { id: 'f', label: 'Feed', sel: 'items.filter()', select: (s) => s.items.filter((n) => n > 0) },
  { id: 'o', label: 'Footer', sel: 'settings.theme', select: (s) => s.settings.theme },
];
// The fixed versions: smallest slice, and the derived list memoized by its input reference.
let memoIn: number[] | null = null;
let memoOut: number[] = [];
const memoFilter = (s: State) => {
  if (s.items !== memoIn) {
    memoIn = s.items;
    memoOut = s.items.filter((n) => n > 0);
  }
  return memoOut;
};
const GOOD: Comp[] = [
  { id: 'h', label: 'Header', sel: 'auth.user', select: (s) => s.auth.user },
  { id: 'x', label: 'Sidebar', sel: 'ui.modal', select: (s) => s.ui.modal },
  { id: 'f', label: 'Feed', sel: 'createSelector', select: memoFilter },
  { id: 'o', label: 'Footer', sel: 'settings.theme', select: (s) => s.settings.theme },
];

const rendered = (comps: Comp[], next: State, prev: State = S0): Set<string> => {
  // Warm the memo on the old state first so it holds a real cached value.
  comps.forEach((c) => c.select(prev));
  return new Set(comps.filter((c) => c.select(prev) !== c.select(next)).map((c) => c.id));
};

const Y = [0.2, 1.2, 2.2, 3.2];
const scene = (comps: Comp[], hit: Set<string>, action: string, note: FlowState['note'], extra: Partial<FlowState> = {}): FlowState => {
  const nodes: FlowNode[] = [
    { id: 'st', label: 'Store', sub: action, kind: 'db', x: 0.2, y: 1.7, status: 'active' },
    ...comps.map((c, i): FlowNode => ({ id: c.id, label: c.label, sub: c.sel, kind: 'client', x: 4.6, y: Y[i], status: hit.has(c.id) ? 'hot' : 'normal', badge: hit.has(c.id) ? { text: 're-renders', tone: 'bad' } : undefined })),
  ];
  const packets: Packet[] = comps.map((c, i) => ({ from: 'st', to: c.id, label: hit.has(c.id) ? 'changed' : 'same', tone: hit.has(c.id) ? ('bad' as const) : ('ok' as const), delay: i * 0.15, dur: 0.7 }));
  return {
    nodes,
    links: comps.map((c) => ({ from: 'st', to: c.id })),
    packets,
    stats: [
      { label: 'Action', value: action },
      { label: 'Re-rendered', value: `${hit.size} of ${comps.length}`, tone: hit.size ? 'bad' : 'ok' },
      { label: 'Needed', value: action === 'toggleModal' ? '0 or 1' : '0' },
    ],
    note,
    ...extra,
  };
};

// Step 2: select the whole store, or derive inline. Both re-render on an unrelated action.
const s1 = toggleModal(S0);
const badHit = rendered(BAD, s1);
const goodHit = rendered(GOOD, s1);

// Step 4: monolithic slice. Every component reads from one big object.
type Mono = { app: State };
const MONO_SEL: Comp[] = [
  { id: 'h', label: 'Header', sel: 'app', select: (s: unknown) => (s as Mono).app } as unknown as Comp,
  { id: 'x', label: 'Sidebar', sel: 'app', select: (s: unknown) => (s as Mono).app } as unknown as Comp,
  { id: 'f', label: 'Feed', sel: 'app', select: (s: unknown) => (s as Mono).app } as unknown as Comp,
  { id: 'o', label: 'Footer', sel: 'app', select: (s: unknown) => (s as Mono).app } as unknown as Comp,
];
const monoPrev: Mono = { app: S0 };
const monoNext: Mono = { app: toggleModal(S0) };
const monoHit = new Set(MONO_SEL.filter((c) => c.select(monoPrev as unknown as State) !== c.select(monoNext as unknown as State)).map((c) => c.id));
const SPLIT_HIT = rendered(GOOD, s1);

// Step 5: a reducer that spreads everything. Nothing changed, but every reference did.
const spreadNext = sloppy(S0);
const spreadHit = rendered(GOOD.map((c) => (c.id === 'x' ? { ...c, sel: 'ui', select: (s: State) => s.ui } : c)), spreadNext);

export default defineLesson('flow', {
  slug: 'redux-rerender-debugging',
  objectives: [
    { text: 'Why Redux itself is rarely the slow part', step: 1 },
    { text: 'What happens when a component selects the whole store or derives data inline', step: 2 },
    { text: 'How the smallest slice and createSelector stop the extra renders', step: 3 },
    { text: 'Why monolithic slices re-render every subscriber', step: 4 },
    { text: 'How spreading in a reducer breaks reference equality', step: 5 },
  ],
  steps: [
    {
      label: 'Suspects',
      title: 'Redux is fast, usage is not',
      tag: 'problem',
      body: ['Redux itself is fast. Slow screens usually come from too much global state, poor selectors, over-rendering or deeply nested state.', 'A component re-renders when its selector returns a **different reference** than last time.'],
      keyIdea: 'Debug from the cheapest, most common cause to the least likely one.',
      frames: [{ state: scene(GOOD, new Set(), 'idle', { text: 'four components, four selectors: watch which ones re-render', tone: 'accent' }), hold: 3000 }],
    },
    {
      label: 'Whole store',
      title: 'Selecting too much',
      tag: 'trade-off',
      body: ['`useSelector(state => state)` subscribes a component to the entire store. An inline `items.filter(...)` returns a new array on every call.', 'Toggling a modal flag has nothing to do with either, yet both re-render.'],
      keyIdea: 'Whole-store and inline-derived selectors turn every action into a re-render.',
      frames: [{ state: scene(BAD, badHit, 'toggleModal', { text: 'Sidebar and Feed re-render for an unrelated flag', tone: 'bad' }), hold: 3400 }],
    },
    {
      label: 'Minimal slice',
      title: 'Select less, memoize the rest',
      tag: 'technique',
      body: ['Select the smallest slice (`state.ui.modal`) and wrap derived data in **`createSelector`**, so unchanged inputs return the cached reference.', 'Now only a component that really depends on the modal flag would update.'],
      keyIdea: 'Always select the smallest possible slice.',
      frames: [{ state: scene(GOOD, goodHit, 'toggleModal', { text: goodHit.has('x') ? 'only the component that reads ui.modal updates' : 'no unrelated component re-renders', tone: 'ok' }), hold: 3400 }],
    },
    {
      label: 'Monolith',
      title: 'One big slice',
      tag: 'trade-off',
      body: ['Putting `auth`, `user`, `settings`, `ui` and `data` in one `app` object means any change replaces `app`, and every subscriber of it re-renders.', 'Split slices by **domain**, not by screen.'],
      keyIdea: 'Small, focused slices keep an update inside the components that care.',
      frames: [
        { state: scene(MONO_SEL, monoHit, 'toggleModal', { text: 'every component reads app, so all of them re-render', tone: 'bad' }), hold: 3200 },
        { state: scene(GOOD, SPLIT_HIT, 'toggleModal', { text: 'split by domain: updates stay local', tone: 'ok' }), hold: 3200 },
      ],
    },
    {
      label: 'Spreading',
      title: 'New references for nothing',
      tag: 'technique',
      body: ['A reducer that does `return { ...state }` or rebuilds every slice creates new references even when nothing changed.', 'Update only the fields that change and let **Immer** keep the rest identical.'],
      keyIdea: 'Reference equality is how React-Redux detects change, so needless new references cost renders.',
      frames: [{ state: scene(GOOD.map((c) => (c.id === 'x' ? { ...c, sel: 'ui', select: (s: State) => s.ui } : c)), spreadHit, 'noop (spread)', { text: 'nothing changed, but every slice has a new reference', tone: 'bad' }), hold: 3400 }],
    },
    {
      label: 'Recap',
      title: 'A re-render checklist',
      tag: 'recap',
      body: [
        '- **Select** the smallest slice, never the whole store.',
        '- **Derive** with `createSelector`, not inline `filter`.',
        '- **Split** slices by domain, not by screen.',
        '- **Reduce** without spreading: let Immer share references.',
        '- **Keep** one-component state (modals, inputs) out of Redux.',
      ],
      keyIdea: 'Profile with Redux DevTools and the React profiler first. The problem may be the components, not Redux.',
      frames: [{ state: scene(GOOD, goodHit, 'toggleModal', { text: 'measure, then change one thing at a time', tone: 'accent' }) }],
    },
  ],
});
