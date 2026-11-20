import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';

/*
 * Layout: three users on the left (x 0), one edge per user (x 1.6), an origin shield (x 3.6), the origin (x 5.4).
 */

const USERS: FlowNode[] = [
  { id: 'u1', label: 'User', sub: 'Tokyo', kind: 'client', x: 0, y: 0.4, size: 'sm' },
  { id: 'u2', label: 'User', sub: 'Berlin', kind: 'client', x: 0, y: 1.75, size: 'sm' },
  { id: 'u3', label: 'User', sub: 'Lima', kind: 'client', x: 0, y: 3.1, size: 'sm' },
];
const EDGES: FlowNode[] = [
  { id: 'e1', label: 'Edge', kind: 'cdn', x: 1.6, y: 0.4 },
  { id: 'e2', label: 'Edge', kind: 'cdn', x: 1.6, y: 1.75 },
  { id: 'e3', label: 'Edge', kind: 'cdn', x: 1.6, y: 3.1 },
];
const SHIELD: FlowNode = { id: 'shield', label: 'Origin shield', sub: 'mid-tier cache', kind: 'cdn', x: 3.6, y: 1.75 };
const ORIGIN: FlowNode = { id: 'origin', label: 'Origin', sub: 'your servers', kind: 'service', x: 5.4, y: 1.75 };

const CDN_LINKS: FlowLink[] = [
  ...USERS.map((u, i) => ({ from: u.id, to: EDGES[i].id })),
  ...EDGES.map((e) => ({ from: e.id, to: 'shield' })),
  { from: 'shield', to: 'origin' },
];

/** Packets along a path, each hop starting when the previous lands. */
const path = (ids: string[], opts: { start?: number; dur?: number; tone?: Packet['tone']; label?: string } = {}): Packet[] => {
  const dur = opts.dur ?? 0.5;
  return ids.slice(1).map((to, i) => ({ from: ids[i], to, dur, delay: (opts.start ?? 0) + i * dur, tone: opts.tone ?? 'req', label: i === 0 ? opts.label : undefined }));
};

const cdn = (changes: Record<string, Partial<FlowNode>>, over: Partial<FlowState>): FlowState => ({
  nodes: patch([...USERS, ...EDGES, SHIELD, ORIGIN], changes),
  links: CDN_LINKS,
  ...over,
});

// Step 1: no CDN. Every user crosses the world to one origin.
const noCdn = (hot: boolean): FlowState => ({
  nodes: [...USERS, { ...ORIGIN, x: 4.6, status: hot ? 'hot' : 'normal', meter: { value: hot ? 0.93 : 0.4, label: hot ? 'spike' : 'normal load', tone: hot ? 'bad' : 'ok' } }],
  links: USERS.map((u) => ({ from: u.id, to: 'origin' })),
  packets: USERS.flatMap((u, i) => {
    const n = hot ? 3 : 1;
    return Array.from({ length: n }, (_, k) => ({ from: u.id, to: 'origin', delay: i * 0.2 + k * 0.35, dur: 1.4, label: k === 0 && i === 0 ? '/img/a.jpg' : undefined }));
  }),
  stats: [
    { label: 'Round trip', value: 'long', tone: 'bad' },
    { label: 'Origin serves', value: 'every request', tone: 'bad' },
    { label: 'Spike', value: hot ? 'hits origin' : '-', tone: hot ? 'bad' : 'neutral' },
  ],
  note: hot ? { text: 'the same image, fetched from far away, over and over', tone: 'bad' } : undefined,
});

// Step 2: edge hits.
const EDGE_HIT_ITEMS = { items: ['a.jpg'] };
const edgeHits = (): FlowState =>
  cdn(
    { e1: EDGE_HIT_ITEMS, e2: EDGE_HIT_ITEMS, e3: EDGE_HIT_ITEMS, shield: { status: 'dim' }, origin: { status: 'dim' } },
    {
      packets: USERS.flatMap((u, i) => [
        { from: u.id, to: EDGES[i].id, delay: i * 0.25, dur: 0.5, tone: 'req' as const },
        { from: EDGES[i].id, to: u.id, delay: i * 0.25 + 0.6, dur: 0.5, tone: 'res' as const },
      ]),
      stats: [
        { label: 'Served from', value: 'nearby edge', tone: 'ok' },
        { label: 'Latency', value: 'a few ms', tone: 'ok' },
        { label: 'Origin load', value: 'zero', tone: 'ok' },
      ],
      note: { text: 'cache hit at the edge: the origin never sees it', tone: 'ok' },
    },
  );

// Step 3: miss path through the shield, then a hit.
const missPath = (phase: 'cold' | 'shield' | 'warm'): FlowState => {
  if (phase === 'cold') {
    return cdn(
      { e2: { badge: { text: 'miss', tone: 'bad' }, items: ['a.jpg'] }, shield: { badge: { text: 'miss', tone: 'bad' }, items: ['a.jpg'] }, origin: { status: 'active' }, u1: { status: 'dim' }, u3: { status: 'dim' }, e1: { status: 'dim' }, e3: { status: 'dim' } },
      {
        packets: [
          ...path(['u2', 'e2', 'shield', 'origin'], { label: '/img/a.jpg' }),
          ...path(['origin', 'shield', 'e2', 'u2'], { start: 1.6, tone: 'data' }),
        ],
        stats: [
          { label: 'Edge', value: 'miss', tone: 'bad' },
          { label: 'Shield', value: 'miss', tone: 'bad' },
          { label: 'Origin hit', value: 'once' },
        ],
        note: { text: 'fetch from origin, fill shield and edge on the way back' },
      },
    );
  }
  if (phase === 'shield') {
    return cdn(
      { e2: { items: ['a.jpg'] }, e3: { badge: { text: 'miss', tone: 'bad' }, items: ['a.jpg'] }, shield: { badge: { text: 'hit', tone: 'ok' }, items: ['a.jpg'] }, origin: { status: 'dim' }, u1: { status: 'dim' }, e1: { status: 'dim' } },
      {
        packets: [...path(['u3', 'e3', 'shield']), ...path(['shield', 'e3', 'u3'], { start: 1.1, tone: 'data' })],
        stats: [
          { label: 'Edge', value: 'miss', tone: 'bad' },
          { label: 'Shield', value: 'hit', tone: 'ok' },
          { label: 'Origin hit', value: 'no', tone: 'ok' },
        ],
        note: { text: 'the shield protects the origin from every edge missing at once', tone: 'accent' },
      },
    );
  }
  return cdn(
    { e1: { items: ['a.jpg'] }, e2: { items: ['a.jpg'], badge: { text: 'hit', tone: 'ok' } }, e3: { items: ['a.jpg'] }, shield: { items: ['a.jpg'] } },
    {
      packets: [
        { from: 'u2', to: 'e2', dur: 0.5 },
        { from: 'e2', to: 'u2', dur: 0.5, delay: 0.6, tone: 'res' },
      ],
      stats: [
        { label: 'Edge', value: 'hit', tone: 'ok' },
        { label: 'Latency', value: 'a few ms', tone: 'ok' },
        { label: 'Origin hit', value: 'no', tone: 'ok' },
      ],
    },
  );
};

// Step 4: pull vs push.
const pull = (): FlowState =>
  cdn(
    { e1: { badge: { text: 'first miss', tone: 'bad' }, items: ['page.css'] }, e2: { status: 'dim' }, e3: { status: 'dim' }, u2: { status: 'dim' }, u3: { status: 'dim' } },
    {
      packets: [...path(['u1', 'e1', 'shield', 'origin']), ...path(['origin', 'shield', 'e1', 'u1'], { start: 1.6, tone: 'data' })],
      stats: [
        { label: 'Mode', value: 'pull' },
        { label: 'Fills on', value: 'first miss' },
        { label: 'Default', value: 'yes', tone: 'ok' },
      ],
      note: { text: 'pull: the edge fetches on the first miss, simple' },
    },
  );
const push = (): FlowState =>
  cdn(
    { e1: { items: ['movie.mp4'] }, e2: { items: ['movie.mp4'] }, e3: { items: ['movie.mp4'] }, origin: { badge: { text: 'upload ahead', tone: 'accent' } }, u1: { status: 'dim' }, u2: { status: 'dim' }, u3: { status: 'dim' } },
    {
      packets: [
        { from: 'origin', to: 'shield', tone: 'data', label: 'movie.mp4', dur: 0.6 },
        ...EDGES.map((e, i) => ({ from: 'shield', to: e.id, tone: 'data' as const, delay: 0.6 + i * 0.15, dur: 0.6 })),
      ],
      stats: [
        { label: 'Mode', value: 'push' },
        { label: 'Fills', value: 'ahead of time' },
        { label: 'Good for', value: 'big, stable' },
      ],
      note: { text: 'push: you upload large, rarely changing files in advance', tone: 'accent' },
    },
  );

// Step 5: freshness and invalidation.
const purge = (): FlowState =>
  cdn(
    { origin: { badge: { text: 'purge /logo.png', tone: 'bad' } }, u1: { status: 'dim' }, u2: { status: 'dim' }, u3: { status: 'dim' } },
    {
      packets: [{ from: 'origin', to: 'shield', tone: 'bad', label: 'purge', dur: 0.6 }, ...EDGES.map((e, i) => ({ from: 'shield', to: e.id, tone: 'bad' as const, delay: 0.6 + i * 0.12, dur: 0.6 }))],
      stats: [
        { label: 'Freshness', value: 'max-age' },
        { label: 'Purge by', value: 'URL or tag' },
        { label: 'Reach', value: 'every edge', tone: 'bad' },
      ],
      note: { text: 'purging works, but must reach every edge' },
    },
  );
const versioned = (): FlowState =>
  cdn(
    {
      e1: { items: ['app.3f9a1c'] },
      e2: { items: ['app.3f9a1c'] },
      e3: { items: ['app.3f9a1c'] },
      origin: { badge: { text: 'new build: new URL', tone: 'ok' } },
    },
    {
      packets: [...path(['u2', 'e2', 'shield', 'origin'], { label: 'app.3f9a1c.js' }), ...path(['origin', 'shield', 'e2', 'u2'], { start: 1.6, tone: 'data' })],
      stats: [
        { label: 'URL', value: 'versioned' },
        { label: 'Cache for', value: 'forever', tone: 'ok' },
        { label: 'Purge needed', value: 'no', tone: 'ok' },
      ],
      note: { text: 'a new file gets a new name, old copies never conflict', tone: 'ok' },
    },
  );

// Step 6: cache key and personal data.
const leak = (): FlowState =>
  cdn(
    { e2: { items: ['/account'], badge: { text: "Ana's page", tone: 'bad' } }, u1: { status: 'dim' }, e1: { status: 'dim' }, u3: { sub: 'Ben' }, u2: { sub: 'Ana' } },
    {
      links: [...CDN_LINKS, { from: 'u3', to: 'e2', dashed: true, tone: 'bad' }],
      packets: [
        ...path(['u2', 'e2', 'shield', 'origin'], { label: '/account' }),
        ...path(['origin', 'shield', 'e2', 'u2'], { start: 1.5, tone: 'data' }),
        { from: 'u3', to: 'e2', label: '/account', delay: 3.2, dur: 0.6 },
        { from: 'e2', to: 'u3', tone: 'bad', label: "Ana's data", delay: 3.9, dur: 0.7 },
      ],
      stats: [
        { label: 'Cached', value: 'personal page', tone: 'bad' },
        { label: 'Ben gets', value: "Ana's data", tone: 'bad' },
        { label: 'Cause', value: 'wrong key' },
      ],
      note: { text: 'caching personal responses can serve one user’s data to another', tone: 'bad' },
    },
  );
const cookieKey = (): FlowState =>
  cdn(
    { e2: { items: ['sess=a1', 'sess=b7', 'sess=c3', 'sess=d9', 'sess=e2'], badge: { text: 'hit rate ~0', tone: 'bad' } }, shield: { status: 'hot' }, u1: { status: 'dim' }, e1: { status: 'dim' }, u3: { status: 'dim' }, e3: { status: 'dim' } },
    {
      packets: [0, 1, 2].flatMap((k) => path(['u2', 'e2', 'shield', 'origin'], { start: k * 0.4, tone: 'bad' })),
      stats: [
        { label: 'Key includes', value: 'session cookie', tone: 'bad' },
        { label: 'Every user', value: 'unique key' },
        { label: 'Hit rate', value: '~0%', tone: 'bad' },
      ],
      note: { text: 'a bad cache key destroys the hit rate', tone: 'bad' },
    },
  );

const RECAP: FlowState = cdn(
  {
    e1: { badge: { text: 'WAF, DDoS', tone: 'accent' } },
    e2: { badge: { text: 'signed URLs', tone: 'accent' } },
    e3: { badge: { text: 'edge compute', tone: 'accent' } },
    shield: { items: ['a.jpg'] },
  },
  {
    packets: USERS.flatMap((u, i) => [
      { from: u.id, to: EDGES[i].id, delay: i * 0.2, dur: 0.5 },
      { from: EDGES[i].id, to: u.id, delay: i * 0.2 + 0.6, dur: 0.5, tone: 'res' as const },
    ]),
    stats: [
      { label: 'Cuts', value: 'latency' },
      { label: 'Offloads', value: 'origin' },
      { label: 'Absorbs', value: 'spikes, attacks' },
    ],
  },
);

export default defineLesson('flow', {
  slug: 'cdn',
  objectives: [
    { text: 'Why serving from the origin alone is slow and fragile', step: 1 },
    { text: 'Trace a request through edge, shield and origin', step: 3 },
    { text: 'Choose pull or push, and invalidate by versioned URLs', step: 5 },
    { text: 'Pick a cache key that is safe and keeps hit rate high', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Every user crosses the world',
      tag: 'problem',
      body: [
        'Users everywhere fetch the same image from one origin. Each fetch pays a long round trip, and every request lands on your servers.',
        'A traffic spike or an attack hits the origin directly.',
      ],
      keyIdea: 'Static content is the same for everyone. Serving it from one far away place wastes time and capacity.',
      frames: [
        { state: noCdn(false), hold: 2200 },
        { state: noCdn(true) },
      ],
    },
    {
      label: 'Edge hit',
      title: 'Cache it near the user',
      tag: 'concept',
      body: [
        'A **CDN** keeps copies at edge locations close to users. A cache hit is served from the edge in a few milliseconds.',
        'It cuts latency, offloads the origin, and absorbs spikes and some attacks.',
      ],
      keyIdea: 'Every edge hit is a request your origin never sees.',
      frames: [{ state: edgeHits() }],
    },
    {
      label: 'Miss path',
      title: 'Edge miss, shield, origin',
      tag: 'technique',
      body: [
        'On an edge miss, the edge asks the **origin shield**. If the shield also misses, it fetches from the origin. The copy fills the shield and the edge on the way back.',
        'The next miss at another edge is answered by the shield.',
      ],
      keyIdea: 'The shield collapses many edge misses into one origin fetch.',
      frames: [
        { state: missPath('cold'), hold: 3600 },
        { state: missPath('shield'), hold: 2600 },
        { state: missPath('warm') },
      ],
    },
    {
      label: 'Pull or push',
      title: 'Pull on demand, or push ahead',
      tag: 'technique',
      body: [
        'A **pull CDN** fetches from the origin on the first miss. Simple, and the default.',
        'A **push CDN** gets content uploaded ahead of time. Good for large, rarely changing files.',
      ],
      keyIdea: 'Pull for most things. Push when the first miss would be too expensive.',
      frames: [
        { state: pull(), hold: 3600 },
        { state: push() },
      ],
    },
    {
      label: 'Freshness',
      title: 'Stale copies and how to replace them',
      tag: 'technique',
      body: [
        '`Cache-Control: max-age` sets freshness, `s-maxage` for shared caches. `ETag` revalidates, `stale-while-revalidate` serves stale while refreshing.',
        'You can **purge** by URL or tag. Better: **version the URL** (`app.3f9a1c.js`) and cache forever.',
      ],
      keyIdea: 'A new version gets a new name, so nothing ever needs purging.',
      frames: [
        { state: purge(), hold: 2200 },
        { state: versioned() },
      ],
    },
    {
      label: 'Cache key',
      title: 'The cache key decides safety and hit rate',
      tag: 'trade-off',
      body: [
        'Cache a personal page under its URL alone and the next user gets someone else’s data.',
        'Put a session cookie in the key and every user gets a unique key, which destroys the hit rate. Vary on the right headers, and never cache `Set-Cookie` responses without care.',
      ],
      keyIdea: 'The key must include what changes the response, and nothing else.',
      frames: [
        { state: leak(), hold: 4800 },
        { state: cookieKey() },
      ],
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Hit:** served from the edge in a few ms. **Miss:** edge, shield, then origin.',
        '- **Pull** is the default, **push** for big stable files.',
        '- **Invalidate** by versioned URLs, purge by URL or tag when you must.',
        '- **Cache key:** URL plus only the headers that matter. Careful with personal data.',
        '- **Extras:** signed URLs, WAF, DDoS mitigation, edge compute. Cache shared API responses too, with short TTLs.',
      ],
      keyIdea: 'Static assets are the obvious win. Shared API responses with short TTLs are the next one.',
      frames: [{ state: RECAP }],
    },
  ],
});
