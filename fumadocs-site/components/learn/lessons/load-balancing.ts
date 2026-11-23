import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';

/*
 * Layout: clients on the left (x 0), the load balancer in the middle (x 2.3), servers on the right (x 4.8).
 */

const CLIENTS: FlowNode[] = [
  { id: 'c1', label: 'Client', kind: 'client', shape: 'laptop', x: 0, y: 0.4, size: 'sm' },
  { id: 'c2', label: 'Client', kind: 'client', shape: 'laptop', x: 0, y: 1.6, size: 'sm' },
  { id: 'c3', label: 'Client', kind: 'client', shape: 'laptop', x: 0, y: 2.8, size: 'sm' },
];
const LB: FlowNode = { id: 'lb', label: 'Load balancer', sub: 'one stable address', kind: 'lb', shape: 'lb', x: 2.3, y: 1.6 };
const SERVERS: FlowNode[] = [
  { id: 's1', label: 'Server 1', kind: 'service', shape: 'server', x: 4.8, y: 0.3 },
  { id: 's2', label: 'Server 2', kind: 'service', shape: 'server', x: 4.8, y: 1.6 },
  { id: 's3', label: 'Server 3', kind: 'service', shape: 'server', x: 4.8, y: 2.9 },
];

const links = (servers: FlowNode[], lb = 'lb'): FlowLink[] => [
  ...CLIENTS.map((c) => ({ from: c.id, to: lb })),
  ...servers.map((s) => ({ from: lb, to: s.id })),
];

/** Client -> LB -> server, with the second hop starting when the first lands. */
const via = (client: string, server: string, label: string, delay = 0, tone: Packet['tone'] = 'req'): Packet[] => [
  { from: client, to: 'lb', label, delay, tone, dur: 0.6 },
  { from: 'lb', to: server, label, delay: delay + 0.6, tone, dur: 0.6 },
];

const meter = (value: number, label: string) => ({ value, label, tone: value > 0.85 ? ('bad' as const) : value > 0.6 ? ('accent' as const) : ('ok' as const) });

// Step 1: everyone hits one box.
const single: FlowState = {
  nodes: [...CLIENTS, { id: 'solo', label: 'Server', sub: 'the only one', kind: 'service', shape: 'server', x: 4.2, y: 1.6, status: 'hot', meter: meter(0.97, 'CPU 97%') }],
  links: CLIENTS.map((c) => ({ from: c.id, to: 'solo' })),
  packets: CLIENTS.map((c, i) => ({ from: c.id, to: 'solo', delay: i * 0.25 })),
  stats: [
    { label: 'Servers', value: '1' },
    { label: 'Load per server', value: '100%', tone: 'bad' },
    { label: 'If it dies', value: 'site down', tone: 'bad' },
  ],
  note: { text: 'one server: no headroom, no redundancy', tone: 'bad' },
};

const fleet = (over: Partial<FlowState> = {}): FlowState => ({
  nodes: [...CLIENTS, LB, ...SERVERS],
  links: links(SERVERS),
  ...over,
});

const rr = (n: number): FlowState =>
  fleet({
    nodes: [...CLIENTS, patch([LB], { lb: { badge: { text: `next → server ${(n % 3) + 1}`, tone: 'accent' } } })[0], ...SERVERS],
    packets: via(CLIENTS[n % 3].id, SERVERS[n % 3].id, `req ${n + 1}`),
    stats: [
      { label: 'Algorithm', value: 'round robin' },
      { label: 'Requests', value: String(n + 1) },
      { label: 'Split', value: '1 : 1 : 1', tone: 'ok' },
    ],
  });

// Least connections: server 2 is stuck on a slow request.
const busy = (s2: number, extra: Partial<FlowState> = {}): FlowState =>
  fleet({
    nodes: [
      ...CLIENTS,
      LB,
      ...patch(SERVERS, {
        s1: { meter: meter(0.3, '2 active') },
        s2: { meter: meter(s2, `${Math.round(s2 * 10)} active`), status: s2 > 0.85 ? 'hot' : 'normal' },
        s3: { meter: meter(0.2, '1 active') },
      }),
    ],
    ...extra,
  });

const health = (s3: 'normal' | 'down', extra: Partial<FlowState> = {}): FlowState =>
  fleet({
    nodes: [
      ...CLIENTS,
      LB,
      ...patch(SERVERS, {
        s3: s3 === 'down' ? { status: 'down', badge: { text: 'failed 3 checks', tone: 'bad' } } : {},
      }),
    ],
    links: [...CLIENTS.map((c) => ({ from: c.id, to: 'lb' })), { from: 'lb', to: 's1' }, { from: 'lb', to: 's2' }, { from: 'lb', to: 's3', dashed: s3 === 'down', tone: s3 === 'down' ? 'bad' : undefined }],
    ...extra,
  });

// L7 routing by path into two pools.
const L7_NODES: FlowNode[] = [
  ...CLIENTS,
  { ...LB, label: 'L7 balancer', sub: 'reads the HTTP path' },
  { id: 'a1', label: 'API', sub: '/api/*', kind: 'service', shape: 'server', x: 4.6, y: 0.3, size: 'sm' },
  { id: 'a2', label: 'API', sub: '/api/*', kind: 'service', shape: 'server', x: 5.7, y: 0.9, size: 'sm' },
  { id: 'i1', label: 'Images', sub: '/img/*', kind: 'storage', shape: 'disk', x: 4.6, y: 2.5, size: 'sm' },
  { id: 'i2', label: 'Images', sub: '/img/*', kind: 'storage', shape: 'disk', x: 5.7, y: 3.1, size: 'sm' },
];
const l7 = (packets: Packet[], note?: FlowState['note']): FlowState => ({
  nodes: L7_NODES,
  links: [...CLIENTS.map((c) => ({ from: c.id, to: 'lb' })), ...['a1', 'a2', 'i1', 'i2'].map((id) => ({ from: 'lb', to: id }))],
  groups: [
    { label: 'api pool', nodes: ['a1', 'a2'] },
    { label: 'image pool', nodes: ['i1', 'i2'] },
  ],
  packets,
  stats: [
    { label: 'Layer', value: 'L7 (HTTP)' },
    { label: 'Can do', value: 'path, header, TLS' },
    { label: 'L4 instead', value: 'faster, blind', hint: 'TCP only' },
  ],
  note,
});

// The balancer itself is a single point of failure, so run a pair behind a virtual IP.
const pair = (activeDown: boolean): FlowState => ({
  nodes: [
    ...CLIENTS,
    { id: 'lbA', label: 'LB active', kind: 'lb', shape: 'lb', x: 2.3, y: 0.9, status: activeDown ? 'down' : 'active', badge: activeDown ? undefined : { text: 'owns VIP 10.0.0.5', tone: 'accent' } },
    { id: 'lbB', label: activeDown ? 'LB (now active)' : 'LB standby', kind: 'lb', x: 2.3, y: 2.4, status: activeDown ? 'active' : 'dim', badge: activeDown ? { text: 'took over VIP', tone: 'accent' } : undefined },
    ...SERVERS,
  ],
  links: [
    ...CLIENTS.map((c) => ({ from: c.id, to: activeDown ? 'lbB' : 'lbA' })),
    ...SERVERS.map((s) => ({ from: activeDown ? 'lbB' : 'lbA', to: s.id })),
    { from: 'lbA', to: 'lbB', dashed: true, label: 'heartbeat' },
  ],
  packets: activeDown
    ? [
        { from: 'c2', to: 'lbB', delay: 0.2, dur: 0.6 },
        { from: 'lbB', to: 's2', delay: 0.8, dur: 0.6 },
      ]
    : [
        { from: 'lbA', to: 'lbB', tone: 'data', label: 'alive', dur: 0.7 },
        { from: 'c1', to: 'lbA', delay: 0.4, dur: 0.6 },
        { from: 'lbA', to: 's1', delay: 1.0, dur: 0.6 },
      ],
  stats: [
    { label: 'Balancers', value: '2', hint: 'active + standby' },
    { label: 'Clients see', value: '1 address' },
    { label: 'Failover', value: activeDown ? 'seconds' : '-', tone: activeDown ? 'ok' : 'neutral' },
  ],
  note: activeDown ? { text: 'heartbeat stopped: standby claims the virtual IP', tone: 'accent' } : undefined,
});

// Global: DNS or anycast picks a region, a regional LB picks a server.
const GLOBAL: FlowState = {
  nodes: [
    { id: 'u', label: 'User', sub: 'in Mumbai', kind: 'client', shape: 'laptop', x: 0, y: 1.6 },
    { id: 'dns', label: 'GeoDNS', sub: 'or anycast', kind: 'dns', x: 1.8, y: 1.6 },
    { id: 'lbE', label: 'LB', kind: 'lb', shape: 'lb', x: 3.6, y: 0.5, size: 'sm' },
    { id: 'sE1', label: 'Server', kind: 'service', shape: 'server', x: 5.2, y: 0.2, size: 'sm' },
    { id: 'sE2', label: 'Server', kind: 'service', shape: 'server', x: 5.2, y: 0.95, size: 'sm' },
    { id: 'lbW', label: 'LB', kind: 'lb', shape: 'lb', x: 3.6, y: 2.75, size: 'sm', status: 'dim' },
    { id: 'sW1', label: 'Server', kind: 'service', shape: 'server', x: 5.2, y: 2.45, size: 'sm', status: 'dim' },
    { id: 'sW2', label: 'Server', kind: 'service', shape: 'server', x: 5.2, y: 3.2, size: 'sm', status: 'dim' },
  ],
  links: [
    { from: 'u', to: 'dns' },
    { from: 'dns', to: 'lbE', tone: 'accent' },
    { from: 'dns', to: 'lbW', dashed: true },
    { from: 'lbE', to: 'sE1' },
    { from: 'lbE', to: 'sE2' },
    { from: 'lbW', to: 'sW1' },
    { from: 'lbW', to: 'sW2' },
  ],
  groups: [
    { label: 'ap-south', nodes: ['lbE', 'sE1', 'sE2'], tone: 'accent' },
    { label: 'us-east', nodes: ['lbW', 'sW1', 'sW2'] },
  ],
  packets: [
    { from: 'u', to: 'dns', label: 'nearest?', dur: 0.6 },
    { from: 'dns', to: 'lbE', delay: 0.6, dur: 0.6 },
    { from: 'lbE', to: 'sE2', delay: 1.2, dur: 0.5 },
  ],
  stats: [
    { label: 'Picks region', value: 'DNS / anycast' },
    { label: 'Picks server', value: 'regional LB' },
    { label: 'Latency', value: 'nearest region', tone: 'ok' },
  ],
};

export default defineLesson('flow', {
  slug: 'load-balancing',
  objectives: [
    { text: 'Why one server is both a bottleneck and a single point of failure', step: 1 },
    { text: 'Round robin vs least connections', step: 4 },
    { text: 'How health checks route around failures', step: 5 },
    { text: 'L4 vs L7, and keeping the balancer itself available', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'One server takes every request',
      tag: 'problem',
      body: [
        'All clients talk to a single server. When traffic grows its CPU pins at the limit and every request slows down.',
        'Worse, if that box dies the whole site is gone.',
      ],
      keyIdea: 'Scaling out means many servers, and many servers need something in front that hands out the work.',
      frames: [{ state: single }],
    },
    {
      label: 'Add a balancer',
      title: 'One address, many servers',
      tag: 'concept',
      body: [
        'Put a **load balancer** in front. Clients only ever see its address.',
        'Behind it you can add, remove or replace servers without any client noticing.',
      ],
      keyIdea: 'A load balancer spreads requests, removes unhealthy servers, and gives clients one stable address.',
      frames: [
        { state: fleet({ stats: [{ label: 'Servers', value: '3' }, { label: 'Client config', value: '1 address', tone: 'ok' }, { label: 'Load per server', value: '~33%', tone: 'ok' }] }), hold: 900 },
        {
          state: fleet({
            packets: [...via('c1', 's1', 'req', 0), ...via('c2', 's2', 'req', 0.3), ...via('c3', 's3', 'req', 0.6)],
            stats: [{ label: 'Servers', value: '3' }, { label: 'Client config', value: '1 address', tone: 'ok' }, { label: 'Load per server', value: '~33%', tone: 'ok' }],
          }),
        },
      ],
    },
    {
      label: 'Round robin',
      title: 'Take turns',
      tag: 'technique',
      body: [
        '**Round robin** hands each new request to the next server in the list, then wraps around.',
        'It is simple and fair when servers are equal and requests cost about the same.',
      ],
      keyIdea: 'Round robin ignores load. One slow request does not change whose turn it is.',
      frames: [0, 1, 2, 3].map((n) => ({ state: rr(n), hold: 1500 })),
    },
    {
      label: 'Least conns',
      title: 'Send work to the least busy',
      tag: 'technique',
      body: [
        'Server 2 is stuck on a few slow report exports. Round robin would keep feeding it.',
        '**Least connections** tracks open connections per server and picks the one with the fewest. Weighted variants also send more to bigger machines.',
      ],
      keyIdea: 'For long-lived or uneven requests, balance on load, not on turns. At large scale, "power of two choices" picks 2 random servers and uses the less loaded one.',
      frames: [
        { state: busy(0.9, { note: { text: 'round robin would send the next one here', tone: 'bad' }, packets: via('c2', 's2', 'req 5', 0, 'bad') }), hold: 2200 },
        {
          state: busy(0.9, {
            packets: via('c2', 's3', 'req 5', 0, 'ok'),
            note: { text: 'least connections picks server 3', tone: 'accent' },
            stats: [
              { label: 'Algorithm', value: 'least conns' },
              { label: 'Server 2', value: '9 open', tone: 'bad' },
              { label: 'Chosen', value: 'server 3', tone: 'ok' },
            ],
          }),
        },
      ],
    },
    {
      label: 'Health checks',
      title: 'Route around a dead server',
      tag: 'technique',
      body: [
        'The balancer probes each server every few seconds, for example `GET /healthz`. It also watches real traffic for errors.',
        'After a few failed checks, server 3 is pulled out of rotation. Traffic keeps flowing to the healthy two.',
      ],
      keyIdea: 'Separate liveness (restart me) from readiness (send me traffic). On deploys, drain connections before removing a server.',
      frames: [
        {
          state: health('normal', {
            packets: SERVERS.map((s, i) => ({ from: 'lb', to: s.id, label: 'health?', tone: 'data' as const, delay: i * 0.2, dur: 0.6 })),
            stats: [{ label: 'Healthy', value: '3 / 3', tone: 'ok' }, { label: 'Check', value: 'GET /healthz' }, { label: 'Every', value: '5 s' }],
          }),
          hold: 1800,
        },
        {
          state: health('down', {
            stats: [{ label: 'Healthy', value: '2 / 3', tone: 'bad' }, { label: 'Removed', value: 'server 3' }, { label: 'Users notice', value: 'nothing', tone: 'ok' }],
          }),
          hold: 1400,
        },
        {
          state: health('down', {
            packets: [...via('c1', 's1', 'req', 0), ...via('c3', 's2', 'req', 0.3)],
            stats: [{ label: 'Healthy', value: '2 / 3', tone: 'bad' }, { label: 'Removed', value: 'server 3' }, { label: 'Users notice', value: 'nothing', tone: 'ok' }],
            note: { text: 'traffic only goes to healthy servers', tone: 'accent' },
          }),
        },
      ],
    },
    {
      label: 'L4 vs L7',
      title: 'Route by connection or by request',
      tag: 'trade-off',
      body: [
        'An **L4** balancer sees TCP connections only. It is very fast and protocol agnostic, but it cannot read the request.',
        'An **L7** balancer understands HTTP. It can route `/api` and `/img` to different pools, terminate TLS, retry and add auth.',
      ],
      keyIdea: 'L4 for raw speed and non-HTTP traffic (AWS NLB). L7 when routing depends on the request (AWS ALB, NGINX, Envoy).',
      frames: [
        { state: l7([...via('c1', 'a1', '/api/cart', 0)]), hold: 1500 },
        { state: l7([...via('c3', 'i2', '/img/42.png', 0, 'data')], { text: 'same balancer, different pool by path', tone: 'accent' }) },
      ],
    },
    {
      label: 'No SPOF',
      title: 'Balance the balancer',
      tag: 'trade-off',
      body: [
        'A single load balancer is now the single point of failure.',
        'Run a pair. The active one owns a **virtual IP** and sends heartbeats. If they stop, the standby claims the IP. Managed cloud balancers do this across zones for you.',
      ],
      keyIdea: 'Every layer needs redundancy, including the one that provides redundancy.',
      frames: [
        { state: pair(false), hold: 2200 },
        { state: pair(true) },
      ],
    },
    {
      label: 'Recap',
      title: 'Global, then regional',
      tag: 'recap',
      body: [
        '- **Why:** spread load, remove dead servers, give clients one address.',
        '- **Algorithms:** round robin for equal work, least connections for uneven work, consistent hash for cache locality.',
        '- **Health:** active probes plus passive error tracking, drain before removal.',
        '- **Layers:** L4 is fast and blind, L7 reads HTTP.',
        '- **At global scale:** DNS or anycast picks the region, a regional balancer picks the server.',
      ],
      keyIdea: 'Prefer stateless services so any server can take any request. Sticky sessions make balancing and failover harder.',
      frames: [{ state: GLOBAL }],
    },
  ],
});
