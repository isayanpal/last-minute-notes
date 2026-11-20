import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

const node = (over: Record<string, Partial<FlowNode>> = {}): FlowNode[] => {
  const base: FlowNode[] = [
    { id: 'c', label: 'Client', kind: 'client', x: 0, y: 1.6, size: 'sm' },
    { id: 'app', label: 'Service', kind: 'service', x: 2, y: 1.6 },
    { id: 'cache', label: 'Cache', sub: 'Redis', kind: 'cache', x: 4.2, y: 0.5 },
    { id: 'db', label: 'Database', kind: 'db', x: 4.2, y: 2.8 },
  ];
  return base.map((n) => ({ ...n, ...over[n.id] }));
};

const links = [
  { from: 'c', to: 'app' },
  { from: 'app', to: 'cache' },
  { from: 'app', to: 'db' },
];

const st = (nodes: FlowNode[], packets: Packet[], extra: Partial<FlowState> = {}): FlowState => ({ nodes, links, packets, ...extra });

const get = (label: string, d = 0): Packet[] => [{ from: 'c', to: 'app', label, delay: d, dur: 0.5 }];

const stats = (hit: string, latency: string, tone: 'ok' | 'bad' | 'neutral' = 'neutral') => [
  { label: 'Result', value: hit, tone },
  { label: 'Latency', value: latency, tone },
  { label: 'DB reads', value: hit === 'hit' ? '0' : '1' },
];

export default defineLesson('flow', {
  slug: 'caching',
  objectives: [
    { text: 'Run the cache-aside read and write paths', step: 2 },
    { text: 'Why writes delete the key instead of updating it', step: 3 },
    { text: 'Compare write-through and write-behind', step: 4 },
    { text: 'Spot and fix the stampede', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Every read hits the database',
      tag: 'problem',
      body: [
        'A popular page asks the database the same question thousands of times a second.',
        'The database is the slowest and most expensive part of the path, so it becomes the bottleneck first.',
      ],
      keyIdea: 'A cache stores the result of expensive work so the next request is cheap. It is the highest leverage tool for read-heavy systems.',
      frames: [
        {
          state: st(
            node({ db: { status: 'hot', meter: { value: 0.95, label: 'CPU 95%', tone: 'bad' } } }),
            [...get('GET /u/7'), { from: 'app', to: 'db', label: 'SELECT', delay: 0.5, dur: 0.6 }, { from: 'db', to: 'app', label: 'row', tone: 'res', delay: 1.1, dur: 0.6 }],
            { stats: stats('no cache', '~40 ms', 'bad'), note: { text: 'same query, again and again', tone: 'bad' } },
          ),
        },
      ],
    },
    {
      label: 'Cache-aside',
      title: 'Check the cache, fall back to the DB',
      tag: 'technique',
      body: [
        '**Cache-aside**: the app asks the cache first. On a **miss** it loads from the database and stores the value with a TTL.',
        'The next request for the same key is a **hit** and never touches the database.',
      ],
      keyIdea: 'Cache-aside is simple and only caches hot data. The cost is a slower first read (the miss).',
      frames: [
        {
          state: st(node(), [...get('GET u:7'), { from: 'app', to: 'cache', label: 'get u:7', delay: 0.5, dur: 0.5 }, { from: 'cache', to: 'app', label: 'miss', tone: 'bad', delay: 1, dur: 0.5 }], {
            stats: stats('miss', '', 'neutral'),
            note: { text: '1. not in cache', tone: 'bad' },
          }),
          hold: 2200,
        },
        {
          state: st(node({ cache: { badge: { text: 'set u:7, ttl 60s', tone: 'accent' } } }), [
            { from: 'app', to: 'db', label: 'load', dur: 0.6 },
            { from: 'db', to: 'app', label: 'row', tone: 'res', delay: 0.6, dur: 0.6 },
            { from: 'app', to: 'cache', label: 'store', tone: 'data', delay: 1.2, dur: 0.5 },
          ], { stats: stats('miss', '~40 ms', 'bad'), note: { text: '2. load from DB, fill cache' } }),
          hold: 2600,
        },
        {
          state: st(node({ cache: { items: ['u:7'] } }), [...get('GET u:7'), { from: 'app', to: 'cache', label: 'get u:7', delay: 0.5, dur: 0.5 }, { from: 'cache', to: 'app', label: 'hit', tone: 'ok', delay: 1, dur: 0.5 }], {
            stats: stats('hit', '~1 ms', 'ok'),
            note: { text: '3. second read is a hit', tone: 'ok' },
          }),
        },
      ],
    },
    {
      label: 'Writes',
      title: 'On write, delete the key',
      tag: 'technique',
      body: [
        'Write to the database first, then **delete** the cache key. The next read refills it with fresh data.',
        'Updating the cache instead races with concurrent readers and writers and can leave a stale value behind.',
      ],
      keyIdea: 'Even with delete, a slow reader can repopulate an old value. A short TTL is the safety net.',
      frames: [
        { state: st(node({ cache: { items: ['u:7'] } }), [{ from: 'c', to: 'app', label: 'PUT u:7', dur: 0.5 }, { from: 'app', to: 'db', label: 'update', delay: 0.5, dur: 0.6 }], { note: { text: '1. update the database' } }), hold: 2200 },
        { state: st(node({ cache: { badge: { text: 'deleted u:7', tone: 'accent' } } }), [{ from: 'app', to: 'cache', label: 'del u:7', tone: 'bad', dur: 0.6 }], { note: { text: '2. delete the cached copy', tone: 'accent' } }) },
      ],
    },
    {
      label: 'Write modes',
      title: 'Write-through vs write-behind',
      tag: 'trade-off',
      body: [
        '**Write-through** writes cache and DB together: always fresh, slower writes.',
        '**Write-behind** writes the cache and flushes to the DB later: very fast, but data is lost if the cache dies before the flush.',
      ],
      keyIdea: 'Pick by what you can lose. Fast writes with a loss window (write-behind) or slower writes that are always safe (write-through).',
      frames: [
        {
          state: st(node({ cache: { badge: { text: 'write-through', tone: 'accent' } } }), [{ from: 'app', to: 'cache', label: 'write', dur: 0.5 }, { from: 'app', to: 'db', label: 'write', dur: 0.6 }], {
            stats: [{ label: 'Write cost', value: 'cache + DB', tone: 'bad' }, { label: 'Fresh', value: 'always', tone: 'ok' }, { label: 'Data loss', value: 'none', tone: 'ok' }],
          }),
          hold: 2400,
        },
        {
          state: st(node({ cache: { badge: { text: 'write-behind', tone: 'accent' }, items: ['u:7*'] } }), [{ from: 'app', to: 'cache', label: 'write', dur: 0.5 }, { from: 'cache', to: 'db', label: 'async flush', tone: 'data', delay: 1.2, dur: 0.8 }], {
            stats: [{ label: 'Write cost', value: 'cache only', tone: 'ok' }, { label: 'Fresh', value: 'after flush' }, { label: 'Data loss', value: 'if cache dies', tone: 'bad' }],
          }),
        },
      ],
    },
    {
      label: 'Stampede',
      title: 'A hot key expires',
      tag: 'trade-off',
      body: [
        'A hot key expires. Thousands of requests miss at the same moment and all hit the database together.',
        'Fix it with **single-flight** (one loader per key), a short lock, refresh-ahead, or serving stale data while one request refreshes. Add jitter to TTLs so keys do not all expire together.',
      ],
      keyIdea: 'Stampede is a miss storm. Let one request load the value and make the rest wait for it.',
      frames: [
        {
          state: st(
            node({ app: { label: '1000 requests' }, db: { status: 'hot', meter: { value: 1, label: 'overloaded', tone: 'bad' } }, cache: { badge: { text: 'u:7 expired', tone: 'bad' } } }),
            [{ from: 'app', to: 'cache', label: 'miss', tone: 'bad', dur: 0.5 }, { from: 'app', to: 'db', label: '×1000', tone: 'bad', delay: 0.5, dur: 0.6 }],
            { note: { text: 'everyone loads the same row', tone: 'bad' } },
          ),
          hold: 2400,
        },
        {
          state: st(
            node({ app: { label: '1000 requests' }, cache: { badge: { text: 'one loader', tone: 'accent' } }, db: { meter: { value: 0.1, label: '1 query', tone: 'ok' } } }),
            [{ from: 'app', to: 'db', label: '×1', dur: 0.6 }, { from: 'db', to: 'app', tone: 'res', delay: 0.6, dur: 0.6 }, { from: 'app', to: 'cache', label: 'fill', tone: 'data', delay: 1.2, dur: 0.5 }],
            { note: { text: 'single-flight: others wait for the result', tone: 'ok' } },
          ),
        },
      ],
    },
    {
      label: 'Recap',
      title: 'What to say in the interview',
      tag: 'recap',
      body: [
        '- **Read:** cache-aside. Miss loads the DB and fills the cache with a TTL.',
        '- **Write:** update the DB, then delete the key.',
        '- **Eviction:** LRU is the default. Always combine it with a TTL.',
        '- **Stampede:** single-flight, jittered TTLs, stale-while-revalidate.',
        '- **Penetration and avalanche:** cache negative results, add jitter, protect the DB.',
      ],
      keyIdea: 'Closer to the user is faster and harder to invalidate: browser, CDN, in-process, Redis, then the DB buffer pool.',
      frames: [
        {
          state: st(node({ cache: { items: ['u:7', 'u:9', 'u:12'] } }), [...get('GET'), { from: 'app', to: 'cache', label: 'hit', tone: 'ok', delay: 0.5, dur: 0.5 }], {
            stats: [{ label: 'Hit rate', value: '95%+', tone: 'ok' }, { label: 'DB load', value: '-95%', tone: 'ok' }, { label: 'Bug source', value: 'invalidation' }],
          }),
        },
      ],
    },
  ],
});
