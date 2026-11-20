import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

const nodes = (over: Record<string, Partial<FlowNode>> = {}, outbox = false): FlowNode[] => {
  const base: FlowNode[] = [
    { id: 'app', label: 'Order service', kind: 'service', x: 0.5, y: 1.6 },
    { id: 'db', label: outbox ? 'Orders DB' : 'Database', sub: outbox ? '+ outbox table' : undefined, kind: 'db', x: 2.8, y: 0.4 },
    { id: 'relay', label: 'Relay', sub: 'poll or CDC', kind: 'worker', x: 2.8, y: 2.9, size: 'sm' },
    { id: 'bus', label: 'Broker', kind: 'queue', x: 4.9, y: 1.6 },
    { id: 'ship', label: 'Shipping', kind: 'service', x: 6, y: 0.4, size: 'sm' },
    { id: 'mail', label: 'Email', kind: 'service', x: 6, y: 2.9, size: 'sm' },
  ];
  return base.map((n) => ({ ...n, ...over[n.id] }));
};

const naive = (stage: 0 | 1 | 2): FlowState => ({
  nodes: nodes({ app: { status: stage === 2 ? 'down' : 'normal', badge: stage === 2 ? { text: 'crashed', tone: 'bad' } : undefined }, db: { items: stage >= 1 ? ['order 7'] : [] }, bus: { items: [] }, relay: { status: 'dim' }, ship: { status: 'dim' }, mail: { status: 'dim' } }).filter((n) => n.id !== 'relay'),
  links: [{ from: 'app', to: 'db' }, { from: 'app', to: 'bus', dashed: true }],
  packets: stage === 1 ? [{ from: 'app', to: 'db', label: '1. save', dur: 0.6 }] : [],
  stats: [{ label: 'DB write', value: stage >= 1 ? 'done' : 'pending', tone: stage >= 1 ? 'ok' : 'neutral' }, { label: 'Event', value: stage === 2 ? 'never sent' : 'pending', tone: stage === 2 ? 'bad' : 'neutral' }, { label: 'Result', value: stage === 2 ? 'inconsistent' : '-', tone: stage === 2 ? 'bad' : 'neutral' }],
  note: stage === 2 ? { text: 'order saved, event lost: shipping never hears', tone: 'bad' } : { text: 'two writes to two systems', tone: 'accent' },
});

const outboxState = (packets: Packet[], over: Record<string, Partial<FlowNode>>, note?: FlowState['note'], stats?: FlowState['stats']): FlowState => ({
  nodes: nodes(over, true),
  links: [{ from: 'app', to: 'db', tone: 'accent' }, { from: 'relay', to: 'db', dashed: true }, { from: 'relay', to: 'bus' }, { from: 'bus', to: 'ship' }, { from: 'bus', to: 'mail' }],
  packets,
  note,
  stats,
});

const ST = (a: string, b: string, c: string, tone: 'ok' | 'bad' | 'neutral' = 'neutral'): FlowState['stats'] => [{ label: 'State write', value: a }, { label: 'Event', value: b, tone }, { label: 'Atomic', value: c, tone }];

export default defineLesson('flow', {
  slug: 'event-driven',
  objectives: [
    { text: 'Why "update DB and publish" is a dual-write bug', step: 1 },
    { text: 'How the transactional outbox fixes it', step: 2 },
    { text: 'Why consumers must be idempotent', step: 4 },
    { text: 'CQRS, event sourcing and CDC in one picture', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Two writes, one can fail',
      tag: 'problem',
      body: ['The order service saves an order, then publishes an `OrderPlaced` event. Those are writes to two different systems.', 'If the service crashes between them, the order exists but nobody hears about it.'],
      keyIdea: 'This is the **dual write problem**. No retry logic fully fixes it, because the crash can erase the memory of what to retry.',
      frames: [{ state: naive(0), hold: 1200 }, { state: naive(1), hold: 1600 }, { state: naive(2) }],
    },
    {
      label: 'Outbox',
      title: 'Write the event in the same transaction',
      tag: 'technique',
      body: ['Insert the event into an **outbox table** in the same database transaction as the state change.', 'Both commit or neither does. The event can no longer be lost, because it is stored with the data.'],
      keyIdea: 'The transactional outbox turns two writes into one atomic write plus a later publish.',
      frames: [
        { state: outboxState([{ from: 'app', to: 'db', label: 'order + outbox row', tone: 'accent', dur: 0.8 }], { db: { items: ['order 7', 'evt 7'] }, relay: { status: 'dim' }, ship: { status: 'dim' }, mail: { status: 'dim' }, bus: { status: 'dim' } }, { text: 'one transaction, one commit', tone: 'ok' }, ST('committed', 'stored safely', 'yes', 'ok')) },
      ],
    },
    {
      label: 'Relay',
      title: 'A relay publishes the rows',
      tag: 'technique',
      body: ['A **relay** reads new outbox rows and publishes them to the broker. It can poll the table, or tail the database log with CDC (for example Debezium).', 'If the relay crashes, it simply resumes. The rows are still there.'],
      keyIdea: 'Delivery is at least once: the relay may publish a row twice after a restart.',
      frames: [
        { state: outboxState([{ from: 'relay', to: 'db', label: 'new rows?', tone: 'data', dur: 0.6 }], { db: { items: ['order 7', 'evt 7'] }, relay: { status: 'active' }, bus: { status: 'dim' }, ship: { status: 'dim' }, mail: { status: 'dim' } }, undefined, ST('committed', 'found', 'yes', 'ok')), hold: 1800 },
        { state: outboxState([{ from: 'relay', to: 'bus', label: 'evt 7', dur: 0.6 }, { from: 'bus', to: 'ship', label: 'evt 7', delay: 0.7, dur: 0.6 }, { from: 'bus', to: 'mail', label: 'evt 7', delay: 0.7, dur: 0.6 }], { db: { items: ['order 7', 'evt 7 sent'] }, relay: { status: 'active' }, bus: { items: ['evt 7'] } }, { text: 'published to every interested consumer', tone: 'ok' }, ST('committed', 'published', 'yes', 'ok')) },
      ],
    },
    {
      label: 'Idempotent',
      title: 'Consumers expect duplicates',
      tag: 'trade-off',
      body: ['After a relay restart, `evt 7` may arrive twice. Consumers must cope.', 'The **inbox** pattern stores processed message ids and skips repeats. Or make the operation naturally repeatable: set a value, do not increment it.'],
      keyIdea: 'At-least-once delivery plus an idempotent consumer behaves like exactly-once.',
      frames: [
        { state: outboxState([{ from: 'bus', to: 'ship', label: 'evt 7 (again)', tone: 'data', dur: 0.7 }], { ship: { badge: { text: 'seen evt 7: skip', tone: 'accent' }, items: ['inbox: 7'] }, db: { items: ['order 7', 'evt 7 sent'] }, bus: { items: ['evt 7'] }, relay: { status: 'dim' }, mail: { status: 'dim' } }, { text: 'duplicate dropped by message id', tone: 'ok' }, [{ label: 'Delivery', value: 'at-least-once' }, { label: 'Duplicate', value: 'ignored', tone: 'ok' }, { label: 'Effect', value: 'once', tone: 'ok' }]) },
      ],
    },
    {
      label: 'CQRS & CDC',
      title: 'Events become the backbone',
      tag: 'concept',
      body: ['With **CDC** the database log itself streams out as events, so search, cache and analytics stay in sync without dual writes.', '**CQRS** splits the write model from read models. **Event sourcing** stores the events as the source of truth. Use them where audit and replay are real needs, not by default.'],
      keyIdea: 'Costs: eventual consistency between write and read sides, event schema evolution, replay time, more moving parts.',
      frames: [
        {
          state: {
            nodes: [
              { id: 'w', label: 'Write model', kind: 'service', x: 0.5, y: 1.6 },
              { id: 'log', label: 'Event log', sub: 'source of truth', kind: 'queue', x: 2.6, y: 1.6, items: ['e1', 'e2', 'e3'] },
              { id: 'r1', label: 'Search view', kind: 'search', x: 5, y: 0.4, size: 'sm' },
              { id: 'r2', label: 'Cache view', kind: 'cache', x: 5, y: 1.6, size: 'sm' },
              { id: 'r3', label: 'Analytics', kind: 'storage', x: 5, y: 2.8, size: 'sm' },
            ],
            links: [{ from: 'w', to: 'log' }, { from: 'log', to: 'r1' }, { from: 'log', to: 'r2' }, { from: 'log', to: 'r3' }],
            packets: [{ from: 'w', to: 'log', label: 'event', dur: 0.6 }, ...['r1', 'r2', 'r3'].map((r) => ({ from: 'log', to: r, label: 'event', delay: 0.7, dur: 0.7, tone: 'data' as const }))],
            stats: [{ label: 'Reads', value: 'own models' }, { label: 'Consistency', value: 'eventual', tone: 'bad' }, { label: 'Replay', value: 'rebuild views', tone: 'ok' }],
          },
        },
      ],
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Never** update a DB and publish an event as two separate steps.',
        '- **Outbox:** write the event in the same transaction, relay publishes later.',
        '- **Relay:** polling publisher or CDC reading the DB log.',
        '- **Consumers:** idempotent, with an inbox of processed ids.',
        '- **Streams:** use event time and watermarks, handle late data.',
      ],
      keyIdea: 'Reliability comes from storing intent durably first, then delivering it as many times as it takes.',
      frames: [{ state: outboxState([], { db: { items: ['order 7', 'evt 7'] } }, undefined, ST('atomic', 'at-least-once', 'safe', 'ok')) }],
    },
  ],
});
