import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

const range = (a: number, b: number, s: ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: b - a + 1 }, (_, i) => [a + i, s]));

// Load test: p99 latency in ms as offered load rises. The knee is where it stops being flat.
const LOADS = ['100', '200', '300', '400', '500', '600', '700', '800'];
const P99 = [22, 24, 27, 32, 48, 110, 520, 2400];
const kneeRow = (marked: boolean) => ({
  label: 'p99 ms',
  cells: P99,
  bars: true,
  states: marked ? { ...range(0, 4, 'done' as ItemState), 5: 'path' as ItemState, ...range(6, 7, 'bad' as ItemState) } : ({} as Record<number, ItemState>),
  showIndex: false,
  pointers: marked ? [{ i: 5, label: 'knee', tone: 'accent' as const, up: true }] : [],
});
const loadRow = { label: 'req / s', cells: LOADS, states: {} as Record<number, ItemState>, showIndex: false };

// Headroom: three zones of four servers, utilisation per zone.
const zones = (util: [number, number, number], down: boolean): ArrayState => ({
  rows: [
    {
      label: 'zone load %',
      cells: util,
      bars: true,
      states: { 0: down ? 'dim' : 'done', 1: util[1] > 80 ? 'bad' : down ? 'path' : 'done', 2: util[2] > 80 ? 'bad' : down ? 'path' : 'done' },
      showIndex: false,
    },
    { label: 'zone', cells: ['AZ-a', 'AZ-b', 'AZ-c'], states: { 0: down ? 'bad' : 'normal' }, showIndex: false },
  ],
  stats: down
    ? [{ label: 'Lost', value: 'a whole zone', tone: 'bad' }, { label: 'Survivors', value: `${util[1]}% each`, tone: 'ok' }, { label: 'Knee at', value: '80%' }]
    : [{ label: 'Zones', value: '3' }, { label: 'Each runs at', value: '50%', tone: 'ok' }, { label: 'Knee at', value: '80%' }],
  note: down ? { text: 'survivors absorb the load and stay under the knee', tone: 'accent' } : { text: 'N+1 at the zone level: lose one, stay healthy', tone: 'accent' },
});
const tight = zones([0, 100, 100], true);
tight.stats = [{ label: 'Each ran at', value: '67%' }, { label: 'After zone loss', value: '100%', tone: 'bad' }, { label: 'Result', value: 'overload', tone: 'bad' }];
tight.note = { text: 'no headroom: losing a zone becomes an outage', tone: 'bad' };

// Autoscaling with lag: demand jumps at index 3, capacity follows after the warm-up.
const DEMAND = [20, 20, 20, 60, 60, 60, 60, 30, 30, 30];
const scaleFrame = (upTo: number): ArrayState => {
  const capacity = [30, 30, 30, 30, 30, 60, 60, 60, 60, 60].map((v, i) => (i < upTo ? v : 0));
  const demand = DEMAND.map((v, i) => (i < upTo ? v : 0));
  const states: Record<number, ItemState> = {};
  for (let i = 0; i < upTo; i++) states[i] = DEMAND[i] > [30, 30, 30, 30, 30, 60, 60, 60, 60, 60][i] ? 'bad' : 'done';
  return {
    rows: [
      { label: 'demand', cells: demand, bars: true, states, showIndex: false },
      { label: 'capacity', cells: capacity, bars: true, states: Object.fromEntries(Array.from({ length: upTo }, (_, i) => [i, 'visited'])) as Record<number, ItemState>, showIndex: false },
    ],
    stats: [
      { label: 'Signal', value: 'queue depth' },
      { label: 'Warm-up', value: '2 ticks' },
      { label: 'Gap', value: upTo > 3 && upTo < 7 ? 'under-provided' : 'covered', tone: upTo > 3 && upTo < 7 ? 'bad' : 'ok' },
    ],
    note: upTo >= 8 ? { text: 'scale out fast, scale in slow: capacity lingers after the spike', tone: 'accent' } : upTo >= 4 ? { text: 'new instances need time to start and warm up', tone: 'bad' } : undefined,
  };
};

// Cost: where the bill goes.
const COST = (tuned: boolean): ArrayState => ({
  rows: [
    {
      label: 'monthly $k',
      cells: tuned ? [26, 9, 14, 11] : [40, 15, 30, 25],
      bars: true,
      states: tuned ? { 0: 'done', 1: 'done', 2: 'done', 3: 'done' } : { 0: 'visited', 1: 'visited', 2: 'bad', 3: 'bad' },
      showIndex: false,
    },
    { label: 'category', cells: ['compute', 'storage', 'x-AZ', 'egress'], showIndex: false, states: {} },
  ],
  stats: tuned
    ? [{ label: 'Compute', value: 'reserved, spot', tone: 'ok' }, { label: 'Storage', value: 'tiered', tone: 'ok' }, { label: 'Transfer', value: 'cut by 45%', tone: 'ok' }]
    : [{ label: 'Total', value: '$110k' }, { label: 'Transfer', value: '50% of bill', tone: 'bad' }, { label: 'Hidden', value: 'x-AZ, egress', tone: 'bad' }],
  note: tuned ? { text: 'same traffic, 40% cheaper', tone: 'accent' } : { text: 'data transfer quietly dominates the bill', tone: 'bad' },
});

export default defineLesson('array', {
  slug: 'capacity-cost',
  objectives: [
    { text: 'Find the knee of the latency curve with a load test', step: 2 },
    { text: 'Plan headroom so a zone loss is survivable', step: 3 },
    { text: 'Autoscale on the right signal, out fast and in slow', step: 4 },
    { text: 'Spot the costs that dominate: data transfer and idle capacity', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Fine at launch, down at peak',
      tag: 'problem',
      body: [
        'The system looked healthy for months. Then a launch, a sale or a zone failure pushed it past what it could handle, and latency went vertical.',
        'Capacity is a design input, not something to discover during an incident.',
      ],
      keyIdea: 'Know your limit before traffic does. Measure it, keep headroom, and watch the bill while you do.',
      frames: [{ state: { rows: [{ label: 'req / s', cells: [300, 320, 310, 340, 900, 1400], bars: true, states: { 4: 'bad', 5: 'bad' }, showIndex: false }], stats: [{ label: 'Normal', value: '~320 / s' }, { label: 'Peak', value: '1,400 / s', tone: 'bad' }, { label: 'Tested to', value: 'never', tone: 'bad' }], note: { text: 'nobody knows where it breaks', tone: 'bad' } } }],
    },
    {
      label: 'Load test',
      title: 'Find the knee',
      tag: 'technique',
      body: [
        'Ramp load against a realistic traffic shape: peak, spike and a long soak. Plot p99 latency against load.',
        'Latency stays flat, then bends sharply. That bend is the **knee**. Past it a small increase in load causes a huge increase in latency.',
      ],
      keyIdea: 'Test dependencies too. The knee of the whole system is the knee of its weakest part.',
      frames: [
        { state: { rows: [kneeRow(false), loadRow], stats: [{ label: 'Ramp', value: '100 to 800 / s' }, { label: 'Metric', value: 'p99' }, { label: 'Shape', value: 'bends sharply' }] }, hold: 2200 },
        { state: { rows: [kneeRow(true), loadRow], stats: [{ label: 'Knee', value: '~600 / s', tone: 'bad' }, { label: 'Safe to run at', value: '≤ 480 / s', tone: 'ok' }, { label: 'p99 at 800', value: '2.4 s', tone: 'bad' }], note: { text: 'run below the knee, never on it', tone: 'accent' } } },
      ],
    },
    {
      label: 'Headroom',
      title: 'Leave room for failure',
      tag: 'technique',
      body: [
        'Run below the knee, with at least **N+1** capacity, ideally N+2, so losing a node or a whole zone does not overload the rest.',
        'Three zones at 50% survive a zone loss at 75%. Three zones at 67% do not: the survivors hit 100%.',
      ],
      keyIdea: 'Utilisation that looks efficient on a calm day is the one that fails on a bad day.',
      frames: [
        { state: zones([50, 50, 50], false), hold: 2000 },
        { state: zones([0, 75, 75], true), hold: 2600 },
        { state: tight },
      ],
    },
    {
      label: 'Autoscale',
      title: 'Follow the load, with lag in mind',
      tag: 'technique',
      body: [
        'Scale on a signal that tracks real work: queue depth, concurrency or requests per instance, not just CPU.',
        'New capacity needs minutes to start and warm up, so scale **out fast and in slow**, and keep a buffer for the gap.',
      ],
      keyIdea: 'Autoscaling reacts. It does not replace headroom for a sudden spike or a hard limit.',
      frames: [3, 5, 7, 10].map((n) => ({ state: scaleFrame(n), hold: 1900 })),
    },
    {
      label: 'Cost',
      title: 'Treat cost as a constraint',
      tag: 'trade-off',
      body: [
        'Right-size instances, buy committed capacity for steady load, use spot for tolerant batch work, and tier cold storage.',
        'Watch **data transfer**: cross-AZ and egress charges often dominate. Tag spend by team and feature so it has an owner.',
      ],
      keyIdea: 'Also know the cloud quotas (connections, IOPS, API rates) before they surprise you.',
      frames: [{ state: COST(false), hold: 2600 }, { state: COST(true) }],
    },
    {
      label: 'Recap',
      title: 'A capacity checklist',
      tag: 'recap',
      body: [
        '- **Measure:** load test peak, spike and soak, and find the knee.',
        '- **Headroom:** stay under the knee with N+1 or N+2, enough to lose a zone.',
        '- **Scale:** on queue depth or concurrency, out fast and in slow, warm-up included.',
        '- **Limits:** know quotas for connections, IOPS and API rates.',
        '- **Cost:** right-size, commit for baseline, spot for batch, minimise cross-AZ and egress.',
        '- **Restraint:** multi-region active-active for a small internal tool is a flaw, not a strength.',
      ],
      keyIdea: 'Capacity planning is about choosing which failures you can afford, then paying for exactly that.',
      frames: [{ state: { rows: [kneeRow(true), loadRow], stats: [{ label: 'Knee', value: '~600 / s' }, { label: 'Run at', value: '≤ 480 / s', tone: 'ok' }, { label: 'Spare', value: 'N+1 zone', tone: 'ok' }] } }],
    },
  ],
});
