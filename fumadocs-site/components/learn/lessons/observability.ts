import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';
import type { Frame } from '../types';

/*
 * Layout: the request path runs across the top, telemetry backends sit along the bottom.
 * Span timings are illustrative.
 */

const hop = (from: string, to: string, label?: string, delay = 0, tone: Packet['tone'] = 'req', dur = 0.6): Packet => ({ from, to, label, delay, tone, dur });
const path = (ids: string[], label: string | undefined, delay = 0, tone: Packet['tone'] = 'req'): Packet[] => ids.slice(1).map((to, i) => hop(ids[i], to, label, delay + i * 0.6, tone));

// Step 1: a failing request with no telemetry.
const PATH: FlowNode[] = [
  { id: 'c', label: 'Client', kind: 'client', x: 0, y: 1.5 },
  { id: 'gw', label: 'Gateway', kind: 'gateway', x: 1.5, y: 1.5 },
  { id: 'ord', label: 'Orders', kind: 'service', x: 3.0, y: 1.5 },
  { id: 'pay', label: 'Payments', kind: 'service', x: 4.5, y: 1.5 },
  { id: 'db', label: 'Database', kind: 'db', x: 5.9, y: 1.5 },
];
const PATH_LINKS: FlowLink[] = PATH.slice(1).map((n, i) => ({ from: PATH[i].id, to: n.id }));
const blind = (failed: boolean): FlowState => ({
  nodes: patch(
    PATH,
    failed
      ? { c: { badge: { text: 'checkout failed', tone: 'bad' } }, gw: { badge: { text: '?', tone: 'neutral' } }, ord: { badge: { text: '?', tone: 'neutral' } }, pay: { badge: { text: '?', tone: 'neutral' } }, db: { badge: { text: '?', tone: 'neutral' } } }
      : {},
  ),
  links: PATH_LINKS,
  packets: failed ? path(['pay', 'ord', 'gw', 'c'], '500', 0, 'bad') : path(['c', 'gw', 'ord', 'pay', 'db'], 'checkout'),
  stats: [
    { label: 'Metrics', value: 'none', tone: 'bad' },
    { label: 'Logs', value: 'scattered', tone: 'bad' },
    { label: 'Traces', value: 'none', tone: 'bad' },
  ],
  note: failed ? { text: 'something is wrong, but where? you cannot add this mid-incident', tone: 'bad' } : undefined,
});

// Step 2: the four signals.
const SVC: FlowNode[] = [
  { id: 'gw', label: 'Gateway', kind: 'gateway', x: 1.2, y: 0.7 },
  { id: 'ord', label: 'Orders', kind: 'service', x: 2.9, y: 0.7 },
  { id: 'pay', label: 'Payments', kind: 'service', x: 4.6, y: 0.7 },
];
type Signal = { id: string; label: string; kind: FlowNode['kind']; shape: string; answers: string; tools: string };
const SIGNALS: Signal[] = [
  { id: 'met', label: 'Metrics', kind: 'monitor', shape: 'time series', answers: 'is it wrong?', tools: 'Prometheus' },
  { id: 'log', label: 'Logs', kind: 'search', shape: 'events', answers: 'what happened', tools: 'Loki, Splunk' },
  { id: 'trc', label: 'Traces', kind: 'monitor', shape: 'request paths', answers: 'where is time', tools: 'Jaeger, Tempo' },
  { id: 'prf', label: 'Profiles', kind: 'worker', shape: 'CPU over code', answers: 'why slow?', tools: 'Pyroscope' },
];
const SIGNAL_NODES: FlowNode[] = SIGNALS.map((s, i) => ({ id: s.id, label: s.label, kind: s.kind, x: 0.5 + i * 1.6, y: 2.8 }));
function signalFrames(): Frame<FlowState>[] {
  return SIGNALS.map((s, k) => ({
    hold: 2100,
    state: {
      nodes: [...SVC, ...patch(SIGNAL_NODES, Object.fromEntries(SIGNALS.map((o, i) => [o.id, i === k ? { status: 'active' as const, sub: s.shape } : i > k ? { status: 'dim' as const } : {}])))],
      links: [{ from: 'gw', to: 'ord' }, { from: 'ord', to: 'pay' }, ...SVC.map((n) => ({ from: n.id, to: s.id, dashed: true }))],
      packets: SVC.map((n, i) => hop(n.id, s.id, undefined, i * 0.2, 'data')),
      stats: [
        { label: 'Signal', value: s.label },
        { label: 'Answers', value: s.answers },
        { label: 'Tools', value: s.tools },
      ],
    },
  }));
}

// Step 3: OpenTelemetry. Instrument once, send anywhere.
const OTEL: FlowNode[] = [
  ...SVC.map((n) => ({ ...n, y: 0.4 })),
  { id: 'col', label: 'OTel Collector', sub: 'receives OTLP', kind: 'gateway', x: 2.9, y: 1.75 },
  { id: 'met', label: 'Metrics', kind: 'monitor', x: 1.2, y: 3.1 },
  { id: 'log', label: 'Logs', kind: 'search', x: 2.9, y: 3.1 },
  { id: 'trc', label: 'Traces', sub: 'vendor A', kind: 'monitor', x: 4.6, y: 3.1 },
];
const otel = (phase: 0 | 1 | 2): FlowState => ({
  nodes: patch(OTEL, phase === 2 ? { trc: { sub: 'vendor B', status: 'active' }, col: { badge: { text: 'config change only', tone: 'accent' } } } : {}),
  links: [...SVC.map((n) => ({ from: n.id, to: 'col' })), ...['met', 'log', 'trc'].map((b) => ({ from: 'col', to: b }))],
  packets: phase === 0 ? SVC.map((n, i) => hop(n.id, 'col', 'OTLP', i * 0.2, 'data')) : ['met', 'log', 'trc'].map((b, i) => hop('col', b, undefined, i * 0.2, 'data')),
  stats: [
    { label: 'Standard', value: 'OpenTelemetry', hint: 'CNCF, vendor neutral' },
    { label: 'Signals', value: '3', hint: 'traces, metrics, logs' },
    { label: 'Code changes', value: phase === 2 ? 'none' : '-', tone: phase === 2 ? 'ok' : 'neutral' },
  ],
  note: phase === 2 ? { text: 'instrument once, send to any backend', tone: 'accent' } : undefined,
});

// Step 4: one trace id follows the request.
const TRACE: FlowNode[] = [
  { id: 'c', label: 'Client', kind: 'client', x: 0, y: 1.0 },
  { id: 'gw', label: 'Gateway', kind: 'gateway', x: 1.5, y: 1.0 },
  { id: 'ord', label: 'Orders', kind: 'service', x: 3.0, y: 1.0 },
  { id: 'pay', label: 'Payments', kind: 'service', x: 4.5, y: 1.0 },
  { id: 'trc', label: 'Traces', kind: 'monitor', x: 2.2, y: 3.0 },
  { id: 'log', label: 'Logs', sub: 'JSON lines', kind: 'search', x: 3.9, y: 3.0 },
];
const SPANS = [
  { id: 'gw', span: 'gw 5ms' },
  { id: 'ord', span: 'ord 20ms' },
  { id: 'pay', span: 'pay 410ms' },
];
function traceFrames(): Frame<FlowState>[] {
  const frames: Frame<FlowState>[] = [];
  const ids = ['c', 'gw', 'ord', 'pay'];
  for (let k = 0; k < SPANS.length; k++) {
    const done = SPANS.slice(0, k + 1);
    const last = k === SPANS.length - 1;
    const changes: Record<string, Partial<FlowNode>> = {};
    done.forEach((s) => (changes[s.id] = { items: ['t-42'] }));
    if (last) {
      changes.pay = { items: ['t-42'], status: 'hot' };
      changes.trc = { items: done.map((s) => s.span.split(' ')[1]), status: 'active' };
      changes.log = { items: ['t-42 ERR'] };
    }
    frames.push({
      hold: last ? undefined : 1300,
      state: {
        nodes: patch(TRACE, changes),
        links: [
          ...ids.slice(1).map((to, i) => ({ from: ids[i], to })),
          { from: 'pay', to: 'trc', dashed: true },
          { from: 'pay', to: 'log', dashed: true },
          { from: 'ord', to: 'trc', dashed: true },
        ],
        packets: last
          ? [hop('ord', 'pay', 't-42'), hop('pay', 'trc', 'spans', 0.7, 'data'), hop('pay', 'log', 'log line', 0.7, 'data')]
          : [hop(ids[k], ids[k + 1], 't-42')],
        stats: [
          { label: 'Trace id', value: 't-42' },
          { label: 'Spans', value: String(done.length) },
          { label: 'Slowest', value: last ? 'payments' : '-', tone: last ? 'bad' : 'neutral' },
        ],
        note: last ? { text: 'the trace shows where the time went, logs share the same id', tone: 'accent' } : undefined,
      },
    });
  }
  return frames;
}

// Step 5: what to measure.
const MEASURE: FlowNode[] = [
  { id: 'u', label: 'Users', kind: 'client', x: 0, y: 1.2 },
  { id: 'svc', label: 'Checkout', kind: 'service', x: 1.9, y: 1.2 },
  { id: 'db', label: 'Database', kind: 'db', x: 3.8, y: 1.2 },
  { id: 'met', label: 'Dashboards', kind: 'monitor', x: 2.85, y: 3.0 },
];
const measure = (phase: 0 | 1 | 2): FlowState => {
  const changes: Record<string, Partial<FlowNode>> = {
    svc: { items: ['rate', 'errors', 'p99'], badge: phase === 0 ? { text: 'RED', tone: 'accent' } : undefined, status: phase === 0 ? 'active' : 'normal' },
  };
  if (phase >= 1) changes.db = { items: ['util', 'satur.', 'errors'], badge: phase === 1 ? { text: 'USE', tone: 'accent' } : undefined, status: phase === 1 ? 'active' : 'normal' };
  if (phase === 2) changes.met = { items: ['orders/m'], badge: { text: 'orders per minute fell', tone: 'bad' }, status: 'hot' };
  return {
    nodes: patch(MEASURE, changes),
    links: [
      { from: 'u', to: 'svc' },
      { from: 'svc', to: 'db' },
      { from: 'svc', to: 'met', dashed: true },
      { from: 'db', to: 'met', dashed: true },
    ],
    packets: [hop('u', 'svc'), hop('svc', 'db', undefined, 0.6, 'data'), hop(phase === 1 ? 'db' : 'svc', 'met', undefined, 1.2, 'data')],
    stats:
      phase === 0
        ? [{ label: 'Services', value: 'RED' }, { label: 'Means', value: 'rate,err,dur' }, { label: 'Golden signals', value: '4', hint: 'latency, traffic, errors, saturation' }]
        : phase === 1
          ? [{ label: 'Resources', value: 'USE' }, { label: 'Means', value: 'util,sat,err' }, { label: 'Golden signals', value: '4', hint: 'latency, traffic, errors, saturation' }]
          : [{ label: 'Tech metrics', value: 'all green', tone: 'ok' }, { label: 'Orders / min', value: 'dropping', tone: 'bad' }, { label: 'Failure', value: 'silent', tone: 'bad' }],
    note: phase === 2 ? { text: 'only a business metric catches this silent failure', tone: 'bad' } : undefined,
  };
};

// Step 6: head vs tail sampling.
const SAMPLE: FlowNode[] = [
  { id: 'svc', label: 'Services', kind: 'service', x: 0.4, y: 1.6 },
  { id: 'col', label: 'Collector', kind: 'gateway', x: 2.6, y: 1.6 },
  { id: 'trc', label: 'Trace store', kind: 'monitor', x: 4.8, y: 1.6 },
];
const TRACES = ['t-1 ok', 't-2 slow', 't-3 ERR'];
const sampling = (mode: 'head' | 'buffer' | 'tail'): FlowState => ({
  nodes: patch(SAMPLE, {
    svc: mode === 'head' ? { sub: 'keep 1 in 3, at start' } : {},
    col: mode === 'buffer' ? { items: ['t-1', 't-2', 't-3'], sub: 'buffers whole traces' } : mode === 'tail' ? { sub: 'keeps slow + errors' } : { sub: 'forwards' },
    trc: { items: mode === 'head' ? ['t-1 ok'] : mode === 'tail' ? ['t-2 slow', 't-3 ERR'] : [] },
  }),
  links: [
    { from: 'svc', to: 'col' },
    { from: 'col', to: 'trc' },
  ],
  packets:
    mode === 'head'
      ? [hop('svc', 'col', 't-1', 0, 'data'), hop('col', 'trc', 't-1', 0.7, 'data')]
      : mode === 'buffer'
        ? TRACES.map((t, i) => hop('svc', 'col', t.split(' ')[0], i * 0.3, 'data'))
        : [hop('col', 'trc', 't-2', 0, 'data'), hop('col', 'trc', 't-3', 0.3, 'bad')],
  stats:
    mode === 'head'
      ? [{ label: 'Sampling', value: 'head-based' }, { label: 'Cost', value: 'cheap', tone: 'ok' }, { label: 'Error trace', value: 'dropped', tone: 'bad' }]
      : [{ label: 'Sampling', value: 'tail-based' }, { label: 'Cost', value: 'buffering', tone: 'bad' }, { label: 'Error trace', value: mode === 'tail' ? 'kept' : '-', tone: mode === 'tail' ? 'ok' : 'neutral' }],
  note:
    mode === 'head'
      ? { text: 'decided at the start: the error trace was thrown away', tone: 'bad' }
      : mode === 'tail'
        ? { text: 'decided at the end: keep the slow and errored traces', tone: 'accent' }
        : undefined,
});

// Step 7: alert on symptoms, page a human with a runbook.
const RECAP: FlowState = {
  nodes: [
    { id: 'svc', label: 'Services', sub: 'OTel instrumented', kind: 'service', x: 0.3, y: 1.6 },
    { id: 'met', label: 'Metrics', sub: 'SLO burn rate', kind: 'monitor', x: 2.2, y: 1.6 },
    { id: 'al', label: 'Alert', sub: 'on symptoms', kind: 'queue', x: 4.0, y: 1.6, status: 'hot', badge: { text: 'error rate burning', tone: 'bad' } },
    { id: 'oc', label: 'On-call', sub: 'runbook + owner', kind: 'client', x: 5.7, y: 1.6 },
  ],
  links: [
    { from: 'svc', to: 'met' },
    { from: 'met', to: 'al' },
    { from: 'al', to: 'oc' },
  ],
  packets: [hop('svc', 'met', undefined, 0, 'data'), hop('met', 'al', undefined, 0.6, 'data'), hop('al', 'oc', 'page', 1.2, 'bad')],
  stats: [
    { label: 'Page on', value: 'symptoms', hint: 'SLO burn, errors, latency' },
    { label: 'Causes', value: 'dashboards' },
    { label: 'Unused alerts', value: 'delete' },
  ],
};

export default defineLesson('flow', {
  slug: 'observability',
  objectives: [
    { text: 'Tell metrics, logs, traces and profiles apart by the question each answers', step: 2 },
    { text: 'Why OpenTelemetry decouples instrumentation from backends', step: 3 },
    { text: 'Follow one request through a trace with a shared id', step: 4 },
    { text: 'Choose RED, USE and business metrics, and sample traces sensibly', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Checkout fails, and nobody can see why',
      tag: 'problem',
      body: [
        'A checkout request crosses four components and comes back as a 500.',
        'Without telemetry every hop is a question mark. **Observability** is the ability to understand internal state from external outputs.',
      ],
      keyIdea: 'You need observability before the incident, because you cannot add it during one.',
      frames: [
        { state: blind(false), hold: 2600 },
        { state: blind(true) },
      ],
    },
    {
      label: 'Four signals',
      title: 'Metrics, logs, traces, profiles',
      tag: 'concept',
      body: [
        '**Metrics** are cheap numeric time series. **Logs** are high-volume discrete events. **Traces** follow a request across services. **Profiles** map CPU and memory onto code.',
      ],
      keyIdea: 'Each signal answers a different question: is something wrong, what happened, where is the time, why is it slow.',
      frames: signalFrames(),
    },
    {
      label: 'OpenTelemetry',
      title: 'Instrument once, send anywhere',
      tag: 'concept',
      body: [
        '**OpenTelemetry** is the vendor-neutral CNCF standard: APIs, SDKs, the OTLP protocol and the Collector, for traces, metrics and logs.',
        'Services speak OTLP to a collector, which forwards to whatever backends you run. Switching vendors is a config change.',
      ],
      keyIdea: 'Decouple instrumentation from storage so the backend can change without touching code.',
      frames: [
        { state: otel(0), hold: 1600 },
        { state: otel(1), hold: 1600 },
        { state: otel(2) },
      ],
    },
    {
      label: 'Tracing',
      title: 'Follow one request',
      tag: 'technique',
      body: [
        'The gateway starts trace `t-42` and every hop propagates it. Each service records a span.',
        'Put the trace id in **structured JSON logs** too, so the error line and the slow span link up.',
      ],
      keyIdea: 'A correlation id propagated across services turns scattered logs and timings into one story.',
      frames: traceFrames(),
    },
    {
      label: 'What to measure',
      title: 'RED, USE and business metrics',
      tag: 'technique',
      body: [
        'Use **RED** for services (rate, errors, duration) and **USE** for resources (utilization, saturation, errors). Together they cover the four golden signals.',
        'Add **business metrics** like orders per minute. Technical health alone misses silent failures.',
      ],
      keyIdea: 'Measure services, resources and the business outcome, or a silent failure can hide behind green dashboards.',
      frames: [
        { state: measure(0), hold: 2000 },
        { state: measure(1), hold: 2000 },
        { state: measure(2) },
      ],
    },
    {
      label: 'Sampling',
      title: 'Which traces do you keep?',
      tag: 'trade-off',
      body: [
        '**Head-based** sampling decides at the start. It is cheap but blind, so it can drop the one trace you need.',
        '**Tail-based** sampling buffers whole traces and keeps the slow and errored ones. It is more useful and needs buffering. Separately, never label metrics with unbounded values like user id.',
      ],
      keyIdea: 'Tail sampling keeps the interesting traces at the cost of memory. Cardinality control keeps metrics affordable.',
      frames: [
        { state: sampling('head'), hold: 2400 },
        { state: sampling('buffer'), hold: 1800 },
        { state: sampling('tail') },
      ],
    },
    {
      label: 'Recap',
      title: 'From signal to page',
      tag: 'recap',
      body: [
        '- **Signals:** metrics (is it wrong?), logs (what happened?), traces (where?), profiles (why slow?).',
        '- **OpenTelemetry:** instrument once, export over OTLP to any backend.',
        '- **Measure:** golden signals, RED for services, USE for resources, plus business metrics.',
        '- **Practice:** structured logs with trace ids, tail sampling, no unbounded labels.',
        '- **Alert on symptoms**, use causes for diagnosis. Every page has a runbook and an owner.',
      ],
      keyIdea: 'Delete alerts nobody acts on, and keep dependency maps so hidden dependencies cannot surprise you.',
      frames: [{ state: RECAP }],
    },
  ],
});
