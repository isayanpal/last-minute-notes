import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the Next.js notes on cacheLife: stale (client may use without asking), revalidate (server serves cached then refreshes),
 * expire (next request waits for fresh data). The profile is a DEMO in minutes (stale 5, revalidate 15, expire 60),
 * and what each request gets is computed by a real serve() function.
 */

const PROFILE = { stale: 5, revalidate: 15, expire: 60 };
type Served = 'fresh' | 'stale + refresh' | 'waits for fresh';

/** What the server does with a request that arrives when the entry is `age` minutes old and nothing refreshed it. */
const serve = (age: number): Served => (age < PROFILE.revalidate ? 'fresh' : age < PROFILE.expire ? 'stale + refresh' : 'waits for fresh');

const SHORT: Record<Served, string> = { fresh: 'fresh', 'stale + refresh': 'stale+refresh', 'waits for fresh': 'waits' };
const REQUESTS = [10, 30, 70];
const RESULTS = REQUESTS.map((m) => ({ at: m, served: serve(m) }));

const bar = (id: string, from: number, to: number, label: string, tone: TimelineBar['tone'], state?: TimelineBar['state']): TimelineBar => ({ id, from, to, label, tone, state });

const view = (opts: { client?: boolean; server?: 'fresh' | 'stale' | 'all'; requests?: number; note: TimelineState['note'] }): TimelineState => {
  const lanes: TimelineState['lanes'] = [];
  if (opts.client) lanes.push({ label: 'client', bars: [bar('c', 0, PROFILE.stale, 'no check', 'info')] });
  const serverBars: TimelineBar[] = [];
  if (opts.server) {
    serverBars.push(bar('s1', 0, PROFILE.revalidate, 'fresh', 'ok'));
    if (opts.server !== 'fresh') serverBars.push(bar('s2', PROFILE.revalidate, PROFILE.expire, 'stale + refresh', 'data'));
    if (opts.server === 'all') serverBars.push(bar('s3', PROFILE.expire, 75, 'waits', 'bad', 'bad'));
  } else {
    serverBars.push(bar('s0', 0, 75, 'cached entry', 'neutral'));
  }
  lanes.push({ label: 'server', bars: serverBars });
  const shown = RESULTS.slice(0, opts.requests ?? 0);
  const last = shown[shown.length - 1];
  return {
    from: 0,
    to: 75,
    unit: 'm',
    ticks: [0, 15, 30, 45, 60, 75],
    lanes,
    markers: shown.map((r) => ({ at: r.at, label: `req ${r.at}m`, tone: r.served === 'fresh' ? ('ok' as const) : r.served === 'waits for fresh' ? ('bad' as const) : ('accent' as const) })),
    stats: [
      { label: 'stale', value: `${PROFILE.stale} min` },
      { label: 'revalidate', value: `${PROFILE.revalidate} min` },
      last ? { label: `Request at ${last.at}m`, value: SHORT[last.served], tone: last.served === 'fresh' ? 'ok' : last.served === 'waits for fresh' ? 'bad' : 'neutral' } : { label: 'expire', value: `${PROFILE.expire} min` },
    ],
    note: opts.note,
  };
};

export default defineLesson('timeline', {
  slug: 'next-cache-lifetimes',
  objectives: [
    { text: 'Why a cached value needs a lifetime', step: 1 },
    { text: 'What stale controls on the client', step: 2 },
    { text: 'How revalidate serves old data while refreshing', step: 3 },
    { text: 'What happens after expire', step: 4 },
  ],
  steps: [
    {
      label: 'Lifetime',
      title: 'A cached value ages',
      tag: 'problem',
      body: ['A cached entry is fast but old. Without a lifetime you cannot say how old is acceptable.', '`cacheLife` gives an entry three clocks: `stale`, `revalidate` and `expire`. The values here are a demo.'],
      keyIdea: 'Caching is a promise about how old the data may be.',
      frames: [{ state: view({ note: { text: 'one entry, 75 minutes of life: the three clocks split it into phases', tone: 'accent' } }), hold: 3400 }],
    },
    {
      label: 'stale',
      title: 'The client may skip the server',
      tag: 'concept',
      body: ['`stale` is how long the **client** can use the cached value without checking the server.', 'Within it, navigations reuse the value with no request at all.'],
      keyIdea: 'stale is a client-side window.',
      frames: [{ state: view({ client: true, note: { text: 'for the first 5 minutes the browser does not ask the server again', tone: 'ok' } }), hold: 3600 }],
    },
    {
      label: 'revalidate',
      title: 'Serve old, refresh behind',
      tag: 'technique',
      body: ['Before `revalidate` the server serves the entry as **fresh**. After it, the server still serves the cached value but refreshes it in the background.', 'That is stale-while-revalidate: the visitor never waits.'],
      keyIdea: 'After revalidate, the next visitor gets old data instantly and the one after gets new data.',
      frames: [{ state: view({ client: true, server: 'stale', requests: 2, note: { text: 'request at 10 min is fresh, request at 30 min gets the old value while a refresh starts', tone: 'accent' } }), hold: 4200 }],
    },
    {
      label: 'expire',
      title: 'Too old to serve',
      tag: 'trade-off',
      body: ['After `expire`, with no traffic in between, the cached value is no longer served.', 'The next request waits for fresh data, like an uncached page.'],
      keyIdea: 'Very short lifetimes can be treated as dynamic, so do not use them to fake "no cache".',
      frames: [{ state: view({ client: true, server: 'all', requests: 3, note: { text: 'request at 70 min finds an expired entry and must wait for fresh data', tone: 'bad' } }), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'cacheLife in one page',
      tag: 'recap',
      body: [
        '- **stale:** client reuse window, no server check.',
        '- **revalidate:** after it, serve cached and refresh in the background.',
        '- **expire:** after it, the next request waits.',
        '- **Profiles:** `seconds`, `minutes`, `hours`, `days`, `weeks`, `max`, or custom.',
        '- **Tags:** invalidate entries before their time runs out.',
      ],
      keyIdea: 'Pick the lifetime from how wrong the data is allowed to be.',
      frames: [{ state: view({ client: true, server: 'all', requests: 3, note: { text: 'fresh, then stale with a refresh, then a wait', tone: 'accent' } }) }],
    },
  ],
});
