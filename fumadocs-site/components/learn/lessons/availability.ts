import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';

/*
 * Availability math is computed here (series: product, parallel: 1 - product of failure odds),
 * so the numbers on screen are the formulas from the notes, not typed in by hand.
 */

const pct = (a: number, digits = 1) => `${(a * 100).toFixed(digits)}%`;
const series = (a: number, n: number) => a ** n;
const parallel = (a: number, n: number) => 1 - (1 - a) ** n;

const hops = (ids: string[], start = 0, dur = 0.55, tone: Packet['tone'] = 'req'): Packet[] =>
  ids.slice(1).map((to, i) => ({ from: ids[i], to, delay: start + i * dur, dur, tone }));

// Step 1: a fault in one component becomes a failure of the whole system.
const CHAIN: FlowNode[] = [
  { id: 'client', label: 'Client', kind: 'client', x: 0, y: 1.6 },
  { id: 'web', label: 'Web', kind: 'service', x: 1.8, y: 1.6 },
  { id: 'api', label: 'API', kind: 'service', x: 3.6, y: 1.6 },
  { id: 'db', label: 'Database', sub: 'only one', kind: 'db', x: 5.4, y: 1.6 },
];
const chainLinks = CHAIN.slice(1).map((n, i) => ({ from: CHAIN[i].id, to: n.id }));
const fault = (down: boolean): FlowState => ({
  nodes: down ? patch(CHAIN, { db: { status: 'down', badge: { text: 'fault', tone: 'bad' } }, client: { badge: { text: 'failure', tone: 'bad' } } }) : CHAIN,
  links: down ? chainLinks.map((l) => (l.to === 'db' ? { ...l, dashed: true, tone: 'bad' as const } : l)) : chainLinks,
  packets: down ? [...hops(['client', 'web', 'api', 'db'], 0, 0.55), { from: 'api', to: 'client', tone: 'bad', delay: 1.8, dur: 0.9, label: 'error' }] : hops(['client', 'web', 'api', 'db']),
  stats: down
    ? [
        { label: 'Fault', value: 'one DB', tone: 'bad' },
        { label: 'Failure', value: 'whole site', tone: 'bad' },
        { label: 'Fault tolerant', value: 'no', tone: 'bad' },
      ]
    : [
        { label: 'Components', value: '4' },
        { label: 'All must work', value: 'yes' },
        { label: 'Status', value: 'serving', tone: 'ok' },
      ],
  note: down ? { text: 'a fault in one part became a failure of the whole', tone: 'bad' } : undefined,
});

// Step 2: the nines.
const NINES = [
  { a: '99%', year: '3.65 days', month: '7.3 h', day: '14.4 min', min: 5256 },
  { a: '99.9%', year: '8.76 hours', month: '43.8 min', day: '1.44 min', min: 525.6 },
  { a: '99.99%', year: '52.6 min', month: '4.4 min', day: '8.6 s', min: 52.6 },
  { a: '99.999%', year: '5.26 min', month: '26 s', day: '0.86 s', min: 5.26 },
];
const ninesFrame = (shown: number): FlowState => ({
  nodes: NINES.slice(0, shown).map((n, i) => {
    const v = Math.log10(n.min / 5.26) / 3;
    return {
      id: `n${i}`,
      label: n.a,
      sub: `${n.year} / year`,
      kind: 'monitor' as const,
      x: 0.3 + i * 1.6,
      y: 1.8,
      status: i === shown - 1 ? ('active' as const) : ('normal' as const),
      badge: { text: `${n.month} / month`, tone: i < 2 ? ('bad' as const) : ('ok' as const) },
      meter: { value: Math.max(0.04, v), label: 'downtime', tone: v > 0.5 ? ('bad' as const) : v > 0.2 ? ('accent' as const) : ('ok' as const) },
    };
  }),
  stats: [
    { label: 'Availability', value: NINES[shown - 1].a },
    { label: 'Down per year', value: NINES[shown - 1].year, tone: shown > 2 ? 'ok' : 'bad' },
    { label: 'Down per day', value: NINES[shown - 1].day },
  ],
  note: shown === 4 ? { text: 'each extra nine costs about 10x more effort', tone: 'accent' } : undefined,
});

// Step 3: components in series multiply.
const SER: FlowNode[] = [
  { id: 'client', label: 'Client', kind: 'client', x: 0, y: 1.6 },
  { id: 'a', label: 'Service A', sub: '99.9%', kind: 'service', x: 1.6, y: 1.6 },
  { id: 'b', label: 'Service B', sub: '99.9%', kind: 'service', x: 3.2, y: 1.6 },
  { id: 'c', label: 'Service C', sub: '99.9%', kind: 'service', x: 4.8, y: 1.6 },
];
const serLinks = SER.slice(1).map((n, i) => ({ from: SER[i].id, to: n.id }));
const seriesFrame = (phase: 0 | 1 | 2): FlowState => ({
  nodes: phase === 0 ? SER : patch(SER, { c: { badge: { text: `total ${pct(series(0.999, 3))}`, tone: 'bad' } } }),
  links: serLinks,
  packets: hops(['client', 'a', 'b', 'c']),
  stats:
    phase < 2
      ? [
          { label: 'Each', value: '99.9%' },
          { label: 'Chain', value: '3 services' },
          { label: 'Total', value: phase === 0 ? '?' : pct(series(0.999, 3)), tone: phase === 0 ? 'neutral' : 'bad', hint: '0.999^3' },
        ]
      : [
          { label: 'Each', value: '99.9%' },
          { label: 'Chain', value: '10 services' },
          { label: 'Total', value: pct(series(0.999, 10)), tone: 'bad', hint: '0.999^10' },
        ],
  note: phase === 0 ? { text: 'all must work: A_total = A1 x A2 x A3' } : phase === 2 ? { text: 'long synchronous chains lower availability', tone: 'bad' } : undefined,
});

// Steps 4 and 5: replicas in parallel, then where they live.
const CLIENT: FlowNode = { id: 'client', label: 'Client', kind: 'client', x: 0, y: 1.6 };
const LB: FlowNode = { id: 'lb', label: 'Load balancer', kind: 'lb', x: 1.8, y: 1.6 };
const R1: FlowNode = { id: 'r1', label: 'Replica 1', sub: '99.9%', kind: 'service', x: 3.6, y: 0.8 };
const R2: FlowNode = { id: 'r2', label: 'Replica 2', sub: '99.9%', kind: 'service', x: 3.6, y: 2.4 };
const parLinks = (r1Down: boolean, r2Down = false) => [
  { from: 'client', to: 'lb' },
  { from: 'lb', to: 'r1', dashed: r1Down, tone: r1Down ? ('bad' as const) : undefined },
  { from: 'lb', to: 'r2', dashed: r2Down, tone: r2Down ? ('bad' as const) : undefined },
];
const parallelFrame = (r1Down: boolean): FlowState => ({
  nodes: [CLIENT, LB, r1Down ? { ...R1, status: 'down', badge: { text: 'failed', tone: 'bad' } } : R1, R2],
  links: parLinks(r1Down),
  packets: r1Down
    ? [...hops(['client', 'lb', 'r2']), ...hops(['client', 'lb', 'r2'], 0.5)]
    : [...hops(['client', 'lb', 'r1']), ...hops(['client', 'lb', 'r2'], 0.5)],
  stats: [
    { label: 'Each replica', value: '99.9%' },
    { label: 'Any one enough', value: 'yes', tone: 'ok' },
    { label: 'Total', value: pct(parallel(0.999, 2), 4), tone: 'ok', hint: '1 - 0.001^2' },
  ],
  note: r1Down ? { text: 'one replica fails, the other keeps serving', tone: 'ok' } : { text: 'parallel: A_total = 1 - (1 - A)^n' },
});

const fateFrame = (phase: 'same' | 'same-down' | 'spread' | 'spread-down'): FlowState => {
  const spread = phase.startsWith('spread');
  const down = phase.endsWith('down');
  const r2: FlowNode = spread ? { ...R2, x: 5.2 } : R2;
  return {
    nodes: [
      CLIENT,
      down && spread ? { ...LB, badge: { text: 'new ceiling', tone: 'accent' } } : LB,
      down ? { ...R1, status: 'down' } : R1,
      down && !spread ? { ...r2, status: 'down' } : r2,
    ],
    links: parLinks(down, down && !spread),
    groups: spread
      ? [
          { label: 'zone a', nodes: ['r1'], tone: down ? 'bad' : undefined },
          { label: 'zone b', nodes: ['r2'], tone: down ? 'accent' : undefined },
        ]
      : [{ label: 'zone a', nodes: ['r1', 'r2'], tone: down ? 'bad' : undefined }],
    packets: down ? (spread ? hops(['client', 'lb', 'r2']) : [{ from: 'client', to: 'lb', dur: 0.55 }, { from: 'lb', to: 'client', delay: 0.7, dur: 0.6, tone: 'bad', label: 'error' }]) : [...hops(['client', 'lb', 'r1']), ...hops(['client', 'lb', 'r2'], 0.5)],
    stats: [
      { label: 'Replicas', value: '2' },
      { label: 'Zones', value: spread ? '2' : '1' },
      { label: 'Zone outage', value: down ? (spread ? 'survived' : 'site down') : '-', tone: down ? (spread ? 'ok' : 'bad') : 'neutral' },
    ],
    note:
      phase === 'same-down'
        ? { text: 'same zone, shared fate: both replicas die together', tone: 'bad' }
        : phase === 'spread-down'
          ? { text: 'independent failures, and the LB is now the ceiling', tone: 'accent' }
          : undefined,
  };
};

// Step 6: SLI, SLO, SLA and the error budget.
const SLO_NODES: FlowNode[] = [
  { id: 'client', label: 'Users', kind: 'client', x: 0, y: 1.6 },
  { id: 'svc', label: 'Service', kind: 'service', x: 2.2, y: 1.6 },
  { id: 'mon', label: 'SLO monitor', sub: '99.9% / 30 days', kind: 'monitor', x: 4.6, y: 1.6 },
];
const sloFrame = (phase: 'good' | 'burn'): FlowState => ({
  nodes: patch(SLO_NODES, {
    mon: { meter: { value: phase === 'good' ? 0.85 : 0.2, label: phase === 'good' ? 'budget left' : 'budget low', tone: phase === 'good' ? 'ok' : 'bad' } },
    svc: phase === 'burn' ? { status: 'hot', badge: { text: 'bad release', tone: 'bad' } } : {},
  }),
  links: [
    { from: 'client', to: 'svc' },
    { from: 'svc', to: 'mon', dashed: true, label: 'SLI' },
  ],
  packets: [0, 1, 2, 3].map((i) => {
    const bad = phase === 'burn' && i % 2 === 1;
    return { from: 'client', to: 'svc', delay: i * 0.3, dur: 0.6, tone: bad ? ('bad' as const) : ('req' as const) };
  }),
  stats: [
    { label: 'SLI', value: 'fast, no 5xx', hint: 'share under 300 ms, non-5xx' },
    { label: 'SLO', value: '99.9%', hint: 'internal target' },
    { label: 'SLA', value: '99.5%', hint: 'contract, credits' },
  ],
  note: phase === 'good' ? { text: 'error budget = 100% - SLO = 0.1% may fail', tone: 'ok' } : { text: 'budget burning: spend it on releases, not on outages', tone: 'bad' },
});

const RECAP: FlowState = {
  nodes: [CLIENT, LB, R1, { ...R2, x: 5.2 }],
  links: parLinks(false),
  groups: [
    { label: 'zone a', nodes: ['r1'] },
    { label: 'zone b', nodes: ['r2'] },
  ],
  packets: [...hops(['client', 'lb', 'r1']), ...hops(['client', 'lb', 'r2'], 0.4)],
  stats: [
    { label: 'Series', value: 'multiply' },
    { label: 'Parallel', value: '1 - (1-A)^n' },
    { label: 'Pattern', value: 'active-active' },
  ],
};

export default defineLesson('flow', {
  slug: 'availability',
  objectives: [
    { text: 'Tell a fault from a failure', step: 1 },
    { text: 'Translate nines into downtime', step: 2 },
    { text: 'Compute availability for series and parallel components', step: 4 },
    { text: 'Spot shared fate that breaks redundancy', step: 5 },
    { text: 'Use SLIs, SLOs, SLAs and error budgets', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'One fault takes the site down',
      tag: 'problem',
      body: [
        'A **fault** is one component deviating from spec. A **failure** is the whole system no longer meeting its spec.',
        'With a single database on the path, one fault becomes a failure. **Fault tolerance** means faults do not become failures.',
      ],
      keyIdea: 'Availability is the fraction of time the system is up and serving. Reliability is doing the correct thing.',
      frames: [
        { state: fault(false), hold: 1800 },
        { state: fault(true) },
      ],
    },
    {
      label: 'The nines',
      title: 'Nines as downtime',
      tag: 'concept',
      body: [
        '99.9% sounds high, but it allows **8.76 hours** of downtime a year. 99.99% allows 52.6 minutes, 99.999% just 5.26 minutes.',
        'Ask what the business needs. An internal report tool does not need five nines.',
      ],
      keyIdea: 'Every extra nine costs roughly an order of magnitude more effort.',
      frames: [1, 2, 3, 4].map((k) => ({ state: ninesFrame(k), hold: 1500 })),
    },
    {
      label: 'Series',
      title: 'Chains multiply',
      tag: 'technique',
      body: [
        'When every component must work, multiply: three services at 99.9% each give 0.999^3, about **99.7%**.',
        'Ten services in a synchronous chain give about **99.0%**.',
      ],
      keyIdea: 'Each synchronous dependency you add lowers availability.',
      frames: [
        { state: seriesFrame(0), hold: 1800 },
        { state: seriesFrame(1), hold: 1800 },
        { state: seriesFrame(2) },
      ],
    },
    {
      label: 'Parallel',
      title: 'Redundancy adds nines',
      tag: 'technique',
      body: [
        'When any one copy is enough, availability is 1 - (1 - A)^n. Two replicas at 99.9% give 1 - 0.001^2 = **99.9999%**.',
        'If one replica fails, the balancer sends everything to the other.',
      ],
      keyIdea: 'Parallel redundancy turns three nines into six, as long as the failures are independent.',
      frames: [
        { state: parallelFrame(false), hold: 1800 },
        { state: parallelFrame(true) },
      ],
    },
    {
      label: 'Shared fate',
      title: 'Redundancy needs independent failures',
      tag: 'trade-off',
      body: [
        'Two replicas in one rack, zone or region **share fate**. One zone outage kills both.',
        'Spread them across availability zones. Then the load balancer, DNS or any shared dependency becomes the new ceiling.',
      ],
      keyIdea: 'Multi-AZ protects against a datacenter loss, not a regional one. That needs multi-region.',
      frames: [
        { state: fateFrame('same'), hold: 1300 },
        { state: fateFrame('same-down'), hold: 2000 },
        { state: fateFrame('spread'), hold: 1300 },
        { state: fateFrame('spread-down') },
      ],
    },
    {
      label: 'SLOs',
      title: 'SLI, SLO, SLA and the error budget',
      tag: 'in practice',
      body: [
        'An **SLI** is a measured signal, like requests under 300 ms and non-5xx. An **SLO** is the internal target, say 99.9% over 30 days. An **SLA** is a contract with penalties, often looser, like 99.5%.',
        'The **error budget** is 100% minus the SLO.',
      ],
      keyIdea: 'With a 99.9% SLO, 0.1% of requests may fail. Spend that budget on releases.',
      frames: [
        { state: sloFrame('good'), hold: 2200 },
        { state: sloFrame('burn') },
      ],
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Nines:** 99.9% is 8.76 hours a year, 99.99% is 52.6 minutes.',
        '- **Series:** multiply, so long sync chains hurt.',
        '- **Parallel:** 1 - (1 - A)^n, only if failures are independent.',
        '- **Patterns:** active-passive, active-active, N+1, multi-AZ, multi-region.',
        '- **Targets:** SLI measures, SLO targets, SLA contracts, error budget is the slack.',
      ],
      keyIdea: 'Add redundancy where failures are independent, and keep synchronous chains short.',
      frames: [{ state: RECAP }],
    },
  ],
});
