import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Next.js notes on the classic caching layers: Router Cache (browser), Full Route Cache, Request Memoization,
 * Data Cache, then the origin. A real layered lookup runs the requests, so which layer answers and how many origin calls
 * happen are computed, not drawn by hand.
 */

type Caches = { route: boolean; data: boolean };
type Result = { served: 'router' | 'route' | 'data' | 'origin'; originCalls: number; fetchCalls: number; touched: string[] };

/** One request. `routerHit` says whether this browser already holds the payload. */
function request(c: Caches, routerHit: boolean, fetchCallsInRender = 3): Result {
  if (routerHit) return { served: 'router', originCalls: 0, fetchCalls: 0, touched: ['router'] };
  if (c.route) return { served: 'route', originCalls: 0, fetchCalls: 0, touched: ['router', 'route'] };
  // render: identical fetches inside one render are memoised, so the data layer sees one lookup
  const touched = ['router', 'route', 'memo', 'data'];
  let originCalls = 0;
  if (!c.data) {
    originCalls = 1;
    touched.push('origin');
    c.data = true;
  }
  c.route = true;
  return { served: originCalls ? 'origin' : 'data', originCalls, fetchCalls: fetchCallsInRender, touched };
}

const caches: Caches = { route: false, data: false };
const cold = request(caches, false);
const sameBrowser = request(caches, true);
const otherBrowser = request(caches, false);
// revalidateTag / revalidatePath: both server caches are invalidated
caches.route = false;
caches.data = false;
const afterInvalidate = request(caches, false);

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.45 });

const IDS = ['router', 'route', 'memo', 'data', 'origin'];
const LAYERS: { id: string; label: string; sub: string; kind: FlowNode['kind']; x: number }[] = [
  { id: 'router', label: 'Router cache', sub: 'browser memory', kind: 'cache', x: 1.2 },
  { id: 'route', label: 'Route cache', sub: 'HTML + payload', kind: 'cdn', x: 2.35 },
  { id: 'memo', label: 'Memoization', sub: 'one render', kind: 'worker', x: 3.5 },
  { id: 'data', label: 'Data cache', sub: 'fetch results', kind: 'db', x: 4.65 },
  { id: 'origin', label: 'Origin', sub: 'API or DB', kind: 'external', x: 5.8 },
];

const view = (r: Result, note: FlowState['note'], extra?: { fetchCalls?: boolean }): FlowState => {
  const served = r.served;
  const stop = served === 'router' ? 'router' : served === 'route' ? 'route' : served === 'data' ? 'data' : 'origin';
  const nodes: FlowNode[] = [
    { id: 'req', label: 'Request', kind: 'client', x: 0.05, y: 1.7, status: 'active' },
    ...LAYERS.map((l): FlowNode => {
      const touched = r.touched.includes(l.id);
      const isServer = l.id === stop;
      return { id: l.id, label: l.label, sub: l.sub, kind: l.kind, x: l.x, y: 1.7, status: !touched ? 'dim' : isServer ? 'active' : 'normal', items: isServer ? ['answers'] : touched && l.id !== 'memo' && l.id !== 'origin' ? ['miss'] : undefined };
    }),
  ];
  const path = ['req', ...IDS.filter((id) => r.touched.includes(id))];
  return {
    nodes,
    links: [{ from: 'req', to: 'router' }, ...IDS.slice(1).map((id, i) => ({ from: IDS[i], to: id }))],
    packets: path.slice(0, -1).map((id, i) => hop(id, path[i + 1], i === 0 ? 'GET' : 'miss', i * 0.5, i === path.length - 2 ? 'ok' : 'data')),
    stats: [
      { label: 'Answered by', value: served === 'router' ? 'Router cache' : served === 'route' ? 'Route cache' : served === 'data' ? 'Data cache' : 'Origin', tone: served === 'origin' ? 'bad' : 'ok' },
      { label: 'Origin calls', value: String(r.originCalls), tone: r.originCalls ? 'bad' : 'ok' },
      extra?.fetchCalls ? { label: 'fetch() calls', value: String(r.fetchCalls) } : { label: 'Layers touched', value: String(r.touched.length) },
    ],
    note,
  };
};

export default defineLesson('flow', {
  slug: 'next-caching-layers',
  objectives: [
    { text: 'The four classic caching layers and where each lives', step: 1 },
    { text: 'How request memoization collapses duplicate fetches', step: 2 },
    { text: 'Which layer answers a repeat request', step: 3 },
    { text: 'What an invalidation clears', step: 4 },
  ],
  steps: [
    {
      label: 'Cold',
      title: 'A request, no cache yet',
      tag: 'problem',
      body: ['"Why is my data stale?" starts here. There are four layers between the browser and your data.', 'On a cold request every layer misses and the origin answers.'],
      keyIdea: 'Router Cache (browser), Full Route Cache, Request Memoization, Data Cache, then the origin.',
      frames: [{ state: view(cold, { text: 'every layer misses, so the API or database answers once', tone: 'accent' }), hold: 4200 }],
    },
    {
      label: 'Memoization',
      title: 'Same fetch, one call',
      tag: 'concept',
      body: ['A layout, a page and `generateMetadata` can all call `getPost(id)`. Within one render the identical calls are **memoized**.', 'Three `fetch()` calls become one trip to the data layer.'],
      keyIdea: 'Memoization lasts one render pass, it is not a data cache.',
      frames: [{ state: view(cold, { text: `${cold.fetchCalls} identical fetch calls, ${cold.originCalls} origin call`, tone: 'ok' }, { fetchCalls: true }), hold: 4200 }],
    },
    {
      label: 'Warm',
      title: 'Closer caches answer first',
      tag: 'technique',
      body: ['The same browser asking again is served by the **Router Cache**. A different visitor is served by the **Full Route Cache**.', 'Neither reaches your code or the origin.'],
      keyIdea: 'The earlier a layer answers, the less work happens behind it.',
      frames: [{ state: view(sameBrowser, { text: 'same browser: the Router Cache already holds the payload', tone: 'ok' }), hold: 3400 }, { state: view(otherBrowser, { text: 'new visitor: the Full Route Cache serves the stored HTML and payload', tone: 'ok' }), hold: 3800 }],
    },
    {
      label: 'Invalidate',
      title: 'revalidate clears the server caches',
      tag: 'trade-off',
      body: ['`revalidateTag` or `revalidatePath` invalidates the Data Cache and the Full Route Cache.', 'The next request renders again and reaches the origin for fresh data.'],
      keyIdea: 'Stale data usually means the right layer was never invalidated.',
      frames: [{ state: view(afterInvalidate, { text: 'both server caches were cleared, so the origin is asked again', tone: 'bad' }), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'Classic caching layers',
      tag: 'recap',
      body: [
        '- **Router Cache:** browser memory, per session.',
        '- **Full Route Cache:** server, rendered HTML and payload.',
        '- **Request Memoization:** one render pass.',
        '- **Data Cache:** server, `fetch` results across requests.',
        '- **Versions:** 14 cached `fetch` by default, 15 does not, 16 adds `"use cache"`.',
      ],
      keyIdea: 'For current code, answer with explicit caching: `"use cache"`, `cacheLife` and tags.',
      frames: [{ state: view(cold, { text: 'five hops from the request to the origin', tone: 'accent' }) }],
    },
  ],
});
