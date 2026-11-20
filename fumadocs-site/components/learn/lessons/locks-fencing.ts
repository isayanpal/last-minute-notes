import { defineLesson } from '../define';
import { patch } from '../engines/layouts';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Note, Stat } from '../types';

/*
 * Two clients, a lock service and the storage they protect. Beats reveal messages one or two at a time.
 */

type Beat = { add?: SeqMessage[]; actors?: Record<string, Partial<SeqActor>>; note?: Note; stats?: Stat[]; hold?: number };

function play(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const msgs: SeqMessage[] = [];
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

const req = (from: string, to: string, label: string): SeqMessage => ({ from, to, label });
const ok = (from: string, to: string, label: string): SeqMessage => ({ from, to, label, dashed: true });
const no = (from: string, to: string, label: string): SeqMessage => ({ from, to, label, dashed: true, tone: 'bad' });
const self = (on: string, label: string, tone: SeqMessage['tone'] = 'neutral'): SeqMessage => ({ from: on, to: on, label, tone });

const CAST: SeqActor[] = [
  { id: 'a', label: 'Client A', kind: 'service' },
  { id: 'b', label: 'Client B', kind: 'service' },
  { id: 'ls', label: 'Lock service', kind: 'external' },
  { id: 'r', label: 'Storage', kind: 'storage' },
];

// The notes' fencing story, beat by beat. Steps 4 and 5 share the first half.
const PAUSE_START: Beat[] = [
  { add: [req('a', 'ls', 'acquire lock'), ok('ls', 'a', 'granted, token 33')], stats: [{ label: 'Holder', value: 'A' }, { label: 'Token', value: '33' }] },
  {
    add: [self('a', 'long GC pause', 'bad')],
    actors: { a: { status: 'dim', badge: { text: 'frozen', tone: 'bad' } } },
    note: { text: 'A is paused but still believes it holds the lock', tone: 'bad' },
    hold: 1800,
  },
  {
    add: [req('b', 'ls', 'acquire lock'), ok('ls', 'b', 'granted, token 34')],
    actors: { ls: { badge: { text: "A's lease expired: B" } } },
    stats: [{ label: 'Holder', value: 'B' }, { label: 'Token', value: '34' }],
  },
];

const RECAP_STATE: SeqState = {
  actors: patch(CAST, { a: { badge: { text: 'stale token 33', tone: 'bad' } }, r: { badge: { text: 'highest seen: 34', tone: 'ok' } } }),
  messages: [
    req('a', 'ls', 'acquire lock'),
    ok('ls', 'a', 'granted, token 33'),
    self('a', 'long GC pause', 'bad'),
    req('b', 'ls', 'acquire lock'),
    ok('ls', 'b', 'granted, token 34'),
    req('b', 'r', 'write, token 34'),
    ok('r', 'b', 'ok, remembers 34'),
    req('a', 'r', 'write, token 33'),
    no('r', 'a', 'rejected: 33 < 34'),
  ],
  fresh: 0,
  stats: [
    { label: 'Lease', value: 'no deadlock', tone: 'ok' },
    { label: 'Fencing', value: 'no stale write', tone: 'ok' },
    { label: 'Best', value: 'no lock at all' },
  ],
};

export default defineLesson('sequence', {
  slug: 'locks-fencing',
  objectives: [
    { text: 'How leases stop a crashed holder from blocking forever', step: 3 },
    { text: 'Why a lock alone is not enough', step: 4 },
    { text: 'How fencing tokens make the storage reject stale writes', step: 5 },
    { text: 'When to avoid the lock entirely', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Two writers, one resource',
      tag: 'problem',
      body: [
        'Two processes read the same file, edit it, and write it back. B\'s write lands last and A\'s edit disappears.',
        'A **distributed lock** is meant to stop this: only the holder may modify the resource.',
      ],
      keyIdea: 'Concurrent read-modify-write cycles across processes lose updates unless something serializes them.',
      frames: play(CAST, [
        { add: [req('a', 'r', 'read file (v1)'), req('b', 'r', 'read file (v1)')], actors: { ls: { status: 'dim' } }, stats: [{ label: 'Lock', value: 'none', tone: 'bad' }] },
        { add: [req('a', 'r', "write v2 (A's edit)")], actors: { r: { badge: { text: "has A's edit" } } } },
        {
          add: [req('b', 'r', "write v2 (B's edit)")],
          actors: { r: { badge: { text: "A's edit lost", tone: 'bad' } } },
          stats: [{ label: 'Lock', value: 'none', tone: 'bad' }, { label: 'Edits kept', value: '1 of 2', tone: 'bad' }],
          note: { text: 'B overwrote A without ever seeing it', tone: 'bad' },
        },
      ]),
    },
    {
      label: 'Lock',
      title: 'Take turns through a lock service',
      tag: 'concept',
      body: [
        'A acquires the lock, writes, and releases. B asks while A holds it and has to wait.',
        'Only after A releases does B get the lock and do its own read-modify-write.',
      ],
      keyIdea: 'A lock protects a resource from concurrent modification by multiple processes.',
      frames: play(CAST, [
        { add: [req('a', 'ls', 'acquire lock'), ok('ls', 'a', 'granted')], actors: { ls: { badge: { text: 'holder: A' } } }, stats: [{ label: 'Holder', value: 'A' }] },
        { add: [req('b', 'ls', 'acquire lock'), no('ls', 'b', 'held, wait')] },
        { add: [req('a', 'r', 'write'), req('a', 'ls', 'release')], actors: { ls: { badge: { text: 'free' } } }, stats: [{ label: 'Holder', value: 'none' }] },
        {
          add: [ok('ls', 'b', 'granted'), req('b', 'r', 'write')],
          actors: { ls: { badge: { text: 'holder: B' } } },
          stats: [{ label: 'Holder', value: 'B' }, { label: 'Edits kept', value: '2 of 2', tone: 'ok' }],
          note: { text: 'one writer at a time', tone: 'ok' },
        },
      ]),
    },
    {
      label: 'Lease',
      title: 'Give the lock an expiry',
      tag: 'technique',
      body: [
        'If the holder crashes, a plain lock is never released and everyone waits forever.',
        'A **lease** is a lock with an expiry. When it runs out, the lock service hands it to the next client. `SET key value NX PX ttl` in Redis is a lease.',
      ],
      keyIdea: 'Leases keep a crashed holder from blocking everyone, but they add a new danger: expiry while the holder is still alive.',
      frames: play(CAST, [
        { add: [req('a', 'ls', 'acquire, lease 10 s'), ok('ls', 'a', 'granted')], actors: { ls: { badge: { text: 'holder: A' } } }, stats: [{ label: 'Holder', value: 'A' }, { label: 'Lease', value: '10 s' }] },
        { actors: { a: { status: 'down', badge: { text: 'crashed', tone: 'bad' } } }, note: { text: 'A crashed while holding the lock', tone: 'bad' }, hold: 1400 },
        { add: [req('b', 'ls', 'acquire'), no('ls', 'b', 'held by A')], stats: [{ label: 'Holder', value: 'A (dead)', tone: 'bad' }, { label: 'Lease', value: 'ticking' }] },
        {
          add: [self('ls', 'lease expired'), req('b', 'ls', 'acquire'), ok('ls', 'b', 'granted')],
          actors: { ls: { badge: { text: 'holder: B' } } },
          stats: [{ label: 'Holder', value: 'B', tone: 'ok' }, { label: 'Lease', value: 'expired' }],
          note: { text: 'the expiry frees the lock without A', tone: 'ok' },
        },
      ]),
    },
    {
      label: 'Pause trap',
      title: 'The holder pauses and wakes up too late',
      tag: 'problem',
      body: [
        'A gets the lock, then stalls in a long GC pause. Its lease expires and B gets the lock and writes.',
        'A wakes up, still believes it holds the lock, and writes over B. The lock service did nothing wrong.',
      ],
      keyIdea: 'A client can pause at any moment after acquiring a lock, so timing alone cannot make a lock safe.',
      frames: play(CAST, [
        ...PAUSE_START,
        { add: [req('b', 'r', 'write'), ok('r', 'b', 'ok')], actors: { r: { badge: { text: "has B's write" } } } },
        {
          add: [self('a', 'wakes up'), req('a', 'r', 'write (thinks it holds)')],
          actors: { a: { status: 'normal', badge: { text: 'stale holder', tone: 'bad' } }, r: { badge: { text: "B's write lost", tone: 'bad' } } },
          stats: [{ label: 'Holder', value: 'B' }, { label: 'Writers', value: '2', tone: 'bad' }],
          note: { text: 'two clients wrote while each "held" the lock', tone: 'bad' },
        },
      ]),
    },
    {
      label: 'Fencing',
      title: 'Fencing tokens: storage says no',
      tag: 'technique',
      body: [
        'Each grant comes with a **fencing token**, a number that only goes up. Every write carries it.',
        'Storage remembers the highest token it has seen and rejects anything older. A wakes up with 33, storage has seen 34, so the write is refused.',
      ],
      keyIdea: 'Fencing makes correctness independent of timing: the resource itself rejects stale holders.',
      frames: play(CAST, [
        ...PAUSE_START,
        { add: [req('b', 'r', 'write, token 34'), ok('r', 'b', 'ok, remembers 34')], actors: { r: { badge: { text: 'highest seen: 34' } } } },
        {
          add: [req('a', 'r', 'write, token 33'), no('r', 'a', 'rejected: 33 < 34')],
          actors: { a: { status: 'normal', badge: { text: 'stale token 33', tone: 'bad' } }, r: { badge: { text: 'highest seen: 34', tone: 'ok' } } },
          stats: [{ label: 'Holder', value: 'B' }, { label: 'Stale write', value: 'rejected', tone: 'ok' }],
          note: { text: 'the older token loses, whatever the timing', tone: 'ok' },
          hold: 2600,
        },
      ]),
    },
    {
      label: 'Avoid it',
      title: 'Pick the right tool, or skip the lock',
      tag: 'trade-off',
      body: [
        'Redis locks are fine for **efficiency** (avoid duplicate work) but risky for correctness. When correctness matters, use etcd, ZooKeeper or database constraints.',
        'Better still, avoid the lock: a **version column** with compare-and-set lets exactly one writer win.',
      ],
      keyIdea: 'Prefer idempotent operations, optimistic concurrency, or one writer per key through partitioning.',
      frames: play(
        patch(CAST, { ls: { status: 'dim' }, r: { label: 'Database', kind: 'db', badge: { text: 'seat 42, version 7' } } }),
        [
          { add: [req('a', 'r', 'UPDATE ... version = 7')], stats: [{ label: 'Lock', value: 'none' }, { label: 'Version', value: '7' }] },
          {
            add: [ok('r', 'a', '1 row: A holds seat 42')],
            actors: { r: { badge: { text: 'holder u1, version 8' } } },
            stats: [{ label: 'Lock', value: 'none' }, { label: 'Version', value: '8' }],
          },
          { add: [req('b', 'r', 'UPDATE ... version = 7')], hold: 1500 },
          {
            add: [no('r', 'b', '0 rows: someone else won')],
            actors: { b: { badge: { text: 'reload and retry', tone: 'accent' } } },
            stats: [{ label: 'Lock', value: 'none' }, { label: 'Winners', value: '1', tone: 'ok' }],
            note: { text: '0 rows updated means someone else won', tone: 'ok' },
          },
        ],
      ),
    },
    {
      label: 'Recap',
      title: 'Locks need fences',
      tag: 'recap',
      body: [
        '- **Lock:** one holder modifies the resource at a time.',
        '- **Lease:** a lock with an expiry, so a crashed holder cannot block forever.',
        '- **Trap:** a paused holder can outlive its lease and write late.',
        '- **Fencing token:** a rising number per grant. Storage rejects older tokens.',
        '- **Better:** idempotency, compare-and-set on a version, or a single writer per key.',
      ],
      keyIdea: 'Use Redis locks for efficiency, consensus-backed locks or database constraints for correctness.',
      frames: [{ state: RECAP_STATE }],
    },
  ],
});
