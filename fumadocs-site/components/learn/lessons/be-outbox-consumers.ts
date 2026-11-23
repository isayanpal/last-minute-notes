import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Async Processing notes: the dual write problem, the transactional outbox with a relay,
 * at-least-once delivery, idempotent consumers with a dedupe table, backoff with jitter, and a dead-letter queue.
 */

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req', dur = 0.55): Packet => ({ from, to, label, delay, tone, dur });

// Step 1: updating a database and a broker cannot be atomic.
const dual = (fail: 'broker' | 'db'): FlowState => ({
  nodes: [
    { id: 's', label: 'Service', kind: 'service', shape: 'server', x: 0.4, y: 1.7 },
    { id: 'd', label: 'Database', sub: fail === 'db' ? 'rolled back' : 'order saved', kind: 'db', shape: 'db', x: 3.6, y: 0.6, status: fail === 'db' ? 'down' : 'normal' },
    { id: 'b', label: 'Broker', sub: fail === 'broker' ? 'unreachable' : 'event sent', kind: 'queue', shape: 'queue', x: 3.6, y: 2.8, status: fail === 'broker' ? 'down' : 'normal' },
  ],
  links: [{ from: 's', to: 'd' }, { from: 's', to: 'b' }],
  packets:
    fail === 'broker'
      ? [hop('s', 'd', 'order', 0, 'ok'), hop('s', 'b', 'event', 0.8, 'bad')]
      : [hop('s', 'b', 'event', 0, 'ok'), hop('s', 'd', 'order', 0.8, 'bad')],
  stats: [
    { label: 'Two systems', value: 'not atomic' },
    { label: 'Outcome', value: fail === 'broker' ? 'event lost' : 'phantom event', tone: 'bad' },
    { label: 'Name', value: 'dual write' },
  ],
  note: fail === 'broker' ? { text: 'the order exists but nobody hears about it', tone: 'bad' } : { text: 'the event announces an order that never existed', tone: 'bad' },
});

// Step 2 and 3: the outbox. Business row and event commit in one transaction, a relay publishes.
const OB: FlowNode[] = [
  { id: 's', label: 'Service', kind: 'service', shape: 'server', x: 0.1, y: 1.7 },
  { id: 'd', label: 'Database', sub: 'orders + outbox', kind: 'db', shape: 'db', x: 1.9, y: 1.7 },
  { id: 'r', label: 'Relay', sub: 'polls outbox', kind: 'worker', x: 3.7, y: 1.7 },
  { id: 'b', label: 'Broker', kind: 'queue', shape: 'queue', x: 5.5, y: 1.7 },
];
const OB_LINKS = [{ from: 's', to: 'd' }, { from: 'd', to: 'r' }, { from: 'r', to: 'b' }];
const outbox = (phase: 0 | 1 | 2): FlowState => ({
  nodes: OB.map((n) => {
    if (n.id === 'd') return { ...n, status: phase === 0 ? 'active' : 'normal', items: phase === 0 ? ['order 1', 'event 1'] : phase === 1 ? ['order 1', 'event 1', 'published'] : ['order 1', 'event 1', 'published'] };
    if (n.id === 'r') return { ...n, status: phase >= 1 ? 'active' : 'dim' };
    if (n.id === 'b') return { ...n, status: phase >= 1 ? 'normal' : 'dim', items: phase >= 1 ? ['event 1'] : undefined };
    return n;
  }),
  links: OB_LINKS,
  packets:
    phase === 0
      ? [hop('s', 'd', 'one txn', 0, 'data', 0.8)]
      : phase === 1
        ? [hop('d', 'r', 'unpublished', 0), hop('r', 'b', 'event 1', 0.6, 'ok'), hop('r', 'd', 'mark done', 1.2, 'data')]
        : [],
  stats:
    phase === 0
      ? [{ label: 'Write', value: 'one txn', tone: 'ok' }, { label: 'Atomic', value: 'order + event', tone: 'ok' }, { label: 'On rollback', value: 'no orphans' }]
      : [{ label: 'Relay', value: 'poll or CDC' }, { label: 'Delivery', value: 'at-least-once' }, { label: 'Event id', value: 'for dedupe' }],
  note:
    phase === 0
      ? { text: 'the event row commits or rolls back with the order', tone: 'ok' }
      : phase === 1
        ? { text: 'relay reads unpublished rows, sends them, then marks them', tone: 'accent' }
        : { text: 'cleanup of old published rows runs on a schedule', tone: 'accent' },
});

// Step 3: the relay may die between publish and mark, so the event is sent twice.
const crash = (phase: 0 | 1): FlowState => ({
  nodes: [
    OB[0],
    { ...OB[1], items: ['event 1'] },
    { ...OB[2], status: phase === 0 ? 'down' : 'active', sub: phase === 0 ? 'crashed before mark' : 'restarted' },
    { ...OB[3], items: phase === 0 ? ['event 1'] : ['event 1', 'event 1'] },
  ],
  links: OB_LINKS,
  packets: phase === 0 ? [hop('r', 'b', 'event 1', 0, 'ok')] : [hop('d', 'r', 'still unpublished', 0), hop('r', 'b', 'event 1 again', 0.6, 'bad')],
  stats: [
    { label: 'Guarantee', value: 'at-least-once' },
    { label: 'Duplicates', value: phase === 0 ? 'not yet' : 'possible', tone: phase === 0 ? 'neutral' : 'bad' },
    { label: 'So', value: 'dedupe', tone: 'ok' },
  ],
  note: phase === 0 ? { text: 'published, but the row was not marked before the crash', tone: 'bad' } : { text: 'after restart the row is still unpublished, so it is sent again', tone: 'bad' },
});

// Step 4: an idempotent consumer. Effect and dedupe record commit in the same transaction.
const consumer = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'q', label: 'Broker', kind: 'queue', shape: 'queue', x: 0.2, y: 1.7, items: phase === 0 ? ['msg 7'] : ['msg 7 #2'] },
    { id: 'w', label: 'Consumer', sub: 'idempotent', kind: 'worker', x: 2.9, y: 1.7, status: 'active' },
    { id: 'd', label: 'Database', sub: 'balance + inbox', kind: 'db', shape: 'db', x: 5.5, y: 1.7, items: phase === 0 ? ['msg 7'] : ['msg 7'] },
  ],
  links: [{ from: 'q', to: 'w' }, { from: 'w', to: 'd' }],
  packets:
    phase === 0
      ? [hop('q', 'w', 'msg 7', 0), hop('w', 'd', 'insert + update', 0.6, 'data'), hop('w', 'q', 'ack', 1.3, 'ok')]
      : [hop('q', 'w', 'msg 7', 0, 'bad'), hop('w', 'd', 'insert msg 7', 0.6, 'data'), hop('d', 'w', 'duplicate key', 1.2, 'bad'), hop('w', 'q', 'ack, skip', 1.8, 'ok')],
  stats: [
    { label: 'Dedupe key', value: 'message id' },
    { label: 'Effect', value: phase === 0 ? 'applied once' : 'skipped', tone: 'ok' },
    { label: 'Ack', value: 'after success' },
  ],
  note: phase === 0 ? { text: 'inbox row and balance change commit together', tone: 'ok' } : { text: 'the unique constraint turns a redelivery into a no-op', tone: 'ok' },
});

// Step 5: retries with backoff and jitter, then the dead-letter queue.
const retry = (kind: 'attempt1' | 'attempt3' | 'permanent' | 'exhausted'): FlowState => {
  const base: FlowNode[] = [
    { id: 'q', label: 'Queue', kind: 'queue', shape: 'queue', x: 0.2, y: 1.2 },
    { id: 'w', label: 'Worker', kind: 'worker', x: 2.7, y: 1.2, status: 'active' },
    { id: 'p', label: 'Provider', sub: 'email, payment', kind: 'external', shape: 'cloud', x: 5.4, y: 1.2 },
    { id: 'x', label: 'Dead letters', sub: 'inspect and replay', kind: 'storage', shape: 'disk', x: 2.7, y: 3.2 },
  ];
  const links = [{ from: 'q', to: 'w' }, { from: 'w', to: 'p' }, { from: 'w', to: 'x', dashed: true }];
  if (kind === 'attempt1')
    return {
      nodes: base.map((n) => (n.id === 'p' ? { ...n, status: 'down' as const, sub: '503' } : n.id === 'w' ? { ...n, badge: { text: 'retry in ~1 s', tone: 'accent' as const } } : n)),
      links,
      packets: [hop('q', 'w', 'job', 0), hop('w', 'p', 'call', 0.6, 'req'), hop('p', 'w', '503', 1.2, 'bad')],
      stats: [{ label: 'Error', value: '503, transient' }, { label: 'Delay', value: 'base x 2^n' }, { label: 'Plus', value: 'full jitter', tone: 'ok' }],
      note: { text: 'transient errors are retried with exponential backoff', tone: 'accent' },
    };
  if (kind === 'attempt3')
    return {
      nodes: base.map((n) => (n.id === 'w' ? { ...n, badge: { text: 'attempt 3: ok', tone: 'ok' as const } } : n)),
      links,
      packets: [hop('w', 'p', 'call', 0, 'req'), hop('p', 'w', '200', 0.6, 'ok'), hop('w', 'q', 'ack', 1.2, 'ok')],
      stats: [{ label: 'Delays', value: '1 s, 2 s, 4 s' }, { label: 'Jitter', value: 'spreads', tone: 'ok' }, { label: 'Result', value: 'done', tone: 'ok' }],
      note: { text: 'jitter stops retries from synchronizing into a storm', tone: 'ok' },
    };
  if (kind === 'permanent')
    return {
      nodes: base.map((n) => (n.id === 'p' ? { ...n, sub: '400' } : n.id === 'x' ? { ...n, items: ['bad job'], status: 'hot' as const } : n)),
      links,
      packets: [hop('w', 'p', 'call', 0), hop('p', 'w', '400', 0.6, 'bad'), hop('w', 'x', 'park it', 1.2, 'bad')],
      stats: [{ label: 'Error', value: '400, permanent', tone: 'bad' }, { label: 'Retry', value: 'never' }, { label: 'Goes to', value: 'dead letters' }],
      note: { text: 'do not retry validation errors or other 4xx responses', tone: 'bad' },
    };
  return {
    nodes: base.map((n) => (n.id === 'p' ? { ...n, status: 'down' as const, sub: 'still failing' } : n.id === 'x' ? { ...n, items: ['job 9'], status: 'hot' as const } : n)),
    links,
    packets: [hop('w', 'p', 'attempt 5', 0), hop('p', 'w', '503', 0.6, 'bad'), hop('w', 'x', 'give up', 1.2, 'bad')],
    stats: [{ label: 'Attempts', value: 'bounded', tone: 'ok' }, { label: 'Then', value: 'park + alert' }, { label: 'Poison msg', value: 'not blocked' }],
    note: { text: 'after N tries the message is parked so the queue keeps moving', tone: 'bad' },
  };
};

export default defineLesson('flow', {
  slug: 'be-outbox-consumers',
  objectives: [
    { text: 'Why updating a database and a broker is unsafe', step: 1 },
    { text: 'How the transactional outbox makes events reliable', step: 2 },
    { text: 'Why delivery is at-least-once', step: 3 },
    { text: 'How an idempotent consumer survives duplicates', step: 4 },
    { text: 'Retries with backoff, jitter and a dead-letter queue', step: 5 },
  ],
  steps: [
    {
      label: 'Dual write',
      title: 'Two systems, no atomic write',
      tag: 'problem',
      body: ['A request must update the database **and** publish an event, but two separate systems cannot be updated atomically.', 'Commit first and the event can be lost. Publish first and the event can describe something that then rolls back.'],
      keyIdea: 'Whichever order you pick, one failure leaves the systems disagreeing.',
      frames: [{ state: dual('broker'), hold: 3200 }, { state: dual('db'), hold: 3200 }],
    },
    {
      label: 'Outbox',
      title: 'The event is just another row',
      tag: 'technique',
      body: ['Write the event to an **outbox table in the same transaction** as the business change. A separate **relay** reads unpublished rows, sends them to the broker and marks them published.', 'Relay options: polling with `SKIP LOCKED`, or change data capture (Debezium) for low latency.'],
      keyIdea: 'One local transaction replaces a distributed one: the order and its event commit together or not at all.',
      frames: [{ state: outbox(0), hold: 2400 }, { state: outbox(1), hold: 3000 }, { state: outbox(2), hold: 1800 }],
    },
    {
      label: 'At-least-once',
      title: 'The relay can repeat itself',
      tag: 'trade-off',
      body: ['If the relay crashes after publishing but before marking the row, it sends the event again on restart.', 'So delivery is **at-least-once**, not exactly once. The consumer has to cope.'],
      keyIdea: 'Include an event id and a partition key (the aggregate id) so consumers can dedupe and keep per-entity order.',
      frames: [{ state: crash(0), hold: 2600 }, { state: crash(1), hold: 3000 }],
    },
    {
      label: 'Idempotent',
      title: 'Make duplicates harmless',
      tag: 'technique',
      body: ['Insert the message id into a **dedupe table** and apply the effect in the **same transaction**. A duplicate key means the work was done, so ack and skip.', 'For effects outside your database, pass an idempotency key to the external API.'],
      keyIdea: 'Ack only after success, so a crash leads to redelivery, and the dedupe record makes redelivery safe.',
      frames: [{ state: consumer(0), hold: 3000 }, { state: consumer(1), hold: 3400 }],
    },
    {
      label: 'Retries',
      title: 'Backoff, jitter and dead letters',
      tag: 'technique',
      body: ['Retry transient errors with `delay = min(cap, base x 2^attempt)` and **full jitter** so retries do not synchronize.', 'Do not retry permanent errors. After N attempts, park the message in a **dead-letter queue** so a poison message cannot block the rest.'],
      keyIdea: 'Cap retries with a budget and a circuit breaker so a down dependency is not hammered.',
      frames: [{ state: retry('attempt1'), hold: 2800 }, { state: retry('attempt3'), hold: 2800 }, { state: retry('permanent'), hold: 2800 }, { state: retry('exhausted'), hold: 2800 }],
    },
    {
      label: 'Recap',
      title: 'Reliable messaging checklist',
      tag: 'recap',
      body: [
        '- **Producer:** transactional outbox, relay by polling or CDC.',
        '- **Delivery:** at-least-once, so design for duplicates.',
        '- **Consumer:** idempotent, dedupe in the same transaction, ack after success.',
        '- **Failures:** backoff with jitter, no retries for 4xx, bounded attempts.',
        '- **Dead letters:** park, alert, inspect, replay.',
      ],
      keyIdea: 'The outbox is the producer side and the inbox is the consumer side of the same idea: make the database the source of truth.',
      frames: [{ state: outbox(1) }],
    },
  ],
});
