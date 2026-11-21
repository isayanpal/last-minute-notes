import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Axis: milliseconds on a slow-ish connection. The numbers are illustrative, the ORDER of the chain is the point:
 * CSR is HTML, then JS, then data. SSR, SSG and streaming put content in the first response.
 */

const bar = (id: string, from: number, to: number, label: string, extra: Partial<TimelineBar> = {}): TimelineBar => ({ id, from, to, label, ...extra });

const AXIS = { from: 0, to: 2000, unit: 'ms', ticks: [0, 500, 1000, 1500, 2000] };
const ILLUSTRATIVE = 'illustrative timings, the order is what matters';

// Step 1: CSR, a strict chain.
const CSR: TimelineState = {
  ...AXIS,
  lanes: [
    { label: 'HTML shell', bars: [bar('h', 0, 150, 'empty', { tone: 'info' })] },
    { label: 'JS bundle', bars: [bar('j', 150, 900, 'download + parse', { tone: 'data' })] },
    { label: 'Fetch data', bars: [bar('d', 900, 1500, 'API call', { tone: 'violet' })] },
    { label: 'Render', bars: [bar('r', 1500, 1700, 'paint', { tone: 'ok' })] },
  ],
  markers: [{ at: 1700, label: 'first content', tone: 'bad' }],
  stats: [
    { label: 'Chain', value: 'HTML-JS-data', tone: 'bad' },
    { label: 'First paint', value: 'blank to 1.7s', tone: 'bad' },
    { label: 'Server cost', value: 'low', tone: 'ok' },
  ],
  note: { text: ILLUSTRATIVE, tone: 'neutral' },
};

// Step 2: SSR, content in the first response, then hydration.
const SSR: TimelineState = {
  ...AXIS,
  lanes: [
    { label: 'Server work', bars: [bar('s', 0, 500, 'fetch data + render', { tone: 'violet' })] },
    { label: 'HTML + content', bars: [bar('h', 500, 700, 'send', { tone: 'info' })] },
    { label: 'JS bundle', bars: [bar('j', 700, 1300, 'download', { tone: 'data' })] },
    { label: 'Hydrate', bars: [bar('hy', 1300, 1700, 'attach handlers', { tone: 'accent' })] },
  ],
  markers: [
    { at: 700, label: 'content visible', tone: 'ok' },
    { at: 1700, label: 'interactive', tone: 'bad' },
  ],
  stats: [
    { label: 'Content', value: 'before JS', tone: 'ok' },
    { label: 'Gap', value: 'not clickable', tone: 'bad' },
    { label: 'TTFB', value: 'waits on data' },
  ],
  note: { text: 'faster first paint, then a not-yet-interactive window', tone: 'accent' },
};

// Step 3: SSG and ISR. Rendering moved off the request path.
const STATIC: TimelineState = {
  ...AXIS,
  lanes: [
    { label: 'Build time', bars: [bar('b', 0, 600, 'render all pages', { tone: 'violet', state: 'dim' })] },
    { label: 'CDN edge', bars: [bar('c', 700, 780, 'hit', { tone: 'ok' })] },
    { label: 'Browser paint', bars: [bar('p', 780, 900, 'content', { tone: 'ok' })] },
    { label: 'Regenerate', bars: [bar('g', 1300, 1900, 'ISR: after TTL', { tone: 'data' })] },
  ],
  markers: [
    { at: 900, label: 'content', tone: 'ok' },
    { at: 1300, label: 'stale: rebuild', tone: 'accent' },
  ],
  stats: [
    { label: 'Per request', value: 'no render', tone: 'ok' },
    { label: 'SSG change', value: 'needs rebuild' },
    { label: 'ISR', value: 'stale window', tone: 'bad' },
  ],
  note: { text: 'SSG for docs and marketing, ISR for catalogs', tone: 'accent' },
};

// Step 4: streaming SSR. The shell leaves immediately.
const STREAMING: TimelineState = {
  ...AXIS,
  lanes: [
    { label: 'Shell', bars: [bar('sh', 0, 120, 'layout + skeletons', { tone: 'info' })] },
    { label: 'Fast widget', bars: [bar('f', 120, 350, 'streams in', { tone: 'ok' })] },
    { label: 'Slow widget', bars: [bar('sl', 120, 1100, 'waits on data', { tone: 'data', state: 'dim' }), bar('sl2', 1100, 1250, 'streams in', { tone: 'ok' })] },
  ],
  markers: [
    { at: 120, label: 'shell visible', tone: 'ok' },
    { at: 1250, label: 'all content', tone: 'accent' },
  ],
  stats: [
    { label: 'Shell', value: 'immediately', tone: 'ok' },
    { label: 'Fast parts', value: 'never wait', tone: 'ok' },
    { label: 'Watch for', value: 'buffering', tone: 'bad' },
  ],
  note: { text: 'each Suspense boundary streams when its data is ready', tone: 'accent' },
};

// Step 5: React Server Components. Less JS shipped.
const rscJs = (server: boolean): TimelineState => ({
  from: 0,
  to: 300,
  unit: 'KB',
  ticks: [0, 100, 200, 300],
  lanes: [
    { label: 'Header', bars: [bar('h', 0, server ? 0 : 40, server ? '' : '40', { tone: 'data' })].filter((b) => b.to > 0) },
    { label: 'Product list', bars: [bar('l', 0, server ? 0 : 110, server ? '' : '110', { tone: 'data' })].filter((b) => b.to > 0) },
    { label: 'Markdown lib', bars: [bar('m', 0, server ? 0 : 90, server ? '' : '90', { tone: 'data' })].filter((b) => b.to > 0) },
    { label: 'Cart button', bars: [bar('c', 0, 30, '30 client', { tone: 'ok' })] },
  ],
  stats: [
    { label: 'Client JS', value: server ? '30 KB' : '270 KB', tone: server ? 'ok' : 'bad' },
    { label: 'Components', value: server ? 'server first' : 'all ship to JS' },
    { label: 'Data access', value: server ? 'next to the UI' : 'waterfalls' },
  ],
  note: server ? { text: "only 'use client' ships code (illustrative sizes)", tone: 'ok' } : { text: 'the same page as a pure client app (illustrative sizes)', tone: 'bad' },
});

// Step 6: choosing. Decision walk, one lane per page type with the pick as a bar.
const CHOICES: TimelineState = {
  from: 0,
  to: 7,
  unit: '',
  ticks: [],
  lanes: [
    { label: 'Marketing', bars: [bar('m', 0, 7, 'SSG', { tone: 'ok' })] },
    { label: 'Blog, docs', bars: [bar('b', 0, 7, 'SSG or ISR', { tone: 'ok' })] },
    { label: 'Product page', bars: [bar('p', 0, 7, 'ISR or PPR + hole', { tone: 'data' })] },
    { label: 'Search results', bars: [bar('s', 0, 7, 'SSR or streaming', { tone: 'info' })] },
    { label: 'Dashboard', bars: [bar('d', 0, 7, 'CSR + prefetch', { tone: 'violet' })] },
    { label: 'Checkout', bars: [bar('c', 0, 7, 'SSR or CSR, no shared cache', { tone: 'bad', state: 'bad' })] },
  ],
  stats: [
    { label: 'Public + same for all', value: 'static', tone: 'ok' },
    { label: 'Behind login', value: 'CSR fine' },
    { label: 'Mix', value: 'per route', tone: 'ok' },
  ],
  note: { text: 'marketing static or ISR, app shell after login CSR', tone: 'accent' },
};

export default defineLesson('timeline', {
  slug: 'fe-rendering-strategies',
  objectives: [
    { text: 'Why CSR shows nothing until HTML, JS and data have all arrived', step: 1 },
    { text: 'What SSR fixes and the hydration gap it leaves', step: 2 },
    { text: 'How SSG and ISR move rendering off the request path', step: 3 },
    { text: 'How streaming and Server Components send less, sooner', step: 4 },
    { text: 'How to pick a strategy per page type', step: 6 },
  ],
  steps: [
    {
      label: 'CSR',
      title: 'Client-side rendering is a chain',
      tag: 'problem',
      body: ['The browser gets an empty shell, downloads the JS bundle, runs it, then fetches data. Only then does content paint.', 'It is cheap for the server and fine behind a login, but slow devices wait on every link in the chain.'],
      keyIdea: 'With CSR the network chain is HTML, then JS, then data. Nothing meaningful paints before all three.',
      frames: [{ state: CSR }],
    },
    {
      label: 'SSR',
      title: 'Render on the server per request',
      tag: 'concept',
      body: ['The server fetches data and sends finished HTML, so content is visible before any JS arrives.', 'Then the page **hydrates**: the browser re-runs components to attach handlers. Until that ends, the page looks ready but is not interactive.'],
      keyIdea: 'SSR trades a faster first paint for server cost, a TTFB that depends on data, and a hydration cost.',
      frames: [{ state: SSR }],
    },
    {
      label: 'SSG and ISR',
      title: 'Render before the request',
      tag: 'technique',
      body: ['**SSG** renders pages at build time and serves them from a CDN. **ISR** regenerates a static page after a time or on demand.', 'Great for docs, blogs and catalogs. The cost is a rebuild for changes (SSG) or a staleness window (ISR).'],
      keyIdea: 'Same content for everyone and it changes rarely: serve it from the CDN. Not for per-user data.',
      frames: [{ state: STATIC }],
    },
    {
      label: 'Streaming',
      title: 'Send the shell first',
      tag: 'technique',
      body: ['**Streaming SSR** sends the layout and skeletons immediately, then each Suspense boundary streams in when its data is ready.', 'A fast widget never waits for a slow one. Put boundaries around independent, slow or personalized parts.'],
      keyIdea: 'Verify streaming survives your delivery path. Some proxies and CDNs buffer responses.',
      frames: [{ state: STREAMING }],
    },
    {
      label: 'Server Components',
      title: 'Ship less JavaScript',
      tag: 'concept',
      body: ['Server components are the default. They read data and secrets, and their code never ships to the browser.', 'Only `\'use client\'` components handle state and effects. Props crossing the boundary must be serializable.'],
      keyIdea: 'Less client JS, fewer client waterfalls, data fetching beside the UI.',
      frames: [{ state: rscJs(false), hold: 1800 }, { state: rscJs(true), hold: 2400 }],
    },
    {
      label: 'Choosing',
      title: 'Pick per page, not per app',
      tag: 'trade-off',
      body: ['Ask: does it need SEO or fast first paint? Same for everyone? Does it change often? Are there slow data parts?', 'Mix strategies per route and say so in the interview.'],
      keyIdea: '"Marketing and product pages are static or ISR, the app shell after login is CSR."',
      frames: [{ state: CHOICES }],
    },
    {
      label: 'Recap',
      title: 'The strategy cheat sheet',
      tag: 'recap',
      body: [
        '- **CSR:** blank first paint, fine behind a login.',
        '- **SSR:** content in the first response, pays hydration and server cost.',
        '- **SSG and ISR:** CDN served, rebuild or stale window.',
        '- **Streaming and RSC:** shell first, less JS, boundaries per slow part.',
        '- **Never** cache personalized HTML under a shared key.',
      ],
      keyIdea: 'Start from requirements (SEO, personalization, freshness), then pick the cheapest strategy that meets them.',
      frames: [{ state: CHOICES }],
    },
  ],
});
