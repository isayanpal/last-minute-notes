import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Follows the RTK Query and React Query notes: cache keyed by endpoint plus serialized arguments, keepUnusedDataFor,
 * tag-based invalidation (providesTags and invalidatesTags), and the difference in default refetching.
 */

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };

function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

type Tone = 'ok' | 'bad' | 'accent';
const cacheActors = (cache?: string, tone: Tone = 'accent'): SeqActor[] => [
  { id: 'a', label: 'Component A', kind: 'client' },
  { id: 'q', label: 'Query cache', kind: 'cache', badge: cache ? { text: cache, tone } : undefined },
  { id: 'b', label: 'Component B', kind: 'client' },
  { id: 's', label: 'Server', kind: 'external' },
];

// Step 1: hand-written thunks repeat the same loading and caching code everywhere.
const BOILER: SeqActor[] = [
  { id: 'c', label: 'Component', kind: 'client' },
  { id: 't', label: 'Thunk + slice', kind: 'worker' },
  { id: 's', label: 'Server', kind: 'external' },
];
const boilerFrames = reveal(BOILER, [
  {
    msgs: [{ from: 'c', to: 't', label: 'dispatch(fetchUsers)' }, { from: 't', to: 's', label: 'GET /users' }, { from: 's', to: 't', label: 'users', dashed: true }],
    hold: 3200,
    stats: [{ label: 'You write', value: 'thunk, slice' }, { label: 'Plus', value: 'loading, error' }, { label: 'Caching', value: 'by hand', tone: 'bad' }],
    note: { text: 'every endpoint repeats the same loading, error and cache code', tone: 'bad' },
  },
]);

// Step 2: the cache key is the endpoint plus serialized args, so identical calls share one request.
const keyStats: Stat[] = [{ label: 'Cache key', value: 'endpoint,args' }, { label: 'Requests sent', value: '1', tone: 'ok' }, { label: 'Subscribers', value: '2' }];
const keyFrames = reveal(cacheActors(), [
  { msgs: [{ from: 'a', to: 'q', label: 'useGetUsersQuery()' }, { from: 'q', to: 's', label: 'miss: GET /users' }], actors: cacheActors('isLoading', 'accent'), hold: 2200, stats: [{ label: 'Cache key', value: 'getUsers()' }, { label: 'Entry', value: 'none yet' }, { label: 'isLoading', value: 'true' }] },
  { msgs: [{ from: 's', to: 'q', label: 'users', dashed: true, tone: 'ok' }, { from: 'q', to: 'a', label: 'data', dashed: true, tone: 'ok' }], actors: cacheActors('getUsers() cached', 'ok'), hold: 2000, stats: keyStats },
  { msgs: [{ from: 'b', to: 'q', label: 'useGetUsersQuery()' }, { from: 'q', to: 'b', label: 'cached, no fetch', dashed: true, tone: 'ok' }], actors: cacheActors('getUsers() cached', 'ok'), hold: 3200, stats: keyStats, note: { text: 'component B reuses the entry: no second network call', tone: 'ok' } },
]);

// Step 3: lifetime. The entry lives until the last subscriber leaves plus keepUnusedDataFor.
const LIFE: SeqActor[] = [
  { id: 'q', label: 'Query cache', kind: 'cache', badge: { text: 'entry kept', tone: 'ok' } },
  { id: 'c', label: 'Last component', kind: 'client' },
];
const lifeFrames = reveal(LIFE, [
  { msgs: [{ from: 'c', to: 'q', label: 'unmount: unsubscribe' }], hold: 2000, stats: [{ label: 'Subscribers', value: '0' }, { label: 'Timer', value: 'unused timer' }, { label: 'Example', value: '60 s' }] },
  { msgs: [{ from: 'q', to: 'q', label: 'wait 60 s', tone: 'data' }], hold: 1800, stats: [{ label: 'Remount in time', value: 'instant', tone: 'ok' }, { label: 'Else', value: 'entry removed' }, { label: 'Tune with', value: 'timer' }] },
  { msgs: [{ from: 'q', to: 'q', label: 'remove entry', tone: 'bad' }], actors: [{ ...LIFE[0], badge: { text: 'entry removed', tone: 'bad' } }, LIFE[1]], hold: 3000, stats: [{ label: 'Next mount', value: 'fetches again' }, { label: 'Memory', value: 'reclaimed', tone: 'ok' }, { label: 'Trade-off', value: 'fresh vs fast' }], note: { text: 'unused data is dropped after the timer', tone: 'bad' } },
]);

// Step 4: tag-based invalidation.
const TAG: SeqActor[] = [
  { id: 'c', label: 'Component', kind: 'client' },
  { id: 'q', label: 'getUsers query', kind: 'cache', badge: { text: 'provides User', tone: 'accent' } },
  { id: 'm', label: 'updateUser', kind: 'worker', badge: { text: 'invalidates User', tone: 'accent' } },
  { id: 's', label: 'Server', kind: 'external' },
];
const tagStats = (a: string): Stat[] => [{ label: 'Tag', value: 'User' }, { label: 'You never', value: 'edit the cache', tone: 'ok' }, { label: 'Now', value: a }];
const tagFrames = reveal(TAG, [
  { msgs: [{ from: 'c', to: 'q', label: 'subscribe' }, { from: 'q', to: 's', label: 'GET /users' }, { from: 's', to: 'q', label: 'users', dashed: true, tone: 'ok' }], hold: 2200, stats: tagStats('cached') },
  { msgs: [{ from: 'c', to: 'm', label: 'run mutation' }, { from: 'm', to: 's', label: 'PATCH /users/1' }, { from: 's', to: 'm', label: 'success', dashed: true, tone: 'ok' }], hold: 2200, stats: tagStats('mutation done') },
  { msgs: [{ from: 'm', to: 'q', label: 'invalidate tag User', tone: 'accent' }, { from: 'q', to: 's', label: 'refetch /users', tone: 'ok' }], hold: 2200, stats: tagStats('refetching') },
  { msgs: [{ from: 's', to: 'c', label: 'fresh data', dashed: true, tone: 'ok' }], hold: 3000, stats: tagStats('fresh'), note: { text: 'declarative and centralized: safer for large teams', tone: 'ok' } },
]);

// Step 5: RTK Query versus React Query defaults.
const VS: SeqActor[] = [
  { id: 'w', label: 'Window focus', kind: 'client' },
  { id: 'r', label: 'RTK Query', kind: 'gateway', badge: { text: 'in Redux', tone: 'accent' } },
  { id: 'q', label: 'React Query', kind: 'service', badge: { text: 'own cache', tone: 'accent' } },
];
const vsFrames = reveal(VS, [
  { msgs: [{ from: 'w', to: 'r', label: 'focus event' }, { from: 'r', to: 'w', label: 'configurable', dashed: true }], hold: 2200, stats: [{ label: 'Philosophy', value: 'state in Redux' }, { label: 'Refocus', value: 'opt in' }, { label: 'Needs', value: 'Redux' }] },
  { msgs: [{ from: 'w', to: 'q', label: 'focus event' }, { from: 'q', to: 'w', label: 'refetch by default', dashed: true, tone: 'ok' }], hold: 3200, stats: [{ label: 'Philosophy', value: 'server cache' }, { label: 'Refocus', value: 'on by default', tone: 'ok' }, { label: 'Needs', value: 'nothing' }], note: { text: 'React Query is more aggressive about freshness by default', tone: 'accent' } },
]);

export default defineLesson('sequence', {
  slug: 'redux-rtk-query',
  objectives: [
    { text: 'What hand-written fetching code repeats', step: 1 },
    { text: 'How the RTK Query cache is keyed and shared', step: 2 },
    { text: 'How long unused cache entries live', step: 3 },
    { text: 'How tags invalidate and refetch data', step: 4 },
    { text: 'How RTK Query and React Query differ', step: 5 },
  ],
  steps: [
    {
      label: 'Boilerplate',
      title: 'Thunks for every endpoint',
      tag: 'problem',
      body: ['Fetching with thunks means a thunk, loading and error flags and some caching for every endpoint.', 'RTK Query is the data-fetching and caching layer built into Redux Toolkit.'],
      keyIdea: 'Automatic caching, refetching and loading or error states, with no manual thunks.',
      frames: boilerFrames,
    },
    {
      label: 'Cache key',
      title: 'Endpoint plus arguments',
      tag: 'concept',
      body: ['`createApi` defines endpoints. A hook like `useGetUsersQuery()` looks up a cache entry keyed by **endpoint and serialized arguments**.', 'A miss fetches. A hit returns cached data with no network call, so identical calls share one request.'],
      keyIdea: 'Many components, one request: that is what the shared key buys you.',
      frames: keyFrames,
    },
    {
      label: 'Lifetime',
      title: 'keepUnusedDataFor',
      tag: 'technique',
      body: ['When the last subscriber unmounts, the entry waits `keepUnusedDataFor` seconds and is then removed.', 'Remount before that and the data appears instantly.'],
      keyIdea: 'Tune the timer to balance freshness, speed and memory.',
      frames: lifeFrames,
    },
    {
      label: 'Invalidation',
      title: 'Tags, not manual cache edits',
      tag: 'technique',
      body: ['A query declares `providesTags: ["User"]`. A mutation declares `invalidatesTags: ["User"]`.', 'When the mutation succeeds, every query that provides that tag refetches.'],
      keyIdea: 'React Query does the same with query keys: flexible, but easier to misuse.',
      frames: tagFrames,
    },
    {
      label: 'Versus',
      title: 'RTK Query or React Query',
      tag: 'trade-off',
      body: ['RTK Query keeps **server state inside Redux**. React Query treats it as **a cache outside app state** and refetches on focus and reconnect by default.', 'Pick RTK Query if the app already uses Redux. Pick React Query for API-heavy apps that do not.'],
      keyIdea: 'RTK Query is a Redux-first server-state solution. React Query is a cache-first async state manager.',
      frames: vsFrames,
    },
    {
      label: 'Recap',
      title: 'Server state, handled',
      tag: 'recap',
      body: [
        '- **RTK Query:** declare endpoints, use generated hooks.',
        '- **Cache:** keyed by endpoint and arguments, shared by subscribers.',
        '- **Lifetime:** `keepUnusedDataFor` after the last unsubscribe.',
        '- **Invalidation:** `providesTags` and `invalidatesTags`.',
        '- **Choose:** Redux app, RTK Query. Otherwise React Query.',
      ],
      keyIdea: 'Redux is a client cache, not a database: the server stays the source of truth.',
      frames: [tagFrames[tagFrames.length - 1]],
    },
  ],
});
