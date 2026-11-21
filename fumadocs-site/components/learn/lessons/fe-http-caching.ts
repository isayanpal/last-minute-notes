import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame } from '../types';

const ACTORS: SeqActor[] = [
  { id: 'b', label: 'Browser', kind: 'client' },
  { id: 'd', label: 'Disk cache', kind: 'cache' },
  { id: 'c', label: 'CDN', kind: 'cdn' },
  { id: 'o', label: 'Origin', kind: 'service' },
];

const state = (messages: SeqMessage[], stats: SeqState['stats'], note?: SeqState['note'], actors: SeqActor[] = ACTORS): SeqState => ({
  actors,
  messages,
  stats,
  note,
  fresh: messages.length - 1,
});

/** Reveal a message list one message at a time. */
const reveal = (messages: SeqMessage[], statsAt: (n: number) => SeqState['stats'], noteAt: (n: number) => SeqState['note'], hold = 1100): Frame<SeqState>[] =>
  messages.map((_, i) => ({ hold: i === messages.length - 1 ? 2400 : hold, state: state(messages.slice(0, i + 1), statsAt(i + 1), noteAt(i + 1)) }));

// Step 1: no caching headers, every visit pays full price.
const NAIVE: SeqMessage[] = [
  { from: 'b', to: 'c', label: 'GET /app.js' },
  { from: 'c', to: 'o', label: 'miss: forward' },
  { from: 'o', to: 'b', label: '200 app.js (300 KB)', dashed: true, tone: 'data' },
  { from: 'b', to: 'c', label: 'next visit: GET /app.js', tone: 'bad' },
  { from: 'c', to: 'o', label: 'miss again', tone: 'bad' },
  { from: 'o', to: 'b', label: '200 app.js (300 KB)', dashed: true, tone: 'bad' },
];

// Step 2: hashed assets are cached forever.
const HASHED: SeqMessage[] = [
  { from: 'b', to: 'c', label: 'GET /app.3f9a1c.js' },
  { from: 'c', to: 'b', label: '200 + max-age=1y immutable', dashed: true, tone: 'ok' },
  { from: 'b', to: 'd', label: 'store', tone: 'accent' },
  { from: 'b', to: 'd', label: 'next visit: lookup' },
  { from: 'd', to: 'b', label: 'fresh, no request', dashed: true, tone: 'ok' },
];

// Step 3: HTML must revalidate. ETag makes it cheap.
const REVALIDATE: SeqMessage[] = [
  { from: 'b', to: 'c', label: 'GET / If-None-Match "a1"' },
  { from: 'c', to: 'o', label: 'revalidate "a1"' },
  { from: 'o', to: 'c', label: '304 Not Modified', dashed: true, tone: 'ok' },
  { from: 'c', to: 'b', label: '304, no body', dashed: true, tone: 'ok' },
  { from: 'b', to: 'd', label: 'reuse stored body', tone: 'ok' },
];

// Step 4: stale-while-revalidate. Fast now, fresh next time.
const SWR: SeqMessage[] = [
  { from: 'b', to: 'c', label: 'GET /api/products' },
  { from: 'c', to: 'b', label: 'stale copy, instantly', dashed: true, tone: 'ok' },
  { from: 'c', to: 'o', label: 'background refresh', tone: 'accent' },
  { from: 'o', to: 'c', label: 'fresh copy', dashed: true, tone: 'ok' },
  { from: 'b', to: 'c', label: 'next request' },
  { from: 'c', to: 'b', label: 'fresh copy', dashed: true, tone: 'ok' },
];

// Step 5: private data must never sit under a shared key.
const PRIVATE: SeqMessage[] = [
  { from: 'b', to: 'c', label: 'GET /api/me (user A)' },
  { from: 'c', to: 'o', label: 'forward, no store' },
  { from: 'o', to: 'b', label: 'Cache-Control: private, no-cache', dashed: true, tone: 'accent' },
  { from: 'b', to: 'd', label: 'store, revalidate', tone: 'ok' },
  { from: 'b', to: 'c', label: 'user B: GET /api/me' },
  { from: 'c', to: 'o', label: 'nothing shared', tone: 'ok' },
];

// Step 6: deploys. Old URLs must keep working for open tabs.
const DEPLOY_BAD: SeqMessage[] = [
  { from: 'b', to: 'c', label: 'open tab: GET /chunk.aa11.js' },
  { from: 'c', to: 'o', label: 'v1 files deleted' },
  { from: 'o', to: 'b', label: '404 chunk load error', dashed: true, tone: 'bad' },
];
const DEPLOY_OK: SeqMessage[] = [
  { from: 'b', to: 'c', label: 'open tab: GET /chunk.aa11.js' },
  { from: 'c', to: 'b', label: '200 (old chunk kept for a while)', dashed: true, tone: 'ok' },
  { from: 'b', to: 'c', label: 'reload: GET /index.html' },
  { from: 'c', to: 'b', label: 'new HTML > chunk.bb22.js', dashed: true, tone: 'ok' },
];

export default defineLesson('sequence', {
  slug: 'fe-http-caching',
  objectives: [
    { text: 'Why long-lived caching needs content-hashed URLs', step: 2 },
    { text: 'How ETag and 304 make revalidation cheap', step: 3 },
    { text: 'What stale-while-revalidate trades away', step: 4 },
    { text: 'Which responses must never be shared', step: 5 },
    { text: 'How to deploy without breaking open tabs', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Every visit pays full price',
      tag: 'problem',
      body: ['Without caching headers the browser cannot know whether a file changed, so it downloads it again on every visit.', 'Repeat visitors see no benefit and the origin carries load it never needed to.'],
      keyIdea: 'HTTP caching is the cheapest performance win: the fastest request is the one you never make.',
      frames: reveal(
        NAIVE,
        (n) => [{ label: 'Downloads', value: n > 3 ? '2 x 300 KB' : '300 KB', tone: n > 3 ? 'bad' : 'neutral' }, { label: 'Origin hits', value: n > 4 ? '2' : n > 1 ? '1' : '0' }, { label: 'Cache', value: 'none', tone: 'bad' }],
        (n) => (n > 5 ? { text: 'same bytes, downloaded twice', tone: 'bad' } : undefined),
        900,
      ),
    },
    {
      label: 'Hashed assets',
      title: 'Cache forever, change the URL',
      tag: 'technique',
      body: ['Put a content hash in the filename: `app.3f9a1c.js`. Serve it with `public, max-age=31536000, immutable`.', 'The URL changes when content changes, so a year of caching is safe. The repeat visit makes zero requests.'],
      keyIdea: 'Hashed JS, CSS, fonts and images get `max-age` of a year plus `immutable`.',
      frames: reveal(
        HASHED,
        (n) => [{ label: 'Policy', value: '1y immutable', tone: 'ok' }, { label: 'First visit', value: '1 request' }, { label: 'Repeat visit', value: n > 4 ? '0 requests' : '...', tone: n > 4 ? 'ok' : 'neutral' }],
        (n) => (n > 4 ? { text: 'fresh in the browser: no network at all', tone: 'ok' } : undefined),
      ),
    },
    {
      label: 'Revalidate',
      title: 'HTML must check, but cheaply',
      tag: 'technique',
      body: ['The HTML document points to the newest hashed assets, so it uses `no-cache`: store it, but revalidate before every use.', 'With an `ETag` the check returns `304 Not Modified` with no body, a tiny round trip.'],
      keyIdea: '`no-cache` does not mean "do not cache". It means "ask first". `no-store` means do not store at all.',
      frames: reveal(
        REVALIDATE,
        (n) => [{ label: 'Policy', value: 'no-cache, ETag' }, { label: 'Response', value: n > 2 ? '304, no body' : 'pending', tone: n > 2 ? 'ok' : 'neutral' }, { label: 'Always fresh', value: 'yes', tone: 'ok' }],
        (n) => (n > 4 ? { text: 'validator matched: reuse the stored body', tone: 'ok' } : undefined),
      ),
    },
    {
      label: 'SWR',
      title: 'Serve stale, refresh behind',
      tag: 'trade-off',
      body: ['`stale-while-revalidate=N` serves a stale copy instantly while the cache refreshes in the background.', 'Good for stable public API GETs and HTML: `public, max-age=60, stale-while-revalidate=300` absorbs bursts.'],
      keyIdea: 'You trade a short window of stale data for speed. `stale-if-error` serves stale when the origin fails.',
      frames: reveal(
        SWR,
        (n) => [{ label: 'First answer', value: n > 1 ? 'instant' : '...', tone: n > 1 ? 'ok' : 'neutral' }, { label: 'Data age', value: n > 1 && n < 5 ? 'stale' : n > 4 ? 'fresh' : '-', tone: n > 1 && n < 5 ? 'bad' : 'ok' }, { label: 'Origin load', value: 'one refresh' }],
        (n) => (n === 3 ? { text: 'the user did not wait for the refresh', tone: 'accent' } : undefined),
      ),
    },
    {
      label: 'Private',
      title: 'Never share personal responses',
      tag: 'trade-off',
      body: ['User data uses `private, no-cache` plus `ETag`: the browser may keep it, shared caches must not.', 'Auth and payment responses use `no-store`. Never cache personalized HTML under a shared key.'],
      keyIdea: '`private` only the browser may cache. `public` shared caches may too. `Vary: Cookie` kills hit rate, so separate personal data into its own fetch.',
      frames: reveal(
        PRIVATE,
        (n) => [{ label: 'Policy', value: 'private' }, { label: 'CDN stores', value: 'nothing', tone: 'ok' }, { label: 'User B sees', value: n > 5 ? 'own data' : '-', tone: n > 5 ? 'ok' : 'neutral' }],
        (n) => (n > 5 ? { text: 'no shared key, no data leak between users', tone: 'ok' } : undefined),
      ),
    },
    {
      label: 'Deploys',
      title: 'Open tabs still want old files',
      tag: 'in practice',
      body: ['Users with an open tab request the previous chunk names after you deploy. If you deleted them, they get 404s and chunk load errors.', 'Keep old assets for a while and catch the dynamic import error in the router: reload once.'],
      keyIdea: 'Content hashes make deploys atomic, but only if old URLs keep working. Cached clients also need tolerant APIs.',
      frames: [
        { hold: 2200, state: state(DEPLOY_BAD, [{ label: 'Chunk', value: '404', tone: 'bad' }, { label: 'User sees', value: 'broken page', tone: 'bad' }, { label: 'Cause', value: 'files deleted' }], { text: 'deleted old chunk: stale tab breaks', tone: 'bad' }) },
        { hold: 2600, state: state(DEPLOY_OK, [{ label: 'Chunk', value: '200', tone: 'ok' }, { label: 'Next load', value: 'new hashes', tone: 'ok' }, { label: 'Router', value: 'reload once' }], { text: 'old chunk kept, new HTML points to new hashes', tone: 'ok' }) },
      ],
    },
    {
      label: 'Recap',
      title: 'A header for each kind of file',
      tag: 'recap',
      body: [
        '- **Hashed assets:** `public, max-age=31536000, immutable`.',
        '- **HTML:** `no-cache`, or short `s-maxage` with `stale-while-revalidate`.',
        '- **Public API GET:** `max-age=60, stale-while-revalidate=300`.',
        '- **User data:** `private, no-cache` plus `ETag`. **Auth and payment:** `no-store`.',
        '- **Deploys:** hashed names, keep old assets, handle chunk load errors.',
      ],
      keyIdea: 'Match the policy to how the URL changes: immutable for hashed, revalidate for HTML, never share private data.',
      frames: [{ state: state(HASHED, [{ label: 'Hashed', value: '1y immutable', tone: 'ok' }, { label: 'HTML', value: 'no-cache', tone: 'ok' }, { label: 'Private', value: 'no-store', tone: 'ok' }], { text: 'policy follows how the URL changes', tone: 'accent' }) }],
    },
  ],
});
