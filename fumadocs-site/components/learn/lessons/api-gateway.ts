import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';

/*
 * Layout: clients on the left (x 0), the edge component in the middle (x 2.0 to 2.2), services on the right (x 4.4).
 * The mesh step zooms in on service-to-service traffic with its own 2 x 2 layout.
 */

const WEB: FlowNode = { id: 'web', label: 'Web app', kind: 'client', shape: 'laptop', x: 0, y: 0.8 };
const MOBILE: FlowNode = { id: 'mobile', label: 'Mobile app', kind: 'client', shape: 'phone', x: 0, y: 2.4 };
const CLIENTS = [WEB, MOBILE];
const SERVICES: FlowNode[] = [
  { id: 'orders', label: 'Orders', kind: 'service', shape: 'server', x: 4.4, y: 0.3 },
  { id: 'users', label: 'Users', kind: 'service', shape: 'server', x: 4.4, y: 1.6 },
  { id: 'pay', label: 'Payments', kind: 'service', shape: 'server', x: 4.4, y: 2.9 },
];

const hop = (from: string, to: string, delay = 0, tone: Packet['tone'] = 'req', label?: string): Packet => ({ from, to, delay, dur: 0.6, tone, label });

// Step 1: every service re-implements the same edge concerns.
const DUP = ['auth', 'limits', 'logs'];
const direct = (): FlowState => ({
  nodes: [...CLIENTS, ...SERVICES.map((s) => ({ ...s, items: DUP }))],
  links: CLIENTS.flatMap((c) => SERVICES.map((s) => ({ from: c.id, to: s.id }))),
  packets: [hop('web', 'orders'), hop('web', 'users', 0.2), hop('mobile', 'users', 0.4), hop('mobile', 'pay', 0.6)],
  stats: [
    { label: 'Services', value: '3' },
    { label: 'Auth copies', value: '3', tone: 'bad' },
    { label: 'Clients know', value: '3 addresses', tone: 'bad' },
  ],
  note: { text: 'the same cross-cutting code, copied into every service', tone: 'bad' },
});

// Step 2: reverse proxy.
const PROXY: FlowNode = { id: 'proxy', label: 'Reverse proxy', sub: 'NGINX, Envoy', kind: 'lb', shape: 'lb', x: 2.1, y: 1.6 };
const proxyLinks: FlowLink[] = [...CLIENTS.map((c) => ({ from: c.id, to: 'proxy' })), ...SERVICES.map((s) => ({ from: 'proxy', to: s.id }))];
const proxy = (cached: boolean): FlowState => ({
  nodes: [...CLIENTS, { ...PROXY, items: cached ? ['/home'] : undefined, badge: cached ? { text: 'cache hit', tone: 'ok' } : { text: 'TLS ends here', tone: 'accent' } }, ...SERVICES],
  links: proxyLinks,
  packets: cached
    ? [hop('web', 'proxy', 0, 'req', '/home'), hop('proxy', 'web', 0.7, 'res', 'gzip')]
    : [hop('web', 'proxy', 0, 'req', 'https'), hop('proxy', 'orders', 0.6, 'req', 'http'), hop('orders', 'proxy', 1.3, 'res'), hop('proxy', 'web', 1.9, 'res', 'gzip')],
  stats: [
    { label: 'Sits', value: 'before servers' },
    { label: 'Does', value: 'TLS, routing' },
    { label: 'Also', value: 'gzip, caching' },
  ],
  note: cached ? { text: 'served from the proxy cache, compressed', tone: 'ok' } : undefined,
});

// Step 3: API gateway.
const GW: FlowNode = { id: 'gw', label: 'API gateway', sub: 'platform edge', kind: 'gateway', shape: 'gateway', x: 2.1, y: 1.6, items: ['auth', 'limits', 'keys'] };
const gwLinks: FlowLink[] = [...CLIENTS.map((c) => ({ from: c.id, to: 'gw' })), ...SERVICES.map((s) => ({ from: 'gw', to: s.id }))];
const gateway = (phase: 'no-key' | 'limited' | 'ok'): FlowState => ({
  nodes: [
    ...CLIENTS,
    {
      ...GW,
      badge: phase === 'no-key' ? { text: 'no API key', tone: 'bad' } : phase === 'limited' ? { text: '429 too many', tone: 'bad' } : { text: 'route /orders', tone: 'ok' },
    },
    ...SERVICES,
  ],
  links: gwLinks,
  packets:
    phase === 'no-key'
      ? [hop('mobile', 'gw', 0, 'bad', 'no key'), hop('gw', 'mobile', 0.8, 'bad')]
      : phase === 'limited'
        ? [0, 1, 2, 3].map((i) => hop('web', 'gw', i * 0.18, i < 2 ? 'req' : 'bad'))
        : [hop('web', 'gw', 0, 'req', '/orders'), hop('gw', 'orders', 0.6, 'ok')],
  stats: [
    { label: 'Checks', value: 'auth, keys' },
    { label: 'Throttles', value: 'per client' },
    { label: 'Outcome', value: phase === 'ok' ? 'routed' : 'rejected', tone: phase === 'ok' ? 'ok' : 'bad' },
  ],
  note:
    phase === 'ok'
      ? { text: 'services get only checked traffic, and stay small', tone: 'accent' }
      : phase === 'limited'
        ? { text: 'over the usage plan: rejected before any service works', tone: 'bad' }
        : undefined,
});

// Step 4: backend for frontend.
const BFFS: FlowNode[] = [
  { id: 'wbff', label: 'Web BFF', sub: 'for browsers', kind: 'gateway', shape: 'gateway', x: 2.1, y: 0.8 },
  { id: 'mbff', label: 'Mobile BFF', sub: 'for phones', kind: 'gateway', shape: 'gateway', x: 2.1, y: 2.4 },
];
const bff = (phase: 'fan' | 'reply'): FlowState => ({
  nodes: [...CLIENTS, ...patch(BFFS, { mbff: { status: 'active', badge: phase === 'reply' ? { text: '1 tailored reply', tone: 'ok' } : undefined }, wbff: { status: 'dim' } }), ...SERVICES],
  links: [
    { from: 'web', to: 'wbff' },
    { from: 'mobile', to: 'mbff' },
    ...SERVICES.flatMap((s) => [
      { from: 'wbff', to: s.id },
      { from: 'mbff', to: s.id, tone: 'accent' as const },
    ]),
  ],
  packets:
    phase === 'fan'
      ? [hop('mobile', 'mbff', 0, 'req', 'home screen'), ...SERVICES.map((s, i) => hop('mbff', s.id, 0.7 + i * 0.1, 'req')), ...SERVICES.map((s, i) => hop(s.id, 'mbff', 1.5 + i * 0.1, 'data'))]
      : [hop('mbff', 'mobile', 0, 'res', 'one payload')],
  stats: [
    { label: 'Client calls', value: '1', tone: 'ok' },
    { label: 'BFF calls', value: '3' },
    { label: 'Shaped for', value: 'mobile' },
  ],
  note: phase === 'reply' ? { text: 'one response, tailored to this client', tone: 'accent' } : undefined,
});

// Step 5: service mesh between services.
const MESH: FlowNode[] = [
  { id: 'orders', label: 'Orders', kind: 'service', shape: 'server', x: 1.2, y: 0.8, items: ['sidecar'] },
  { id: 'pay', label: 'Payments', kind: 'service', shape: 'server', x: 4.4, y: 0.8, items: ['sidecar'] },
  { id: 'users', label: 'Users', kind: 'service', shape: 'server', x: 1.2, y: 2.7, items: ['sidecar'] },
  { id: 'stock', label: 'Inventory', kind: 'service', shape: 'server', x: 4.4, y: 2.7, items: ['sidecar'] },
];
const meshLinks = (failed = false): FlowLink[] => [
  { from: 'orders', to: 'pay', label: 'mTLS', tone: failed ? 'bad' : undefined },
  { from: 'orders', to: 'stock' },
  { from: 'users', to: 'orders' },
  { from: 'users', to: 'stock' },
];
const mesh = (phase: 'mtls' | 'retry' | 'split'): FlowState => ({
  nodes:
    phase === 'retry'
      ? patch(MESH, { orders: { badge: { text: 'sidecar retries', tone: 'accent' } } })
      : phase === 'split'
        ? patch(MESH, { stock: { badge: { text: 'v2 gets 10%', tone: 'accent' } } })
        : MESH,
  links: meshLinks(phase === 'retry'),
  groups: [{ label: 'service mesh', nodes: ['orders', 'pay', 'users', 'stock'], tone: 'accent' }],
  packets:
    phase === 'mtls'
      ? [hop('orders', 'pay', 0, 'req', 'charge'), hop('users', 'stock', 0.3, 'req')]
      : phase === 'retry'
        ? [hop('orders', 'pay', 0, 'bad', 'timeout'), hop('orders', 'pay', 1.0, 'ok', 'retry')]
        : [0, 1, 2, 3].map((i) => hop('orders', 'stock', i * 0.3, i === 3 ? 'violet' : 'req', i === 3 ? 'v2' : undefined)),
  stats:
    phase === 'mtls'
      ? [
          { label: 'Encryption', value: 'mTLS', tone: 'ok' },
          { label: 'Telemetry', value: 'every call' },
          { label: 'Code changes', value: 'none', tone: 'ok' },
        ]
      : phase === 'retry'
        ? [
            { label: 'Timeouts', value: 'sidecar' },
            { label: 'Retries', value: 'sidecar', tone: 'ok' },
            { label: 'Breaker', value: 'sidecar' },
          ]
        : [
            { label: 'Traffic split', value: '90 / 10' },
            { label: 'Policy', value: 'uniform' },
            { label: 'Examples', value: 'Istio, Linkerd' },
          ],
  note: phase === 'retry' ? { text: 'retries and timeouts live in the sidecar, not the code', tone: 'accent' } : undefined,
});

// Step 6: guidance.
const guidance = (phase: 'logic' | 'small'): FlowState =>
  phase === 'logic'
    ? {
        nodes: [...CLIENTS, { ...GW, items: ['auth', 'limits', 'pricing'], status: 'hot', badge: { text: 'business logic?', tone: 'bad' } }, ...SERVICES],
        links: gwLinks,
        packets: [hop('web', 'gw', 0, 'req'), hop('gw', 'orders', 0.6, 'req')],
        stats: [
          { label: 'Gateway', value: 'cross-cutting', tone: 'ok' },
          { label: 'Business logic', value: 'in services', tone: 'ok' },
          { label: 'Logic in GW', value: 'avoid', tone: 'bad' },
        ],
        note: { text: 'keep auth, throttling, logging. push pricing back to a service', tone: 'bad' },
      }
    : {
        nodes: patch(MESH.slice(0, 2), { orders: { badge: { text: 'mesh overkill', tone: 'bad' } } }),
        links: [{ from: 'orders', to: 'pay', label: 'mTLS' }],
        groups: [{ label: 'service mesh', nodes: ['orders', 'pay'], tone: 'bad' }],
        packets: [hop('orders', 'pay', 0, 'req')],
        stats: [
          { label: 'Services', value: '2' },
          { label: 'Mesh adds', value: 'ops weight', tone: 'bad' },
          { label: 'Worth it at', value: 'many services' },
        ],
        note: { text: 'for a handful of services, skip the mesh' },
      };

const RECAP: FlowState = {
  nodes: [
    WEB,
    MOBILE,
    { ...GW, x: 1.4, items: undefined, sub: 'auth, limits' },
    { ...BFFS[0], x: 2.9 },
    { ...BFFS[1], x: 2.9 },
    ...SERVICES.map((s) => ({ ...s, x: 4.6, items: ['sidecar'] })),
  ],
  links: [
    { from: 'web', to: 'gw' },
    { from: 'mobile', to: 'gw' },
    { from: 'gw', to: 'wbff' },
    { from: 'gw', to: 'mbff' },
    ...SERVICES.flatMap((s) => [
      { from: 'wbff', to: s.id },
      { from: 'mbff', to: s.id },
    ]),
  ],
  groups: [{ label: 'mesh', nodes: SERVICES.map((s) => s.id), tone: 'accent' }],
  packets: [hop('mobile', 'gw', 0, 'req'), hop('gw', 'mbff', 0.6, 'req'), hop('mbff', 'users', 1.2, 'req')],
  stats: [
    { label: 'Edge', value: 'gateway' },
    { label: 'Per client', value: 'BFF' },
    { label: 'Between', value: 'mesh' },
  ],
};

export default defineLesson('flow', {
  slug: 'api-gateway',
  objectives: [
    { text: 'Why cross-cutting concerns belong at the edge', step: 1 },
    { text: 'Tell a reverse proxy from an API gateway', step: 3 },
    { text: 'Use a BFF to shape responses per client', step: 4 },
    { text: 'Know what a service mesh adds, and when to skip it', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Every service does the edge work',
      tag: 'problem',
      body: [
        'Clients call each service directly. Every service has to check auth, apply rate limits and log requests on its own.',
        'Clients must also know every service address.',
      ],
      keyIdea: 'Cross-cutting concerns copied into every service drift apart. Put them in one place.',
      frames: [{ state: direct() }],
    },
    {
      label: 'Proxy',
      title: 'Reverse proxy',
      tag: 'concept',
      body: [
        'A **reverse proxy** sits in front of servers. It terminates TLS, compresses, caches and routes (NGINX, Envoy).',
        'Clients see one address, and the servers behind it can change freely.',
      ],
      keyIdea: 'A reverse proxy handles transport concerns: TLS, compression, caching, routing.',
      frames: [
        { state: proxy(false), hold: 3000 },
        { state: proxy(true) },
      ],
    },
    {
      label: 'Gateway',
      title: 'API gateway at the platform edge',
      tag: 'concept',
      body: [
        'An **API gateway** adds API concerns: authentication, rate limiting, API keys and usage plans, routing to services, and request or response shaping.',
        'Bad or excessive calls are rejected before any service does work.',
      ],
      keyIdea: 'Put auth, throttling and logging in the gateway so services stay small.',
      frames: [
        { state: gateway('no-key'), hold: 2000 },
        { state: gateway('limited'), hold: 2000 },
        { state: gateway('ok') },
      ],
    },
    {
      label: 'BFF',
      title: 'Backend for frontend',
      tag: 'technique',
      body: [
        'Web and mobile want different data. A **BFF** per client type calls several services and returns one response tailored to that client.',
        'The mobile app makes one call instead of three.',
      ],
      keyIdea: 'A BFF aggregates services for one kind of client.',
      frames: [
        { state: bff('fan'), hold: 2600 },
        { state: bff('reply') },
      ],
    },
    {
      label: 'Mesh',
      title: 'Service mesh between services',
      tag: 'technique',
      body: [
        'Service-to-service calls need security and resilience too. A **service mesh** puts a sidecar (or node agent) next to each service.',
        'Sidecars handle mTLS, retries, timeouts, circuit breaking, traffic splitting and telemetry (Istio, Linkerd).',
      ],
      keyIdea: 'A mesh gives uniform policy for service-to-service traffic, done by sidecars or node agents.',
      frames: [
        { state: mesh('mtls'), hold: 1800 },
        { state: mesh('retry'), hold: 2200 },
        { state: mesh('split') },
      ],
    },
    {
      label: 'Guidance',
      title: 'Keep each layer in its lane',
      tag: 'trade-off',
      body: [
        'Do not put **business logic** in the gateway. It is for cross-cutting concerns, and logic belongs in services.',
        'A **mesh** helps when you have many services and want uniform policy. It adds operational weight, so skip it for a handful.',
      ],
      keyIdea: 'Gateway for cross-cutting edge concerns, services for logic, a mesh only when the service count justifies it.',
      frames: [
        { state: guidance('logic'), hold: 2400 },
        { state: guidance('small') },
      ],
    },
    {
      label: 'Recap',
      title: 'Where each one sits',
      tag: 'recap',
      body: [
        '- **Reverse proxy:** in front of servers. TLS, compression, caching, routing.',
        '- **API gateway:** edge of the platform. Auth, rate limits, API keys, routing, shaping.',
        '- **BFF:** one per client type, aggregates services.',
        '- **Service mesh:** between services. mTLS, retries, timeouts, breakers, telemetry.',
        '- **Rule:** no business logic at the edge.',
      ],
      keyIdea: 'Edge concerns at the gateway, client shaping in the BFF, service-to-service policy in the mesh.',
      frames: [{ state: RECAP }],
    },
  ],
});
