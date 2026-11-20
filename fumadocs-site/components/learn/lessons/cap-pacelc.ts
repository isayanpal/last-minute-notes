import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';
import type { Stat } from '../types';

/*
 * Layout: a writer on the left, a reader on the right, one replica on each side of the network.
 * The link between the two replicas is the one that gets cut.
 */

const BASE: FlowNode[] = [
  { id: 'w', label: 'Writer', kind: 'client', x: 0, y: 1.6, size: 'sm' },
  { id: 'r1', label: 'Replica 1', kind: 'db', x: 1.9, y: 1.6 },
  { id: 'r2', label: 'Replica 2', kind: 'db', x: 4.1, y: 1.6 },
  { id: 'rd', label: 'Reader', kind: 'client', x: 6, y: 1.6, size: 'sm' },
];

type Opts = {
  cut?: boolean;
  v1: string;
  v2: string;
  changes?: Record<string, Partial<FlowNode>>;
  packets?: Packet[];
  stats?: Stat[];
  note?: FlowState['note'];
};

function pair({ cut = false, v1, v2, changes = {}, packets, stats, note }: Opts): FlowState {
  const links: FlowLink[] = [
    { from: 'w', to: 'r1' },
    cut ? { from: 'r1', to: 'r2', tone: 'bad', dashed: true, label: 'partition' } : { from: 'r1', to: 'r2', label: 'replicates' },
    { from: 'r2', to: 'rd' },
  ];
  return {
    nodes: patch(BASE, {
      r1: { items: [v1], ...changes.r1 },
      r2: { items: [v2], ...changes.r2 },
      w: changes.w ?? {},
      rd: changes.rd ?? {},
    }),
    links,
    groups: cut
      ? [
          { label: 'side A', nodes: ['w', 'r1'] },
          { label: 'side B', nodes: ['r2', 'rd'], tone: 'bad' },
        ]
      : undefined,
    packets,
    stats: stats ?? [
      { label: 'Replicas', value: '2' },
      { label: 'Network', value: cut ? 'split' : 'healthy', tone: cut ? 'bad' : 'ok' },
      { label: 'Replica 2', value: v2, tone: v1 === v2 ? 'ok' : 'bad' },
    ],
    note,
  };
}

const hop = (from: string, to: string, label: string, delay = 0, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

const CP_STATS: Stat[] = [
  { label: 'Choice', value: 'CP' },
  { label: 'Reader gets', value: 'error', tone: 'bad' },
  { label: 'Stale reads', value: 'never', tone: 'ok' },
];
const AP_STATS: Stat[] = [
  { label: 'Choice', value: 'AP' },
  { label: 'Reader gets', value: 'x=2', tone: 'ok' },
  { label: 'Stale reads', value: 'possible', tone: 'bad' },
];

// Step 6: domains on the left, a CP pair and an AP pair on the right.
const DOMAINS: FlowNode[] = [
  { id: 'seat', label: 'Seat booking', kind: 'client', x: 0.3, y: 0.3, size: 'sm' },
  { id: 'cfg', label: 'Config & locks', kind: 'client', x: 0.3, y: 1.2, size: 'sm' },
  { id: 'feed', label: 'Social feed', kind: 'client', x: 0.3, y: 2.1, size: 'sm' },
  { id: 'cart', label: 'Shopping cart', kind: 'client', x: 0.3, y: 3.0, size: 'sm' },
];
const STORES: FlowNode[] = [
  { id: 'etcd', label: 'etcd', sub: 'ZooKeeper', kind: 'db', x: 3.7, y: 0.5, size: 'sm' },
  { id: 'span', label: 'Spanner', sub: 'HBase', kind: 'db', x: 5.1, y: 0.5, size: 'sm' },
  { id: 'cass', label: 'Cassandra', sub: 'Riak', kind: 'db', x: 3.7, y: 2.7, size: 'sm' },
  { id: 'dyn', label: 'DynamoDB', sub: 'default reads', kind: 'db', x: 5.1, y: 2.7, size: 'sm' },
];

const domain = (id: string, to: string, lean: 'C' | 'A', why: string): FlowState => ({
  nodes: [
    ...patch(DOMAINS, {
      [id]: { status: 'active', badge: { text: lean === 'C' ? 'consistency' : 'availability', tone: 'accent' } },
    }),
    ...STORES,
  ],
  links: DOMAINS.map((d) => ({ from: d.id, to: ['seat', 'cfg'].includes(d.id) ? 'etcd' : 'cass', dashed: d.id !== id, tone: d.id === id ? ('accent' as const) : undefined })),
  groups: [
    { label: 'CP: reject or wait', nodes: ['etcd', 'span'], tone: lean === 'C' ? 'accent' : undefined },
    { label: 'AP: serve stale', nodes: ['cass', 'dyn'], tone: lean === 'A' ? 'accent' : undefined },
  ],
  packets: [{ from: id, to: to, tone: lean === 'C' ? 'req' : 'data', dur: 0.7 }],
  stats: [
    { label: 'Domain', value: DOMAINS.find((d) => d.id === id)!.label },
    { label: 'Lean', value: lean === 'C' ? 'consistency' : 'availability' },
    { label: 'Why', value: why },
  ],
});

const RECAP: FlowState = {
  nodes: [
    { id: 'pa', label: 'Cassandra', sub: 'PA / EL', kind: 'db', x: 1.4, y: 0.7, badge: { text: 'DynamoDB, Riak' } },
    { id: 'pc', label: 'Spanner', sub: 'PC / EC', kind: 'db', x: 4.6, y: 0.7, badge: { text: 'CockroachDB, etcd' } },
    { id: 'mg', label: 'MongoDB', sub: 'PA-ish / EC', kind: 'db', x: 1.4, y: 2.7, badge: { text: 'default settings' } },
    { id: 'pn', label: 'PNUTS', sub: 'PC / EL', kind: 'db', x: 4.6, y: 2.7 },
  ],
  stats: [
    { label: 'If partition', value: 'A or C' },
    { label: 'Else', value: 'L or C' },
    { label: 'Really', value: 'per config', hint: 'read and write concern' },
  ],
  note: { text: 'a rough guide: behavior depends on configuration' },
};

export default defineLesson('flow', {
  slug: 'cap-pacelc',
  objectives: [
    { text: 'Why a network partition forces a choice', step: 1 },
    { text: 'What CP and AP systems do during a partition', step: 4 },
    { text: 'How PACELC adds the latency vs consistency choice', step: 5 },
    { text: 'Pick C or A per domain', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'The network splits the replicas',
      tag: 'problem',
      body: [
        'Normally a write lands on Replica 1 and is copied to Replica 2, so a reader on either side sees it.',
        'Then the link between them breaks. A new write reaches Replica 1, but Replica 2 cannot hear about it.',
      ],
      keyIdea: 'Partitions are not optional in a real network. The question is what a replica does while one lasts.',
      frames: [
        { state: pair({ v1: 'x=1', v2: 'x=1', packets: [hop('w', 'r1', 'x=2'), hop('r1', 'r2', 'x=2', 0.6, 'data')], note: { text: 'healthy: write, then replicate' } }), hold: 1900 },
        { state: pair({ v1: 'x=2', v2: 'x=2', packets: [hop('rd', 'r2', 'read x'), hop('r2', 'rd', 'x=2', 0.6, 'res')] }), hold: 1700 },
        {
          state: pair({
            cut: true,
            v1: 'x=3',
            v2: 'x=2',
            changes: { r1: { badge: { text: "can't reach R2", tone: 'bad' } } },
            packets: [hop('w', 'r1', 'x=3')],
            note: { text: 'partition: Replica 2 still has x=2', tone: 'bad' },
          }),
        },
      ],
    },
    {
      label: 'CAP',
      title: 'Consistency or availability, during a partition',
      tag: 'concept',
      body: [
        '**Consistency (C):** every read sees the latest write (linearizability), or returns an error.',
        '**Availability (A):** every request to a live node gets a non-error response, possibly stale.',
        'With a partition you cannot have both, so the real choice is **CP or AP** while it lasts.',
      ],
      keyIdea: 'CAP is not "pick two of three" in normal operation. It is about behavior during a partition.',
      frames: [
        { state: pair({ cut: true, v1: 'x=3', v2: 'x=2', packets: [hop('rd', 'r2', 'read x')] }), hold: 1400 },
        {
          state: pair({
            cut: true,
            v1: 'x=3',
            v2: 'x=2',
            changes: { r2: { status: 'active', badge: { text: 'error, or stale x=2?', tone: 'accent' } } },
            note: { text: '"CA" is not a real option for a networked system', tone: 'accent' },
          }),
        },
      ],
    },
    {
      label: 'Choose CP',
      title: 'CP: refuse rather than lie',
      tag: 'technique',
      body: [
        'A CP system rejects or delays the request, because Replica 2 cannot prove it has the latest value.',
        'Readers on side B see errors until the partition heals. Nobody ever sees stale data.',
      ],
      keyIdea: 'CP gives up some availability: etcd, ZooKeeper, HBase, Spanner.',
      frames: [
        {
          state: pair({
            cut: true,
            v1: 'x=3',
            v2: 'x=2',
            changes: { r2: { status: 'hot', badge: { text: "can't confirm latest", tone: 'bad' } } },
            packets: [hop('rd', 'r2', 'read x'), hop('r2', 'rd', 'error', 0.6, 'bad')],
            stats: CP_STATS,
          }),
          hold: 1900,
        },
        {
          state: pair({
            cut: true,
            v1: 'x=3',
            v2: 'x=2',
            changes: { r2: { status: 'hot', badge: { text: 'rejecting reads', tone: 'bad' } } },
            packets: [hop('w', 'r1', 'x=4')],
            stats: CP_STATS,
            note: { text: 'CP: etcd, ZooKeeper, HBase, Spanner' },
          }),
        },
      ],
    },
    {
      label: 'Choose AP',
      title: 'AP: answer now, merge later',
      tag: 'technique',
      body: [
        'An AP system answers from what it has. The reader gets `x=2`, which is stale but not an error.',
        'When the partition heals, the replicas catch up. The Dynamo paper does this for shopping carts: never block adding to the cart.',
      ],
      keyIdea: 'AP gives up some consistency: Cassandra, DynamoDB default reads, Riak.',
      frames: [
        {
          state: pair({
            cut: true,
            v1: 'x=3',
            v2: 'x=2',
            changes: { r2: { status: 'active', badge: { text: 'serves what it has', tone: 'accent' } } },
            packets: [hop('rd', 'r2', 'read x'), hop('r2', 'rd', 'x=2', 0.6, 'res')],
            stats: AP_STATS,
            note: { text: 'answered, but x=3 is the latest', tone: 'bad' },
          }),
          hold: 2000,
        },
        {
          state: pair({
            v1: 'x=3',
            v2: 'x=2',
            packets: [hop('r1', 'r2', 'x=3', 0, 'data')],
            stats: [
              { label: 'Network', value: 'healed', tone: 'ok' },
              { label: 'Replica 2', value: 'catching up' },
              { label: 'Examples', value: 'Cassandra' },
            ],
          }),
          hold: 1400,
        },
        {
          state: pair({
            v1: 'x=3',
            v2: 'x=3',
            stats: [
              { label: 'Network', value: 'healed', tone: 'ok' },
              { label: 'Replica 2', value: 'x=3', tone: 'ok' },
              { label: 'Examples', value: 'Cassandra' },
            ],
            note: { text: 'AP: Cassandra, DynamoDB default reads, Riak' },
          }),
        },
      ],
    },
    {
      label: 'PACELC',
      title: 'Else: latency or consistency',
      tag: 'concept',
      body: [
        'PACELC: if **P**artition, choose **A** or **C**. **E**lse, choose **L**atency or **C**onsistency.',
        '**EC** waits for the replica before saying ok, so reads anywhere are fresh. **EL** says ok first and replicates after, so a fast read can be stale.',
      ],
      keyIdea: 'Even with no partition, replication forces a trade-off between latency and consistency.',
      frames: [
        {
          state: pair({
            v1: 'x=4',
            v2: 'x=4',
            packets: [hop('w', 'r1', 'x=5'), hop('r1', 'r2', 'x=5', 0.6, 'data'), hop('r2', 'r1', 'ack', 1.2, 'res'), hop('r1', 'w', 'ok', 1.8, 'res')],
            stats: [
              { label: 'Mode', value: 'EC' },
              { label: 'ok after', value: 'replica ack' },
              { label: 'Latency', value: 'higher', tone: 'bad' },
            ],
            note: { text: 'EC: pay coordination latency on every write' },
          }),
          hold: 3000,
        },
        {
          state: pair({
            v1: 'x=5',
            v2: 'x=5',
            packets: [hop('w', 'r1', 'x=6'), hop('r1', 'w', 'ok', 0.6, 'res'), hop('rd', 'r2', 'read x', 0.3), hop('r2', 'rd', 'x=5', 0.9, 'res'), hop('r1', 'r2', 'x=6', 1.0, 'data')],
            stats: [
              { label: 'Mode', value: 'EL' },
              { label: 'ok after', value: 'local write' },
              { label: 'Latency', value: 'lower', tone: 'ok' },
            ],
            note: { text: 'EL: fast, but the reader got x=5, not x=6', tone: 'bad' },
          }),
          hold: 2800,
        },
      ],
    },
    {
      label: 'By domain',
      title: 'Pick C or A per use case',
      tag: 'trade-off',
      body: [
        'Lean to **consistency** when a wrong answer costs money or trust: balances, seat booking, inventory at checkout, leader election and locks.',
        'Lean to **availability** when slightly stale is fine: feeds, like counts, search, shopping carts that merge later.',
      ],
      keyIdea: 'Many systems are tunable per request, such as Cassandra quorum levels or DynamoDB strongly consistent reads.',
      frames: [
        { state: domain('seat', 'etcd', 'C', 'costs money'), hold: 1500 },
        { state: domain('cfg', 'etcd', 'C', 'two leaders'), hold: 1500 },
        { state: domain('feed', 'cass', 'A', 'stale is fine'), hold: 1500 },
        { state: domain('cart', 'cass', 'A', 'merge later') },
      ],
    },
    {
      label: 'Recap',
      title: 'Four letters, two questions',
      tag: 'recap',
      body: [
        '- **CAP:** during a partition, a replica either refuses (CP) or serves possibly stale data (AP).',
        '- **No partition:** you can have both C and A. "CA" is not a category for a networked system.',
        '- **PACELC:** else, choose lower latency (EL) or stronger consistency (EC).',
        '- **Domain:** money, seats, locks lean C. Feeds, counters, carts lean A.',
        '- **In interviews:** "it depends on the read and write concern".',
      ],
      keyIdea: 'CAP is about linearizability during a partition. PACELC reminds you that replication costs latency the rest of the time.',
      frames: [{ state: RECAP }],
    },
  ],
});
