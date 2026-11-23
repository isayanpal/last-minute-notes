import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';
import type { Stat } from '../types';

/*
 * Layout: client on the left (x 0.3), primary in the middle (x 2.6), two replicas on the right (x 5).
 * Packets are chained with delays so each hop starts when the previous one lands (0.6 s per hop).
 */

const HOP = 0.6;
const CLIENT: FlowNode = { id: 'c', label: 'Client', kind: 'client', shape: 'laptop', x: 0.3, y: 1.6 };
const PRIMARY: FlowNode = { id: 'p', label: 'Primary', sub: 'takes writes', kind: 'db', shape: 'db', x: 2.6, y: 1.6, size: 'lg' };
const REPLICAS: FlowNode[] = [
  { id: 'r1', label: 'Replica 1', sub: 'reads', kind: 'db', shape: 'db', x: 5, y: 0.5 },
  { id: 'r2', label: 'Replica 2', sub: 'reads', kind: 'db', shape: 'db', x: 5, y: 2.7 },
];

const LINKS: FlowLink[] = [
  { from: 'c', to: 'p' },
  { from: 'p', to: 'r1', dashed: true, label: 'log' },
  { from: 'p', to: 'r2', dashed: true, label: 'log' },
];

const cluster = (changes: Record<string, Partial<FlowNode>>, packets: Packet[], extra: Partial<FlowState> = {}): FlowState => ({
  nodes: patch([CLIENT, PRIMARY, ...REPLICAS], changes),
  links: LINKS,
  packets,
  ...extra,
});

const meter = (value: number, label: string) => ({ value, label, tone: value > 0.85 ? ('bad' as const) : ('ok' as const) });

// ---------- Step 1: one copy ----------

const SOLO: FlowNode = { id: 'db', label: 'Database', sub: 'the only copy', kind: 'db', shape: 'db', x: 3.6, y: 1.6, size: 'lg' };
const solo = (down: boolean): FlowState => ({
  nodes: [CLIENT, { ...SOLO, status: down ? 'down' : 'hot', meter: down ? undefined : meter(0.92, 'reads + writes'), badge: down ? { text: 'disk failed', tone: 'bad' } : undefined }],
  links: [{ from: 'c', to: 'db', tone: down ? 'bad' : undefined, dashed: down }],
  packets: down ? [{ from: 'c', to: 'db', label: 'read', tone: 'bad', dur: 0.9 }] : [0, 0.25, 0.5, 0.75].map((d, i) => ({ from: 'c', to: 'db', label: i % 2 ? 'write' : 'read', delay: d, dur: 0.8 })),
  stats: [
    { label: 'Copies', value: '1', tone: 'bad' },
    { label: 'Read capacity', value: '1 node' },
    { label: 'If it dies', value: down ? 'data offline' : 'outage', tone: 'bad' },
  ],
  note: down ? { text: 'no copy anywhere else: unavailable, maybe lost', tone: 'bad' } : undefined,
});

// ---------- Step 2: leader-follower ----------

const writeThenLog = (label: string, delay = 0): Packet[] => [
  { from: 'c', to: 'p', label, delay, dur: HOP },
  { from: 'p', to: 'r1', tone: 'data', delay: delay + HOP, dur: HOP },
  { from: 'p', to: 'r2', tone: 'data', delay: delay + HOP, dur: HOP },
];

const LF_STATS: Stat[] = [
  { label: 'Writers', value: '1 primary' },
  { label: 'Readers', value: '3 nodes', tone: 'ok' },
  { label: 'Write conflicts', value: 'none', tone: 'ok' },
];

// ---------- Step 3: sync, async, semi-sync ----------

type Mode = 'sync' | 'stuck' | 'async' | 'semi';
function ackFlow(mode: Mode): FlowState {
  const out: Packet[] = [{ from: 'c', to: 'p', label: 'write', dur: HOP }];
  const t1 = HOP;
  if (mode === 'async') {
    out.push({ from: 'p', to: 'c', label: 'ok', tone: 'res', delay: t1, dur: HOP });
    out.push({ from: 'p', to: 'r1', tone: 'data', delay: t1 + HOP, dur: HOP }, { from: 'p', to: 'r2', tone: 'data', delay: t1 + HOP, dur: HOP });
  } else {
    out.push({ from: 'p', to: 'r1', tone: 'data', delay: t1, dur: HOP }, { from: 'p', to: 'r2', tone: 'data', delay: t1, dur: HOP });
    out.push({ from: 'r1', to: 'p', label: 'ack', tone: 'res', delay: t1 + HOP, dur: HOP });
    if (mode === 'sync') out.push({ from: 'r2', to: 'p', label: 'ack', tone: 'res', delay: t1 + HOP, dur: HOP });
    if (mode !== 'stuck') out.push({ from: 'p', to: 'c', label: 'ok', tone: 'res', delay: t1 + 2 * HOP, dur: HOP });
  }
  const waitsFor = { sync: 'all followers', stuck: 'all followers', async: 'nobody', semi: '1 follower' }[mode];
  const latency = { sync: 'slowest', stuck: 'blocked', async: 'fastest', semi: 'in between' }[mode];
  const loss = { sync: 'none', stuck: 'none', async: 'last writes', semi: 'less' }[mode];
  const notes: Record<Mode, FlowState['note']> = {
    sync: { text: 'synchronous: ack only after followers have it' },
    stuck: { text: 'a stuck follower blocks every write', tone: 'bad' },
    async: { text: 'asynchronous: ack now, replicate later', tone: 'accent' },
    semi: { text: 'semi-synchronous: wait for one follower', tone: 'ok' },
  };
  return cluster(
    {
      r2: mode === 'stuck' ? { status: 'hot', badge: { text: 'stuck', tone: 'bad' } } : mode === 'semi' ? { status: 'dim' } : {},
      p: { badge: { text: `waits for ${waitsFor}`, tone: mode === 'stuck' ? 'bad' : 'accent' } },
    },
    out,
    {
      stats: [
        { label: 'Mode', value: mode === 'stuck' ? 'sync' : mode === 'semi' ? 'semi-sync' : mode },
        { label: 'Write latency', value: latency, tone: mode === 'async' || mode === 'semi' ? 'ok' : 'bad' },
        { label: 'Loss on failover', value: loss, tone: loss === 'last writes' ? 'bad' : 'ok' },
      ],
      note: notes[mode],
    },
  );
}

// ---------- Step 4: async failover loses the tail ----------

const PRIMARY_LOG = ['w1', 'w2', 'w3'];
const REPLICA_LOG = PRIMARY_LOG.slice(0, 2);
const lost = PRIMARY_LOG.filter((w) => !REPLICA_LOG.includes(w));
const failover = (phase: 0 | 1 | 2): FlowState => {
  const changes: Record<string, Partial<FlowNode>> = {
    p: { items: PRIMARY_LOG, status: phase === 0 ? 'normal' : 'down', badge: phase === 1 ? { text: 'crashed', tone: 'bad' } : undefined },
    r1: { items: REPLICA_LOG, badge: phase === 0 ? { text: 'lagging', tone: 'bad' } : undefined },
    r2: { items: REPLICA_LOG.slice(0, 1) },
  };
  if (phase === 2) {
    changes.r1 = { items: REPLICA_LOG, label: 'New primary', sub: 'most up to date', status: 'active', badge: { text: `${lost.join(', ')} lost`, tone: 'bad' } };
  }
  const packets: Packet[] =
    phase === 0
      ? [
          { from: 'c', to: 'p', label: 'w3', dur: HOP },
          { from: 'p', to: 'c', label: 'ok', tone: 'res', delay: HOP, dur: HOP },
        ]
      : phase === 2
        ? [
            { from: 'c', to: 'r1', label: 'write', dur: 1 },
            { from: 'r1', to: 'r2', tone: 'data', label: 'log', delay: 1, dur: 0.8 },
          ]
        : [];
  return {
    nodes: patch([CLIENT, PRIMARY, ...REPLICAS], changes),
    links:
      phase === 2
        ? [
            { from: 'c', to: 'r1', tone: 'accent' },
            { from: 'r1', to: 'r2', dashed: true },
            { from: 'c', to: 'p', dashed: true, tone: 'bad' },
          ]
        : LINKS,
    packets,
    stats: [
      { label: 'Primary had', value: String(PRIMARY_LOG.length) },
      { label: 'Best replica', value: String(REPLICA_LOG.length) },
      { label: 'Lost on failover', value: phase === 2 ? String(lost.length) : '-', tone: phase === 2 ? 'bad' : 'neutral' },
    ],
    note: [{ text: 'w3 acked to the client before any follower had it', tone: 'accent' as const }, { text: 'primary dies, followers notice the silence', tone: 'bad' as const }, { text: 'promoted follower never saw w3: an acked write is gone', tone: 'bad' as const }][phase],
  };
};

// ---------- Step 5: replication lag anomalies ----------

const lag = (frame: 0 | 1 | 2 | 3 | 4): FlowState => {
  const base: Record<string, Partial<FlowNode>> = { p: { items: ['post'] }, r1: { items: [] }, r2: { items: [] } };
  switch (frame) {
    case 0:
      return cluster(base, [{ from: 'c', to: 'p', label: 'post', dur: HOP }], {
        stats: [{ label: 'Primary', value: 'has post' }, { label: 'Replicas', value: 'lagging', tone: 'bad' }, { label: 'Anomaly', value: '-' }],
      });
    case 1:
      return cluster({ ...base, r1: { items: [], status: 'active' } }, [
        { from: 'c', to: 'r1', label: 'refresh', dur: 0.8 },
        { from: 'r1', to: 'c', label: 'no post', tone: 'bad', delay: 0.8, dur: 0.8 },
      ], {
        links: [...LINKS, { from: 'c', to: 'r1', tone: 'bad' }],
        stats: [{ label: 'Read from', value: 'replica 1' }, { label: 'Sees own post', value: 'no', tone: 'bad' }, { label: 'Anomaly', value: 'own write gone', tone: 'bad' }],
        note: { text: 'post, then not visible on refresh', tone: 'bad' },
      });
    case 2:
      return cluster({ ...base, p: { items: ['post'], status: 'active', badge: { text: 'your reads for a window', tone: 'accent' } } }, [
        { from: 'c', to: 'p', label: 'refresh', dur: HOP },
        { from: 'p', to: 'c', label: 'post', tone: 'res', delay: HOP, dur: HOP },
      ], {
        stats: [{ label: 'Read from', value: 'primary' }, { label: 'Sees own post', value: 'yes', tone: 'ok' }, { label: 'Fix', value: 'RYW routing', tone: 'ok', hint: 'read-your-writes' }],
        note: { text: 'route this user to the primary right after a write', tone: 'ok' },
      });
    case 3:
      return cluster({ p: { items: ['v2'] }, r1: { items: ['v2'] }, r2: { items: ['v1'], badge: { text: 'behind', tone: 'bad' } } }, [
        { from: 'c', to: 'r1', label: 'read', dur: 0.8 },
        { from: 'r1', to: 'c', label: 'v2', tone: 'res', delay: 0.8, dur: 0.8 },
        { from: 'c', to: 'r2', label: 'read', delay: 1.7, dur: 0.8 },
        { from: 'r2', to: 'c', label: 'v1', tone: 'bad', delay: 2.5, dur: 0.8 },
      ], {
        links: [...LINKS, { from: 'c', to: 'r1' }, { from: 'c', to: 'r2' }],
        stats: [{ label: 'First read', value: 'v2' }, { label: 'Second read', value: 'v1', tone: 'bad' }, { label: 'Anomaly', value: 'goes backward', tone: 'bad' }],
        note: { text: 'value goes backward between refreshes', tone: 'bad' },
      });
    default:
      return cluster({ p: { items: ['v2'] }, r1: { items: ['v2'], status: 'active', badge: { text: 'pinned', tone: 'accent' } }, r2: { items: ['v1'], status: 'dim' } }, [
        { from: 'c', to: 'r1', label: 'read', dur: 0.8 },
        { from: 'r1', to: 'c', label: 'v2', tone: 'res', delay: 0.8, dur: 0.8 },
      ], {
        links: [...LINKS, { from: 'c', to: 'r1', tone: 'accent' }],
        stats: [{ label: 'Reads go to', value: 'replica 1' }, { label: 'Goes backward', value: 'never', tone: 'ok' }, { label: 'Fix', value: 'pin user', tone: 'ok' }],
        note: { text: 'pin a user to one replica', tone: 'ok' },
      });
  }
};

// ---------- Step 6: multi-leader ----------

const ML_NODES: FlowNode[] = [
  { id: 'ue', label: 'User', sub: 'Europe', kind: 'client', shape: 'laptop', x: 0.6, y: 0.6, size: 'sm' },
  { id: 'le', label: 'Leader EU', kind: 'db', shape: 'db', x: 3.4, y: 0.6 },
  { id: 'uu', label: 'User', sub: 'US', kind: 'client', shape: 'laptop', x: 0.6, y: 2.8, size: 'sm' },
  { id: 'lu', label: 'Leader US', kind: 'db', shape: 'db', x: 3.4, y: 2.8 },
];
const ML_LINKS: FlowLink[] = [
  { from: 'ue', to: 'le' },
  { from: 'uu', to: 'lu' },
  { from: 'le', to: 'lu', dashed: true, label: 'async' },
];
const ML_GROUPS = [
  { label: 'eu region', nodes: ['ue', 'le'] },
  { label: 'us region', nodes: ['uu', 'lu'] },
];
// Concurrent writes to the same key, each with a timestamp. Last write wins keeps the higher one.
const W_EU = { v: 'x=1', ts: 100 };
const W_US = { v: 'x=2', ts: 101 };
const LWW = W_EU.ts > W_US.ts ? W_EU : W_US;
const multi = (phase: 0 | 1 | 2): FlowState => ({
  nodes: patch(ML_NODES, {
    le: { items: phase === 0 ? [W_EU.v] : phase === 1 ? [W_EU.v, W_US.v] : [LWW.v], badge: phase === 1 ? { text: 'conflict', tone: 'bad' } : phase === 2 ? { text: 'LWW', tone: 'accent' } : undefined, status: phase === 1 ? 'hot' : 'normal' },
    lu: { items: phase === 0 ? [W_US.v] : phase === 1 ? [W_US.v, W_EU.v] : [LWW.v], badge: phase === 1 ? { text: 'conflict', tone: 'bad' } : phase === 2 ? { text: 'LWW', tone: 'accent' } : undefined, status: phase === 1 ? 'hot' : 'normal' },
  }),
  links: ML_LINKS,
  groups: ML_GROUPS,
  packets:
    phase === 0
      ? [
          { from: 'ue', to: 'le', label: W_EU.v, dur: 0.8 },
          { from: 'uu', to: 'lu', label: W_US.v, dur: 0.8 },
        ]
      : phase === 1
        ? [
            { from: 'le', to: 'lu', label: W_EU.v, tone: 'data', dur: 1 },
            { from: 'lu', to: 'le', label: W_US.v, tone: 'data', dur: 1 },
          ]
        : [],
  stats: [
    { label: 'Leaders', value: '2, one/region' },
    { label: 'Writes', value: 'local, fast', tone: 'ok' },
    phase === 2 ? { label: 'Lost', value: W_EU.ts > W_US.ts ? W_US.v : W_EU.v, tone: 'bad', hint: 'last write wins' } : { label: 'Conflicts', value: phase === 1 ? 'yes' : '-', tone: phase === 1 ? 'bad' : 'neutral' },
  ],
  note: [
    { text: 'both regions write the same key at once' },
    { text: 'replication brings the two writes together', tone: 'bad' as const },
    { text: `last write wins keeps ${LWW.v}, the other is silently lost`, tone: 'bad' as const },
  ][phase],
});

// ---------- Step 7: leaderless quorum ----------

const N = 3;
const W = 2;
const R = 2;
const QN: FlowNode[] = [
  { ...CLIENT, sub: 'or coordinator' },
  { id: 'qa', label: 'Node A', kind: 'db', shape: 'db', x: 3.6, y: 0.3, size: 'sm' },
  { id: 'qb', label: 'Node B', kind: 'db', shape: 'db', x: 3.6, y: 1.6, size: 'sm' },
  { id: 'qc', label: 'Node C', kind: 'db', shape: 'db', x: 3.6, y: 2.9, size: 'sm' },
];
const QL: FlowLink[] = [
  { from: 'c', to: 'qa' },
  { from: 'c', to: 'qb' },
  { from: 'c', to: 'qc' },
];
// Simulate: C is down during the write, back (stale) for the read.
const versions: Record<string, number> = { qa: 1, qb: 1, qc: 1 };
const writeAcks = ['qa', 'qb'];
writeAcks.forEach((id) => (versions[id] = 2));
const readSet = ['qb', 'qc'];
const newest = Math.max(...readSet.map((id) => versions[id]));
const stale = readSet.filter((id) => versions[id] < newest);
const QUORUM_STATS = (third: Stat): Stat[] => [
  { label: 'N / W / R', value: `${N} / ${W} / ${R}` },
  { label: 'W + R > N', value: `${W + R} > ${N}`, tone: W + R > N ? 'ok' : 'bad' },
  third,
];
const quorum = (phase: 0 | 1 | 2): FlowState => {
  if (phase === 0) {
    return {
      nodes: patch(QN, { qa: { items: ['v2'] }, qb: { items: ['v2'] }, qc: { items: ['v1'], status: 'down' } }),
      links: QL,
      packets: [
        { from: 'c', to: 'qa', label: 'v2', dur: 0.8 },
        { from: 'c', to: 'qb', label: 'v2', dur: 0.8 },
        { from: 'c', to: 'qc', label: 'v2', tone: 'bad', dur: 0.8 },
        { from: 'qa', to: 'c', label: 'ack', tone: 'res', delay: 0.8, dur: 0.8 },
        { from: 'qb', to: 'c', label: 'ack', tone: 'res', delay: 0.8, dur: 0.8 },
      ],
      stats: QUORUM_STATS({ label: 'Write acks', value: `${writeAcks.length} of ${N}`, tone: writeAcks.length >= W ? 'ok' : 'bad' }),
      note: { text: `${writeAcks.length} acks >= W, the write succeeds with one node down`, tone: 'ok' },
    };
  }
  if (phase === 1) {
    return {
      nodes: patch(QN, { qa: { items: ['v2'], status: 'dim' }, qb: { items: ['v2'], status: 'active' }, qc: { items: ['v1'], status: 'active', badge: { text: 'stale', tone: 'bad' } } }),
      links: QL,
      packets: [
        ...readSet.map((id) => ({ from: 'c', to: id, label: 'read', dur: 0.8 })),
        ...readSet.map((id) => ({ from: id, to: 'c', label: `v${versions[id]}`, tone: versions[id] === newest ? ('res' as const) : ('bad' as const), delay: 0.8, dur: 0.8 })),
      ],
      stats: QUORUM_STATS({ label: 'Read result', value: `v${newest}`, tone: 'ok', hint: 'newest wins' }),
      note: { text: 'read set and write set overlap on B, so v2 is seen', tone: 'ok' },
    };
  }
  return {
    nodes: patch(QN, { qa: { items: ['v2'] }, qb: { items: ['v2'] }, qc: { items: [`v${newest}`], status: 'active', badge: { text: 'repaired', tone: 'ok' } } }),
    links: QL,
    packets: stale.map((id) => ({ from: 'c', to: id, label: `v${newest}`, tone: 'data' as const, dur: 0.9 })),
    stats: QUORUM_STATS({ label: 'Stale copies', value: '0', tone: 'ok' }),
    note: { text: 'read repair: write the newest value back to stale replicas', tone: 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'replication',
  objectives: [
    { text: 'Why keep copies: availability, read scaling, locality', step: 2 },
    { text: 'Trade sync, async and semi-sync replication', step: 3 },
    { text: 'Explain how async failover loses acknowledged writes', step: 4 },
    { text: 'Fix replication lag anomalies', step: 5 },
    { text: 'Compare leader-follower, multi-leader and leaderless', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'One copy of the data',
      tag: 'problem',
      body: ['Every read and write lands on one database. It is the read bottleneck, and if its disk dies the data is offline or gone.'],
      keyIdea: 'Replication copies data to multiple nodes for availability, read scaling and locality.',
      frames: [
        { state: solo(false), hold: 1800 },
        { state: solo(true) },
      ],
    },
    {
      label: 'Leader-follower',
      title: 'One writer, many readers',
      tag: 'concept',
      body: [
        'Writes go to the **primary**. It ships a **replication log** to the replicas, which apply the same changes in order.',
        'Reads can go to any replica. There is one writer, so there are no write conflicts.',
      ],
      keyIdea: 'Leader-follower is simple and conflict free, but the leader is the write bottleneck and failover is the hard part.',
      frames: [
        { state: cluster({ p: { items: ['x=1'] }, r1: { items: ['x=1'] }, r2: { items: ['x=1'] } }, writeThenLog('x=1'), { stats: LF_STATS }), hold: 1800 },
        {
          state: cluster(
            { p: { items: ['x=1'] }, r1: { items: ['x=1'], status: 'active' }, r2: { items: ['x=1'], status: 'active' } },
            [
              { from: 'c', to: 'r1', label: 'read', dur: 0.8 },
              { from: 'c', to: 'r2', label: 'read', delay: 0.3, dur: 0.8 },
            ],
            { links: [...LINKS, { from: 'c', to: 'r1' }, { from: 'c', to: 'r2' }], stats: LF_STATS, note: { text: 'reads scale out across replicas', tone: 'ok' } },
          ),
        },
      ],
    },
    {
      label: 'Sync vs async',
      title: 'When is a write done?',
      tag: 'trade-off',
      body: [
        '**Synchronous:** ack after followers have it. No loss if the leader fails, but slower, and a stuck follower blocks writes.',
        '**Asynchronous:** ack immediately. Fast, but the last writes can be lost. **Semi-synchronous** waits for one follower, a common compromise.',
      ],
      keyIdea: 'The ack point decides both write latency and how much you can lose on failover.',
      frames: [
        { state: ackFlow('sync'), hold: 2700 },
        { state: ackFlow('stuck'), hold: 2400 },
        { state: ackFlow('async'), hold: 2400 },
        { state: ackFlow('semi'), hold: 2700 },
      ],
    },
    {
      label: 'Failover',
      title: 'Async failover loses the tail',
      tag: 'trade-off',
      body: [
        'With async replication the primary acks `w3` before any follower has it.',
        'The primary crashes. The most up-to-date follower is promoted, but it never saw `w3`. A write the client was told succeeded is gone.',
      ],
      keyIdea: 'Async replication plus failover can lose acknowledged writes. Sync or semi-sync narrows that window.',
      frames: [
        { state: failover(0), hold: 2000 },
        { state: failover(1), hold: 1600 },
        { state: failover(2) },
      ],
    },
    {
      label: 'Lag anomalies',
      title: 'Stale reads from replicas',
      tag: 'technique',
      body: [
        'Async replicas run behind. Users notice when their own post disappears on refresh, or a value goes backward between refreshes.',
        'Fixes: route a user to the primary for a window after they write, and pin a user to one replica. For "reply before the question", use causal consistency or the same partition.',
      ],
      keyIdea: 'Replication lag is visible to users. Route reads so each user sees a consistent story.',
      frames: [
        { state: lag(0), hold: 1500 },
        { state: lag(1), hold: 2000 },
        { state: lag(2), hold: 2000 },
        { state: lag(3), hold: 3500 },
        { state: lag(4) },
      ],
    },
    {
      label: 'Multi-leader',
      title: 'A leader in every region',
      tag: 'technique',
      body: [
        '**Multi-leader** puts a writer in each region, so writes are local and fast.',
        'Two regions can change the same key at the same time. Replication brings both writes together and someone must resolve the conflict.',
      ],
      keyIdea: 'Multi-leader buys local writes and pays with conflicts. Last write wins is simple but silently drops data. CRDTs or app merge rules keep both.',
      frames: [
        { state: multi(0), hold: 1700 },
        { state: multi(1), hold: 2000 },
        { state: multi(2) },
      ],
    },
    {
      label: 'Leaderless',
      title: 'Quorum reads and writes',
      tag: 'technique',
      body: [
        '**Leaderless**: any node takes writes. A write must reach `W` of `N` replicas and a read asks `R` of them.',
        'If `W + R > N`, every read set overlaps every write set, so a read sees at least one up-to-date copy. Stale copies get fixed by read repair.',
      ],
      keyIdea: 'No failover and high availability, at the cost of conflicts, read repair and tuning W and R.',
      frames: [
        { state: quorum(0), hold: 2000 },
        { state: quorum(1), hold: 2200 },
        { state: quorum(2) },
      ],
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Leader-follower:** one writer, simple, the leader is the write bottleneck.',
        '- **Multi-leader:** local writes per region, conflicts need resolution.',
        '- **Leaderless:** quorum reads and writes, `W + R > N` for overlap.',
        '- **Sync vs async:** sync is safe and slow, async is fast and can lose the tail, semi-sync waits for one.',
        '- **Lag:** read-your-writes routing, pin users to a replica, causal ordering.',
      ],
      keyIdea: 'Pick the model from who needs to write where, then pick the ack point from how much loss you can accept.',
      frames: [
        {
          state: cluster({ p: { items: ['x=1'] }, r1: { items: ['x=1'] }, r2: { items: ['x=1'] } }, [], {
            stats: [
              { label: 'Models', value: '3' },
              { label: 'Safe acks', value: 'sync, semi' },
              { label: 'Fast acks', value: 'async' },
            ],
          }),
        },
      ],
    },
  ],
});
