import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';
import type { Frame } from '../types';

/*
 * Every number on screen is computed here: the SLI from sample requests, the budget from the SLO,
 * burn-rate exhaustion times, and the multiwindow alert decision.
 */

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits).replace(/\.0+$/, '')}%`;

// Step 1: the dashboard looks fine, users do not.
const userView = (showUsers: boolean): TimelineState => ({
  from: 0,
  to: 60,
  unit: 'm',
  ticks: [0, 15, 30, 45, 60],
  lanes: [
    { label: 'CPU', bars: [{ id: 'cpu', from: 0, to: 60, label: 'CPU 40%: fine', tone: 'ok' }] },
    {
      label: 'User requests',
      bars: showUsers
        ? [
            { id: 'r1', from: 0, to: 20, label: 'ok', tone: 'ok' },
            { id: 'r2', from: 20, to: 38, label: '5xx errors', state: 'bad' },
            { id: 'r3', from: 38, to: 60, label: 'ok', tone: 'ok' },
          ]
        : [],
    },
  ],
  stats: [
    { label: 'Dashboard', value: 'green', tone: 'ok' },
    { label: 'Users', value: showUsers ? 'saw errors' : '?', tone: showUsers ? 'bad' : 'neutral' },
    { label: 'Target', value: 'not defined' },
  ],
  note: showUsers ? { text: 'measure from the user’s point of view, not CPU', tone: 'accent' } : undefined,
});

// Step 2: the notes' SLI, non-5xx in under 300 ms, measured over sample requests.
const THRESHOLD = 300;
const REQUESTS = [
  { ms: 120, status: 200 },
  { ms: 250, status: 200 },
  { ms: 410, status: 200 },
  { ms: 90, status: 503 },
  { ms: 180, status: 200 },
  { ms: 270, status: 200 },
];
function sliFrames(): Frame<TimelineState>[] {
  const frames: Frame<TimelineState>[] = [];
  for (let shown = 2; shown <= REQUESTS.length; shown += 2) {
    const reqs = REQUESTS.slice(0, shown);
    const good = reqs.filter((r) => r.status < 500 && r.ms < THRESHOLD).length;
    frames.push({
      hold: 1700,
      state: {
        from: 0,
        to: 500,
        unit: 'ms',
        ticks: [0, 100, 200, 300, 400, 500],
        lanes: REQUESTS.map((r, i) => {
          const bad = r.status >= 500 || r.ms >= THRESHOLD;
          const bars: TimelineBar[] =
            i < shown ? [{ id: `q${i}`, from: 0, to: r.ms, label: r.status >= 500 ? `${r.status}` : `${r.ms} ms`, tone: 'ok', state: bad ? 'bad' : 'normal' }] : [];
          return { label: `request ${i + 1}`, bars };
        }),
        markers: [{ at: THRESHOLD, label: '300 ms', tone: 'accent' }],
        stats: [
          { label: 'Good', value: `${good} / ${reqs.length}` },
          { label: 'SLI', value: pct(good / reqs.length), tone: good === reqs.length ? 'ok' : 'bad' },
          { label: 'Good means', value: 'non-5xx, <300ms' },
        ],
        note:
          shown === REQUESTS.length
            ? { text: 'SLI = good requests / total requests', tone: 'accent' }
            : shown === 4
              ? { text: 'slow counts as bad, and so does a fast 503', tone: 'bad' }
              : undefined,
      },
    });
  }
  return frames;
}

// Step 3: 99.9% over 30 days.
const WINDOW_MIN = 30 * 24 * 60;
const budgetMin = (slo: number) => WINDOW_MIN * (1 - slo);
const BUDGET = budgetMin(0.999);
const fmtMin = (m: number) => `${Number(m.toFixed(2))} min`;
const budgetFrame = (withFourNines: boolean): TimelineState => ({
  from: 0,
  to: 45,
  unit: 'm',
  ticks: [0, 15, 30, 45],
  lanes: [
    { label: 'SLO 99.9%', bars: [{ id: 'b3', from: 0, to: BUDGET, label: `budget ${fmtMin(BUDGET)}`, tone: 'info' }] },
    { label: 'SLO 99.99%', bars: withFourNines ? [{ id: 'b4', from: 0, to: budgetMin(0.9999), label: fmtMin(budgetMin(0.9999)), tone: 'violet' }] : [] },
  ],
  markers: [{ at: BUDGET, label: '43.2', tone: 'accent' }],
  stats: [
    { label: 'Window', value: `${WINDOW_MIN.toLocaleString('en-US')} min`, hint: '30 days' },
    { label: '1 - SLO', value: '0.1%' },
    { label: 'Budget', value: fmtMin(BUDGET), tone: 'ok', hint: 'of full outage' },
  ],
  note: withFourNines ? { text: 'every extra nine cuts the budget by 10x', tone: 'accent' } : { text: '30 days x 24 h x 60 min x 0.001', tone: 'neutral' },
});

// Step 4: spending the budget, and what the policy says at each level.
const INCIDENTS = [
  { label: 'bad deploy', min: 6 },
  { label: 'outage', min: 24 },
  { label: 'slow DB', min: 13.2 },
];
function policyFrames(): Frame<TimelineState>[] {
  const frames: Frame<TimelineState>[] = [];
  let spent = 0;
  const bars: TimelineBar[] = [];
  INCIDENTS.forEach((inc, i) => {
    bars.push({ id: `i${i}`, from: spent, to: spent + inc.min, label: inc.label, tone: 'data', state: i === INCIDENTS.length - 1 ? 'bad' : 'normal' });
    spent += inc.min;
    const left = Math.max(0, BUDGET - spent);
    const leftShare = left / BUDGET;
    const policy = leftShare > 0.5 ? 'ship features' : left > 0.001 ? 'slow releases' : 'freeze';
    frames.push({
      hold: 2000,
      state: {
        from: 0,
        to: BUDGET,
        unit: 'm',
        ticks: [0, 10, 20, 30, BUDGET],
        lanes: [
          { label: 'Spent', bars: [...bars] },
          { label: 'Left', bars: left > 0.001 ? [{ id: 'left', from: spent, to: BUDGET, label: pct(leftShare, 0), tone: leftShare > 0.5 ? 'ok' : 'accent' }] : [] },
        ],
        stats: [
          { label: 'Spent', value: fmtMin(spent) },
          { label: 'Budget left', value: pct(leftShare, 0), tone: leftShare > 0.5 ? 'ok' : 'bad' },
          { label: 'Policy', value: policy, tone: policy === 'ship features' ? 'ok' : 'bad' },
        ],
        note: {
          text:
            policy === 'ship features'
              ? 'budget left: ship features, run experiments'
              : policy === 'slow releases'
                ? 'burning fast: slow releases, do reliability work'
                : 'exhausted: freeze non-critical changes',
          tone: policy === 'freeze' ? 'bad' : 'accent',
        },
      },
    });
  });
  return frames;
}

// Step 5: burn rate is how many times faster than "exactly on budget" you are spending.
const RATES = [1, 6, 14.4];
function burnFrames(): Frame<TimelineState>[] {
  return RATES.map((_, k) => {
    const shown = RATES.slice(0, k + 1);
    const rate = RATES[k];
    const days = 30 / rate;
    return {
      hold: 1800,
      state: {
        from: 0,
        to: 30,
        unit: 'd',
        ticks: [0, 5, 10, 15, 20, 25, 30],
        lanes: RATES.map((r, i) => ({
          label: `burn ${r}x`,
          bars: i < shown.length ? [{ id: `burn${i}`, from: 0, to: 30 / r, label: `gone in ${Number((30 / r).toFixed(1))} d`, tone: r > 1 ? 'data' : 'info', state: r >= 14.4 ? 'bad' : 'normal' }] : [],
        })),
        stats: [
          { label: 'Burn rate', value: `${rate}x` },
          { label: 'Budget lasts', value: `${Number(days.toFixed(1))} days`, tone: rate > 1 ? 'bad' : 'ok' },
          { label: 'In 1 hour', value: pct(rate / (30 * 24)), hint: 'of the month budget' },
        ],
        note: k === RATES.length - 1 ? { text: '14.4x burns 2% of the budget every hour', tone: 'bad' } : undefined,
      },
    };
  });
}

// Step 6: the page-tier multiwindow alert, evaluated at three moments.
const INCIDENT = { from: 15, to: 60, rate: 20 };
const PAGE_AT = 14.4;
const burnIn = (from: number, to: number) => {
  const overlap = Math.max(0, Math.min(to, INCIDENT.to) - Math.max(from, INCIDENT.from));
  return (overlap / (to - from)) * INCIDENT.rate;
};
function alertFrame(now: number): TimelineState {
  const long = burnIn(now - 60, now);
  const short = burnIn(now - 5, now);
  const firing = long >= PAGE_AT && short >= PAGE_AT;
  const fixed = now > INCIDENT.to;
  return {
    from: 0,
    to: 90,
    unit: 'm',
    ticks: [0, 15, 30, 45, 60, 75, 90],
    lanes: [
      { label: 'errors', bars: [{ id: 'inc', from: INCIDENT.from, to: Math.min(now, INCIDENT.to), label: `${INCIDENT.rate}x burn`, tone: 'bad', state: 'bad' }] },
      { label: '1 h window', bars: [{ id: 'long', from: Math.max(0, now - 60), to: now, label: `${Number(long.toFixed(1))}x`, tone: long >= PAGE_AT ? 'data' : 'info', state: long >= PAGE_AT ? 'active' : 'normal' }] },
      { label: '5 m window', bars: [{ id: 'short', from: now - 5, to: now, label: `${Number(short.toFixed(1))}x`, tone: short >= PAGE_AT ? 'data' : 'info', state: short >= PAGE_AT ? 'active' : 'normal' }] },
    ],
    markers: [{ at: now, label: firing ? 'PAGE' : 'now', tone: firing ? 'bad' : 'accent' }],
    stats: [
      { label: '1 h burn', value: `${Number(long.toFixed(1))}x`, tone: long >= PAGE_AT ? 'bad' : 'ok' },
      { label: '5 m burn', value: `${Number(short.toFixed(1))}x`, tone: short >= PAGE_AT ? 'bad' : 'ok' },
      { label: 'Alert', value: firing ? 'paging' : fixed ? 'resolved' : 'quiet', tone: firing ? 'bad' : 'ok' },
    ],
    note: firing
      ? { text: 'both windows above 14.4x: page', tone: 'bad' }
      : fixed
        ? { text: 'fixed: the short window clears, so the page resets fast', tone: 'accent' }
        : { text: 'short window is hot, but the hour is not yet: no page', tone: 'neutral' },
  };
}

const RECAP: TimelineState = {
  from: 0,
  to: 72,
  unit: 'h',
  ticks: [0, 12, 24, 36, 48, 60, 72],
  lanes: [
    { label: 'Page 14.4x', bars: [{ id: 'p1', from: 0, to: 1, label: '1 h / 5 m: 2%', tone: 'bad' }] },
    { label: 'Page 6x', bars: [{ id: 'p2', from: 0, to: 6, label: '6 h / 30 m: 5%', tone: 'data' }] },
    { label: 'Ticket 1x', bars: [{ id: 'p3', from: 0, to: 72, label: '3 d / 6 h: 10%', tone: 'info' }] },
  ],
  stats: [
    { label: 'SLO', value: '99.9% / 30 d' },
    { label: 'Budget', value: fmtMin(BUDGET), tone: 'ok' },
    { label: 'Alert on', value: 'burn rate' },
  ],
};

export default defineLesson('timeline', {
  slug: 'slos',
  objectives: [
    { text: 'Define an SLI from the user’s point of view', step: 2 },
    { text: 'Turn an SLO into an error budget in minutes', step: 3 },
    { text: 'Use the budget policy to decide between features and reliability', step: 4 },
    { text: 'Alert on burn rate with a long and a short window', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Green dashboards, unhappy users',
      tag: 'problem',
      body: [
        'CPU sat at a calm 40% for the whole hour. Meanwhile users got 5xx errors for almost 20 minutes.',
        'Without a measured target, nobody can say how reliable is reliable enough, or whether this hour was acceptable.',
      ],
      keyIdea: 'Reliability needs a number measured where users feel it, plus a target for that number.',
      frames: [
        { state: userView(false), hold: 1600 },
        { state: userView(true) },
      ],
    },
    {
      label: 'SLI',
      title: 'SLI: the fraction of good requests',
      tag: 'concept',
      body: [
        'An **SLI** measures service behavior. The notes’ example: the fraction of requests that return **non-5xx in under 300 ms**.',
        'Measure it at the load balancer or client. Pipelines use freshness or correctness SLIs instead.',
      ],
      keyIdea: 'Request-based SLIs are good requests over total requests. Slow counts as bad.',
      frames: sliFrames(),
    },
    {
      label: 'SLO and budget',
      title: 'The SLO sets a budget for failure',
      tag: 'concept',
      body: [
        'An **SLO** is the target for an SLI over a window: 99.9% over 30 days. The **error budget** is 1 minus the SLO.',
        'That is 0.1% of requests, or about 43 minutes of full outage per month. An **SLA** is a separate contract with refunds.',
      ],
      keyIdea: '100% is the wrong target: it is unreachable and stops all change. Set SLOs from what users need.',
      frames: [
        { state: budgetFrame(false), hold: 2200 },
        { state: budgetFrame(true) },
      ],
    },
    {
      label: 'Budget policy',
      title: 'Spend the budget, then slow down',
      tag: 'technique',
      body: [
        'Incidents spend the budget. The **error budget policy** says what to do at each level.',
        'Budget left: ship features. Burning fast: slow releases and do reliability work. Exhausted: freeze non-critical changes.',
      ],
      keyIdea: 'The budget turns reliability into a shared, measurable currency between product and operations.',
      frames: policyFrames(),
    },
    {
      label: 'Burn rate',
      title: 'How fast is the budget going?',
      tag: 'concept',
      body: [
        'A **burn rate** of 1x spends the budget exactly over the 30 days. At 6x it is gone in 5 days.',
        'At **14.4x** it is gone in about 2 days, which is 2% of the budget every hour.',
      ],
      keyIdea: 'Alert on how fast the budget is being consumed, not on raw error spikes.',
      frames: burnFrames(),
    },
    {
      label: 'Two windows',
      title: 'Multiwindow burn-rate alerts',
      tag: 'technique',
      body: [
        'The page fires when **both** the 1 hour and the 5 minute windows burn above 14.4x. The long window filters blips.',
        'After the fix, the **short window** drops to zero within minutes, so the alert resets even though the hour still holds the incident.',
      ],
      keyIdea: 'Long window for confidence, short window for fast reset. Fast detection of big incidents, few false pages.',
      frames: [
        { state: alertFrame(30), hold: 2600 },
        { state: alertFrame(60), hold: 2600 },
        { state: alertFrame(66) },
      ],
    },
    {
      label: 'Recap',
      title: 'Three alert tiers for a 30-day SLO',
      tag: 'recap',
      body: [
        '- **SLI:** good requests over total, measured where users feel it.',
        '- **SLO:** the target, like 99.9% over 30 days. **SLA:** a contract with consequences.',
        '- **Error budget:** 1 minus the SLO, 43.2 minutes a month at 99.9%.',
        '- **Policy:** ship while budget is left, slow down when it burns, freeze when it is gone.',
        '- **Alerts:** page at 14.4x (1 h / 5 m) and 6x (6 h / 30 m), ticket at 1x (3 d / 6 h).',
      ],
      keyIdea: 'Big incidents page within minutes, chronic ones become tickets, and pages reset quickly once fixed.',
      frames: [{ state: RECAP }],
    },
  ],
});
