import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the OS notes on the bounded buffer problem: empty counts free slots, full counts items, a mutex guards the buffer, and
 * taking the mutex before wait(empty) deadlocks a full buffer. Real counting semaphores run a scripted schedule, and a small
 * lock model detects the deadlock, so every value shown is computed.
 */

const N = 2;
class Sem {
  constructor(public v: number) {}
  tryWait() {
    if (this.v > 0) {
      this.v--;
      return true;
    }
    return false;
  }
  signal() {
    this.v++;
  }
}
const empty = new Sem(N);
const full = new Sem(0);
const buffer: string[] = [];

type Step = { msg: SeqMessage; empty: number; full: number; items: number; blocked: boolean };
const steps: Step[] = [];
const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });
const snap = (msg: SeqMessage, blocked = false) => steps.push({ msg, empty: empty.v, full: full.v, items: buffer.length, blocked });

const put = (x: string) => {
  if (!empty.tryWait()) {
    snap(m('p', 'b', `put ${x}: empty is 0`, 'bad'), true);
    return false;
  }
  buffer.push(x);
  full.signal();
  snap(m('p', 'b', `put ${x}`, 'ok'));
  return true;
};
const take = () => {
  if (!full.tryWait()) {
    snap(m('c', 'b', 'take: full is 0', 'bad'), true);
    return false;
  }
  const x = buffer.shift()!;
  empty.signal();
  snap(m('c', 'b', `take ${x}`, 'ok', true));
  return true;
};

put('x1');
put('x2');
put('x3'); // the buffer is full: the producer blocks on wait(empty)
take(); // frees a slot
put('x3'); // the retry now succeeds
take();
take();

// The wrong lock order: lock(m) before wait(empty), with the buffer full.
type Lock = { holder: string | null };
const mutex: Lock = { holder: null };
const emptyFull = new Sem(0); // a full buffer: no free slots
const fullFull = new Sem(N);
const wrongMsgs: SeqMessage[] = [];
let deadlock = false;
{
  // producer: lock(m), then wait(empty)
  mutex.holder = 'p';
  wrongMsgs.push(m('p', 'b', 'lock(m): got it', 'req'));
  const gotSlot = emptyFull.tryWait();
  if (!gotSlot) wrongMsgs.push(m('p', 'b', 'wait(empty): 0, sleeps', 'bad'));
  // consumer: wait(full) succeeds, then lock(m)
  const gotItem = fullFull.tryWait();
  if (gotItem) wrongMsgs.push(m('c', 'b', 'wait(full): ok', 'req'));
  if (mutex.holder !== null && !gotSlot) {
    wrongMsgs.push(m('c', 'b', 'lock(m): held by p', 'bad'));
    // the producer waits for a slot only the consumer can free, the consumer waits for the mutex only the producer holds
    deadlock = true;
  }
}

const ACTORS: SeqState['actors'] = [
  { id: 'p', label: 'Producer', kind: 'worker' },
  { id: 'b', label: 'Buffer', kind: 'queue' },
  { id: 'c', label: 'Consumer', kind: 'worker' },
];

const upTo = (n: number, note?: SeqState['note']): SeqState => {
  const s = steps[n - 1];
  return {
    actors: ACTORS.map((a) => (a.id === 'p' && s.blocked && s.msg.from === 'p' ? { ...a, badge: { text: 'BLOCKED', tone: 'bad' as const } } : a)),
    messages: steps.slice(0, n).map((x) => x.msg),
    stats: [
      { label: 'empty', value: String(s.empty), tone: s.empty === 0 ? 'bad' : 'ok' },
      { label: 'full', value: String(s.full), tone: s.full === 0 ? 'bad' : 'ok' },
      { label: 'Items in buffer', value: `${s.items} of ${N}` },
    ],
    note: note ?? (s.blocked ? { text: 'the semaphore is 0, so the caller sleeps until the other side signals', tone: 'bad' } : { text: `empty counts free slots, full counts items: ${s.empty} free, ${s.full} filled`, tone: 'accent' }),
  };
};

const wrong = (n: number): SeqState => ({
  actors: ACTORS,
  messages: wrongMsgs.slice(0, n),
  stats: [
    { label: 'Mutex held by', value: n >= 1 ? 'producer' : '-' },
    { label: 'Producer', value: n >= 2 ? 'asleep' : '-', tone: n >= 2 ? 'bad' : 'neutral' },
    { label: 'Deadlock', value: n >= wrongMsgs.length ? (deadlock ? 'yes' : 'no') : '-', tone: n >= wrongMsgs.length && deadlock ? 'bad' : 'neutral' },
  ],
  note: n >= wrongMsgs.length && deadlock ? { text: 'the producer holds the mutex and waits for a slot, the consumer needs that mutex to free one', tone: 'bad' } : { text: 'lock(m) came before wait(empty): the producer keeps the mutex while it sleeps', tone: 'accent' },
});

export default defineLesson('sequence', {
  slug: 'os-producer-consumer',
  objectives: [
    { text: 'What the bounded buffer problem needs', step: 1 },
    { text: 'How empty and full count slots and items', step: 2 },
    { text: 'What happens when the buffer is full', step: 3 },
    { text: 'Why the order of wait and lock matters', step: 4 },
  ],
  steps: [
    {
      label: 'Bounded buffer',
      title: 'A queue with a limit',
      tag: 'problem',
      body: ['A producer puts items in a buffer of **2 slots** and a consumer takes them out. The producer must wait when it is full, and the consumer when it is empty.', 'This is the pattern behind every blocking queue, pipe and thread pool work queue.'],
      keyIdea: 'Two kinds of waiting: for a free slot, and for an item.',
      frames: [{ state: upTo(1), hold: 3200 }],
    },
    {
      label: 'Semaphores',
      title: 'empty and full',
      tag: 'concept',
      body: ['`empty` starts at N and counts free slots. `full` starts at 0 and counts items.', 'The producer does `wait(empty)` then adds and `signal(full)`. The consumer mirrors it.'],
      keyIdea: 'A counting semaphore blocks at 0 and wakes one waiter per signal.',
      frames: [1, 2].map((n) => ({ state: upTo(n), hold: 2400 })),
    },
    {
      label: 'Full buffer',
      title: 'The producer sleeps',
      tag: 'technique',
      body: ['The third `put` finds `empty` at 0, so the producer blocks.', 'The consumer\'s `take` signals `empty`, the producer wakes, and the put succeeds.'],
      keyIdea: 'The semaphores do the waiting, the mutex only protects the buffer itself.',
      frames: [3, 4, 5, 6, 7].map((n) => ({ state: upTo(n), hold: n === 7 ? 3400 : 1600 })),
    },
    {
      label: 'Wrong order',
      title: 'lock before wait',
      tag: 'trade-off',
      body: ['If the producer takes the mutex **before** `wait(empty)` and the buffer is full, it sleeps while holding the mutex.', 'The consumer needs that mutex to free a slot, so neither can proceed: deadlock.'],
      keyIdea: 'Wait on the semaphore first, then take the mutex.',
      frames: Array.from({ length: wrongMsgs.length }, (_, i) => ({ state: wrong(i + 1), hold: i + 1 === wrongMsgs.length ? 4200 : 1600 })),
    },
    {
      label: 'Recap',
      title: 'Producer-consumer',
      tag: 'recap',
      body: [
        '- **empty:** free slots, starts at N.',
        '- **full:** items, starts at 0.',
        '- **Mutex:** protects the buffer structure.',
        '- **Order:** `wait` first, then `lock`.',
        '- **Used by:** pipes, queues, thread pools.',
      ],
      keyIdea: 'Never sleep on a semaphore while holding a lock the other side needs.',
      frames: [{ state: upTo(7) }],
    },
  ],
});
