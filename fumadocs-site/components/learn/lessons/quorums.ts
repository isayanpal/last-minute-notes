import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';

/*
 * Layout: one client (x 0), three replicas stacked at x 3.3, an optional stand-in node at x 5.5.
 */

const CLIENT: FlowNode = { id: 'c', label: 'Client', kind: 'client', shape: 'laptop', x: 0, y: 1.6, size: 'sm' };
const REPLICAS = (v: [string, string, string]): FlowNode[] => [
  { id: 'r1', label: 'Replica 1', kind: 'db', shape: 'db', x: 3.3, y: 0.2, size: 'sm', items: [v[0]] },
  { id: 'r2', label: 'Replica 2', kind: 'db', shape: 'db', x: 3.3, y: 1.6, size: 'sm', items: [v[1]] },
  { id: 'r3', label: 'Replica 3', kind: 'db', shape: 'db', x: 3.3, y: 3.0, size: 'sm', items: [v[2]] },
];
const LINKS: FlowLink[] = ['r1', 'r2', 'r3'].map((r) => ({ from: 'c', to: r }));

const cfg = (n: number, w: number, r: number, last: NonNullable<FlowState['stats']>[number]): FlowState['stats'] => [
  { label: 'N / W / R', value: `${n} / ${w} / ${r}` },
  { label: 'W + R', value: `${w + r} ${w + r > n ? '>' : '≤'} ${n}`, tone: w + r > n ? 'ok' : 'bad' },
  last,
];

const sendTo = (ids: string[], label: string, tone: Packet['tone'] = 'req', delay = 0): Packet[] => ids.map((id, i) => ({ from: 'c', to: id, label, tone, delay: delay + i * 0.15, dur: 0.7 }));
const replyFrom = (ids: string[], label: string, delay = 0): Packet[] => ids.map((id, i) => ({ from: id, to: 'c', label, tone: 'res' as const, delay: delay + i * 0.15, dur: 0.7 }));

const scene = (versions: [string, string, string], over: Partial<FlowState> = {}): FlowState => ({ nodes: [CLIENT, ...REPLICAS(versions)], links: LINKS, ...over });

// Step 1: write lands on one replica only, a read hits another.
const lone: FlowState[] = [
  scene(['v1', 'v1', 'v1'], { stats: [{ label: 'Replicas', value: '3' }, { label: 'Value', value: 'v1' }, { label: 'Agree', value: 'yes', tone: 'ok' }] }),
  scene(['v2', 'v1', 'v1'], {
    nodes: [CLIENT, ...patch(REPLICAS(['v2', 'v1', 'v1']), { r1: { status: 'active' } })],
    packets: sendTo(['r1'], 'write v2', 'req'),
    stats: [{ label: 'Wrote to', value: '1 replica' }, { label: 'r1', value: 'v2', tone: 'ok' }, { label: 'r2, r3', value: 'v1', tone: 'bad' }],
    note: { text: 'write acknowledged by one replica', tone: 'accent' },
  }),
  scene(['v2', 'v1', 'v1'], {
    nodes: [CLIENT, ...patch(REPLICAS(['v2', 'v1', 'v1']), { r3: { status: 'active', badge: { text: 'stale', tone: 'bad' } } })],
    packets: [{ from: 'c', to: 'r3', label: 'read', dur: 0.7 }, { from: 'r3', to: 'c', label: 'v1', tone: 'bad', delay: 0.7, dur: 0.7 }],
    stats: [{ label: 'Read from', value: 'replica 3' }, { label: 'Got', value: 'v1', tone: 'bad' }, { label: 'Truth', value: 'v2' }],
    note: { text: 'the read missed the write: stale', tone: 'bad' },
  }),
];

// Step 2: W=2, R=2 overlap.
const writeQuorum = scene(['v2', 'v2', 'v1'], {
  nodes: [CLIENT, ...patch(REPLICAS(['v2', 'v2', 'v1']), { r1: { status: 'active' }, r2: { status: 'active' }, r3: { status: 'dim', badge: { text: 'slow', tone: 'accent' } } })],
  packets: [...sendTo(['r1', 'r2'], 'write v2'), ...replyFrom(['r1', 'r2'], 'ack', 0.8)],
  stats: cfg(3, 2, 2, { label: 'Acks needed', value: '2 of 3' }),
  note: { text: 'write succeeds once 2 replicas ack', tone: 'accent' },
});
const readQuorum = scene(['v2', 'v2', 'v1'], {
  nodes: [CLIENT, ...patch(REPLICAS(['v2', 'v2', 'v1']), { r1: { status: 'dim' }, r2: { status: 'active', badge: { text: 'overlap', tone: 'accent' } }, r3: { status: 'active' } })],
  packets: [...sendTo(['r2', 'r3'], 'read'), { from: 'r2', to: 'c', label: 'v2', tone: 'res', delay: 0.8, dur: 0.7 }, { from: 'r3', to: 'c', label: 'v1', tone: 'bad', delay: 0.95, dur: 0.7 }],
  stats: [{ label: 'Read set', value: 'r2 + r3' }, { label: 'Newest', value: 'v2', tone: 'ok' }, { label: 'Why', value: 'sets overlap' }],
  note: { text: 'every read set shares a replica with every write set', tone: 'accent' },
});

// Step 3: the knobs.
const knob = (w: number, r: number, label: string): FlowState => {
  const all = ['r1', 'r2', 'r3'];
  const writes = all.slice(0, w);
  const reads = all.slice(3 - r);
  return scene(['v2', 'v2', 'v2'], {
    nodes: [CLIENT, ...patch(REPLICAS(['v2', 'v2', 'v2']), Object.fromEntries(all.map((id) => [id, { status: writes.includes(id) || reads.includes(id) ? ('active' as const) : ('dim' as const) }])))],
    packets: [...sendTo(writes, `W${w}`, 'req'), ...sendTo(reads, `R${r}`, 'data', 0.9)],
    stats: [{ label: 'N / W / R', value: `3 / ${w} / ${r}` }, { label: 'W + R', value: `${w + r} ${w + r > 3 ? '>' : '≤'} 3`, tone: w + r > 3 ? 'ok' : 'bad' }, { label: 'Feel', value: label, tone: w + r > 3 ? 'ok' : 'bad' }],
  });
};

// Step 4: tolerate a failure, hinted handoff.
const down = scene(['v2', 'v2', 'v1'], {
  nodes: [CLIENT, ...patch(REPLICAS(['v2', 'v2', 'v1']), { r3: { status: 'down' } })],
  links: [{ from: 'c', to: 'r1' }, { from: 'c', to: 'r2' }, { from: 'c', to: 'r3', dashed: true, tone: 'bad' }],
  packets: [...sendTo(['r1', 'r2'], 'write v2'), ...replyFrom(['r1', 'r2'], 'ack', 0.8)],
  stats: [{ label: 'Down', value: '1 replica' }, { label: 'Writes', value: 'still work', tone: 'ok' }, { label: 'Reads', value: 'still work', tone: 'ok' }],
  note: { text: 'N=3, W=2, R=2 tolerates one failure', tone: 'accent' },
});
const STAND_IN: FlowNode = { id: 'h', label: 'Stand-in node', kind: 'db', shape: 'db', x: 5.5, y: 3.0, size: 'sm' };
const hinted = (phase: 'hint' | 'back'): FlowState => ({
  nodes: [
    CLIENT,
    ...patch(REPLICAS(phase === 'hint' ? ['v2', 'v2', 'v1'] : ['v2', 'v2', 'v2']), { r3: phase === 'hint' ? { status: 'down' } : { status: 'active' } }),
    { ...STAND_IN, items: phase === 'hint' ? ['v2'] : [], badge: phase === 'hint' ? { text: 'hint: for r3', tone: 'accent' } : undefined, status: phase === 'hint' ? 'active' : 'dim' },
  ],
  links: [...LINKS, { from: 'c', to: 'h', dashed: true }, { from: 'h', to: 'r3', dashed: true }],
  packets:
    phase === 'hint'
      ? [{ from: 'c', to: 'h', label: 'write v2', dur: 0.8 }]
      : [{ from: 'h', to: 'r3', label: 'hand back', tone: 'data', dur: 0.8 }],
  stats: [
    { label: 'Mode', value: 'sloppy quorum' },
    { label: 'Availability', value: 'higher', tone: 'ok' },
    { label: 'Consistency', value: 'weaker', tone: 'bad' },
  ],
  note: { text: phase === 'hint' ? 'home node down: another node keeps the write with a hint' : 'home node is back: the hint is replayed to it', tone: 'accent' },
});

// Step 5: read repair.
const repair = (fixed: boolean): FlowState => {
  const versions: [string, string, string] = fixed ? ['v2', 'v2', 'v2'] : ['v2', 'v2', 'v1'];
  return scene(versions, {
    nodes: [
      CLIENT,
      ...patch(REPLICAS(versions), {
        r1: { status: 'dim' },
        r2: { status: 'active' },
        r3: fixed ? { status: 'active', badge: { text: 'repaired', tone: 'accent' } } : { status: 'active', badge: { text: 'stale', tone: 'bad' } },
      }),
    ],
    packets: fixed
      ? [{ from: 'c', to: 'r3', label: 'write v2', tone: 'data', dur: 0.8 }]
      : [...sendTo(['r2', 'r3'], 'read'), { from: 'r2', to: 'c', label: 'v2', tone: 'res', delay: 0.8, dur: 0.6 }, { from: 'r3', to: 'c', label: 'v1', tone: 'bad', delay: 0.9, dur: 0.6 }],
    stats: [
      { label: 'Read repair', value: fixed ? 'done' : 'spotted a diff', tone: fixed ? 'ok' : 'bad' },
      { label: 'Cold data', value: 'Merkle trees' },
      { label: 'Membership', value: 'gossip' },
    ],
    note: { text: fixed ? 'newest version written back to the stale replica' : 'the replicas disagree: v2 is newer', tone: 'accent' },
  });
};

// Step 6: conflicting writes.
const CONFLICT_NODES = (items: [string[], string[]], badge?: string): FlowNode[] => [
  { id: 'c1', label: 'Phone', kind: 'client', shape: 'phone', x: 0, y: 0.4, size: 'sm' },
  { id: 'c2', label: 'Laptop', kind: 'client', shape: 'laptop', x: 0, y: 2.8, size: 'sm' },
  { id: 'r1', label: 'Replica A', sub: 'cart', kind: 'db', shape: 'db', x: 3.2, y: 0.4, size: 'sm', items: items[0] },
  { id: 'r2', label: 'Replica B', sub: 'cart', kind: 'db', shape: 'db', x: 3.2, y: 2.8, size: 'sm', items: items[1], badge: badge ? { text: badge, tone: 'bad' } : undefined },
];
const CONFLICT_LINKS: FlowLink[] = [
  { from: 'c1', to: 'r1' },
  { from: 'c2', to: 'r2' },
  { from: 'r1', to: 'r2', dashed: true, label: 'sync' },
];
const concurrent: FlowState = {
  nodes: CONFLICT_NODES([['milk'], ['eggs']]),
  links: CONFLICT_LINKS,
  packets: [
    { from: 'c1', to: 'r1', label: 'add milk', dur: 0.7 },
    { from: 'c2', to: 'r2', label: 'add eggs', dur: 0.7 },
  ],
  stats: [{ label: 'Writes', value: 'concurrent' }, { label: 'Replica A', value: 'milk' }, { label: 'Replica B', value: 'eggs' }],
  note: { text: 'both replicas accepted a different write', tone: 'accent' },
};
const lww: FlowState = {
  nodes: CONFLICT_NODES([['eggs'], ['eggs']], 'milk lost'),
  links: CONFLICT_LINKS,
  packets: [{ from: 'r1', to: 'r2', label: 'sync', tone: 'bad', dur: 0.8 }],
  stats: [{ label: 'Rule', value: 'LWW' }, { label: 'Winner', value: 'higher clock' }, { label: 'Result', value: 'data loss', tone: 'bad' }],
  note: { text: 'LWW keeps one write and silently drops the other', tone: 'bad' },
};
const merged: FlowState = {
  nodes: CONFLICT_NODES([['milk', 'eggs'], ['milk', 'eggs']]),
  links: CONFLICT_LINKS,
  packets: [{ from: 'r1', to: 'r2', label: 'merge', tone: 'ok', dur: 0.8 }],
  stats: [{ label: 'Rule', value: 'CRDT union' }, { label: 'Merge', value: 'any order', tone: 'ok' }, { label: 'Result', value: 'both kept', tone: 'ok' }],
  note: { text: 'a merge that is commutative and idempotent converges', tone: 'accent' },
};

export default defineLesson('flow', {
  slug: 'quorums',
  objectives: [
    { text: 'Why W + R > N guarantees a read sees the latest write', step: 2 },
    { text: 'How W and R trade read speed for write speed', step: 3 },
    { text: 'Sloppy quorums and hinted handoff', step: 4 },
    { text: 'Read repair and conflict resolution', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Which copy is fresh?',
      tag: 'problem',
      body: [
        'Data lives on three replicas. A write that reaches only one of them leaves the other two stale, and a read can land on a stale one.',
        'Waiting for all three is slow and fails when one node is down. Waiting for one is fast and unsafe.',
      ],
      keyIdea: 'Quorums sit between "all" and "one": enough replicas that reads and writes are guaranteed to meet.',
      frames: lone.map((state, i) => ({ state, hold: i === 0 ? 1100 : 2200 })),
    },
    {
      label: 'Overlap',
      title: 'Make the sets overlap',
      tag: 'concept',
      body: [
        'With **N** replicas, a write must reach **W** and a read must ask **R**. If **W + R > N**, every read set shares at least one replica with every write set.',
        'Here N=3, W=2, R=2. Replica 3 missed the write, but the read also asks replica 2, which has it. Pick the newest version.',
      ],
      keyIdea: 'Overlap means at least one replica in every read has the latest acknowledged write.',
      frames: [{ state: writeQuorum, hold: 2400 }, { state: readQuorum }],
    },
    {
      label: 'The knobs',
      title: 'Tune W and R per request',
      tag: 'technique',
      body: [
        '`W=3, R=1` makes reads fast and writes need every node. `W=1, R=3` is the mirror image. `W=1, R=1` is the fastest and only eventually consistent.',
        'Cassandra and DynamoDB expose these knobs per request, so one table can serve both strict and relaxed reads.',
      ],
      keyIdea: 'Read-heavy: lower R. Write-heavy: lower W. Always check that W + R stays above N when you need fresh reads.',
      frames: [knob(3, 1, 'fast reads'), knob(1, 3, 'fast writes'), knob(1, 1, 'fastest, stale')].map((state) => ({ state, hold: 2200 })),
    },
    {
      label: 'Failures',
      title: 'Survive a node down',
      tag: 'technique',
      body: [
        'With N=3, W=2, R=2 one replica can fail and both reads and writes still succeed.',
        'A **sloppy quorum** goes further: if a home node is down, write to another node with a **hint**, then hand the data back when the home node returns. More available, less consistent.',
      ],
      keyIdea: 'Sloppy quorums trade the overlap guarantee for availability, so the read can be stale until the hint is replayed.',
      frames: [{ state: down, hold: 2200 }, { state: hinted('hint'), hold: 2400 }, { state: hinted('back') }],
    },
    {
      label: 'Repair',
      title: 'Heal stale replicas',
      tag: 'technique',
      body: [
        '**Read repair**: when a quorum read sees replicas disagree, write the newest version back to the stale ones.',
        'For data nobody reads, **anti-entropy** compares Merkle hash trees to find differing ranges cheaply. **Gossip** spreads membership and health between random peers.',
      ],
      keyIdea: 'Replicas drift. Repair processes make them converge without a central coordinator.',
      frames: [{ state: repair(false), hold: 2400 }, { state: repair(true) }],
    },
    {
      label: 'Conflicts',
      title: 'Two writes, no single order',
      tag: 'trade-off',
      body: [
        'Concurrent writes can land on different replicas. **Last write wins** picks one by timestamp and silently loses the other, and clocks can lie.',
        'Safer: keep siblings and merge in the app, use domain rules (union of cart items), or use **CRDTs**, data types whose merge is commutative, associative and idempotent.',
      ],
      keyIdea: 'Pick a conflict rule on purpose. LWW is easy and loses data, CRDTs converge without coordination.',
      frames: [{ state: concurrent, hold: 2200 }, { state: lww, hold: 2600 }, { state: merged }],
    },
    {
      label: 'Recap',
      title: 'What a quorum does and does not give',
      tag: 'recap',
      body: [
        '- **Rule:** W + R > N makes read and write sets overlap. N=3, W=2, R=2 is the balanced default.',
        '- **Knobs:** lower R for fast reads, lower W for fast writes, both low for eventual consistency.',
        '- **Availability:** sloppy quorum with hinted handoff, at the cost of consistency.',
        '- **Convergence:** read repair, Merkle-tree anti-entropy, gossip.',
        '- **Conflicts:** LWW loses data. Prefer CRDTs, siblings or domain merges.',
        '- **Caveat:** quorum overlap alone is not linearizability. Concurrent writes, sloppy quorums and clocks still bite.',
      ],
      keyIdea: 'Quorums give tunable consistency, not a free lunch. Say what you pick for W and R, and why.',
      frames: [{ state: readQuorum }],
    },
  ],
});
