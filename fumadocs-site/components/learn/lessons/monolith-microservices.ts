import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';

const CLIENT: FlowNode = { id: 'c', label: 'Clients', kind: 'client', shape: 'laptop', x: 0, y: 1.6, size: 'sm' };

const mod = (id: string, label: string, x: number, y: number, over: Partial<FlowNode> = {}): FlowNode => ({ id, label, kind: 'service', x, y, size: 'sm', ...over });

// Step 1: one big deploy for everybody.
const MONOLITH: FlowState = {
  nodes: [
    CLIENT,
    { id: 'm', label: 'Monolith', sub: 'one deploy', kind: 'service', shape: 'server', x: 2.6, y: 1.6, size: 'lg', items: ['users', 'orders', 'search', 'billing'], status: 'hot' },
    { id: 'db', label: 'Database', kind: 'db', shape: 'db', x: 5.2, y: 1.6 },
  ],
  links: [
    { from: 'c', to: 'm' },
    { from: 'm', to: 'db' },
  ],
  packets: [
    { from: 'c', to: 'm', dur: 0.6 },
    { from: 'm', to: 'db', delay: 0.6, dur: 0.6, tone: 'data' },
  ],
  stats: [
    { label: 'Engineers', value: '60' },
    { label: 'Deploys / week', value: '1', tone: 'bad' },
    { label: 'One bug', value: 'blocks all', tone: 'bad' },
  ],
  note: { text: 'every team ships through the same release train', tone: 'bad' },
};

// Step 2: modular monolith, clear boundaries inside one process.
const MODULAR_NODES: FlowNode[] = [
  CLIENT,
  mod('users', 'Users', 2.0, 0.3),
  mod('orders', 'Orders', 3.5, 0.3),
  mod('billing', 'Billing', 2.0, 2.7),
  mod('search', 'Search', 3.5, 2.7),
  { id: 'db', label: 'Database', kind: 'db', shape: 'db', x: 5.4, y: 1.6, size: 'sm' },
];
const MODULAR: FlowState = {
  nodes: MODULAR_NODES,
  links: [
    { from: 'c', to: 'users' },
    { from: 'users', to: 'orders', dashed: true },
    { from: 'orders', to: 'billing', dashed: true },
    { from: 'orders', to: 'search', dashed: true },
    { from: 'orders', to: 'db' },
  ],
  groups: [{ label: 'one process, one deploy', nodes: ['users', 'orders', 'billing', 'search'], tone: 'accent' }],
  packets: [
    { from: 'c', to: 'users', dur: 0.5 },
    { from: 'users', to: 'orders', delay: 0.5, dur: 0.4, tone: 'ok', label: 'call' },
    { from: 'orders', to: 'billing', delay: 0.9, dur: 0.4, tone: 'ok', label: 'call' },
  ],
  stats: [
    { label: 'Calls between', value: 'in-process', hint: 'nanoseconds', tone: 'ok' },
    { label: 'Transactions', value: 'local ACID', tone: 'ok' },
    { label: 'Boundaries', value: 'by interfaces' },
  ],
  note: { text: 'modules own their code and talk through interfaces', tone: 'accent' },
};

// Step 3: extract Search because it has a real reason.
const SPLIT: FlowState = {
  nodes: [
    CLIENT,
    mod('users', 'Users', 1.9, 0.3),
    mod('orders', 'Orders', 3.4, 0.3),
    mod('billing', 'Billing', 2.6, 1.5),
    { id: 'db', label: 'Database', kind: 'db', shape: 'db', x: 5.3, y: 0.3, size: 'sm' },
    { id: 'search', label: 'Search svc', sub: 'own deploy', kind: 'search', x: 3.0, y: 2.9, badge: { text: 'scales to 20 pods', tone: 'accent' } },
    { id: 'idx', label: 'Index', kind: 'storage', shape: 'disk', x: 5.3, y: 2.9, size: 'sm' },
  ],
  links: [
    { from: 'c', to: 'users' },
    { from: 'users', to: 'orders', dashed: true },
    { from: 'orders', to: 'billing', dashed: true },
    { from: 'orders', to: 'db' },
    { from: 'orders', to: 'search', tone: 'accent' },
    { from: 'search', to: 'idx' },
  ],
  groups: [{ label: 'monolith', nodes: ['users', 'orders', 'billing'] }],
  packets: [
    { from: 'orders', to: 'search', dur: 0.7, tone: 'accent', label: 'HTTP' },
    { from: 'search', to: 'idx', delay: 0.7, dur: 0.5, tone: 'data' },
  ],
  stats: [
    { label: 'Why split', value: 'scaling need' },
    { label: 'Boundary', value: 'stable', tone: 'ok' },
    { label: 'Cost', value: 'network hop', tone: 'bad' },
  ],
  note: { text: 'split because there is a reason, not because it is fashionable', tone: 'accent' },
};

// Step 4: shared database vs own data.
const SHARED: FlowState = {
  nodes: [
    mod('orders', 'Orders svc', 1.0, 0.6, { size: 'md' }),
    mod('billing', 'Billing svc', 1.0, 2.7, { size: 'md' }),
    { id: 'db', label: 'Shared DB', sub: 'same tables', kind: 'db', shape: 'db', x: 4.4, y: 1.65, status: 'hot', badge: { text: 'distributed monolith', tone: 'bad' } },
  ],
  links: [
    { from: 'orders', to: 'db', tone: 'bad' },
    { from: 'billing', to: 'db', tone: 'bad' },
  ],
  packets: [
    { from: 'orders', to: 'db', tone: 'bad', dur: 0.8 },
    { from: 'billing', to: 'db', tone: 'bad', dur: 0.8, delay: 0.2 },
  ],
  stats: [
    { label: 'Schema change', value: 'both break', tone: 'bad' },
    { label: 'Deploy', value: 'together', tone: 'bad' },
    { label: 'Ownership', value: 'unclear', tone: 'bad' },
  ],
  note: { text: 'independent deploys are a lie while the tables are shared', tone: 'bad' },
};
const OWNED: FlowState = {
  nodes: [
    mod('orders', 'Orders svc', 1.0, 0.6, { size: 'md' }),
    mod('billing', 'Billing svc', 1.0, 2.7, { size: 'md' }),
    { id: 'odb', label: 'Orders DB', kind: 'db', shape: 'db', x: 4.6, y: 0.6, size: 'md' },
    { id: 'bdb', label: 'Billing DB', kind: 'db', shape: 'db', x: 4.6, y: 2.7, size: 'md' },
  ],
  links: [
    { from: 'orders', to: 'odb' },
    { from: 'billing', to: 'bdb' },
    { from: 'orders', to: 'billing', dashed: true, label: 'API or event', tone: 'accent' },
  ],
  packets: [
    { from: 'orders', to: 'odb', dur: 0.6, tone: 'data' },
    { from: 'orders', to: 'billing', dur: 0.8, delay: 0.5, tone: 'accent', label: 'OrderPlaced' },
    { from: 'billing', to: 'bdb', delay: 1.3, dur: 0.6, tone: 'data' },
  ],
  stats: [
    { label: 'Schema change', value: 'one team', tone: 'ok' },
    { label: 'Deploy', value: 'independent', tone: 'ok' },
    { label: 'Cross-service', value: 'API or events', tone: 'ok' },
  ],
  note: { text: 'each service owns its data and exposes it through an API', tone: 'accent' },
};

// Step 5: the price of the network.
const CHAIN_NODES: FlowNode[] = [
  CLIENT,
  mod('a', 'Gateway', 1.4, 1.6),
  mod('b', 'Orders', 2.8, 1.6),
  mod('p', 'Pricing', 4.2, 1.6),
  mod('i', 'Inventory', 5.6, 1.6),
];
const hop = (from: string, to: string, delay: number): Packet => ({ from, to, delay, dur: 0.5, label: '+50 ms', tone: 'bad' });
const CHAIN: FlowState = {
  nodes: CHAIN_NODES,
  links: [
    { from: 'c', to: 'a' },
    { from: 'a', to: 'b' },
    { from: 'b', to: 'p' },
    { from: 'p', to: 'i' },
  ] as FlowLink[],
  packets: [hop('c', 'a', 0), hop('a', 'b', 0.6), hop('b', 'p', 1.2), hop('p', 'i', 1.8)],
  stats: [
    { label: 'Sync hops', value: '4' },
    { label: 'Chain p99', value: '~200 ms', tone: 'bad' },
    { label: 'If one is down', value: 'all fail', tone: 'bad' },
  ],
  note: { text: 'every synchronous hop adds latency and a failure mode', tone: 'bad' },
};
const EVENTS: FlowState = {
  nodes: [
    CLIENT,
    mod('o', 'Orders', 1.5, 1.6),
    { id: 'q', label: 'Event bus', sub: 'OrderPlaced', kind: 'queue', shape: 'queue', x: 3.1, y: 1.6, size: 'sm' },
    mod('p', 'Pricing', 4.9, 0.4),
    mod('i', 'Inventory', 4.9, 1.6),
    mod('n', 'Email', 4.9, 2.8),
  ],
  links: [
    { from: 'c', to: 'o' },
    { from: 'o', to: 'q' },
    { from: 'q', to: 'p', dashed: true },
    { from: 'q', to: 'i', dashed: true },
    { from: 'q', to: 'n', dashed: true },
  ],
  packets: [
    { from: 'c', to: 'o', dur: 0.5 },
    { from: 'o', to: 'q', delay: 0.5, dur: 0.5, tone: 'data', label: 'event' },
    { from: 'q', to: 'p', delay: 1.1, dur: 0.5, tone: 'data' },
    { from: 'q', to: 'i', delay: 1.1, dur: 0.5, tone: 'data' },
    { from: 'q', to: 'n', delay: 1.1, dur: 0.5, tone: 'data' },
  ],
  stats: [
    { label: 'User waits for', value: '1 hop', tone: 'ok' },
    { label: 'Others', value: 'async', tone: 'ok' },
    { label: 'Consistency', value: 'eventual' },
  ],
  note: { text: 'the user only waits for what they must see now', tone: 'accent' },
};

export default defineLesson('flow', {
  slug: 'monolith-microservices',
  objectives: [
    { text: 'What a modular monolith gives you for free', step: 2 },
    { text: 'The real reasons to split out a service', step: 3 },
    { text: 'Why a shared database makes a distributed monolith', step: 4 },
    { text: 'What the network costs, and sync vs async calls', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'One deploy for sixty engineers',
      tag: 'problem',
      body: [
        'A single codebase and a single deploy works well for a small team. At sixty engineers one bad merge blocks everyone and every release is a big event.',
        'The tempting answer is "microservices". The right answer depends on what hurts.',
      ],
      keyIdea: 'Pick the architecture from the pain: team size, scaling profile, isolation needs. Not from a trend.',
      frames: [{ state: MONOLITH }],
    },
    {
      label: 'Modular first',
      title: 'Start with a modular monolith',
      tag: 'concept',
      body: [
        'Keep one deployable, but give each domain its own module, its own tables and a narrow interface. Calls stay in-process and transactions stay local.',
        'You get most of the clarity of services without the network.',
      ],
      keyIdea: 'A modular monolith is the good default for startups and small teams, and the best starting point for a later split.',
      frames: [{ state: MODULAR, hold: 3200 }],
    },
    {
      label: 'When to split',
      title: 'Extract when there is a real reason',
      tag: 'technique',
      body: [
        'Split a boundary out when it is **stable** and one of these is true: a very different scaling profile, a separate team that owns it, a need for fault isolation, or different technology.',
        'Here search needs 20 pods while billing needs 2. It leaves; the rest stays together.',
      ],
      keyIdea: 'Extract one service at a time, along a boundary that has stopped changing.',
      frames: [{ state: SPLIT, hold: 3200 }],
    },
    {
      label: 'Own your data',
      title: 'A shared database is a distributed monolith',
      tag: 'trade-off',
      body: [
        'Two services writing the same tables must change and deploy together. You paid for the network and kept the coupling.',
        '**Each service owns its data.** Others reach it through an API or events, never through its tables.',
      ],
      keyIdea: 'Other symptoms of a distributed monolith: services that deploy together, long synchronous chains, shared tables.',
      frames: [{ state: SHARED, hold: 2800 }, { state: OWNED }],
    },
    {
      label: 'Network cost',
      title: 'Every hop has a price',
      tag: 'trade-off',
      body: [
        'In-process calls cost nanoseconds. Network calls add latency, timeouts and partial failure, and tail latency compounds along the chain.',
        'Use synchronous calls only when the caller needs the answer now. For everything else publish an event and let the others catch up.',
      ],
      keyIdea: 'Transactions across services become sagas and eventual consistency. Debugging needs tracing. Budget for both.',
      frames: [{ state: CHAIN, hold: 3000 }, { state: EVENTS }],
    },
    {
      label: 'Recap',
      title: 'How to decide',
      tag: 'recap',
      body: [
        '- **Default:** a modular monolith with clear module boundaries.',
        '- **Split when:** the boundary is stable and there is a real reason (scale, team, isolation, tech).',
        '- **Data:** each service owns its data. A shared database means you built a distributed monolith.',
        '- **Calls:** synchronous for answers needed now, events for the rest. Discovery via DNS, a registry or Kubernetes Services.',
        '- **Cost:** tracing, sagas, tail latency and operations all get harder.',
      ],
      keyIdea: 'Microservices trade code complexity for operational complexity. Only buy that trade when the pain justifies it.',
      frames: [{ state: SPLIT }],
    },
  ],
});
