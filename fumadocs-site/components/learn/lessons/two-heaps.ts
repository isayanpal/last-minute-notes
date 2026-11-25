import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import type { Frame } from '../types';

/*
 * A real binary heap runs MedianFinder on the notes' stream 5, 15, 1, 3.
 * Each value keeps its node id, so it glides between the two heaps as it moves.
 * Layout: `small` (max-heap) on the left around x 2.5, `large` (min-heap) on the right around x 7.5.
 */

type Item = { id: string; v: number };

class Heap {
  a: Item[] = [];
  constructor(private before: (x: number, y: number) => boolean) {}
  get size() {
    return this.a.length;
  }
  peek() {
    return this.a[0];
  }
  push(it: Item) {
    const a = this.a;
    a.push(it);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.before(a[i].v, a[p].v)) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): Item {
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
        if (l < a.length && this.before(a[l].v, a[m].v)) m = l;
        if (r < a.length && this.before(a[r].v, a[m].v)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
  clone() {
    const h = new Heap(this.before);
    h.a = [...this.a];
    return h;
  }
}

const maxHeap = () => new Heap((x, y) => x > y);
const minHeap = () => new Heap((x, y) => x < y);

const HEADERS: GraphNode[] = [
  { id: 'hs', label: 'small', x: 2.5, y: 0.2, shape: 'box', tag: 'max-heap' },
  { id: 'hl', label: 'large', x: 7.5, y: 0.2, shape: 'box', tag: 'min-heap' },
];

function heapPos(i: number, cx: number) {
  const depth = Math.floor(Math.log2(i + 1));
  const count = 2 ** depth;
  const p = i - (count - 1);
  return { x: cx - 2 + ((p + 0.5) / count) * 4, y: 2 + depth * 1.7 };
}

function heapGraph(h: Heap, cx: number, base: ItemState): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = h.a.map((it, i) => ({ id: it.id, label: it.v, ...heapPos(i, cx), state: base }));
  const edges = h.a.slice(1).map((it, k) => ({ from: h.a[k >> 1].id, to: it.id }));
  return { nodes, edges };
}

const median = (s: Heap, l: Heap) => (s.size > l.size ? s.peek().v : (s.peek().v + l.peek().v) / 2);

type Snap = { incoming?: Item; active?: string[]; found?: string[]; note?: GraphState['note']; showMedian?: boolean };

function scene(small: Heap, large: Heap, o: Snap = {}): GraphState {
  const s = heapGraph(small, 2.5, 'visited');
  const l = heapGraph(large, 7.5, 'done');
  const nodes = [...HEADERS, ...s.nodes, ...l.nodes];
  if (o.incoming) nodes.push({ id: o.incoming.id, label: o.incoming.v, x: 5, y: 0.2, state: 'active', tag: 'add' });
  const mark = (ids: string[] | undefined, st: ItemState) => ids?.forEach((id) => {
    const n = nodes.find((x) => x.id === id);
    if (n) n.state = st;
  });
  mark(o.active, 'active');
  mark(o.found, 'found');
  const med = o.showMedian && small.size ? median(small, large) : undefined;
  return {
    nodes,
    edges: [...s.edges, ...l.edges],
    stats: [
      { label: 'small', value: `${small.size}`, hint: 'max-heap' },
      { label: 'large', value: `${large.size}`, hint: 'min-heap' },
      { label: 'median', value: med === undefined ? '-' : String(med), tone: med === undefined ? 'neutral' : 'ok' },
    ],
    note: o.note,
  };
}

/** Runs addNum(x) exactly as the notes write it, emitting a frame per move. */
function addFrames(small: Heap, large: Heap, it: Item, compact = false): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  if (!compact) frames.push({ hold: 1000, state: scene(small, large, { incoming: it, note: { text: `addNum(${it.v})`, tone: 'accent' } }) });
  small.push(it);
  frames.push({ hold: 1300, state: scene(small, large, { active: [it.id], note: { text: `push ${it.v} into small` } }) });
  const moved = small.pop();
  large.push(moved);
  frames.push({ hold: 1400, state: scene(small, large, { active: [moved.id], note: { text: `move small.top (${moved.v}) to large: ordering holds`, tone: 'accent' } }) });
  if (large.size > small.size) {
    const back = large.pop();
    small.push(back);
    frames.push({ hold: 1400, state: scene(small, large, { active: [back.id], note: { text: `large is bigger: move ${back.v} back to small`, tone: 'accent' } }) });
  }
  const odd = small.size > large.size;
  const found = odd ? [small.peek().id] : [small.peek().id, large.peek().id];
  const m = median(small, large);
  frames.push({
    hold: 1700,
    state: scene(small, large, {
      found,
      showMedian: true,
      note: { text: odd ? `odd count: median = small.top = ${m}` : `even count: (${small.peek().v} + ${large.peek().v}) / 2 = ${m}`, tone: 'ok' },
    }),
  });
  return frames;
}

const STREAM = [5, 15, 1, 3].map((v, k) => ({ id: `v${k}`, v }));

// Run the whole stream once, keeping heap snapshots between steps.
const SMALL = maxHeap();
const LARGE = minHeap();
const ADD_5 = addFrames(SMALL, LARGE, STREAM[0]);
const ADD_15 = addFrames(SMALL, LARGE, STREAM[1]);
const ADD_1 = addFrames(SMALL, LARGE, STREAM[2], true);
const ADD_3 = addFrames(SMALL, LARGE, STREAM[3], true);
const FINAL_SMALL = SMALL.clone();
const FINAL_LARGE = LARGE.clone();

// Step 1: a sorted list shifts on every insert.
function sortedFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  const seen: Item[] = [];
  STREAM.forEach((it) => {
    seen.push(it);
    const sorted = [...seen].sort((a, b) => a.v - b.v);
    const m = sorted.length;
    const mids = m % 2 ? [sorted[(m - 1) / 2]] : [sorted[m / 2 - 1], sorted[m / 2]];
    const med = mids.reduce((s, x) => s + x.v, 0) / mids.length;
    const nodes: GraphNode[] = sorted.map((x, j) => ({
      id: x.id,
      label: x.v,
      x: 5 + (j - (m - 1) / 2) * 1.5,
      y: 2.6,
      shape: 'box',
      state: mids.includes(x) ? 'found' : x === it ? 'active' : 'normal',
      tag: x === it ? 'new' : undefined,
    }));
    const shifted = sorted.length - 1 - sorted.indexOf(it);
    frames.push({
      hold: 1400,
      state: {
        nodes,
        stats: [
          { label: 'Added', value: String(it.v) },
          { label: 'Shifted', value: String(shifted), tone: shifted ? 'bad' : 'neutral', hint: 'sorted insert is O(n)' },
          { label: 'median', value: String(med), tone: 'ok' },
        ],
      },
    });
  });
  frames[frames.length - 1].state.note = { text: 'we only ever read the middle, yet keep everything sorted', tone: 'bad' };
  return frames;
}

// Step 2: the finished split.
const CONCEPT: Frame<GraphState>[] = [
  { hold: 1800, state: scene(FINAL_SMALL, FINAL_LARGE, { note: { text: 'every value in small <= every value in large' } }) },
  {
    state: scene(FINAL_SMALL, FINAL_LARGE, {
      found: [FINAL_SMALL.peek().id, FINAL_LARGE.peek().id],
      showMedian: true,
      note: { text: 'the median lives at the two tops: (3 + 5) / 2 = 4', tone: 'ok' },
    }),
  },
];

// Step 7: the classic bug, the lower half as a min-heap.
function wrongFrames(): Frame<GraphState>[] {
  const wrongSmall = minHeap();
  FINAL_SMALL.a.forEach((it) => wrongSmall.push(it));
  const bad = scene(wrongSmall, FINAL_LARGE, {});
  bad.nodes = bad.nodes.map((n) => (n.id === wrongSmall.peek().id ? { ...n, state: 'bad' as const } : n.id === FINAL_LARGE.peek().id ? { ...n, state: 'found' as const } : n));
  bad.nodes = bad.nodes.map((n) => (n.id === 'hs' ? { ...n, tag: 'min-heap?' } : n));
  bad.stats = [
    { label: 'small.top', value: String(wrongSmall.peek().v), tone: 'bad' },
    { label: 'large.top', value: String(FINAL_LARGE.peek().v) },
    { label: 'median', value: String((wrongSmall.peek().v + FINAL_LARGE.peek().v) / 2), tone: 'bad' },
  ];
  bad.note = { text: 'smaller half as a min-heap: its top is the smallest, not the middle', tone: 'bad' };
  const good = scene(FINAL_SMALL, FINAL_LARGE, { found: [FINAL_SMALL.peek().id, FINAL_LARGE.peek().id], showMedian: true, note: { text: 'smaller half is a MAX-heap: top 3, median 4', tone: 'ok' } });
  return [
    { hold: 2400, state: bad },
    { state: good },
  ];
}

// Step 6: IPO, two priorities. findMaximizedCapital(2, 0, [1, 2, 3], [0, 1, 1]).
const IPO_HEADERS: GraphNode[] = [
  { id: 'lock', label: 'locked', x: 1.5, y: 0.2, shape: 'box', tag: 'by capital' },
  { id: 'ready', label: 'ready', x: 5, y: 0.2, shape: 'box', tag: 'by profit' },
  { id: 'took', label: 'taken', x: 8.5, y: 0.2, shape: 'box' },
];

function ipoFrames(): Frame<GraphState>[] {
  const k = 2;
  let w = 0;
  const profits = [1, 2, 3];
  const capital = [0, 1, 1];
  const projects = profits.map((p, i) => ({ id: `p${i}`, p, c: capital[i] }));
  let locked = [...projects].sort((a, b) => a.c - b.c);
  let ready: typeof projects = [];
  const taken: typeof projects = [];
  const frames: Frame<GraphState>[] = [];
  const snap = (active: string[], note: GraphState['note'], round: number) => {
    const col = (list: typeof projects, x: number, st: ItemState): GraphNode[] =>
      list.map((pr, j) => ({ id: pr.id, label: `+${pr.p}`, x, y: 1.9 + j * 1.4, shape: 'box', tag: `needs ${pr.c}`, state: active.includes(pr.id) ? 'active' : st }));
    frames.push({
      hold: 1600,
      state: {
        nodes: [
          ...IPO_HEADERS.map((h) => (h.id === 'took' ? { ...h, tag: `w = ${w}` } : h)),
          ...col(locked, 1.5, 'dim'),
          ...col(ready, 5, 'visited'),
          ...col(taken, 8.5, 'done'),
        ],
        stats: [
          { label: 'Capital w', value: String(w), tone: 'ok' },
          { label: 'Projects', value: `${taken.length} / ${k}` },
          { label: 'Round', value: String(round) },
        ],
        note,
      },
    });
  };
  snap([], { text: 'k = 2 projects, start with w = 0', tone: 'accent' }, 0);
  for (let i = 0; i < k; i++) {
    const unlocked = locked.filter((pr) => pr.c <= w);
    locked = locked.filter((pr) => pr.c > w);
    ready = [...ready, ...unlocked].sort((a, b) => b.p - a.p);
    snap(
      unlocked.map((u) => u.id),
      { text: `pop every project needing <= ${w} into the profit heap` },
      i + 1,
    );
    if (!ready.length) break;
    const best = ready.shift()!;
    w += best.p;
    taken.push(best);
    snap([best.id], { text: `take the most profitable: +${best.p}, w = ${w}`, tone: 'ok' }, i + 1);
  }
  frames[frames.length - 1].state.note = { text: `final capital ${w}`, tone: 'ok' };
  return frames;
}

export default defineLesson('isoGraph', {
  slug: 'two-heaps',
  pseudocode: [
    'small = max-heap, large = min-heap',
    'add(x):',
    '    push x onto small',
    '    move small top to large',
    '    if large has more than small:',
    '        move large top to small',
    'median():',
    '    if the sizes differ: top of small',
    '    else: average of both tops',
  ],
  objectives: [
    { text: 'Split a stream into a max-heap half and a min-heap half', step: 2 },
    { text: 'Keep both invariants on every addNum', step: 3 },
    { text: 'Read the median from the tops in O(1)', step: 4 },
    { text: 'Use two heaps for two competing priorities (IPO)', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Median of a growing stream',
      tag: 'problem',
      body: [
        'Numbers arrive one at a time: `5, 15, 1, 3`. After each one, report the median.',
        'Keeping everything sorted works, but each insert shifts elements, and we only ever look at the middle.',
      ],
      keyIdea: 'Median or middle value from a stream, or two competing priorities: think two heaps.',
      frames: sortedFrames(),
    },
    {
      label: 'Two halves',
      title: 'A max-heap and a min-heap',
      tag: 'concept',
      code: [1],
      body: [
        '`small` is a **max-heap** of the smaller half, so its top is the largest small number. `large` is a **min-heap** of the larger half.',
        'Invariants: everything in `small` is at most everything in `large`, and `small` has the same size or exactly one more.',
      ],
      keyIdea: 'The median lives at the two tops.',
      frames: CONCEPT,
    },
    {
      label: 'Add 5',
      title: 'Push through small, then balance',
      tag: 'technique',
      code: [3, 4, 5, 6],
      body: [
        'Push the number into `small`, then move `small.top` to `large`. That keeps the ordering invariant without comparing to the current tops.',
        'If `large` is now bigger, move its top back to `small`.',
      ],
      keyIdea: 'Three moves per add, each O(log n), restore both invariants every time.',
      frames: ADD_5,
    },
    {
      label: 'Add 15',
      title: 'Even count: average the tops',
      tag: 'technique',
      code: [7, 9],
      body: [
        '15 goes into `small`, is the largest there, so it moves straight to `large`. Sizes are equal, so nothing moves back.',
        'With an even count the median is `(small.top + large.top) / 2` = **10**.',
      ],
      keyIdea: 'findMedian is O(1): odd count reads small.top, even count averages both tops.',
      frames: ADD_15,
    },
    {
      label: 'Add 1, 3',
      title: 'The dry run, continued',
      tag: 'technique',
      code: [2, 3, 4, 5, 6],
      body: [
        'Adding 1: 5 moves to `large`, then back, median **5**.',
        'Adding 3: `small` becomes `[3, 1]`, `large` becomes `[5, 15]`, median **4**. Exactly the notes\' table.',
      ],
      keyIdea: 'addNum is O(log n), findMedian is O(1).',
      frames: [...ADD_1, ...ADD_3],
    },
    {
      label: 'IPO',
      title: 'Two priorities: afford, then profit',
      tag: 'in practice',
      code: [1],
      body: [
        'Start with `w = 0`, pick at most `k = 2` projects. Profits `[1, 2, 3]`, capital needed `[0, 1, 1]`.',
        'One heap orders projects by **capital** (what can I afford next?). The other orders affordable ones by **profit** (which pays most?).',
      ],
      keyIdea: 'Move everything affordable into the profit heap, take its top, repeat. The answer here is 4.',
      frames: ipoFrames(),
    },
    {
      label: 'Pitfalls',
      title: 'The half with smaller numbers is a max-heap',
      tag: 'trade-off',
      code: [1],
      body: [
        'Flip the direction and the top of `small` is its smallest value, not the middle. Rebalance at the end of **every** add, not only some.',
        'Values in `0..100`: a counting array gives O(1) add. Sliding window median needs deletions: use **lazy deletion**.',
      ],
      keyIdea: 'Get the heap directions right and restore both invariants after every insert.',
      frames: wrongFrames(),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** median of a stream, middle value, two interacting priorities.',
        '- **Shape:** max-heap of the lower half, min-heap of the upper half.',
        '- **addNum:** push to small, move its top to large, move back if large is bigger.',
        '- **Cost:** O(log n) add, O(1) median.',
        '- **Pitfalls:** heap direction, integer division in other languages, skipped rebalancing.',
      ],
      keyIdea: 'Two heaps keep the middle of the data at their tops.',
      frames: [{ state: scene(FINAL_SMALL, FINAL_LARGE, { found: [FINAL_SMALL.peek().id, FINAL_LARGE.peek().id], showMedian: true }) }],
    },
  ],
});
