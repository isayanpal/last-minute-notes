import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';

/*
 * Layout: author on the left (x 0), post service and queue (x 1.6 to 3), followers' feed caches on the right (x 5).
 */

const AUTHOR: FlowNode = { id: 'a', label: 'Author', sub: '100 followers', kind: 'client', x: 0, y: 1.6, size: 'sm' };
const POSTS: FlowNode = { id: 'ps', label: 'Post service', kind: 'service', x: 1.7, y: 1.6, size: 'sm' };
const BUS: FlowNode = { id: 'q', label: 'Kafka', sub: 'post events', kind: 'queue', x: 3.2, y: 1.6, size: 'sm' };
const FEEDS = (items: string[][]): FlowNode[] =>
  [0.2, 1.2, 2.2, 3.2].map((y, i) => ({ id: `f${i}`, label: `Feed ${i + 1}`, sub: 'Redis list', kind: 'cache' as const, x: 5.2, y, size: 'sm' as const, items: items[i] ?? [] }));

// Step 1: numbers and the read/write skew.
const NUMBERS: FlowState = {
  nodes: [
    { id: 'u', label: '200M DAU', sub: '10 feed opens each', kind: 'client', x: 0.2, y: 1.6, size: 'sm' },
    { id: 'fs', label: 'Feed service', kind: 'service', x: 2.7, y: 0.5, size: 'sm', meter: { value: 0.95, label: '23k reads / s', tone: 'bad' } },
    { id: 'ps', label: 'Post service', kind: 'service', x: 2.7, y: 2.8, size: 'sm', meter: { value: 0.1, label: '230 writes / s', tone: 'ok' } },
    { id: 'db', label: 'Post store', sub: 'sharded', kind: 'db', x: 5.2, y: 1.6, size: 'sm' },
  ],
  links: [
    { from: 'u', to: 'fs' },
    { from: 'u', to: 'ps' },
    { from: 'fs', to: 'db' },
    { from: 'ps', to: 'db' },
  ],
  packets: [
    ...[0, 0.15, 0.3, 0.45, 0.6].map((d): Packet => ({ from: 'u', to: 'fs', delay: d, dur: 0.6 })),
    { from: 'u', to: 'ps', delay: 0.4, dur: 0.6, tone: 'data' },
  ],
  stats: [
    { label: 'Reads', value: '~23k / s', hint: 'peak 70k' },
    { label: 'Posts', value: '~230 / s' },
    { label: 'Ratio', value: '100 : 1', tone: 'bad' },
  ],
  note: { text: 'optimise for reads: a feed open must be near-instant', tone: 'accent' },
};

// Step 2: fan-out on write (push).
const pushScene = (landed: boolean): FlowState => {
  const items = landed ? [['p9'], ['p9'], ['p9'], ['p9']] : [[], [], [], []];
  const out: Packet[] = [
    { from: 'a', to: 'ps', dur: 0.5, label: 'post p9' },
    { from: 'ps', to: 'q', delay: 0.5, dur: 0.5, tone: 'data' },
    ...[0, 1, 2, 3].map((i): Packet => ({ from: 'q', to: `f${i}`, delay: 1.1 + i * 0.12, dur: 0.7, tone: 'data', label: 'p9' })),
  ];
  return {
    nodes: [AUTHOR, POSTS, BUS, ...FEEDS(items)],
    links: [{ from: 'a', to: 'ps' }, { from: 'ps', to: 'q' }, ...[0, 1, 2, 3].map((i): FlowLink => ({ from: 'q', to: `f${i}`, dashed: true }))],
    packets: landed ? [] : out,
    stats: [
      { label: 'On post', value: 'N feed inserts' },
      { label: 'On read', value: '1 list read', tone: 'ok' },
      { label: 'Cost', value: 'N per post', tone: 'bad' },
    ],
    note: { text: landed ? 'followers read a precomputed list: very fast' : 'a worker writes the post id into every follower feed', tone: 'accent' },
  };
};

// Step 3: fan-out on read (pull).
const PULL: FlowState = {
  nodes: [
    { id: 'u', label: 'Reader', sub: 'follows 500', kind: 'client', x: 0.2, y: 1.6, size: 'sm' },
    { id: 'fs', label: 'Feed service', sub: 'merge + sort', kind: 'service', x: 2.4, y: 1.6, size: 'sm', status: 'hot' },
    ...[0.2, 1.2, 2.2, 3.2].map((y, i): FlowNode => ({ id: `s${i}`, label: `Author ${i + 1}`, sub: 'recent posts', kind: 'db', x: 5.0, y, size: 'sm' })),
  ],
  links: [{ from: 'u', to: 'fs' }, ...[0, 1, 2, 3].map((i): FlowLink => ({ from: 'fs', to: `s${i}` }))],
  packets: [
    { from: 'u', to: 'fs', dur: 0.5, label: 'open feed' },
    ...[0, 1, 2, 3].map((i): Packet => ({ from: 'fs', to: `s${i}`, delay: 0.5 + i * 0.12, dur: 0.6, label: 'recent?' })),
    ...[0, 1, 2, 3].map((i): Packet => ({ from: `s${i}`, to: 'fs', delay: 1.3 + i * 0.12, dur: 0.6, tone: 'data' })),
  ],
  stats: [
    { label: 'On post', value: '1 write', tone: 'ok' },
    { label: 'On read', value: 'N queries', tone: 'bad' },
    { label: 'Freshness', value: 'always fresh', tone: 'ok' },
  ],
  note: { text: 'cheap writes, slow reads for people who follow many accounts', tone: 'bad' },
};

// Step 4: the celebrity.
const CELEB = (push: boolean): FlowState => ({
  nodes: [
    { id: 'a', label: 'Celebrity', sub: '50M followers', kind: 'client', x: 0, y: 1.6, size: 'sm' },
    POSTS,
    { ...BUS, status: push ? 'hot' : 'normal', badge: push ? { text: '50M inserts', tone: 'bad' } : { text: 'celebrity: skip push', tone: 'accent' } },
    { id: 'w', label: 'Fan-out workers', kind: 'worker', x: 4.5, y: 0.4, size: 'sm', status: push ? 'hot' : 'dim', meter: push ? { value: 1, label: 'backlog grows', tone: 'bad' } : undefined },
    { id: 'pc', label: 'Celebrity posts', sub: 'fetched live', kind: 'db', x: 4.5, y: 2.9, size: 'sm', status: push ? 'dim' : 'active' },
  ],
  links: [
    { from: 'a', to: 'ps' },
    { from: 'ps', to: 'q' },
    { from: 'q', to: 'w', dashed: push, tone: push ? 'bad' : undefined },
    { from: 'ps', to: 'pc', tone: push ? undefined : 'accent' },
  ],
  packets: push
    ? [
        { from: 'a', to: 'ps', dur: 0.5 },
        { from: 'ps', to: 'q', delay: 0.5, dur: 0.5, tone: 'bad' },
        ...[0, 1, 2, 3].map((i): Packet => ({ from: 'q', to: 'w', delay: 1.0 + i * 0.15, dur: 0.6, tone: 'bad' })),
      ]
    : [
        { from: 'a', to: 'ps', dur: 0.5 },
        { from: 'ps', to: 'pc', delay: 0.5, dur: 0.8, tone: 'accent', label: 'store once' },
      ],
  stats: push
    ? [{ label: 'Followers', value: '50M' }, { label: 'Writes', value: '50M per post', tone: 'bad' }, { label: 'Result', value: 'workers drown', tone: 'bad' }]
    : [{ label: 'Push for', value: '< 100k fans', tone: 'ok' }, { label: 'Celebrity', value: 'pulled at read', tone: 'ok' }, { label: 'Write cost', value: '1', tone: 'ok' }],
  note: push ? { text: 'write amplification: one post becomes 50 million writes', tone: 'bad' } : { text: 'hybrid: push for normal users, pull for celebrities', tone: 'accent' },
});

// Step 5: the hybrid read path.
const READ: FlowState = {
  nodes: [
    { id: 'u', label: 'Reader', kind: 'client', x: 0, y: 1.6, size: 'sm' },
    { id: 'fs', label: 'Feed service', kind: 'service', x: 1.6, y: 1.6, size: 'sm' },
    { id: 'fc', label: 'Feed cache', sub: 'ids, newest 800', kind: 'cache', x: 3.4, y: 0.2, size: 'sm', items: ['p9', 'p7', 'p4'] },
    { id: 'cp', label: 'Celebrity posts', kind: 'db', x: 3.4, y: 1.6, size: 'sm' },
    { id: 'rk', label: 'Ranking', sub: 'time budget', kind: 'worker', x: 3.4, y: 3.0, size: 'sm' },
    { id: 'hy', label: 'Post cache', sub: 'hydrate objects', kind: 'cache', x: 5.4, y: 1.6, size: 'sm' },
  ],
  links: [
    { from: 'u', to: 'fs' },
    { from: 'fs', to: 'fc' },
    { from: 'fs', to: 'cp' },
    { from: 'fs', to: 'rk' },
    { from: 'fs', to: 'hy' },
  ],
  packets: [
    { from: 'u', to: 'fs', dur: 0.5, label: 'open feed' },
    { from: 'fs', to: 'fc', delay: 0.5, dur: 0.5, tone: 'data', label: 'ids' },
    { from: 'fs', to: 'cp', delay: 0.5, dur: 0.5, tone: 'data', label: 'live' },
    { from: 'fs', to: 'rk', delay: 1.1, dur: 0.6, label: 'score' },
    { from: 'fs', to: 'hy', delay: 1.8, dur: 0.6, tone: 'data', label: 'hydrate' },
    { from: 'fs', to: 'u', delay: 2.5, dur: 0.6, tone: 'res', label: 'page 1' },
  ],
  stats: [
    { label: 'Merge', value: 'cache + celebs' },
    { label: 'Rank', value: 'or by time' },
    { label: 'Target', value: '< 500 ms', tone: 'ok' },
  ],
  note: { text: 'ranking has a time budget and a chronological fallback', tone: 'accent' },
};

// Step 6: details that keep it cheap.
const DETAILS = (stage: 'ids' | 'delete' | 'cursor'): FlowState => ({
  nodes: patch<FlowNode>(
    [
      { id: 'fc', label: 'Feed cache', sub: 'post ids only', kind: 'cache', x: 0.6, y: 1.6, size: 'sm', items: ['p9', 'p7', 'p4'] },
      { id: 'hy', label: 'Hydrate', sub: 'filter + join', kind: 'service', x: 2.9, y: 1.6, size: 'sm' },
      { id: 'pc', label: 'Post store', sub: 'author, text, count', kind: 'db', x: 5.3, y: 0.4, size: 'sm', items: ['p7: del'] },
      { id: 'ct', label: 'Like counters', sub: 'approximate', kind: 'cache', x: 5.3, y: 2.8, size: 'sm' },
    ],
    {
      fc: stage === 'cursor' ? { badge: { text: 'cursor = last id', tone: 'accent' } } : {},
      hy: stage === 'delete' ? { badge: { text: 'drops deleted p7', tone: 'accent' } } : {},
    },
  ),
  links: [
    { from: 'fc', to: 'hy' },
    { from: 'hy', to: 'pc' },
    { from: 'hy', to: 'ct' },
  ],
  packets: [
    { from: 'fc', to: 'hy', dur: 0.6, label: stage === 'cursor' ? 'after p4' : 'p9 p7 p4' },
    { from: 'hy', to: 'pc', delay: 0.6, dur: 0.6, tone: 'data' },
    { from: 'hy', to: 'ct', delay: 0.6, dur: 0.6, tone: 'data' },
  ],
  stats:
    stage === 'ids'
      ? [{ label: 'Cache holds', value: 'ids, not posts', tone: 'ok' }, { label: 'Per user', value: 'newest 800' }, { label: 'Memory', value: 'tiny', tone: 'ok' }]
      : stage === 'delete'
        ? [{ label: 'Delete', value: 'mark + filter', tone: 'ok' }, { label: 'Not', value: 'purge N lists', tone: 'bad' }, { label: 'Counters', value: 'async batches' }]
        : [{ label: 'Pagination', value: 'cursor', tone: 'ok' }, { label: 'Not', value: 'offset', tone: 'bad' }, { label: 'Why', value: 'feed changes' }],
});

export default defineLesson('flow', {
  slug: 'news-feed',
  objectives: [
    { text: 'Why a feed is a read-heavy problem', step: 1 },
    { text: 'Fan-out on write vs fan-out on read', step: 2 },
    { text: 'What breaks when a celebrity with 50M followers posts', step: 4 },
    { text: 'The hybrid read path: merge, rank, hydrate', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'A home timeline in under 500 ms',
      tag: 'problem',
      body: [
        '200M daily users open the feed 10 times a day, that is about 23,000 reads per second and 70,000 at peak. Only 5% post daily, around 230 writes per second.',
        'Reads outnumber writes about **100 to 1**, so precomputing work at write time pays off.',
      ],
      keyIdea: 'Eventual consistency is fine here: a post may show up a few seconds late.',
      frames: [{ state: NUMBERS, hold: 3200 }],
    },
    {
      label: 'Push',
      title: 'Fan-out on write',
      tag: 'technique',
      body: [
        'When someone posts, workers insert the **post id** into each follower\'s feed list in Redis. Opening the feed is one list read.',
        'Reads are very fast. The price is write amplification, and wasted work for followers who never open the app.',
      ],
      keyIdea: 'Skip inactive users. Their feed is built on demand when they return.',
      frames: [{ state: pushScene(false), hold: 3200 }, { state: pushScene(true) }],
    },
    {
      label: 'Pull',
      title: 'Fan-out on read',
      tag: 'technique',
      body: [
        'Store the post once. When a reader opens the feed, fetch recent posts from everyone they follow and merge them.',
        'Writes are cheap and results are always fresh, but a reader following hundreds of accounts triggers hundreds of queries.',
      ],
      keyIdea: 'Pull wins on write cost and freshness, push wins on read latency.',
      frames: [{ state: PULL, hold: 3200 }],
    },
    {
      label: 'Celebrities',
      title: '50 million followers post once',
      tag: 'trade-off',
      body: [
        'Pushing one post to 50 million lists is 50 million writes. The workers drown and ordinary users\' posts queue behind it.',
        'Use a **hybrid**: push for accounts under a follower threshold (for example 100,000), and pull celebrity posts at read time. Rate limit the fan-out workers.',
      ],
      keyIdea: 'This is the question interviewers ask. The answer is skip push for celebrities and pull them live.',
      frames: [{ state: CELEB(true), hold: 3000 }, { state: CELEB(false), hold: 2600 }],
    },
    {
      label: 'Read path',
      title: 'Merge, rank, hydrate',
      tag: 'technique',
      body: [
        'The feed service reads the user\'s id list, adds live celebrity posts, scores candidates in a ranking service, then **hydrates** the ids into full posts.',
        'Ranking runs under a time budget with a chronological fallback, so a slow model never breaks the feed.',
      ],
      keyIdea: 'Ranked feeds use candidate generation, a light scoring model, filters (blocked, seen, policy) and diversification.',
      frames: [{ state: READ, hold: 4200 }],
    },
    {
      label: 'Details',
      title: 'Small choices keep it cheap',
      tag: 'in practice',
      body: [
        'Cache **ids**, not posts. Hydrate from a post cache so edits and deletes apply everywhere. Mark deletes and filter at hydrate time instead of purging millions of lists.',
        'Paginate with a **cursor** (last post id or score), never offsets, since the feed shifts between requests. Aggregate likes and views asynchronously.',
      ],
      keyIdea: 'Media goes straight to object storage, is transcoded asynchronously and served from a CDN.',
      frames: [{ state: DETAILS('ids'), hold: 2400 }, { state: DETAILS('delete'), hold: 2400 }, { state: DETAILS('cursor'), hold: 2400 }],
    },
    {
      label: 'Recap',
      title: 'The whole design',
      tag: 'recap',
      body: [
        '- **Numbers:** ~23k feed reads/s, ~230 posts/s, read-to-write about 100 to 1.',
        '- **Hybrid fan-out:** push for normal users, only to recently active followers. Pull celebrities at read time.',
        '- **Feed cache:** capped Redis list of post ids per user.',
        '- **Read path:** merge, rank with a time budget, hydrate, cursor pagination.',
        '- **Deletes and counters:** filter at read, aggregate asynchronously.',
        '- **Trade-offs:** freshness vs cost, ranking quality vs latency, stored vs recomputed feeds.',
      ],
      keyIdea: 'Move work to the write path where it is cheap, and handle the few huge accounts as a special case.',
      frames: [{ state: READ }],
    },
  ],
});
