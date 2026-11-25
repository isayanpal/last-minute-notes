import { defineLesson } from '../define';
import type { ArrayRow, ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Frames come from running the heap-of-heads merge on the notes' inputs.
 * Rows are the K sorted lists, the side panel is the merged output, and the stats show what the heap holds.
 * Ties on value are broken by list index so the run is deterministic.
 */

const LISTS = [
  [1, 4, 5],
  [1, 3, 4],
  [2, 6],
];
const NAMES = ['a', 'b', 'c'];

type Entry = { v: number; list: number; idx: number };

/** A tiny binary min-heap on [value, list] so ties pop in list order. */
class MinHeap {
  a: Entry[] = [];
  private less = (x: Entry, y: Entry) => x.v < y.v || (x.v === y.v && x.list < y.list);
  get size() {
    return this.a.length;
  }
  push(e: Entry) {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): Entry {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
  sorted() {
    return [...this.a].sort((x, y) => (this.less(x, y) ? -1 : 1));
  }
}

const tagOf = (e: Entry, names = NAMES) => `${e.v}${names[e.list]}`;

type Snap = { heap: MinHeap; consumed: Set<string>; popped?: Entry; pushed?: Entry; out: string[] };

function listRows(s: Snap, lists = LISTS, names = NAMES, labels = (i: number) => `list ${names[i]}`): ArrayRow[] {
  const inHeap = new Set(s.heap.a.map((e) => `${e.list},${e.idx}`));
  return lists.map((cells, li) => {
    const states: Record<number, ItemState> = {};
    const pointers: ArrayRow['pointers'] = [];
    cells.forEach((_, ci) => {
      const key = `${li},${ci}`;
      if (s.popped && s.popped.list === li && s.popped.idx === ci) {
        states[ci] = 'found';
        pointers.push({ i: ci, label: 'pop', tone: 'ok' });
      } else if (inHeap.has(key)) {
        states[ci] = s.pushed && s.pushed.list === li && s.pushed.idx === ci ? 'active' : 'visited';
        pointers.push({ i: ci, label: s.pushed && s.pushed.list === li && s.pushed.idx === ci ? 'pushed' : 'head', tone: 'info' });
      } else if (s.consumed.has(key)) states[ci] = 'dim';
    });
    return { label: labels(li), cells, states, pointers, showIndex: false };
  });
}

function mergeFrames(): Frame<ArrayState>[] {
  const heap = new MinHeap();
  LISTS.forEach((l, i) => l.length && heap.push({ v: l[0], list: i, idx: 0 }));
  const consumed = new Set<string>();
  const out: string[] = [];
  const frames: Frame<ArrayState>[] = [];
  const heapText = () =>
    heap
      .sorted()
      .map((e) => tagOf(e))
      .join(' ');
  frames.push({
    hold: 1600,
    state: {
      rows: listRows({ heap, consumed, out }),
      panels: [{ title: 'output', kind: 'list', items: [] }],
      stats: [
        { label: 'heap', value: `{${heapText()}}` },
        { label: 'heap size', value: `${heap.size} / K=3` },
        { label: 'output', value: '0 / 8' },
      ],
      note: { text: 'push the head of every list: one candidate per list', tone: 'accent' },
    },
  });
  while (heap.size > 0) {
    const e = heap.pop();
    consumed.add(`${e.list},${e.idx}`);
    out.push(tagOf(e));
    let pushed: Entry | undefined;
    const list = LISTS[e.list];
    if (e.idx + 1 < list.length) {
      pushed = { v: list[e.idx + 1], list: e.list, idx: e.idx + 1 };
      heap.push(pushed);
    }
    frames.push({
      hold: 1200,
      state: {
        rows: listRows({ heap, consumed, popped: e, pushed, out }),
        panels: [{ title: 'output', kind: 'list', items: [...out], highlight: out.length - 1 }],
        stats: [
          { label: 'heap', value: `{${heapText()}}` },
          { label: 'popped', value: tagOf(e), tone: 'ok' },
          { label: 'output', value: `${out.length} / 8` },
        ],
        note: pushed
          ? { text: `pop ${tagOf(e)}, push the next of list ${NAMES[e.list]}: ${tagOf(pushed)}` }
          : { text: `pop ${tagOf(e)}: list ${NAMES[e.list]} is empty, push nothing`, tone: 'accent' },
      },
    });
  }
  const last = frames[frames.length - 1].state;
  frames.push({
    state: {
      rows: LISTS.map((cells, li) => ({ label: `list ${NAMES[li]}`, cells, states: Object.fromEntries(cells.map((_, i) => [i, 'dim' as const])), showIndex: false })),
      panels: last.panels,
      stats: [
        { label: 'Merged', value: '8 values', tone: 'ok' },
        { label: 'Time', value: 'O(N log K)' },
        { label: 'Heap space', value: 'O(K)' },
      ],
      note: { text: '[1, 1, 2, 3, 4, 4, 5, 6]', tone: 'ok' },
    },
  });
  return frames;
}
const MERGE = mergeFrames();

// Step 1: the lists and the goal.
const PROBLEM: Frame<ArrayState>[] = [
  {
    hold: 1800,
    state: {
      rows: LISTS.map((cells, li) => ({ label: `list ${NAMES[li]}`, cells, showIndex: false })),
      stats: [
        { label: 'K', value: '3 lists' },
        { label: 'N', value: '8 values' },
        { label: 'Each list', value: 'sorted', tone: 'ok' },
      ],
      note: { text: 'merge into one sorted list', tone: 'accent' },
    },
  },
  {
    state: {
      rows: LISTS.map((cells, li) => ({
        label: `list ${NAMES[li]}`,
        cells,
        showIndex: false,
        states: { 0: 'active' as const },
        pointers: [{ i: 0, label: 'head', tone: 'info' as const }],
      })),
      stats: [
        { label: 'K', value: '3 lists' },
        { label: 'Candidates', value: '3 heads', tone: 'ok' },
        { label: 'Rest', value: 'can wait' },
      ],
      note: { text: 'the next smallest value is always one of the K heads', tone: 'accent' },
    },
  },
];

// Step 5: kth smallest in a sorted matrix, rows as lists.
const MATRIX = [
  [1, 5, 9],
  [10, 11, 13],
  [12, 13, 15],
];
const KTH = 8;

function matrixFrames(): Frame<ArrayState>[] {
  const n = MATRIX.length;
  const heap = new MinHeap();
  for (let r = 0; r < Math.min(n, KTH); r++) heap.push({ v: MATRIX[r][0], list: r, idx: 0 });
  const consumed = new Set<string>();
  const frames: Frame<ArrayState>[] = [];
  const rowNames = ['r0', 'r1', 'r2'];
  const label = (e: Entry) => `${e.v} (r${e.list},c${e.idx})`;
  let value = 0;
  for (let i = 0; i < KTH; i++) {
    const e = heap.pop();
    value = e.v;
    consumed.add(`${e.list},${e.idx}`);
    let pushed: Entry | undefined;
    if (e.idx + 1 < n) {
      pushed = { v: MATRIX[e.list][e.idx + 1], list: e.list, idx: e.idx + 1 };
      heap.push(pushed);
    }
    const final = i === KTH - 1;
    frames.push({
      hold: final ? 2000 : 850,
      state: {
        rows: listRows({ heap, consumed, popped: e, pushed, out: [] }, MATRIX, rowNames, (r) => `row ${r}`),
        panels: [{ title: 'heap', kind: 'list', items: heap.sorted().map(label), highlight: 0 }],
        stats: [
          { label: 'pop #', value: `${i + 1} / k=${KTH}`, tone: final ? 'ok' : 'neutral' },
          { label: 'value', value: String(e.v), tone: final ? 'ok' : 'neutral' },
          { label: 'heap size', value: String(heap.size), hint: '<= min(n, k)' },
        ],
        note: final ? { text: `the 8th pop is ${value}: the answer`, tone: 'ok' } : undefined,
      },
    });
  }
  return frames;
}

// Step 6: divide and conquer, merging pairs each round.
function mergeTwo(a: number[], b: number[]) {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);
  return [...out, ...a.slice(i), ...b.slice(j)];
}

function divideFrames(): Frame<ArrayState>[] {
  let lists = LISTS.map((l, i) => ({ cells: l, name: NAMES[i] }));
  const frames: Frame<ArrayState>[] = [];
  let round = 0;
  const push = (note?: ArrayState['note']) =>
    frames.push({
      hold: 1700,
      state: {
        rows: lists.map((l) => ({ label: l.name, cells: l.cells, showIndex: false, states: lists.length === 1 ? Object.fromEntries(l.cells.map((_, i) => [i, 'done' as const])) : undefined })),
        stats: [
          { label: 'Round', value: String(round) },
          { label: 'Lists left', value: String(lists.length) },
          { label: 'Rounds total', value: 'log K', hint: 'O(N log K) overall' },
        ],
        note,
      },
    });
  push({ text: 'merge lists in pairs: no heap needed' });
  while (lists.length > 1) {
    const merged: typeof lists = [];
    for (let i = 0; i < lists.length; i += 2) {
      const b = lists[i + 1];
      merged.push(b ? { cells: mergeTwo(lists[i].cells, b.cells), name: `${lists[i].name} + ${b.name}` } : lists[i]);
    }
    lists = merged;
    round++;
    push(lists.length === 1 ? { text: 'halving the count each round: same O(N log K)', tone: 'ok' } : undefined);
  }
  return frames;
}

const RECAP: ArrayState = {
  rows: [
    { label: 'lists', cells: ['1a', '4a', '5a', '1b', '3b', '4b', '2c', '6c'], states: { 0: 'visited', 3: 'visited', 6: 'visited' }, showIndex: false },
    { label: 'merged', cells: [1, 1, 2, 3, 4, 4, 5, 6], states: Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i, 'done' as const])), showIndex: false },
  ],
  stats: [
    { label: 'Time', value: 'O(N log K)', tone: 'ok' },
    { label: 'Heap', value: 'O(K) space' },
    { label: 'Avoid', value: 'fold: O(N·K)', tone: 'bad' },
  ],
};

export default defineLesson('isoArray', {
  slug: 'k-way-merge',
  pseudocode: [
    'heap = the first element of each list',
    'while heap is not empty:',
    '    pop the smallest',
    '    append it to the output',
    '    push its successor from that list',
  ],
  objectives: [
    { text: 'See why only the K heads can be next', step: 1 },
    { text: 'Run the heap-of-heads merge: pop, output, push next', step: 3 },
    { text: 'Stop after k pops for the kth smallest in a sorted matrix', step: 5 },
    { text: 'Compare heap, divide and conquer, and fold left', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Three sorted lists, one sorted output',
      tag: 'problem',
      body: [
        'Merge `[1, 4, 5]`, `[1, 3, 4]` and `[2, 6]` into one sorted list.',
        'Each list is already sorted, so the next value of the output must be the smallest of the **current heads**. Everything behind a head can wait.',
      ],
      keyIdea: 'K sorted lists, arrays or streams that need one merged order, the kth element, or a range across all: think K-way merge.',
      frames: PROBLEM,
    },
    {
      label: 'Heap of heads',
      title: 'Put one head per list in a min-heap',
      tag: 'concept',
      code: [1],
      body: [
        'Push the head of every list into a min-heap. Pop the smallest and output it.',
        'Then push the **next** element from the same list, so every list always has exactly one candidate in the heap.',
      ],
      keyIdea: 'The heap holds at most K items, so each step costs O(log K).',
      frames: MERGE.slice(0, 2),
    },
    {
      label: 'Pop, push',
      title: 'Pop the smallest, push its successor',
      tag: 'technique',
      code: [3, 4, 5],
      body: [
        'Store `[value, listIndex, elementIndex]` so you always know where the popped value came from.',
        'When a list runs out, push nothing. The heap just shrinks.',
      ],
      keyIdea: 'Pop, output, push the next from the same list. Repeat until the heap is empty.',
      frames: MERGE.slice(1, 5),
    },
    {
      label: 'Full merge',
      title: 'Run to the end',
      tag: 'technique',
      code: [2, 3, 4, 5],
      body: ['The heap empties after N = 8 pops. Output: `[1, 1, 2, 3, 4, 4, 5, 6]`.', 'For N total elements: **O(N log K)** time and **O(K)** heap space.'],
      keyIdea: 'Never push the whole input into the heap. One head per list is the whole point.',
      frames: MERGE.slice(4),
    },
    {
      label: 'Matrix',
      title: 'Kth smallest in a sorted matrix',
      tag: 'in practice',
      code: [1, 3, 5],
      body: [
        'Every row is sorted, so treat each row as one list and run K-way merge. Stop after `k` pops.',
        'Only the first `min(n, k)` rows can matter. For k = 8 the answer is **13**, in O(k log min(n, k)).',
      ],
      keyIdea: 'You do not have to finish the merge. Stop as soon as you have popped k values.',
      frames: matrixFrames(),
    },
    {
      label: 'Alternatives',
      title: 'Heap, pairs, or one by one',
      tag: 'trade-off',
      body: [
        '**Divide and conquer** merges lists in pairs, halving the count each round. Same O(N log K), no heap.',
        'Merging one after another (fold left) is **O(N · K)**, the answer to avoid.',
      ],
      keyIdea: 'Heap or pairwise merging both give O(N log K). Folding left does not.',
      frames: divideFrames(),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** K sorted lists or streams, merged order, kth element, or a range covering all.',
        '- **Loop:** heap of heads, pop the min, push its successor from the same list.',
        '- **Cost:** O(N log K) time, O(K) heap space.',
        '- **Variants:** kth smallest in a matrix, smallest range (track the max too), K pairs with smallest sums.',
        '- **Pitfalls:** pushing everything, losing the list index, empty lists, comparing the wrong tuple field.',
      ],
      keyIdea: 'Keep exactly one candidate per list in a min-heap.',
      frames: [{ state: RECAP }],
    },
  ],
});
