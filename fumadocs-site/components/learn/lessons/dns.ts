import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Sequence lessons list every message so far. `reveal` turns a script into frames,
 * each frame adding the next group of messages (and animating only those).
 */

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };

function reveal(actors: SeqActor[], beats: Beat[], base: SeqMessage[] = []): Frame<SeqState>[] {
  const so: SeqMessage[] = [...base];
  return beats.map((b) => {
    so.push(...b.msgs);
    return {
      hold: b.hold ?? 1700,
      state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note },
    };
  });
}

const IP = '203.0.113.10';

const BASIC: SeqActor[] = [
  { id: 'b', label: 'Browser', kind: 'client' },
  { id: 'r', label: 'Resolver', kind: 'dns' },
  { id: 'a', label: 'Authoritative', kind: 'dns' },
  { id: 's', label: 'Server', kind: 'service' },
];

// Step 1: the browser only has a name.
const problemFrames = reveal(BASIC, [
  {
    msgs: [{ from: 'b', to: 's', label: 'GET api.shop.com', lost: true, tone: 'bad' }],
    hold: 2000,
    stats: [
      { label: 'Browser has', value: 'a name' },
      { label: 'Network needs', value: 'an IP' },
      { label: 'Request', value: 'cannot leave', tone: 'bad' },
    ],
    note: { text: 'no address yet: DNS must answer first', tone: 'bad' },
  },
]);

// Step 2: resolve once, cache by TTL.
const resolveMsgs: SeqMessage[] = [
  { from: 'b', to: 'r', label: 'A? api.shop.com' },
  { from: 'r', to: 'a', label: 'A? api.shop.com' },
  { from: 'a', to: 'r', label: `A ${IP} ttl 300`, dashed: true },
  { from: 'r', to: 'b', label: IP, dashed: true },
  { from: 'b', to: 's', label: `connect ${IP}`, tone: 'ok' },
];
const resolveStats = (step: number): Stat[] => [
  { label: 'Record', value: 'A', hint: 'name to IPv4' },
  { label: 'Hops', value: String(step) },
  { label: 'Cached for', value: step >= 3 ? '300 s' : '-', tone: step >= 3 ? 'ok' : 'neutral' },
];
const resolveFrames = reveal(
  BASIC,
  resolveMsgs.map((m, i) => ({
    msgs: [m],
    hold: 1300,
    stats: resolveStats(i + 1),
    actors: i >= 2 ? BASIC.map((a) => (a.id === 'r' ? { ...a, badge: { text: 'cached 300 s', tone: 'ok' as const } } : a)) : BASIC,
    note: i === 4 ? { text: 'only now can the real request start', tone: 'accent' as const } : undefined,
  })),
);

// Step 3: record types, with a CNAME hop.
const recordFrames = reveal(BASIC, [
  {
    msgs: [
      { from: 'b', to: 'r', label: 'A? www.shop.com' },
      { from: 'r', to: 'a', label: 'A? www.shop.com' },
    ],
    hold: 1800,
    stats: [
      { label: 'A / AAAA', value: 'IPv4 / IPv6' },
      { label: 'CNAME', value: 'alias' },
      { label: 'NS', value: 'authority' },
    ],
  },
  {
    msgs: [{ from: 'a', to: 'r', label: 'CNAME shop.cdn.net', dashed: true, tone: 'data' }],
    hold: 1800,
    stats: [
      { label: 'A / AAAA', value: 'IPv4 / IPv6' },
      { label: 'CNAME', value: 'alias', tone: 'ok' },
      { label: 'NS', value: 'authority' },
    ],
    note: { text: 'an alias: look up the other name instead', tone: 'accent' },
  },
  {
    msgs: [
      { from: 'r', to: 'a', label: 'A? shop.cdn.net' },
      { from: 'a', to: 'r', label: 'A 198.51.100.7', dashed: true },
      { from: 'r', to: 'b', label: '198.51.100.7', dashed: true },
    ],
    stats: [
      { label: 'CNAME', value: 'alias' },
      { label: 'MX', value: 'mail servers' },
      { label: 'TXT', value: 'SPF, verify' },
    ],
  },
]);

// Step 4: TTL. Within it the resolver answers alone, after it the resolver asks again.
const ttlActors = (badge: string, tone: 'ok' | 'bad'): SeqActor[] => BASIC.map((a) => (a.id === 'r' ? { ...a, badge: { text: badge, tone } } : a));
const ttlFrames = reveal(BASIC, [
  {
    msgs: [
      { from: 'b', to: 'r', label: 'A? api.shop.com' },
      { from: 'r', to: 'r', label: 'cache hit', tone: 'ok' },
      { from: 'r', to: 'b', label: IP, dashed: true },
    ],
    actors: ttlActors('120 s left', 'ok'),
    hold: 2400,
    stats: [
      { label: 'TTL left', value: '120 s', tone: 'ok' },
      { label: 'Authority asked', value: 'no', tone: 'ok' },
      { label: 'Latency', value: 'low' },
    ],
    note: { text: 'within the TTL the resolver answers from cache', tone: 'ok' },
  },
  {
    msgs: [
      { from: 'r', to: 'r', label: 'TTL expired', tone: 'data' },
      { from: 'b', to: 'r', label: 'A? api.shop.com' },
      { from: 'r', to: 'a', label: 'A? api.shop.com' },
      { from: 'a', to: 'r', label: `A ${IP} ttl 300`, dashed: true },
      { from: 'r', to: 'b', label: IP, dashed: true },
    ],
    actors: ttlActors('cached 300 s', 'ok'),
    stats: [
      { label: 'Short TTL', value: 'fast failover', tone: 'ok', hint: 'more DNS load' },
      { label: 'Long TTL', value: 'cheap', hint: 'slow to change' },
      { label: 'Authority asked', value: 'yes' },
    ],
    note: { text: 'short TTL: fast change, more load. long TTL: cheap, slow' },
  },
]);

// Steps 5 and 6: steering and failover, with two regions behind a steering DNS service.
const STEER: SeqActor[] = [
  { id: 'b', label: 'Browser', kind: 'client' },
  { id: 'r', label: 'Resolver', kind: 'dns' },
  { id: 'd', label: 'Steering DNS', kind: 'dns' },
  { id: 'ra', label: 'Region A', kind: 'service' },
  { id: 'rb', label: 'Region B', kind: 'service' },
];
const steerMsgs: SeqMessage[][] = [
  [
    { from: 'd', to: 'ra', label: 'health check', tone: 'data' },
    { from: 'ra', to: 'd', label: 'healthy', dashed: true },
  ],
  [
    { from: 'b', to: 'r', label: 'A? api.shop.com' },
    { from: 'r', to: 'd', label: 'A? api.shop.com' },
    { from: 'd', to: 'r', label: 'Region A: closest', dashed: true },
  ],
  [
    { from: 'r', to: 'b', label: 'Region A IP', dashed: true },
    { from: 'b', to: 'ra', label: 'request', tone: 'ok' },
  ],
];
const steerStats: Stat[] = [
  { label: 'Policy', value: 'latency-based' },
  { label: 'Also', value: 'weighted, geo' },
  { label: 'Failover', value: 'health checks' },
];
const steerFrames = reveal(STEER, [
  { msgs: steerMsgs[0], hold: 1800, stats: steerStats },
  { msgs: steerMsgs[1], hold: 2400, stats: steerStats, note: { text: 'the answer depends on who asks and what is healthy', tone: 'accent' } },
  { msgs: steerMsgs[2], stats: steerStats },
]);

const downActors = (rb?: boolean): SeqActor[] =>
  STEER.map((a) =>
    a.id === 'ra' ? { ...a, status: 'down' as const, badge: { text: 'region down', tone: 'bad' as const } } : a.id === 'r' && !rb ? { ...a, badge: { text: 'still cached', tone: 'bad' as const } } : a,
  );
const failoverFrames = reveal(
  STEER,
  [
    {
      msgs: [{ from: 'd', to: 'ra', label: 'health check', lost: true, tone: 'bad' }],
      actors: downActors(),
      hold: 1700,
      stats: [
        { label: 'Region A', value: 'down', tone: 'bad' },
        { label: 'DNS answer', value: 'flips to B', tone: 'ok' },
        { label: 'Cached answer', value: 'still A', tone: 'bad' },
      ],
    },
    {
      msgs: [{ from: 'b', to: 'ra', label: 'request (cached IP)', lost: true, tone: 'bad' }],
      actors: downActors(),
      hold: 2000,
      stats: [
        { label: 'Region A', value: 'down', tone: 'bad' },
        { label: 'Users fail until', value: 'TTL expires', tone: 'bad' },
        { label: 'Some resolvers', value: 'ignore TTL', tone: 'bad' },
      ],
      note: { text: 'failover is bounded by TTLs', tone: 'bad' },
    },
    {
      msgs: [
        { from: 'r', to: 'r', label: 'TTL expired', tone: 'data' },
        { from: 'r', to: 'd', label: 'A? api.shop.com' },
        { from: 'd', to: 'r', label: 'Region B IP', dashed: true },
        { from: 'r', to: 'b', label: 'Region B IP', dashed: true },
        { from: 'b', to: 'rb', label: 'request', tone: 'ok' },
      ],
      actors: downActors(true),
      stats: [
        { label: 'Region A', value: 'down', tone: 'bad' },
        { label: 'Users on', value: 'Region B', tone: 'ok' },
        { label: 'Good for', value: 'region-level' },
      ],
      note: { text: 'use DNS for regional failover, not per-request routing', tone: 'accent' },
    },
  ],
  [...steerMsgs.flat()],
);

const RECAP: SeqState = {
  actors: BASIC.map((a) => (a.id === 'r' ? { ...a, badge: { text: 'caches by TTL', tone: 'ok' } } : a)),
  messages: resolveMsgs,
  fresh: 0,
  stats: [
    { label: 'First hop', value: 'every request' },
    { label: 'TTL', value: 'speed vs load' },
    { label: 'Anycast', value: 'nearest copy' },
  ],
};

export default defineLesson('sequence', {
  slug: 'dns',
  objectives: [
    { text: 'Walk a name lookup from browser to authoritative server', step: 2 },
    { text: 'Know what A, AAAA, CNAME, NS, MX and TXT records do', step: 3 },
    { text: 'Choose a TTL: fast failover vs DNS load', step: 4 },
    { text: 'Steer traffic with DNS, and know where it falls short', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Names, not numbers',
      tag: 'problem',
      body: [
        'The browser knows `api.shop.com`. The network needs an IP address.',
        '**DNS** maps names to addresses. It is the first dependency of almost every request, which makes it a hidden single point of failure.',
      ],
      keyIdea: 'No DNS answer, no request. DNS is code you depend on.',
      frames: problemFrames,
    },
    {
      label: 'Resolve',
      title: 'Ask the resolver, it asks the authority',
      tag: 'concept',
      body: [
        'The browser asks a **resolver**. The resolver asks the **authoritative** server for the zone (the one named in its NS record).',
        'The answer comes back with a **TTL**, and the resolver caches it for that long.',
      ],
      keyIdea: 'The resolver caches answers. The authoritative server for the zone owns them.',
      frames: resolveFrames,
    },
    {
      label: 'Records',
      title: 'Record types',
      tag: 'technique',
      body: [
        '**A / AAAA** map a name to IPv4 / IPv6. **CNAME** is an alias to another name, so the resolver looks that name up next. **NS** says which servers are authoritative.',
        '**MX** lists mail servers. **TXT** holds text for domain verification and SPF.',
      ],
      keyIdea: 'A CNAME is an alias, so it costs one more lookup before the resolver has an IP.',
      frames: recordFrames,
    },
    {
      label: 'TTL',
      title: 'TTL: cache or ask again',
      tag: 'technique',
      body: [
        'Within the TTL the resolver answers from cache, without asking the authority. After it expires, the resolver asks again.',
        'A **short TTL** gives fast failover but more DNS load. A **long TTL** is cheap but slow to change.',
      ],
      keyIdea: 'TTL trades speed of change against DNS load. Pick it by how fast you need to move traffic.',
      frames: ttlFrames,
    },
    {
      label: 'Steering',
      title: 'DNS as a traffic switch',
      tag: 'technique',
      body: [
        'Steering DNS (Route 53, Cloudflare, NS1) answers differently by policy: **weighted** (5% to a canary), **latency-based** (closest healthy region), **geolocation** (by country), **failover** (health checks flip to a standby).',
      ],
      keyIdea: 'The DNS answer itself becomes a routing decision, based on the client and on health checks.',
      frames: steerFrames,
    },
    {
      label: 'Failover',
      title: 'Failover waits for the TTL',
      tag: 'trade-off',
      body: [
        'Region A dies. The steering service flips its answer to region B, but resolvers keep serving the cached answer until the TTL expires, and some ignore TTLs.',
        'Use DNS for coarse regional failover, not per-request routing.',
      ],
      keyIdea: 'DNS failover is bounded by TTLs and by resolvers that ignore them.',
      frames: failoverFrames,
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Path:** browser -> resolver -> authoritative, cached by TTL.',
        '- **Records:** A/AAAA, CNAME, NS, MX, TXT.',
        '- **TTL:** short is fast to change, long is cheap.',
        '- **Steering:** weighted, latency, geo, failover. **Anycast** sends each client to the nearest location with the same IP.',
        '- **Risk:** a hidden SPOF. The October 2025 AWS incident began with an empty DNS record.',
      ],
      keyIdea: 'DNS is the first hop of every request. Plan its TTLs and failure modes like any other dependency.',
      frames: [{ state: RECAP }],
    },
  ],
});
