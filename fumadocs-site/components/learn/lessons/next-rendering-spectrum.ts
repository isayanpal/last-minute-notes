import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the Next.js notes on the rendering spectrum: CSR, SSR, SSG, ISR and streaming differ in where and when HTML is made.
 * The latencies are EXAMPLE values (CDN 40 ms, server render 120 ms, data 300 ms, JS 500 ms) and the times to content are
 * computed from them, so the ordering is what matters, not the absolute numbers.
 */

const MS = { cdn: 40, render: 120, data: 300, js: 500 };

type Strategy = 'CSR' | 'SSR' | 'SSG' | 'ISR' | 'Streaming';
type Plan = { bars: TimelineBar[]; content: number; firstPaint: number };

const PLANS: Record<Strategy, Plan> = {
  CSR: (() => {
    const shell = MS.cdn;
    const js = shell + MS.js;
    const fetched = js + MS.data;
    return {
      bars: [
        { id: 'csr-shell', from: 0, to: shell, label: 'shell', tone: 'neutral' },
        { id: 'csr-js', from: shell, to: js, label: 'download JS', tone: 'data' },
        { id: 'csr-data', from: js, to: fetched, label: 'fetch', tone: 'req' },
      ],
      content: fetched,
      firstPaint: shell,
    } as Plan;
  })(),
  SSR: (() => {
    const done = MS.render + MS.data;
    return {
      bars: [{ id: 'ssr', from: 0, to: done, label: 'render + data', tone: 'violet' }],
      content: done,
      firstPaint: done,
    } as Plan;
  })(),
  SSG: {
    bars: [{ id: 'ssg', from: 0, to: MS.cdn, label: 'CDN', tone: 'ok' }],
    content: MS.cdn,
    firstPaint: MS.cdn,
  },
  ISR: {
    bars: [
      { id: 'isr', from: 0, to: MS.cdn, label: 'CDN', tone: 'ok' },
      { id: 'isr-bg', from: MS.cdn, to: MS.cdn + MS.render + MS.data, label: 'regenerate', tone: 'neutral', state: 'dim' },
    ],
    content: MS.cdn,
    firstPaint: MS.cdn,
  },
  Streaming: {
    bars: [
      { id: 'st-shell', from: 0, to: MS.render, label: 'shell', tone: 'violet' },
      { id: 'st-data', from: MS.render, to: MS.render + MS.data, label: 'streamed', tone: 'req' },
    ],
    content: MS.render + MS.data,
    firstPaint: MS.render,
  },
};

const view = (shown: Strategy[], focus: Strategy, note: string, tone: 'accent' | 'ok' | 'bad' = 'accent'): TimelineState => {
  const p = PLANS[focus];
  return {
    from: 0,
    to: 900,
    unit: 'ms',
    ticks: [0, 300, 600, 900],
    lanes: shown.map((s) => ({ label: s, bars: PLANS[s].bars })),
    markers: [{ at: p.content, label: `${focus} content`, tone: 'accent' }],
    stats: [
      { label: 'First paint', value: `${p.firstPaint} ms` },
      { label: 'Content', value: `${p.content} ms`, tone: focus === 'CSR' ? 'bad' : 'ok' },
      { label: 'Fresh data', value: focus === 'SSG' ? 'at build' : focus === 'ISR' ? 'in a window' : 'per request', tone: focus === 'SSG' || focus === 'ISR' ? 'neutral' : 'ok' },
    ],
    note: { text: note, tone },
  };
};

export default defineLesson('timeline', {
  slug: 'next-rendering-spectrum',
  objectives: [
    { text: 'Why client rendering is slow to content', step: 1 },
    { text: 'What SSR gains and costs', step: 2 },
    { text: 'Why SSG and ISR are the fastest', step: 3 },
    { text: 'How streaming shows a shell early', step: 4 },
  ],
  steps: [
    {
      label: 'CSR',
      title: 'Blank first, content last',
      tag: 'problem',
      body: ['With **client-side rendering** the browser gets an empty shell, downloads JavaScript, then fetches data.', 'Content appears only after all three. The times here are example values.'],
      keyIdea: 'CSR is fine for private, interactive pages, and poor for first paint.',
      frames: [{ state: view(['CSR'], 'CSR', 'example latencies: CDN 40 ms, JS 500 ms, data 300 ms', 'bad'), hold: 4000 }],
    },
    {
      label: 'SSR',
      title: 'HTML made per request',
      tag: 'concept',
      body: ['**Server-side rendering** builds the HTML on every request, with the data already in it.', 'The browser shows content as soon as the HTML arrives, and data is always fresh.'],
      keyIdea: 'SSR trades a slower first byte for content in the first response.',
      frames: [{ state: view(['CSR', 'SSR'], 'SSR', 'the server waits for data before sending anything', 'accent'), hold: 4000 }],
    },
    {
      label: 'SSG, ISR',
      title: 'Built ahead of time',
      tag: 'technique',
      body: ['**SSG** makes the HTML at build time, so a request is just a CDN file. **ISR** serves that file and regenerates it in the background.', 'Both are the fastest, but data is as old as the last build or refresh.'],
      keyIdea: 'Static output is the cheapest and fastest, because no code runs per request.',
      frames: [{ state: view(['CSR', 'SSR', 'SSG', 'ISR'], 'SSG', 'a CDN hit has nothing to render or fetch', 'ok'), hold: 3600 }, { state: view(['CSR', 'SSR', 'SSG', 'ISR'], 'ISR', 'ISR serves instantly and refreshes the page behind the scenes', 'ok'), hold: 3800 }],
    },
    {
      label: 'Streaming',
      title: 'Shell now, data when ready',
      tag: 'in practice',
      body: ['**Streaming SSR** sends the shell immediately and streams slow parts as they resolve.', 'First paint comes early, and content arrives in the same response, still fresh.'],
      keyIdea: 'In the App Router the mode is inferred from what the route does, and you can mix modes in one page.',
      frames: [{ state: view(['CSR', 'SSR', 'SSG', 'ISR', 'Streaming'], 'Streaming', 'the shell paints at the render time, the data fills in afterwards', 'ok'), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'The rendering spectrum',
      tag: 'recap',
      body: [
        '- **CSR:** browser builds everything, slowest to content.',
        '- **SSR:** server builds per request, always fresh.',
        '- **SSG:** build time, CDN fast, stale until rebuild.',
        '- **ISR:** static, refreshed in the background.',
        '- **Streaming:** fast shell, progressive content.',
      ],
      keyIdea: 'Pick by freshness need and personalisation, not by habit.',
      frames: [{ state: view(['CSR', 'SSR', 'SSG', 'ISR', 'Streaming'], 'Streaming', 'five strategies for the same page, ordered by when content appears', 'accent') }],
    },
  ],
});
