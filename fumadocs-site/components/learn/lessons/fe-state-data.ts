import { defineLesson } from '../define';
import type { FlowNode, FlowState } from '../engines/flow';

/*
 * Layout: components (x 0), query cache or store (x 2.7), API (x 5.3).
 * The same three columns are reused in every step so only the behaviour changes.
 */

const FEED = (extra: Partial<FlowNode> = {}): FlowNode => ({ id: 'feed', label: 'Feed', sub: 'component', kind: 'client', x: 0.2, y: 0.4, size: 'sm', ...extra });
const PROFILE = (extra: Partial<FlowNode> = {}): FlowNode => ({ id: 'prof', label: 'Profile', sub: 'component', kind: 'client', x: 0.2, y: 2.8, size: 'sm', ...extra });
const CACHE = (extra: Partial<FlowNode> = {}): FlowNode => ({ id: 'cache', label: 'Query cache', sub: 'keyed by query', kind: 'cache', x: 2.8, y: 1.6, ...extra });
const API = (extra: Partial<FlowNode> = {}): FlowNode => ({ id: 'api', label: 'API', sub: 'server', kind: 'service', x: 5.4, y: 1.6, size: 'sm', ...extra });

// Step 1: no shared cache. Each component fetches on its own.
const NO_CACHE: FlowState = {
  nodes: [FEED(), PROFILE(), API({ status: 'hot', badge: { text: '2 calls', tone: 'bad' } })],
  links: [
    { from: 'feed', to: 'api' },
    { from: 'prof', to: 'api' },
  ],
  packets: [
    { from: 'feed', to: 'api', label: 'GET /posts', dur: 0.9 },
    { from: 'prof', to: 'api', label: 'GET /posts', dur: 0.9, delay: 0.2 },
    { from: 'api', to: 'feed', delay: 1.2, dur: 0.9, tone: 'res' },
    { from: 'api', to: 'prof', delay: 1.4, dur: 0.9, tone: 'res' },
  ],
  stats: [
    { label: 'Requests', value: '2', tone: 'bad' },
    { label: 'Same data', value: 'yes' },
    { label: 'Risk', value: 'views disagree', tone: 'bad' },
  ],
  note: { text: 'each component owns its own fetch and its own copy', tone: 'bad' },
};

// Step 2: a query cache. One key, one call, shared result.
const KEYED: FlowState = {
  nodes: [FEED(), PROFILE(), CACHE({ items: ['posts, p1'], badge: { text: 'one key', tone: 'accent' } }), API()],
  links: [
    { from: 'feed', to: 'cache' },
    { from: 'prof', to: 'cache' },
    { from: 'cache', to: 'api' },
  ],
  packets: [
    { from: 'feed', to: 'cache', label: 'posts, p1', dur: 0.6 },
    { from: 'prof', to: 'cache', label: 'posts, p1', dur: 0.6, delay: 0.15 },
    { from: 'cache', to: 'api', label: 'one call', delay: 0.8, dur: 0.8, tone: 'accent' },
    { from: 'api', to: 'cache', delay: 1.8, dur: 0.8, tone: 'res' },
    { from: 'cache', to: 'feed', delay: 2.7, dur: 0.6, tone: 'res' },
    { from: 'cache', to: 'prof', delay: 2.7, dur: 0.6, tone: 'res' },
  ],
  stats: [
    { label: 'Requests', value: '1', tone: 'ok' },
    { label: 'Cache key', value: 'all inputs' },
    { label: 'Dedup', value: 'concurrent', tone: 'ok' },
  ],
  note: { text: 'the key includes everything that changes the result', tone: 'accent' },
};

// Step 3: stale-while-revalidate. Cached data now, fresh data after.
const SWR: FlowState = {
  nodes: [FEED(), CACHE({ items: ['posts, p1'], badge: { text: 'stale', tone: 'bad' }, status: 'active' }), API()],
  links: [
    { from: 'feed', to: 'cache' },
    { from: 'cache', to: 'api' },
  ],
  packets: [
    { from: 'feed', to: 'cache', label: 'mount', dur: 0.6 },
    { from: 'cache', to: 'feed', label: 'cached, now', delay: 0.7, dur: 0.6, tone: 'ok' },
    { from: 'cache', to: 'api', label: 'refetch', delay: 0.8, dur: 0.8, tone: 'accent' },
    { from: 'api', to: 'cache', delay: 1.8, dur: 0.8, tone: 'res' },
    { from: 'cache', to: 'feed', label: 'update if changed', delay: 2.7, dur: 0.7, tone: 'res' },
  ],
  stats: [
    { label: 'First paint', value: 'instant', tone: 'ok' },
    { label: 'Stale time', value: 'fresh' },
    { label: 'Triggers', value: 'focus, online' },
  ],
  note: { text: 'show cached data immediately, refetch in the background', tone: 'accent' },
};

// Step 4: normalized store. One entity, many lists.
const norm = (liked: boolean): FlowState => ({
  nodes: [
    { id: 'home', label: 'Home feed', sub: 'ids only', kind: 'client', x: 0.2, y: 0.4, size: 'sm', items: ['p7', 'p9'] },
    { id: 'user', label: 'User posts', sub: 'ids only', kind: 'client', x: 0.2, y: 2.8, size: 'sm', items: ['p7', 'p3'] },
    { id: 'ent', label: 'Entities', sub: 'posts by id', kind: 'cache', x: 3.0, y: 1.6, status: liked ? 'active' : 'normal', items: [liked ? 'p7 liked' : 'p7', 'p9', 'p3'], badge: { text: 'one copy', tone: 'accent' } },
    { id: 'api', label: 'API', kind: 'service', x: 5.4, y: 1.6, size: 'sm', status: liked ? 'normal' : 'dim' },
  ],
  links: [
    { from: 'home', to: 'ent' },
    { from: 'user', to: 'ent' },
    { from: 'ent', to: 'api', dashed: true },
  ],
  packets: liked
    ? [
        { from: 'api', to: 'ent', label: 'p7 liked', dur: 0.8, tone: 'data' },
        { from: 'ent', to: 'home', delay: 0.9, dur: 0.6, tone: 'ok' },
        { from: 'ent', to: 'user', delay: 0.9, dur: 0.6, tone: 'ok' },
      ]
    : [],
  stats: [
    { label: 'Writes', value: liked ? '1' : '-', tone: liked ? 'ok' : 'neutral' },
    { label: 'Views fixed', value: liked ? 'both' : '-', tone: liked ? 'ok' : 'neutral' },
    { label: 'Cost', value: 'ids + merging' },
  ],
  note: liked ? { text: 'update the entity once, every list that references it follows', tone: 'ok' } : { text: 'lists hold ids, entities live under type:id', tone: 'accent' },
});

// Step 5: optimistic update, success and failure.
const optimistic = (ok: boolean): FlowState => ({
  nodes: [
    { id: 'ui', label: 'UI', sub: ok ? 'shows liked' : 'liked, then undone', kind: 'client', x: 0.2, y: 1.6, size: 'sm', status: 'active' },
    { id: 'cache', label: 'Cache', sub: 'snapshot kept', kind: 'cache', x: 2.8, y: 1.6, items: [ok ? 'liked' : 'restored'] },
    { id: 'api', label: 'API', kind: 'service', x: 5.4, y: 1.6, size: 'sm', status: ok ? 'normal' : 'down' },
  ],
  links: [
    { from: 'ui', to: 'cache' },
    { from: 'cache', to: 'api' },
  ],
  packets: [
    { from: 'ui', to: 'cache', label: 'tap like', dur: 0.5 },
    { from: 'cache', to: 'ui', label: 'instant', delay: 0.5, dur: 0.5, tone: 'ok' },
    { from: 'cache', to: 'api', label: 'request + key', delay: 0.6, dur: 0.9, tone: 'accent' },
    ok
      ? { from: 'api', to: 'cache', label: 'confirm', delay: 1.7, dur: 0.9, tone: 'ok' }
      : { from: 'api', to: 'cache', label: 'error', delay: 1.7, dur: 0.9, tone: 'bad' },
    ...(ok ? [] : [{ from: 'cache', to: 'ui', label: 'rollback + retry', delay: 2.7, dur: 0.7, tone: 'bad' as const }]),
  ],
  stats: [
    { label: 'Feels', value: 'instant', tone: 'ok' },
    { label: 'On success', value: 'invalidate', tone: ok ? 'ok' : 'neutral' },
    { label: 'On failure', value: 'rollback', tone: ok ? 'neutral' : 'bad' },
  ],
  note: ok ? { text: 'cancel in-flight queries, snapshot, write, send', tone: 'accent' } : { text: 'failure: restore the snapshot, show the error, offer retry', tone: 'bad' },
});

// Step 6: out-of-order responses. The latest request wins.
const race = (guard: boolean): FlowState => ({
  nodes: [
    { id: 'box', label: 'Search box', sub: 'types ab, abc', kind: 'client', x: 0.2, y: 1.6, size: 'sm' },
    { id: 'api', label: 'Search API', kind: 'service', x: 5.4, y: 1.6, size: 'sm' },
    { id: 'res', label: 'Results', sub: guard ? 'for "abc"' : 'for "ab" (wrong)', kind: 'cache', x: 2.8, y: 3.0, size: 'sm', status: guard ? 'active' : 'hot', badge: guard ? { text: 'correct', tone: 'ok' } : { text: 'stale wins', tone: 'bad' } },
  ],
  links: [
    { from: 'box', to: 'api' },
    { from: 'api', to: 'res' },
  ],
  packets: [
    { from: 'box', to: 'api', label: 'ab', dur: 0.9 },
    { from: 'box', to: 'api', label: 'abc', dur: 0.9, delay: 0.5, tone: 'accent' },
    { from: 'api', to: 'res', label: 'abc', delay: 1.6, dur: 0.7, tone: 'ok' },
    guard
      ? { from: 'api', to: 'res', label: 'ab: aborted', delay: 2.4, dur: 0.7, tone: 'neutral' }
      : { from: 'api', to: 'res', label: 'ab (late)', delay: 2.4, dur: 0.7, tone: 'bad' },
  ],
  stats: [
    { label: 'Order', value: 'abc before ab', tone: 'bad' },
    { label: 'Fix', value: guard ? 'AbortCtrl' : 'none', tone: guard ? 'ok' : 'bad' },
    { label: 'Shown', value: guard ? 'abc' : 'ab', tone: guard ? 'ok' : 'bad' },
  ],
  note: guard ? { text: 'abort the old request or ignore ids that are not the latest', tone: 'ok' } : { text: 'the slow "ab" response overwrites the right one', tone: 'bad' },
});

export default defineLesson('flow', {
  slug: 'fe-state-data',
  objectives: [
    { text: 'Why server state needs a cache, not hand-rolled fetches', step: 1 },
    { text: 'Cache keys, deduplication and stale-while-revalidate', step: 3 },
    { text: 'When a normalized store beats a document cache', step: 4 },
    { text: 'The optimistic update and rollback cycle', step: 5 },
    { text: 'How to stop out-of-order responses from winning', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Every component fetches for itself',
      tag: 'problem',
      body: ['Two components need the same list, so each calls the API and keeps its own copy. That wastes requests and lets the views disagree.', 'Putting server data in a global store by hand does not fix it: you re-invent loading, errors and invalidation.'],
      keyIdea: 'Server state is a cache of data owned elsewhere. It needs a cache with a lifecycle, not just a variable.',
      frames: [{ state: NO_CACHE, hold: 3200 }],
    },
    {
      label: 'Cache key',
      title: 'One key, one request',
      tag: 'concept',
      body: ['A query cache stores results **keyed by the query**, for example `[\'posts\', { page: 2 }]`. The key holds every input that changes the result.', 'Concurrent requests for the same key share one network call.'],
      keyIdea: 'Cache key = identity of the data. Deduplication falls out of it.',
      frames: [{ state: KEYED, hold: 3800 }],
    },
    {
      label: 'Stale-while-revalidate',
      title: 'Show cached data, refresh behind',
      tag: 'technique',
      body: ['The cache answers immediately with what it has, then refetches in the background and updates only if the data changed.', '**Stale time** says how long data counts as fresh. Refetch triggers include mount, window focus, reconnect, interval and invalidation.'],
      keyIdea: 'Structural sharing keeps unchanged references, so memoized components do not re-render after a refetch.',
      frames: [{ state: SWR, hold: 3800 }],
    },
    {
      label: 'Normalization',
      title: 'Store each entity once',
      tag: 'trade-off',
      body: ['In a document cache the same post lives in many query results, so an update must touch all of them or invalidate.', 'A **normalized** store keeps entities under `type:id`, and lists hold ids. One write updates every view.'],
      keyIdea: 'Normalize when the same entity appears in many views and edits must propagate instantly. Otherwise invalidate and refetch is cheaper.',
      frames: [{ state: norm(false), hold: 1800 }, { state: norm(true), hold: 2800 }],
    },
    {
      label: 'Optimistic',
      title: 'Answer first, confirm later',
      tag: 'technique',
      body: ['Cancel in-flight queries for the entity, snapshot the cache, write the optimistic value, then send the request with an **idempotency key**.', 'On success, invalidate or merge. On failure, restore the snapshot, show an error and offer retry. Always refetch to settle.'],
      keyIdea: 'Cancel queries before the optimistic write, or a background refetch overwrites it with stale data.',
      frames: [{ state: optimistic(true), hold: 3200 }, { state: optimistic(false), hold: 3600 }],
    },
    {
      label: 'Races',
      title: 'The latest request must win',
      tag: 'in practice',
      body: ['Type "ab" then "abc": the response for "ab" can arrive last and overwrite the right results.', 'Cancel with `AbortController`, or ignore any response that is not for the latest request id.'],
      keyIdea: 'Also: disable controls while pending, abort in cleanup, and use `ETag` with `If-Match` when two tabs edit one record.',
      frames: [{ state: race(false), hold: 3400 }, { state: race(true), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Client state is not server state',
      tag: 'recap',
      body: [
        '- **Server state:** a keyed query cache with stale time, dedup, retries and invalidation.',
        '- **Stale-while-revalidate:** instant UI, background refresh.',
        '- **Normalize** only when one entity feeds many views.',
        '- **Optimistic updates:** snapshot, write, send, then confirm or roll back.',
        '- **Races:** abort superseded requests, latest id wins.',
      ],
      keyIdea: 'Pick the simplest model that keeps every view consistent, and say what you do on failure.',
      frames: [{ state: KEYED, hold: 3800 }],
    },
  ],
});
