import { defineLesson } from '../define';
import { patch } from '../engines/layouts';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Note, Stat } from '../types';

/*
 * Every step is a short story told as messages. `play` reveals the messages beat by beat,
 * carrying actor badges and stats forward until a beat changes them.
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

const req = (from: string, to: string, label: string): SeqMessage => ({ from, to, label });
const rep = (from: string, to: string, label: string, tone: SeqMessage['tone'] = 'res'): SeqMessage => ({ from, to, label, dashed: true, tone });
const sync = (from: string, to: string, label: string): SeqMessage => ({ from, to, label, tone: 'data' });

// Step 1 and 6: one user, a primary, a lagging replica.
const RYW: SeqActor[] = [
  { id: 'u', label: 'You', kind: 'client' },
  { id: 'p', label: 'Primary', kind: 'db' },
  { id: 'r', label: 'Replica', kind: 'db' },
];

// Step 2: the last seat.
const SEAT: SeqActor[] = [
  { id: 'a', label: 'Alice', kind: 'client' },
  { id: 'p', label: 'Primary', kind: 'db' },
  { id: 'r', label: 'Replica', kind: 'db' },
  { id: 'b', label: 'Bob', kind: 'client' },
];
const SEAT_START = [req('a', 'p', 'book last seat'), rep('p', 'a', 'booked')];

// Step 3: two writers, two replicas, different arrival orders.
const ORDER: SeqActor[] = [
  { id: 'a', label: 'Client A', kind: 'client' },
  { id: 'r1', label: 'Replica 1', kind: 'db' },
  { id: 'r2', label: 'Replica 2', kind: 'db' },
  { id: 'b', label: 'Client B', kind: 'client' },
];

// Step 4: a comment and its reply.
const THREAD: SeqActor[] = [
  { id: 'al', label: 'Alice', kind: 'client' },
  { id: 'bo', label: 'Bob', kind: 'client' },
  { id: 'r1', label: 'Replica 1', kind: 'db' },
  { id: 'r2', label: 'Replica 2', kind: 'db' },
  { id: 'ca', label: 'Carol', kind: 'client' },
];

// Step 5: two replicas at different points in time.
const MONO: SeqActor[] = [
  { id: 'u', label: 'You', kind: 'client' },
  { id: 'r1', label: 'Replica 1', kind: 'db' },
  { id: 'r2', label: 'Replica 2', kind: 'db' },
];

// Step 7: three replicas converging.
const EVENTUAL: SeqActor[] = [
  { id: 'c', label: 'Client', kind: 'client' },
  { id: 'r1', label: 'Replica 1', kind: 'db', badge: { text: 'x=6' } },
  { id: 'r2', label: 'Replica 2', kind: 'db', badge: { text: 'x=6' } },
  { id: 'r3', label: 'Replica 3', kind: 'db', badge: { text: 'x=6' } },
];

const LADDER: SeqState = {
  actors: [{ id: 'm', label: 'Strongest', kind: 'monitor' }],
  messages: [
    { from: 'm', to: 'm', label: 'Linearizable: real time', tone: 'ok' },
    { from: 'm', to: 'm', label: 'Sequential: one order', tone: 'info' },
    { from: 'm', to: 'm', label: 'Causal: cause first', tone: 'violet' },
    { from: 'm', to: 'm', label: 'Session: RYW, monotonic', tone: 'data' },
    { from: 'm', to: 'm', label: 'Eventual: converge', tone: 'neutral' },
  ],
  fresh: 5,
  stats: [
    { label: 'Stronger', value: 'more waiting' },
    { label: 'Weaker', value: 'more anomalies' },
    { label: 'ACID C', value: 'not CAP C', hint: 'invariants vs linearizability' },
  ],
  note: { text: 'from strongest (top) to weakest (bottom)' },
};

export default defineLesson('sequence', {
  slug: 'consistency-models',
  objectives: [
    { text: 'Why replication lag breaks what users expect', step: 1 },
    { text: 'Linearizable, sequential and causal guarantees', step: 4 },
    { text: 'Make read-your-writes work with replicas', step: 6 },
    { text: 'When eventual consistency is enough', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Your own post is missing',
      tag: 'problem',
      body: [
        'You write to the primary and get `ok`. Your next read goes to a replica that has not received the write yet.',
        'You refresh and your post is gone. Nothing is broken: the replica is just behind.',
      ],
      keyIdea: 'With replicas, "what will a read return?" has many possible answers. A consistency model says which ones are allowed.',
      frames: play(RYW, [
        { add: [req('u', 'p', 'write post')], stats: [{ label: 'Replica', value: 'behind', tone: 'bad' }, { label: 'Your post', value: 'on primary' }] },
        { add: [rep('p', 'u', 'ok')] },
        { add: [req('u', 'r', 'read my feed')], actors: { r: { badge: { text: 'lagging', tone: 'bad' } } } },
        { add: [rep('r', 'u', 'no post', 'bad')], note: { text: 'you post, refresh, and your post is missing', tone: 'bad' }, hold: 2000 },
        {
          add: [sync('p', 'r', 'replicate post')],
          actors: { r: { badge: { text: 'caught up', tone: 'ok' } } },
          stats: [{ label: 'Replica', value: 'caught up', tone: 'ok' }, { label: 'Your post', value: 'everywhere' }],
        },
      ]),
    },
    {
      label: 'Linearizable',
      title: 'As if there were one copy',
      tag: 'concept',
      body: [
        '**Linearizable** is the strongest model: once a write returns, every later read sees it, in one real-time global order.',
        'Without it, Bob reads a stale replica after Alice has already booked, and both grab the last seat.',
      ],
      keyIdea: 'Linearizability makes many copies behave like one. It is the C in CAP.',
      frames: [
        ...play(SEAT, [
          { add: SEAT_START, stats: [{ label: 'Seats left', value: '0' }, { label: 'Model', value: 'eventual' }] },
          { add: [req('b', 'r', 'is the seat free?')], actors: { r: { badge: { text: 'stale', tone: 'bad' } } } },
          {
            add: [rep('r', 'b', 'free', 'bad')],
            actors: { b: { badge: { text: 'books it too', tone: 'bad' } } },
            note: { text: 'two users both grab the last seat', tone: 'bad' },
            hold: 2200,
          },
        ]),
        ...play(
          SEAT,
          [
            {
              add: [req('b', 'r', 'is the seat free?'), rep('r', 'b', 'taken')],
              actors: { r: { badge: { text: 'sees the booking', tone: 'ok' } }, b: { badge: { text: 'picks another', tone: 'ok' } } },
              stats: [{ label: 'Seats left', value: '0' }, { label: 'Model', value: 'linearizable', tone: 'ok' }],
              note: { text: 'once "booked" returns, every later read sees it', tone: 'ok' },
            },
          ],
          SEAT_START,
        ),
      ],
    },
    {
      label: 'Sequential',
      title: 'Everyone sees the same order',
      tag: 'concept',
      body: [
        'Two clients write `x=1` and `x=2` at about the same time. The writes reach the replicas in different orders.',
        'Replica 1 ends on `x=2`, Replica 2 on `x=1`. **Sequential** consistency requires every process to see one order, though not tied to real time.',
      ],
      keyIdea: 'Sequential: one agreed order of operations for everyone, but it may lag behind real time.',
      frames: play(ORDER, [
        { add: [req('a', 'r1', 'x=1'), req('b', 'r2', 'x=2')], stats: [{ label: 'Replica 1', value: 'x=1' }, { label: 'Replica 2', value: 'x=2' }] },
        {
          add: [req('b', 'r1', 'x=2'), req('a', 'r2', 'x=1')],
          actors: { r1: { badge: { text: 'applied 1, 2' } }, r2: { badge: { text: 'applied 2, 1', tone: 'bad' } } },
          stats: [{ label: 'Replica 1', value: 'x=2' }, { label: 'Replica 2', value: 'x=1', tone: 'bad' }],
          note: { text: 'replicas applied writes in different orders', tone: 'bad' },
          hold: 2600,
        },
        {
          actors: { r1: { badge: { text: 'order: 1, 2', tone: 'ok' } }, r2: { badge: { text: 'order: 1, 2', tone: 'ok' } } },
          stats: [{ label: 'Replica 1', value: 'x=2', tone: 'ok' }, { label: 'Replica 2', value: 'x=2', tone: 'ok' }],
          note: { text: 'sequential: both apply the same agreed order', tone: 'ok' },
        },
      ]),
    },
    {
      label: 'Causal',
      title: 'Cause before effect, everywhere',
      tag: 'concept',
      body: [
        'Bob saw Alice\'s comment and replied. The reply reaches Replica 2 before the comment does, so Carol sees an answer to nothing.',
        '**Causal** consistency only orders related events: if A caused B, everyone sees A before B. Unrelated writes may still arrive in any order.',
      ],
      keyIdea: 'Causal is weaker than sequential but enough for comments, chats and threads.',
      frames: play(THREAD, [
        { add: [req('al', 'r1', 'comment: lunch?')], stats: [{ label: 'Replica 2 has', value: 'nothing' }] },
        { add: [rep('r1', 'bo', 'sees comment'), req('bo', 'r1', 'reply: yes!')] },
        { add: [sync('r1', 'r2', 'reply: yes!')], stats: [{ label: 'Replica 2 has', value: 'reply only', tone: 'bad' }] },
        {
          add: [req('ca', 'r2', 'read thread'), rep('r2', 'ca', 'reply, no comment', 'bad')],
          note: { text: 'a reply appears before the comment it replies to', tone: 'bad' },
          hold: 2400,
        },
        { add: [sync('r1', 'r2', 'comment: lunch?')], stats: [{ label: 'Replica 2 has', value: 'both, late' }] },
        {
          actors: { r2: { badge: { text: 'hold reply until comment', tone: 'ok' } } },
          stats: [{ label: 'Replica 2 has', value: 'both', tone: 'ok' }, { label: 'Model', value: 'causal' }],
          note: { text: 'causal: the reply is only shown after its cause', tone: 'ok' },
        },
      ]),
    },
    {
      label: 'Monotonic',
      title: 'Time must not go backwards',
      tag: 'concept',
      body: [
        'Session guarantees are about one user. **Monotonic reads**: you never see an older value after a newer one.',
        'Here a refresh lands on a replica that is further behind, so the count goes down. Pinning the session to one replica fixes it.',
      ],
      keyIdea: 'Read-your-writes and monotonic reads are cheap guarantees that remove the most visible weirdness.',
      frames: [
        ...play(MONO, [
          {
            add: [req('u', 'r1', 'read likes'), rep('r1', 'u', 'likes = 10')],
            actors: { r1: { badge: { text: 'fresher' } }, r2: { badge: { text: 'further behind', tone: 'bad' } } },
            stats: [{ label: 'Last seen', value: '10' }, { label: 'Session', value: 'not pinned' }],
          },
          {
            add: [req('u', 'r2', 'refresh'), rep('r2', 'u', 'likes = 8', 'bad')],
            stats: [{ label: 'Last seen', value: '8', tone: 'bad' }, { label: 'Session', value: 'not pinned' }],
            note: { text: 'you saw a new value, then an older one', tone: 'bad' },
            hold: 2600,
          },
        ]),
        ...play(MONO, [
          {
            add: [req('u', 'r1', 'read likes'), rep('r1', 'u', 'likes = 10'), req('u', 'r1', 'refresh (pinned)'), rep('r1', 'u', 'likes = 10')],
            actors: { u: { badge: { text: 'session -> Replica 1', tone: 'accent' } }, r2: { status: 'dim' } },
            stats: [{ label: 'Last seen', value: '10', tone: 'ok' }, { label: 'Session', value: 'pinned', tone: 'ok' }],
            note: { text: 'pin the session to one replica: reads are monotonic', tone: 'ok' },
          },
        ]),
      ],
    },
    {
      label: 'Read your writes',
      title: 'Making read-your-writes work',
      tag: 'technique',
      body: [
        'Track the write\'s **log position**. Only read from a replica that has caught up to it.',
        'If none has, route your reads to the **primary** for a short window after you write.',
      ],
      keyIdea: 'Three fixes: read from the primary briefly after a write, read only from caught-up replicas, or pin the session.',
      frames: play(RYW, [
        {
          add: [req('u', 'p', 'write post'), rep('p', 'u', 'ok, log pos 42')],
          actors: { u: { badge: { text: 'remembers pos 42' } }, r: { badge: { text: 'at pos 40', tone: 'bad' } } },
          stats: [{ label: 'Your write', value: 'pos 42' }, { label: 'Replica', value: 'pos 40', tone: 'bad' }],
        },
        { add: [req('u', 'r', 'read, need pos 42'), rep('r', 'u', 'not caught up', 'bad')], hold: 2400 },
        { add: [req('u', 'p', 'read (just wrote)'), rep('p', 'u', 'your post')], note: { text: 'read from the primary for a short window', tone: 'accent' }, hold: 2400 },
        {
          add: [sync('p', 'r', 'replicate to 42'), req('u', 'r', 'read, need pos 42'), rep('r', 'u', 'your post')],
          actors: { r: { badge: { text: 'at pos 42', tone: 'ok' } } },
          stats: [{ label: 'Your write', value: 'pos 42' }, { label: 'Replica', value: 'pos 42', tone: 'ok' }],
          note: { text: 'replica caught up: safe to read there again', tone: 'ok' },
        },
      ]),
    },
    {
      label: 'Eventual',
      title: 'Eventual: agree once writes stop',
      tag: 'trade-off',
      body: [
        '**Eventual** consistency only promises that replicas converge if updates stop. For a while they disagree.',
        'That is the BASE side: Cassandra, DynamoDB, many caches, for feeds, counters and telemetry. Money, orders and inventory stay on ACID stores.',
      ],
      keyIdea: 'Weaker models are faster and more available. Pick the weakest one your users will not notice.',
      frames: play(EVENTUAL, [
        { add: [req('c', 'r1', 'write x=7')], actors: { r1: { badge: { text: 'x=7', tone: 'accent' } } }, stats: [{ label: 'Agree', value: '1 of 3' }] },
        { add: [sync('r1', 'r2', 'x=7')], actors: { r2: { badge: { text: 'x=7', tone: 'accent' } } }, stats: [{ label: 'Agree', value: '2 of 3' }] },
        {
          add: [req('c', 'r3', 'read x'), rep('r3', 'c', 'x=6', 'neutral')],
          actors: { r3: { badge: { text: 'x=6 (behind)', tone: 'bad' } } },
          note: { text: 'replicas disagree for a while' },
          hold: 2400,
        },
        {
          add: [sync('r2', 'r3', 'x=7')],
          actors: { r1: { badge: { text: 'x=7', tone: 'ok' } }, r2: { badge: { text: 'x=7', tone: 'ok' } }, r3: { badge: { text: 'x=7', tone: 'ok' } } },
          stats: [{ label: 'Agree', value: '3 of 3' }, { label: 'Store type', value: 'BASE' }],
          note: { text: 'writes stopped: all replicas converge', tone: 'ok' },
        },
      ]),
    },
    {
      label: 'Recap',
      title: 'The ladder of guarantees',
      tag: 'recap',
      body: [
        '- **Linearizable:** once a write returns, all later reads see it. One copy, real time.',
        '- **Sequential:** one order for everyone, not tied to real time.',
        '- **Causal:** cause before effect everywhere.',
        '- **Session:** read-your-writes and monotonic reads, per user.',
        '- **Eventual:** replicas converge if writes stop.',
      ],
      keyIdea: 'The "C" in ACID (application invariants) is not the "C" in CAP (linearizability).',
      frames: [{ state: LADDER, hold: 5000 }],
    },
  ],
});
