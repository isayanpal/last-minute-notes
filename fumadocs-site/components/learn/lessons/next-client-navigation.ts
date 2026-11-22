import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the Next.js notes on client navigation: Link prefetches, layouts persist, and only the segments that differ are
 * fetched as an RSC payload. The changed and kept segments are computed by diffing the real URL paths.
 */

const FROM = '/dashboard/settings';
const TO = '/dashboard/billing';

/** Segments shared by both paths keep their layouts mounted, the rest must be fetched. */
const diff = (from: string, to: string) => {
  const a = ['app', ...from.split('/').filter(Boolean)];
  const b = ['app', ...to.split('/').filter(Boolean)];
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return { kept: b.slice(0, i), fetched: b.slice(i), total: b.length };
};
const D = diff(FROM, TO);
const keptLayouts = D.kept.length;
const fetchedCount = D.fetched.length;

/** Prefetch depth: static routes prefetch the full payload, dynamic ones stop at the nearest loading.tsx. */
const prefetch = (isStatic: boolean) => (isStatic ? 'full payload' : 'to loading.tsx');

const ACTORS: SeqState['actors'] = [
  { id: 'user', label: 'User', kind: 'client' },
  { id: 'router', label: 'Router', kind: 'worker' },
  { id: 'server', label: 'Server', kind: 'service' },
];
const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });

// Step 1: an SPA router fetches data and re-renders everything.
const SPA: SeqMessage[] = [m('user', 'router', 'click link to billing'), m('router', 'server', 'GET /api/billing (JSON)', 'req'), m('server', 'router', 'JSON data', 'res', true), m('router', 'user', 'render the whole page', 'bad', true)];
const spa = (n: number): SeqState => ({
  actors: ACTORS,
  messages: SPA.slice(0, n),
  stats: [
    { label: 'Data on nav', value: 'JSON' },
    { label: 'Layouts', value: n >= 4 ? 'rerender' : '-', tone: n >= 4 ? 'bad' : 'neutral' },
    { label: 'Loading UI', value: 'your code' },
  ],
  note: n >= 4 ? { text: 'a typical SPA router re-renders by default and needs its own loading logic', tone: 'bad' } : { text: 'this is the model Next.js navigation improves on', tone: 'accent' },
});

// Step 2: Link prefetches visible links.
const pre = (isStatic: boolean): SeqState => ({
  actors: ACTORS,
  messages: [m('router', 'server', 'prefetch /billing', 'req'), m('server', 'router', prefetch(isStatic), 'ok', true)],
  stats: [
    { label: 'Route', value: isStatic ? 'static' : 'dynamic' },
    { label: 'Prefetched', value: prefetch(isStatic), tone: 'ok' },
    { label: 'When', value: 'link visible' },
  ],
  note: isStatic ? { text: 'static routes prefetch the full payload, so the click is instant', tone: 'ok' } : { text: 'dynamic routes prefetch only as far as the nearest loading.tsx', tone: 'accent' },
});

// Step 3: a cached segment renders instantly.
const cached = (): SeqState => ({
  actors: ACTORS,
  messages: [m('user', 'router', 'click link to billing'), m('router', 'router', 'check Router Cache'), m('router', 'user', 'render from cache', 'ok', true)].filter((x) => x.from !== x.to),
  stats: [
    { label: 'Router Cache', value: 'hit', tone: 'ok' },
    { label: 'Network', value: 'none', tone: 'ok' },
    { label: 'Time', value: 'instant', tone: 'ok' },
  ],
  note: { text: 'the prefetched payload is in memory, so no request is sent', tone: 'ok' },
});

// Step 4: an uncached click fetches only what changed.
const miss: SeqMessage[] = [
  m('user', 'router', 'click link to billing'),
  m('router', 'server', `RSC for ${D.fetched.join(', ')} only`, 'req'),
  m('server', 'router', 'stream payload', 'res', true),
  m('router', 'user', 'loading.tsx, then page', 'ok', true),
];
const missState = (n: number): SeqState => ({
  actors: ACTORS,
  messages: miss.slice(0, n),
  stats: [
    { label: 'Fetched', value: `${fetchedCount} of ${D.total}`, tone: 'ok' },
    { label: 'Layouts kept', value: String(keptLayouts), tone: 'ok' },
    { label: 'Client state', value: 'preserved', tone: 'ok' },
  ],
  note: n >= 4 ? { text: `${D.kept.join(' and ')} stay mounted: only ${D.fetched.join(', ')} is swapped`, tone: 'ok' } : { text: `from ${FROM} to ${TO}: the shared segments need no fetch`, tone: 'accent' },
});

export default defineLesson('sequence', {
  slug: 'next-client-navigation',
  objectives: [
    { text: 'How an SPA router navigates', step: 1 },
    { text: 'What Link prefetches', step: 2 },
    { text: 'Why a cached click is instant', step: 3 },
    { text: 'How only changed segments are fetched', step: 4 },
  ],
  steps: [
    {
      label: 'SPA',
      title: 'The usual router',
      tag: 'problem',
      body: ['A typical SPA fetches JSON on navigation and re-renders by default.', 'You write the loading states yourself.'],
      keyIdea: 'The App Router changes what travels and what re-renders.',
      frames: [1, 2, 3, 4].map((n) => ({ state: spa(n), hold: n === 4 ? 3400 : 1400 })),
    },
    {
      label: 'Prefetch',
      title: 'Link prefetches early',
      tag: 'concept',
      body: ['Visible `Link`s are prefetched in production. A **static** route prefetches its full payload.', 'A **dynamic** route prefetches down to the nearest `loading.tsx`.'],
      keyIdea: 'Prefetching moves the work before the click.',
      frames: [{ state: pre(true), hold: 3200 }, { state: pre(false), hold: 3600 }],
    },
    {
      label: 'Cached',
      title: 'Instant from memory',
      tag: 'technique',
      body: ['The **Router Cache** keeps visited and prefetched segments in browser memory.', 'A click on a cached segment renders without a network request.'],
      keyIdea: '`router.refresh()` re-fetches the current route and keeps client state.',
      frames: [{ state: cached(), hold: 3600 }],
    },
    {
      label: 'Segments',
      title: 'Only what changed',
      tag: 'in practice',
      body: [`Going from ${FROM} to ${TO}, the shared \`dashboard\` layout is not fetched or re-rendered.`, 'Only the payload for the changed segment arrives, and client state in the layout survives.'],
      keyIdea: 'Layouts are preserved: navigation swaps the leaf, not the page.',
      frames: [1, 2, 3, 4].map((n) => ({ state: missState(n), hold: n === 4 ? 4000 : 1400 })),
    },
    {
      label: 'Recap',
      title: 'Client navigation',
      tag: 'recap',
      body: [
        '- **Prefetch:** visible links, full payload for static routes.',
        '- **Router Cache:** cached segments render instantly.',
        '- **Segments:** only changed ones are fetched.',
        '- **Layouts:** persist, with their client state.',
        '- **loading.tsx:** a Suspense boundary shown meanwhile.',
      ],
      keyIdea: 'The server sends an RSC payload for changed segments, not JSON for the whole page.',
      frames: [{ state: missState(4) }],
    },
  ],
});
