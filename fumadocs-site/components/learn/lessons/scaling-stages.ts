import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * One architecture that grows stage by stage. Node ids stay stable, so boxes glide when the layout changes.
 * Layout: users at the left (x 0), the edge at x 1.3, app tier at x 2.7, data tier from x 4.1 to the right.
 */

const USER: FlowNode = { id: 'user', label: 'Users', kind: 'client', shape: 'laptop', x: 0, y: 1.6 };
const LB: FlowNode = { id: 'lb', label: 'Load balancer', kind: 'lb', shape: 'lb', x: 1.3, y: 1.6 };
const CDN: FlowNode = { id: 'cdn', label: 'CDN', sub: 'static assets', kind: 'cdn', shape: 'globe', x: 1.3, y: 0.2 };
const APP1: FlowNode = { id: 'app1', label: 'App 1', sub: 'stateless', kind: 'service', shape: 'server', x: 2.7, y: 0.9 };
const APP2: FlowNode = { id: 'app2', label: 'App 2', sub: 'stateless', kind: 'service', shape: 'server', x: 2.7, y: 2.3 };
const DB: FlowNode = { id: 'db', label: 'Database', sub: 'primary', kind: 'db', shape: 'db', x: 4.3, y: 1.6 };
const CACHE: FlowNode = { id: 'cache', label: 'Cache', sub: 'Redis', kind: 'cache', shape: 'cache', x: 4.1, y: 0.3 };
const SESSIONS: FlowNode = { id: 'sessions', label: 'Session store', sub: 'shared', kind: 'cache', shape: 'cache', x: 4.1, y: 2.9 };
const REPLICA: FlowNode = { id: 'replica', label: 'Read replica', sub: 'lags a little', kind: 'db', shape: 'db', x: 5.7, y: 1.6 };
const QUEUE: FlowNode = { id: 'queue', label: 'Queue', kind: 'queue', shape: 'queue', x: 4.1, y: 3 };
const WORKER: FlowNode = { id: 'worker', label: 'Workers', sub: 'email, video', kind: 'worker', x: 5.5, y: 3 };

const hops = (ids: string[], start = 0, dur = 0.55, tone: Packet['tone'] = 'req'): Packet[] =>
  ids.slice(1).map((to, i) => ({ from: ids[i], to, delay: start + i * dur, dur, tone }));

const stageStats = (n: number, adds: string, trigger: string, tone: 'ok' | 'bad' | 'neutral' = 'neutral') => [
  { label: 'Stage', value: `${n} of 8` },
  { label: 'Adds', value: adds, tone: 'ok' as const },
  { label: 'Next trigger', value: trigger, tone },
];

// Stage 1: one box runs the app and the database.
const stage1 = (hot: boolean): FlowState => ({
  nodes: [
    USER,
    {
      id: 'app1',
      label: 'One server',
      sub: 'app + DB',
      kind: 'service',
      x: 2.7,
      y: 1.6,
      status: hot ? 'hot' : 'normal',
      meter: { value: hot ? 0.95 : 0.4, label: hot ? 'CPU 95%' : 'CPU 40%', tone: hot ? 'bad' : 'ok' },
    },
  ],
  links: [{ from: 'user', to: 'app1' }],
  packets: hot ? [0, 1, 2, 3].map((i) => ({ from: 'user', to: 'app1', delay: i * 0.2, dur: 0.7 })) : [{ from: 'user', to: 'app1', dur: 0.7 }],
  stats: stageStats(1, 'nothing yet', 'CPU fight', hot ? 'bad' : 'neutral'),
  note: hot ? { text: 'app and DB fight for CPU and memory', tone: 'bad' } : { text: 'scale up first: a bigger box is the simplest fix' },
});

// Stage 2: the database moves to its own host.
const stage2 = (hot: boolean): FlowState => ({
  nodes: [
    USER,
    { ...APP1, label: 'App server', sub: hot ? 'saturated' : 'app only', x: 2.4, y: 1.6, status: hot ? 'hot' : 'normal', meter: { value: hot ? 0.95 : 0.5, label: hot ? 'CPU 95%' : 'CPU 50%', tone: hot ? 'bad' : 'ok' } },
    { ...DB, sub: 'own host' },
  ],
  links: [
    { from: 'user', to: 'app1' },
    { from: 'app1', to: 'db' },
  ],
  packets: hops(['user', 'app1', 'db']),
  stats: stageStats(2, 'separate DB', hot ? 'app saturates' : '-', hot ? 'bad' : 'neutral'),
  note: hot ? { text: 'one app server: saturated and a single point of failure', tone: 'bad' } : undefined,
});

// Stage 3: load balancer plus stateless app servers and a shared session store.
const S3_LINKS: FlowLink[] = [
  { from: 'user', to: 'lb' },
  { from: 'lb', to: 'app1' },
  { from: 'lb', to: 'app2' },
  { from: 'app1', to: 'db' },
  { from: 'app2', to: 'db' },
  { from: 'app1', to: 'sessions', dashed: true },
  { from: 'app2', to: 'sessions', dashed: true },
];
const stage3 = (second: boolean): FlowState => ({
  nodes: [USER, LB, APP1, APP2, DB, { ...SESSIONS, items: ['sess:ana'] }],
  links: S3_LINKS,
  packets: second
    ? [...hops(['user', 'lb', 'app2']), { from: 'app2', to: 'sessions', label: 'sess:ana', tone: 'data', delay: 1.1, dur: 0.6 }]
    : [...hops(['user', 'lb', 'app1']), { from: 'app1', to: 'sessions', label: 'sess:ana', tone: 'data', delay: 1.1, dur: 0.6 }],
  stats: [
    { label: 'Stage', value: '3 of 8' },
    { label: 'App servers', value: 'N, stateless', tone: 'ok' },
    { label: 'Ana served by', value: second ? 'app 2' : 'app 1' },
  ],
  note: second ? { text: 'any server can serve any request: sessions live outside', tone: 'accent' } : undefined,
});

// Stage 4: cache and CDN.
const S4_NODES = [USER, CDN, LB, APP1, APP2, CACHE, DB, SESSIONS];
const S4_LINKS: FlowLink[] = [{ from: 'user', to: 'cdn' }, ...S3_LINKS, { from: 'app1', to: 'cache' }, { from: 'app2', to: 'cache' }];
const stage4 = (): FlowState => ({
  nodes: S4_NODES,
  links: S4_LINKS,
  packets: [
    { from: 'user', to: 'cdn', label: 'logo.png', tone: 'data', dur: 0.6 },
    { from: 'cdn', to: 'user', tone: 'res', delay: 0.7, dur: 0.6 },
    ...hops(['user', 'lb', 'app1', 'cache'], 0.4),
    { from: 'cache', to: 'app1', tone: 'res', delay: 2.1, dur: 0.5 },
  ],
  stats: stageStats(4, 'cache + CDN', 'read QPS'),
  note: { text: 'static files from the edge, hot reads from Redis', tone: 'accent' },
});

// Stage 5: read replicas.
const stage5 = (): FlowState => ({
  nodes: [...S4_NODES, REPLICA],
  links: [...S4_LINKS, { from: 'db', to: 'replica', dashed: true }, { from: 'app2', to: 'replica' }],
  packets: [
    { from: 'app1', to: 'db', label: 'write', tone: 'data', dur: 0.6 },
    { from: 'db', to: 'replica', tone: 'data', delay: 0.7, dur: 0.7 },
    { from: 'app2', to: 'replica', label: 'read', delay: 0.3, dur: 0.8 },
  ],
  stats: stageStats(5, 'read replicas', 'slow work'),
  note: { text: 'reads scale out, at the cost of replication lag' },
});

// Stage 6: queues and async workers. The two app boxes merge into one "App servers" box to stay readable.
const APPS: FlowNode = { ...APP1, label: 'App servers', sub: 'N, stateless', y: 1.6 };
const stage6 = (): FlowState => ({
  nodes: [USER, CDN, LB, APPS, CACHE, DB, REPLICA, { ...QUEUE, items: ['email', 'video'] }, { ...WORKER, status: 'active' }],
  links: [
    { from: 'user', to: 'cdn' },
    { from: 'user', to: 'lb' },
    { from: 'lb', to: 'app1' },
    { from: 'app1', to: 'cache' },
    { from: 'app1', to: 'db' },
    { from: 'db', to: 'replica', dashed: true },
    { from: 'app1', to: 'queue' },
    { from: 'queue', to: 'worker' },
  ],
  packets: [
    ...hops(['user', 'lb', 'app1']),
    { from: 'app1', to: 'queue', label: 'video', tone: 'data', delay: 1.1, dur: 0.6 },
    { from: 'app1', to: 'user', tone: 'res', delay: 1.3, dur: 0.9, label: 'done' },
    { from: 'queue', to: 'worker', tone: 'data', delay: 1.9, dur: 0.6 },
  ],
  stats: stageStats(6, 'queue + workers', 'write volume'),
  note: { text: 'slow work no longer blocks the request', tone: 'accent' },
});

// Stage 7: shard the database, split services.
const stage7 = (): FlowState => ({
  nodes: [
    USER,
    CDN,
    LB,
    { ...APP1, label: 'Orders service', sub: 'split out' },
    { ...APP2, label: 'Users service', sub: 'split out' },
    CACHE,
    { ...DB, label: 'Shard 1', sub: 'part of the keys' },
    { ...REPLICA, label: 'Shard 2', sub: 'rest of the keys' },
    { ...QUEUE, sub: '+ workers' },
  ],
  links: [
    { from: 'user', to: 'cdn' },
    { from: 'user', to: 'lb' },
    { from: 'lb', to: 'app1' },
    { from: 'lb', to: 'app2' },
    { from: 'app1', to: 'cache' },
    { from: 'app1', to: 'db' },
    { from: 'app1', to: 'replica' },
    { from: 'app2', to: 'db' },
    { from: 'app2', to: 'queue' },
  ],
  packets: [
    ...hops(['user', 'lb', 'app1']),
    { from: 'app1', to: 'db', label: 'key=ana', tone: 'data', delay: 1.1, dur: 0.6 },
    { from: 'app1', to: 'replica', label: 'key=zoe', tone: 'data', delay: 1.4, dur: 0.8 },
  ],
  stats: stageStats(7, 'shards, services', 'global users'),
  note: { text: 'shard only when writes or data size force it', tone: 'bad' },
});

// Stage 8: multi-region.
const region = (r: 'a' | 'b', y: number, down = false): FlowNode[] => [
  { id: `lb${r}`, label: 'LB', kind: 'lb', shape: 'lb', x: 2.6, y, size: 'sm', status: down ? 'down' : 'normal' },
  { id: `app${r}`, label: 'App servers', kind: 'service', shape: 'server', x: 4, y, size: 'sm', status: down ? 'down' : 'normal' },
  { id: `db${r}`, label: 'Data', kind: 'db', shape: 'db', x: 5.4, y, size: 'sm', status: down ? 'down' : 'normal' },
];
const stage8 = (outage: boolean): FlowState => ({
  nodes: [USER, { id: 'geo', label: 'Geo routing', sub: 'DNS', kind: 'dns', x: 1.2, y: 1.6 }, ...region('a', 0.6, outage), ...region('b', 2.7)],
  links: [
    { from: 'user', to: 'geo' },
    { from: 'geo', to: 'lba', dashed: outage, tone: outage ? 'bad' : 'accent' },
    { from: 'geo', to: 'lbb', tone: outage ? 'accent' : undefined },
    { from: 'lba', to: 'appa' },
    { from: 'appa', to: 'dba' },
    { from: 'lbb', to: 'appb' },
    { from: 'appb', to: 'dbb' },
    { from: 'dba', to: 'dbb', dashed: true, label: 'replicate' },
  ],
  groups: [
    { label: 'region A', nodes: ['lba', 'appa', 'dba'], tone: outage ? 'bad' : 'accent' },
    { label: 'region B', nodes: ['lbb', 'appb', 'dbb'], tone: outage ? 'accent' : undefined },
  ],
  packets: outage ? hops(['user', 'geo', 'lbb', 'appb', 'dbb']) : hops(['user', 'geo', 'lba', 'appa', 'dba']),
  stats: outage
    ? [
        { label: 'Stage', value: '8 of 8' },
        { label: 'Region A', value: 'down', tone: 'bad' },
        { label: 'Users go to', value: 'region B', tone: 'ok' },
      ]
    : [
        { label: 'Stage', value: '8 of 8' },
        { label: 'Adds', value: 'regions', tone: 'ok' },
        { label: 'Costs', value: 'latency, sync', tone: 'bad' },
      ],
  note: outage ? { text: 'a regional outage becomes a reroute', tone: 'accent' } : undefined,
});

const RECAP: FlowState = { ...stage7(), packets: undefined, note: undefined, stats: [{ label: 'First', value: 'scale up' }, { label: 'Then', value: 'stateless + LB' }, { label: 'Last', value: 'shard, regions' }] };

export default defineLesson('flow', {
  slug: 'scaling-stages',
  objectives: [
    { text: 'Scale up before scaling out', step: 1 },
    { text: 'Make app servers stateless so a balancer can spread load', step: 3 },
    { text: 'Use cache, CDN and read replicas for read-heavy load', step: 5 },
    { text: 'Move slow work to queues and shard only when forced', step: 7 },
    { text: 'Name the trigger that moves you to each stage', step: 9 },
  ],
  steps: [
    {
      label: 'One box',
      title: 'Stage 1: everything on one server',
      tag: 'problem',
      body: [
        'Every system starts as one box running the app and the database. Scaling **up** (a bigger machine) is the simplest first fix.',
        'Eventually the app and database fight over the same CPU and memory.',
      ],
      keyIdea: 'Scale up first, until it hurts. A modern server handles far more than people assume.',
      frames: [
        { state: stage1(false), hold: 1700 },
        { state: stage1(true) },
      ],
    },
    {
      label: 'Split DB',
      title: 'Stage 2: give the database its own host',
      tag: 'technique',
      body: [
        'Move the database to a separate machine so each side gets its own resources.',
        'Now a single app server is the limit, and if it dies the site is down.',
      ],
      keyIdea: 'Trigger: app and DB compete for CPU and memory. Fix: separate hosts.',
      frames: [
        { state: stage2(false), hold: 1700 },
        { state: stage2(true) },
      ],
    },
    {
      label: 'Scale out',
      title: 'Stage 3: balancer plus stateless servers',
      tag: 'technique',
      body: [
        'Add a **load balancer** and several app servers. They must be **stateless**: sessions go to a shared store (or a signed token), uploads to object storage.',
        'Then any server can serve any request.',
      ],
      keyIdea: 'State does not disappear. It moves to the data tier, where the hard problems concentrate.',
      frames: [
        { state: stage3(false), hold: 2000 },
        { state: stage3(true) },
      ],
    },
    {
      label: 'Cache + CDN',
      title: 'Stage 4: stop hitting the database for reads',
      tag: 'technique',
      body: [
        'Database reads dominate and latency grows. Add **Redis or Memcached** for hot data and a **CDN** for static assets.',
      ],
      keyIdea: 'Trigger: DB reads dominate. Fix: cache in front of the DB, CDN in front of everything static.',
      frames: [{ state: stage4() }],
    },
    {
      label: 'Replicas',
      title: 'Stage 5: read replicas',
      tag: 'technique',
      body: [
        'Read QPS outgrows one primary. Add **read replicas** that copy the primary and serve reads.',
        'Writes still go to the primary, and replicas lag slightly behind it.',
      ],
      keyIdea: 'Replicas scale reads, not writes, and you must accept replication lag.',
      frames: [{ state: stage5() }],
    },
    {
      label: 'Queues',
      title: 'Stage 6: queues and async workers',
      tag: 'technique',
      body: [
        'Slow work like email, video or reports blocks requests. Put it on a **message queue** and let **workers** process it, with retries.',
      ],
      keyIdea: 'Trigger: slow work blocks requests. Fix: queue, workers, retries.',
      frames: [{ state: stage6() }],
    },
    {
      label: 'Shard',
      title: 'Stage 7: shard the data, split services',
      tag: 'trade-off',
      body: [
        'Write volume or data size outgrows one database node. **Shard** the data by key and decompose the app into services.',
        'This is the expensive step. Do not shard early: scale up, cache and replicate first.',
      ],
      keyIdea: 'Shard when writes or data size force it, not before.',
      frames: [{ state: stage7() }],
    },
    {
      label: 'Regions',
      title: 'Stage 8: multi-region',
      tag: 'trade-off',
      body: [
        'Global users, regional outages or data residency rules push you to **multiple regions** with geo routing.',
        'Cross-region latency, consistency and cost come with it.',
      ],
      keyIdea: 'Trigger: global users, regional outages, compliance. Fix: multi-region, geo routing, data residency.',
      frames: [
        { state: stage8(false), hold: 2400 },
        { state: stage8(true) },
      ],
    },
    {
      label: 'Recap',
      title: 'Name the stage and its trigger',
      tag: 'recap',
      body: [
        '- **Scale up first:** simple, until the hardware ceiling or a single point of failure.',
        '- **Scale out:** load balancer plus stateless servers, sessions in a shared store.',
        '- **Reads:** cache, CDN, then read replicas.',
        '- **Slow work:** queues and workers.',
        '- **Writes and size:** shard and split services, then go multi-region.',
      ],
      keyIdea: 'In an interview, say which stage you are at and what would trigger the next one.',
      frames: [{ state: RECAP }],
    },
  ],
});
