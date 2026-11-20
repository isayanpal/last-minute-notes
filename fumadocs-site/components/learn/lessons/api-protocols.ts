import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';

const APP: SeqActor[] = [
  { id: 'c', label: 'Mobile app', kind: 'client' },
  { id: 'a', label: 'API', kind: 'gateway' },
];
const SVC: SeqActor[] = [
  { id: 'a', label: 'Order service', kind: 'service' },
  { id: 'b', label: 'Payment service', kind: 'service' },
];

const seq = (actors: SeqActor[], messages: SeqMessage[], stats: SeqState['stats'], note?: SeqState['note'], fresh = 1): SeqState => ({ actors, messages, stats, note, fresh });

const rest: SeqMessage[] = [
  { from: 'c', to: 'a', label: 'GET /users/1' },
  { from: 'a', to: 'c', label: '{ 40 fields }', dashed: true },
  { from: 'c', to: 'a', label: 'GET /users/1/posts' },
  { from: 'a', to: 'c', label: '[ 20 posts ]', dashed: true },
  { from: 'c', to: 'a', label: 'GET /posts/9/comments' },
  { from: 'a', to: 'c', label: '[ comments ]', dashed: true },
];

const gql: SeqMessage[] = [
  { from: 'c', to: 'a', label: 'POST /graphql { user, posts }', tone: 'accent' },
  { from: 'a', to: 'c', label: 'exactly those fields', dashed: true, tone: 'ok' },
];

const grpc: SeqMessage[] = [
  { from: 'a', to: 'b', label: 'Charge(order 7) [protobuf]' },
  { from: 'b', to: 'a', label: 'Receipt', dashed: true, tone: 'ok' },
  { from: 'a', to: 'b', label: 'stream: WatchStatus' },
  { from: 'b', to: 'a', label: 'PENDING', dashed: true },
  { from: 'b', to: 'a', label: 'PAID', dashed: true, tone: 'ok' },
];

const page = (kind: 'offset' | 'cursor'): SeqMessage[] =>
  kind === 'offset'
    ? [
        { from: 'c', to: 'a', label: '?offset=40&limit=20' },
        { from: 'a', to: 'c', label: 'items 41-60', dashed: true },
        { from: 'a', to: 'a', label: '3 new posts inserted', tone: 'bad' },
        { from: 'c', to: 'a', label: '?offset=60&limit=20' },
        { from: 'a', to: 'c', label: 'repeats 58-60', dashed: true, tone: 'bad' },
      ]
    : [
        { from: 'c', to: 'a', label: '?after=id40&limit=20' },
        { from: 'a', to: 'c', label: 'items 41-60 + cursor', dashed: true },
        { from: 'a', to: 'a', label: '3 new posts inserted', tone: 'neutral' },
        { from: 'c', to: 'a', label: '?after=id60&limit=20' },
        { from: 'a', to: 'c', label: 'items 61-80, no repeats', dashed: true, tone: 'ok' },
      ];

export default defineLesson('sequence', {
  slug: 'api-protocols',
  objectives: [
    { text: 'REST round trips and over-fetching', step: 2 },
    { text: 'How GraphQL lets the client pick fields', step: 3 },
    { text: 'Where gRPC fits', step: 4 },
    { text: 'Cursor vs offset pagination', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'One screen, many shapes of data',
      tag: 'problem',
      body: ['A profile screen needs a user, their posts and the comments on one post.', 'The API style decides how many round trips it takes, how much data you download, and how well it caches.'],
      keyIdea: 'There is no best style. REST, GraphQL and gRPC trade simplicity, flexibility and speed.',
      frames: [{ state: seq(APP, [{ from: 'c', to: 'a', label: 'user + posts + comments?' }], [{ label: 'Styles', value: '3' }, { label: 'Differ in', value: 'round trips' }, { label: 'And', value: 'payload shape' }]) }],
    },
    {
      label: 'REST',
      title: 'Resources and verbs',
      tag: 'technique',
      body: ['**REST** exposes resources: `GET /users/1`, `GET /users/1/posts`. It is simple, cacheable and everywhere.', 'This screen needs three round trips, and each response carries fields the screen never shows (over-fetching).'],
      keyIdea: 'REST is the default for public APIs. The cost is multiple round trips and fixed response shapes.',
      frames: [2, 4, 6].map((n) => ({ state: seq(APP, rest.slice(0, n), [{ label: 'Round trips', value: String(n / 2), tone: n > 2 ? 'bad' : 'neutral' }, { label: 'Cacheable', value: 'yes', tone: 'ok' }, { label: 'Extra fields', value: 'over-fetch' }], undefined, 2), hold: 2000 })),
    },
    {
      label: 'GraphQL',
      title: 'Ask for exactly what you need',
      tag: 'technique',
      body: ['**GraphQL** has one endpoint. The client sends a query naming the fields it wants and gets back exactly that, in one round trip.', 'Caching is harder, and you must guard against N+1 queries and very expensive queries.'],
      keyIdea: 'GraphQL fits client-driven UIs with varied needs. Add query cost limits and batching on the server.',
      frames: [{ state: seq(APP, gql, [{ label: 'Round trips', value: '1', tone: 'ok' }, { label: 'Over-fetch', value: 'none', tone: 'ok' }, { label: 'Caching', value: 'harder', tone: 'bad' }], undefined, 2) }],
    },
    {
      label: 'gRPC',
      title: 'Typed calls between services',
      tag: 'technique',
      body: ['**gRPC** uses HTTP/2 and Protocol Buffers: compact binary messages, generated typed clients, and built-in streaming.', 'Browsers need a proxy and the payload is not human readable, so it fits internal service to service calls best.'],
      keyIdea: 'Public API: REST. Varied client UIs: GraphQL. Internal calls that must be fast and typed: gRPC.',
      frames: [2, 5].map((n) => ({ state: seq(SVC, grpc.slice(0, n), [{ label: 'Transport', value: 'HTTP/2' }, { label: 'Format', value: 'protobuf' }, { label: 'Streaming', value: 'built in', tone: 'ok' }], undefined, n === 2 ? 2 : 3), hold: 2200 })),
    },
    {
      label: 'Pagination',
      title: 'Offset drifts, cursors do not',
      tag: 'trade-off',
      body: ['**Offset** pages are simple, but they get slow at depth and shift when data changes. New rows cause repeats or gaps.', '**Cursor** (keyset) pages ask for "items after this id". They stay fast and stable, though you cannot jump to page N.'],
      keyIdea: 'Use cursor pagination for feeds and large datasets.',
      frames: [
        { state: seq(APP, page('offset'), [{ label: 'Style', value: 'offset' }, { label: 'Deep pages', value: 'slow', tone: 'bad' }, { label: 'Repeats', value: 'yes', tone: 'bad' }], undefined, 5), hold: 3500 },
        { state: seq(APP, page('cursor'), [{ label: 'Style', value: 'cursor' }, { label: 'Deep pages', value: 'fast', tone: 'ok' }, { label: 'Repeats', value: 'none', tone: 'ok' }], undefined, 5) },
      ],
    },
    {
      label: 'Recap',
      title: 'Also decide these',
      tag: 'recap',
      body: [
        '- **Styles:** REST for public, GraphQL for client-driven UIs, gRPC for internal calls.',
        '- **HTTP/3:** runs over QUIC on UDP, per-stream loss recovery, faster handshakes.',
        '- **Idempotency:** `POST` is not idempotent. Send an `Idempotency-Key` so retries are safe.',
        '- **Versioning:** prefer additive changes, deprecate slowly.',
        '- **Errors and limits:** consistent error shape, `429` with `Retry-After`.',
      ],
      keyIdea: 'Clients retry and networks duplicate, so every write that matters needs a defence.',
      frames: [{ state: seq(APP, [{ from: 'c', to: 'a', label: 'POST /pay  key=abc' }, { from: 'a', to: 'c', label: 'stored result', dashed: true, tone: 'ok' }, { from: 'c', to: 'a', label: 'retry  key=abc' }, { from: 'a', to: 'c', label: 'same result, no 2nd charge', dashed: true, tone: 'ok' }], [], undefined, 4) }],
    },
  ],
});
