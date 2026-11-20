import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

const meter = (value: number, label: string) => ({ value, label, tone: value > 0.85 ? ('bad' as const) : value > 0.5 ? ('accent' as const) : ('ok' as const) });

const sync = (over: Partial<FlowState> = {}): FlowState => ({
  nodes: [
    { id: 'p', label: 'Web app', kind: 'service', x: 0.6, y: 1.6 },
    { id: 'w', label: 'Email worker', kind: 'worker', x: 4, y: 1.6, status: 'hot', meter: meter(1, 'overloaded') },
  ],
  links: [{ from: 'p', to: 'w', tone: 'bad' }],
  packets: [{ from: 'p', to: 'w', label: '200 emails', tone: 'bad', dur: 0.8 }],
  stats: [{ label: 'User waits', value: 'for the worker', tone: 'bad' }, { label: 'Spike', value: 'drops work', tone: 'bad' }, { label: 'Coupling', value: 'tight' }],
  ...over,
});

const queued = (depth: number, packets: Packet[], extra: Partial<FlowState> = {}): FlowState => ({
  nodes: [
    { id: 'p', label: 'Web app', sub: 'returns at once', kind: 'service', x: 0.6, y: 1.6 },
    { id: 'q', label: 'Queue', kind: 'queue', x: 2.6, y: 1.6, items: Array.from({ length: Math.min(depth, 4) }, (_, i) => `m${i + 1}`), meter: meter(Math.min(1, depth / 12), `${depth} waiting`) },
    { id: 'w', label: 'Worker', sub: 'steady pace', kind: 'worker', x: 4.8, y: 1.6, meter: meter(0.6, 'steady') },
  ],
  links: [{ from: 'p', to: 'q' }, { from: 'q', to: 'w' }],
  packets,
  ...extra,
});

const PARTS = (hl?: number): FlowNode[] => [
  { id: 'p', label: 'Producer', kind: 'service', x: 0.4, y: 1.6, size: 'sm' },
  { id: 't0', label: 'Partition 0', kind: 'queue', x: 2.8, y: 0.4, size: 'sm', status: hl === 0 ? 'active' : 'normal', items: ['u1', 'u1', 'u4'] },
  { id: 't1', label: 'Partition 1', kind: 'queue', x: 2.8, y: 1.6, size: 'sm', status: hl === 1 ? 'active' : 'normal', items: ['u2', 'u2'] },
  { id: 't2', label: 'Partition 2', kind: 'queue', x: 2.8, y: 2.8, size: 'sm', status: hl === 2 ? 'active' : 'normal', items: ['u3', 'u5'] },
  { id: 'a', label: 'Consumer A', kind: 'worker', x: 5.2, y: 0.4, size: 'sm' },
  { id: 'b', label: 'Consumer B', kind: 'worker', x: 5.2, y: 1.6, size: 'sm' },
  { id: 'c', label: 'Consumer C', kind: 'worker', x: 5.2, y: 2.8, size: 'sm' },
];
const PL = [
  { from: 'p', to: 't0' }, { from: 'p', to: 't1' }, { from: 'p', to: 't2' },
  { from: 't0', to: 'a' }, { from: 't1', to: 'b' }, { from: 't2', to: 'c' },
];

const redeliver = (stage: 0 | 1 | 2): FlowState => ({
  nodes: [
    { id: 'q', label: 'Queue', kind: 'queue', x: 1.2, y: 1.6, items: stage === 2 ? ['m1 (again)'] : ['m1'] },
    { id: 'w', label: 'Consumer', kind: 'worker', x: 3.8, y: 1.6, status: stage === 1 ? 'down' : 'normal', badge: stage === 1 ? { text: 'crash before ack', tone: 'bad' } : stage === 2 ? { text: 'dedupe by id: skip', tone: 'accent' } : undefined },
    { id: 'db', label: 'Database', kind: 'db', x: 5.5, y: 1.6, items: stage === 0 ? [] : ['m1 done'] },
  ],
  links: [{ from: 'q', to: 'w' }, { from: 'w', to: 'db' }],
  packets: stage === 0 ? [{ from: 'q', to: 'w', label: 'm1', dur: 0.6 }, { from: 'w', to: 'db', label: 'write', delay: 0.6, dur: 0.6 }] : stage === 2 ? [{ from: 'q', to: 'w', label: 'm1 again', tone: 'data', dur: 0.6 }] : [],
  stats: [{ label: 'Guarantee', value: 'at-least-once' }, { label: 'Lost?', value: 'never', tone: 'ok' }, { label: 'Duplicates', value: stage === 2 ? 'handled' : 'possible', tone: stage === 2 ? 'ok' : 'bad' }],
  note: stage === 1 ? { text: 'no ack, so the broker redelivers', tone: 'bad' } : stage === 2 ? { text: 'idempotent consumer makes the retry harmless', tone: 'ok' } : { text: 'process, then acknowledge', tone: 'accent' },
});

export default defineLesson('flow', {
  slug: 'queues-streams',
  objectives: [
    { text: 'How a queue absorbs a spike', step: 2 },
    { text: 'Partitions and consumer groups', step: 3 },
    { text: 'At-least-once delivery and idempotent consumers', step: 4 },
    { text: 'What a dead-letter queue is for', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'The slow work blocks the request',
      tag: 'problem',
      body: ['The web app sends 200 emails by calling the worker directly. The user waits, and a traffic spike overloads the worker.', 'Producer and consumer are tied to the same speed and the same uptime.'],
      keyIdea: 'Slow work on the request path hurts latency. A spike with no buffer becomes dropped work.',
      frames: [{ state: sync() }],
    },
    {
      label: 'Buffer',
      title: 'A queue absorbs the spike',
      tag: 'concept',
      body: ['The app drops messages on a **queue** and returns at once. A worker drains it at its own steady pace.', 'The queue grows during a spike and shrinks afterwards. Producer and consumer scale and fail independently.'],
      keyIdea: 'Asynchronous messaging decouples producers from consumers and moves slow work off the request path.',
      frames: [
        { state: queued(2, [{ from: 'p', to: 'q', label: 'm', dur: 0.5 }]), hold: 1500 },
        { state: queued(9, [{ from: 'p', to: 'q', label: 'burst', tone: 'data', dur: 0.5 }], { note: { text: 'spike: depth rises, worker pace unchanged', tone: 'accent' } }), hold: 1800 },
        { state: queued(3, [{ from: 'q', to: 'w', label: 'm', dur: 0.5 }], { note: { text: 'drains back down', tone: 'ok' } }) },
      ],
    },
    {
      label: 'Partitions',
      title: 'Same key, same partition',
      tag: 'technique',
      body: ['A stream splits a topic into **partitions**. The message key picks the partition, so messages with one key stay in order.', 'In a **consumer group** each partition goes to one consumer, so max parallelism equals the partition count.'],
      keyIdea: 'Pick a key with enough variety to spread load. Ordering is guaranteed per partition, not across the topic.',
      frames: [
        { state: { nodes: PARTS(), links: PL, stats: [{ label: 'Partitions', value: '3' }, { label: 'Consumers', value: '3', hint: 'one each' }, { label: 'Max parallel', value: '3' }] }, hold: 1500 },
        { state: { nodes: PARTS(1), links: PL, packets: [{ from: 'p', to: 't1', label: 'key u2', dur: 0.7 }, { from: 't1', to: 'b', label: 'u2', delay: 0.9, dur: 0.6 }], stats: [{ label: 'Key', value: 'u2 → partition 1' }, { label: 'Order', value: 'kept', tone: 'ok' }, { label: 'Consumer', value: 'B' }] } },
      ],
    },
    {
      label: 'Delivery',
      title: 'At-least-once, then dedupe',
      tag: 'technique',
      body: ['Commit the offset **after** processing: a crash means the message is redelivered, never lost. That is **at-least-once**.', 'Duplicates are then possible, so make consumers **idempotent**: dedupe by message id, or set a value rather than increment it.'],
      keyIdea: 'Exactly-once in practice is at-least-once delivery plus idempotent processing.',
      frames: [{ state: redeliver(0), hold: 2000 }, { state: redeliver(1), hold: 2000 }, { state: redeliver(2) }],
    },
    {
      label: 'Failures',
      title: 'Poison messages and backpressure',
      tag: 'trade-off',
      body: ['A **poison message** fails forever and blocks the queue. After a few retries with backoff and jitter, move it to a **dead-letter queue** with the error.', 'Keep queues bounded and alert on consumer lag. An unbounded queue hides overload until it explodes.'],
      keyIdea: 'Queues add latency, cost and eventual consistency. Do not queue work the user is waiting on unless it is slow or must be retried.',
      frames: [
        {
          state: {
            nodes: [
              { id: 'q', label: 'Queue', kind: 'queue', x: 0.8, y: 1.6, items: ['bad msg'] },
              { id: 'w', label: 'Consumer', kind: 'worker', x: 3, y: 1.6, status: 'hot', badge: { text: 'fails 3 times', tone: 'bad' } },
              { id: 'dlq', label: 'Dead-letter', sub: 'inspect later', kind: 'queue', x: 5.2, y: 1.6, items: ['bad msg'] },
            ],
            links: [{ from: 'q', to: 'w' }, { from: 'w', to: 'dlq', tone: 'bad', dashed: true }],
            packets: [{ from: 'q', to: 'w', label: 'retry', tone: 'bad', dur: 0.5 }, { from: 'w', to: 'dlq', label: 'park', tone: 'bad', delay: 0.9, dur: 0.7 }],
            stats: [{ label: 'Retries', value: 'backoff + jitter' }, { label: 'Queue', value: 'unblocked', tone: 'ok' }, { label: 'Alert on', value: 'consumer lag' }],
          },
        },
      ],
    },
    {
      label: 'Recap',
      title: 'Queue or stream?',
      tag: 'recap',
      body: [
        '- **Queue** (SQS, RabbitMQ): broker deletes after ack. Best for task distribution.',
        '- **Stream** (Kafka, Pulsar): append-only partitioned log, replayable, many consumer groups.',
        '- **Ordering:** per partition, chosen by key.',
        '- **Delivery:** at-least-once plus idempotent consumers.',
        '- **Safety:** retries with backoff, dead-letter queue, bounded queues, lag alerts.',
      ],
      keyIdea: 'Use a queue to hand out jobs, a stream when many systems need the same events or need to replay history.',
      frames: [{ state: { nodes: PARTS(), links: PL, stats: [{ label: 'Replay', value: 'yes (stream)', tone: 'ok' }, { label: 'Groups', value: 'many' }, { label: 'Order', value: 'per partition' }] } }],
    },
  ],
});
