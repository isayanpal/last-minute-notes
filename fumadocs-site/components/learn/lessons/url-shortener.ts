import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';

/*
 * Layout: browser (x 0), edge (x 1.4), stateless services (x 2.9), cache and stores (x 4.6 to 5.6).
 */

const BROWSER: FlowNode = { id: 'b', label: 'Browser', kind: 'client', shape: 'laptop', x: 0, y: 1.6, size: 'sm' };
const EDGE: FlowNode = { id: 'e', label: 'Edge', sub: 'CDN + LB', kind: 'lb', x: 1.4, y: 1.6, size: 'sm' };
const CREATE: FlowNode = { id: 'w', label: 'Create svc', sub: 'stateless', kind: 'service', shape: 'server', x: 3.0, y: 0.4, size: 'sm' };
const REDIRECT: FlowNode = { id: 'r', label: 'Redirect svc', sub: 'stateless', kind: 'service', shape: 'server', x: 3.0, y: 2.8, size: 'sm' };
const KV: FlowNode = { id: 'kv', label: 'KV store', sub: 'sharded by code', kind: 'db', shape: 'db', x: 5.5, y: 1.2, size: 'sm' };
const CACHE: FlowNode = { id: 'ca', label: 'Redis', sub: 'code to URL', kind: 'cache', x: 5.5, y: 2.9, size: 'sm' };
const KAFKA: FlowNode = { id: 'k', label: 'Kafka', sub: 'click events', kind: 'queue', shape: 'queue', x: 3.0, y: 1.6, size: 'sm' };
const ALLOC: FlowNode = { id: 'al', label: 'Key allocator', sub: 'hands out ID ranges', kind: 'service', shape: 'server', x: 5.3, y: 0.2, size: 'sm' };

// Step 1: the shape of the problem.
const OVERVIEW: FlowState = {
  nodes: [BROWSER, EDGE, CREATE, REDIRECT, KV],
  links: [
    { from: 'b', to: 'e' },
    { from: 'e', to: 'w' },
    { from: 'e', to: 'r' },
    { from: 'w', to: 'kv' },
    { from: 'r', to: 'kv' },
  ],
  packets: [
    { from: 'b', to: 'e', label: 'POST', dur: 0.5 },
    { from: 'e', to: 'w', delay: 0.5, dur: 0.5 },
    { from: 'w', to: 'kv', delay: 1.0, dur: 0.6, tone: 'data', label: 'write' },
    { from: 'b', to: 'e', delay: 1.8, dur: 0.5, label: 'GET' },
    { from: 'e', to: 'r', delay: 2.3, dur: 0.5 },
    { from: 'r', to: 'kv', delay: 2.8, dur: 0.6, tone: 'data', label: 'read' },
  ],
  stats: [
    { label: 'Writes', value: '~40 / s' },
    { label: 'Redirects', value: '~4,000 / s', hint: 'peak 12,000', tone: 'ok' },
    { label: 'Records', value: '6B', hint: 'about 3 TB' },
  ],
  note: { text: 'read-heavy, 100 redirects per new link', tone: 'accent' },
};

// Step 2: where do codes come from. Counter ranges plus base62.
const ALLOCATION: FlowState = {
  nodes: [
    ALLOC,
    { id: 'w1', label: 'Create 1', kind: 'service', shape: 'server', x: 2.0, y: 0.5, size: 'sm', items: ['0-99k'], badge: { text: 'range A', tone: 'accent' } },
    { id: 'w2', label: 'Create 2', kind: 'service', shape: 'server', x: 2.0, y: 2.5, size: 'sm', items: ['100k-199k'], badge: { text: 'range B', tone: 'accent' } },
    { id: 'kv', label: 'KV store', kind: 'db', shape: 'db', x: 5.3, y: 2.7, size: 'sm' },
  ],
  links: [
    { from: 'w1', to: 'al', dashed: true },
    { from: 'w2', to: 'al', dashed: true },
    { from: 'w1', to: 'kv' },
    { from: 'w2', to: 'kv' },
  ],
  packets: [
    { from: 'w1', to: 'al', label: 'need range', dur: 0.7 },
    { from: 'al', to: 'w1', delay: 0.7, dur: 0.7, tone: 'ok', label: '0..99,999' },
    { from: 'w2', to: 'al', delay: 0.3, label: 'need range', dur: 0.7 },
    { from: 'al', to: 'w2', delay: 1.0, dur: 0.7, tone: 'ok', label: '100k..199k' },
  ],
  stats: [
    { label: 'Code', value: '7 chars' },
    { label: 'Space', value: '62^7 = 3.5T', tone: 'ok' },
    { label: 'Per URL', value: 'no extra call', tone: 'ok' },
  ],
  note: { text: 'encode the number in base62 locally, no collisions', tone: 'accent' },
};
const OPTIONS: FlowState = {
  nodes: [
    { id: 'h', label: 'Hash + cut', sub: 'collisions', kind: 'worker', x: 0.4, y: 0.4, size: 'sm', status: 'dim' },
    { id: 'rnd', label: 'Random + check', sub: 'retries as it fills', kind: 'worker', x: 0.4, y: 2.8, size: 'sm', status: 'dim' },
    { id: 'ctr', label: 'Counter ranges', sub: 'recommended', kind: 'service', shape: 'server', x: 2.9, y: 1.6, status: 'active', badge: { text: 'best fit', tone: 'accent' } },
    { id: 'kg', label: 'Key service', sub: 'pre-made keys', kind: 'worker', x: 5.4, y: 1.6, size: 'sm', status: 'dim' },
  ],
  links: [],
  stats: [
    { label: 'Guessable?', value: 'permute the id' },
    { label: 'Crash', value: 'lose one: fine' },
    { label: 'Collisions', value: 'none', tone: 'ok' },
  ],
  note: { text: 'a reversible permutation hides the sequential order', tone: 'accent' },
};

// Step 3: cold then warm redirect.
const redirect = (cold: boolean): FlowState => {
  const packets: Packet[] = cold
    ? [
        { from: 'b', to: 'e', label: 'GET /aZ3x9Kq', dur: 0.5 },
        { from: 'e', to: 'r', delay: 0.5, dur: 0.5 },
        { from: 'r', to: 'ca', delay: 1.0, dur: 0.5, label: 'GET' },
        { from: 'ca', to: 'r', delay: 1.5, dur: 0.5, tone: 'bad', label: 'miss' },
        { from: 'r', to: 'kv', delay: 2.0, dur: 0.6, tone: 'data', label: 'SELECT' },
        { from: 'kv', to: 'r', delay: 2.6, dur: 0.6, tone: 'data', label: 'long_url' },
        { from: 'r', to: 'ca', delay: 3.2, dur: 0.5, tone: 'ok', label: 'SET ttl' },
        { from: 'r', to: 'b', delay: 3.2, dur: 0.9, tone: 'res', label: '302' },
      ]
    : [
        { from: 'b', to: 'e', label: 'GET /aZ3x9Kq', dur: 0.5 },
        { from: 'e', to: 'r', delay: 0.5, dur: 0.5 },
        { from: 'r', to: 'ca', delay: 1.0, dur: 0.5, label: 'GET' },
        { from: 'ca', to: 'r', delay: 1.5, dur: 0.5, tone: 'ok', label: 'hit' },
        { from: 'r', to: 'b', delay: 2.0, dur: 0.9, tone: 'res', label: '302' },
      ];
  return {
    nodes: patch([BROWSER, EDGE, REDIRECT, { ...CACHE, items: cold ? [] : ['aZ3x9Kq'] }, KV], {
      ca: { badge: cold ? { text: 'MISS', tone: 'bad' } : { text: 'HIT', tone: 'accent' } },
      kv: cold ? { status: 'active' } : { status: 'dim' },
    }),
    links: [
      { from: 'b', to: 'e' },
      { from: 'e', to: 'r' },
      { from: 'r', to: 'ca' },
      { from: 'r', to: 'kv' },
    ],
    packets,
    stats: [
      { label: 'Latency', value: cold ? '142 ms' : '24 ms', tone: cold ? 'bad' : 'ok' },
      { label: 'DB read', value: cold ? '1' : '0', tone: cold ? 'bad' : 'ok' },
      { label: 'Cache', value: cold ? 'backfilled' : 'warm' },
    ],
    note: { text: cold ? 'miss: read the store, then backfill the cache' : 'hit: the database is never touched', tone: cold ? 'bad' : 'accent' },
  };
};

// Step 4: 301 vs 302 and async analytics.
const redirectCodes = (permanent: boolean): FlowState => ({
  nodes: [
    BROWSER,
    { ...EDGE, label: permanent ? 'Browser cache' : 'Edge', sub: permanent ? 'remembers the 301' : 'CDN + LB' },
    REDIRECT,
    { ...KAFKA, x: 5.4, y: 2.8 },
  ],
  links: [
    { from: 'b', to: 'e' },
    ...(permanent ? [] : [{ from: 'e', to: 'r' }, { from: 'r', to: 'k', dashed: true }]),
  ],
  packets: permanent
    ? [{ from: 'b', to: 'e', label: 'repeat click', dur: 0.6, tone: 'ok' }]
    : [
        { from: 'b', to: 'e', label: 'click', dur: 0.5 },
        { from: 'e', to: 'r', delay: 0.5, dur: 0.5 },
        { from: 'r', to: 'b', delay: 1.0, dur: 0.9, tone: 'res', label: '302' },
        { from: 'r', to: 'k', delay: 1.0, dur: 0.8, tone: 'data', label: 'click event' },
      ],
  stats: permanent
    ? [{ label: 'Status', value: '301 permanent' }, { label: 'Server load', value: 'lower', tone: 'ok' }, { label: 'Click counts', value: 'lost', tone: 'bad' }]
    : [{ label: 'Status', value: '302 / 307' }, { label: 'Click counts', value: 'every click', tone: 'ok' }, { label: 'Analytics', value: 'async', tone: 'ok' }],
  note: permanent ? { text: 'repeat clicks never reach you, so you cannot count or retarget', tone: 'bad' } : { text: 'the click event leaves the critical path', tone: 'accent' },
});

// Step 5: follow-ups.
const FOLLOW: FlowState = {
  nodes: [
    { id: 'w', label: 'Create svc', kind: 'service', shape: 'server', x: 0.6, y: 1.6, size: 'sm' },
    { id: 'rl', label: 'Rate limit', sub: 'per user and IP', kind: 'gateway', shape: 'gateway', x: 2.3, y: 0.4, size: 'sm' },
    { id: 'sc', label: 'URL scanner', sub: 'malware lists', kind: 'external', shape: 'cloud', x: 2.3, y: 2.8, size: 'sm' },
    { id: 'kv', label: 'KV store', sub: 'unique code', kind: 'db', shape: 'db', x: 4.4, y: 1.6, size: 'sm', items: ['ttl'] },
    { id: 'sw', label: 'TTL sweeper', sub: 'background', kind: 'worker', x: 5.6, y: 2.9, size: 'sm' },
  ],
  links: [
    { from: 'w', to: 'rl' },
    { from: 'w', to: 'sc' },
    { from: 'w', to: 'kv' },
    { from: 'sw', to: 'kv', dashed: true },
  ],
  packets: [
    { from: 'w', to: 'rl', dur: 0.5, label: 'allowed?' },
    { from: 'w', to: 'sc', delay: 0.2, dur: 0.5, label: 'safe?' },
    { from: 'w', to: 'kv', delay: 0.8, dur: 0.6, tone: 'data', label: 'alias' },
    { from: 'sw', to: 'kv', delay: 1.4, dur: 0.6, tone: 'bad', label: 'delete' },
  ],
  stats: [
    { label: 'Custom alias', value: 'unique key' },
    { label: 'Expiry', value: 'check on read' },
    { label: 'Abuse', value: 'scan + limit' },
  ],
  note: { text: 'small features, each reuses an existing building block', tone: 'accent' },
};

export default defineLesson('flow', {
  slug: 'url-shortener',
  objectives: [
    { text: 'Size the system from reads, writes and record counts', step: 1 },
    { text: 'Generate short codes without collisions or a bottleneck', step: 2 },
    { text: 'Trace the redirect path with a cold and a warm cache', step: 3 },
    { text: '301 vs 302, and keeping analytics off the hot path', step: 4 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Short link in, redirect out',
      tag: 'problem',
      body: [
        'Create a short URL from a long one and redirect on access, like bit.ly. 100M new URLs a month is only about **40 writes per second**.',
        'Redirects run about **100 times** more often, around 4,000 per second and 12,000 at peak. Over five years that is 6 billion records, roughly 3 TB.',
      ],
      keyIdea: 'Read-heavy with a single-key lookup. A sharded key-value store plus a cache fits the access pattern.',
      frames: [{ state: OVERVIEW, hold: 4200 }],
    },
    {
      label: 'Short codes',
      title: 'Where the code comes from',
      tag: 'technique',
      body: [
        'Seven base62 characters give 3.5 trillion codes. Hashing and truncating collides. Random codes need a check and retry as the space fills.',
        'Best fit: a small allocator hands each app server a **range** of numbers. The server encodes numbers in base62 locally, with no network call per URL.',
      ],
      keyIdea: 'A crashed server wastes the unused part of its range, which is irrelevant in a space of trillions. Permute the number so codes are not sequential.',
      frames: [{ state: OPTIONS, hold: 2200 }, { state: ALLOCATION, hold: 3000 }],
    },
    {
      label: 'Redirect path',
      title: 'Cache first, store second',
      tag: 'technique',
      body: [
        'The redirect service checks Redis. On a miss it reads the store and backfills the cache with a TTL.',
        'With a skewed popularity curve, caching the hottest 20% of codes serves most traffic. Cache brief negative results to absorb scans of random codes.',
      ],
      keyIdea: 'A warm hit costs one cache read and no database work.',
      frames: [{ state: redirect(true), hold: 5000 }, { state: redirect(false), hold: 3400 }],
    },
    {
      label: '301 vs 302',
      title: 'Count clicks or cut load',
      tag: 'trade-off',
      body: [
        'A **301** is cached by browsers and CDNs, so load drops but you lose click counts and cannot change the target.',
        'A **302** or **307** sends every click through you. Do analytics asynchronously: emit an event and never block the redirect on it.',
      ],
      keyIdea: 'Most shorteners use 302 or 307, because analytics and edits matter more than a few saved requests.',
      frames: [{ state: redirectCodes(true), hold: 2600 }, { state: redirectCodes(false), hold: 3000 }],
    },
    {
      label: 'Follow-ups',
      title: 'Aliases, expiry and abuse',
      tag: 'in practice',
      body: [
        '**Custom alias:** check availability with the same unique constraint. **Expiry:** store `expires_at`, check on read, delete in the background.',
        '**Abuse:** scan submitted URLs against malware and phishing lists and rate limit creation. For multi-region, replicate the store and redirect from the nearest region.',
      ],
      keyIdea: 'State your choice on duplicates: the same long URL can map to one code (needs a reverse index) or to a new code each time.',
      frames: [{ state: FOLLOW, hold: 3400 }],
    },
    {
      label: 'Recap',
      title: 'The whole design',
      tag: 'recap',
      body: [
        '- **Numbers:** ~40 writes/s, ~4,000 redirects/s, 6B records, 3 TB.',
        '- **Store:** key-value or sharded SQL keyed by `code`.',
        '- **Codes:** counter ranges per server, base62, permuted.',
        '- **Reads:** Redis in front, CDN at the edge, 302 so clicks can be counted.',
        '- **Analytics:** click events through Kafka, off the critical path.',
        '- **Extras:** alias via unique key, TTL expiry, URL scanning, rate limits.',
      ],
      keyIdea: 'Estimate first, then choose each part because of a number you computed.',
      frames: [{ state: OVERVIEW }],
    },
  ],
});
