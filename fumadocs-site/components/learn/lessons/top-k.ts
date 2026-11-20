import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import type { Frame } from '../types';

/*
 * A real binary min-heap runs findKthLargest([3, 2, 1, 5, 6, 4], 2) and topKFrequent([1, 1, 1, 2, 2, 3], 2).
 * Layout: the input as boxes along the top (y 0.3), the heap as a small tree below it (root at y 2.6).
 */

type Item = { id: string; v: number; label: string };

class MinHeap {
  a: Item[] = [];
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
      if (a[i].v >= a[p].v) break;
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
        if (l < a.length && a[l].v < a[m].v) m = l;
        if (r < a.length && a[r].v < a[m].v) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

const HEAP_POS = [
  { x: 5, y: 2.7 },
  { x: 3.4, y: 4.4 },
  { x: 6.6, y: 4.4 },
];

function heapGraph(h: MinHeap, st: (it: Item, i: number) => ItemState, tag?: (it: Item) => string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: h.a.map((it, i) => ({ id: it.id, label: it.label, ...HEAP_POS[i], state: st(it, i), tag: tag?.(it) })),
    edges: h.a.slice(1).map((it, k) => ({ from: h.a[k >> 1].id, to: it.id })),
  };
}

const NUMS = [3, 2, 1, 5, 6, 4];
const K = 2;
const inputX = (i: number) => 1 + i * 1.6;

type Cell = 'normal' | 'active' | 'done' | 'dim';
const inputRow = (cells: Cell[], order: number[] = NUMS.map((_, i) => i)): GraphNode[] =>
  order.map((src, slot) => ({ id: `in${src}`, label: NUMS[src], x: inputX(slot), y: 0.3, shape: 'box', state: cells[src] }));

/** findKthLargest from the notes, one frame per push and per pop. */
function kthFrames(): Frame<GraphState>[] {
  const heap = new MinHeap();
  const cells: Cell[] = NUMS.map(() => 'normal');
  const frames: Frame<GraphState>[] = [];
  let pops = 0;
  NUMS.forEach((n, i) => {
    const it: Item = { id: `h${i}`, v: n, label: String(n) };
    heap.push(it);
    cells[i] = 'active';
    const over = heap.size > K;
    const g = heapGraph(heap, (x, j) => (over && j === 0 ? 'bad' : x === it ? 'active' : 'visited'));
    frames.push({
      hold: over ? 1300 : 1100,
      state: {
        nodes: [...inputRow(cells), ...g.nodes],
        edges: g.edges,
        pointers: [{ node: `in${i}`, label: 'x' }],
        stats: [
          { label: 'push', value: String(n) },
          { label: 'heap size', value: `${heap.size} / k=${K}`, tone: over ? 'bad' : 'neutral' },
          { label: 'top (min)', value: String(heap.peek().v) },
        ],
        note: over ? { text: `size ${heap.size} > k: pop the min, ${heap.peek().v}`, tone: 'bad' } : undefined,
      },
    });
    cells[i] = 'done';
    if (over) {
      const out = heap.pop();
      pops++;
      cells[Number(out.id.slice(1))] = 'dim';
      const g2 = heapGraph(heap, () => 'visited');
      frames.push({
        hold: 1100,
        state: {
          nodes: [...inputRow(cells), ...g2.nodes],
          edges: g2.edges,
          stats: [
            { label: 'evicted', value: String(out.v), tone: 'bad' },
            { label: 'heap size', value: `${heap.size} / k=${K}` },
            { label: 'top (min)', value: String(heap.peek().v) },
          ],
        },
      });
    }
  });
  const g = heapGraph(heap, (_, j) => (j === 0 ? 'found' : 'done'), (it) => (it === heap.peek() ? 'answer' : ''));
  frames.push({
    state: {
      nodes: [...inputRow(cells), ...g.nodes],
      edges: g.edges,
      stats: [
        { label: 'Answer', value: String(heap.peek().v), tone: 'ok' },
        { label: 'Pops', value: String(pops) },
        { label: 'Time', value: 'O(n log k)' },
      ],
      note: { text: '2nd largest = top of the size-2 min-heap = 5', tone: 'ok' },
    },
  });
  return frames;
}
const KTH = kthFrames();

// Step 1: sort everything and take index k - 1.
const DESC = NUMS.map((_, i) => i).sort((a, b) => NUMS[b] - NUMS[a]);
const SORT_FRAMES: Frame<GraphState>[] = [
  {
    hold: 1300,
    state: {
      nodes: inputRow(NUMS.map(() => 'normal')),
      stats: [
        { label: 'n', value: String(NUMS.length) },
        { label: 'k', value: String(K) },
        { label: 'Want', value: 'kth largest' },
      ],
      note: { text: 'find the 2nd largest of [3, 2, 1, 5, 6, 4]', tone: 'accent' },
    },
  },
  {
    hold: 1400,
    state: {
      nodes: inputRow(NUMS.map(() => 'visited' as Cell), DESC),
      stats: [
        { label: 'Sorted', value: 'all 6', tone: 'bad' },
        { label: 'Time', value: 'O(n log n)', tone: 'bad' },
        { label: 'Needed', value: 'top 2' },
      ],
    },
  },
  {
    state: {
      nodes: inputRow(
        NUMS.map((_, i) => (i === DESC[K - 1] ? 'active' : 'dim') as Cell),
        DESC,
      ),
      pointers: [{ node: `in${DESC[K - 1]}`, label: 'index k - 1' }],
      stats: [
        { label: 'Answer', value: '5', tone: 'ok' },
        { label: 'Time', value: 'O(n log n)', tone: 'bad' },
        { label: 'Needed', value: 'top 2' },
      ],
      note: { text: 'sorted the whole array to read one position', tone: 'bad' },
    },
  },
];

// Step 6: quickselect. Partition around the last element so the demo is repeatable.
function quickFrames(): Frame<GraphState>[] {
  const arr = NUMS.map((v, i) => ({ v, src: i }));
  const target = arr.length - K;
  const frames: Frame<GraphState>[] = [];
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const pivot = arr[hi].v;
    let store = lo;
    for (let i = lo; i < hi; i++) {
      if (arr[i].v < pivot) {
        [arr[i], arr[store]] = [arr[store], arr[i]];
        store++;
      }
    }
    [arr[store], arr[hi]] = [arr[hi], arr[store]];
    const p = store;
    const hit = p === target;
    const cells: Cell[] = NUMS.map(() => 'dim');
    arr.forEach((x, slot) => {
      if (slot >= lo && slot <= hi) cells[x.src] = 'normal';
    });
    cells[arr[p].src] = hit ? 'done' : 'active';
    frames.push({
      hold: 1800,
      state: {
        nodes: inputRow(cells, arr.map((x) => x.src)).map((n) => (hit && n.id === `in${arr[p].src}` ? { ...n, state: 'found' as const } : n)),
        pointers: [{ node: `in${arr[p].src}`, label: hit ? 'p = target' : `pivot at ${p}` }],
        stats: [
          { label: 'Quickselect', value: 'O(n) avg' },
          { label: 'Worst', value: 'O(n²)', tone: 'bad' },
          { label: 'target idx', value: String(target), hint: 'n - k, ascending' },
        ],
        note: hit ? { text: 'pivot landed on index n - k: the answer is 5', tone: 'ok' } : { text: `pivot ${pivot} lands at ${p} < ${target}: keep the right side only`, tone: 'accent' },
      },
    });
    if (hit) break;
    if (p < target) lo = p + 1;
    else hi = p - 1;
  }
  return frames;
}

const HEAP_FINAL = KTH[KTH.length - 1].state;
const TRADE: Frame<GraphState>[] = [
  {
    hold: 2000,
    state: {
      nodes: inputRow(NUMS.map((_, i) => (i === DESC[K - 1] ? 'found' : 'visited') as Cell), DESC),
      stats: [
        { label: 'Sort', value: 'O(n log n)' },
        { label: 'Space', value: 'O(1) to O(n)' },
        { label: 'Good for', value: 'simplest' },
      ],
    },
  },
  {
    hold: 2000,
    state: {
      ...HEAP_FINAL,
      note: undefined,
      stats: [
        { label: 'Size-K heap', value: 'O(n log k)', tone: 'ok' },
        { label: 'Space', value: 'O(k)' },
        { label: 'Good for', value: 'streams', tone: 'ok' },
      ],
    },
  },
  ...quickFrames(),
];

// Step 5: top K frequent, a min-heap ordered by count.
const FREQ_NUMS = [1, 1, 1, 2, 2, 3];
const FREQ_COLOR: Record<number, ItemState> = { 1: 'visited', 2: 'path', 3: 'swap' };
const freqRow = (dimAll = false): GraphNode[] =>
  FREQ_NUMS.map((v, i) => ({ id: `fn${i}`, label: v, x: inputX(i), y: 0.3, shape: 'box', state: dimAll ? 'dim' : FREQ_COLOR[v] }));

function freqFrames(): Frame<GraphState>[] {
  const freq = new Map<number, number>();
  for (const n of FREQ_NUMS) freq.set(n, (freq.get(n) ?? 0) + 1);
  const mapText = [...freq].map(([n, c]) => `${n}:${c}`).join(' ');
  const frames: Frame<GraphState>[] = [
    {
      hold: 1500,
      state: {
        nodes: freqRow(),
        stats: [
          { label: 'Counts', value: mapText },
          { label: 'k', value: '2' },
          { label: 'Distinct', value: String(freq.size) },
        ],
        note: { text: 'count first: 1 appears 3 times, 2 twice, 3 once', tone: 'accent' },
      },
    },
  ];
  const heap = new MinHeap();
  for (const [n, c] of freq) {
    const it: Item = { id: `fq${n}`, v: c, label: String(n) };
    heap.push(it);
    const over = heap.size > 2;
    const g = heapGraph(heap, (x, j) => (over && j === 0 ? 'bad' : x === it ? 'active' : 'visited'), (x) => `count ${x.v}`);
    frames.push({
      hold: 1300,
      state: {
        nodes: [...freqRow(true), ...g.nodes],
        edges: g.edges,
        stats: [
          { label: 'push', value: `${n} (x${c})` },
          { label: 'heap size', value: `${heap.size} / k=2`, tone: over ? 'bad' : 'neutral' },
          { label: 'Ordered by', value: 'count' },
        ],
        note: over ? { text: `size 3 > k: pop the lowest count, ${heap.peek().label}`, tone: 'bad' } : undefined,
      },
    });
    if (over) heap.pop();
  }
  const result: string[] = [];
  const copy = new MinHeap();
  heap.a.forEach((x) => copy.push(x));
  while (copy.size) result.push(copy.pop().label);
  result.reverse();
  const g = heapGraph(heap, () => 'found', (x) => `count ${x.v}`);
  frames.push({
    state: {
      nodes: [...freqRow(true), ...g.nodes],
      edges: g.edges,
      stats: [
        { label: 'Answer', value: `[${result.join(', ')}]`, tone: 'ok' },
        { label: 'Time', value: 'O(n log k)' },
        { label: 'Space', value: 'O(n)', hint: 'count map' },
      ],
      note: { text: 'pop everything, then reverse: most frequent first', tone: 'ok' },
    },
  });
  return frames;
}

// Step 7: bucket sort by frequency, O(n).
function bucketFrames(): Frame<GraphState>[] {
  const freq = new Map<number, number>();
  for (const n of FREQ_NUMS) freq.set(n, (freq.get(n) ?? 0) + 1);
  const maxF = FREQ_NUMS.length;
  const bx = (f: number) => 0.8 + (f - 1) * 1.65;
  const buckets = (scan?: number): GraphNode[] =>
    Array.from({ length: maxF }, (_, j) => j + 1).map((f) => ({
      id: `b${f}`,
      label: `f=${f}`,
      x: bx(f),
      y: 4.6,
      shape: 'box',
      state: scan === f ? 'active' : scan !== undefined && f > scan ? 'dim' : 'normal',
    }));
  const items = (placed: boolean, taken: number[], scan?: number): GraphNode[] =>
    [...freq].map(([n, f]) => ({
      id: `fq${n}`,
      label: n,
      x: placed ? bx(f) : 3.4 + n * 1.2,
      y: placed ? 2.9 : 1.2,
      state: taken.includes(n) ? 'found' : scan !== undefined && f > scan ? 'dim' : 'visited',
    }));
  const edges = (placed: boolean): GraphEdge[] => (placed ? [...freq].map(([n, f]) => ({ from: `fq${n}`, to: `b${f}`, directed: true })) : []);
  const frames: Frame<GraphState>[] = [
    {
      hold: 1300,
      state: {
        nodes: [...buckets(), ...items(false, [])],
        stats: [
          { label: 'Buckets', value: `1..${maxF}`, hint: 'frequency <= n' },
          { label: 'k', value: '2' },
          { label: 'Result', value: '[]' },
        ],
        note: { text: 'a frequency is at most n, so index buckets by it' },
      },
    },
    {
      hold: 1400,
      state: {
        nodes: [...buckets(), ...items(true, [])],
        edges: edges(true),
        stats: [
          { label: 'Buckets', value: `1..${maxF}` },
          { label: 'k', value: '2' },
          { label: 'Result', value: '[]' },
        ],
        note: { text: 'buckets[count].push(num)' },
      },
    },
  ];
  const result: number[] = [];
  for (let f = maxF; f > 0 && result.length < K; f--) {
    const here = [...freq].filter(([, c]) => c === f).map(([n]) => n);
    result.push(...here);
    if (!here.length && f !== maxF) continue;
    frames.push({
      hold: 1300,
      state: {
        nodes: [...buckets(f), ...items(true, [...result], f)],
        edges: edges(true),
        pointers: [{ node: `b${f}`, label: 'scan' }],
        stats: [
          { label: 'Bucket', value: `f=${f}` },
          { label: 'Took', value: here.length ? here.join(', ') : 'nothing' },
          { label: 'Result', value: `[${result.join(', ')}]`, tone: result.length >= K ? 'ok' : 'neutral' },
        ],
        note: result.length >= K ? { text: 'k found: stop. No heap, O(n)', tone: 'ok' } : f === maxF ? { text: 'read from the highest bucket down' } : undefined,
      },
    });
  }
  return frames;
}

const RECAP: GraphState = {
  ...HEAP_FINAL,
  note: undefined,
  stats: [
    { label: 'K largest', value: 'min-heap' },
    { label: 'K smallest', value: 'max-heap' },
    { label: 'Time', value: 'O(n log k)', tone: 'ok' },
  ],
};

export default defineLesson('graph', {
  slug: 'top-k',
  objectives: [
    { text: 'Use a heap of the opposite kind, capped at size K', step: 2 },
    { text: 'Read the kth largest from the top of the heap', step: 4 },
    { text: 'Apply it to frequencies with a count map', step: 5 },
    { text: 'Compare sort, heap, quickselect and bucket sort', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Sorting everything to read one slot',
      tag: 'problem',
      body: [
        'Find the **2nd largest** in `[3, 2, 1, 5, 6, 4]`.',
        'Sorting works, but it orders all n elements when you only care about the top k. When n is large and k is small, that is wasted work.',
      ],
      keyIdea: 'K largest, K smallest, K most frequent, K closest, kth largest: think Top K with a heap.',
      frames: SORT_FRAMES,
    },
    {
      label: 'Min-heap',
      title: 'Keep the K largest in a min-heap',
      tag: 'concept',
      body: [
        'To keep the **K largest**, use a **min-heap** of size K. Its top is the smallest of the K largest, so it is the one to evict when something bigger arrives.',
        'Here 4 arrives, becomes the min, and is popped straight back out.',
      ],
      keyIdea: 'The heap kind is the opposite of what you keep: the top is always the next element to evict.',
      frames: KTH.slice(-3, -1),
    },
    {
      label: 'Push, pop',
      title: 'Push every element, pop when over K',
      tag: 'technique',
      body: ['For each number: push it. If the heap now holds more than K, pop the top.', 'The heap never grows past K + 1, so each step is O(log k).'],
      keyIdea: 'Push, then evict when size exceeds K. Nothing else to decide.',
      frames: KTH.slice(0, 4),
    },
    {
      label: 'The answer',
      title: 'The top is the kth largest',
      tag: 'technique',
      body: ['After the last number the heap holds `{5, 6}`, the two largest. Its top, **5**, is the answer.', 'O(n log k) time, O(k) space, and it works on a stream.'],
      keyIdea: 'Kth largest: a min-heap of size K, and the top is the answer.',
      frames: KTH.slice(4),
    },
    {
      label: 'Frequent',
      title: 'Top K frequent: heap ordered by count',
      tag: 'technique',
      body: ['For `[1, 1, 1, 2, 2, 3]` and k = 2: count with a map, then push `[num, count]` entries into a min-heap ordered by **count**.', 'Pop when over K. At the end, pop everything and reverse.'],
      keyIdea: 'Same pattern, different key. A heap is not sorted, so return the order the problem asks for.',
      frames: freqFrames(),
    },
    {
      label: 'Options',
      title: 'Sort, heap or quickselect',
      tag: 'trade-off',
      body: [
        'Sort: O(n log n), simplest. Size-K heap: O(n log k), O(k) space, works on streams.',
        'Quickselect: O(n) average, O(n²) worst, mutates the array and does not fit streams. Many duplicates degrade it, a three-way partition fixes that.',
      ],
      keyIdea: 'Heap for streams and small k, quickselect for one-off arrays, sort when simplicity wins.',
      frames: TRADE,
    },
    {
      label: 'Buckets',
      title: 'Top K frequent in O(n) with buckets',
      tag: 'in practice',
      body: [
        'A frequency is at most n, so put each number in `buckets[count]` and read from the highest bucket down until you have k.',
        'K closest points flips the heap: a **max**-heap of size K by squared distance, no square root needed.',
      ],
      keyIdea: 'Bounded keys allow bucket sort. Otherwise, a size-K heap of the opposite kind.',
      frames: bucketFrames(),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** K largest, smallest, most frequent, closest, or kth largest.',
        '- **Rule:** keep K largest with a min-heap, K smallest with a max-heap.',
        '- **Loop:** push, then pop while size > K. The top is the kth.',
        '- **Cost:** O(n log k) time, O(k) space.',
        '- **Pitfalls:** max-heap for K largest (unbounded), default sort comparator, returning heap order, ties.',
      ],
      keyIdea: 'A size-K heap of the opposite kind beats sorting when k is much smaller than n.',
      frames: [{ state: RECAP }],
    },
  ],
});
