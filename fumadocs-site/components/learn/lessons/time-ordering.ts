import { defineLesson } from '../define';
import type { PaintTone } from '../engines/common';
import { patch } from '../engines/layouts';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Note, Stat } from '../types';

/*
 * Lamport and vector clock frames come from running both clocks over the same list of events,
 * and conflict labels come from the notes' own `compare` function.
 */

type Beat = { add?: SeqMessage[]; actors?: Record<string, Partial<SeqActor>>; note?: Note; stats?: Stat[]; hold?: number };

function play(actors: SeqActor[], beats: Beat[], start: SeqMessage[] = []): Frame<SeqState>[] {
  const msgs = [...start];
  let cast = actors;
  let stats: Stat[] | undefined;
  return beats.map((b) => {
    const add = b.add ?? [];
    msgs.push(...add);
    cast = patch(cast, b.actors ?? {});
    stats = b.stats ?? stats;
    return {
      hold: b.hold ?? 1000 + add.length * 800,
      state: { actors: cast, messages: [...msgs], fresh: add.length, note: b.note, stats },
    };
  });
}

const self = (on: string, label: string, tone: PaintTone = 'neutral'): SeqMessage => ({ from: on, to: on, label, tone });

// ---------- Logical clocks: one run of events, two kinds of clock ----------

const NODES = ['A', 'B', 'C'] as const;
type NodeId = (typeof NODES)[number];
const CLOCK_ACTORS: SeqActor[] = NODES.map((id) => ({ id, label: `Node ${id}`, kind: 'service' }));

type Ev = { kind: 'local'; p: NodeId } | { kind: 'send'; p: NodeId; to: NodeId };
/** A ticks, A sends m1 to B, C ticks on its own, B ticks, B sends m2 to C, A ticks again. */
const EVENTS: Ev[] = [
  { kind: 'local', p: 'A' },
  { kind: 'send', p: 'A', to: 'B' },
  { kind: 'local', p: 'C' },
  { kind: 'local', p: 'B' },
  { kind: 'send', p: 'B', to: 'C' },
  { kind: 'local', p: 'A' },
];

type Run = { beats: { msgs: SeqMessage[]; clocks: Record<NodeId, string>; rule: string }[] };

function lamport(): Run {
  const c: Record<NodeId, number> = { A: 0, B: 0, C: 0 };
  const snap = () => ({ A: String(c.A), B: String(c.B), C: String(c.C) });
  let m = 0;
  const beats: Run['beats'] = [];
  for (const e of EVENTS) {
    if (e.kind === 'local') {
      c[e.p]++;
      beats.push({ msgs: [self(e.p, `L=${c[e.p]}`, 'violet')], clocks: snap(), rule: `local event on ${e.p}: increment` });
    } else {
      c[e.p]++;
      m++;
      const sent = c[e.p];
      const before = c[e.to];
      c[e.to] = Math.max(before, sent) + 1;
      beats.push({
        msgs: [
          { from: e.p, to: e.to, label: `m${m} carries L=${sent}` },
          self(e.to, `L=${c[e.to]}`, 'violet'),
        ],
        clocks: snap(),
        rule: `${e.to} receives: max(${before}, ${sent}) + 1 = ${c[e.to]}`,
      });
    }
  }
  return { beats };
}

function vector(): Run {
  const idx: Record<NodeId, number> = { A: 0, B: 1, C: 2 };
  const v: Record<NodeId, number[]> = { A: [0, 0, 0], B: [0, 0, 0], C: [0, 0, 0] };
  const fmt = (x: number[]) => `[${x.join(',')}]`;
  const snap = () => ({ A: fmt(v.A), B: fmt(v.B), C: fmt(v.C) });
  let m = 0;
  const beats: Run['beats'] = [];
  for (const e of EVENTS) {
    if (e.kind === 'local') {
      v[e.p][idx[e.p]]++;
      beats.push({ msgs: [self(e.p, fmt(v[e.p]), 'violet')], clocks: snap(), rule: `${e.p} bumps its own entry` });
    } else {
      v[e.p][idx[e.p]]++;
      m++;
      const sent = [...v[e.p]];
      v[e.to] = v[e.to].map((x, i) => Math.max(x, sent[i]));
      v[e.to][idx[e.to]]++;
      beats.push({
        msgs: [
          { from: e.p, to: e.to, label: `m${m} carries ${fmt(sent)}` },
          self(e.to, fmt(v[e.to]), 'violet'),
        ],
        clocks: snap(),
        rule: `${e.to} takes the max of each entry, then bumps its own`,
      });
    }
  }
  return { beats };
}

/** The compare function from the notes. */
function compare(a: Record<string, number>, b: Record<string, number>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let less = false;
  let greater = false;
  for (const k of keys) {
    const x = a[k] || 0;
    const y = b[k] || 0;
    if (x < y) less = true;
    if (x > y) greater = true;
  }
  if (less && greater) return 'concurrent';
  if (less) return 'before';
  if (greater) return 'after';
  return 'equal';
}

const LAMPORT = lamport();
const VECTOR = vector();

function clockFrames(run: Run, label: string, upto = run.beats.length): Frame<SeqState>[] {
  const frames: Frame<SeqState>[] = [];
  const msgs: SeqMessage[] = [];
  run.beats.slice(0, upto).forEach((b, i) => {
    msgs.push(...b.msgs);
    frames.push({
      hold: 900 + b.msgs.length * 850,
      state: {
        actors: CLOCK_ACTORS.map((a) => ({ ...a, badge: { text: `${label} ${b.clocks[a.id as NodeId]}`, tone: b.msgs.some((m) => m.to === a.id) ? 'accent' : undefined } })),
        messages: [...msgs],
        fresh: b.msgs.length,
        stats: [
          { label: 'Event', value: `${i + 1} of ${run.beats.length}` },
          { label: 'Clock', value: label === 'L' ? 'Lamport' : 'vector' },
        ],
        note: { text: run.beats[i].rule },
      },
    });
  });
  return frames;
}

const allMsgs = (run: Run) => run.beats.flatMap((b) => b.msgs);
const finalClocks = (run: Run) => run.beats[run.beats.length - 1].clocks;

/** Re-colour two of the self events to compare them side by side. */
function highlight(run: Run, pick: (m: SeqMessage, i: number) => boolean, tone: PaintTone): SeqMessage[] {
  return allMsgs(run).map((m, i) => (pick(m, i) ? { ...m, tone } : m));
}

// Indexes into the flat message list: C's lone local event and A's last local event.
const C_LOCAL = allMsgs(LAMPORT).findIndex((m) => m.from === 'C' && m.to === 'C');
const A_LAST = allMsgs(LAMPORT).length - 1;
const L_C = allMsgs(LAMPORT)[C_LOCAL].label;
const L_A = allMsgs(LAMPORT)[A_LAST].label;
const V_C = allMsgs(VECTOR)[C_LOCAL].label;
const V_A = allMsgs(VECTOR)[A_LAST].label;
const parseVec = (s: string): Record<string, number> => {
  const xs = s.replace(/[[\]]/g, '').split(',').map(Number);
  return { A: xs[0], B: xs[1], C: xs[2] };
};
const VERDICT = compare(parseVec(V_C), parseVec(V_A));

const lamportCompare: SeqState = {
  actors: CLOCK_ACTORS.map((a) => ({ ...a, badge: { text: `L ${finalClocks(LAMPORT)[a.id as NodeId]}` } })),
  messages: highlight(LAMPORT, (_, i) => i === C_LOCAL || i === A_LAST, 'bad'),
  fresh: 0,
  stats: [
    { label: 'C event', value: L_C },
    { label: 'A event', value: L_A },
    { label: 'Related?', value: 'no', tone: 'bad' },
  ],
  note: { text: `${L_C} < ${L_A}, yet neither event caused the other`, tone: 'bad' },
};

const vectorCompare: SeqState = {
  actors: CLOCK_ACTORS.map((a) => ({ ...a, badge: { text: `V ${finalClocks(VECTOR)[a.id as NodeId]}` } })),
  messages: highlight(VECTOR, (_, i) => i === C_LOCAL || i === A_LAST, 'accent'),
  fresh: 0,
  stats: [
    { label: 'C event', value: V_C },
    { label: 'A event', value: V_A },
    { label: 'compare', value: VERDICT, tone: 'ok' },
  ],
  note: { text: 'neither vector dominates: concurrent, detected', tone: 'ok' },
};

// ---------- Conflicts in a Dynamo-style store ----------

const STORE: SeqActor[] = [
  { id: 'c1', label: 'Client 1', kind: 'client' },
  { id: 's', label: 'Store', kind: 'db' },
  { id: 'c2', label: 'Client 2', kind: 'client' },
];
const V1 = { A: 2, B: 1 };
const V2 = { A: 1, B: 2 };
const MERGED = { A: 2, B: 2 };
const vs = (v: Record<string, number>) => `{${Object.entries(v).map(([k, x]) => `${k}:${x}`).join(',')}}`;

// ---------- Wall clock trouble ----------

const LWW: SeqActor[] = [
  { id: 'a', label: 'Node A', kind: 'service' },
  { id: 's', label: 'Store', kind: 'db' },
  { id: 'b', label: 'Node B', kind: 'service' },
];
const PHYS: SeqActor[] = [
  { id: 'a', label: 'Node A', kind: 'service' },
  { id: 'b', label: 'Node B', kind: 'service' },
  { id: 'x', label: 'Other node', kind: 'service', status: 'dim' },
];
const TT: SeqActor[] = [
  { id: 'c', label: 'Client', kind: 'client' },
  { id: 'l', label: 'Spanner leader', kind: 'db' },
  { id: 'r', label: 'Reader', kind: 'client' },
];
const LOG: SeqActor[] = [
  { id: 'wa', label: 'Writer A', kind: 'service' },
  { id: 'wb', label: 'Writer B', kind: 'service' },
  { id: 'p', label: 'Partition log', kind: 'queue' },
  { id: 'c', label: 'Consumer', kind: 'worker' },
];

export default defineLesson('sequence', {
  slug: 'time-ordering',
  objectives: [
    { text: 'Why wall clocks are unsafe for ordering', step: 2 },
    { text: 'Run a Lamport clock and know its limit', step: 4 },
    { text: 'Detect concurrent writes with vector clocks', step: 6 },
    { text: 'Where HLC and TrueTime fit, and what to say in an interview', step: 8 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Last write wins, by the wrong clock',
      tag: 'problem',
      body: [
        'The store keeps whichever write has the later timestamp. Node B writes after Node A, but B\'s clock runs 50 ms behind.',
        'B\'s newer write carries the smaller timestamp and is silently dropped.',
      ],
      keyIdea: 'Last-write-wins by wall clock can silently lose a newer write when a node\'s clock runs behind.',
      frames: play(LWW, [
        {
          add: [{ from: 'a', to: 's', label: 'x=1 @ t=100' }, self('s', 'keep x=1')],
          actors: { b: { badge: { text: 'clock 50 ms behind', tone: 'bad' } } },
          stats: [{ label: 'Rule', value: 'last write wins' }, { label: 'Stored', value: 'x=1' }],
        },
        { add: [{ from: 'b', to: 's', label: 'x=2 @ t=90 (later)' }], hold: 1600 },
        {
          add: [self('s', '90 < 100: drop x=2', 'bad')],
          stats: [{ label: 'Rule', value: 'last write wins' }, { label: 'Stored', value: 'x=1', tone: 'bad' }, { label: 'Lost', value: 'x=2', tone: 'bad' }],
          note: { text: 'the newer write was silently dropped', tone: 'bad' },
        },
      ]),
    },
    {
      label: 'Physical clocks',
      title: 'Wall clocks jump, monotonic clocks do not travel',
      tag: 'concept',
      body: [
        'A **wall clock** can jump forward or backward: NTP corrections, leap seconds, a manual change. Skew of milliseconds to hundreds of milliseconds between machines is normal.',
        'A **monotonic clock** only moves forward, but only on one machine. Use it for durations and timeouts.',
      ],
      keyIdea: 'Wall clocks are fine for log timestamps and dangerous for ordering and expiry.',
      frames: play(PHYS, [
        {
          add: [self('a', 'wall 12:00:00.100'), self('b', 'wall 12:00:00.050')],
          actors: { b: { badge: { text: 'skew 50 ms', tone: 'bad' } } },
          stats: [{ label: 'Skew', value: 'normal', hint: 'ms to 100s of ms' }],
        },
        {
          add: [self('a', 'NTP: jump back 30 ms', 'bad')],
          actors: { a: { badge: { text: 'time went backwards', tone: 'bad' } } },
          note: { text: 'wall clocks can move backwards', tone: 'bad' },
        },
        {
          add: [self('a', 'monotonic: +12 ms', 'ok')],
          actors: { a: { badge: { text: 'durations: safe', tone: 'ok' } } },
          stats: [{ label: 'Skew', value: 'normal' }, { label: 'Monotonic', value: 'one machine' }],
          note: { text: 'monotonic is meaningless across machines', tone: 'accent' },
        },
      ]),
    },
    {
      label: 'Lamport',
      title: 'A Lamport clock is one counter',
      tag: 'technique',
      body: [
        'Each node keeps a counter. On a local event, **increment**. On send, **attach** the counter. On receive, set it to `max(local, received) + 1`.',
        'Watch each receive jump past the sender\'s value.',
      ],
      keyIdea: 'If event A happened before B, then L(A) < L(B).',
      frames: clockFrames(LAMPORT, 'L'),
    },
    {
      label: 'Its limit',
      title: 'Ordered, but blind to concurrency',
      tag: 'trade-off',
      body: [
        'C\'s first event and A\'s last event never exchanged a message, so they are concurrent. Lamport still gives them different numbers.',
        'A smaller number does not mean "happened before". You get a consistent order, not causality detection.',
      ],
      keyIdea: 'L(A) < L(B) does not imply A happened before B.',
      frames: [{ state: { ...lamportCompare, fresh: 0 }, hold: 2600 }],
    },
    {
      label: 'Vector clocks',
      title: 'One counter per node',
      tag: 'concept',
      body: [
        'A **vector clock** keeps one counter for every node. A node bumps its own entry, and on receive takes the max of each entry first.',
        'Same events as before, but now each timestamp remembers what it has seen from everyone.',
      ],
      keyIdea: 'Two versions are concurrent if neither vector dominates the other.',
      frames: [...clockFrames(VECTOR, 'V').slice(1), { state: vectorCompare, hold: 2600 }],
    },
    {
      label: 'Conflicts',
      title: 'Detect conflicting writes',
      tag: 'technique',
      body: [
        'Dynamo-style stores attach a vector to every version. `compare` returns before, after, equal or concurrent.',
        'Before: replace the old version. **Concurrent:** a real conflict, so hand both versions back to the client to merge.',
      ],
      keyIdea: 'Vector clocks turn "which write wins?" into "are these two writes related at all?".',
      frames: play(STORE, [
        {
          add: [{ from: 'c1', to: 's', label: 'put {A:1}' }, { from: 'c1', to: 's', label: 'put {A:2}' }, self('s', `${compare({ A: 1 }, { A: 2 })}: replace`, 'ok')],
          stats: [{ label: 'Versions', value: '1' }],
        },
        {
          add: [{ from: 'c1', to: 's', label: `put ${vs(V1)}` }, { from: 'c2', to: 's', label: `put ${vs(V2)}` }],
          stats: [{ label: 'Versions', value: '2', tone: 'bad' }],
        },
        {
          add: [self('s', `${compare(V1, V2)}: keep both`, 'bad')],
          actors: { s: { badge: { text: 'real conflict', tone: 'bad' } } },
          note: { text: 'neither vector dominates the other', tone: 'bad' },
          hold: 2000,
        },
        {
          add: [{ from: 's', to: 'c1', label: 'both versions: merge', dashed: true }, { from: 'c1', to: 's', label: `put merged ${vs(MERGED)}` }],
          hold: 2400,
        },
        {
          add: [self('s', `${compare(MERGED, V2)}: replace both`, 'ok')],
          actors: { s: { badge: { text: 'resolved', tone: 'ok' } } },
          stats: [{ label: 'Versions', value: '1', tone: 'ok' }],
        },
      ]),
    },
    {
      label: 'HLC, TrueTime',
      title: 'Clocks that respect causality',
      tag: 'in practice',
      body: [
        'A **hybrid logical clock** pairs physical time with a logical counter: close to real time, still causal. CockroachDB uses it.',
        '**TrueTime** in Spanner returns an interval `[earliest, latest]`. A commit waits out the uncertainty before its timestamp becomes visible, which gives external consistency.',
      ],
      keyIdea: 'Bounded uncertainty plus commit wait turns physical time into a safe ordering, at the cost of waiting.',
      frames: play(TT, [
        { add: [{ from: 'c', to: 'l', label: 'commit txn' }, self('l', 'TT.now = [e, l]', 'violet')], stats: [{ label: 'Clocks', value: 'GPS + atomic' }] },
        { add: [self('l', 'commit wait: until > l', 'data')], actors: { l: { badge: { text: 'waits out uncertainty', tone: 'accent' } } }, hold: 2000 },
        {
          add: [{ from: 'l', to: 'c', label: 'committed', dashed: true }, { from: 'r', to: 'l', label: 'read' }, { from: 'l', to: 'r', label: 'sees the commit', dashed: true }],
          stats: [{ label: 'Clocks', value: 'GPS + atomic' }, { label: 'Result', value: 'external', tone: 'ok', hint: 'consistency' }],
          note: { text: 'commit wait yields external consistency', tone: 'ok' },
        },
      ]),
    },
    {
      label: 'Recap',
      title: 'Order with a log, detect with versions',
      tag: 'recap',
      body: [
        '- **Wall clocks:** jump and skew. Fine for logs, not for ordering.',
        '- **Monotonic clocks:** durations and timeouts on one machine.',
        '- **Lamport:** consistent order, cannot detect concurrency.',
        '- **Vector clocks:** detect concurrent writes, merge them.',
        '- **Interview line:** order by a per-partition sequence number or log offset, detect conflicts with versions or vector clocks.',
      ],
      keyIdea: '"I do not trust wall clocks for ordering across machines."',
      frames: play(LOG, [
        {
          add: [
            { from: 'wa', to: 'p', label: 'order created' },
            { from: 'p', to: 'wa', label: 'offset 41', dashed: true },
            { from: 'wb', to: 'p', label: 'order paid' },
            { from: 'p', to: 'wb', label: 'offset 42', dashed: true },
            { from: 'p', to: 'c', label: '41, then 42', tone: 'data' },
          ],
          stats: [
            { label: 'Order by', value: 'log offset', tone: 'ok' },
            { label: 'Conflicts', value: 'vector clocks' },
          ],
          note: { text: 'the log offset is the order, no clocks needed', tone: 'ok' },
          hold: 5000,
        },
      ]),
    },
  ],
});
