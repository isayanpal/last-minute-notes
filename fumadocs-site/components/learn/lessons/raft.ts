import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';
import type { Stat } from '../types';

/*
 * Five nodes on a pentagon, a client on the left. Node 1 sits at the top.
 * Each node shows its role and term as `sub`, and its log as item chips.
 */

type Role = 'follower' | 'candidate' | 'leader' | 'down';
type Spec = { role?: Role; term?: number; log?: string[]; badge?: FlowNode['badge']; meter?: FlowNode['meter']; dim?: boolean };

const POS: Record<string, { x: number; y: number }> = {
  n1: { x: 3.6, y: 0.2 },
  n2: { x: 5.3, y: 1.2 },
  n3: { x: 4.7, y: 2.9 },
  n4: { x: 2.5, y: 2.9 },
  n5: { x: 1.9, y: 1.2 },
};
const IDS = ['n1', 'n2', 'n3', 'n4', 'n5'];
const CLIENT: FlowNode = { id: 'c', label: 'Client', kind: 'client', x: 0, y: 1.6, size: 'sm' };

function node(id: string, s: Spec, pos = POS[id]): FlowNode {
  const role = s.role ?? 'follower';
  return {
    id,
    label: `Node ${id.slice(1)}`,
    sub: role === 'down' ? 'crashed' : `${role}, t${s.term ?? 1}`,
    kind: 'service',
    x: pos.x,
    y: pos.y,
    status: role === 'down' ? 'down' : role === 'leader' ? 'active' : s.dim ? 'dim' : 'normal',
    items: s.log,
    badge: s.badge,
    meter: s.meter,
  };
}

/** The five-node cluster. Every node defaults to a follower in `term`. */
function cluster(term: number, specs: Record<string, Spec>, extra: Partial<FlowState> = {}, client = true): FlowState {
  const nodes = IDS.map((id) => node(id, { term, ...specs[id] }));
  const leader = IDS.find((id) => specs[id]?.role === 'leader');
  return {
    nodes: client ? [CLIENT, ...nodes] : nodes,
    links: [
      ...(client && leader ? [{ from: 'c', to: leader }] : []),
      ...(leader ? IDS.filter((id) => id !== leader).map((id) => ({ from: leader, to: id, dashed: specs[id]?.role === 'down' })) : []),
    ],
    ...extra,
  };
}

const p = (from: string, to: string, tone: Packet['tone'], delay = 0, label?: string): Packet => ({ from, to, tone, delay, label, dur: 0.6 });
const fan = (from: string, to: string[], tone: Packet['tone'], delay = 0, label?: string): Packet[] => to.map((t, i) => p(from, t, tone, delay, i === 0 ? label : undefined));
const back = (to: string, from: string[], tone: Packet['tone'], delay = 0, label?: string): Packet[] => from.map((f, i) => p(f, to, tone, delay, i === 0 ? label : undefined));

const votes = (got: number, of = 5): Stat => ({ label: 'Votes', value: `${got} of ${of}`, tone: got >= Math.floor(of / 2) + 1 ? 'ok' : 'bad', hint: `need ${Math.floor(of / 2) + 1}` });

// ---------- Step 1: no agreement ----------

const DIVERGE: FlowState = {
  nodes: [
    { id: 'c1', label: 'Client 1', kind: 'client', x: 0, y: 0.5, size: 'sm' },
    { id: 'c2', label: 'Client 2', kind: 'client', x: 0, y: 2.7, size: 'sm' },
    ...IDS.map((id) =>
      node(id, {
        log: id === 'n5' || id === 'n1' ? ['x=5'] : id === 'n4' || id === 'n3' ? ['x=7'] : [],
        badge: id === 'n1' ? { text: 'x is 5?', tone: 'bad' } : id === 'n3' ? { text: 'x is 7?', tone: 'bad' } : undefined,
      }),
    ).map((n) => ({ ...n, sub: undefined })),
  ],
  links: [
    { from: 'c1', to: 'n5' },
    { from: 'c2', to: 'n4' },
  ],
  packets: [p('c1', 'n5', 'req', 0, 'x=5'), p('c2', 'n4', 'req', 0.2, 'x=7'), p('n5', 'n1', 'data', 0.7), p('n4', 'n3', 'data', 0.9)],
  stats: [
    { label: 'Nodes', value: '5' },
    { label: 'Values of x', value: '2', tone: 'bad' },
    { label: 'Agreement', value: 'none', tone: 'bad' },
  ],
  note: { text: 'without consensus, replicas diverge', tone: 'bad' },
};

// ---------- Step 2: randomized election timeouts ----------

const TIMEOUT: Record<string, number> = { n1: 160, n2: 240, n3: 290, n4: 210, n5: 270 };
function timers(t: number): FlowState {
  const fired = IDS.filter((id) => TIMEOUT[id] - t <= 0);
  const specs: Record<string, Spec> = {};
  for (const id of IDS) {
    const left = Math.max(0, TIMEOUT[id] - t);
    specs[id] = {
      role: left === 0 ? 'candidate' : 'follower',
      term: left === 0 ? 2 : 1,
      meter: { value: left / 300, label: `${left} ms left`, tone: left === 0 ? 'bad' : left < 80 ? 'accent' : 'info' },
    };
  }
  return cluster(
    1,
    specs,
    {
      stats: [
        { label: 'Leader', value: 'none' },
        { label: 'Term', value: '1' },
        { label: 'Timeouts', value: '150-300 ms', hint: 'random per node' },
      ],
      note: fired.length ? { text: 'Node 1 heard nothing for 160 ms: it runs for leader', tone: 'accent' } : undefined,
    },
    false,
  );
}

// ---------- Step 3: election ----------

const OTHERS = (id: string) => IDS.filter((x) => x !== id);
const ELECTION: FlowState[] = [
  cluster(2, { n1: { role: 'candidate', badge: { text: 'votes for itself', tone: 'accent' } } }, {
    packets: fan('n1', OTHERS('n1'), 'req', 0, 'RequestVote'),
    stats: [{ label: 'Term', value: '2' }, votes(1)],
  }),
  cluster(2, { n1: { role: 'candidate', badge: { text: '5 votes', tone: 'accent' } } }, {
    packets: back('n1', OTHERS('n1'), 'res', 0, 'yes'),
    stats: [{ label: 'Term', value: '2' }, votes(5)],
    note: { text: 'each node votes once per term', tone: 'accent' },
  }),
  cluster(2, { n1: { role: 'leader', badge: { text: 'leader of term 2', tone: 'accent' } } }, {
    packets: fan('n1', OTHERS('n1'), 'data', 0, 'heartbeat'),
    stats: [{ label: 'Term', value: '2' }, { label: 'Leader', value: 'Node 1', tone: 'ok' }],
    note: { text: 'heartbeats reset every follower\'s timeout' },
  }),
];

// ---------- Step 4: log replication ----------

const L = (log: string[]) => ({ log });
const REPL: FlowState[] = [
  cluster(2, { n1: { role: 'leader', log: ['x=5'], badge: { text: 'appended, not committed' } } }, {
    packets: [p('c', 'n1', 'req', 0, 'x = 5')],
    stats: [{ label: 'Stored on', value: '1 of 5' }, { label: 'Committed', value: 'no' }],
  }),
  cluster(2, { n1: { role: 'leader', log: ['x=5'] } }, {
    packets: fan('n1', OTHERS('n1'), 'data', 0, 'AppendEntries'),
    stats: [{ label: 'Stored on', value: '1 of 5' }, { label: 'Committed', value: 'no' }],
  }),
  cluster(2, { n1: { role: 'leader', log: ['x=5'], badge: { text: 'majority stored', tone: 'ok' } }, n2: L(['x=5']), n5: L(['x=5']) }, {
    packets: back('n1', ['n2', 'n5'], 'res', 0, 'ack'),
    stats: [{ label: 'Stored on', value: '3 of 5', tone: 'ok' }, { label: 'Committed', value: 'yes', tone: 'ok' }],
    note: { text: 'leader + 2 followers = 3 of 5: commit and apply' },
  }),
  cluster(2, { n1: { role: 'leader', log: ['x=5'], badge: { text: 'committed', tone: 'ok' } }, n2: L(['x=5']), n5: L(['x=5']) }, {
    packets: [p('n1', 'c', 'res', 0, 'success')],
    stats: [{ label: 'Stored on', value: '3 of 5', tone: 'ok' }, { label: 'Committed', value: 'yes', tone: 'ok' }],
  }),
  cluster(2, { n1: { role: 'leader', log: ['x=5'] }, n2: L(['x=5']), n3: L(['x=5']), n4: L(['x=5']), n5: L(['x=5']) }, {
    packets: fan('n1', OTHERS('n1'), 'data', 0, 'commit index'),
    stats: [{ label: 'Stored on', value: '5 of 5', tone: 'ok' }, { label: 'Committed', value: 'yes', tone: 'ok' }],
    note: { text: 'slow followers catch up, commit index advances' },
  }),
];

// ---------- Step 5: leader crash and a split vote ----------

const ALL5 = { n2: L(['x=5']), n3: L(['x=5']), n4: L(['x=5']), n5: L(['x=5']) };
const CRASH: FlowState[] = [
  cluster(2, { ...ALL5, n1: { role: 'down', log: ['x=5'] } }, {
    stats: [{ label: 'Leader', value: 'none', tone: 'bad' }, { label: 'Term', value: '2' }],
    note: { text: 'heartbeats stop: followers start timing out', tone: 'bad' },
  }),
  cluster(3, { ...ALL5, n1: { role: 'down' }, n2: { role: 'candidate', log: ['x=5'] }, n4: { role: 'candidate', log: ['x=5'] } }, {
    packets: [p('n2', 'n3', 'req', 0, 'vote?'), p('n2', 'n5', 'req'), p('n4', 'n5', 'req', 0.1), p('n4', 'n3', 'req', 0.1, 'vote?')],
    stats: [{ label: 'Candidates', value: '2', tone: 'bad' }, { label: 'Term', value: '3' }],
    note: { text: 'Node 2 and Node 4 timed out together' },
  }),
  cluster(3, { ...ALL5, n1: { role: 'down' }, n2: { role: 'candidate', log: ['x=5'], badge: { text: '2 votes', tone: 'bad' } }, n4: { role: 'candidate', log: ['x=5'], badge: { text: '2 votes', tone: 'bad' } } }, {
    packets: [p('n3', 'n2', 'res', 0, 'yes'), p('n5', 'n4', 'res', 0, 'yes')],
    stats: [{ label: 'Candidates', value: '2', tone: 'bad' }, { label: 'Term', value: '3' }, votes(2)],
    note: { text: 'split vote: nobody reaches 3, wait a random time', tone: 'bad' },
  }),
  cluster(4, { ...ALL5, n1: { role: 'down' }, n4: { role: 'candidate', log: ['x=5'], badge: { text: 'timed out first', tone: 'accent' } } }, {
    packets: [...fan('n4', ['n2', 'n3', 'n5'], 'req', 0, 'vote? t4'), ...back('n4', ['n2', 'n3', 'n5'], 'res', 0.7)],
    stats: [{ label: 'Candidates', value: '1' }, { label: 'Term', value: '4' }, votes(4)],
  }),
  cluster(4, { ...ALL5, n1: { role: 'down' }, n4: { role: 'leader', log: ['x=5'], badge: { text: 'leader of term 4', tone: 'accent' } } }, {
    packets: fan('n4', ['n2', 'n3', 'n5'], 'data', 0),
    stats: [{ label: 'Leader', value: 'Node 4', tone: 'ok' }, { label: 'Term', value: '4' }, { label: 'Tolerated', value: '1 crash' }],
  }),
];

// ---------- Step 6: an out-of-date candidate cannot win ----------

const SAFE_LOGS = { n2: L(['x=5', 'y=2']), n3: L(['x=5']), n5: L(['x=5', 'y=2']) };
const SAFETY: FlowState[] = [
  cluster(4, { ...SAFE_LOGS, n1: { role: 'down' }, n4: { role: 'leader', log: ['x=5', 'y=2'], badge: { text: 'y=2 committed on 3', tone: 'ok' } } }, {
    stats: [{ label: 'Committed', value: 'x=5, y=2' }, { label: 'Node 3 has', value: 'x=5 only', tone: 'bad' }],
  }),
  cluster(5, { ...SAFE_LOGS, n1: { role: 'down' }, n4: { role: 'down' }, n3: { role: 'candidate', log: ['x=5'], badge: { text: 'missing y=2', tone: 'bad' } } }, {
    packets: fan('n3', ['n2', 'n5'], 'req', 0, 'vote? t5'),
    stats: [{ label: 'Committed', value: 'x=5, y=2' }, { label: 'Node 3 has', value: 'x=5 only', tone: 'bad' }],
    note: { text: 'Node 4 crashed. Node 3 times out first', tone: 'bad' },
  }),
  cluster(5, { ...SAFE_LOGS, n1: { role: 'down' }, n4: { role: 'down' }, n3: { role: 'candidate', log: ['x=5'], badge: { text: '1 vote: loses', tone: 'bad' } } }, {
    packets: back('n3', ['n2', 'n5'], 'bad', 0, 'no: my log is newer'),
    stats: [{ label: 'Committed', value: 'x=5, y=2' }, votes(1)],
    note: { text: 'voters refuse a candidate with an older log', tone: 'bad' },
  }),
  cluster(6, { ...SAFE_LOGS, n1: { role: 'down' }, n4: { role: 'down' }, n5: { role: 'leader', log: ['x=5', 'y=2'], badge: { text: 'up to date: wins', tone: 'ok' } } }, {
    packets: [...fan('n5', ['n2', 'n3'], 'req', 0, 'vote? t6'), ...back('n5', ['n2', 'n3'], 'res', 0.7)],
    stats: [{ label: 'Committed', value: 'kept', tone: 'ok' }, votes(3)],
    note: { text: 'committed entries are never lost', tone: 'ok' },
  }),
];

// ---------- Step 7: cluster sizes ----------

function sized(n: number, down: number): FlowState {
  const majority = Math.floor(n / 2) + 1;
  const alive = n - down;
  const ok = alive >= majority;
  const ids = Array.from({ length: n }, (_, i) => `m${i}`);
  const nodes: FlowNode[] = ids.map((id, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const isDown = i >= n - down;
    return {
      id,
      label: `Node ${i + 1}`,
      kind: 'service',
      x: 3.4 + 2.0 * Math.cos(a),
      y: 1.6 + 1.4 * Math.sin(a),
      status: isDown ? 'down' : i === 0 && ok ? 'active' : 'normal',
      sub: isDown ? 'crashed' : i === 0 && ok ? 'leader' : 'follower',
    };
  });
  const aliveIds = ids.filter((_, i) => i < n - down);
  return {
    nodes,
    links: ok ? aliveIds.slice(1).map((id) => ({ from: 'm0', to: id })) : [],
    packets: ok ? aliveIds.slice(1).map((id) => p('m0', id, 'data')) : [],
    stats: [
      { label: 'Nodes', value: String(n) },
      { label: 'Majority', value: String(majority) },
      { label: 'Tolerates', value: `${n - majority} down`, tone: ok ? 'ok' : 'bad' },
    ],
    note: ok
      ? { text: `${alive} of ${n} alive: majority holds, writes continue`, tone: 'ok' }
      : { text: `${alive} of ${n} alive: no majority, no leader, no writes`, tone: 'bad' },
  };
}

// ---------- Step 8: a partition with the old leader in the minority ----------

const PART_POS: Record<string, { x: number; y: number }> = {
  n1: { x: 1.6, y: 0.7 },
  n5: { x: 1.6, y: 2.5 },
  n2: { x: 3.8, y: 0.4 },
  n3: { x: 4.9, y: 1.6 },
  n4: { x: 3.8, y: 2.8 },
};
const C2: FlowNode = { id: 'c2', label: 'Client 2', kind: 'client', x: 6, y: 1.6, size: 'sm' };
function split(specs: Record<string, Spec>, term: number, extra: Partial<FlowState>, healed = false): FlowState {
  return {
    nodes: [CLIENT, C2, ...IDS.map((id) => node(id, { term, ...specs[id] }, PART_POS[id]))],
    groups: healed
      ? undefined
      : [
          { label: 'minority: 2', nodes: ['n1', 'n5'], tone: 'bad' },
          { label: 'majority: 3', nodes: ['n2', 'n3', 'n4'] },
        ],
    links: [
      { from: 'c', to: 'n1' },
      { from: 'n1', to: 'n5' },
      { from: 'c2', to: 'n3' },
      { from: 'n3', to: 'n2' },
      { from: 'n3', to: 'n4' },
    ],
    ...extra,
  };
}
const PARTITION: FlowState[] = [
  split({ n1: { role: 'leader', term: 4, log: ['x=9'], badge: { text: "can't reach a majority", tone: 'bad' } }, n5: { term: 4, log: ['x=9'] }, n2: { term: 4 }, n3: { term: 4 }, n4: { term: 4 } }, 4, {
    packets: [p('c', 'n1', 'req', 0, 'x=9'), p('n1', 'n5', 'data', 0.6), p('n5', 'n1', 'res', 1.2), p('n1', 'c', 'bad', 1.9, 'no commit')],
    stats: [{ label: 'Minority', value: '2 of 5', tone: 'bad' }, { label: 'x=9', value: 'uncommitted', tone: 'bad' }],
    note: { text: 'old leader stores x=9 on 2 of 5: it can never commit', tone: 'bad' },
  }),
  split({ n1: { role: 'leader', term: 4, log: ['x=9'] }, n5: { term: 4, log: ['x=9'] }, n3: { role: 'leader', badge: { text: 'leader of term 5', tone: 'accent' } } }, 5, {
    packets: [...fan('n3', ['n2', 'n4'], 'req', 0, 'vote? t5'), ...back('n3', ['n2', 'n4'], 'res', 0.7)],
    stats: [{ label: 'Majority', value: '3 of 5', tone: 'ok' }, votes(3)],
    note: { text: 'the majority side elects a new leader' },
  }),
  split({ n1: { role: 'leader', term: 4, log: ['x=9'] }, n5: { term: 4, log: ['x=9'] }, n3: { role: 'leader', log: ['y=1'] }, n2: { log: ['y=1'] }, n4: { log: ['y=1'] } }, 5, {
    packets: [p('c2', 'n3', 'req', 0, 'y=1'), ...fan('n3', ['n2', 'n4'], 'data', 0.6), ...back('n3', ['n2', 'n4'], 'res', 1.2), p('n3', 'c2', 'res', 1.9, 'ok')],
    stats: [{ label: 'Majority', value: '3 of 5', tone: 'ok' }, { label: 'y=1', value: 'committed', tone: 'ok' }],
    note: { text: 'writes continue where the majority is', tone: 'ok' },
  }),
  split(
    { n1: { term: 5, log: ['y=1'], badge: { text: 'sees term 5: steps down', tone: 'accent' } }, n5: { log: ['y=1'] }, n3: { role: 'leader', log: ['y=1'] }, n2: { log: ['y=1'] }, n4: { log: ['y=1'] } },
    5,
    {
      links: [
        { from: 'c2', to: 'n3' },
        ...['n1', 'n2', 'n4', 'n5'].map((id) => ({ from: 'n3', to: id })),
      ],
      packets: fan('n3', ['n1', 'n5'], 'data', 0, 'AppendEntries'),
      stats: [{ label: 'Network', value: 'healed', tone: 'ok' }, { label: 'Leaders', value: '1', tone: 'ok' }],
    },
    true,
  ),
];

const RECAP = cluster(
  2,
  { n1: { role: 'leader', log: ['x=5', 'y=2'] }, n2: L(['x=5', 'y=2']), n3: L(['x=5', 'y=2']), n4: L(['x=5', 'y=2']), n5: L(['x=5', 'y=2']) },
  {
    packets: fan('n1', OTHERS('n1'), 'data', 0),
    stats: [
      { label: 'Writes', value: 'linearizable', tone: 'ok' },
      { label: 'Cost', value: 'majority RTT' },
      { label: 'Tolerates', value: '2 crashes' },
    ],
  },
);

export default defineLesson('flow', {
  slug: 'raft',
  objectives: [
    { text: 'What consensus is for and why a majority matters', step: 1 },
    { text: 'How Raft elects a leader with terms and random timeouts', step: 3 },
    { text: 'How an entry is replicated and committed', step: 4 },
    { text: 'Why committed entries survive leader changes', step: 6 },
    { text: 'Pick a cluster size and know the cost', step: 8 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Replicas that do not agree',
      tag: 'problem',
      body: [
        'Two clients write different values of `x` to different nodes. Each side copies its value around, and the cluster now holds two answers.',
        '**Consensus** lets a group agree on a value, or a log of values, even when nodes crash and messages are delayed.',
      ],
      keyIdea: 'Consensus is the base of leader election, config stores like etcd, and strongly consistent databases.',
      frames: [{ state: DIVERGE }],
    },
    {
      label: 'Roles, terms',
      title: 'Followers wait, then one runs',
      tag: 'concept',
      body: [
        'Every node is a **follower**, **candidate** or **leader**. Time is split into **terms**, with at most one leader per term.',
        'A follower that hears nothing for its **election timeout** becomes a candidate. Timeouts are random, typically 150 to 300 ms, so one node usually fires first.',
      ],
      keyIdea: 'Randomized timeouts make it likely that a single candidate starts each election.',
      frames: [0, 80, 140, 160].map((t, i) => ({ state: timers(t), hold: i === 3 ? 1800 : 1000 })),
    },
    {
      label: 'Election',
      title: 'Win a majority of votes',
      tag: 'technique',
      body: [
        'The candidate increments the term, votes for itself and sends **RequestVote** to everyone.',
        'Each node votes once per term. With a **majority** (3 of 5), the candidate becomes leader and starts sending heartbeats.',
      ],
      keyIdea: 'Majority votes guarantee at most one leader per term, because two majorities always overlap.',
      frames: ELECTION.map((state, i) => ({ state, hold: i === 2 ? 1800 : 1600 })),
    },
    {
      label: 'Replicate',
      title: 'Commit once a majority stores it',
      tag: 'technique',
      body: [
        'The client sends `x = 5` to the leader. It appends to its log and sends **AppendEntries** to followers.',
        'Once a majority has stored the entry (leader plus two followers), it is **committed**: the leader applies it and answers. The commit index reaches the rest later.',
      ],
      keyIdea: 'Commit means "on a majority". Slow followers do not slow down the write.',
      frames: REPL.map((state, i) => ({ state, hold: i === 0 ? 1400 : 1600 })),
    },
    {
      label: 'Split vote',
      title: 'Leader crash and a split vote',
      tag: 'technique',
      body: [
        'The leader crashes and heartbeats stop. Two followers time out together, both become candidates for term 3, and the votes split 2 to 2.',
        'Nobody reaches 3, so each waits a new random timeout. Node 4 fires first in term 4 and wins.',
      ],
      keyIdea: 'A split vote just costs one more round. Randomness breaks the tie.',
      frames: CRASH.map((state, i) => ({ state, hold: i === 3 ? 2000 : 1600 })),
    },
    {
      label: 'Safety',
      title: 'An out-of-date log cannot win',
      tag: 'concept',
      body: [
        '`y=2` is committed on three nodes. Node 3 missed it, then times out and asks for votes.',
        'A candidate only wins if its log is at least as up to date as a majority. Voters with `y=2` refuse, and an up-to-date node wins instead.',
      ],
      keyIdea: 'Any majority of voters includes a node with every committed entry, so committed entries are never lost.',
      frames: SAFETY.map((state, i) => ({ state, hold: i === 3 ? 2000 : 1600 })),
    },
    {
      label: 'Cluster size',
      title: 'Odd sizes, small groups',
      tag: 'trade-off',
      body: [
        'A cluster of n tolerates the failures that still leave a majority: 3 tolerate 1, 5 tolerate 2, 7 tolerate 3. Four tolerate only 1, no better than 3.',
        'More nodes means more acks per write, so groups stay small. To scale, shard data into many small groups.',
      ],
      keyIdea: 'Use 3 or 5 nodes. CockroachDB and TiDB run one Raft group per data range.',
      frames: [
        { state: sized(3, 1), hold: 1700 },
        { state: sized(4, 1), hold: 1700 },
        { state: sized(4, 2), hold: 1900 },
        { state: sized(5, 2), hold: 1700 },
      ],
    },
    {
      label: 'Partitions',
      title: 'No majority, no writes',
      tag: 'in practice',
      body: [
        'A partition leaves the old leader with only 2 of 5. It can store `x=9` but never commit it.',
        'The majority side elects a leader for term 5 and keeps going. When the network heals, the old leader sees the higher term and steps down.',
      ],
      keyIdea: 'Consensus gives linearizable writes at the cost of a majority round trip, and unavailability without a majority.',
      frames: PARTITION.map((state, i) => ({ state, hold: i === 0 || i === 2 ? 2800 : 1800 })),
    },
    {
      label: 'Recap',
      title: 'Raft in one page',
      tag: 'recap',
      body: [
        '- **Election:** a random timeout makes a candidate, a majority of votes makes a leader, one leader per term.',
        '- **Replication:** commit once a majority has the entry.',
        '- **Safety:** only an up-to-date log can win, so commits survive.',
        '- **Reads:** follower reads can be stale. Linearizable reads go through the leader.',
        '- **Limits:** crashes only, not malicious nodes. Cross-region groups pay cross-region latency per write.',
      ],
      keyIdea: 'Raft splits consensus into leader election, log replication and safety.',
      frames: [{ state: RECAP }],
    },
  ],
});
