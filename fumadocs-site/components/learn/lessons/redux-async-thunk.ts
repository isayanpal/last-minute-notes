import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Follows the Redux Toolkit notes on createAsyncThunk: one dispatch produces pending first, then fulfilled or rejected,
 * and the slice handles each in extraReducers. The state badge shows loading, user and error as the lifecycle runs.
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
const actors = (store?: string, tone: Tone = 'accent'): SeqActor[] => [
  { id: 'c', label: 'Component', kind: 'client' },
  { id: 's', label: 'Store', kind: 'db', badge: store ? { text: store, tone } : undefined },
  { id: 'a', label: 'API', kind: 'external' },
];

// Step 1: reducers must be pure, so a network call cannot live in one.
const problemFrames = reveal(actors(), [
  {
    msgs: [{ from: 'c', to: 's', label: 'fetch inside reducer?', lost: true, tone: 'bad' }],
    hold: 3200,
    stats: [{ label: 'Reducers', value: 'pure, sync' }, { label: 'A fetch is', value: 'async effect', tone: 'bad' }, { label: 'Home for it', value: 'thunks' }],
    note: { text: 'async logic belongs in thunks, not reducers', tone: 'bad' },
  },
]);

// Step 2: the definition. One thunk, three lifecycle actions.
const defStats: Stat[] = [{ label: 'You write', value: 'one function' }, { label: 'RTK emits', value: '3 action types' }, { label: 'Type prefix', value: 'auth/fetchUser' }];
const defFrames = reveal(actors(), [
  { msgs: [{ from: 'c', to: 's', label: 'dispatch(fetchUser(id))' }], hold: 2400, stats: defStats, note: { text: 'a thunk is dispatched like any other action', tone: 'accent' } },
]);

// Step 3: success path. pending, then fulfilled.
const stateOf = (loading: boolean, user: string, err: boolean): string => `loading ${loading}${user ? `, ${user}` : ''}${err ? ', error' : ''}`;
const lifeStats = (phase: string, tone: 'ok' | 'bad' | 'neutral' = 'neutral'): Stat[] => [{ label: 'Phase', value: phase, tone }, { label: 'Dispatches', value: '1 thunk' }, { label: 'Actions', value: 'pending +' }];
const okFrames = reveal(actors('loading false'), [
  { msgs: [{ from: 'c', to: 's', label: 'dispatch(fetchUser)' }, { from: 's', to: 's', label: 'pending: loading', tone: 'data' }], actors: actors(stateOf(true, '', false), 'accent'), hold: 2200, stats: lifeStats('pending'), note: { text: 'pending fires first: show a spinner', tone: 'accent' } },
  { msgs: [{ from: 's', to: 'a', label: 'GET /api/users/1' }], actors: actors(stateOf(true, '', false), 'accent'), hold: 1700, stats: lifeStats('request') },
  { msgs: [{ from: 'a', to: 's', label: 'user data', dashed: true, tone: 'ok' }, { from: 's', to: 's', label: 'fulfilled: save user', tone: 'ok' }], actors: actors(stateOf(false, 'user set', false), 'ok'), hold: 2400, stats: lifeStats('fulfilled', 'ok'), note: { text: 'fulfilled stores the payload and clears loading', tone: 'ok' } },
  { msgs: [{ from: 's', to: 'c', label: 'subscribers re-render', dashed: true, tone: 'ok' }], actors: actors(stateOf(false, 'user set', false), 'ok'), hold: 3000, stats: lifeStats('done', 'ok') },
]);

// Step 4: failure path. pending, then rejected.
const failFrames = reveal(actors('loading false'), [
  { msgs: [{ from: 'c', to: 's', label: 'dispatch(fetchUser)' }, { from: 's', to: 's', label: 'pending: loading', tone: 'data' }], actors: actors(stateOf(true, '', false), 'accent'), hold: 2000, stats: lifeStats('pending') },
  { msgs: [{ from: 's', to: 'a', label: 'GET /api/users/1' }, { from: 'a', to: 's', label: '500 error', dashed: true, tone: 'bad' }], actors: actors(stateOf(true, '', false), 'accent'), hold: 2000, stats: lifeStats('failing', 'bad') },
  { msgs: [{ from: 's', to: 's', label: 'rejected: error', tone: 'bad' }], actors: actors(stateOf(false, '', true), 'bad'), hold: 3200, stats: lifeStats('rejected', 'bad'), note: { text: 'rejected clears loading and sets the error flag', tone: 'bad' } },
]);

// Step 5: where the lifecycle is handled. extraReducers in the slice.
const handleStats: Stat[] = [{ label: 'Handled in', value: 'extraReducers' }, { label: 'Via', value: 'addCase' }, { label: 'Per case', value: 'plain reducer', tone: 'ok' }];
const handleFrames = reveal(
  [
    { id: 't', label: 'fetchUser thunk', kind: 'worker' },
    { id: 'x', label: 'extraReducers', kind: 'gateway' },
    { id: 'st', label: 'auth state', kind: 'db' },
  ],
  [
    { msgs: [{ from: 't', to: 'x', label: 'pending' }, { from: 'x', to: 'st', label: 'loading = true', tone: 'data' }], hold: 2200, stats: handleStats },
    { msgs: [{ from: 't', to: 'x', label: 'fulfilled' }, { from: 'x', to: 'st', label: 'user = payload', tone: 'ok' }], hold: 2400, stats: handleStats },
    { msgs: [{ from: 't', to: 'x', label: 'rejected' }, { from: 'x', to: 'st', label: 'error = true', tone: 'bad' }], hold: 3000, stats: handleStats, note: { text: 'each lifecycle action is handled by its own small reducer', tone: 'accent' } },
  ],
);

export default defineLesson('sequence', {
  slug: 'redux-async-thunk',
  objectives: [
    { text: 'Why async work cannot live in a reducer', step: 1 },
    { text: 'What dispatching a thunk produces', step: 2 },
    { text: 'The pending then fulfilled path', step: 3 },
    { text: 'The pending then rejected path', step: 4 },
    { text: 'How a slice handles the lifecycle with extraReducers', step: 5 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Reducers cannot wait',
      tag: 'problem',
      body: ['Reducers must be **pure and synchronous**. A network request is an async side effect, so it cannot run inside one.', 'Async logic belongs in **thunks** (or RTK Query).'],
      keyIdea: 'Reducers describe how state changes. Thunks do the work that leads to a change.',
      frames: problemFrames,
    },
    {
      label: 'createAsyncThunk',
      title: 'One thunk, three actions',
      tag: 'concept',
      body: ['`createAsyncThunk("auth/fetchUser", fn)` returns a thunk you dispatch like any action.', 'RTK dispatches `pending` when it starts and `fulfilled` or `rejected` when it ends.'],
      keyIdea: 'The returned value becomes the `fulfilled` payload. A thrown error becomes `rejected`.',
      frames: defFrames,
    },
    {
      label: 'Success',
      title: 'Pending, then fulfilled',
      tag: 'technique',
      body: ['`pending` sets `loading = true`. The request runs. On success `fulfilled` stores the user and clears loading.', 'Subscribed components re-render with the new data.'],
      keyIdea: 'One dispatch produces two actions on success.',
      frames: okFrames,
    },
    {
      label: 'Failure',
      title: 'Pending, then rejected',
      tag: 'technique',
      body: ['If the request fails, `rejected` fires instead of `fulfilled`. It clears loading and sets the error flag.', 'The UI can show an error and offer a retry.'],
      keyIdea: 'Always handle all three outcomes, or a failed request leaves the spinner on forever.',
      frames: failFrames,
    },
    {
      label: 'extraReducers',
      title: 'Handle each phase',
      tag: 'technique',
      body: ['The slice handles thunk actions in `extraReducers` with `builder.addCase(fetchUser.pending, ...)`, and so on.', 'Each case is an ordinary reducer, so Immer applies there too.'],
      keyIdea: 'For plain data fetching, RTK Query removes most of this code.',
      frames: handleFrames,
    },
    {
      label: 'Recap',
      title: 'Async in Redux Toolkit',
      tag: 'recap',
      body: [
        '- **Why thunks:** reducers must stay pure and synchronous.',
        '- **Lifecycle:** pending, then fulfilled or rejected.',
        '- **Handling:** `extraReducers` with `builder.addCase`.',
        '- **State:** loading, data and error flags.',
        '- **Alternative:** RTK Query for API data.',
      ],
      keyIdea: 'Where should async logic live? Thunks or RTK Query, never reducers.',
      frames: [okFrames[okFrames.length - 1]],
    },
  ],
});
