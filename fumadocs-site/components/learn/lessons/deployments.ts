import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

type Over = Record<string, Partial<FlowNode>>;

const stack = (over: Over = {}): FlowNode[] => {
  const base: FlowNode[] = [
    { id: 'u', label: 'Users', kind: 'client', x: 0, y: 1.6, size: 'sm' },
    { id: 'lb', label: 'Load balancer', kind: 'lb', x: 1.8, y: 1.6 },
    { id: 'v1a', label: 'v1', kind: 'service', x: 4.2, y: 0.3, size: 'sm' },
    { id: 'v1b', label: 'v1', kind: 'service', x: 4.2, y: 1.3, size: 'sm' },
    { id: 'v1c', label: 'v1', kind: 'service', x: 4.2, y: 2.3, size: 'sm' },
    { id: 'v2', label: 'v2', kind: 'worker', x: 5.6, y: 1.3, size: 'sm', status: 'dim' },
  ];
  return base.map((n) => ({ ...n, ...over[n.id] }));
};

const L = (ids: string[], tones: Record<string, 'accent' | 'bad'> = {}) => [{ from: 'u', to: 'lb' }, ...ids.map((id) => ({ from: 'lb', to: id, tone: tones[id] }))];
const hit = (to: string, d = 0, label = 'req', tone: Packet['tone'] = 'req'): Packet[] => [
  { from: 'u', to: 'lb', delay: d, dur: 0.45, label, tone },
  { from: 'lb', to: to, delay: d + 0.45, dur: 0.5, label, tone },
];

const rolling = (n: number): FlowState => {
  const done = ['v1a', 'v1b', 'v1c'].slice(0, n);
  const over: Over = {};
  done.forEach((id) => (over[id] = { label: 'v2', kind: 'worker' }));
  return {
    nodes: stack({ ...over, v2: { status: 'dim', label: '' } }).filter((x) => x.id !== 'v2'),
    links: L(['v1a', 'v1b', 'v1c']),
    packets: hit(['v1a', 'v1b', 'v1c'][n % 3], 0),
    stats: [{ label: 'On v2', value: `${n} / 3` }, { label: 'Mixed versions', value: n > 0 && n < 3 ? 'yes' : 'no', tone: n > 0 && n < 3 ? 'bad' : 'ok' }, { label: 'Extra cost', value: 'low', tone: 'ok' }],
    note: n === 0 ? { text: 'all servers on v1' } : n === 3 ? { text: 'rollout complete', tone: 'ok' } : { text: 'replace one instance at a time', tone: 'accent' },
  };
};

const BG = (active: 'blue' | 'green'): FlowState => ({
  nodes: [
    { id: 'u', label: 'Users', kind: 'client', x: 0, y: 1.6, size: 'sm' },
    { id: 'lb', label: 'Router', kind: 'lb', x: 1.8, y: 1.6 },
    { id: 'blue', label: 'Blue (v1)', sub: 'full environment', kind: 'service', x: 4.4, y: 0.5, status: active === 'blue' ? 'active' : 'dim' },
    { id: 'green', label: 'Green (v2)', sub: 'full environment', kind: 'worker', x: 4.4, y: 2.7, status: active === 'green' ? 'active' : 'dim' },
  ],
  links: [{ from: 'u', to: 'lb' }, { from: 'lb', to: active === 'blue' ? 'blue' : 'green', tone: 'accent' }, { from: 'lb', to: active === 'blue' ? 'green' : 'blue', dashed: true }],
  packets: hit(active, 0),
  stats: [{ label: 'Live', value: active === 'blue' ? 'v1' : 'v2' }, { label: 'Rollback', value: 'flip back', tone: 'ok' }, { label: 'Cost', value: '2x capacity', tone: 'bad' }],
  note: active === 'green' ? { text: 'switch traffic in one step', tone: 'accent' } : { text: 'v2 is deployed and tested, idle', tone: 'neutral' },
});

const canary = (pct: number, healthy: boolean): FlowState => ({
  nodes: stack({ v2: { status: healthy ? 'active' : 'down', label: 'v2 canary', badge: { text: `${pct}% traffic`, tone: healthy ? 'accent' : 'bad' } } }),
  links: [{ from: 'u', to: 'lb' }, ...['v1a', 'v1b', 'v1c'].map((id) => ({ from: 'lb', to: id })), { from: 'lb', to: 'v2', tone: healthy ? ('accent' as const) : ('bad' as const) }],
  packets: [...hit('v1a', 0), ...(healthy || pct === 1 ? hit('v2', 0.4, 'req', healthy ? 'accent' : 'bad') : [])],
  stats: [{ label: 'Canary share', value: `${pct}%` }, { label: 'Error rate', value: healthy ? '0.1%' : '8%', tone: healthy ? 'ok' : 'bad' }, { label: 'Action', value: healthy ? 'expand' : 'auto rollback', tone: healthy ? 'ok' : 'bad' }],
});

const schema = (stage: 0 | 1 | 2 | 3): FlowState => ({
  nodes: [
    { id: 'old', label: 'Old code', kind: 'service', x: 0.6, y: 0.5, size: 'sm', status: stage === 3 ? 'dim' : 'normal' },
    { id: 'new', label: 'New code', kind: 'worker', x: 0.6, y: 2.7, size: 'sm', status: stage === 0 ? 'dim' : 'normal' },
    { id: 'db', label: 'Users table', kind: 'db', x: 3.6, y: 1.6, items: stage === 0 ? ['name'] : stage === 3 ? ['full_name'] : ['name', 'full_name'] },
  ],
  links: [{ from: 'old', to: 'db' }, { from: 'new', to: 'db' }],
  packets: [],
  stats: [{ label: 'Step', value: ['start', 'expand', 'migrate', 'contract'][stage] }, { label: 'Old code works', value: stage === 3 ? 'retired' : 'yes', tone: 'ok' }, { label: 'Downtime', value: 'none', tone: 'ok' }],
  note: [{ text: 'goal: rename name to full_name' }, { text: '1. add nullable full_name', tone: 'accent' as const }, { text: '2. dual write + backfill, then read new', tone: 'accent' as const }, { text: '3. drop old column when unused', tone: 'ok' as const }][stage],
});

export default defineLesson('flow', {
  slug: 'deployments',
  objectives: [
    { text: 'Rolling vs blue-green', step: 2 },
    { text: 'How a canary catches a bad release', step: 4 },
    { text: 'Expand, migrate, contract for database changes', step: 5 },
    { text: 'Why config and data are deploys too', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Every release can break production',
      tag: 'problem',
      body: ['A new version might be slow, buggy or incompatible with the data.', 'The strategy decides how many users see a bad release and how fast you can undo it.'],
      keyIdea: 'Pick a strategy by rollback speed, risk and cost.',
      frames: [{ state: { nodes: stack({ v2: { status: 'normal', label: 'v2' } }), links: L(['v1a', 'v1b', 'v1c']), packets: hit('v1a'), stats: [{ label: 'Recreate', value: 'downtime', tone: 'bad' }, { label: 'Rolling', value: 'gradual' }, { label: 'Canary', value: 'smallest blast' }] } }],
    },
    {
      label: 'Rolling',
      title: 'Replace instances one by one',
      tag: 'technique',
      body: ['**Rolling** replaces instances gradually, so capacity never drops to zero.', 'During the rollout v1 and v2 run side by side, so they must be compatible with each other.'],
      keyIdea: 'Rolling is cheap, with medium rollback speed and mixed versions in flight.',
      frames: [0, 1, 2, 3].map((n) => ({ state: rolling(n), hold: 1700 })),
    },
    {
      label: 'Blue-green',
      title: 'Two environments, one switch',
      tag: 'technique',
      body: ['Run the new version in a full second environment, test it, then switch the router.', 'Rollback is instant: switch back. The price is double capacity and care with shared data.'],
      keyIdea: 'Blue-green gives instant rollback at high cost.',
      frames: [{ state: BG('blue'), hold: 1800 }, { state: BG('green') }],
    },
    {
      label: 'Canary',
      title: 'Expand only while metrics are healthy',
      tag: 'technique',
      body: ['Send **1%** of traffic to the new version and watch errors, latency, saturation and business metrics.', 'Healthy: grow to 10%, 50%, 100%. Unhealthy: roll back automatically.'],
      keyIdea: 'Keep the old version ready until the release is complete. Good metrics are what make canaries work.',
      frames: [{ state: canary(1, true), hold: 1900 }, { state: canary(10, true), hold: 1900 }, { state: canary(10, false) }],
    },
    {
      label: 'Schema',
      title: 'Expand, migrate, contract',
      tag: 'technique',
      body: ['Code and schema deploy at different times, so every change must work with old and new code.', 'Add the new column first, dual write and backfill, switch reads, and only then drop the old one. Never rename in one step.'],
      keyIdea: 'Avoid long locking migrations on big tables. Use online schema change tools.',
      frames: [0, 1, 2, 3].map((n) => ({ state: schema(n as 0 | 1 | 2 | 3), hold: 2000 })),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Recreate:** downtime. **Rolling:** gradual, mixed versions.',
        '- **Blue-green:** instant switch back, double cost. **Canary:** small share, needs good metrics.',
        '- **Shadow:** copy real traffic to v2 and discard replies, side effects off.',
        '- **Feature flags:** deploy dark, enable per user or percent, flip to roll back.',
        '- **Config and data are deploys:** many large outages come from them, so stage and monitor them too.',
      ],
      keyIdea: 'Treat config, models, certificates and DNS changes with the same rigour as code: review, validate, stage, monitor, roll back.',
      frames: [{ state: canary(50, true) }],
    },
  ],
});
