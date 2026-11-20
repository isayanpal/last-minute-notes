import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';
import type { Frame } from '../types';

/*
 * Layout: customers on the left, a thin router, then three identical cells stacked on the right.
 * The shuffle sharding steps compute every shard overlap from the assignments below.
 */

const hop = (from: string, to: string, label?: string, delay = 0, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

// Step 1: one shared fleet.
const SHARED: FlowNode[] = [
  { id: 'cA', label: 'Customer A', kind: 'client', x: 0, y: 0.4, size: 'sm' },
  { id: 'cB', label: 'Customer B', kind: 'client', x: 0, y: 1.6, size: 'sm' },
  { id: 'cC', label: 'Customer C', kind: 'client', x: 0, y: 2.8, size: 'sm' },
  { id: 'lb', label: 'Load balancer', kind: 'lb', x: 1.9, y: 1.6 },
  { id: 's1', label: 'Server', kind: 'service', x: 3.7, y: 0.5, size: 'sm' },
  { id: 's2', label: 'Server', kind: 'service', x: 3.7, y: 1.6, size: 'sm' },
  { id: 's3', label: 'Server', kind: 'service', x: 3.7, y: 2.7, size: 'sm' },
  { id: 'db', label: 'Database', sub: 'shared', kind: 'db', x: 5.4, y: 1.6 },
];
const shared = (broken: boolean): FlowState => ({
  nodes: patch(SHARED, broken ? { s1: { status: 'down' }, s2: { status: 'down' }, s3: { status: 'down' }, lb: { badge: { text: 'bad deploy, everywhere', tone: 'bad' } } } : {}),
  links: [
    ...['cA', 'cB', 'cC'].map((c) => ({ from: c, to: 'lb' })),
    ...['s1', 's2', 's3'].map((s) => ({ from: 'lb', to: s })),
    ...['s1', 's2', 's3'].map((s) => ({ from: s, to: 'db' })),
  ],
  packets: broken
    ? ['cA', 'cB', 'cC'].map((c, i) => hop(c, 'lb', 'error', i * 0.2, 'bad'))
    : [hop('cA', 'lb'), hop('lb', 's1', undefined, 0.6), hop('cB', 'lb', undefined, 0.3), hop('lb', 's2', undefined, 0.9), hop('cC', 'lb', undefined, 0.6), hop('lb', 's3', undefined, 1.2)],
  stats: [
    { label: 'Fleet', value: 'one, shared' },
    { label: 'Customers hit', value: broken ? '100%' : '-', tone: broken ? 'bad' : 'neutral' },
    { label: 'Blast radius', value: 'everyone', tone: 'bad' },
  ],
  note: broken ? { text: 'one bad change reaches every customer at once', tone: 'bad' } : undefined,
});

// Steps 2, 3 and 7: cells.
const CELL_ROWS = [0.2, 1.75, 3.3];
const CELL_NAMES = ['Cell 1', 'Cell 2', 'Cell N'];
const CELLS: FlowNode[] = [
  { id: 'cust', label: 'Customers', kind: 'client', x: 0, y: 1.75 },
  { id: 'rt', label: 'Router', sub: 'customer to cell', kind: 'gateway', x: 1.6, y: 1.75 },
  ...CELL_ROWS.flatMap((y, i): FlowNode[] => [
    { id: `app${i}`, label: CELL_NAMES[i], sub: 'full stack', kind: 'service', x: 3.4, y },
    { id: `db${i}`, label: 'Database', sub: '5% of users', kind: 'db', x: 4.9, y },
  ]),
];
const CELL_LINKS: FlowLink[] = [{ from: 'cust', to: 'rt' }, ...CELL_ROWS.flatMap((_, i) => [{ from: 'rt', to: `app${i}` }, { from: `app${i}`, to: `db${i}` }])];

const cells = (o: Partial<FlowState> & { changes?: Record<string, Partial<FlowNode>>; badTone?: number[] } = {}): FlowState => ({
  nodes: patch(CELLS, o.changes ?? {}),
  links: o.links ?? CELL_LINKS,
  groups: CELL_ROWS.map((_, i) => ({ label: CELL_NAMES[i].toLowerCase(), nodes: [`app${i}`, `db${i}`], tone: o.badTone?.includes(i) ? ('bad' as const) : undefined })),
  packets: o.packets,
  stats: o.stats,
  note: o.note,
});

const route = (cell: number, label: string, delay = 0): Packet[] => [hop('cust', 'rt', label, delay), hop('rt', `app${cell}`, label, delay + 0.6), hop(`app${cell}`, `db${cell}`, undefined, delay + 1.2, 'data')];

// Fail small: a staged rollout, one cell at a time, with a health gate.
const rollout = (stage: 0 | 1 | 2): FlowState =>
  cells({
    changes:
      stage === 0
        ? { rt: { badge: { text: 'deploy v2 to cell 1', tone: 'accent' } }, app0: { sub: 'v2', status: 'active' } }
        : stage === 1
          ? { app0: { sub: 'v2', status: 'down' }, db0: { badge: { text: 'cell 1 unhealthy', tone: 'bad' } }, rt: { badge: { text: 'health gate: stop', tone: 'bad' } } }
          : { app0: { sub: 'back on v1' }, db0: { badge: { text: 'rolled back', tone: 'accent' } } },
    badTone: stage === 1 ? [0] : [],
    packets: stage === 1 ? [...route(1, 'ok', 0), ...route(2, 'ok', 0.3)] : stage === 0 ? route(0, 'req', 0) : [...route(0, 'ok', 0), ...route(1, 'ok', 0.3)],
    stats: [
      { label: 'Cells hit', value: stage === 1 ? '1 of N' : '0', tone: stage === 1 ? 'bad' : 'ok' },
      { label: 'Users hit', value: stage === 1 ? '5%' : '0%', tone: stage === 1 ? 'bad' : 'ok' },
      { label: 'Rollout', value: stage === 2 ? 'halted' : 'cell by cell' },
    ],
    note:
      stage === 1
        ? { text: 'the gate fails, so cells 2..N never get the change', tone: 'accent' }
        : stage === 2
          ? { text: 'fail small: config and data files roll out the same way', tone: 'accent' }
          : undefined,
  });

// Steps 4 and 5: shuffle sharding, 2 of 8 workers per customer.
const WORKERS = 8;
const PICK = 2;
const SHARDS: Record<string, number[]> = { A: [1, 5], B: [5, 7], C: [2, 8] };
const CUSTOMERS = Object.keys(SHARDS);
const choose = (n: number, k: number): number => (k === 0 ? 1 : (n * choose(n - 1, k - 1)) / k);
const COMBOS = choose(WORKERS, PICK);

const WORKER_NODES: FlowNode[] = Array.from({ length: WORKERS }, (_, i) => ({
  id: `w${i + 1}`,
  label: `W${i + 1}`,
  kind: 'worker',
  x: 2.4 + (i % 4) * 1.15,
  y: i < 4 ? 0.9 : 2.5,
  size: 'sm',
}));
const CUST_NODES: FlowNode[] = CUSTOMERS.map((c, i) => ({ id: `k${c}`, label: `Customer ${c}`, kind: 'client', x: 0, y: 0.5 + i * 1.2, size: 'sm' }));

function shuffle(o: { show: string[]; poison?: boolean; packets?: Packet[]; note?: FlowState['note']; stats?: FlowState['stats'] }): FlowState {
  const dead = o.poison ? SHARDS.A : [];
  const changes: Record<string, Partial<FlowNode>> = {};
  for (const w of dead) changes[`w${w}`] = { status: 'down' };
  const shown = new Set(o.show.flatMap((c) => SHARDS[c]));
  for (let w = 1; w <= WORKERS; w++) if (!shown.has(w) && !dead.includes(w)) changes[`w${w}`] = { ...(changes[`w${w}`] ?? {}), status: 'dim' };
  const custChanges: Record<string, Partial<FlowNode>> = {};
  for (const c of CUSTOMERS) {
    if (!o.show.includes(c)) custChanges[`k${c}`] = { status: 'dim' };
    else custChanges[`k${c}`] = { badge: { text: SHARDS[c].map((w) => `W${w}`).join(' + '), tone: o.poison && c === 'A' ? 'bad' : 'accent' } };
  }
  return {
    nodes: [...patch(CUST_NODES, custChanges), ...patch(WORKER_NODES, changes)],
    links: o.show.flatMap((c) =>
      SHARDS[c].map((w) => ({ from: `k${c}`, to: `w${w}`, tone: o.poison && dead.includes(w) ? ('bad' as const) : undefined, dashed: o.poison && dead.includes(w) && c !== 'A' })),
    ),
    packets: o.packets,
    stats: o.stats,
    note: o.note,
  };
}

function assignFrames(): Frame<FlowState>[] {
  const frames: Frame<FlowState>[] = [];
  for (let i = 1; i <= CUSTOMERS.length; i++) {
    const show = CUSTOMERS.slice(0, i);
    const c = CUSTOMERS[i - 1];
    frames.push({
      hold: 1800,
      state: shuffle({
        show,
        packets: SHARDS[c].map((w, j) => hop(`k${c}`, `w${w}`, undefined, j * 0.25)),
        stats: [
          { label: 'Workers', value: String(WORKERS) },
          { label: 'Per customer', value: String(PICK) },
          { label: 'Possible pairs', value: String(COMBOS), hint: `${WORKERS} choose ${PICK}` },
        ],
        note: i === 2 ? { text: 'A and B share W5, but not the whole pair', tone: 'accent' } : undefined,
      }),
    });
  }
  return frames;
}

function poisonFrames(): Frame<FlowState>[] {
  const overlap = (a: string, b: string) => SHARDS[a].filter((w) => SHARDS[b].includes(w)).length;
  const survivors = CUSTOMERS.filter((c) => c !== 'A' && overlap('A', c) < PICK);
  return [
    {
      hold: 1800,
      state: shuffle({
        show: CUSTOMERS,
        packets: SHARDS.A.map((w, j) => hop('kA', `w${w}`, 'poison', j * 0.2, 'bad')),
        stats: [
          { label: 'Bad customer', value: 'A', tone: 'bad' },
          { label: 'Can reach', value: `${PICK} of ${WORKERS}` },
          { label: 'Others hurt', value: '-' },
        ],
        note: { text: 'customer A sends a poisonous request', tone: 'bad' },
      }),
    },
    {
      hold: 2000,
      state: shuffle({
        show: CUSTOMERS,
        poison: true,
        stats: [
          { label: 'Workers down', value: `${PICK} of ${WORKERS}`, tone: 'bad' },
          { label: 'B overlap', value: `${overlap('A', 'B')} of ${PICK}` },
          { label: 'C overlap', value: `${overlap('A', 'C')} of ${PICK}`, tone: 'ok' },
        ],
        note: { text: 'only the workers in A’s shard go down', tone: 'bad' },
      }),
    },
    {
      state: shuffle({
        show: CUSTOMERS,
        poison: true,
        packets: [hop('kB', 'w7', 'ok', 0, 'ok'), hop('kC', 'w2', 'ok', 0.2, 'ok'), hop('kC', 'w8', 'ok', 0.4, 'ok')],
        stats: [
          { label: 'Workers down', value: `${PICK} of ${WORKERS}`, tone: 'bad' },
          { label: 'Still served', value: `${survivors.length} of ${survivors.length}`, tone: 'ok' },
          { label: 'Same pair', value: `1 in ${COMBOS}`, hint: 'chance another customer shares it' },
        ],
        note: { text: 'B fails over to W7, C never noticed', tone: 'accent' },
      }),
    },
  ];
}

// Step 6: static stability. The data plane serves without calling the control plane.
const PLANES: FlowNode[] = [
  { id: 'cp', label: 'Control plane', sub: 'config, deploys', kind: 'monitor', x: 3.2, y: 0.2 },
  { id: 'u', label: 'Users', kind: 'client', x: 0, y: 2.2 },
  { id: 'd1', label: 'Data plane', sub: 'serves requests', kind: 'service', x: 2.3, y: 2.2 },
  { id: 'd2', label: 'Data plane', sub: 'serves requests', kind: 'service', x: 4.1, y: 2.2 },
  { id: 'st', label: 'Storage', kind: 'db', x: 5.7, y: 2.2 },
];
const planes = (cpDown: boolean): FlowState => ({
  nodes: patch(
    PLANES,
    cpDown
      ? { cp: { status: 'down', badge: { text: 'down', tone: 'bad' } }, d1: { badge: { text: 'last known config', tone: 'accent' } }, d2: { badge: { text: 'last known config', tone: 'accent' } } }
      : {},
  ),
  links: [
    { from: 'cp', to: 'd1', dashed: true, tone: cpDown ? 'bad' : undefined },
    { from: 'cp', to: 'd2', dashed: true, tone: cpDown ? 'bad' : undefined },
    { from: 'u', to: 'd1' },
    { from: 'd1', to: 'd2' },
    { from: 'd2', to: 'st' },
  ],
  packets: cpDown
    ? [hop('u', 'd1'), hop('d1', 'd2', undefined, 0.6), hop('d2', 'st', undefined, 1.2, 'data')]
    : [hop('cp', 'd1', 'config', 0, 'data'), hop('cp', 'd2', 'config', 0, 'data'), hop('u', 'd1', undefined, 0.6), hop('d1', 'd2', undefined, 1.2), hop('d2', 'st', undefined, 1.8, 'data')],
  stats: [
    { label: 'Control plane', value: cpDown ? 'down' : 'up', tone: cpDown ? 'bad' : 'ok' },
    { label: 'Requests', value: 'served', tone: 'ok' },
    { label: 'Shared deps', value: 'few', hint: 'each one is a shared fate link' },
  ],
  note: cpDown ? { text: 'static stability: the data plane keeps working alone', tone: 'accent' } : undefined,
});

export default defineLesson('flow', {
  slug: 'cells',
  objectives: [
    { text: 'Why a shared fleet makes every failure a total failure', step: 1 },
    { text: 'Split the system into cells behind a thin router', step: 2 },
    { text: 'Fail small with staged rollouts and health gates', step: 3 },
    { text: 'Use shuffle sharding to isolate a noisy or poisonous customer', step: 5 },
    { text: 'Keep the data plane statically stable without the control plane', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'One fleet, one fate',
      tag: 'problem',
      body: [
        'Every customer shares the same servers and database.',
        'So a bad deploy, an overload, or one poisonous customer can take down everyone at the same moment.',
      ],
      keyIdea: 'The blast radius of a failure is everything that shares the broken part.',
      frames: [
        { state: shared(false), hold: 2200 },
        { state: shared(true) },
      ],
    },
    {
      label: 'Cells',
      title: 'Many small, identical copies',
      tag: 'concept',
      body: [
        'A **cell** is a full, independent copy of the stack serving a subset of customers, for example 5% each.',
        'A thin **router** maps each customer to its cell. Nothing else is shared.',
      ],
      keyIdea: 'Cells turn one big failure domain into many small ones.',
      frames: [
        { state: cells({ stats: [{ label: 'Cells', value: 'N' }, { label: 'Per cell', value: '5% of users' }, { label: 'Shared', value: 'router only', tone: 'ok' }] }), hold: 900 },
        {
          state: cells({
            changes: { rt: { badge: { text: 'acme → cell 2', tone: 'accent' } } },
            packets: route(1, 'acme'),
            stats: [{ label: 'Cells', value: 'N' }, { label: 'Per cell', value: '5% of users' }, { label: 'Shared', value: 'router only', tone: 'ok' }],
          }),
          hold: 2400,
        },
        {
          state: cells({
            changes: { rt: { badge: { text: 'zeta → cell 1', tone: 'accent' } } },
            packets: route(0, 'zeta'),
            stats: [{ label: 'Cells', value: 'N' }, { label: 'Per cell', value: '5% of users' }, { label: 'Shared', value: 'router only', tone: 'ok' }],
          }),
        },
      ],
    },
    {
      label: 'Fail small',
      title: 'A bad deploy hits one cell',
      tag: 'technique',
      body: [
        'Roll out changes **one cell at a time** with health gates. When v2 crashes cell 1, the gate stops the rollout.',
        'That includes config and data files: Cloudflare’s November 2025 outage came from an oversized generated feature file.',
      ],
      keyIdea: 'Fail small: a gradual rollout across cells caps the damage at one cell.',
      frames: [
        { state: rollout(0), hold: 2200 },
        { state: rollout(1), hold: 2600 },
        { state: rollout(2) },
      ],
    },
    {
      label: 'Shuffle shard',
      title: 'Give each customer a random pair',
      tag: 'concept',
      body: [
        '**Shuffle sharding** assigns each customer a small random subset of workers, here 2 of 8.',
        'Customers overlap on single workers, but with 28 possible pairs it is unlikely two share the exact same subset.',
      ],
      keyIdea: 'Many combinations means almost every customer has a unique set of workers.',
      frames: assignFrames(),
    },
    {
      label: 'Poison',
      title: 'A poisonous customer hurts only its shard',
      tag: 'technique',
      body: [
        'Customer A sends requests that crash workers. It can only reach **W1 and W5**.',
        'B shares W5 but still has W7. C shares nothing. Everyone except A keeps being served.',
      ],
      keyIdea: 'A noisy or poisonous customer can only hurt the workers in its own subset.',
      frames: poisonFrames(),
    },
    {
      label: 'Static stability',
      title: 'Separate control and data planes',
      tag: 'trade-off',
      body: [
        'The **control plane** pushes config and deploys. The **data plane** serves requests.',
        'With **static stability**, the data plane keeps working when the control plane is down, because it never needs to call it to serve a request.',
      ],
      keyIdea: 'Limit shared dependencies. Each one is a shared fate link across every cell.',
      frames: [
        { state: planes(false), hold: 2600 },
        { state: planes(true) },
      ],
    },
    {
      label: 'Recap',
      title: 'Shrink the blast radius',
      tag: 'recap',
      body: [
        '- **Cells:** independent full stacks, each serving a slice of customers, behind a thin router.',
        '- **Shuffle sharding:** a small random subset of workers per customer, so one bad tenant hurts few others.',
        '- **Fail small:** roll out code, config and data files gradually with health gates.',
        '- **Static stability:** the data plane keeps serving when the control plane is down.',
        '- **Shared dependencies:** keep them few, each one is a shared fate link.',
      ],
      keyIdea: 'Design so that any single failure, deploy or customer can only reach a small slice of the system.',
      frames: [{ state: cells({ badTone: [0], changes: { app0: { status: 'down' } }, packets: [...route(1, 'ok'), ...route(2, 'ok', 0.3)], stats: [{ label: 'Cell down', value: '1', tone: 'bad' }, { label: 'Users hit', value: '5%' }, { label: 'Others', value: 'fine', tone: 'ok' }] }) }],
    },
  ],
});
