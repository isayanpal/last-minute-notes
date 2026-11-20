import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import type { Stat } from '../types';

/*
 * Layout: the app (x 0.4) and the router (x 2.8) along the top, shards in a row along the bottom (y 2.5).
 * Placement is computed with a real hash (FNV-1a), so the counts and "moved" numbers on screen are exact.
 */

const APP: FlowNode = { id: 'app', label: 'App', kind: 'service', x: 0.4, y: 0.2, size: 'sm' };
const ROUTER: FlowNode = { id: 'rt', label: 'Shard router', sub: 'key -> shard', kind: 'gateway', x: 2.8, y: 0.2 };
const SHARD_Y = 2.5;
const shardX = (i: number, n: number) => (n === 4 ? [0.7, 2.1, 3.5, 4.9] : n === 3 ? [1.4, 2.8, 4.2] : [2.1, 3.5])[i];

type ShardSpec = { label?: string; sub?: string; items?: string[]; load?: number; loadLabel?: string; status?: FlowNode['status']; badge?: FlowNode['badge'] };

const meter = (value: number, label?: string) => ({ value: Math.min(1, value), label, tone: value > 0.85 ? ('bad' as const) : value > 0.6 ? ('accent' as const) : ('ok' as const) });

function shards(specs: ShardSpec[]): FlowNode[] {
  return specs.map((s, i) => ({
    id: `s${i}`,
    label: s.label ?? `Shard ${i + 1}`,
    sub: s.sub,
    kind: 'db',
    x: shardX(i, specs.length),
    y: SHARD_Y,
    size: 'sm',
    items: s.items,
    meter: s.load !== undefined ? meter(s.load, s.loadLabel) : undefined,
    status: s.status,
    badge: s.badge,
  }));
}

function scene(specs: ShardSpec[], packets: Packet[], stats: Stat[], note?: FlowState['note'], extra: Partial<FlowState> = {}): FlowState {
  const nodes = [APP, ROUTER, ...shards(specs)];
  const links: FlowLink[] = [{ from: 'app', to: 'rt' }, ...specs.map((_, i) => ({ from: 'rt', to: `s${i}` }))];
  return { nodes, links, packets, stats, note, ...extra };
}

/** App -> router -> shard, second hop starts when the first lands. */
const route = (shard: number, label: string, delay = 0, tone: Packet['tone'] = 'req'): Packet[] => [
  { from: 'app', to: 'rt', label, delay, tone, dur: 0.6 },
  { from: 'rt', to: `s${shard}`, label, delay: delay + 0.6, tone, dur: 0.7 },
];

// ---------- hashing ----------

/** 32-bit FNV-1a. Deterministic, so the lesson always shows the same placement. */
function fnv(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const KEYS = Array.from({ length: 12 }, (_, i) => `u${i + 1}`);
const place = (keys: string[], n: number) => keys.map((k) => fnv(k) % n);
const bucket = (keys: string[], n: number) => {
  const out: string[][] = Array.from({ length: n }, () => []);
  keys.forEach((k, i) => out[place(keys, n)[i]].push(k));
  return out;
};
const BY3 = bucket(KEYS, 3);
const BY4 = bucket(KEYS, 4);
const P3 = place(KEYS, 3);
const P4 = place(KEYS, 4);
const MOVED = KEYS.filter((_, i) => P3[i] !== P4[i]);

// ---------- Step 1: one primary is full ----------

const ONE: FlowState = {
  nodes: [APP, { id: 'db', label: 'Primary', sub: 'holds everything', kind: 'db', x: 2.8, y: SHARD_Y, size: 'lg', status: 'hot', meter: meter(0.96, 'size + writes 96%'), items: KEYS }],
  links: [{ from: 'app', to: 'db' }],
  packets: [0, 0.2, 0.4, 0.6, 0.8].map((d) => ({ from: 'app', to: 'db', label: 'write', delay: d, dur: 0.8 })),
  stats: [
    { label: 'Nodes', value: '1' },
    { label: 'Holds', value: 'all data', tone: 'bad' },
    { label: 'Write rate', value: 'at the limit', tone: 'bad' },
  ],
  note: { text: 'shard when one primary cannot hold the data or the writes, not before', tone: 'bad' },
};

// ---------- Step 3: range ----------

const RANGES = ['A-F', 'G-M', 'N-Z'];
const NAMES = ['alice', 'bob', 'grace', 'kim', 'nina', 'zoe'];
const rangeOf = (name: string) => RANGES.findIndex((r) => name[0].toUpperCase() >= r[0] && name[0].toUpperCase() <= r[2]);
const RANGE_ITEMS = RANGES.map((_, i) => NAMES.filter((n) => rangeOf(n) === i));
const rangeSpecs = (hot?: number): ShardSpec[] => RANGES.map((r, i) => ({ sub: r, items: RANGE_ITEMS[i], status: hot === i ? 'active' : 'normal' }));

const TIME_RANGES = ['oldest', 'older', 'newest'];

// ---------- Step 5: shard key candidates (synthetic users) ----------

// 12 users: 7 in IN, 4 in US, 1 in BR. Sharding by country gives one shard per country.
const COUNTRY = ['IN', 'IN', 'US', 'IN', 'US', 'IN', 'BR', 'IN', 'US', 'IN', 'US', 'IN'];
const COUNTRIES = ['IN', 'US', 'BR'];
const BY_COUNTRY = COUNTRIES.map((c) => COUNTRY.filter((x) => x === c).length);
const share = (n: number) => n / KEYS.length;
const pct = (n: number) => `${Math.round(share(n) * 100)}%`;

// ---------- Step 7: hot key splitting ----------

const SPLIT = Array.from({ length: 10 }, (_, i) => `celeb#${i}`);
const SPLIT_BY3 = bucket(SPLIT, 3);

const CELEB = 'u7';
const CELEB_SHARD = P3[KEYS.indexOf(CELEB)];

export default defineLesson('flow', {
  slug: 'sharding',
  objectives: [
    { text: 'Know when to shard: data size or write rate beyond one primary', step: 1 },
    { text: 'Compare range and hash sharding', step: 4 },
    { text: 'Choose a shard key: cardinality, even load, matches the main query', step: 5 },
    { text: 'Handle cross-shard queries and hot keys', step: 7 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'One primary is full',
      tag: 'problem',
      body: [
        'Replicas scale reads, but every write still lands on one primary. When the data no longer fits, or the write rate is above what one node can take, you are stuck.',
      ],
      keyIdea: 'Sharding splits data across nodes so no node holds it all. Do it when you must, not before.',
      frames: [{ state: ONE }],
    },
    {
      label: 'Split it',
      title: 'Each shard owns a slice',
      tag: 'concept',
      body: [
        'A **router** maps every key to exactly one shard. Each shard is a full database for its slice of keys.',
        'Writes now spread across nodes. The rule that maps key to shard is the whole design.',
      ],
      keyIdea: 'Sharding (partitioning) adds write and storage capacity. The mapping rule decides balance and query cost.',
      frames: [
        {
          state: scene(BY3.map((items) => ({ items })), [...route(P3[0], KEYS[0]), ...route(P3[4], KEYS[4], 0.5), ...route(P3[8], KEYS[8], 1.0)], [
            { label: 'Shards', value: '3' },
            { label: 'Keys', value: String(KEYS.length) },
            { label: 'Writes', value: 'spread', tone: 'ok' },
          ]),
          hold: 2600,
        },
      ],
    },
    {
      label: 'Range',
      title: 'Range sharding',
      tag: 'technique',
      body: [
        '**Range** sharding gives each shard a key range: A to F, G to M, N to Z. A range scan touches one shard.',
        'But if the key is a timestamp, every new write falls in the newest range. One shard takes all the writes.',
      ],
      keyIdea: 'Range sharding is great for range scans and prone to hot spots on recent or popular ranges.',
      frames: [
        { state: scene(rangeSpecs(rangeOf('grace')), route(rangeOf('grace'), 'grace'), [{ label: 'Strategy', value: 'range' }, { label: 'grace', value: `-> ${RANGES[rangeOf('grace')]}` }, { label: 'Shards hit', value: '1' }]), hold: 1700 },
        {
          state: scene(rangeSpecs(0), route(0, 'A..C scan'), [{ label: 'Query', value: 'names A..C' }, { label: 'Shards hit', value: '1', tone: 'ok' }, { label: 'Range scans', value: 'efficient', tone: 'ok' }], { text: 'neighbouring keys live together', tone: 'ok' }),
          hold: 1800,
        },
        {
          state: scene(
            TIME_RANGES.map((t, i) => (i === 2 ? { sub: t, status: 'hot', load: 0.97, loadLabel: 'all new writes', badge: { text: 'hot spot', tone: 'bad' } } : { sub: t, load: 0.05 })),
            [0, 0.3, 0.6].flatMap((d) => route(2, 'now', d, 'bad')),
            [{ label: 'Key', value: 'created_at' }, { label: 'New writes', value: '100% on 1', tone: 'bad' }, { label: 'Other shards', value: 'idle', tone: 'bad' }],
            { text: 'time ranges: the newest shard takes every write', tone: 'bad' },
          ),
        },
      ],
    },
    {
      label: 'Hash',
      title: 'hash(key) mod N',
      tag: 'technique',
      body: [
        '**Hash** sharding sends a key to `hash(key) mod N`. Keys spread evenly, but neighbours scatter, so no range scans.',
        'Now add a fourth shard. With plain mod, most keys change shard and must move.',
      ],
      keyIdea: 'Plain mod N reshuffles almost everything when N changes. Consistent hashing moves only about 1/N of keys.',
      frames: [
        {
          state: scene(BY3.map((items) => ({ items, load: items.length / 6, loadLabel: `${items.length} keys` })), [...route(P3[1], KEYS[1]), ...route(P3[2], KEYS[2], 0.5)], [
            { label: 'N', value: '3' },
            { label: 'Per shard', value: BY3.map((b) => b.length).join(' / '), tone: 'ok' },
            { label: 'Range scans', value: 'no', tone: 'bad' },
          ]),
          hold: 2300,
        },
        {
          state: scene(
            BY4.map((items, i) => ({ items, load: items.length / 6, loadLabel: `${items.length} keys`, status: i === 3 ? 'active' : 'normal', badge: i === 3 ? { text: 'new', tone: 'accent' } : undefined })),
            MOVED.slice(0, 4).map((k, j) => ({ from: `s${P3[KEYS.indexOf(k)]}`, to: `s${P4[KEYS.indexOf(k)]}`, label: k, tone: 'bad' as const, delay: j * 0.35, dur: 0.9 })),
            [
              { label: 'N', value: '3 -> 4' },
              { label: 'Keys moved', value: `${MOVED.length} of ${KEYS.length}`, tone: 'bad' },
              { label: 'Ring would', value: '~1/N', hint: 'consistent hashing', tone: 'ok' },
            ],
            { text: `mod 4 instead of mod 3: ${MOVED.length} of ${KEYS.length} keys change shard`, tone: 'bad' },
          ),
        },
      ],
    },
    {
      label: 'Shard key',
      title: 'Choosing the shard key',
      tag: 'trade-off',
      body: [
        'A good shard key has **high cardinality**, spreads load evenly, and matches the main query so most queries hit one shard.',
        '`country` has few, uneven values. `user_id` is usually good for user-centric data, until one celebrity user gets all the traffic.',
      ],
      keyIdea: 'Pick the key the common query already filters on, with enough distinct values to spread.',
      frames: [
        {
          state: scene(
            COUNTRIES.map((c, i) => ({ sub: c, load: share(BY_COUNTRY[i]) * 1.5, loadLabel: pct(BY_COUNTRY[i]), status: i === 0 ? 'hot' : 'normal' })),
            [],
            [{ label: 'Key', value: 'country' }, { label: 'Values', value: String(COUNTRIES.length), tone: 'bad' }, { label: 'Biggest shard', value: pct(Math.max(...BY_COUNTRY)), tone: 'bad' }],
            { text: 'few values, very uneven', tone: 'bad' },
          ),
          hold: 2000,
        },
        {
          state: scene(BY3.map((items) => ({ items, load: share(items.length) * 1.5, loadLabel: pct(items.length) })), [], [
            { label: 'Key', value: 'user_id' },
            { label: 'Values', value: 'one per user', tone: 'ok' },
            { label: 'Biggest shard', value: pct(Math.max(...BY3.map((b) => b.length))), tone: 'ok' },
          ], { text: 'high cardinality: even spread', tone: 'ok' }),
          hold: 2000,
        },
        {
          state: scene(
            BY3.map((items, i) => (i === CELEB_SHARD ? { items, status: 'hot', load: 0.95, loadLabel: `${CELEB} is famous`, badge: { text: 'celebrity', tone: 'bad' } } : { items, load: 0.25 })),
            [0, 0.25, 0.5, 0.75].flatMap((d) => route(CELEB_SHARD, CELEB, d, 'bad')),
            [{ label: 'Key', value: 'user_id' }, { label: 'Hot key', value: CELEB, tone: 'bad' }, { label: 'Fix', value: 'see step 7' }],
            { text: 'even keys, uneven traffic: one celebrity heats a shard', tone: 'bad' },
          ),
        },
      ],
    },
    {
      label: 'Cross-shard',
      title: 'One shard or all of them',
      tag: 'trade-off',
      body: [
        'A query that includes the shard key goes to one shard. A query that does not must **scatter** to every shard and **gather** the results.',
        'Cross-shard transactions are even more expensive.',
      ],
      keyIdea: 'Design so the common path touches one shard, and accept scatter-gather for the rare queries.',
      frames: [
        {
          state: scene(BY3.map((items, i) => ({ items, status: i === P3[2] ? 'active' : 'dim' })), route(P3[2], `user ${KEYS[2]}`), [{ label: 'Query', value: 'by user_id' }, { label: 'Shards hit', value: '1', tone: 'ok' }, { label: 'Cost', value: 'one lookup', tone: 'ok' }]),
          hold: 2000,
        },
        {
          state: scene(
            BY3.map((items) => ({ items, status: 'active' })),
            [
              { from: 'app', to: 'rt', label: 'by email', dur: 0.6 },
              ...BY3.map((_, i) => ({ from: 'rt', to: `s${i}`, delay: 0.6, dur: 0.7 })),
              ...BY3.map((_, i) => ({ from: `s${i}`, to: 'rt', tone: 'res' as const, delay: 1.4, dur: 0.7 })),
              { from: 'rt', to: 'app', label: 'merged', tone: 'res', delay: 2.1, dur: 0.6 },
            ],
            [{ label: 'Query', value: 'no shard key' }, { label: 'Shards hit', value: String(BY3.length), tone: 'bad' }, { label: 'Pattern', value: 'scatter-gather' }],
            { text: 'every shard does work, the slowest one sets the latency', tone: 'bad' },
          ),
          hold: 3000,
        },
      ],
    },
    {
      label: 'Hot keys',
      title: 'Hot keys and resharding',
      tag: 'in practice',
      body: [
        'A hot key needs a targeted fix: a local cache, dedicated capacity, or **key splitting** into `key#0` to `key#9`, which hash to different shards.',
        'For growth, start with more **logical shards** than physical nodes, so you move whole shards in the background and then flip routing.',
      ],
      keyIdea: 'Split hot keys, and plan resharding up front with many small logical shards.',
      frames: [
        {
          state: scene(
            SPLIT_BY3.map((items) => ({ items, load: share(items.length) * 1.4, loadLabel: `${items.length} sub-keys` })),
            SPLIT.slice(0, 3).flatMap((k, j) => route(fnv(k) % 3, k, j * 0.45, 'data')),
            [{ label: 'Hot key', value: 'celeb' }, { label: 'Split into', value: `${SPLIT.length} keys` }, { label: 'Shards used', value: String(SPLIT_BY3.filter((b) => b.length).length), tone: 'ok' }],
            { text: 'celeb#0..celeb#9 hash to different shards', tone: 'ok' },
          ),
          hold: 2600,
        },
        {
          state: scene(
            [
              { label: 'Node 1', items: ['L1', 'L2', 'L3', 'L4'], load: 0.9, loadLabel: '4 logical' },
              { label: 'Node 2', items: ['L5', 'L6', 'L7', 'L8'], load: 0.9, loadLabel: '4 logical' },
            ],
            [],
            [{ label: 'Logical shards', value: '8' }, { label: 'Physical', value: '2' }, { label: 'Load', value: 'high', tone: 'bad' }],
            { text: 'more logical shards than nodes' },
          ),
          hold: 1800,
        },
        {
          state: scene(
            [
              { label: 'Node 1', items: ['L1', 'L2', 'L3'], load: 0.65, loadLabel: '3 logical' },
              { label: 'Node 2', items: ['L5', 'L6', 'L7'], load: 0.65, loadLabel: '3 logical' },
              { label: 'Node 3', items: ['L4', 'L8'], load: 0.45, loadLabel: '2 logical', status: 'active', badge: { text: 'new node', tone: 'accent' } },
            ],
            [
              { from: 's0', to: 's2', label: 'L4', tone: 'data', dur: 1 },
              { from: 's1', to: 's2', label: 'L8', tone: 'data', delay: 0.4, dur: 0.8 },
            ],
            [{ label: 'Moved', value: '2 whole shards', tone: 'ok' }, { label: 'Keys rehashed', value: '0', tone: 'ok' }, { label: 'Then', value: 'flip routing' }],
            { text: 'copy in the background, then flip routing', tone: 'ok' },
          ),
        },
      ],
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **When:** a single primary cannot handle the data size or write rate.',
        '- **Range:** range scans, hot spots. **Hash:** even, no range scans, mod N reshuffles.',
        '- **Consistent hashing** moves about 1/N of keys. **Directory** is flexible but adds a lookup service. **Geo** helps latency and residency.',
        '- **Shard key:** high cardinality, even load, matches the main query.',
        '- **Operations:** scatter-gather for rare queries, split hot keys, many logical shards.',
      ],
      keyIdea: 'The shard key is the decision you live with. Make the common query hit one shard.',
      frames: [
        {
          state: scene(BY3.map((items) => ({ items, load: share(items.length) * 1.5 })), [], [
            { label: 'Best key', value: 'matches query' },
            { label: 'Common path', value: '1 shard', tone: 'ok' },
            { label: 'Rare path', value: 'scatter' },
          ]),
        },
      ],
    },
  ],
});
