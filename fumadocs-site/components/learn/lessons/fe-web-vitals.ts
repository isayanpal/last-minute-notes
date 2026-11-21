import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Thresholds come from the notes: LCP 2.5 s / 4 s, INP 200 ms / 500 ms, CLS 0.1 / 0.25 (p75).
 * Individual timings in the breakdowns are illustrative, the shape of each fix is the point.
 */

const bar = (id: string, from: number, to: number, label: string, extra: Partial<TimelineBar> = {}): TimelineBar => ({ id, from, to, label, ...extra });
const ILLUSTRATIVE = { text: 'illustrative timings', tone: 'neutral' as const };

// Step 1: the critical rendering path. A blocking script delays the first paint.
const crp = (deferred: boolean): TimelineState => ({
  from: 0,
  to: 1000,
  unit: 'ms',
  ticks: [0, 250, 500, 750, 1000],
  lanes: [
    { label: 'Parse HTML', bars: deferred ? [bar('p', 0, 300, 'parse', { tone: 'info' })] : [bar('p1', 0, 300, 'parse', { tone: 'info' }), bar('p2', 300, 700, 'paused by script', { tone: 'bad', state: 'bad' }), bar('p3', 700, 800, 'resume', { tone: 'info' })] },
    { label: 'CSS', bars: [bar('c', 50, 450, 'download + CSSOM', { tone: 'data' })] },
    { label: 'Script', bars: deferred ? [bar('s', 300, 700, 'defer: after parse', { tone: 'ok' })] : [bar('s', 300, 700, 'sync: blocks parser', { tone: 'bad', state: 'bad' })] },
    { label: 'Render', bars: deferred ? [bar('r', 450, 600, 'paint', { tone: 'ok' })] : [bar('r', 800, 950, 'paint', { tone: 'ok' })] },
  ],
  markers: [{ at: deferred ? 600 : 950, label: 'first paint', tone: deferred ? 'ok' : 'bad' }],
  stats: [
    { label: 'CSS', value: 'render-block', tone: 'bad' },
    { label: 'Sync script', value: deferred ? 'use defer' : 'blocks parser', tone: deferred ? 'ok' : 'bad' },
    { label: 'First paint', value: deferred ? '~600 ms' : '~950 ms', tone: deferred ? 'ok' : 'bad' },
  ],
  note: deferred ? { text: 'defer: parsing never stops, paint waits only for CSS', tone: 'ok' } : ILLUSTRATIVE,
});

// Step 2: the three Core Web Vitals, one axis each.
const bands = (title: string, unit: string, to: number, good: number, mid: number, ticks: number[], label: string, stats: TimelineState['stats']): TimelineState => ({
  from: 0,
  to,
  unit,
  ticks,
  lanes: [
    {
      label: title,
      bars: [bar('g', 0, good, 'good', { tone: 'ok' }), bar('m', good, mid, 'needs work', { tone: 'data' }), bar('p', mid, to, 'poor', { tone: 'bad' })],
    },
  ],
  markers: [{ at: good, label, tone: 'ok' }],
  stats,
  note: { text: 'measured at the 75th percentile of page loads', tone: 'accent' },
});
const LCP_BANDS = bands('LCP', 's', 6, 2.5, 4, [0, 1, 2, 3, 4, 5, 6], '2.5 s', [{ label: 'Measures', value: 'biggest item' }, { label: 'Good', value: '<= 2.5 s', tone: 'ok' }, { label: 'Poor', value: '> 4 s', tone: 'bad' }]);
const INP_BANDS = bands('INP', 'ms', 800, 200, 500, [0, 200, 400, 500, 800], '200 ms', [{ label: 'Measures', value: 'interactions' }, { label: 'Good', value: '<= 200 ms', tone: 'ok' }, { label: 'Replaced', value: 'FID, Mar 2024' }]);
const CLS_BANDS = bands('CLS', '', 0.4, 0.1, 0.25, [0, 0.1, 0.25, 0.4], '0.1', [{ label: 'Measures', value: 'layout shift' }, { label: 'Good', value: '<= 0.1', tone: 'ok' }, { label: 'Poor', value: '> 0.25', tone: 'bad' }]);

// Step 3: LCP is four parts, each with its own fix.
const lcp = (fixed: boolean): TimelineState => {
  const t = fixed ? [150, 250, 700, 1000, 1700] : [600, 1500, 2600, 3300, 3600];
  return {
    from: 0,
    to: 4000,
    unit: 'ms',
    ticks: [0, 1000, 2000, 3000, 4000],
    lanes: [
      { label: 'TTFB', bars: [bar('t', 0, t[0], fixed ? 'CDN' : 'slow origin', { tone: fixed ? 'ok' : 'bad', state: fixed ? 'normal' : 'bad' })] },
      { label: 'Load delay', bars: [bar('d', t[0], t[1], fixed ? 'in HTML' : 'found late (JS)', { tone: fixed ? 'ok' : 'bad', state: fixed ? 'normal' : 'bad' })] },
      { label: 'Load time', bars: [bar('l', t[1], t[2], fixed ? 'AVIF, right size' : 'big JPEG', { tone: fixed ? 'ok' : 'data' })] },
      { label: 'Render delay', bars: [bar('r', t[2], t[3], fixed ? 'critical CSS' : 'blocking CSS + JS', { tone: fixed ? 'ok' : 'data' })] },
    ],
    markers: [{ at: 2500, label: 'good: 2.5 s', tone: 'ok' }, { at: t[3], label: 'LCP', tone: fixed ? 'ok' : 'bad' }],
    stats: [
      { label: 'LCP', value: `${(t[3] / 1000).toFixed(1)} s`, tone: fixed ? 'ok' : 'bad' },
      { label: 'Biggest part', value: fixed ? 'load time' : 'load delay', tone: fixed ? 'neutral' : 'bad' },
      { label: 'Hero image', value: fixed ? 'preload, high' : 'lazy loaded', tone: fixed ? 'ok' : 'bad' },
    ],
    note: fixed ? { text: 'each part got its own fix', tone: 'ok' } : ILLUSTRATIVE,
  };
};

// Step 4: INP is input delay, processing, presentation. A long task is the usual culprit.
const inp = (fixed: boolean): TimelineState => ({
  from: 0,
  to: 600,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500, 600],
  lanes: [
    { label: 'Main thread', bars: fixed ? [bar('m1', 0, 40, '', { tone: 'data' }), bar('m2', 80, 120, 'chunks', { tone: 'data' })] : [bar('m', 0, 300, 'long task (hydration, 3rd party)', { tone: 'bad', state: 'bad' })] },
    { label: 'Input delay', bars: fixed ? [bar('i', 60, 80, '20', { tone: 'ok' })] : [bar('i', 60, 300, 'waiting for the thread', { tone: 'bad', state: 'bad' })] },
    { label: 'Processing', bars: fixed ? [bar('p', 80, 120, 'handler', { tone: 'ok' })] : [bar('p', 300, 380, 'handler', { tone: 'data' })] },
    { label: 'Presentation', bars: fixed ? [bar('r', 120, 160, 'render', { tone: 'ok' })] : [bar('r', 380, 480, 'big re-render', { tone: 'data' })] },
  ],
  markers: [{ at: 60, label: 'click', tone: 'accent' }, { at: 260, label: 'good: 200 ms', tone: 'ok' }],
  stats: [
    { label: 'INP', value: fixed ? '~100 ms' : '~420 ms', tone: fixed ? 'ok' : 'bad' },
    { label: 'Fix', value: fixed ? 'split + yield' : 'long task', tone: fixed ? 'ok' : 'bad' },
    { label: 'Also', value: 'less re-render' },
  ],
  note: fixed ? { text: 'yield between chunks so input is handled at once', tone: 'ok' } : ILLUSTRATIVE,
});

// Step 5: CLS. Late content pushes the page around, reserved space does not.
const cls = (fixed: boolean): TimelineState => ({
  from: 0,
  to: 4,
  unit: 's',
  ticks: [0, 1, 2, 3, 4],
  lanes: [
    { label: 'Hero image', bars: [bar('h', 0.8, 1.6, fixed ? 'reserved' : 'shift 0.12', { tone: fixed ? 'ok' : 'bad', state: fixed ? 'normal' : 'bad' })] },
    { label: 'Late banner', bars: [bar('b', 1.8, 2.6, fixed ? 'overlay' : 'shift 0.08', { tone: fixed ? 'ok' : 'bad', state: fixed ? 'normal' : 'bad' })] },
    { label: 'Font swap', bars: [bar('f', 2.8, 3.6, fixed ? 'size-adjust' : 'shift 0.04', { tone: fixed ? 'ok' : 'bad', state: fixed ? 'normal' : 'bad' })] },
  ],
  markers: [{ at: 3.8, label: fixed ? 'CLS ~0' : 'CLS 0.24', tone: fixed ? 'ok' : 'bad' }],
  stats: [
    { label: 'CLS', value: fixed ? '~0' : '0.24', tone: fixed ? 'ok' : 'bad' },
    { label: 'Fix', value: fixed ? 'reserve space' : 'no dimensions', tone: fixed ? 'ok' : 'bad' },
    { label: 'Excluded', value: '<500 ms input' },
  ],
  note: fixed ? { text: 'width, height or aspect-ratio, size-adjust on fonts', tone: 'ok' } : ILLUSTRATIVE,
});

// Step 6: lab versus field.
const FIELD: TimelineState = {
  from: 0,
  to: 6,
  unit: 's',
  ticks: [0, 1, 2, 3, 4, 5, 6],
  lanes: [
    { label: 'Lab: Lighthouse', bars: [bar('l', 0, 1.8, '1.8 s, looks great', { tone: 'ok' })] },
    { label: 'Field p75 desktop', bars: [bar('d', 0, 2.1, '2.1 s', { tone: 'ok' })] },
    { label: 'Field p75 mobile', bars: [bar('m', 0, 3.4, '3.4 s', { tone: 'data' })] },
    { label: 'Field p75 low-end', bars: [bar('x', 0, 5.2, '5.2 s', { tone: 'bad', state: 'bad' })] },
  ],
  markers: [{ at: 2.5, label: 'good: 2.5 s', tone: 'ok' }],
  stats: [
    { label: 'Lab', value: 'diagnose', tone: 'ok' },
    { label: 'Field', value: 'decide', tone: 'ok' },
    { label: 'Report at', value: 'p75' },
  ],
  note: { text: 'illustrative: a lab score can hide real slow users', tone: 'bad' },
};

export default defineLesson('timeline', {
  slug: 'fe-web-vitals',
  objectives: [
    { text: 'What blocks the first paint in the critical rendering path', step: 1 },
    { text: 'The three Core Web Vitals and their thresholds', step: 2 },
    { text: 'The four parts of LCP and a fix for each', step: 3 },
    { text: 'Why INP is mostly a main-thread problem', step: 4 },
    { text: 'What causes layout shift and how to prevent it', step: 5 },
    { text: 'Lab versus field data, and budgets', step: 6 },
  ],
  steps: [
    {
      label: 'Render path',
      title: 'What blocks the first paint',
      tag: 'problem',
      body: ['CSS is render blocking: no paint until the CSSOM is built. A synchronous script is parser blocking: HTML parsing stops while it runs.', 'Use `defer`, `async` or `type="module"` so scripts never stall the parser.'],
      keyIdea: 'HTML that already contains the content and critical resource links wins. The browser starts work before any JS runs.',
      frames: [{ state: crp(false), hold: 2400 }, { state: crp(true), hold: 2400 }],
    },
    {
      label: 'Core Web Vitals',
      title: 'Three numbers users feel',
      tag: 'concept',
      body: ['**LCP** is when the largest visible element renders. **INP** is the latency of interactions across the visit. **CLS** is unexpected layout movement.', 'They are judged at the 75th percentile, so a slow tail counts.'],
      keyIdea: 'Good at p75: LCP 2.5 s or less, INP 200 ms or less, CLS 0.1 or less.',
      frames: [{ state: LCP_BANDS, hold: 1800 }, { state: INP_BANDS, hold: 1800 }, { state: CLS_BANDS, hold: 2200 }],
    },
    {
      label: 'LCP',
      title: 'LCP is four parts',
      tag: 'technique',
      body: ['**TTFB**, **resource load delay**, **resource load duration** and **element render delay** add up to LCP.', 'Find the biggest part first. A hero image injected by JS is found late. Never put `loading="lazy"` on it.'],
      keyIdea: 'Put the LCP image in the HTML, `preload` it with `fetchpriority="high"`, serve AVIF or WebP at the right size.',
      frames: [{ state: lcp(false), hold: 2600 }, { state: lcp(true), hold: 2600 }],
    },
    {
      label: 'INP',
      title: 'INP is a main-thread problem',
      tag: 'technique',
      body: ['Every interaction has **input delay**, **processing time** and **presentation delay**. A long task makes the user wait before the handler even starts.', 'Break work up and yield, shrink re-render scope, move heavy work to a worker, delay third-party scripts.'],
      keyIdea: 'Tasks over 50 ms are long tasks. Yield with `scheduler.yield()` or `setTimeout`, and use `startTransition` for non-urgent updates.',
      frames: [{ state: inp(false), hold: 2600 }, { state: inp(true), hold: 2600 }],
    },
    {
      label: 'CLS',
      title: 'Reserve space before content arrives',
      tag: 'technique',
      body: ['Layout shifts come from images and embeds without reserved space, fonts that swap with different metrics, and content injected above existing content.', 'Set `width` and `height` or `aspect-ratio`, and use `size-adjust` on the fallback font.'],
      keyIdea: 'Animate with `transform`, not `top` or `height`. Shifts within 500 ms of a user input are excluded.',
      frames: [{ state: cls(false), hold: 2600 }, { state: cls(true), hold: 2600 }],
    },
    {
      label: 'Measure',
      title: 'Field data decides, lab data diagnoses',
      tag: 'in practice',
      body: ['**Field** data (CrUX, RUM with `web-vitals`) is real users. **Lab** data (Lighthouse, DevTools) is repeatable and good for diagnosis.', 'A lab score of 95 can hide a low-end phone at 5 seconds. Add budgets in CI and alerts on p75 per route.'],
      keyIdea: 'Method: measure, locate the bottleneck, change one thing, re-measure, guard with a budget.',
      frames: [{ state: FIELD }],
    },
    {
      label: 'Recap',
      title: 'Symptom to fix',
      tag: 'recap',
      body: [
        '- **Slow LCP:** put it in HTML, preload with high priority, right format and size, cut blocking resources.',
        '- **High TTFB:** CDN, caching, streaming, fewer redirects.',
        '- **Poor INP:** split long tasks, narrow re-renders, worker, drop third-party work.',
        '- **High CLS:** reserve space, fix font metrics, avoid late inserts.',
        '- **Budgets:** metric, size, count and timing, enforced in CI and RUM.',
      ],
      keyIdea: 'Performance is a gate, not a wish: a budget fails the pull request on regression.',
      frames: [{ state: LCP_BANDS }],
    },
  ],
});
