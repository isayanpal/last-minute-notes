import { defineLesson } from '../define';
import type { FlowGroup, FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';
import type { Stat } from '../types';

/*
 * Layout: users on the left, two regions stacked on the right.
 * ap-south (top) and us-east (bottom) each hold an app tier and a database.
 */

const USERS: FlowNode[] = [
  { id: 'u1', label: 'User', sub: 'in Asia', kind: 'client', x: 0, y: 0.6, size: 'sm' },
  { id: 'u2', label: 'User', sub: 'in the US', kind: 'client', x: 0, y: 2.6, size: 'sm' },
];
const REGION_A: FlowNode[] = [
  { id: 'appA', label: 'App', kind: 'service', x: 2.6, y: 0.6 },
  { id: 'dbA', label: 'Database', kind: 'db', x: 4.2, y: 0.6 },
];
const REGION_B: FlowNode[] = [
  { id: 'appB', label: 'App', kind: 'service', x: 2.6, y: 2.6 },
  { id: 'dbB', label: 'Database', kind: 'db', x: 4.2, y: 2.6 },
];
const groups = (aTone?: FlowGroup['tone'], bTone?: FlowGroup['tone']): FlowGroup[] => [
  { label: 'ap-south', nodes: ['appA', 'dbA'], tone: aTone },
  { label: 'us-east', nodes: ['appB', 'dbB'], tone: bTone },
];

const hop = (from: string, to: string, label?: string, delay = 0, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

// Step 1: everything lives in us-east.
const single = (down: boolean): FlowState => ({
  nodes: [
    ...patch(USERS, {
      u1: { badge: down ? { text: 'site down', tone: 'bad' } : { text: 'far away: slow', tone: 'bad' } },
      u2: { badge: down ? { text: 'site down', tone: 'bad' } : undefined },
    }),
    ...patch(REGION_B, down ? { appB: { status: 'down' }, dbB: { status: 'down' } } : {}),
  ],
  links: [
    { from: 'u1', to: 'appB', dashed: true },
    { from: 'u2', to: 'appB' },
    { from: 'appB', to: 'dbB' },
  ],
  groups: [{ label: 'us-east', nodes: ['appB', 'dbB'], tone: down ? 'bad' : undefined }],
  packets: down ? [] : [hop('u2', 'appB', 'fast'), { from: 'u1', to: 'appB', label: 'far', dur: 1.4, delay: 0.2 }, hop('appB', 'dbB', undefined, 0.6, 'data')],
  stats: [
    { label: 'Regions', value: '1' },
    { label: 'Asia latency', value: 'high', tone: 'bad' },
    { label: 'Region outage', value: down ? 'total' : '-', tone: down ? 'bad' : 'neutral' },
  ],
  note: down ? { text: 'one region: a regional outage takes everyone down', tone: 'bad' } : undefined,
});

// Step 2: multi-AZ in one region, plus backups elsewhere.
const AZ: FlowNode[] = [
  { id: 'u', label: 'Users', kind: 'client', x: 0, y: 1.6 },
  { id: 'lb', label: 'Load balancer', kind: 'lb', x: 1.5, y: 1.6 },
  { id: 'a1', label: 'App', kind: 'service', x: 3.0, y: 0.6 },
  { id: 'd1', label: 'Primary DB', kind: 'db', x: 4.4, y: 0.6 },
  { id: 'a2', label: 'App', kind: 'service', x: 3.0, y: 2.6 },
  { id: 'd2', label: 'Standby DB', kind: 'db', x: 4.4, y: 2.6 },
  { id: 'bk', label: 'Backups', sub: 'other region', kind: 'storage', x: 5.8, y: 1.6 },
];
const multiAz = (zoneDown: boolean): FlowState => ({
  nodes: patch(
    AZ,
    zoneDown
      ? {
          a1: { status: 'down' },
          d1: { status: 'down' },
          d2: { label: 'Primary DB', badge: { text: 'promoted', tone: 'accent' } },
        }
      : {},
  ),
  links: [
    { from: 'u', to: 'lb' },
    { from: 'lb', to: 'a1', dashed: zoneDown, tone: zoneDown ? 'bad' : undefined },
    { from: 'lb', to: 'a2' },
    { from: 'a1', to: 'd1' },
    { from: 'a2', to: zoneDown ? 'd2' : 'd1' },
    { from: 'd1', to: 'd2', dashed: true },
    { from: 'd2', to: 'bk', dashed: true },
  ],
  groups: [
    { label: 'zone a', nodes: ['a1', 'd1'], tone: zoneDown ? 'bad' : undefined },
    { label: 'zone b', nodes: ['a2', 'd2'] },
  ],
  packets: zoneDown
    ? [hop('u', 'lb'), hop('lb', 'a2', undefined, 0.6), hop('a2', 'd2', undefined, 1.2, 'data')]
    : [hop('u', 'lb'), hop('lb', 'a1', undefined, 0.6), hop('a1', 'd1', undefined, 1.2, 'data'), hop('d1', 'd2', 'replicate', 1.8, 'data'), hop('d2', 'bk', 'backup', 2.4, 'data')],
  stats: [
    { label: 'Regions', value: '1' },
    { label: 'Zones', value: '2' },
    { label: 'Zone outage', value: zoneDown ? 'survived' : '-', tone: zoneDown ? 'ok' : 'neutral' },
  ],
  note: zoneDown ? { text: 'a zone fails, the other zone carries on', tone: 'accent' } : undefined,
});

// Steps 3 to 7 share the two-region layout.
type RegionOpts = {
  nodes?: Record<string, Partial<FlowNode>>;
  links?: FlowLink[];
  packets?: Packet[];
  aTone?: FlowGroup['tone'];
  bTone?: FlowGroup['tone'];
  extra?: FlowNode[];
  stats?: Stat[];
  note?: FlowState['note'];
};
const regions = (o: RegionOpts): FlowState => ({
  nodes: patch([...USERS, ...REGION_A, ...REGION_B, ...(o.extra ?? [])], o.nodes ?? {}),
  links: o.links ?? [
    { from: 'u1', to: 'appA' },
    { from: 'u2', to: 'appA', dashed: true },
    { from: 'appA', to: 'dbA' },
    { from: 'dbA', to: 'dbB', dashed: true, label: 'async' },
    { from: 'appB', to: 'dbB' },
  ],
  groups: groups(o.aTone, o.bTone),
  packets: o.packets,
  stats: o.stats,
  note: o.note,
});

// Step 3: RPO and RTO, shown with writes that had not replicated yet.
const RPO_LINKS: FlowLink[] = [
  { from: 'u1', to: 'appA' },
  { from: 'appA', to: 'dbA' },
  { from: 'dbA', to: 'dbB', dashed: true, label: 'async' },
  { from: 'appB', to: 'dbB' },
];
const rpo = (phase: 0 | 1 | 2): FlowState =>
  regions({
    links: phase === 2 ? [{ from: 'u1', to: 'appB', tone: 'accent' }, ...RPO_LINKS.slice(1)] : RPO_LINKS,
    nodes: {
      u2: { status: 'dim' },
      dbA: phase === 0 ? { items: ['w1', 'w2', 'w3', 'w4'] } : { items: ['w1', 'w2', 'w3', 'w4'], status: 'down' },
      appA: phase === 0 ? {} : { status: 'down' },
      dbB:
        phase === 2
          ? { items: ['w1', 'w2'], label: 'New primary', badge: { text: 'lost w3, w4', tone: 'bad' } }
          : { items: ['w1', 'w2'], label: 'Replica' },
      appB: phase === 2 ? { status: 'active' } : { status: 'dim' },
    },
    aTone: phase === 0 ? undefined : 'bad',
    packets:
      phase === 0
        ? [hop('u1', 'appA', 'w4'), hop('appA', 'dbA', 'w4', 0.6, 'data'), hop('dbA', 'dbB', 'w2', 0.3, 'data')]
        : phase === 2
          ? [hop('u1', 'appB', undefined, 0.2), hop('appB', 'dbB', undefined, 0.8, 'data')]
          : [],
    stats: [
      { label: 'RPO', value: phase === 2 ? '2 writes' : '-', hint: 'data you can lose', tone: phase === 2 ? 'bad' : 'neutral' },
      { label: 'RTO', value: phase === 0 ? '-' : phase === 1 ? 'clock running' : 'outage length', hint: 'time you are down', tone: phase === 1 ? 'bad' : 'neutral' },
      { label: 'Replication', value: 'async', hint: 'replica lags behind' },
    ],
    note:
      phase === 0
        ? { text: 'the replica is two writes behind', tone: 'neutral' }
        : phase === 1
          ? { text: 'ap-south fails: the RTO clock starts', tone: 'bad' }
          : { text: 'RPO: how much data you lose. RTO: how long you are down', tone: 'accent' },
  });

// Step 4: the four strategies, from cheapest to most available.
type Strategy = { name: string; rto: string; rpo: string; cost: string };
const STRATEGIES: Strategy[] = [
  { name: 'Backup and restore', rto: 'hours', rpo: 'hours', cost: 'lowest' },
  { name: 'Pilot light', rto: '10s of min', rpo: 'minutes', cost: 'low' },
  { name: 'Warm standby', rto: 'minutes', rpo: 'secs to mins', cost: 'medium' },
  { name: 'Active-active', rto: 'near zero', rpo: 'near zero', cost: 'highest' },
];
const strategy = (i: number): FlowState => {
  const s = STRATEGIES[i];
  const stats: Stat[] = [
    { label: 'RTO', value: s.rto, tone: i >= 2 ? 'ok' : 'neutral' },
    { label: 'RPO', value: s.rpo, tone: i >= 2 ? 'ok' : 'neutral' },
    { label: 'Cost', value: s.cost, tone: i === 3 ? 'bad' : 'neutral' },
  ];
  const note = { text: s.name, tone: 'accent' as const };
  if (i === 0)
    return regions({
      nodes: { appB: { status: 'dim', sub: 'nothing running' }, dbB: { kind: 'storage', label: 'Backups', sub: 'restore when needed' } },
      links: [{ from: 'u1', to: 'appA' }, { from: 'u2', to: 'appA' }, { from: 'appA', to: 'dbA' }, { from: 'dbA', to: 'dbB', dashed: true, label: 'nightly' }],
      packets: [hop('u1', 'appA'), hop('u2', 'appA', undefined, 0.2), hop('dbA', 'dbB', 'backup', 0.8, 'data')],
      stats,
      note,
    });
  if (i === 1)
    return regions({
      nodes: { appB: { status: 'dim', sub: 'scaled to zero' }, dbB: { label: 'Replica', sub: 'core data' } },
      packets: [hop('u1', 'appA'), hop('u2', 'appA', undefined, 0.2), hop('dbA', 'dbB', 'replicate', 0.6, 'data')],
      stats,
      note,
    });
  if (i === 2)
    return regions({
      nodes: { appB: { sub: 'reduced size', meter: { value: 0.3, label: 'small fleet', tone: 'info' } }, dbB: { label: 'Replica' } },
      packets: [hop('u1', 'appA'), hop('u2', 'appA', undefined, 0.2), hop('dbA', 'dbB', 'replicate', 0.6, 'data')],
      stats,
      note,
    });
  return regions({
    nodes: { appA: { status: 'active' }, appB: { status: 'active' } },
    links: [
      { from: 'u1', to: 'appA' },
      { from: 'u2', to: 'appB' },
      { from: 'appA', to: 'dbA' },
      { from: 'appB', to: 'dbB' },
      { from: 'dbA', to: 'dbB', dashed: true, label: 'sync' },
    ],
    packets: [hop('u1', 'appA'), hop('u2', 'appB', undefined, 0.2), hop('appA', 'dbA', undefined, 0.6, 'data'), hop('appB', 'dbB', undefined, 0.8, 'data')],
    stats,
    note: { text: 'Active-active: every region serves traffic', tone: 'accent' },
  });
};

// Step 5: home region per user.
const home = (travelling: boolean): FlowState =>
  regions({
    nodes: {
      u1: travelling ? { sub: 'home: ap-south', badge: { text: 'now in the US', tone: 'accent' }, y: 1.6 } : { sub: 'home: ap-south' },
      u2: travelling ? { status: 'dim' } : { sub: 'home: us-east' },
      dbA: { label: 'Asia users', sub: 'write region' },
      dbB: { label: 'US users', sub: 'write region' },
    },
    links: travelling
      ? [
          { from: 'u1', to: 'appB' },
          { from: 'appB', to: 'dbA', tone: 'bad', label: 'long haul' },
          { from: 'appA', to: 'dbA' },
          { from: 'appB', to: 'dbB' },
        ]
      : [
          { from: 'u1', to: 'appA' },
          { from: 'u2', to: 'appB' },
          { from: 'appA', to: 'dbA' },
          { from: 'appB', to: 'dbB' },
        ],
    packets: travelling
      ? [hop('u1', 'appB', 'write'), { from: 'appB', to: 'dbA', label: 'to home', tone: 'bad', delay: 0.6, dur: 1.2 }]
      : [hop('u1', 'appA', 'write'), hop('appA', 'dbA', undefined, 0.6, 'data'), hop('u2', 'appB', 'write', 0.3), hop('appB', 'dbB', undefined, 0.9, 'data')],
    stats: [
      { label: 'Writes per user', value: '1 region' },
      { label: 'Conflicts', value: 'none', tone: 'ok' },
      { label: 'Far from home', value: travelling ? 'slow writes' : '-', tone: travelling ? 'bad' : 'neutral' },
    ],
    note: travelling ? { text: 'simple, but users far from home pay the latency', tone: 'bad' } : { text: 'each user writes only to a home region', tone: 'accent' },
  });

// Step 6: writing anywhere means conflicts or cross-region commits.
const multiLeader = (merged: boolean): FlowState =>
  regions({
    nodes: {
      dbA: { label: 'Leader', items: merged ? ['x=2'] : ['x=1'], badge: merged ? { text: 'LWW: x=2 wins', tone: 'bad' } : undefined },
      dbB: { label: 'Leader', items: ['x=2'] },
    },
    links: [
      { from: 'u1', to: 'appA' },
      { from: 'u2', to: 'appB' },
      { from: 'appA', to: 'dbA' },
      { from: 'appB', to: 'dbB' },
      { from: 'dbA', to: 'dbB', dashed: true, label: 'merge later' },
    ],
    packets: merged
      ? [hop('dbA', 'dbB', 'x=1', 0, 'data'), hop('dbB', 'dbA', 'x=2', 0, 'data')]
      : [hop('u1', 'appA', 'x=1'), hop('u2', 'appB', 'x=2'), hop('appA', 'dbA', 'x=1', 0.6, 'data'), hop('appB', 'dbB', 'x=2', 0.6, 'data')],
    stats: [
      { label: 'Approach', value: 'multi-leader' },
      { label: 'Write latency', value: 'local', tone: 'ok' },
      { label: 'Lost update', value: merged ? 'x=1' : '-', tone: merged ? 'bad' : 'neutral' },
    ],
    note: merged ? { text: 'last writer wins silently drops x=1. CRDTs can merge instead', tone: 'bad' } : { text: 'two regions accept writes to x at the same time', tone: 'neutral' },
  });

const consensus: FlowState = regions({
  nodes: { dbA: { label: 'Global DB', sub: 'consensus' }, dbB: { label: 'Global DB', sub: 'consensus' }, appA: { status: 'active' } },
  links: [
    { from: 'u1', to: 'appA' },
    { from: 'u2', to: 'appB' },
    { from: 'appA', to: 'dbA' },
    { from: 'appB', to: 'dbB' },
    { from: 'dbA', to: 'dbB', label: 'commit' },
  ],
  packets: [hop('u1', 'appA', 'write'), hop('appA', 'dbA', undefined, 0.6, 'data'), { from: 'dbA', to: 'dbB', label: 'agree?', delay: 1.2, dur: 0.9, tone: 'data' }, { from: 'dbB', to: 'dbA', label: 'ok', delay: 2.1, dur: 0.9, tone: 'res' }],
  stats: [
    { label: 'Approach', value: 'consensus DB', hint: 'Spanner, CockroachDB, DSQL' },
    { label: 'Consistency', value: 'strong', tone: 'ok' },
    { label: 'Write latency', value: 'cross-region', tone: 'bad' },
  ],
  note: { text: 'strong consistency, paid for with a cross-region round trip', tone: 'accent' },
});

// Step 7: failover through DNS, which you must test.
const DNS: FlowNode = { id: 'dns', label: 'GeoDNS', sub: 'or anycast', kind: 'dns', x: 1.2, y: 1.6 };
const failover = (failed: boolean): FlowState =>
  regions({
    extra: [DNS],
    nodes: failed ? { appA: { status: 'down' }, dbA: { status: 'down' }, appB: { status: 'active' }, dbB: { badge: { text: 'takes all traffic', tone: 'accent' } } } : {},
    aTone: failed ? 'bad' : undefined,
    links: [
      { from: 'u1', to: 'dns' },
      { from: 'u2', to: 'dns' },
      { from: 'dns', to: 'appA', dashed: failed, tone: failed ? 'bad' : undefined },
      { from: 'dns', to: 'appB', tone: failed ? 'accent' : undefined },
      { from: 'appA', to: 'dbA' },
      { from: 'appB', to: 'dbB' },
      { from: 'dbA', to: 'dbB', dashed: true },
    ],
    packets: failed
      ? [hop('u1', 'dns'), hop('dns', 'appB', undefined, 0.6), hop('u2', 'dns', undefined, 0.3), hop('dns', 'appB', undefined, 0.9)]
      : [hop('u1', 'dns'), hop('dns', 'appA', undefined, 0.6), hop('u2', 'dns', undefined, 0.3), hop('dns', 'appB', undefined, 0.9)],
    stats: [
      { label: 'Failover', value: 'DNS / anycast', hint: 'has its own delay' },
      { label: 'Replicate', value: 'caches, config', hint: 'queues and secrets too' },
      { label: 'Tested?', value: 'regularly', tone: 'ok' },
    ],
    note: failed ? { text: 'an untested failover is a hope, not a plan', tone: 'accent' } : undefined,
  });

export default defineLesson('flow', {
  slug: 'multi-region',
  objectives: [
    { text: 'Why go multi-region, and why multi-AZ is usually the right start', step: 2 },
    { text: 'Read RTO and RPO as downtime and data loss', step: 3 },
    { text: 'Compare backup and restore, pilot light, warm standby and active-active', step: 4 },
    { text: 'Choose a write strategy for active-active data', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'One region is far away and fails as one',
      tag: 'problem',
      body: [
        'Everything runs in us-east. Users in Asia pay for the distance on every request.',
        'And when the region has an outage, every user is down at once.',
      ],
      keyIdea: 'Teams go multi-region for lower latency, to survive a regional outage, or for data residency. It costs complexity, consistency and money.',
      frames: [
        { state: single(false), hold: 2400 },
        { state: single(true) },
      ],
    },
    {
      label: 'Multi-AZ first',
      title: 'Start with zones, not regions',
      tag: 'concept',
      body: [
        'Run across two **availability zones** in one region, with a standby database and backups copied to another region.',
        'A zone failure is survived without touching the hard multi-region problems.',
      ],
      keyIdea: 'For most products, multi-AZ in one region plus tested backups and a DR plan is the right starting point.',
      frames: [
        { state: multiAz(false), hold: 3200 },
        { state: multiAz(true) },
      ],
    },
    {
      label: 'RTO and RPO',
      title: 'Downtime and data loss',
      tag: 'concept',
      body: [
        'Replication to us-east is asynchronous, so the replica lags. When ap-south fails, writes w3 and w4 have not arrived yet.',
        '**RPO** is how much data you can lose. **RTO** is how long you can be down.',
      ],
      keyIdea: 'Every multi-region strategy is a point on the RTO, RPO and cost curve.',
      frames: [
        { state: rpo(0), hold: 2200 },
        { state: rpo(1), hold: 1600 },
        { state: rpo(2) },
      ],
    },
    {
      label: 'Strategies',
      title: 'Four ways to use a second region',
      tag: 'technique',
      body: [
        '**Backup and restore** keeps only backups there. **Pilot light** replicates core data with compute scaled to zero.',
        '**Warm standby** runs a reduced-size copy. **Active-active** serves traffic from every region.',
      ],
      keyIdea: 'Each step up cuts RTO and RPO, from hours to near zero, and raises the cost.',
      frames: [0, 1, 2, 3].map((i) => ({ state: strategy(i), hold: i === 3 ? undefined : 2400 })),
    },
    {
      label: 'Home region',
      title: 'Active-active: a home region per user',
      tag: 'technique',
      body: [
        'The simplest active-active data plan: each user has **one write region**, and other regions hold read replicas.',
        'No write conflicts, but a user far from home pays the latency on every write.',
      ],
      keyIdea: 'Partitioning writes by user avoids conflicts entirely.',
      frames: [
        { state: home(false), hold: 2400 },
        { state: home(true) },
      ],
    },
    {
      label: 'Write anywhere',
      title: 'Conflicts or slow commits',
      tag: 'trade-off',
      body: [
        '**Multi-leader** accepts writes anywhere and merges later with last-writer-wins or CRDTs, so anomalies are possible. **Global tables** (DynamoDB, Cosmos DB) replicate asynchronously the same way.',
        'A **global consensus database** keeps strong consistency, at the cost of cross-region commit latency.',
      ],
      keyIdea: 'Writing in many regions forces a choice: resolve conflicts, or wait for other regions on every commit.',
      frames: [
        { state: multiLeader(false), hold: 1900 },
        { state: multiLeader(true), hold: 2600 },
        { state: consensus },
      ],
    },
    {
      label: 'Recap',
      title: 'Failover you have actually tested',
      tag: 'recap',
      body: [
        '- **Why:** latency for global users, surviving a region outage, data residency.',
        '- **Start:** multi-AZ in one region, tested backups and a DR plan.',
        '- **Strategies:** backup and restore, pilot light, warm standby, active-active, trading cost for RTO and RPO.',
        '- **Active-active data:** home region per user, multi-leader, global consensus, or global tables.',
        '- **Also replicate:** caches, queues, secrets, config. Respect residency laws like GDPR.',
      ],
      keyIdea: 'Test failover regularly. An untested failover is a hope, not a plan.',
      frames: [
        { state: failover(false), hold: 2200 },
        { state: failover(true) },
      ],
    },
  ],
});
