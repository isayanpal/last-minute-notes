import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the SDUI notes on server orchestration and data versus UI. An orchestrator calls user, products, recommendations, CMS and experiments, then
 * composes the screen. The latencies (40, 120, 200, 60 and 30 ms), the 150 ms budget, the 15 ms compose time and the 1 MB per second link are EXAMPLE values.
 * The schedules and the inline-versus-reference payload sizes (JSON.stringify of real objects) are computed.
 */

const SERVICES = [
  { name: 'User', ms: 40 },
  { name: 'Products', ms: 120 },
  { name: 'Recs', ms: 200 },
  { name: 'CMS', ms: 60 },
  { name: 'Experiments', ms: 30 },
];
const COMPOSE = 15;
const BUDGET = 150;
const BYTES_PER_MS = 1000; // 1 MB per second

type Plan = { bars: { lane: string; bar: TimelineBar }[]; total: number; dropped: string[] };
const sequential = (): Plan => {
  let t = 0;
  const bars = SERVICES.map((s) => {
    const bar: TimelineBar = { id: `seq-${s.name}`, from: t, to: t + s.ms, label: `${s.ms}`, tone: 'req' };
    t += s.ms;
    return { lane: s.name, bar };
  });
  bars.push({ lane: 'Compose', bar: { id: 'seq-compose', from: t, to: t + COMPOSE, label: 'compose', tone: 'ok' } });
  return { bars, total: t + COMPOSE, dropped: [] };
};
const parallel = (budget?: number): Plan => {
  const dropped: string[] = [];
  const bars = SERVICES.map((s) => {
    const over = budget !== undefined && s.ms > budget;
    if (over) dropped.push(s.name);
    const bar: TimelineBar = { id: `par-${budget ?? 'x'}-${s.name}`, from: 0, to: over ? budget! : s.ms, label: over ? 'timeout' : `${s.ms}`, tone: over ? 'bad' : 'ok', state: over ? 'bad' : 'normal' };
    return { lane: s.name, bar };
  });
  const ready = Math.max(...bars.map((b) => b.bar.to));
  bars.push({ lane: 'Compose', bar: { id: `par-${budget ?? 'x'}-compose`, from: ready, to: ready + COMPOSE, label: 'compose', tone: 'ok' } });
  return { bars, total: ready + COMPOSE, dropped };
};
const SEQ = sequential();
const PAR = parallel();
const BUD = parallel(BUDGET);

const product = (i: number) => ({ id: `p${i}`, name: `Product ${i}`, price: 19.99, imageUrl: `https://cdn.example.com/p${i}.jpg` });
const inlineBytes = JSON.stringify({ type: 'product_grid', props: { products: Array.from({ length: 1000 }, (_, i) => product(i)) } }).length;
const refBytes = JSON.stringify({ type: 'product_grid', props: { dataSource: 'trending_products' } }).length;
const pageBytes = JSON.stringify(Array.from({ length: 20 }, (_, i) => product(i))).length;
const T_INLINE = Math.round(inlineBytes / BYTES_PER_MS);
const T_REF = Math.round((refBytes + pageBytes) / BYTES_PER_MS);

const AXIS = SEQ.total + 5;
const view = (plan: Plan, note: TimelineState['note'], stats: TimelineState['stats']): TimelineState => {
  const lanes = [...SERVICES.map((s) => s.name), 'Compose'];
  return { from: 0, to: AXIS, unit: 'ms', ticks: [0, 150, 300, 450], lanes: lanes.map((l) => ({ label: l, bars: plan.bars.filter((b) => b.lane === l).map((b) => b.bar) })), stats, note };
};

const payloads = (): TimelineState => ({
  from: 0,
  to: AXIS,
  unit: 'ms',
  ticks: [0, 150, 300, 450],
  lanes: [
    { label: 'Inline', bars: [{ id: 'inl', from: 0, to: T_INLINE, label: `${Math.round(inlineBytes / 1000)} KB`, tone: 'bad' }] },
    { label: 'Reference', bars: [{ id: 'ref', from: 0, to: T_REF, label: `${((refBytes + pageBytes) / 1000).toFixed(1)} KB`, tone: 'ok' }] },
  ],
  stats: [
    { label: 'Inline 1000', value: `${Math.round(inlineBytes / 1000)} KB`, tone: 'bad' },
    { label: 'Ref + 1 page', value: `${((refBytes + pageBytes) / 1000).toFixed(1)} KB`, tone: 'ok' },
    { label: 'Transfer', value: `${T_INLINE} vs ${T_REF} ms` },
  ],
  note: { text: 'inline is one heavy round trip, a reference keeps the screen small and the client pages it', tone: 'accent' },
});

export default defineLesson('timeline', {
  slug: 'sdui-orchestration',
  objectives: [
    { text: 'What a sequential orchestrator costs', step: 1 },
    { text: 'How parallel calls cut the wait', step: 2 },
    { text: 'What a latency budget does to a slow section', step: 3 },
    { text: 'When to inline data and when to reference it', step: 4 },
  ],
  steps: [
    {
      label: 'Sequential',
      title: 'Five services in a row',
      tag: 'problem',
      body: ['One home request needs the user, products, recommendations, CMS content and experiments. The **orchestrator** composes them into the screen.', 'Calling them one after another adds the latencies up. These are example values.'],
      keyIdea: 'Airbnb\'s Ghost Platform and Shopify both orchestrate across services on the backend.',
      frames: [{ state: view(SEQ, { text: `sequential calls take ${SEQ.total} ms before the screen can be built`, tone: 'bad' }, [{ label: 'Total', value: `${SEQ.total} ms`, tone: 'bad' }, { label: 'Services', value: '5' }, { label: 'Overlap', value: 'none', tone: 'bad' }]), hold: 4600 }],
    },
    {
      label: 'Parallel',
      title: 'Call them together',
      tag: 'concept',
      body: ['The calls are independent, so the orchestrator starts them all at once.', `The wait is the slowest call, 200 ms, plus ${COMPOSE} ms to compose.`],
      keyIdea: 'Latency becomes the maximum, not the sum.',
      frames: [{ state: view(PAR, { text: `all five overlap: ${PAR.total} ms in total`, tone: 'ok' }, [{ label: 'Total', value: `${PAR.total} ms`, tone: 'ok' }, { label: 'Slowest', value: 'Recs, 200 ms' }, { label: 'Saved', value: `${SEQ.total - PAR.total} ms`, tone: 'ok' }]), hold: 4600 }],
    },
    {
      label: 'Budget',
      title: 'Drop what is too slow',
      tag: 'technique',
      body: [`Give each call a ${BUDGET} ms budget. Recommendations are slower, so they time out and that section is left out.`, 'The user gets a complete, slightly shorter screen instead of a late one.'],
      keyIdea: 'Design the screen to degrade gracefully when a section is missing.',
      frames: [{ state: view(BUD, { text: `${BUD.dropped.join(', ')} timed out at ${BUDGET} ms, the screen composes at ${BUD.total} ms`, tone: 'ok' }, [{ label: 'Total', value: `${BUD.total} ms`, tone: 'ok' }, { label: 'Dropped', value: BUD.dropped.join(', '), tone: 'bad' }, { label: 'Budget', value: `${BUDGET} ms` }]), hold: 4800 }],
    },
    {
      label: 'Payload',
      title: 'Inline or reference',
      tag: 'trade-off',
      body: ['**Inline** data is one round trip. A **data reference** such as `dataSource: "trending_products"` keeps the screen small, and the client fetches the list in pages.', 'Never inline thousands of items in one payload.'],
      keyIdea: 'Send an initial page plus pagination or a reference for long lists.',
      frames: [{ state: payloads(), hold: 4800 }],
    },
    {
      label: 'Recap',
      title: 'Orchestration',
      tag: 'recap',
      body: [
        '- **Orchestrator:** composes services into a screen.',
        '- **Parallel calls:** latency is the maximum.',
        '- **Budgets:** drop slow sections.',
        '- **Inline:** one round trip, heavy.',
        '- **Reference:** small payload, client pages.',
      ],
      keyIdea: 'REST or GraphQL both work: the contract matters more than the protocol.',
      frames: [{ state: view(PAR, { text: `${SEQ.total} ms sequential, ${PAR.total} ms parallel, ${BUD.total} ms with a budget`, tone: 'accent' }, [{ label: 'Sequential', value: `${SEQ.total} ms` }, { label: 'Parallel', value: `${PAR.total} ms`, tone: 'ok' }, { label: 'With budget', value: `${BUD.total} ms`, tone: 'ok' }]) }],
    },
  ],
});
