import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';
import type { Stat } from '../types';

/*
 * Layout: the app on the left (x 0.5), stores on the right.
 * Every step reuses a small node set and patches statuses, badges and packets per frame.
 */

const APP: FlowNode = { id: 'app', label: 'App server', kind: 'service', x: 0.5, y: 1.6 };

const meter = (value: number, label: string) => ({ value, label, tone: value > 0.85 ? ('bad' as const) : value > 0.6 ? ('accent' as const) : ('ok' as const) });

// Step 1: one relational database does everything, until it cannot.
const PG: FlowNode = { id: 'pg', label: 'PostgreSQL', sub: 'one primary', kind: 'db', x: 3.6, y: 1.6, size: 'lg', items: ['users', 'orders', 'payments'] };
const SQL_STATS: Stat[] = [
  { label: 'Schema', value: 'fixed' },
  { label: 'Joins', value: 'native', tone: 'ok' },
  { label: 'Transactions', value: 'full ACID', tone: 'ok' },
];
const relational = (over: Partial<FlowNode>, packets: Packet[], extra: Partial<FlowState> = {}): FlowState => ({
  nodes: [APP, { ...PG, ...over }],
  links: [{ from: 'app', to: 'pg' }],
  packets,
  stats: SQL_STATS,
  ...extra,
});

// Step 2: how each side scales.
const SQL_SCALE: FlowState = {
  nodes: [
    APP,
    { id: 'pri', label: 'Primary', sub: 'all writes', kind: 'db', x: 2.8, y: 1.6, size: 'lg', meter: meter(0.7, 'bigger box') },
    { id: 'r1', label: 'Replica', sub: 'reads', kind: 'db', x: 5, y: 0.6, size: 'sm' },
    { id: 'r2', label: 'Replica', sub: 'reads', kind: 'db', x: 5, y: 2.6, size: 'sm' },
  ],
  links: [
    { from: 'app', to: 'pri' },
    { from: 'pri', to: 'r1', dashed: true },
    { from: 'pri', to: 'r2', dashed: true },
  ],
  packets: [
    { from: 'app', to: 'pri', label: 'write', dur: 0.6 },
    { from: 'pri', to: 'r1', tone: 'data', delay: 0.6, dur: 0.6 },
    { from: 'pri', to: 'r2', tone: 'data', delay: 0.6, dur: 0.6 },
  ],
  stats: [
    { label: 'SQL scales', value: 'up, replicas' },
    { label: 'Then', value: 'sharding', tone: 'bad', hint: 'harder' },
    { label: 'Queries', value: 'ad hoc SQL', tone: 'ok' },
  ],
  note: { text: 'relational: vertical first, then replicas, sharding is hard' },
};

const NOSQL_SPOTS: [number, number][] = [
  [3.4, 0.3],
  [3.4, 1.6],
  [3.4, 2.9],
  [5.3, 0.8],
];
const NOSQL_NODES = (count: number): FlowNode[] =>
  NOSQL_SPOTS.slice(0, count).map(([x, y], i) => ({ id: `n${i}`, label: `Node ${i + 1}`, kind: 'db', x, y, size: 'sm', status: i === 3 ? 'active' : 'normal' }));

const nosql = (count: number, packets: Packet[], extra: Partial<FlowState> = {}): FlowState => {
  const nodes = NOSQL_NODES(count);
  return {
    nodes: [{ ...APP, label: 'App', sub: 'routes by key' }, ...nodes],
    links: nodes.map((n) => ({ from: 'app', to: n.id })),
    packets,
    stats: [
      { label: 'NoSQL scales', value: 'out', tone: 'ok' },
      { label: 'Joins', value: 'denormalize', tone: 'bad' },
      { label: 'Transactions', value: 'single item' },
    ],
    ...extra,
  };
};

// Step 3: the NoSQL families, one access pattern each.
type Family = { id: string; label: string; sub: string; kind: FlowNode['kind']; ask: string; use: string };
const FAMILIES: Family[] = [
  { id: 'kv', label: 'Key-value', sub: 'Redis, DynamoDB', kind: 'cache', ask: 'get by key', use: 'sessions, carts' },
  { id: 'doc', label: 'Document', sub: 'MongoDB', kind: 'db', ask: 'nested JSON', use: 'catalogs' },
  { id: 'wide', label: 'Wide-column', sub: 'Cassandra', kind: 'db', ask: 'heavy writes', use: 'activity logs' },
  { id: 'graph', label: 'Graph', sub: 'Neo4j', kind: 'db', ask: 'traverse', use: 'social graph' },
  { id: 'search', label: 'Search', sub: 'Elasticsearch', kind: 'search', ask: 'text query', use: 'search boxes' },
  { id: 'olap', label: 'Column store', sub: 'ClickHouse', kind: 'storage', ask: 'scan + sum', use: 'analytics' },
];
const FAMILY_NODES: FlowNode[] = FAMILIES.map((f, i) => ({
  id: f.id,
  label: f.label,
  sub: f.sub,
  kind: f.kind,
  x: i < 3 ? 3.1 : 5.2,
  y: 0.3 + (i % 3) * 1.4,
  size: 'sm',
}));
const families = (pick: number): FlowState => {
  const f = FAMILIES[pick];
  return {
    nodes: [{ ...APP, x: 0.4 }, ...patch(FAMILY_NODES, Object.fromEntries(FAMILIES.map((g, i) => [g.id, { status: i === pick ? 'active' : 'dim' } as Partial<FlowNode>])))],
    links: FAMILY_NODES.map((n) => ({ from: 'app', to: n.id, tone: n.id === f.id ? ('accent' as const) : undefined })),
    packets: [{ from: 'app', to: f.id, label: f.ask, dur: 0.8 }],
    stats: [
      { label: 'Pattern', value: f.ask },
      { label: 'Pick', value: f.label },
      { label: 'Use for', value: f.use },
    ],
  };
};

// Step 4: distributed SQL keeps transactions but pays for coordination.
const RANGES: FlowNode[] = [
  { id: 'ra', label: 'Range A', sub: 'Raft group', kind: 'db', x: 2.9, y: 0.6, size: 'sm' },
  { id: 'rb', label: 'Range B', sub: 'Raft group', kind: 'db', x: 2.9, y: 2.6, size: 'sm' },
  { id: 'rc', label: 'Range C', sub: 'Raft group', kind: 'db', x: 5.2, y: 1.6, size: 'sm' },
];
const distSql = (mode: 'local' | 'cross'): FlowState => ({
  nodes: [
    { ...APP, label: 'App', sub: 'plain SQL', x: 0.4 },
    ...patch(RANGES, mode === 'local' ? { ra: { status: 'active' }, rb: { status: 'dim' }, rc: { status: 'dim' } } : { ra: { status: 'active', badge: { text: 'coordinates', tone: 'accent' } }, rb: { status: 'active' }, rc: { status: 'hot' } }),
  ],
  links: [
    { from: 'app', to: 'ra' },
    { from: 'app', to: 'rb' },
    { from: 'ra', to: 'rb', dashed: true },
    { from: 'ra', to: 'rc', dashed: true, tone: mode === 'cross' ? 'bad' : undefined },
  ],
  groups: [
    { label: 'region 1', nodes: ['ra', 'rb'] },
    { label: 'region 2', nodes: ['rc'], tone: mode === 'cross' ? 'bad' : undefined },
  ],
  packets:
    mode === 'local'
      ? [
          { from: 'app', to: 'ra', label: 'tx: 1 range', dur: 0.7 },
          { from: 'ra', to: 'app', tone: 'res', label: 'commit', delay: 0.8, dur: 0.7 },
        ]
      : [
          { from: 'app', to: 'ra', label: 'tx: 3 ranges', dur: 0.7 },
          { from: 'ra', to: 'rb', tone: 'data', label: 'prepare', delay: 0.7, dur: 0.6 },
          { from: 'ra', to: 'rc', tone: 'bad', label: 'cross-region', delay: 0.7, dur: 1.1 },
          { from: 'rc', to: 'ra', tone: 'res', delay: 1.9, dur: 1.1 },
          { from: 'ra', to: 'app', tone: 'res', label: 'commit', delay: 3.0, dur: 0.7 },
        ],
  stats:
    mode === 'local'
      ? [
          { label: 'Ranges touched', value: '1', tone: 'ok' },
          { label: 'Coordination', value: 'none', tone: 'ok' },
          { label: 'Examples', value: 'Spanner, Crdb' },
        ]
      : [
          { label: 'Ranges touched', value: '3', tone: 'bad' },
          { label: 'Coordination', value: 'cross-region', tone: 'bad' },
          { label: 'Isolation', value: 'serializable', hint: 'CockroachDB default' },
        ],
  note: mode === 'cross' ? { text: 'cross-shard and cross-region transactions cost latency', tone: 'bad' } : undefined,
});

// Step 5: polyglot persistence, one source of truth and derived stores.
const POLY_NODES: FlowNode[] = [
  { ...APP, x: 0.3 },
  { id: 'pg', label: 'PostgreSQL', sub: 'source of truth', kind: 'db', x: 2.1, y: 1.6, size: 'lg' },
  { id: 'cdc', label: 'CDC stream', sub: 'change log', kind: 'queue', x: 3.7, y: 1.6, size: 'sm' },
  { id: 'redis', label: 'Redis', sub: 'hot reads', kind: 'cache', x: 5.4, y: 0.4, size: 'sm' },
  { id: 'idx', label: 'Search index', sub: 'derived', kind: 'search', x: 5.4, y: 1.6, size: 'sm' },
  { id: 'olap', label: 'Analytics', sub: 'derived', kind: 'storage', x: 5.4, y: 2.8, size: 'sm' },
];
const POLY_LINKS = [
  { from: 'app', to: 'pg' },
  { from: 'pg', to: 'cdc', dashed: true },
  { from: 'cdc', to: 'redis', dashed: true },
  { from: 'cdc', to: 'idx', dashed: true },
  { from: 'cdc', to: 'olap', dashed: true },
];
const POLY_STATS: Stat[] = [
  { label: 'Source of truth', value: '1', tone: 'ok' },
  { label: 'Derived stores', value: '3' },
  { label: 'Fed by', value: 'CDC' },
];
const poly = (packets: Packet[], changes: Record<string, Partial<FlowNode>>, note?: FlowState['note']): FlowState => ({
  nodes: patch(POLY_NODES, changes),
  links: POLY_LINKS,
  packets,
  stats: POLY_STATS,
  note,
});

// Step 6: how rows get their ids.
const ID_NODES: FlowNode[] = [
  { id: 'a1', label: 'App 1', kind: 'service', x: 0.6, y: 0.7, size: 'sm' },
  { id: 'a2', label: 'App 2', kind: 'service', x: 0.6, y: 2.5, size: 'sm' },
  { id: 'tbl', label: 'orders table', sub: 'B-tree on id', kind: 'db', x: 3.9, y: 1.6, size: 'lg' },
];
type IdScheme = { name: string; ids: [string, string, string]; badge: FlowState['note']; ordered: string; coord: string; size: string; note: string; gen: 'db' | 'app' };
const SCHEMES: IdScheme[] = [
  { name: 'auto-increment', ids: ['1001', '1002', '1003'], badge: { text: 'single writer', tone: 'bad' }, ordered: 'yes', coord: 'one DB', size: 'compact', note: 'ordered and compact, but leaks volume', gen: 'db' },
  { name: 'UUIDv4', ids: ['9f3c71e2', '1b7e04aa', 'd04a5c93'], badge: { text: 'random inserts', tone: 'bad' }, ordered: 'no', coord: 'none', size: '128-bit', note: 'random ids land all over the B-tree', gen: 'app' },
  { name: 'UUIDv7', ids: ['0193a1f2', '0193a1f2', '0193a1f3'], badge: { text: 'time ordered', tone: 'ok' }, ordered: 'yes', coord: 'none', size: '128-bit', note: '48-bit ms timestamp first, then random bits', gen: 'app' },
  { name: 'Snowflake', ids: ['ts.m1.0', 'ts.m2.0', 'ts.m1.1'], badge: { text: 'ts + machine + seq', tone: 'ok' }, ordered: 'yes', coord: 'worker ids', size: '64-bit', note: 'half a UUID, but manage worker ids and clocks', gen: 'app' },
];
const ids = (s: IdScheme): FlowState => ({
  nodes: patch(ID_NODES, { tbl: { items: s.ids, badge: s.badge }, a1: s.gen === 'app' ? { status: 'active' } : {}, a2: s.gen === 'app' ? { status: 'active' } : {} }),
  links: [
    { from: 'a1', to: 'tbl' },
    { from: 'a2', to: 'tbl' },
  ],
  packets: [
    { from: 'a1', to: 'tbl', label: s.gen === 'app' ? s.ids[0] : 'insert', dur: 0.8 },
    { from: 'a2', to: 'tbl', label: s.gen === 'app' ? s.ids[1] : 'insert', delay: 0.4, dur: 0.8 },
    { from: 'a1', to: 'tbl', label: s.gen === 'app' ? s.ids[2] : 'insert', delay: 0.8, dur: 0.8 },
  ],
  stats: [
    { label: 'Scheme', value: s.name },
    { label: 'Time ordered', value: s.ordered, tone: s.ordered === 'yes' ? 'ok' : 'bad' },
    { label: 'Size', value: s.size, hint: `coordination: ${s.coord}` },
  ],
  note: { text: s.note, tone: s.badge?.tone },
});

export default defineLesson('flow', {
  slug: 'databases',
  objectives: [
    { text: 'Why the default is a relational database', step: 1 },
    { text: 'How SQL and NoSQL differ on schema, joins, transactions and scaling', step: 2 },
    { text: 'Match each NoSQL family to its access pattern', step: 3 },
    { text: 'Keep one source of truth and derive the rest', step: 5 },
    { text: 'Pick an id scheme that suits B-tree inserts', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Start relational, leave for a reason',
      tag: 'problem',
      body: [
        'A relational database gives you a fixed schema, native joins and multi-row **ACID** transactions. Most apps start here.',
        'The question is not "SQL or NoSQL?" but "which requirement forces me off one primary?"',
      ],
      keyIdea: 'Start with a relational database. Move away only when a requirement forces you to.',
      frames: [
        { state: relational({ badge: { text: 'multi-row ACID', tone: 'accent' } }, [{ from: 'app', to: 'pg', label: 'BEGIN tx', dur: 0.8 }]), hold: 1700 },
        {
          state: relational({ status: 'active' }, [
            { from: 'app', to: 'pg', label: 'JOIN users', dur: 0.8 },
            { from: 'pg', to: 'app', tone: 'res', label: 'rows', delay: 0.9, dur: 0.8 },
          ]),
          hold: 2000,
        },
        {
          state: relational({ status: 'hot', meter: meter(0.95, 'write rate 95%'), badge: { text: 'outgrowing one box?', tone: 'bad' } }, [0, 0.2, 0.4, 0.6].map((d) => ({ from: 'app', to: 'pg', delay: d, dur: 0.7 })), {
            note: { text: 'only now do the alternatives earn their cost', tone: 'bad' },
          }),
        },
      ],
    },
    {
      label: 'SQL vs NoSQL',
      title: 'Scale up, or scale out',
      tag: 'concept',
      body: [
        '**Relational** scales vertically, then with read replicas, and only then by sharding, which is harder.',
        '**NoSQL** is horizontal by design: keys spread across nodes. The price is limited joins, so you denormalize, and transactions often cover a single item.',
      ],
      keyIdea: 'SQL buys query flexibility and transactions. NoSQL buys horizontal scale for access patterns you know up front.',
      frames: [
        { state: SQL_SCALE, hold: 2400 },
        {
          state: nosql(3, [
            { from: 'app', to: 'n0', label: 'user:7', dur: 0.7 },
            { from: 'app', to: 'n2', label: 'user:12', delay: 0.3, dur: 0.7 },
            { from: 'app', to: 'n1', label: 'user:3', delay: 0.6, dur: 0.7 },
          ]),
          hold: 2000,
        },
        {
          state: nosql(4, [{ from: 'app', to: 'n3', label: 'user:20', dur: 0.8 }], {
            note: { text: 'more data? add a node', tone: 'ok' },
          }),
        },
      ],
    },
    {
      label: 'Families',
      title: 'Pick by access pattern',
      tag: 'technique',
      body: [
        'NoSQL is not one thing. Each family is built for one dominant access pattern.',
        'Time-series stores (metrics) and vector indexes (similarity by meaning) follow the same rule: name the query first, then pick the store.',
      ],
      keyIdea: 'Lookup by key: key-value. Nested data: document. Heavy time-ordered writes: wide-column. Relationships: graph. Text: search. Big aggregates: column store.',
      frames: FAMILIES.map((_, i) => ({ state: families(i), hold: 1600 })),
    },
    {
      label: 'Distributed SQL',
      title: 'SQL across many nodes',
      tag: 'trade-off',
      body: [
        '**Distributed SQL** (Spanner, CockroachDB, TiDB, YugabyteDB) splits data into ranges, each replicated by Paxos or Raft, and still gives you SQL transactions.',
        'A transaction inside one range is cheap. One that spans ranges or regions has to coordinate.',
      ],
      keyIdea: 'Cross-shard and cross-region transactions cost coordination latency. Keep transactions inside one shard or region where you can.',
      frames: [
        { state: distSql('local'), hold: 2200 },
        { state: distSql('cross'), hold: 4200 },
      ],
    },
    {
      label: 'Polyglot',
      title: 'One truth, many views',
      tag: 'in practice',
      body: [
        'A common production shape: **Postgres** as the source of truth, Redis for hot reads, plus a search index and an analytics store.',
        'The derived stores are fed from the primary by **change data capture**, never written separately by the app.',
      ],
      keyIdea: 'Keep one system as the source of truth and treat the others as derived.',
      frames: [
        { state: poly([{ from: 'app', to: 'pg', label: 'INSERT', dur: 0.7 }], { pg: { status: 'active' } }), hold: 1400 },
        {
          state: poly(
            [
              { from: 'pg', to: 'cdc', tone: 'data', label: 'change', dur: 0.6 },
              { from: 'cdc', to: 'redis', tone: 'data', delay: 0.6, dur: 0.7 },
              { from: 'cdc', to: 'idx', tone: 'data', delay: 0.6, dur: 0.6 },
              { from: 'cdc', to: 'olap', tone: 'data', delay: 0.6, dur: 0.7 },
            ],
            { cdc: { status: 'active' } },
          ),
          hold: 2000,
        },
        {
          state: poly([{ from: 'pg', to: 'cdc', tone: 'data', dur: 0.6 }], { redis: { status: 'active' }, idx: { status: 'active' }, olap: { status: 'active' } }, { text: 'derived stores can be rebuilt from the primary', tone: 'ok' }),
        },
      ],
    },
    {
      label: 'IDs',
      title: 'Choosing primary keys',
      tag: 'trade-off',
      body: [
        '**Auto-increment** is compact and ordered, but needs one writer and leaks your volume. **UUIDv4** needs no coordination, but random values hurt B-tree insert locality.',
        '**UUIDv7** puts a millisecond timestamp first, so ids sort by time. **Snowflake** packs timestamp, machine id and sequence into 64 bits.',
      ],
      keyIdea: 'Time-ordered ids (UUIDv7, Snowflake) keep inserts at the end of the B-tree without a central counter.',
      frames: SCHEMES.map((s) => ({ state: ids(s), hold: 2300 })),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Default:** relational (PostgreSQL, MySQL) for joins, transactions and ad hoc queries.',
        '- **NoSQL:** horizontal by design, best for known access patterns, denormalize instead of join.',
        '- **Families:** key-value, document, wide-column, graph, time-series, search, vector, column store.',
        '- **Global scale with SQL:** distributed SQL, but keep transactions inside one shard or region.',
        '- **Production:** polyglot persistence, one source of truth, the rest derived by CDC.',
      ],
      keyIdea: 'Name the access pattern first. The database choice follows from it.',
      frames: [{ state: { ...poly([], {}), stats: [{ label: 'Default', value: 'PostgreSQL', tone: 'ok' }, { label: 'Truth', value: '1 store' }, { label: 'Others', value: 'derived' }] } }],
    },
  ],
});
