import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the Next.js notes on parallel versus sequential fetching, using the notes' own numbers:
 * getUser 200 ms, getPosts 300 ms, getStats 150 ms. Totals are computed from the schedules, and the dependent
 * getOrg call (150 ms) is an example value.
 */

const T = { user: 200, posts: 300, stats: 150, org: 150 };

type Call = { name: 'getUser' | 'getPosts' | 'getStats'; ms: number };
const CALLS: Call[] = [
  { name: 'getUser', ms: T.user },
  { name: 'getPosts', ms: T.posts },
  { name: 'getStats', ms: T.stats },
];

const sequential = (): { bars: Record<string, TimelineBar>; total: number } => {
  let t = 0;
  const bars: Record<string, TimelineBar> = {};
  for (const c of CALLS) {
    bars[c.name] = { id: c.name, from: t, to: t + c.ms, label: `${c.ms} ms`, tone: 'req' };
    t += c.ms;
  }
  return { bars, total: t };
};
const parallel = (): { bars: Record<string, TimelineBar>; total: number } => {
  const bars: Record<string, TimelineBar> = {};
  for (const c of CALLS) bars[c.name] = { id: c.name, from: 0, to: c.ms, label: `${c.ms} ms`, tone: 'ok' };
  return { bars, total: Math.max(...CALLS.map((c) => c.ms)) };
};
const SEQ = sequential();
const PAR = parallel();

const base = (lanes: TimelineState['lanes'], markers: TimelineState['markers'], stats: TimelineState['stats'], note: TimelineState['note']): TimelineState => ({
  from: 0,
  to: 700,
  unit: 'ms',
  ticks: [0, 200, 400, 600],
  lanes,
  markers,
  stats,
  note,
});

const waterfall = (): TimelineState =>
  base(
    CALLS.map((c) => ({ label: c.name, bars: [SEQ.bars[c.name]] })),
    [{ at: SEQ.total, label: `ready ${SEQ.total}`, tone: 'bad' }],
    [
      { label: 'Page ready', value: `${SEQ.total} ms`, tone: 'bad' },
      { label: 'Sum of calls', value: `${CALLS.map((c) => c.ms).join('+')}` },
      { label: 'Dependency', value: 'none', tone: 'bad' },
    ],
    { text: 'getPosts does not need getUser, yet it waits for it: an accidental waterfall', tone: 'bad' },
  );

const allAtOnce = (): TimelineState =>
  base(
    CALLS.map((c) => ({ label: c.name, bars: [PAR.bars[c.name]] })),
    [{ at: PAR.total, label: `ready ${PAR.total}`, tone: 'ok' }],
    [
      { label: 'Page ready', value: `${PAR.total} ms`, tone: 'ok' },
      { label: 'Saved', value: `${SEQ.total - PAR.total} ms`, tone: 'ok' },
      { label: 'Slowest call', value: 'getPosts' },
    ],
    { text: 'Promise.all starts all three together, so the page waits only for the slowest', tone: 'ok' },
  );

const dependent = (): TimelineState =>
  base(
    [
      { label: 'getUser', bars: [{ id: 'dep-user', from: 0, to: T.user, label: `${T.user} ms`, tone: 'req' }] },
      { label: 'getOrg', bars: [{ id: 'dep-org', from: T.user, to: T.user + T.org, label: 'needs user', tone: 'data' }] },
    ],
    [{ at: T.user + T.org, label: `ready ${T.user + T.org}`, tone: 'accent' }],
    [
      { label: 'Page ready', value: `${T.user + T.org} ms` },
      { label: 'Why serial', value: 'org needs user' },
      { label: 'Verdict', value: 'intended', tone: 'ok' },
    ],
    { text: 'the second request needs the first result, so sequential await is correct here', tone: 'accent' },
  );

const streamed = (): TimelineState =>
  base(
    [
      { label: 'shell', bars: [{ id: 'sh', from: 0, to: 20, label: 'paint', tone: 'violet' }] },
      ...CALLS.map((c) => ({ label: c.name, bars: [PAR.bars[c.name]] })),
    ],
    [{ at: 20, label: 'paint 20', tone: 'ok' as const }, { at: PAR.total, label: `all ${PAR.total}`, tone: 'accent' as const }],
    [
      { label: 'First paint', value: '20 ms', tone: 'ok' },
      { label: 'Stats shown', value: `${T.stats} ms`, tone: 'ok' },
      { label: 'Last section', value: `${PAR.total} ms` },
    ],
    { text: 'each Suspense boundary appears as its own data resolves: no all-or-nothing wait', tone: 'ok' },
  );

export default defineLesson('timeline', {
  slug: 'next-fetch-waterfall',
  objectives: [
    { text: 'How an accidental waterfall adds latencies up', step: 1 },
    { text: 'How Promise.all pays only for the slowest call', step: 2 },
    { text: 'When a sequential await is correct', step: 3 },
    { text: 'How Suspense lets each section appear on its own', step: 4 },
  ],
  steps: [
    {
      label: 'Waterfall',
      title: 'Awaiting one after another',
      tag: 'problem',
      body: ['Three independent calls awaited in a row take 200 + 300 + 150 ms.', 'Each one waits for the previous one even though none needs it.'],
      keyIdea: 'Accidental sequential awaits are bugs, check the network tab and server logs.',
      frames: [{ state: waterfall(), hold: 4000 }],
    },
    {
      label: 'Promise.all',
      title: 'Start them together',
      tag: 'technique',
      body: ['`Promise.all([getUser(id), getPosts(id), getStats(id)])` starts all three at once.', 'The page is ready after the slowest call, about 300 ms.'],
      keyIdea: 'Use `Promise.allSettled` when some parts may fail without failing the page.',
      frames: [{ state: allAtOnce(), hold: 4000 }],
    },
    {
      label: 'Dependent',
      title: 'Sometimes serial is right',
      tag: 'trade-off',
      body: ['If the second request needs the first result, for example the user and then their org, it **must** wait.', 'Sequential dependencies are fine, only accidental ones are bugs.'],
      keyIdea: 'Ask whether the second call really uses the first call\'s result.',
      frames: [{ state: dependent(), hold: 3800 }],
    },
    {
      label: 'Streaming',
      title: 'A boundary per section',
      tag: 'in practice',
      body: ['Wrap independent components in their own `Suspense`. The shell paints at once and each section streams in when its data arrives.', 'The user sees stats at 150 ms instead of waiting for everything.'],
      keyIdea: 'Independent boundaries load in parallel and appear as each resolves.',
      frames: [{ state: streamed(), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Fetching patterns',
      tag: 'recap',
      body: [
        '- **Sequential awaits:** latencies add up.',
        '- **Promise.all:** pay for the slowest call.',
        '- **Dependent calls:** await in order, on purpose.',
        '- **Suspense per component:** each section streams in.',
        '- **Nested fetching:** a child awaiting inside a parent that awaited first is still a waterfall.',
      ],
      keyIdea: 'Fetch next to where data renders, and keep independent work parallel.',
      frames: [{ state: streamed() }],
    },
  ],
});
