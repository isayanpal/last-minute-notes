import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';
import type { Frame } from '../types';

/*
 * Every number on screen is computed here: percentiles come from a seeded sample of 1,000 latencies,
 * fan-out odds from 1 - 0.99^n, and in-flight counts by actually counting overlapping bars.
 */

/** Small seeded PRNG so the sample (and the lesson) is identical on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** 1,000 request latencies in ms: most around 40 to 80, a long slow tail. */
const SAMPLE: number[] = (() => {
  const r = rng(7);
  const out: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const base = 40 + r() * 40;
    const u = r();
    // 5% of requests hit something slow: GC, a cold cache, a busy disk.
    out.push(Math.round(u < 0.05 ? base + 150 + r() * r() * 900 : base));
  }
  return out;
})();
const SORTED = [...SAMPLE].sort((a, b) => a - b);
const pct = (p: number) => SORTED[Math.min(SORTED.length - 1, Math.ceil((p / 100) * SORTED.length) - 1)];
const AVG = Math.round(SAMPLE.reduce((a, b) => a + b, 0) / SAMPLE.length);
const P = { p50: pct(50), p95: pct(95), p99: pct(99), p999: pct(99.9) };
const MAX_MS = Math.ceil(P.p999 / 100) * 100;

// Step 1: eight requests, one slow. The average lands where no request is.
const EIGHT = [SORTED[100], SORTED[250], SORTED[400], SORTED[500], SORTED[600], SORTED[750], SORTED[900], SORTED[995]];
const EIGHT_AVG = Math.round(EIGHT.reduce((a, b) => a + b, 0) / EIGHT.length);
const EIGHT_MAX = Math.ceil(EIGHT[7] / 100) * 100;

const eightLanes = (shown: number): TimelineState['lanes'] =>
  EIGHT.map((ms, i) => ({
    label: `req ${i + 1}`,
    bars:
      i < shown
        ? [{ id: `r${i}`, from: 0, to: ms, label: `${ms} ms`, tone: ms > 150 ? ('bad' as const) : ('info' as const), state: ms > 150 ? ('bad' as const) : ('normal' as const) }]
        : [],
  }));

const averageFrames: Frame<TimelineState>[] = [
  {
    hold: 1800,
    state: {
      from: 0,
      to: EIGHT_MAX,
      unit: 'ms',
      lanes: eightLanes(8),
      stats: [
        { label: 'Requests', value: '8' },
        { label: 'Typical', value: `~${EIGHT[3]} ms` },
        { label: 'Slowest', value: `${EIGHT[7]} ms`, tone: 'bad' },
      ],
    },
  },
  {
    state: {
      from: 0,
      to: EIGHT_MAX,
      unit: 'ms',
      lanes: eightLanes(8),
      markers: [{ at: EIGHT_AVG, label: `avg ${EIGHT_AVG}`, tone: 'accent' }],
      stats: [
        { label: 'Average', value: `${EIGHT_AVG} ms`, tone: 'bad' },
        { label: 'Requests near it', value: '0', tone: 'bad' },
        { label: 'Slowest', value: `${EIGHT[7]} ms`, tone: 'bad' },
      ],
      note: { text: 'the average describes no real request', tone: 'bad' },
    },
  },
];

// Step 2: percentiles of the 1,000 sample.
const PCT_ROWS: { key: keyof typeof P; label: string; meaning: string }[] = [
  { key: 'p50', label: 'p50', meaning: 'half faster' },
  { key: 'p95', label: 'p95', meaning: '1 in 20 slower' },
  { key: 'p99', label: 'p99', meaning: '1 in 100 slower' },
  { key: 'p999', label: 'p99.9', meaning: '1 in 1000 slower' },
];
const pctLanes = (shown: number, withAvg: boolean): TimelineState['lanes'] => [
  ...(withAvg ? [{ label: 'average', bars: [{ id: 'avg', from: 0, to: AVG, label: `${AVG} ms`, tone: 'neutral' as const }] }] : []),
  ...PCT_ROWS.map((row, i) => ({
    label: row.label,
    bars:
      i < shown
        ? [{ id: row.key, from: 0, to: P[row.key], label: `${P[row.key]} ms`, tone: (i === 0 ? 'ok' : i === 1 ? 'info' : 'bad') as TimelineBar['tone'], state: (i === shown - 1 ? 'active' : 'normal') as TimelineBar['state'] }]
        : [],
  })),
];
const percentileFrames: Frame<TimelineState>[] = PCT_ROWS.map((row, i) => ({
  hold: 1500,
  state: {
    from: 0,
    to: MAX_MS,
    unit: 'ms',
    lanes: pctLanes(i + 1, false),
    stats: [
      { label: 'Sample', value: '1,000 reqs' },
      { label: row.label, value: `${P[row.key]} ms`, tone: i < 2 ? 'ok' : 'bad' },
      { label: 'Means', value: row.meaning },
    ],
  },
}));
percentileFrames.push({
  state: {
    from: 0,
    to: MAX_MS,
    unit: 'ms',
    lanes: pctLanes(4, true),
    stats: [
      { label: 'Average', value: `${AVG} ms` },
      { label: 'p99', value: `${P.p99} ms`, tone: 'bad' },
      { label: 'Tail / avg', value: `${(P.p99 / AVG).toFixed(1)}x`, tone: 'bad' },
    ],
    note: { text: 'the average hides the tail: track p95 and p99', tone: 'accent' },
  },
});

// Step 3: a page waits for its slowest call. Then the odds as fan-out grows.
const CALLS = [SORTED[200], SORTED[450], SORTED[700], SORTED[985], SORTED[300]];
const PAGE = Math.max(...CALLS);
const fanoutLanes = (withPage: boolean): TimelineState['lanes'] => [
  ...CALLS.map((ms, i) => ({
    label: `call ${i + 1}`,
    bars: [{ id: `c${i}`, from: 0, to: ms, label: `${ms} ms`, tone: ms > 150 ? ('bad' as const) : ('info' as const), state: ms > 150 ? ('bad' as const) : ('normal' as const) }],
  })),
  { label: 'page', bars: withPage ? [{ id: 'page', from: 0, to: PAGE, label: `page ${PAGE} ms`, tone: 'accent' as const, state: 'active' as const }] : [] },
];
const FAN = [1, 10, 50, 100];
const odds = (n: number) => 1 - 0.99 ** n;
const oddsLanes = (shown: number): TimelineState['lanes'] =>
  FAN.map((n, i) => ({
    label: `${n} call${n > 1 ? 's' : ''}`,
    bars: i < shown ? [{ id: `f${n}`, from: 0, to: odds(n) * 100, label: `${(odds(n) * 100).toFixed(odds(n) < 0.1 ? 1 : 0)}%`, tone: (odds(n) > 0.5 ? 'bad' : 'data') as TimelineBar['tone'] }] : [],
  }));
const fanoutFrames: Frame<TimelineState>[] = [
  {
    hold: 1400,
    state: { from: 0, to: Math.ceil(PAGE / 100) * 100, unit: 'ms', lanes: fanoutLanes(false), stats: [{ label: 'Backend calls', value: '5' }, { label: 'Slow ones', value: '1', tone: 'bad' }, { label: 'Page time', value: '?' }] },
  },
  {
    hold: 2000,
    state: {
      from: 0,
      to: Math.ceil(PAGE / 100) * 100,
      unit: 'ms',
      lanes: fanoutLanes(true),
      markers: [{ at: PAGE, label: 'page done', tone: 'bad' }],
      stats: [{ label: 'Backend calls', value: '5' }, { label: 'Slow ones', value: '1', tone: 'bad' }, { label: 'Page time', value: `${PAGE} ms`, tone: 'bad' }],
      note: { text: 'the page is as slow as its slowest call', tone: 'bad' },
    },
  },
  ...[1, 2, 3, 4].map((k) => ({
    hold: k === 4 ? undefined : 1100,
    state: {
      from: 0,
      to: 100,
      unit: '%',
      ticks: [0, 25, 50, 75, 100],
      lanes: oddsLanes(k),
      stats: [
        { label: 'Each call slow', value: '1%' },
        { label: 'Calls', value: String(FAN[k - 1]) },
        { label: 'P(any slow)', value: `${(odds(FAN[k - 1]) * 100).toFixed(0)}%`, tone: odds(FAN[k - 1]) > 0.5 ? ('bad' as const) : ('neutral' as const) },
      ],
      note: k === 4 ? { text: '1 - 0.99^100 = about 63%', tone: 'bad' as const } : undefined,
    } satisfies TimelineState,
  })),
];

// Step 4: hedged request. Send a second copy after the p95 time, take whichever returns first.
const SLOW = SORTED[992];
const HEDGE_FAST = SORTED[420];
const HEDGE_AT = P.p95;
const hedgeEnd = HEDGE_AT + HEDGE_FAST;
const HEDGE_MAX = Math.ceil(SLOW / 100) * 100;
const hedgeFrames: Frame<TimelineState>[] = [
  {
    hold: 1700,
    state: {
      from: 0,
      to: HEDGE_MAX,
      unit: 'ms',
      lanes: [
        { label: 'try 1', bars: [{ id: 'a', from: 0, to: SLOW, label: `stuck ${SLOW} ms`, state: 'bad' }] },
        { label: 'try 2', bars: [] },
      ],
      markers: [{ at: HEDGE_AT, label: `p95 ${HEDGE_AT}`, tone: 'accent' }],
      stats: [{ label: 'Without hedge', value: `${SLOW} ms`, tone: 'bad' }, { label: 'Wait until', value: `p95, ${HEDGE_AT}` }, { label: 'Then', value: 'send again' }],
    },
  },
  {
    hold: 1700,
    state: {
      from: 0,
      to: HEDGE_MAX,
      unit: 'ms',
      lanes: [
        { label: 'try 1', bars: [{ id: 'a', from: 0, to: SLOW, label: `stuck ${SLOW} ms`, state: 'bad' }] },
        { label: 'try 2', bars: [{ id: 'b', from: HEDGE_AT, to: hedgeEnd, label: 'hedge', tone: 'ok', state: 'active' }] },
      ],
      markers: [{ at: HEDGE_AT, label: `p95 ${HEDGE_AT}`, tone: 'accent' }],
      stats: [{ label: 'Without hedge', value: `${SLOW} ms`, tone: 'bad' }, { label: 'Second copy', value: `+${HEDGE_FAST} ms` }, { label: 'Extra load', value: '~5%', hint: 'only past p95' }],
    },
  },
  {
    state: {
      from: 0,
      to: HEDGE_MAX,
      unit: 'ms',
      lanes: [
        { label: 'try 1', bars: [{ id: 'a', from: 0, to: hedgeEnd, label: 'cancelled', state: 'dim' }] },
        { label: 'try 2', bars: [{ id: 'b', from: HEDGE_AT, to: hedgeEnd, label: 'hedge', tone: 'ok', state: 'active' }] },
      ],
      markers: [{ at: hedgeEnd, label: `done ${hedgeEnd}`, tone: 'ok' }],
      stats: [{ label: 'Without hedge', value: `${SLOW} ms`, tone: 'bad' }, { label: 'With hedge', value: `${hedgeEnd} ms`, tone: 'ok' }, { label: 'Use', value: 'first reply' }],
      note: { text: 'first response wins, the slow one is dropped', tone: 'ok' },
    },
  },
];

// Step 5: Little's law. Count overlapping requests at a moment, for real.
const ARRIVE_EVERY = 50;
const littleLanes = (w: number): TimelineState['lanes'] =>
  Array.from({ length: 8 }, (_, i) => ({
    label: `req ${i + 1}`,
    bars: [{ id: `l${i}`, from: i * ARRIVE_EVERY, to: i * ARRIVE_EVERY + w, tone: (w > 200 ? 'bad' : 'info') as TimelineBar['tone'], state: (w > 200 ? 'bad' : 'normal') as TimelineBar['state'] }],
  }));
const inFlight = (w: number, at: number) => Array.from({ length: 8 }, (_, i) => i * ARRIVE_EVERY).filter((s) => s <= at && at < s + w).length;
const LOOK_AT = 375;
const littleFrame = (w: number): Frame<TimelineState> => {
  const rate = 1000 / ARRIVE_EVERY;
  const counted = inFlight(w, LOOK_AT);
  return {
    hold: 2600,
    state: {
      from: 0,
      to: 800,
      unit: 'ms',
      lanes: littleLanes(w),
      markers: [{ at: LOOK_AT, label: `${counted} in flight`, tone: w > 200 ? 'bad' : 'accent' }],
      stats: [
        { label: 'lambda', value: `${rate} / s` },
        { label: 'W', value: `${w} ms`, tone: w > 200 ? 'bad' : 'neutral' },
        { label: 'L = lambda x W', value: String((rate * w) / 1000), tone: w > 200 ? 'bad' : 'ok' },
      ],
      note: w > 200 ? { text: 'W doubled during an incident, so L doubled too', tone: 'bad' } : { text: 'requests in the system = rate x time each spends' },
    },
  };
};

// Step 6: throughput vs latency with batching.
const BATCH_WAIT = 60;
const ONE = 50;
const BATCH_WORK = 80;
const batchFrames: Frame<TimelineState>[] = [
  {
    hold: 2200,
    state: {
      from: 0,
      to: 250,
      unit: 'ms',
      lanes: [0, 1, 2, 3].map((i) => ({ label: `one by one ${i + 1}`, bars: [{ id: `s${i}`, from: i * ONE, to: (i + 1) * ONE, label: `${ONE} ms`, tone: 'info' as const }] })),
      stats: [{ label: 'Latency each', value: `${ONE} ms` }, { label: 'Done after', value: `${4 * ONE} ms` }, { label: 'Throughput', value: `${4000 / (4 * ONE)} / s` }],
    },
  },
  {
    state: {
      from: 0,
      to: 250,
      unit: 'ms',
      lanes: [
        { label: 'collect batch', bars: [{ id: 'w', from: 0, to: BATCH_WAIT, label: 'wait', tone: 'neutral' }] },
        { label: 'batch of 4', bars: [{ id: 'b', from: BATCH_WAIT, to: BATCH_WAIT + BATCH_WORK, label: 'all 4 at once', tone: 'ok', state: 'active' }] },
      ],
      markers: [{ at: BATCH_WAIT + BATCH_WORK, label: `all done ${BATCH_WAIT + BATCH_WORK}`, tone: 'ok' }],
      stats: [
        { label: 'Latency each', value: `${BATCH_WAIT + BATCH_WORK} ms`, tone: 'bad' },
        { label: 'Done after', value: `${BATCH_WAIT + BATCH_WORK} ms`, tone: 'ok' },
        { label: 'Throughput', value: `${Math.round(4000 / (BATCH_WAIT + BATCH_WORK))} / s`, tone: 'ok' },
      ],
      note: { text: 'batching: more per second, each one waits longer', tone: 'accent' },
    },
  },
];

const RECAP: TimelineState = {
  from: 0,
  to: MAX_MS,
  unit: 'ms',
  lanes: pctLanes(4, true),
  markers: [{ at: P.p99, label: 'watch p99', tone: 'bad' }],
  stats: [
    { label: 'Report', value: 'p50, p95, p99' },
    { label: 'Fan-out', value: 'amplifies tail', tone: 'bad' },
    { label: 'L', value: 'lambda x W' },
  ],
};

export default defineLesson('timeline', {
  slug: 'latency-percentiles',
  objectives: [
    { text: 'Why averages hide what users feel', step: 1 },
    { text: 'Read p50, p95, p99 and p99.9', step: 2 },
    { text: 'Explain how fan-out amplifies the tail', step: 3 },
    { text: 'Size in-flight work with Little’s law', step: 5 },
    { text: 'Tell latency and throughput apart', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'The average lies',
      tag: 'problem',
      body: [
        'Eight requests: seven take well under 100 ms, one takes far longer.',
        'The **average** lands somewhere no request actually was. It hides the slow tail, and users experience the tail.',
      ],
      keyIdea: 'Never report latency as an average alone. Use percentiles.',
      frames: averageFrames,
    },
    {
      label: 'Percentiles',
      title: 'p50, p95, p99, p99.9',
      tag: 'concept',
      body: [
        'Sort all latencies. **p50** is the median: half are faster. **p95** means 1 in 20 is slower, **p99** 1 in 100, **p99.9** 1 in 1000.',
        'These bars come from a sample of 1,000 requests.',
      ],
      keyIdea: 'The higher percentiles are where users get frustrated. Set targets on p95 and p99, not on the mean.',
      frames: percentileFrames,
    },
    {
      label: 'Fan-out',
      title: 'The slowest call sets the pace',
      tag: 'concept',
      body: [
        'A page that calls several backends finishes only when the **slowest** one does.',
        'If each call has a 1% chance of being slow, a page with 100 calls has a 1 - 0.99^100, about **63%**, chance that at least one is slow.',
      ],
      keyIdea: 'Fan-out amplifies the tail. At scale, one backend’s p99 becomes the page’s typical case.',
      frames: fanoutFrames,
    },
    {
      label: 'Hedging',
      title: 'Hedge the slow request',
      tag: 'technique',
      body: [
        'A **hedged request** waits until the p95 time, then sends a second copy and uses whichever response comes first.',
        'Other mitigations: deadlines that propagate down the call chain, capping fan-out, caching, and load shedding with bulkheads.',
      ],
      keyIdea: 'Hedging only fires past p95, so it costs about 5% extra load and cuts the worst tail.',
      frames: hedgeFrames,
    },
    {
      label: 'Little’s law',
      title: 'How many requests are in flight?',
      tag: 'technique',
      body: [
        '**L = lambda x W**: requests in the system equal arrival rate times time each one spends there. 1,000 requests per second at 200 ms each means about 200 in flight.',
        'When W grows in an incident, L grows too. That is how overload spirals.',
      ],
      keyIdea: 'Size thread pools and connection pools with Little’s law, and expect them to fill when latency rises.',
      frames: [littleFrame(200), littleFrame(400)],
    },
    {
      label: 'Throughput',
      title: 'Latency is not throughput',
      tag: 'trade-off',
      body: [
        '**Latency** is how long one request takes. **Throughput** is how many requests per unit time the system completes.',
        'Batching raises throughput and often raises latency, because each request waits for the batch.',
      ],
      keyIdea: 'Say which one you are optimizing. A change can improve one and hurt the other.',
      frames: batchFrames,
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Percentiles, not averages:** the average hides the tail.',
        '- **p95 / p99:** 1 in 20 and 1 in 100 requests are slower.',
        '- **Fan-out:** 100 calls at 1% slow each gives about 63% slow pages.',
        '- **Mitigate:** deadlines, hedged requests, cap fan-out, cache, shed load.',
        '- **Little’s law:** L = lambda x W, so slower means more in flight.',
      ],
      keyIdea: 'Measure the tail, design for the tail, and remember latency and throughput are different goals.',
      frames: [{ state: RECAP }],
    },
  ],
});
