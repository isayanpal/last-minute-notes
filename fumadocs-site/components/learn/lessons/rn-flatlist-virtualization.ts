import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the React Native notes on ScrollView, FlatList virtualization and FlashList recycling. Each cell is one viewport of rows.
 * A window function decides what FlatList mounts, a fast scroll shows blank space when the target is outside it,
 * and a recycling pool reproduces the leaked local state gotcha.
 */

const SCREENS = 12;
const idx = Array.from({ length: SCREENS }, (_, i) => i);
const label = (i: number) => String(i + 1);

/** windowSize counts viewports: the visible one plus (windowSize - 1) / 2 on each side. */
const windowOf = (current: number, windowSize: number): Set<number> => {
  const half = Math.floor((windowSize - 1) / 2);
  return new Set(idx.filter((i) => i >= current - half && i <= current + half));
};

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const screensRow = (mounted: Set<number>, current: number, blank?: number): ArrayState['rows'][number] => ({
  label: 'screens',
  cells: idx.map(label),
  states: paint(SCREENS, (i) => (i === blank ? 'bad' : i === current ? 'active' : mounted.has(i) ? 'done' : 'dim')),
  showIndex: false,
});

const scrollView = (): ArrayState => {
  const all = new Set(idx);
  return {
    rows: [screensRow(all, 5)],
    stats: [
      { label: 'Mounted', value: `${all.size} of ${SCREENS}`, tone: 'bad' },
      { label: 'Memory', value: 'grows with N', tone: 'bad' },
      { label: 'Good for', value: 'short content' },
    ],
    note: { text: 'ScrollView renders every child immediately: fine for a settings page, not for a feed', tone: 'bad' },
  };
};

const flatList = (current: number, windowSize: number, blank?: number, note?: string): ArrayState => {
  const w = windowOf(current, windowSize);
  return {
    rows: [screensRow(w, current, blank)],
    stats: [
      { label: 'windowSize', value: String(windowSize) },
      { label: 'Mounted', value: `${w.size} of ${SCREENS}`, tone: 'ok' },
      { label: 'Blank area', value: blank !== undefined ? 'yes' : 'no', tone: blank !== undefined ? 'bad' : 'ok' },
    ],
    note: { text: note ?? 'only the viewport and a few screens around it are mounted, the rest are spacers', tone: 'ok' },
  };
};

// Fast scroll: the target screen is outside the window until JS catches up.
const FAR = 10;
const blankNow = !windowOf(5, 5).has(FAR);

// Recycling: a pool of cells is reused, and a cell's own state follows it.
const POOL = 3;
const ITEMS = ['A', 'B', 'C', 'D', 'E', 'F'];
type Recycled = { items: string[]; cells: number[]; liked: (string | '')[] };
const recycle = (first: number, likedByCell: Record<number, boolean>, likedById: Record<string, boolean>, fixed: boolean): Recycled => {
  const items = ITEMS.slice(first, first + POOL);
  const cells = items.map((_, k) => (first + k) % POOL);
  const liked = items.map((it, k) => ((fixed ? likedById[it] : likedByCell[cells[k]]) ? 'yes' : ''));
  return { items, cells, liked };
};
// The user likes item A while it sits in cell 0.
const likedByCell: Record<number, boolean> = { 0: true };
const likedById: Record<string, boolean> = { A: true };

const pool = (first: number, fixed: boolean, note: ArrayState['note']): ArrayState => {
  const r = recycle(first, likedByCell, likedById, fixed);
  const wrong = r.items.filter((it, k) => r.liked[k] === 'yes' && !likedById[it]).length;
  return {
    rows: [
      { label: 'item', cells: r.items, states: paint(POOL, () => 'visited'), showIndex: false },
      { label: 'cell', cells: r.cells.map((c) => `#${c}`), states: paint(POOL, () => 'normal'), showIndex: false },
      { label: 'liked', cells: r.liked, states: paint(POOL, (k) => (r.liked[k] === 'yes' && !likedById[r.items[k]] ? 'bad' : r.liked[k] ? 'found' : 'dim')), showIndex: false },
    ],
    stats: [
      { label: 'Cells in pool', value: String(POOL) },
      { label: 'Items scrolled', value: String(first) },
      { label: 'Wrong "liked"', value: String(wrong), tone: wrong ? 'bad' : 'ok' },
    ],
    note,
  };
};

export default defineLesson('array', {
  slug: 'rn-flatlist-virtualization',
  objectives: [
    { text: 'Why ScrollView does not scale', step: 1 },
    { text: 'How FlatList mounts only a window', step: 2 },
    { text: 'Why fast scrolling shows blank areas', step: 3 },
    { text: 'How FlashList recycles cells and what leaks', step: 4 },
  ],
  steps: [
    {
      label: 'ScrollView',
      title: 'Everything at once',
      tag: 'problem',
      body: ['`ScrollView` renders **all** children immediately. Each cell here is one screenful of rows.', 'Memory grows with the number of items.'],
      keyIdea: 'More than a screen or two of repeated items means a virtualized list.',
      frames: [{ state: scrollView(), hold: 3800 }],
    },
    {
      label: 'Window',
      title: 'FlatList mounts a window',
      tag: 'concept',
      body: ['`FlatList` mounts the viewport and a few screens around it, controlled by `windowSize`, and replaces the rest with spacer views.', 'Memory stays bounded however long the list is.'],
      keyIdea: 'windowSize 21 means 10 viewports above, 10 below and 1 visible.',
      frames: [{ state: flatList(5, 5), hold: 3800 }],
    },
    {
      label: 'Blank areas',
      title: 'Scrolling faster than JS',
      tag: 'trade-off',
      body: ['If the user flings further than the window, the target screens are not mounted yet. They see **blank space** until JS renders them.', 'A larger `windowSize`, cheap memoised rows and `getItemLayout` reduce it.'],
      keyIdea: 'Blank areas are the classic FlatList complaint.',
      frames: [{ state: flatList(5, 5), hold: 1800 }, { state: flatList(5, 5, blankNow ? FAR : undefined, 'the user flings to screen 11, which is outside the mounted window'), hold: 3000 }, { state: flatList(FAR, 5, undefined, 'JS catches up and mounts a new window around screen 11'), hold: 3400 }],
    },
    {
      label: 'Recycling',
      title: 'FlashList reuses cells',
      tag: 'technique',
      body: ['**FlashList** recycles native cells: a cell scrolled out is reused with new props for the item scrolling in.', 'Gotcha: local state in a row stays with the **cell**, so it leaks into the next item.'],
      keyIdea: 'Keep row state in the data, or reset it when the item id changes.',
      frames: [{ state: pool(0, false, { text: 'the user likes item A, which sits in cell #0', tone: 'accent' }), hold: 2800 }, { state: pool(3, false, { text: 'cell #0 is reused for item D, and its liked state leaked with it', tone: 'bad' }), hold: 3800 }, { state: pool(3, true, { text: 'state keyed by item id: D is not liked, because only A was', tone: 'ok' }), hold: 3800 }],
    },
    {
      label: 'Recap',
      title: 'Lists in React Native',
      tag: 'recap',
      body: [
        '- **ScrollView:** all children, short content only.',
        '- **FlatList:** a mounted window, bounded memory.',
        '- **Blank areas:** scrolling outran rendering.',
        '- **FlashList:** recycles cells, much less memory.',
        '- **Recycling gotcha:** state follows the cell, not the item.',
      ],
      keyIdea: 'Memoise rows, keep them cheap, and give stable keys.',
      frames: [{ state: flatList(5, 5) }],
    },
  ],
});
