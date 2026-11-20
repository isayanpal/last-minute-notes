import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';

/*
 * Layout: the synchronous path runs along the top row (y 0.6), left to right.
 * DNS sits under the client, the service's dependencies fan out below and to the right.
 * The async scene keeps the same ids, so the queue side glides into place.
 */

const CLIENT: FlowNode = { id: 'client', label: 'Client', sub: 'browser or app', kind: 'client', x: 0, y: 0.6 };
const DNS: FlowNode = { id: 'dns', label: 'DNS', sub: 'name -> IP', kind: 'dns', x: 0, y: 2.5 };
const CDN: FlowNode = { id: 'cdn', label: 'CDN', sub: 'edge', kind: 'cdn', x: 1.2, y: 0.6 };
const LB: FlowNode = { id: 'lb', label: 'Load balancer', kind: 'lb', x: 2.4, y: 0.6 };
const GW: FlowNode = { id: 'gw', label: 'API gateway', kind: 'gateway', x: 3.6, y: 0.6 };
const SVC: FlowNode = { id: 'svc', label: 'Service', sub: 'stateless', kind: 'service', x: 4.8, y: 0.6 };
const CACHE: FlowNode = { id: 'cache', label: 'Cache', kind: 'cache', x: 6, y: 1.7 };
const DB: FlowNode = { id: 'db', label: 'Database', kind: 'db', x: 4.8, y: 2.7 };
const QUEUE: FlowNode = { id: 'queue', label: 'Queue', kind: 'queue', x: 3.6, y: 1.9 };

const ALL: FlowNode[] = [CLIENT, DNS, CDN, LB, GW, SVC, CACHE, DB, QUEUE];

const LINKS: FlowLink[] = [
  { from: 'client', to: 'dns', dashed: true },
  { from: 'client', to: 'cdn' },
  { from: 'cdn', to: 'lb' },
  { from: 'lb', to: 'gw' },
  { from: 'gw', to: 'svc' },
  { from: 'svc', to: 'cache' },
  { from: 'svc', to: 'db' },
  { from: 'svc', to: 'queue' },
];

/** Chain packets along a path, each hop starting when the previous one lands. */
const chain = (ids: string[], opts: { start?: number; dur?: number; tone?: Packet['tone']; label?: string; stayLast?: boolean } = {}): Packet[] => {
  const dur = opts.dur ?? 0.5;
  const start = opts.start ?? 0;
  return ids.slice(1).map((to, i) => ({
    from: ids[i],
    to,
    dur,
    delay: start + i * dur,
    tone: opts.tone ?? 'req',
    label: i === 0 ? opts.label : undefined,
    stay: opts.stayLast && i === ids.length - 2 ? true : undefined,
  }));
};

const HOPS = ['client', 'cdn', 'lb', 'gw', 'svc'];

/** Scene with every node, some dimmed so the current hop stands out. */
const scene = (focus: string[] | 'all', over: Partial<FlowState> = {}, changes: Record<string, Partial<FlowNode>> = {}): FlowState => {
  const dimmed: Record<string, Partial<FlowNode>> = {};
  if (focus !== 'all') for (const n of ALL) if (!focus.includes(n.id)) dimmed[n.id] = { status: 'dim' };
  return {
    nodes: patch(patch(ALL, dimmed), changes),
    links: LINKS,
    ...over,
  };
};

// Step 1: one click, many hops.
const overview = (packets?: Packet[]): FlowState =>
  scene('all', {
    packets,
    stats: [
      { label: 'Hops', value: '6+' },
      { label: 'Each hop adds', value: 'latency, risk' },
      { label: 'Each hop buys', value: 'scale, safety' },
    ],
  });

// Step 2: DNS lookup comes first.
const dnsLookup = (answered: boolean): FlowState =>
  scene(
    ['client', 'dns'],
    {
      links: [{ from: 'client', to: 'dns', tone: 'accent' }, ...LINKS.slice(1)],
      packets: answered
        ? [{ from: 'dns', to: 'client', label: '203.0.113.7', tone: 'res', dur: 0.8 }]
        : [{ from: 'client', to: 'dns', label: 'api.app.com?', dur: 0.8 }],
      stats: [
        { label: 'Hop', value: '1: DNS' },
        { label: 'Answer', value: answered ? 'cached by TTL' : 'pending' },
        { label: 'If DNS fails', value: 'nothing works', tone: 'bad' },
      ],
      note: answered ? { text: 'now the client knows where to connect', tone: 'accent' } : undefined,
    },
    answered ? { client: { badge: { text: 'IP cached', tone: 'ok' } } } : {},
  );

// Step 3: the CDN answers static content at the edge, passes the rest on.
const edge = (hit: boolean): FlowState =>
  scene(hit ? ['client', 'cdn'] : ['client', 'cdn', 'lb'], {
    packets: hit
      ? [
          { from: 'client', to: 'cdn', label: '/img/a.jpg', tone: 'data', dur: 0.6 },
          { from: 'cdn', to: 'client', tone: 'res', delay: 0.9, dur: 0.6 },
        ]
      : chain(['client', 'cdn', 'lb'], { label: 'POST /orders', dur: 0.6 }),
    stats: hit
      ? [
          { label: 'Request', value: 'static image' },
          { label: 'Served by', value: 'edge', tone: 'ok' },
          { label: 'Origin load', value: 'none', tone: 'ok' },
        ]
      : [
          { label: 'Request', value: 'dynamic API' },
          { label: 'Served by', value: 'origin' },
          { label: 'CDN role', value: 'pass through' },
        ],
    note: hit ? { text: 'cache hit at the edge: a few ms', tone: 'ok' } : { text: 'personal or dynamic: forward to the origin' },
  }, hit ? { cdn: { badge: { text: 'hit', tone: 'ok' } } } : {});

// Step 4: the balancer picks a healthy server, the gateway checks the caller.
const frontDoor = (stage: 'lb' | 'gw-reject' | 'gw-pass'): FlowState =>
  scene(
    ['client', 'cdn', 'lb', 'gw', 'svc'],
    {
      packets:
        stage === 'lb'
          ? chain(['cdn', 'lb', 'gw'], { dur: 0.6 })
          : stage === 'gw-reject'
            ? [{ from: 'lb', to: 'gw', dur: 0.6, tone: 'bad', label: 'no token' }]
            : chain(['lb', 'gw', 'svc'], { dur: 0.6, label: 'token ok' }),
      stats:
        stage === 'lb'
          ? [
              { label: 'LB job', value: 'spread load' },
              { label: 'Skips', value: 'unhealthy' },
              { label: 'Clients see', value: '1 address' },
            ]
          : [
              { label: 'Gateway job', value: 'cross-cutting' },
              { label: 'Checks', value: 'auth, limits' },
              { label: 'Outcome', value: stage === 'gw-reject' ? 'rejected' : 'routed', tone: stage === 'gw-reject' ? 'bad' : 'ok' },
            ],
      note:
        stage === 'gw-reject'
          ? { text: 'bad callers stop at the edge, services never see them', tone: 'bad' }
          : stage === 'gw-pass'
            ? { text: 'only checked traffic reaches the service', tone: 'accent' }
            : undefined,
    },
    stage === 'lb'
      ? { lb: { badge: { text: 'healthy server', tone: 'accent' } } }
      : { gw: { badge: { text: stage === 'gw-reject' ? 'rejected' : 'auth ok', tone: stage === 'gw-reject' ? 'bad' : 'ok' } } },
  );

// Step 5: the service reads through a cache before the database.
const dataTier = (hit: boolean): FlowState =>
  scene(
    ['svc', 'cache', 'db'],
    {
      packets: hit
        ? [
            { from: 'svc', to: 'cache', label: 'user:42', tone: 'req', dur: 0.6 },
            { from: 'cache', to: 'svc', tone: 'res', delay: 0.7, dur: 0.6 },
          ]
        : [
            { from: 'svc', to: 'cache', label: 'user:42', tone: 'req', dur: 0.6 },
            { from: 'svc', to: 'db', tone: 'req', delay: 0.8, dur: 0.6 },
            { from: 'db', to: 'svc', tone: 'data', delay: 1.5, dur: 0.6 },
            { from: 'svc', to: 'cache', tone: 'data', label: 'fill', delay: 2.2, dur: 0.6 },
          ],
      stats: [
        { label: 'Lookup', value: hit ? 'cache hit' : 'cache miss', tone: hit ? 'ok' : 'bad' },
        { label: 'DB touched', value: hit ? 'no' : 'yes' },
        { label: 'State lives in', value: 'cache + DB' },
      ],
      note: hit ? { text: 'next time the cache answers alone', tone: 'ok' } : undefined,
    },
    hit ? { cache: { items: ['user:42'], badge: { text: 'hit', tone: 'ok' } } } : { cache: { badge: { text: 'miss', tone: 'bad' } } },
  );

// Step 6: slow work goes through a queue to workers.
const ASYNC_NODES: FlowNode[] = [
  CLIENT,
  { ...CDN, status: 'dim' },
  { ...LB, status: 'dim' },
  { ...GW, status: 'dim' },
  SVC,
  QUEUE,
  { id: 'workers', label: 'Workers', kind: 'worker', x: 2.4, y: 2.9 },
  { id: 'store', label: 'Object storage', kind: 'storage', x: 1.1, y: 2.9 },
  DB,
];
const ASYNC_LINKS: FlowLink[] = [
  ...LINKS.slice(1, 5),
  { from: 'svc', to: 'db' },
  { from: 'svc', to: 'queue' },
  { from: 'queue', to: 'workers' },
  { from: 'workers', to: 'store' },
  { from: 'workers', to: 'db' },
];
const async = (phase: 'enqueue' | 'work'): FlowState => ({
  nodes: patch(ASYNC_NODES, phase === 'enqueue' ? { queue: { items: ['resize'] } } : { workers: { status: 'active' } }),
  links: ASYNC_LINKS,
  packets:
    phase === 'enqueue'
      ? [
          { from: 'svc', to: 'queue', label: 'job', tone: 'data', dur: 0.7 },
          { from: 'svc', to: 'client', label: 'queued', tone: 'res', delay: 0.8, dur: 1.0 },
        ]
      : [
          { from: 'queue', to: 'workers', label: 'resize', tone: 'data', dur: 0.7 },
          { from: 'workers', to: 'store', label: 'thumb', tone: 'data', delay: 0.9, dur: 0.7 },
          { from: 'workers', to: 'db', label: 'url', tone: 'data', delay: 1.0, dur: 0.9 },
        ],
  stats:
    phase === 'enqueue'
      ? [
          { label: 'User waits for', value: 'enqueue only', tone: 'ok' },
          { label: 'Slow work', value: 'later' },
          { label: 'Queue', value: '1 job' },
        ]
      : [
          { label: 'Workers', value: 'scale apart' },
          { label: 'Blobs go to', value: 'object store' },
          { label: 'Metadata', value: 'database' },
        ],
  note: phase === 'enqueue' ? { text: 'reply fast, do the slow part off the request path', tone: 'accent' } : undefined,
});

// Step 7: every hop costs something and buys something.
const ledger = (side: 'adds' | 'buys'): FlowState =>
  scene(
    'all',
    {
      stats:
        side === 'adds'
          ? [
              { label: 'Adds', value: 'latency', tone: 'bad' },
              { label: 'Adds', value: 'failure modes', tone: 'bad' },
              { label: 'Adds', value: 'cost', tone: 'bad' },
            ]
          : [
              { label: 'Buys', value: 'scale', tone: 'ok' },
              { label: 'Buys', value: 'safety', tone: 'ok' },
              { label: 'Buys', value: 'speed', tone: 'ok' },
            ],
      note: side === 'adds' ? { text: 'what does this hop add?', tone: 'bad' } : { text: 'what does this hop buy?', tone: 'ok' },
    },
    side === 'adds'
      ? {
          dns: { badge: { text: 'hidden SPOF', tone: 'bad' } },
          cdn: { badge: { text: 'privacy risk', tone: 'bad' } },
          lb: { badge: { text: 'SPOF if one', tone: 'bad' } },
          gw: { badge: { text: 'extra hop', tone: 'bad' } },
          cache: { badge: { text: 'subtle bugs', tone: 'bad' } },
        }
      : {
          dns: { badge: { text: 'steering', tone: 'ok' } },
          cdn: { badge: { text: 'offloads', tone: 'ok' } },
          lb: { badge: { text: 'spreads', tone: 'ok' } },
          gw: { badge: { text: 'auth once', tone: 'ok' } },
          cache: { badge: { text: 'fast reads', tone: 'ok' } },
        },
  );

const RECAP: FlowState = scene(
  'all',
  {
    links: LINKS.map((l) => (l.from === 'client' && l.to === 'dns' ? l : { ...l, tone: 'accent' as const })),
    packets: [...chain(['client', 'dns'], { dur: 0.5 }), ...chain(HOPS, { start: 0.6, dur: 0.45 }), ...chain(['svc', 'db'], { start: 2.4, dur: 0.5 })],
    stats: [
      { label: 'Sync path', value: '6 hops' },
      { label: 'Async path', value: 'queue', hint: 'workers, storage' },
      { label: 'Question', value: 'add vs buy' },
    ],
  },
);

export default defineLesson('flow', {
  slug: 'request-path',
  objectives: [
    { text: 'Name every hop a request crosses, in order', step: 1 },
    { text: 'Why DNS and the CDN come before your servers', step: 3 },
    { text: 'What the balancer, gateway and cache each do on the path', step: 5 },
    { text: 'Move slow work off the request path with a queue', step: 6 },
    { text: 'Ask what each hop adds and what it buys', step: 7 },
  ],
  steps: [
    {
      label: 'The path',
      title: 'One click, many hops',
      tag: 'problem',
      body: [
        'A user taps a button. Before any of your code runs, the request crosses DNS, a CDN, a load balancer and an API gateway.',
        'Most designs are variations on this one path, so trace it end to end first.',
      ],
      keyIdea: 'Know the default path cold. Every system design answer starts by drawing it.',
      frames: [
        { state: overview(), hold: 1000 },
        { state: { ...overview([...chain(['client', 'dns'], { dur: 0.5 }), ...chain(HOPS, { start: 0.6, dur: 0.5 }), ...chain(['svc', 'db'], { start: 2.7, dur: 0.5 })]), note: { text: 'client -> DNS -> CDN -> LB -> gateway -> service -> data' } } },
      ],
    },
    {
      label: 'DNS',
      title: 'First, find the address',
      tag: 'concept',
      body: [
        'The client only knows a name. **DNS** turns it into an IP address, and resolvers cache the answer for its TTL.',
        'It is the first dependency of almost every request, which makes it a hidden single point of failure.',
      ],
      keyIdea: 'No DNS answer, no request. Treat DNS as part of your system, not as plumbing.',
      frames: [
        { state: dnsLookup(false), hold: 1500 },
        { state: dnsLookup(true) },
      ],
    },
    {
      label: 'CDN',
      title: 'The edge answers what it can',
      tag: 'concept',
      body: [
        'The request lands at a **CDN** edge close to the user. Static files like images are served right there.',
        'Dynamic or personal requests pass through to your origin.',
      ],
      keyIdea: 'Every request the edge answers is one your origin never sees.',
      frames: [
        { state: edge(true), hold: 2000 },
        { state: edge(false) },
      ],
    },
    {
      label: 'Front door',
      title: 'Balance, then guard',
      tag: 'technique',
      body: [
        'The **load balancer** hands the request to a healthy server behind one stable address.',
        'The **API gateway** handles cross-cutting concerns once: authentication, rate limiting and routing. Bad callers stop here.',
      ],
      keyIdea: 'Keep auth and throttling at the edge so services stay small. Keep business logic out of the gateway.',
      frames: [
        { state: frontDoor('lb'), hold: 1700 },
        { state: frontDoor('gw-reject'), hold: 1700 },
        { state: frontDoor('gw-pass') },
      ],
    },
    {
      label: 'Data',
      title: 'A stateless service, a cache, a database',
      tag: 'technique',
      body: [
        'The **service** keeps no per-user state, so any instance can take the request. State lives in the data tier.',
        'It checks the **cache** first. On a miss it reads the database and fills the cache for next time.',
      ],
      keyIdea: 'Stateless services are easy to scale. The hard problems concentrate in the cache and the database.',
      frames: [
        { state: dataTier(false), hold: 3000 },
        { state: dataTier(true) },
      ],
    },
    {
      label: 'Async',
      title: 'Slow work goes to a queue',
      tag: 'technique',
      body: [
        'Some work is slow: resizing a photo, sending an email. The service drops a job on a **queue** and replies right away.',
        '**Workers** pull jobs, write blobs to object storage and metadata to the database.',
      ],
      keyIdea: 'The user waits only for the enqueue. Workers scale on their own and retry on failure.',
      frames: [
        { state: async('enqueue'), hold: 2200 },
        { state: async('work') },
      ],
    },
    {
      label: 'Add vs buy',
      title: 'Every hop has a price',
      tag: 'trade-off',
      body: [
        'At every hop ask two questions. What does it **add**: latency, a failure mode, cost?',
        'And what does it **buy**: scale, safety, speed? A hop that buys nothing should not be on the path.',
      ],
      keyIdea: 'Justify each box you draw by what it buys, and name what it costs.',
      frames: [
        { state: ledger('adds'), hold: 2400 },
        { state: ledger('buys') },
      ],
    },
    {
      label: 'Recap',
      title: 'The default request path',
      tag: 'recap',
      body: [
        '- **DNS** turns the name into an address and is a hidden dependency.',
        '- **CDN** serves static and shared content at the edge.',
        '- **Load balancer** spreads load, **gateway** handles auth and limits.',
        '- **Stateless service** reads the cache, then the database.',
        '- **Queue and workers** take slow work off the request path.',
      ],
      keyIdea: 'Draw this path first, then change only the parts your problem needs.',
      frames: [{ state: RECAP }],
    },
  ],
});
