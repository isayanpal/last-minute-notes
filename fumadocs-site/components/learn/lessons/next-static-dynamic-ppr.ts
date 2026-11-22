import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Next.js notes on static versus dynamic rendering and Partial Prerendering. A real classifier applies the
 * notes' rules: a dynamic API (cookies, searchParams, uncached data) makes the route dynamic unless it sits behind Suspense.
 */

type Comp = { name: string; dynamicApi?: string; suspended?: boolean };
type Mode = 'static' | 'dynamic' | 'partial';

const classify = (comps: Comp[]): Mode => {
  const dynamic = comps.filter((c) => c.dynamicApi);
  if (dynamic.length === 0) return 'static';
  return dynamic.every((c) => c.suspended) ? 'partial' : 'dynamic';
};

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

const MODE_LABEL: Record<Mode, string> = { static: 'static', dynamic: 'dynamic', partial: 'partial' };

// Step 1: what each mode costs at request time.
const cost = (mode: 'static' | 'dynamic'): FlowState => ({
  nodes: [
    { id: 'u', label: 'Request', kind: 'client', x: 0.1, y: 1.7 },
    { id: 'cdn', label: 'CDN', sub: 'serves a file', kind: 'cdn', x: 2.9, y: 0.4, status: mode === 'static' ? 'active' : 'dim' },
    { id: 'srv', label: 'Your server', sub: 'renders the page', kind: 'service', x: 2.9, y: 3.0, status: mode === 'dynamic' ? 'hot' : 'dim' },
    { id: 'out', label: 'Response', sub: mode === 'static' ? 'no code ran' : 'code ran', kind: 'storage', x: 5.6, y: 1.7, status: 'active' },
  ],
  links: [{ from: 'u', to: mode === 'static' ? 'cdn' : 'srv' }, { from: mode === 'static' ? 'cdn' : 'srv', to: 'out' }],
  packets: [hop('u', mode === 'static' ? 'cdn' : 'srv', 'GET /', 0, 'req'), hop(mode === 'static' ? 'cdn' : 'srv', 'out', 'HTML', 0.7, 'res')],
  stats: [
    { label: 'Rendered', value: mode === 'static' ? 'at build' : 'per request', tone: mode === 'static' ? 'ok' : 'neutral' },
    { label: 'Your code runs', value: mode === 'static' ? 'never' : 'every time', tone: mode === 'static' ? 'ok' : 'bad' },
    { label: 'Cost', value: mode === 'static' ? 'cheapest' : 'higher' },
  ],
  note: mode === 'static' ? { text: 'static output comes from a CDN or cache without running your code', tone: 'ok' } : { text: 'a dynamic route renders on the server for every request', tone: 'bad' },
});

// Step 2: single-feature routes.
type Probe = { route: string; feature: string; chip: string; comps: Comp[] };
const PROBES: Probe[] = [
  { route: '/blog', feature: 'published posts', chip: 'posts', comps: [{ name: 'Page' }] },
  { route: '/dashboard', feature: 'cookies()', chip: 'cookies()', comps: [{ name: 'Page', dynamicApi: 'cookies()' }] },
  { route: '/search', feature: 'searchParams', chip: 'query', comps: [{ name: 'Page', dynamicApi: 'searchParams' }] },
];
const probe = (i: number): FlowState => {
  const p = PROBES[i];
  const mode = classify(p.comps);
  return {
    nodes: [
      { id: 'code', label: p.route, sub: 'page code', kind: 'client', x: 0.1, y: 1.7, items: [p.chip] },
      { id: 'build', label: 'next build', sub: 'dynamic API?', kind: 'gateway', x: 2.9, y: 1.7, status: 'active' },
      { id: 'res', label: MODE_LABEL[mode], sub: mode === 'static' ? 'prerendered' : 'per request', kind: mode === 'static' ? 'cdn' : 'service', x: 5.6, y: 1.7, status: mode === 'static' ? 'active' : 'hot' },
    ],
    links: [{ from: 'code', to: 'build' }, { from: 'build', to: 'res' }],
    packets: [hop('code', 'build', 'analyse', 0, 'req'), hop('build', 'res', mode, 0.7, mode === 'static' ? 'ok' : 'bad')],
    stats: [
      { label: 'Route', value: p.route },
      { label: 'Reads', value: p.chip },
      { label: 'Result', value: mode, tone: mode === 'static' ? 'ok' : 'bad' },
    ],
    note: mode === 'static' ? { text: 'nothing request specific: built once', tone: 'ok' } : { text: `${p.feature} depends on the request, so the route is rendered per request`, tone: 'bad' },
  };
};

// Step 3: one dynamic API anywhere makes the whole route dynamic.
const spread = (comps: Comp[]): FlowState => {
  const mode = classify(comps);
  const nodes: FlowNode[] = comps.map((c, i) => ({
    id: c.name,
    label: c.name,
    sub: c.dynamicApi ? c.dynamicApi : 'static',
    kind: 'service',
    x: 0.1,
    y: 0.4 + i * 1.35,
    status: c.dynamicApi ? 'hot' : 'normal',
  }));
  return {
    nodes: [...nodes, { id: 'build', label: 'next build', sub: 'one dynamic API', kind: 'gateway', x: 2.9, y: 1.7, status: 'active' }, { id: 'res', label: MODE_LABEL[mode], sub: 'whole route', kind: mode === 'static' ? 'cdn' : 'service', x: 5.6, y: 1.7, status: mode === 'static' ? 'active' : 'hot' }],
    links: [...comps.map((c) => ({ from: c.name, to: 'build' })), { from: 'build', to: 'res' }],
    packets: [hop('build', 'res', mode, 0, mode === 'static' ? 'ok' : 'bad')],
    stats: [
      { label: 'Dynamic parts', value: String(comps.filter((c) => c.dynamicApi).length), tone: 'bad' },
      { label: 'Static parts', value: String(comps.filter((c) => !c.dynamicApi).length) },
      { label: 'Route is', value: mode, tone: mode === 'static' ? 'ok' : 'bad' },
    ],
    note: { text: 'the layout reads cookies(), so the whole route renders per request, including the static page', tone: 'bad' },
  };
};

// Step 4: isolate the dynamic part behind Suspense.
const ppr = (comps: Comp[]): FlowState => {
  const mode = classify(comps);
  return {
    nodes: [
      { id: 'shell', label: 'Static shell', sub: 'built at build time', kind: 'cdn', x: 0.1, y: 0.4, status: 'active', items: ['Navbar', 'Details'] },
      { id: 'hole', label: 'CartCount', sub: 'in Suspense', kind: 'service', x: 0.1, y: 3.0, status: 'hot', items: ['cookies()'] },
      { id: 'br', label: 'Browser', sub: 'one response', kind: 'client', x: 5.5, y: 1.7, status: 'active' },
    ],
    links: [{ from: 'shell', to: 'br' }, { from: 'hole', to: 'br', dashed: true }],
    packets: [hop('shell', 'br', 'instant', 0, 'ok'), hop('hole', 'br', 'streamed in', 0.8, 'data')],
    stats: [
      { label: 'Route is', value: mode, tone: 'ok' },
      { label: 'Shell served', value: 'from CDN', tone: 'ok' },
      { label: 'Hole', value: 'streamed', tone: 'neutral' },
    ],
    note: { text: 'Suspense isolates the dynamic hole: the rest stays static and arrives immediately', tone: 'ok' },
  };
};

const LAYOUT_DYNAMIC: Comp[] = [{ name: 'Layout', dynamicApi: 'cookies()' }, { name: 'Page' }];
const PPR_COMPS: Comp[] = [{ name: 'Details' }, { name: 'CartCount', dynamicApi: 'cookies()', suspended: true }];

export default defineLesson('flow', {
  slug: 'next-static-dynamic-ppr',
  objectives: [
    { text: 'What static and dynamic routes cost at request time', step: 1 },
    { text: 'Which things make a route dynamic', step: 2 },
    { text: 'Why one dynamic API affects the whole route', step: 3 },
    { text: 'How Suspense and Partial Prerendering keep a static shell', step: 4 },
  ],
  steps: [
    {
      label: 'Cost',
      title: 'Static versus dynamic',
      tag: 'problem',
      body: ['A **static** route is rendered at build time and served from a CDN. A **dynamic** route renders on the server for every request.', 'The App Router infers which one from what the route does.'],
      keyIdea: 'Static output is the cheapest and fastest, which is why you want to keep it.',
      frames: [{ state: cost('static'), hold: 2800 }, { state: cost('dynamic'), hold: 3400 }],
    },
    {
      label: 'Triggers',
      title: 'What makes a route dynamic',
      tag: 'concept',
      body: ['`cookies()`, `headers()`, the `searchParams` prop and uncached data all depend on the request.', 'If none of them appear, the route is prerendered.'],
      keyIdea: '`next build` marks each route: `○` static, `ƒ` dynamic.',
      frames: [0, 1, 2].map((i) => ({ state: probe(i), hold: 2800 })),
    },
    {
      label: 'Spread',
      title: 'One dynamic API infects the route',
      tag: 'trade-off',
      body: ['If a **layout** reads `cookies()`, the whole route becomes dynamic, even a page that is otherwise static.', 'One dynamic API anywhere is enough, unless it is isolated behind `Suspense`.'],
      keyIdea: 'Accidental dynamic rendering is easy to cause and hard to notice.',
      frames: [{ state: spread(LAYOUT_DYNAMIC), hold: 4200 }],
    },
    {
      label: 'PPR',
      title: 'A static shell with a hole',
      tag: 'technique',
      body: ['**Partial Prerendering** prerenders a static shell and streams the dynamic parts in on the same response.', 'With Cache Components, dynamic work **must** sit inside `Suspense`, so accidental dynamic rendering becomes a build error.'],
      keyIdea: 'You get the CDN-fast shell and per-request personalisation in one route.',
      frames: [{ state: ppr(PPR_COMPS), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Static, dynamic, partial',
      tag: 'recap',
      body: [
        '- **Static:** built once, served from a CDN.',
        '- **Dynamic:** rendered per request.',
        '- **Triggers:** `cookies()`, `headers()`, `searchParams`, uncached data.',
        '- **Spread:** one dynamic API makes the whole route dynamic.',
        '- **PPR:** isolate dynamic holes behind `Suspense`.',
      ],
      keyIdea: 'Keep the dynamic part small, and put it behind a boundary.',
      frames: [{ state: ppr(PPR_COMPS) }],
    },
  ],
});
