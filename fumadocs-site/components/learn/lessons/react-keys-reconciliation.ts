import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the React notes on keys and reconciliation: list items are matched by key, and the element type decides
 * whether state survives. A real matching function runs the delete scenario with index keys and with id keys.
 */

type Item = { id: string; label: string };
type Slot = { key: string; draft: string };

const ITEMS: Item[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
];
const DRAFTS = ['hi', 'yo', 'ok']; // what the user typed into each row's input

/** React keeps a slot's state when the same key shows up again, and starts empty otherwise. */
const reconcile = (prev: Slot[], next: Item[], keyOf: (it: Item, i: number) => string): Slot[] =>
  next.map((it, i) => {
    const key = keyOf(it, i);
    return { key, draft: prev.find((s) => s.key === key)?.draft ?? '' };
  });

const byIndex = (_: Item, i: number) => String(i);
const byId = (it: Item) => it.id;

const initialIndex: Slot[] = ITEMS.map((it, i) => ({ key: byIndex(it, i), draft: DRAFTS[i] }));
const initialId: Slot[] = ITEMS.map((it) => ({ key: byId(it), draft: DRAFTS[ITEMS.indexOf(it)] }));
const AFTER = ITEMS.slice(1); // delete the first row
const indexAfter = reconcile(initialIndex, AFTER, byIndex);
const idAfter = reconcile(initialId, AFTER, byId);

// Type rule: same element type keeps state, a different type unmounts the subtree.
const typeAfter = (sameType: boolean) => (sameType ? 5 : 0);

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;
const cell = (v: string, id: string) => ({ v, id });

// Step 1: each row owns local state.
const rowsState = (): ArrayState => ({
  rows: [
    { label: 'item', cells: ITEMS.map((it) => cell(it.label, `i-${it.id}`)), states: paint(3, () => 'normal'), showIndex: false },
    { label: 'draft', cells: DRAFTS.map((d, i) => cell(d, `d-${ITEMS[i].id}`)), states: paint(3, () => 'visited'), showIndex: false },
  ],
  stats: [
    { label: 'Rows', value: '3' },
    { label: 'State lives in', value: 'each row' },
    { label: 'Matched by', value: 'key' },
  ],
  note: { text: 'each row has an input with text the user typed: that text is state', tone: 'accent' },
});

// Steps 2, 3: delete the first row.
const deleteState = (kind: 'index' | 'id', after: boolean): ArrayState => {
  const slots = kind === 'index' ? (after ? indexAfter : initialIndex) : after ? idAfter : initialId;
  const items = after ? AFTER : ITEMS;
  const bad = (i: number) => kind === 'index' && after && slots[i].draft !== DRAFTS[ITEMS.indexOf(items[i])];
  const wrong = items.filter((_, i) => bad(i)).length;
  return {
    rows: [
      { label: 'key', cells: slots.map((s) => cell(s.key, `k-${kind}-${s.key}`)), states: paint(slots.length, () => 'normal'), showIndex: false },
      { label: 'item', cells: items.map((it) => cell(it.label, `i-${it.id}`)), states: paint(items.length, () => 'normal'), showIndex: false },
      { label: 'draft', cells: slots.map((s, i) => cell(s.draft, `d-${kind}-${items[i].id}`)), states: paint(slots.length, (i) => (bad(i) ? 'bad' : after ? 'found' : 'visited')), showIndex: false },
    ],
    stats: [
      { label: 'Key', value: kind === 'index' ? 'array index' : 'item.id' },
      { label: 'Rows', value: String(items.length) },
      { label: 'Wrong draft', value: after ? String(wrong) : '-', tone: after ? (wrong ? 'bad' : 'ok') : 'neutral' },
    ],
    note: !after
      ? { text: kind === 'index' ? 'keys 0, 1, 2 are positions, not identities' : 'keys a, b, c identify the data, not its position', tone: 'accent' }
      : kind === 'index'
        ? { text: `A is gone, but key 0 still exists: B inherits A's draft "${indexAfter[0].draft}"`, tone: 'bad' }
        : { text: `React drops key a and keeps b and c with their own drafts "${idAfter[0].draft}" and "${idAfter[1].draft}"`, tone: 'ok' },
  };
};

// Step 4: element type.
const typeState = (sameType: boolean, after: boolean): ArrayState => ({
  rows: [
    { label: 'type', cells: [after ? (sameType ? 'div' : 'span') : 'div'], states: { 0: after && !sameType ? 'swap' : 'normal' }, showIndex: false },
    { label: 'state', cells: [after ? typeAfter(sameType) : 5], states: { 0: after ? (sameType ? 'found' : 'bad') : 'visited' }, showIndex: false },
  ],
  stats: [
    { label: 'Type changed', value: after ? (sameType ? 'no' : 'yes') : '-', tone: after ? (sameType ? 'ok' : 'bad') : 'neutral' },
    { label: 'Subtree', value: after ? (sameType ? 'kept' : 'remounted') : 'mounted', tone: after ? (sameType ? 'ok' : 'bad') : 'neutral' },
    { label: 'State', value: String(after ? typeAfter(sameType) : 5), tone: after ? (sameType ? 'ok' : 'bad') : 'neutral' },
  ],
  note: !after ? { text: 'a component holds state 5 under a div', tone: 'accent' } : sameType ? { text: 'same type at the same position: keep the node and its state, update props', tone: 'ok' } : { text: 'different type: unmount the old subtree and mount a new one, so state is lost', tone: 'bad' },
});

export default defineLesson('array', {
  slug: 'react-keys-reconciliation',
  objectives: [
    { text: 'What state a list row owns', step: 1 },
    { text: 'Why index keys break after a delete', step: 2 },
    { text: 'How stable ids keep state with its data', step: 3 },
    { text: 'How the element type decides state survival', step: 4 },
  ],
  steps: [
    {
      label: 'Row state',
      title: 'Rows own state',
      tag: 'problem',
      body: ['A list of rows, each with an input, keeps what the user typed as **state** inside each row.', 'When the list changes, React must decide which old row each new row is.'],
      keyIdea: 'Keys are how React matches new list items to old ones.',
      frames: [{ state: rowsState(), hold: 3600 }],
    },
    {
      label: 'Index keys',
      title: 'Position is not identity',
      tag: 'trade-off',
      body: ['With `key={index}`, deleting the first row leaves keys 0 and 1. React keeps the state under key 0, which now holds B.', 'B shows the text that was typed into A.'],
      keyIdea: 'Index keys cause bugs on reorder, insert and delete.',
      frames: [{ state: deleteState('index', false), hold: 2400 }, { state: deleteState('index', true), hold: 3800 }],
    },
    {
      label: 'Stable keys',
      title: 'Key by id',
      tag: 'technique',
      body: ['With `key={item.id}`, React sees that key `a` is gone and keys `b` and `c` remain.', 'Each remaining row keeps its own state.'],
      keyIdea: 'Use a stable, unique id from the data as the key.',
      frames: [{ state: deleteState('id', false), hold: 2400 }, { state: deleteState('id', true), hold: 3800 }],
    },
    {
      label: 'Type rule',
      title: 'Same type keeps, different type resets',
      tag: 'concept',
      body: ['At one position, if the old and new element have the **same type**, React keeps the node and state and updates props.', 'If the **type differs**, the old subtree unmounts and a new one mounts, so state is lost.'],
      keyIdea: 'Changing `div` to `span`, or a component to another, resets everything below it.',
      frames: [{ state: typeState(true, false), hold: 2200 }, { state: typeState(true, true), hold: 3000 }, { state: typeState(false, true), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Reconciliation rules',
      tag: 'recap',
      body: [
        '- **Diff:** compare old and new element at each position.',
        '- **Same type:** keep state, update props.',
        '- **Different type:** unmount and remount.',
        '- **Lists:** match items by key.',
        '- **Keys:** stable ids, not indexes.',
      ],
      keyIdea: 'If a row shows the wrong state after a change, check its key first.',
      frames: [{ state: deleteState('id', true) }],
    },
  ],
});
