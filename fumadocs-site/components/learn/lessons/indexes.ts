import { defineLesson } from '../define';
import type { ItemState, Panel } from '../engines/common';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import { patch } from '../engines/layouts';
import type { Frame } from '../types';

/*
 * Frames come from running the real operations: a linear scan, a B-tree descent,
 * a range walk across ordered leaves, a sort for the composite index and an LSM write path.
 */

const ROWS = [17, 42, 8, 63, 25, 34, 91, 56];
const TARGET = 34;

// ---------- Step 1: full table scan ----------

const ROW_NODES: GraphNode[] = ROWS.map((v, i) => ({ id: `r${i}`, label: `id ${v}`, x: 0.6 + (i * 8.8) / (ROWS.length - 1), y: 2.6, shape: 'box', tag: `row ${i}` }));

function scanFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  for (let i = 0; i < ROWS.length; i++) {
    const hit = ROWS[i] === TARGET;
    const states: Record<string, Partial<GraphNode>> = {};
    for (let j = 0; j < i; j++) states[`r${j}`] = { state: 'visited' };
    states[`r${i}`] = { state: hit ? 'found' : 'active' };
    frames.push({
      hold: hit ? 2000 : 750,
      state: {
        nodes: patch(ROW_NODES, states),
        pointers: [{ node: `r${i}`, label: 'scan', up: true }],
        stats: [
          { label: 'Query', value: `id = ${TARGET}` },
          { label: 'Rows read', value: String(i + 1), tone: i > 2 ? 'bad' : 'neutral' },
          { label: 'Cost', value: 'O(n)', tone: 'bad' },
        ],
        note: hit ? { text: `found after reading ${i + 1} rows: cost grows with the table`, tone: 'bad' } : undefined,
      },
    });
    if (hit) break;
  }
  return frames;
}

// ---------- Steps 2, 3, 8: a small B-tree ----------

type BNode = { id: string; keys: number[]; children?: string[]; x: number; y: number };
const SORTED = [...ROWS].sort((a, b) => a - b); // 8 17 25 34 42 56 63 91
const LEAF_KEYS = [0, 2, 4, 6].map((i) => SORTED.slice(i, i + 2));
const TREE: BNode[] = [
  { id: 'root', keys: [LEAF_KEYS[2][0]], children: ['i1', 'i2'], x: 5, y: 0.5 },
  { id: 'i1', keys: [LEAF_KEYS[1][0]], children: ['l0', 'l1'], x: 2.6, y: 2.4 },
  { id: 'i2', keys: [LEAF_KEYS[3][0]], children: ['l2', 'l3'], x: 7.4, y: 2.4 },
  ...LEAF_KEYS.map((keys, i) => ({ id: `l${i}`, keys, x: [1.3, 3.9, 6.1, 8.7][i], y: 4.4 })),
];
const byId = new Map(TREE.map((n) => [n.id, n]));
const LEAVES = ['l0', 'l1', 'l2', 'l3'];

const TREE_NODES: GraphNode[] = TREE.map((n) => ({ id: n.id, label: n.keys.join(' '), x: n.x, y: n.y, shape: 'box' }));
const TREE_EDGES: GraphEdge[] = [
  ...TREE.flatMap((n) => (n.children ?? []).map((c) => ({ from: n.id, to: c }))),
  ...LEAVES.slice(1).map((id, i) => ({ from: LEAVES[i], to: id, directed: true })),
];

/** Walk from the root to the leaf that could hold `key`. One separator per internal node: left if smaller. */
function descend(key: number): string[] {
  const path = ['root'];
  let cur = byId.get('root')!;
  while (cur.children) {
    const next = key < cur.keys[0] ? cur.children[0] : cur.children[1];
    path.push(next);
    cur = byId.get(next)!;
  }
  return path;
}

function treeState(nodeStates: Record<string, ItemState>, pathEdges: [string, string][], extra: Partial<GraphState>): GraphState {
  const onPath = new Set(pathEdges.map(([a, b]) => `${a}-${b}`));
  return {
    nodes: patch(TREE_NODES, Object.fromEntries(Object.entries(nodeStates).map(([id, st]) => [id, { state: st }]))),
    edges: TREE_EDGES.map((e) => (onPath.has(`${e.from}-${e.to}`) ? { ...e, state: 'path' as const } : e)),
    ...extra,
  };
}

function lookupFrames(key: number): Frame<GraphState>[] {
  const path = descend(key);
  return path.map((id, k) => {
    const leaf = k === path.length - 1;
    const hit = leaf && byId.get(id)!.keys.includes(key);
    const states: Record<string, ItemState> = {};
    path.slice(0, k).forEach((p) => (states[p] = 'visited'));
    states[id] = hit ? 'found' : 'active';
    const node = byId.get(id)!;
    const dir = node.children ? (key < node.keys[0] ? `${key} < ${node.keys[0]}: left` : `${key} >= ${node.keys[0]}: right`) : hit ? `${key} is here` : `${key} not here`;
    return {
      hold: leaf ? 2200 : 1300,
      state: treeState(
        states,
        path.slice(0, k + 1).slice(1).map((p, j) => [path[j], p] as [string, string]),
        {
          pointers: [{ node: id, label: 'probe', up: true }],
          stats: [
            { label: 'Query', value: `id = ${key}` },
            { label: 'Pages read', value: String(k + 1), tone: 'ok' },
            { label: 'Cost', value: 'O(log n)', tone: 'ok' },
          ],
          note: leaf ? { text: `${k + 1} page reads instead of ${ROWS.indexOf(key) + 1} row reads`, tone: 'ok' } : { text: dir, tone: 'accent' },
        },
      ),
    };
  });
}

function rangeFrames(lo: number, hi: number): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  const path = descend(lo);
  const results: number[] = [];
  const states: Record<string, ItemState> = {};
  const edges: [string, string][] = [];
  const panel = (): Panel[] => [{ title: 'results', kind: 'list', items: results.map(String) }];
  const stats = (pages: number) => [
    { label: 'Query', value: `${lo}..${hi}` },
    { label: 'Pages read', value: String(pages) },
    { label: 'Matches', value: String(results.length), tone: 'ok' as const },
  ];
  let pages = 0;
  // Descend to the first leaf that could hold lo.
  path.forEach((id, k) => {
    pages++;
    if (k > 0) edges.push([path[k - 1], id]);
    Object.keys(states).forEach((s) => (states[s] = 'visited'));
    states[id] = 'active';
    if (k < path.length - 1) frames.push({ hold: 1000, state: treeState({ ...states }, [...edges], { pointers: [{ node: id, label: 'probe', up: true }], panels: panel(), stats: stats(pages) }) });
  });
  // Walk right along the ordered leaves.
  let li = LEAVES.indexOf(path[path.length - 1]);
  for (;;) {
    const leaf = byId.get(LEAVES[li])!;
    const inRange = leaf.keys.filter((k) => k >= lo && k <= hi);
    results.push(...inRange);
    const done = li === LEAVES.length - 1 || leaf.keys[leaf.keys.length - 1] > hi;
    Object.keys(states).forEach((s) => (states[s] = states[s] === 'active' || states[s] === 'found' ? (byId.get(s)!.children ? 'visited' : 'found') : states[s]));
    states[leaf.id] = inRange.length ? 'found' : 'bad';
    frames.push({
      hold: 1400,
      state: treeState({ ...states }, [...edges], {
        pointers: [{ node: leaf.id, label: 'scan', up: true }],
        panels: panel(),
        stats: stats(pages),
        note: done ? { text: `${leaf.keys.find((k) => k > hi)} > ${hi}: stop, keys are in order`, tone: 'ok' } : { text: inRange.length ? `take ${inRange.join(', ')}, move to the next leaf` : 'nothing here', tone: 'accent' },
      }),
    });
    if (done) break;
    edges.push([leaf.id, LEAVES[li + 1]]);
    li++;
    pages++;
  }
  return frames;
}

// ---------- Step 4: composite index ----------

const RECORDS = [
  { u: 'u2', d: 5 },
  { u: 'u1', d: 7 },
  { u: 'u3', d: 2 },
  { u: 'u2', d: 9 },
  { u: 'u1', d: 3 },
  { u: 'u3', d: 6 },
  { u: 'u2', d: 1 },
];
const COMPOSITE = [...RECORDS].sort((a, b) => a.u.localeCompare(b.u) || a.d - b.d);
const pad = (d: number) => String(d).padStart(2, '0');
const COMP_NODES: GraphNode[] = COMPOSITE.map((r, i) => ({ id: `c${i}`, label: `${r.u} ${pad(r.d)}`, x: 0.6 + (i * 8.8) / (COMPOSITE.length - 1), y: 2.6, shape: 'box' }));
const COMP_EDGES: GraphEdge[] = COMP_NODES.slice(1).map((n, i) => ({ from: COMP_NODES[i].id, to: n.id, directed: true }));

function compositeFrames(): Frame<GraphState>[] {
  const user = 'u2';
  const mine = COMPOSITE.map((r, i) => (r.u === user ? i : -1)).filter((i) => i >= 0);
  const newest = mine[mine.length - 1];
  const dateRank = [...COMPOSITE.keys()].sort((a, b) => COMPOSITE[a].d - COMPOSITE[b].d);
  return [
    {
      hold: 1800,
      state: {
        nodes: COMP_NODES,
        edges: COMP_EDGES,
        stats: [
          { label: 'Index', value: '(user, date)' },
          { label: 'Sorted by', value: 'user, then date' },
          { label: 'Entries', value: String(COMPOSITE.length) },
        ],
        note: { text: 'entries are sorted by user_id first, created_at second' },
      },
    },
    {
      hold: 2200,
      state: {
        nodes: patch(COMP_NODES, Object.fromEntries(COMPOSITE.map((_, i) => [`c${i}`, { state: (i === newest ? 'found' : mine.includes(i) ? 'done' : 'dim') as ItemState }]))),
        edges: COMP_EDGES,
        pointers: [
          { node: `c${mine[0]}`, label: 'seek', tone: 'info', up: true },
          { node: `c${newest}`, label: 'newest', up: true },
        ],
        stats: [
          { label: 'Query', value: `${user}, newest` },
          { label: 'Entries read', value: String(mine.length), tone: 'ok' },
          { label: 'Served', value: 'yes', tone: 'ok' },
        ],
        note: { text: 'leftmost column fixed: one contiguous slice', tone: 'ok' },
      },
    },
    {
      state: {
        nodes: patch(COMP_NODES, Object.fromEntries(dateRank.map((idx, k) => [`c${idx}`, { state: 'bad' as ItemState, tag: `#${k + 1}` }]))),
        edges: COMP_EDGES,
        stats: [
          { label: 'Query', value: 'all by date' },
          { label: 'Entries read', value: `all ${COMPOSITE.length}`, tone: 'bad' },
          { label: 'Served', value: 'no', tone: 'bad' },
        ],
        note: { text: 'date order (#1, #2, ...) is scattered: leftmost prefix rule', tone: 'bad' },
      },
    },
  ];
}

// ---------- Step 5: covering index and other index types ----------

const TYPES = ['B-tree: range', 'Hash: equality', 'Composite', 'Covering', 'Partial', 'Inverted', 'Geospatial'];
const LOOKUP_NODES: GraphNode[] = [
  { id: 'q', label: 'query', x: 0.8, y: 1.4, shape: 'box' },
  { id: 'idx', label: 'index', x: 4.6, y: 1.4, shape: 'box', tag: 'u2 09' },
  { id: 'row', label: 'row', x: 8.6, y: 1.4, shape: 'box', tag: 'table' },
];
const lookup = (
  changes: Record<string, Partial<GraphNode>>,
  hop: ItemState,
  highlight: number,
  stats: GraphState['stats'],
  note: GraphState['note'],
): GraphState => ({
  nodes: patch(LOOKUP_NODES, changes),
  edges: [
    { from: 'q', to: 'idx', directed: true, state: 'path' },
    { from: 'idx', to: 'row', directed: true, state: hop },
  ],
  panels: [{ title: 'index types', kind: 'list', items: TYPES, highlight }],
  stats,
  note,
});

// ---------- Step 6: every index is another write ----------

const WRITE_NODES: GraphNode[] = [
  { id: 'ins', label: 'INSERT', x: 0.8, y: 3, shape: 'box' },
  { id: 'tbl', label: 'table', x: 4.4, y: 3, shape: 'box' },
  { id: 'x1', label: 'id', x: 8.4, y: 0.8, shape: 'box', tag: 'index' },
  { id: 'x2', label: 'user', x: 8.4, y: 3, shape: 'box', tag: 'index' },
  { id: 'x3', label: 'date', x: 8.4, y: 5.2, shape: 'box', tag: 'index' },
];
function writeFrames(): Frame<GraphState>[] {
  const order = ['tbl', 'x1', 'x2', 'x3'];
  return order.map((id, k) => {
    const states: Record<string, Partial<GraphNode>> = { ins: { state: 'done' } };
    order.slice(0, k).forEach((p) => (states[p] = { state: 'done' }));
    states[id] = { state: k === 0 ? 'active' : 'bad' };
    const edges: GraphEdge[] = [
      { from: 'ins', to: 'tbl', directed: true, state: 'path' },
      ...['x1', 'x2', 'x3'].map((x) => ({ from: 'tbl', to: x, directed: true, state: (order.indexOf(x) <= k ? 'path' : 'dim') as ItemState })),
    ];
    return {
      hold: k === order.length - 1 ? 2200 : 1000,
      state: {
        nodes: patch(WRITE_NODES, states),
        edges,
        stats: [
          { label: 'Writes per insert', value: String(k + 1), tone: k > 0 ? 'bad' : 'neutral' },
          { label: 'Indexes', value: '3' },
          { label: 'Extra space', value: `${k} trees` },
        ],
        note: k === order.length - 1 ? { text: '1 row, 4 writes: add only indexes your queries need', tone: 'bad' } : undefined,
      },
    };
  });
}

// ---------- Step 7: LSM tree write path, read with Bloom filters, compaction ----------

const MEM_CAP = 3;
const WRITES = [34, 8, 25, 91, 8, 63];
const LSM_NODES: GraphNode[] = [
  { id: 'w', label: 'write', x: 0.5, y: 1.6, shape: 'box' },
  { id: 'log', label: 'log', x: 3, y: 0.2, shape: 'box', tag: 'append-only' },
  { id: 'mem', label: 'memtbl', x: 3, y: 2.8, shape: 'box', tag: 'empty' },
  { id: 's1', label: 'SST 1', x: 6, y: 1.2, shape: 'box' },
  { id: 's2', label: 'SST 2', x: 6, y: 4.2, shape: 'box' },
  { id: 'm', label: 'merged', x: 8.9, y: 2.7, shape: 'box' },
];

function lsmFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  let mem: number[] = [];
  const files: number[][] = [];
  let logLen = 0;
  const tagOf = (keys: number[]) => (keys.length ? [...keys].sort((a, b) => a - b).join(' ') : 'empty');
  const base = (changes: Record<string, Partial<GraphNode>>, edges: GraphEdge[], stats: GraphState['stats'], note?: GraphState['note']): Frame<GraphState> => ({
    hold: 2200,
    state: {
      nodes: patch(LSM_NODES, {
        log: { tag: `${logLen} entries` },
        mem: { tag: tagOf(mem) },
        s1: files[0] ? { tag: tagOf(files[0]) } : { state: 'dim' },
        s2: files[1] ? { tag: tagOf(files[1]) } : { state: 'dim' },
        m: { state: 'dim' },
        ...changes,
      }),
      edges,
      stats,
      note,
    },
  });
  const writeEdges: GraphEdge[] = [
    { from: 'w', to: 'log', directed: true, state: 'path' },
    { from: 'w', to: 'mem', directed: true, state: 'path' },
  ];
  // Writes go to the log and the memtable; a full memtable flushes to a sorted, immutable file.
  for (let i = 0; i < WRITES.length; i++) {
    mem = mem.filter((k) => k !== WRITES[i]).concat(WRITES[i]);
    logLen++;
    if (mem.length === MEM_CAP) {
      const batch = WRITES.slice(i - MEM_CAP + 1, i + 1);
      frames.push(
        base({ mem: { state: 'active' }, log: { state: 'active' } }, writeEdges, [
          { label: 'Writes', value: batch.join(', ') },
          { label: 'Disk I/O', value: 'sequential', tone: 'ok' },
          { label: 'Memtable', value: `${mem.length}/${MEM_CAP} full`, tone: 'bad' },
        ], { text: 'append to the log, insert into the sorted memtable', tone: 'accent' }),
      );
      files.push(mem);
      mem = [];
      const fid = `s${files.length}`;
      frames.push(
        base({ [fid]: { state: 'done', tag: tagOf(files[files.length - 1]) } }, [{ from: 'mem', to: fid, directed: true, state: 'path' }], [
          { label: 'Flushed', value: `SST ${files.length}` },
          { label: 'Files', value: String(files.length) },
          { label: 'File', value: 'sorted, fixed', tone: 'ok' },
        ], { text: 'memtable flushed as a sorted file', tone: 'ok' }),
      );
    }
  }
  // Read: newest data first, Bloom filters skip files that cannot hold the key.
  const key = 25;
  const has = files.map((f) => f.includes(key));
  frames.push(
    base(
      { mem: { state: 'visited', tag: 'miss' }, s2: { state: has[1] ? 'found' : 'dim', tag: has[1] ? 'hit' : 'bloom: skip' }, s1: { state: has[0] ? 'found' : 'dim', tag: has[0] ? `hit ${key}` : 'bloom: skip' } },
      [
        { from: 'mem', to: 's2', directed: true, state: 'path' },
        { from: 's2', to: 's1', directed: true, state: 'path', curve: 0.6 },
      ],
      [
        { label: 'Read', value: `key ${key}` },
        { label: 'Files read', value: String(has.filter(Boolean).length), tone: 'ok' },
        { label: 'Skipped', value: `${has.filter((h) => !h).length} by Bloom`, tone: 'ok' },
      ],
      { text: 'reads may check several files, Bloom filters cut that down', tone: 'accent' },
    ),
  );
  // Compaction: merge sorted files, newest value wins, fewer files to read.
  const merged = [...new Set(files.flat())].sort((a, b) => a - b);
  frames.push(
    base(
      { s1: { state: 'visited', tag: tagOf(files[0]) }, s2: { state: 'visited', tag: tagOf(files[1]) }, m: { state: 'found', tag: merged.join(' ') } },
      [
        { from: 's1', to: 'm', directed: true, state: 'path' },
        { from: 's2', to: 'm', directed: true, state: 'path' },
      ],
      [
        { label: 'Compaction', value: `${files.flat().length} in, ${merged.length} out` },
        { label: 'Files after', value: '1', tone: 'ok' },
        { label: 'Write amp', value: 'rewrites data', tone: 'bad' },
      ],
      { text: 'background compaction: duplicate key 8 keeps its newest value', tone: 'accent' },
    ),
  );
  return frames;
}

const RECAP: GraphState = treeState(Object.fromEntries(TREE.map((n) => [n.id, 'done' as ItemState])), [], {
  stats: [
    { label: 'Read-heavy', value: 'B-tree', tone: 'ok' },
    { label: 'Write-heavy', value: 'LSM tree', tone: 'ok' },
    { label: 'Every index', value: 'slower writes', tone: 'bad' },
  ],
});

const LOOKUP = lookupFrames(TARGET);

export default defineLesson('graph', {
  slug: 'indexes',
  objectives: [
    { text: 'Why a lookup without an index reads every row', step: 1 },
    { text: 'How a B-tree answers equality and range queries in a few page reads', step: 3 },
    { text: 'Apply the leftmost prefix rule to composite indexes', step: 4 },
    { text: 'Weigh the write cost of every index', step: 6 },
    { text: 'Contrast the B-tree and LSM tree write paths', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Without an index, read every row',
      tag: 'problem',
      body: [
        'Find the row with `id = 34`. Rows sit in the table in insert order, so the database has to check them one by one.',
        'The cost grows with the table, not with the answer.',
      ],
      keyIdea: 'A full table scan is O(n). An index is a separate structure that makes lookups fast.',
      frames: scanFrames(),
    },
    {
      label: 'B-tree',
      title: 'Descend a sorted tree',
      tag: 'concept',
      body: [
        'A **B-tree** keeps keys sorted in pages. Each internal page holds separators that say which child to follow.',
        'To find 34, compare at each level and go left or right. Three page reads reach the leaf.',
      ],
      keyIdea: 'An index trades write time and space for fast lookups: O(log n) page reads instead of a scan.',
      frames: LOOKUP,
    },
    {
      label: 'Range',
      title: 'Ranges come free with order',
      tag: 'technique',
      body: [
        'Because keys are ordered, `id BETWEEN 30 AND 60` is one descent to where 30 would be, then a walk along neighbouring leaves.',
        'The walk stops at the first key past 60. A hash index cannot do this: it only supports equality.',
      ],
      keyIdea: 'The B-tree is the default index because it serves both equality and range queries.',
      frames: rangeFrames(30, 60),
    },
    {
      label: 'Composite',
      title: 'The leftmost prefix rule',
      tag: 'technique',
      body: [
        'A composite index on `(user_id, created_at)` sorts by user first, then by date within each user.',
        'It serves "this user\'s newest items": one contiguous slice. It does not serve "all items by date", because dates are scattered across users.',
      ],
      keyIdea: 'A composite index only helps queries that fix its leftmost columns.',
      frames: compositeFrames(),
    },
    {
      label: 'Covering',
      title: 'Skip the table lookup',
      tag: 'technique',
      body: [
        'A normal index finds the entry, then reads the table row for the other columns. A **covering** index already holds every column the query needs.',
        '**Hash** indexes do equality only. **Partial** indexes cover only rows matching a condition. Inverted and geospatial indexes serve text and location.',
      ],
      keyIdea: 'Pick the index type from the query: range, equality, a subset of rows, text or location.',
      frames: [
        {
          state: lookup({}, 'path', 0, [{ label: 'Index', value: 'B-tree' }, { label: 'Reads', value: '2' }, { label: 'Table hop', value: 'yes', tone: 'bad' }], { text: 'index finds the entry, then fetch the row' }),
          hold: 2000,
        },
        {
          state: lookup({ idx: { label: 'index', tag: 'u2 09 + title', state: 'found' }, row: { state: 'dim' } }, 'dim', 3, [{ label: 'Index', value: 'covering' }, { label: 'Reads', value: '1', tone: 'ok' }, { label: 'Table hop', value: 'none', tone: 'ok' }], {
            text: 'every needed column is in the index',
            tone: 'ok',
          }),
          hold: 2000,
        },
        {
          state: lookup({ q: { label: 'id=34' }, idx: { label: 'hash', tag: 'bucket', state: 'active' } }, 'path', 1, [{ label: 'Index', value: 'hash' }, { label: 'Equality', value: 'yes', tone: 'ok' }, { label: 'Range', value: 'no', tone: 'bad' }], {
            text: 'hash: equality only, no ordering',
            tone: 'accent',
          }),
          hold: 2000,
        },
        {
          state: lookup({ idx: { label: 'partial', tag: 'active rows only', state: 'active' } }, 'path', 4, [{ label: 'Index', value: 'partial' }, { label: 'Covers', value: 'some rows' }, { label: 'Size', value: 'smaller', tone: 'ok' }], {
            text: 'partial: index only rows that match a condition',
            tone: 'accent',
          }),
        },
      ],
    },
    {
      label: 'Write cost',
      title: 'Every index is another write',
      tag: 'trade-off',
      body: [
        'One `INSERT` updates the table and then every index on it. Three indexes means four writes, plus the space they take.',
        'Indexes speed up reads you know about and slow down every write.',
      ],
      keyIdea: 'Add only the indexes your access patterns need.',
      frames: writeFrames(),
    },
    {
      label: 'LSM tree',
      title: 'Append now, sort later',
      tag: 'trade-off',
      body: [
        'A B-tree updates pages **in place**: random writes. An **LSM tree** appends to a log and a memtable, flushes sorted files, and compacts them in the background.',
        'Writes become sequential and fast. Reads may check several files, so Bloom filters skip the ones that cannot hold the key.',
      ],
      keyIdea: 'LSM trades read work and compaction write amplification for excellent write throughput (Cassandra, RocksDB, HBase).',
      frames: lsmFrames(),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Index:** a separate structure, faster reads, slower writes, more space.',
        '- **B-tree:** the default, equality and range, ordered, used by PostgreSQL and InnoDB.',
        '- **Composite:** follows the leftmost prefix rule. **Covering** skips the table lookup.',
        '- **LSM tree:** log plus memtable plus sorted files, great for write-heavy, append-like loads.',
        '- **Rule of thumb:** read-heavy with rich queries suggests B-tree, write-heavy suggests LSM.',
      ],
      keyIdea: 'Index for the queries you actually run, and pick the storage engine from the read/write mix.',
      frames: [{ state: RECAP }],
    },
  ],
});
