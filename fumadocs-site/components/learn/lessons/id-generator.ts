import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

const BITS = { from: 0, to: 128, unit: ' bit', ticks: [0, 32, 64, 96, 128] };
const SF = { from: 0, to: 64, unit: ' bit', ticks: [0, 16, 32, 48, 64] };

// Step 1: the usual answers and what each costs.
const BASIC: TimelineState = {
  ...BITS,
  lanes: [
    { label: 'DB auto-increment', bars: [{ id: 'ai', from: 0, to: 64, label: 'ordered, one writer', tone: 'bad' }] },
    { label: 'Ticket server', bars: [{ id: 'ts', from: 0, to: 64, label: 'ordered, central SPOF', tone: 'bad' }] },
    { label: 'UUIDv4', bars: [{ id: 'u4', from: 0, to: 128, label: '128 bit, random, no order', tone: 'bad' }] },
  ],
  stats: [{ label: 'Need', value: 'unique, sorted' }, { label: 'Budget', value: '64 bit' }, { label: 'No', value: 'central writer', tone: 'bad' }],
  note: { text: 'each answer fails one requirement', tone: 'bad' },
};
const MODERN: TimelineState = {
  ...BITS,
  lanes: [
    { label: 'UUIDv7', bars: [{ id: 'u7', from: 0, to: 128, label: '128 bit, ms ordered, standard', tone: 'ok' }] },
    { label: 'ULID', bars: [{ id: 'ul', from: 0, to: 128, label: '128 bit, sortable string', tone: 'info' }] },
    { label: 'Snowflake', bars: [{ id: 'sf', from: 0, to: 64, label: '64 bit, ms ordered', tone: 'accent' }] },
  ],
  stats: [{ label: 'If 128 bit is ok', value: 'UUIDv7', tone: 'ok' }, { label: 'If 64 bit needed', value: 'Snowflake' }, { label: 'Coordination', value: 'none per id', tone: 'ok' }],
  note: { text: 'no round trip per id, ordered by time', tone: 'accent' },
};

// Step 2: the 64-bit layout, each field highlighted in turn.
type Field = 'all' | 'sign' | 'time' | 'machine' | 'seq';
const layout = (focus: Field): TimelineState => {
  const bar = (id: Field, from: number, to: number, label: string, tone: TimelineBar['tone']): TimelineBar => ({ id, from, to, label, tone, state: focus === 'all' || focus === id ? 'normal' : 'dim' });
  const info: Record<Field, TimelineState['stats']> = {
    all: [{ label: 'Total', value: '64 bit' }, { label: 'Fits', value: 'a BIGINT', tone: 'ok' }, { label: 'Sorts by', value: 'time first' }],
    sign: [{ label: 'Sign bit', value: 'always 0' }, { label: 'Keeps', value: 'a positive int' }, { label: 'Width', value: '1 bit' }],
    time: [{ label: 'Field', value: 'timestamp' }, { label: 'Unit', value: 'ms since epoch' }, { label: 'Lasts', value: '~69 years', tone: 'ok' }],
    machine: [{ label: 'Field', value: 'machine id' }, { label: 'Nodes', value: '1,024' }, { label: 'Must be', value: 'unique each', tone: 'bad' }],
    seq: [{ label: 'Field', value: 'sequence' }, { label: 'Per ms per node', value: '4,096' }, { label: 'Resets', value: 'each ms' }],
  };
  return {
    ...SF,
    lanes: [
      {
        label: 'Snowflake id',
        bars: [bar('sign', 0, 1, '', 'neutral'), bar('time', 1, 42, '41 bit timestamp', 'info'), bar('machine', 42, 52, '10 bit node', 'violet'), bar('seq', 52, 64, '12 bit seq', 'accent')],
      },
    ],
    stats: info[focus],
    note: { text: 'time in the high bits keeps ids roughly sorted', tone: 'accent' },
  };
};

// Step 3: throughput math.
const MATH: TimelineState = {
  ...SF,
  lanes: [
    { label: 'Per node', bars: [{ id: 'pn', from: 52, to: 64, label: '4,096 / ms', tone: 'accent' }] },
    { label: 'Fleet of 1,024', bars: [{ id: 'fl', from: 42, to: 64, label: '4.2M ids / ms', tone: 'ok' }] },
    { label: 'Lifetime', bars: [{ id: 'lf', from: 1, to: 42, label: '69 years of ms', tone: 'info' }] },
  ],
  stats: [{ label: 'Per node', value: '4M ids / s', tone: 'ok' }, { label: 'Nodes', value: '1,024' }, { label: 'Epoch', value: 'custom start' }],
  note: { text: 'the requirement was tens of thousands per second: plenty of room', tone: 'accent' },
};

// Step 4: the clock goes backwards.
const MS = { from: 0, to: 10, unit: ' ms', ticks: [0, 2, 4, 6, 8, 10] };
const issued = (extra: TimelineBar[] = [], markers: TimelineState['markers'] = [], stats?: TimelineState['stats'], note?: TimelineState['note']): TimelineState => ({
  ...MS,
  lanes: [
    { label: 'ids issued', bars: [{ id: 'a', from: 2, to: 3, label: 't=2', tone: 'ok' }, { id: 'b', from: 3, to: 4, label: 't=3', tone: 'ok' }, { id: 'c', from: 4, to: 5, label: 't=4', tone: 'ok' }, ...extra] },
  ],
  markers,
  stats,
  note,
});
const CLOCK_BAD = issued(
  [{ id: 'd', from: 3, to: 4, label: 'dup t=3', tone: 'bad', state: 'bad' }],
  [{ at: 5, label: 'NTP steps back', tone: 'bad' }],
  [{ label: 'Clock jumped', value: '5 to 3 ms', tone: 'bad' }, { label: 'Next id', value: 'reuses t=3', tone: 'bad' }, { label: 'Result', value: 'collision', tone: 'bad' }],
  { text: 'an old timestamp plus the same node and sequence is a duplicate', tone: 'bad' },
);
const CLOCK_FIX = issued(
  [{ id: 'w', from: 5, to: 6, label: 'wait', tone: 'accent' }, { id: 'e', from: 6, to: 7, label: 't=6', tone: 'ok' }],
  [{ at: 5, label: 'clock back: refuse', tone: 'accent' }],
  [{ label: 'Policy', value: 'never go back', tone: 'ok' }, { label: 'On regress', value: 'refuse or wait' }, { label: 'Track', value: 'last timestamp' }],
  { text: 'keep the last timestamp and refuse to issue from a smaller one', tone: 'accent' },
);

// Step 5: machine ids and ordering.
const FLEET: TimelineState = {
  from: 0,
  to: 10,
  unit: ' min',
  ticks: [0, 2, 4, 6, 8, 10],
  lanes: [
    { label: 'container A', bars: [{ id: 'la', from: 0, to: 4, label: 'lease id 7', tone: 'violet' }] },
    { label: 'container B', bars: [{ id: 'lb', from: 0, to: 10, label: 'lease id 8', tone: 'violet' }] },
    { label: 'container C', bars: [{ id: 'lc', from: 4.5, to: 10, label: 'lease id 7 (reused)', tone: 'violet' }] },
  ],
  stats: [{ label: 'Source', value: 'lease store' }, { label: 'Id 7 reused', value: 'after expiry', tone: 'ok' }, { label: 'Same id twice', value: 'collides', tone: 'bad' }],
  note: { text: 'in a dynamic fleet, lease machine ids and let them expire', tone: 'accent' },
};

export default defineLesson('timeline', {
  slug: 'id-generator',
  objectives: [
    { text: 'Why the common options fail one requirement each', step: 1 },
    { text: 'The 41 + 10 + 12 bit layout of a Snowflake id', step: 2 },
    { text: 'How many ids per second the layout allows', step: 3 },
    { text: 'The hard parts: clock regress and machine ids', step: 4 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Unique, sortable, no bottleneck',
      tag: 'problem',
      body: [
        'Many machines must mint ids that are globally unique, roughly sorted by time, and ideally fit in 64 bits, at tens of thousands per second with no central bottleneck.',
        'A single auto-increment is one writer. A ticket server is a single point of failure. A random UUIDv4 is 128 bits and has no order, which hurts B-tree locality.',
      ],
      keyIdea: 'Time-ordered ids keep database indexes and pagination happy. The question is how to get them without coordination.',
      frames: [{ state: BASIC }],
    },
    {
      label: 'Options',
      title: 'Time-ordered ids with no round trip',
      tag: 'concept',
      body: [
        '**UUIDv7** (RFC 9562) is 128 bits, millisecond ordered, standard and needs no coordination. It is the simplest good answer today.',
        '**Snowflake** packs the same idea into 64 bits. It is the classic interview answer because of the 64-bit budget.',
      ],
      keyIdea: 'If 128 bits and a standard are acceptable, take UUIDv7. If you need 64, build a Snowflake.',
      frames: [{ state: MODERN }],
    },
    {
      label: 'Bit layout',
      title: 'Snowflake: 1 + 41 + 10 + 12',
      tag: 'technique',
      body: [
        'One sign bit, **41 bits** of milliseconds since a custom epoch, **10 bits** of machine id and a **12-bit** sequence that resets every millisecond.',
        'Because time sits in the high bits, ids from one node are increasing, and ids across nodes are ordered to the millisecond.',
      ],
      keyIdea: '`(now - epoch) << 22 | machine << 12 | sequence`. No shared state at generation time.',
      frames: (['all', 'sign', 'time', 'machine', 'seq'] as Field[]).map((f) => ({ state: layout(f), hold: f === 'all' ? 1800 : 2000 })),
    },
    {
      label: 'Capacity',
      title: 'How much room is there?',
      tag: 'technique',
      body: [
        '41 bits of milliseconds last about **69 years**. 10 bits allow **1,024** nodes. 12 bits allow **4,096** ids per millisecond per node.',
        'That is about 4 million ids per second on one node, far above the tens of thousands you need.',
      ],
      keyIdea: 'Do the arithmetic out loud in an interview. The bits are a budget with a clear lifetime.',
      frames: [{ state: MATH }],
    },
    {
      label: 'Clock regress',
      title: 'When the clock goes backwards',
      tag: 'trade-off',
      body: [
        'An NTP correction can move the clock back. The next id would reuse an old timestamp with the same node and sequence, which is a duplicate.',
        'Remember the last timestamp. If now is smaller, **refuse to issue** or wait until the clock catches up. Never issue from a smaller timestamp.',
      ],
      keyIdea: 'Also handle a restart inside the same millisecond: persist the last timestamp or wait out a safe window on startup.',
      frames: [{ state: CLOCK_BAD, hold: 3000 }, { state: CLOCK_FIX }],
    },
    {
      label: 'Machine ids',
      title: 'Two nodes, one id is a collision',
      tag: 'in practice',
      body: [
        'Assign machine ids from static config, or from a **lease** in ZooKeeper or etcd when containers come and go. Two live nodes with the same id will collide.',
        'Ordering is only approximate across nodes: ids in the same millisecond order by machine id, not causality. For causal order use per-entity sequence numbers or a log.',
      ],
      keyIdea: 'Ids leak creation time and rough volume. Do not use them as secrets.',
      frames: [{ state: FLEET }],
    },
    {
      label: 'Recap',
      title: 'The decision',
      tag: 'recap',
      body: [
        '- **Need:** globally unique, time sortable, ideally 64 bit, no central bottleneck.',
        '- **Simple:** UUIDv7 when 128 bits and a standard are fine.',
        '- **Classic:** Snowflake with 41 bit time, 10 bit node, 12 bit sequence.',
        '- **Hard parts:** monotonic clock guard, unique machine ids, approximate cross-node order.',
        '- **Avoid:** auto-increment at scale, UUIDv4 as a primary key, ids as secrets.',
      ],
      keyIdea: 'Pick the simplest id that meets the requirements, then say what each bit is for.',
      frames: [{ state: layout('all') }],
    },
  ],
});
