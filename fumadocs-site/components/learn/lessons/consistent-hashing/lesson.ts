import { getLessonMeta } from '@/lib/learn/catalog';
import { SERVER_COLORS } from '../../iso';
import type { Lesson, Stat } from '../../types';
import { KEYS, modOwner, ownerOf, shares, type HashState } from './model';
import { BASE4, B_FAILING, REPLICA_RING, UNEVEN3, VNODES3, WITH_E, WITHOUT_B } from './rings';
import { HashScene } from './Scene';

const pct = (n: number) => `${Math.round(n * 100)}%`;

function stats(state: HashState): Stat[] {
  if (state.mode === 'mod') {
    const counts = Array.from({ length: state.n }, (_, i) => KEYS.filter((k) => modOwner(k.hash, state.n) === i).length);
    const moved =
      state.baselineN === undefined
        ? undefined
        : KEYS.filter((k) => modOwner(k.hash, state.n) !== modOwner(k.hash, state.baselineN!)).length;
    return [
      { label: 'Servers', value: String(state.n) },
      {
        label: 'Keys moved',
        value: moved === undefined ? '-' : `${moved} / ${KEYS.length}`,
        hint: moved === undefined ? undefined : pct(moved / KEYS.length),
        tone: moved !== undefined && moved / KEYS.length > 0.5 ? 'bad' : 'neutral',
      },
      { label: 'Biggest share', value: pct(Math.max(...counts) / KEYS.length), hint: `fair ${pct(1 / state.n)}` },
    ];
  }

  const live = state.markers.filter((m) => !m.failing);
  const servers = new Set(live.map((m) => m.server)).size;
  const share = Math.max(0, ...shares(live).values());
  const moved = state.baseline
    ? KEYS.filter((k) => ownerOf(state.baseline!, k.angle) !== ownerOf(live, k.angle)).length
    : undefined;
  return [
    { label: 'Servers', value: String(servers), hint: live.length > servers ? `${live.length} ring points` : undefined },
    {
      label: 'Keys moved',
      value: moved === undefined ? '-' : `${moved} / ${KEYS.length}`,
      hint: moved === undefined ? undefined : pct(moved / KEYS.length),
      tone: moved === undefined ? 'neutral' : moved / KEYS.length > 0.5 ? 'bad' : 'ok',
    },
    {
      label: 'Biggest share',
      value: servers ? pct(share) : '-',
      hint: servers ? `fair ${pct(1 / servers)}` : undefined,
      tone: servers && share > 1.5 / servers ? 'bad' : 'neutral',
    },
  ];
}

const ring = (s: Omit<Extract<HashState, { mode: 'ring' }>, 'mode' | 'showKeys' | 'showArcs'> & { showKeys?: boolean; showArcs?: boolean }): HashState => ({
  mode: 'ring',
  showKeys: true,
  showArcs: true,
  ...s,
});

export const consistentHashing: Lesson<HashState> = {
  meta: getLessonMeta('consistent-hashing')!,
  Scene: HashScene,
  stats,
  legend: [
    { label: 'key', color: '#a3a3a3', shape: 'dot' },
    { label: 'owned arc', color: SERVER_COLORS.A, shape: 'bar' },
    { label: 'moved key', color: '#f5d547', shape: 'ring' },
  ],
  objectives: [
    { text: 'Why hash % N breaks when the fleet resizes', step: 1 },
    { text: 'How a key finds its server on the ring', step: 3 },
    { text: 'Why a resize moves only about 1/N of keys', step: 5 },
    { text: 'How virtual nodes fix lumpy load', step: 7 },
    { text: 'Replication and where rings show up in practice', step: 9 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'hash % N reshuffles everything',
      tag: 'problem',
      body: [
        'You run 4 cache servers. The obvious way to pick one is **server = hash(key) % N**. It spreads keys evenly and needs no lookup table.',
        'Traffic grows, so you add a fifth server. N changes from 4 to 5, and almost every remainder changes with it. Watch how many keys land somewhere new.',
      ],
      keyIdea:
        'With mod-N, going from N to N+1 servers moves about N/(N+1) of all keys. For a cache that is a miss storm on the database. For a datastore it is a full migration.',
      frames: [
        { state: { mode: 'mod', n: 4 }, hold: 1800 },
        { state: { mode: 'mod', n: 5, baselineN: 4, note: { text: '+1 server, most keys move', tone: 'bad' } } },
      ],
    },
    {
      label: 'The ring',
      title: 'Bend the hash space into a circle',
      tag: 'concept',
      body: [
        'Take the whole hash range, 0 to 2³² - 1, and join the two ends so it forms a ring.',
        'Hash each **server** name onto that same ring. Every server now sits at a fixed spot that depends only on its own name, not on how many other servers exist.',
      ],
      keyIdea: 'Positions come from hashing the server id, not from N. Adding a server never moves the others.',
      frames: [
        { state: ring({ markers: [], showKeys: false, showArcs: false }), hold: 500 },
        { state: ring({ markers: BASE4.slice(0, 1), showKeys: false, showArcs: false }), hold: 450 },
        { state: ring({ markers: BASE4.slice(0, 2), showKeys: false, showArcs: false }), hold: 450 },
        { state: ring({ markers: BASE4.slice(0, 3), showKeys: false, showArcs: false }), hold: 450 },
        { state: ring({ markers: BASE4, showKeys: false, showArcs: false }) },
      ],
    },
    {
      label: 'Keys',
      title: 'Each key walks clockwise',
      tag: 'technique',
      body: [
        'Hash each **key** onto the ring too. A key belongs to the **first server clockwise** from where it lands.',
        'The coloured arcs show which stretch of the ring each server owns. Every dot is a key, coloured by its owner. Walk past 2³² and you wrap back to 0.',
      ],
      keyIdea:
        'Lookup: hash the key, then binary search a sorted array of server positions for the first one at or after it. O(log N), no coordinator.',
      frames: [
        { state: ring({ markers: BASE4 }), hold: 900 },
        { state: ring({ markers: BASE4, lookups: [{ angle: 160 }] }), hold: 2400 },
        { state: ring({ markers: BASE4, lookups: [{ angle: 322 }], note: { text: 'past the top, wrap around to A' } }) },
      ],
    },
    {
      label: 'Add a server',
      title: 'A new server takes one arc',
      tag: 'technique',
      body: [
        'Server **E** joins and hashes to a spot between B and C.',
        'Only the keys on the arc just before E change owner. They used to walk on to C, now they stop at E. Every other key stays exactly where it was.',
      ],
      keyIdea: 'Adding a server moves about 1/N of the keys, and all of them come from a single neighbour.',
      frames: [
        { state: ring({ markers: BASE4 }), hold: 1200 },
        { state: ring({ markers: WITH_E, baseline: BASE4, note: { text: 'only the B → E arc changed', tone: 'accent' } }) },
      ],
    },
    {
      label: 'Remove one',
      title: 'A lost server hands off one arc',
      tag: 'technique',
      body: [
        'Server **B** crashes. Its keys keep walking clockwise and land on the next server, E.',
        'Nobody else is touched. With mod-N, losing one server would have reshuffled nearly everything.',
      ],
      keyIdea: "On removal, a server's whole arc goes to its clockwise successor. Simple, but that one successor's load jumps.",
      frames: [
        { state: ring({ markers: WITH_E }), hold: 1000 },
        { state: ring({ markers: B_FAILING, showArcs: false, note: { text: 'B is down', tone: 'bad' } }), hold: 1300 },
        { state: ring({ markers: WITHOUT_B, baseline: WITH_E, note: { text: "B's keys walk on to E", tone: 'accent' } }) },
      ],
    },
    {
      label: 'Uneven',
      title: 'Random positions are lumpy',
      tag: 'trade-off',
      body: [
        'With only a few servers, hashed positions cluster by chance. Here three servers landed close together, so **A** owns two thirds of the ring.',
        'It gets worse on failure: when a server leaves, its entire load lands on one neighbour instead of spreading out.',
      ],
      keyIdea: 'Few points on a ring means high variance. One unlucky server can carry two or three times its fair share.',
      frames: [{ state: ring({ markers: UNEVEN3, note: { text: 'A owns 67%, fair is 33%', tone: 'bad' } }) }],
    },
    {
      label: 'Virtual nodes',
      title: 'Many small points per server',
      tag: 'technique',
      body: [
        'Give each physical server several ring positions by hashing `A#0`, `A#1`, `A#2` and so on. These are **virtual nodes**.',
        'Each server now owns many small arcs scattered around the ring, so the load averages out. A bigger machine can simply get more virtual nodes.',
      ],
      keyIdea:
        'Real systems use 100 to 256 virtual nodes per server. When one leaves, its small arcs spread over many neighbours instead of one.',
      frames: [
        { state: ring({ markers: UNEVEN3 }), hold: 1400 },
        { state: ring({ markers: VNODES3, small: true, note: { text: 'biggest share 67% → 35%', tone: 'accent' } }) },
      ],
    },
    {
      label: 'Replicas',
      title: 'Copies go to the next servers',
      tag: 'technique',
      body: [
        'For durability, write each key to the first **3 distinct servers** clockwise. Dynamo and Cassandra call this the **preference list**.',
        'Skip virtual nodes that belong to a server already chosen, so the copies end up on different machines.',
      ],
      keyIdea: 'Replication factor 3 with quorum reads and writes (R + W > N) is the classic Dynamo-style setup.',
      frames: [
        { state: ring({ markers: REPLICA_RING, small: true }), hold: 900 },
        { state: ring({ markers: REPLICA_RING, small: true, lookups: [{ angle: 48, replicas: 3 }] }) },
      ],
    },
    {
      label: 'In practice',
      title: 'Where you will meet it',
      tag: 'in practice',
      body: [
        'Memcached clients (ketama), Amazon Dynamo, Cassandra, Riak and many chat and cache fleets place nodes on a hash ring.',
        'The client hashes the key and talks straight to the owner. No coordinator sits on the request path, and resizing the fleet only invalidates a slice of the cache.',
      ],
      keyIdea:
        'Alternatives worth naming: rendezvous (HRW) hashing, jump consistent hash, and fixed slots like the 16,384 hash slots in Redis Cluster.',
      frames: [
        { state: ring({ markers: WITH_E, client: true, showArcs: true }), hold: 700 },
        { state: ring({ markers: WITH_E, client: true, lookups: [{ angle: 75 }] }), hold: 1500 },
        { state: ring({ markers: WITH_E, client: true, lookups: [{ angle: 250 }] }), hold: 1500 },
        { state: ring({ markers: WITH_E, client: true, lookups: [{ angle: 350 }] }) },
      ],
    },
    {
      label: 'Recap',
      title: 'What to say in the interview',
      tag: 'recap',
      body: [
        '- **Problem:** hash % N moves almost every key when N changes.',
        '- **Ring:** hash servers and keys onto 0 to 2³². A key goes to the first server clockwise.',
        '- **Resize:** adding or removing a server moves about 1/N of the keys.',
        '- **Balance:** virtual nodes smooth out lumpy arcs and spread failover load.',
        '- **Durability:** replicate to the next R distinct servers on the ring.',
      ],
      keyIdea: 'One line: consistent hashing makes the cost of resharding proportional to the change, not to the dataset.',
      frames: [{ state: ring({ markers: VNODES3, small: true }) }],
    },
  ],
};

export default consistentHashing as unknown as Lesson<unknown>;
