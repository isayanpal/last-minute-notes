import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the SDUI notes on caching, offline and failure. A real launch function applies the notes' flowchart: render a cached screen at once if one exists,
 * fetch, swap in valid fresh content, otherwise keep what is on screen, and fall back to a native screen only when nothing is. Four launches are run through it,
 * so what the user sees first, what they see last, and whether a blank screen ever appears are computed.
 */

type Cache = 'hit' | 'miss';
type Fetch = 'ok' | 'invalid' | 'fail';
type Launch = { first: string; final: 'fresh' | 'cached' | 'fallback'; blank: boolean };

function launch(cache: Cache, fetch: Fetch): Launch {
  const onScreen: string[] = [];
  if (cache === 'hit') onScreen.push('cached'); // render the cached screen immediately
  if (fetch === 'ok') {
    onScreen.push('fresh'); // swap in fresh content and update the cache
  } else if (!onScreen.length) {
    onScreen.push('fallback'); // nothing to show: the native fallback screen
  }
  return { first: cache === 'hit' ? 'cached' : fetch === 'ok' ? 'wait' : 'fallback', final: onScreen[onScreen.length - 1] as Launch['final'], blank: onScreen.length === 0 };
}

const CASES: { label: string; cache: Cache; fetch: Fetch; note: string }[] = [
  { label: 'Cache and fetch ok', cache: 'hit', fetch: 'ok', note: 'the cached screen shows at once, then fresh content swaps in' },
  { label: 'No cache, fetch ok', cache: 'miss', fetch: 'ok', note: 'nothing to show yet, so the first paint waits for the fetch' },
  { label: 'Cache, bad JSON', cache: 'hit', fetch: 'invalid', note: 'the fresh response is invalid, so the cached screen stays' },
  { label: 'No cache, offline', cache: 'miss', fetch: 'fail', note: 'no cache and no network: the native fallback screen, never blank' },
];
const RESULTS = CASES.map((c) => ({ ...c, ...launch(c.cache, c.fetch) }));

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.5 });

const view = (i: number): FlowState => {
  const r = RESULTS[i];
  const shown = r.cache === 'hit' ? (r.fetch === 'ok' ? ['cached', 'fresh'] : ['cached']) : r.fetch === 'ok' ? ['fresh'] : [];
  const nodes: FlowNode[] = [
    { id: 'l', label: 'App launch', sub: r.label, kind: 'client', x: 0.1, y: 1.7, status: 'active' },
    { id: 'c', label: 'Local cache', sub: r.cache === 'hit' ? 'last good screen' : 'empty', kind: 'cache', x: 2.0, y: 0.4, status: r.cache === 'hit' ? 'active' : 'dim' },
    { id: 'a', label: 'API', sub: r.fetch === 'ok' ? 'valid JSON' : r.fetch === 'invalid' ? 'invalid JSON' : 'unreachable', kind: 'external', x: 2.0, y: 3.0, status: r.fetch === 'ok' ? 'active' : 'down' },
    { id: 's', label: 'Screen', sub: r.final === 'fallback' ? 'fallback' : 'SDUI', kind: 'service', x: 4.1, y: 1.7, status: r.final === 'fallback' ? 'dim' : 'active', items: shown },
    { id: 'f', label: 'Native fallback', sub: 'always available', kind: 'storage', x: 5.9, y: 1.7, status: r.final === 'fallback' ? 'active' : 'dim' },
  ];
  return {
    nodes,
    links: [{ from: 'l', to: 'c', dashed: r.cache === 'miss' }, { from: 'l', to: 'a' }, { from: 'c', to: 's', dashed: r.cache === 'miss' }, { from: 'a', to: 's', dashed: r.fetch !== 'ok' }, { from: 's', to: 'f', dashed: true }],
    packets: [...(r.cache === 'hit' ? [hop('c', 's', 'cached', 0, 'ok')] : []), hop('a', r.final === 'fallback' ? 'f' : 's', r.fetch === 'ok' ? 'fresh' : r.fetch, 0.6, r.fetch === 'ok' ? 'ok' : 'bad')],
    stats: [
      { label: 'First paint', value: r.first, tone: r.first === 'wait' ? 'neutral' : 'ok' },
      { label: 'Final screen', value: r.final, tone: r.final === 'fallback' ? 'bad' : 'ok' },
      { label: 'Blank screen', value: r.blank ? 'yes' : 'never', tone: r.blank ? 'bad' : 'ok' },
    ],
    note: { text: r.note, tone: r.final === 'fallback' ? 'bad' : 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'sdui-cache-fallback',
  objectives: [
    { text: 'Why the cached screen shows first', step: 1 },
    { text: 'What happens with no cache', step: 2 },
    { text: 'What happens when the fresh response is invalid', step: 3 },
    { text: 'When the native fallback appears', step: 4 },
  ],
  steps: [
    {
      label: 'Cache first',
      title: 'Show what you have',
      tag: 'problem',
      body: ['The UI structure now depends on the network. To avoid a blank launch, the client caches the **last successful response**.', 'It renders that at once, then fetches and swaps in fresh content.'],
      keyIdea: 'Render now, refresh in the background.',
      frames: [{ state: view(0), hold: 4400 }],
    },
    {
      label: 'No cache',
      title: 'First launch',
      tag: 'concept',
      body: ['With nothing cached, the first paint has to wait for the fetch.', 'A native skeleton or splash covers the wait.'],
      keyIdea: 'Cache the response on every success so launch two is instant.',
      frames: [{ state: view(1), hold: 4000 }],
    },
    {
      label: 'Invalid',
      title: 'Bad response, keep the cache',
      tag: 'technique',
      body: ['If the fetch succeeds but the JSON fails validation, the client keeps showing the cached screen.', 'A bad payload never replaces a good screen.'],
      keyIdea: 'Validate before you swap.',
      frames: [{ state: view(2), hold: 4000 }],
    },
    {
      label: 'Fallback',
      title: 'Never blank',
      tag: 'trade-off',
      body: ['No cache and no usable response: the client shows a **native fallback screen**.', 'It covers a failed API, invalid JSON and an incompatible schema.'],
      keyIdea: 'Keep a fallback screen in the shell, not in the payload.',
      frames: [{ state: view(3), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'Cache, refresh, fallback',
      tag: 'recap',
      body: [
        '- **Cache:** last good response, rendered first.',
        '- **Refresh:** swap in fresh, valid content.',
        '- **Invalid:** keep what is on screen.',
        '- **Nothing at all:** native fallback.',
        '- **CDN:** cache non-personalised screens aggressively.',
      ],
      keyIdea: 'The user is never left on a blank screen.',
      frames: [{ state: view(0) }],
    },
  ],
});
