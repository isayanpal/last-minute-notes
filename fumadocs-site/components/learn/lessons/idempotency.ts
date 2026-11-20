import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';

const A: SeqActor[] = [
  { id: 'c', label: 'Client', kind: 'client' },
  { id: 's', label: 'Payment API', kind: 'service' },
  { id: 'd', label: 'Database', kind: 'db' },
];

const seq = (messages: SeqMessage[], stats: SeqState['stats'], note?: SeqState['note'], fresh = 1, actors = A): SeqState => ({ actors, messages, stats, note, fresh });

const retryBug: SeqMessage[] = [
  { from: 'c', to: 's', label: 'POST /charge $50' },
  { from: 's', to: 'd', label: 'charge $50' },
  { from: 's', to: 'c', label: 'response lost', dashed: true, lost: true, tone: 'bad' },
  { from: 'c', to: 's', label: 'retry: POST /charge $50' },
  { from: 's', to: 'd', label: 'charge $50 again', tone: 'bad' },
];

const keyed: SeqMessage[] = [
  { from: 'c', to: 's', label: 'POST /charge key=K1' },
  { from: 's', to: 'd', label: 'insert K1 IN_PROGRESS', tone: 'accent' },
  { from: 's', to: 'd', label: 'charge $50 + store result' },
  { from: 's', to: 'c', label: 'response lost', dashed: true, lost: true, tone: 'bad' },
  { from: 'c', to: 's', label: 'retry key=K1' },
  { from: 's', to: 'd', label: 'K1 is DONE: read result', tone: 'accent' },
  { from: 's', to: 'c', label: 'same result, no new charge', dashed: true, tone: 'ok' },
];

const inProgress: SeqMessage[] = [
  { from: 'c', to: 's', label: 'POST key=K1 (slow)' },
  { from: 's', to: 'd', label: 'K1 IN_PROGRESS' },
  { from: 'c', to: 's', label: 'impatient retry key=K1' },
  { from: 's', to: 'c', label: '409 still processing', dashed: true, tone: 'accent' },
];

const naturalBad: SeqMessage[] = [
  { from: 'c', to: 's', label: 'balance += 10' },
  { from: 's', to: 'd', label: 'balance = 110' },
  { from: 'c', to: 's', label: 'retry: balance += 10' },
  { from: 's', to: 'd', label: 'balance = 120', tone: 'bad' },
];
const naturalGood: SeqMessage[] = [
  { from: 'c', to: 's', label: 'balance = 110' },
  { from: 's', to: 'd', label: 'balance = 110' },
  { from: 'c', to: 's', label: 'retry: balance = 110' },
  { from: 's', to: 'd', label: 'balance = 110', tone: 'ok' },
];

export default defineLesson('sequence', {
  slug: 'idempotency',
  objectives: [
    { text: 'Why retries cause duplicate effects', step: 1 },
    { text: 'The idempotency-key flow', step: 2 },
    { text: 'What happens when a retry arrives mid-flight', step: 3 },
    { text: 'Preferring naturally idempotent operations', step: 4 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'A lost response, a double charge',
      tag: 'problem',
      body: ['The charge succeeded but the response was lost. The client cannot tell, so it retries, and the customer is charged twice.', 'You cannot get exactly-once delivery over an unreliable network.'],
      keyIdea: 'You get **at-least-once delivery plus idempotent handling**, which has the same effect as exactly-once.',
      frames: [{ state: seq(retryBug, [{ label: 'Charged', value: '$100', tone: 'bad' }, { label: 'Intended', value: '$50' }, { label: 'Cause', value: 'blind retry' }], { text: 'the retry looks like a brand new request', tone: 'bad' }, 5) }],
    },
    {
      label: 'Key flow',
      title: 'The client sends an idempotency key',
      tag: 'technique',
      body: ['The client creates a unique key (a UUID) once per logical operation and sends it on every retry.', 'The server records the key with the result. A repeat returns the stored result instead of acting again.'],
      keyIdea: 'Insert the key and the effect in the same transaction, or the dedupe can be bypassed.',
      frames: [3, 5, 7].map((n) => ({ state: seq(keyed.slice(0, n), [{ label: 'Key', value: 'K1' }, { label: 'Charged', value: '$50', tone: 'ok' }, { label: 'On retry', value: n === 7 ? 'stored result' : '-', tone: n === 7 ? 'ok' : 'neutral' }], undefined, n === 3 ? 3 : 2), hold: 2600 })),
    },
    {
      label: 'In progress',
      title: 'The retry arrives too early',
      tag: 'technique',
      body: ['The first request is still running when the retry arrives. The key exists but has no result yet.', 'Return `409` (or make the retry wait) instead of starting a second charge.'],
      keyIdea: 'Key states: not seen, IN_PROGRESS, DONE. Each has a defined reply.',
      frames: [{ state: seq(inProgress, [{ label: 'K1 state', value: 'IN_PROGRESS' }, { label: 'Reply', value: '409 or wait' }, { label: 'Charges', value: '1', tone: 'ok' }], undefined, 2) }],
    },
    {
      label: 'Natural',
      title: 'Prefer operations that are naturally safe',
      tag: 'concept',
      body: ['`balance = 110` can be repeated safely. `balance = balance + 10` cannot.', '`GET`, `PUT` and `DELETE` are idempotent by definition. `POST` is not, so it needs a key.'],
      keyIdea: 'Naturally idempotent designs beat dedupe tables. A unique constraint on a natural key is the cheapest idempotency.',
      frames: [{ state: seq(naturalBad, [{ label: 'Operation', value: 'increment' }, { label: 'After retry', value: '120', tone: 'bad' }, { label: 'Safe?', value: 'no', tone: 'bad' }], undefined, 4), hold: 3000 }, { state: seq(naturalGood, [{ label: 'Operation', value: 'set' }, { label: 'After retry', value: '110', tone: 'ok' }, { label: 'Safe?', value: 'yes', tone: 'ok' }], undefined, 4) }],
    },
    {
      label: 'Recap',
      title: 'Rules to follow',
      tag: 'recap',
      body: [
        '- **Client** generates the key once per logical operation and reuses it on every retry.',
        '- **Server** stores key and effect atomically, and stores the response too.',
        '- **Scope** keys per user and expire them after a window, for example 24 hours.',
        '- **Message consumers:** dedupe by message id, or make the handler repeatable.',
        '- **Best:** design operations that are idempotent by nature.',
      ],
      keyIdea: 'Every write that matters needs a defence against retries, because clients retry and networks duplicate.',
      frames: [{ state: seq(keyed, [], undefined, 7) }],
    },
  ],
});
