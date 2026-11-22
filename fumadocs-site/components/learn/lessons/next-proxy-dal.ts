import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Next.js notes on proxy.ts and the Data Access Layer: the proxy is a coarse early check, the DAL is the real
 * boundary. A real request pipeline runs four requests through the layers, with and without the DAL, to show what each stops.
 */

type Req = { path: string; cookie: 'none' | 'forged' | 'valid'; user?: string; invoiceOwner?: string; proxyMatches: boolean };
type Outcome = { proxy: 'redirect' | 'pass' | 'skipped'; dal: 'blocked' | 'allowed' | 'not used'; leaked: boolean; result: string };

const VALID_SESSIONS = new Set(['valid']);

/** The proxy only checks that a cookie exists, which is why it is not a security boundary. */
const proxy = (r: Req): 'redirect' | 'pass' | 'skipped' => (!r.proxyMatches ? 'skipped' : r.cookie === 'none' ? 'redirect' : 'pass');

function handle(r: Req, useDal: boolean): Outcome {
  const p = proxy(r);
  if (p === 'redirect') return { proxy: p, dal: 'not used', leaked: false, result: 'redirect' };
  if (!useDal) return { proxy: p, dal: 'not used', leaked: true, result: 'leaked' };
  // DAL: verify the session, then authorise on the resource
  if (!VALID_SESSIONS.has(r.cookie)) return { proxy: p, dal: 'blocked', leaked: false, result: '401' };
  if (r.invoiceOwner && r.invoiceOwner !== r.user) return { proxy: p, dal: 'blocked', leaked: false, result: '403' };
  return { proxy: p, dal: 'allowed', leaked: false, result: '200' };
}

const ANON: Req = { path: '/dashboard', cookie: 'none', proxyMatches: true };
const FORGED: Req = { path: '/dashboard', cookie: 'forged', proxyMatches: true };
const UNMATCHED: Req = { path: '/dashboard', cookie: 'none', proxyMatches: false };
const STRANGER: Req = { path: '/invoice/9', cookie: 'valid', user: 'bo', invoiceOwner: 'ana', proxyMatches: true };

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.5 });

const view = (r: Req, useDal: boolean, label: string, note: FlowState['note']): FlowState => {
  const o = handle(r, useDal);
  const nodes: FlowNode[] = [
    { id: 'req', label: 'Request', sub: label, kind: 'client', x: 0.1, y: 1.7, status: 'active' },
    { id: 'proxy', label: 'proxy.ts', sub: 'cookie present?', kind: 'gateway', x: 1.55, y: 1.7, status: o.proxy === 'skipped' ? 'dim' : o.proxy === 'redirect' ? 'hot' : 'active', items: o.proxy === 'skipped' ? ['skipped'] : o.proxy === 'redirect' ? ['redirect'] : ['pass'] },
    { id: 'route', label: 'Route', sub: 'Server Component', kind: 'service', x: 3.0, y: 1.7, status: o.proxy === 'redirect' ? 'dim' : 'normal' },
    { id: 'dal', label: 'DAL', sub: 'verify + authorise', kind: 'worker', x: 4.45, y: 1.7, status: o.dal === 'not used' ? 'dim' : o.dal === 'blocked' ? 'hot' : 'active', items: o.dal === 'blocked' ? ['blocked'] : o.dal === 'allowed' ? ['allowed'] : undefined },
    { id: 'db', label: 'Database', sub: o.leaked ? 'data leaked' : 'protected', kind: 'db', x: 5.9, y: 1.7, status: o.leaked ? 'down' : o.dal === 'allowed' ? 'active' : 'dim' },
  ];
  const packets: Packet[] = [hop('req', 'proxy', 'GET', 0)];
  if (o.proxy !== 'redirect') packets.push(hop('proxy', 'route', o.proxy === 'skipped' ? 'not matched' : 'pass', 0.5, o.proxy === 'skipped' ? 'data' : 'ok'));
  if (o.proxy !== 'redirect') packets.push(hop('route', 'dal', useDal ? 'read data' : 'skip DAL', 1.0, useDal ? 'req' : 'bad'));
  if (o.dal === 'allowed' || o.leaked) packets.push(hop('dal', 'db', o.leaked ? 'query' : 'query', 1.5, o.leaked ? 'bad' : 'ok'));
  return {
    nodes,
    links: [{ from: 'req', to: 'proxy' }, { from: 'proxy', to: 'route' }, { from: 'route', to: 'dal' }, { from: 'dal', to: 'db' }],
    packets,
    stats: [
      { label: 'Proxy', value: o.proxy, tone: o.proxy === 'redirect' ? 'ok' : 'neutral' },
      { label: 'DAL', value: o.dal, tone: o.dal === 'blocked' ? 'ok' : o.dal === 'not used' ? 'neutral' : 'ok' },
      { label: 'Result', value: o.result.slice(0, 14), tone: o.leaked ? 'bad' : 'ok' },
    ],
    note: o.leaked ? { text: 'the proxy let it through and nothing else checked: the data leaked', tone: 'bad' } : note,
  };
};

export default defineLesson('flow', {
  slug: 'next-proxy-dal',
  objectives: [
    { text: 'What proxy.ts is good for', step: 1 },
    { text: 'Why a proxy alone leaks data', step: 2 },
    { text: 'How the Data Access Layer verifies the session', step: 3 },
    { text: 'Why the DAL also checks ownership', step: 4 },
  ],
  steps: [
    {
      label: 'proxy.ts',
      title: 'A cheap early check',
      tag: 'problem',
      body: ['`proxy.ts` (formerly middleware) runs before routing. A request with no session cookie is redirected to `/login` without rendering anything.', 'That is fast and good UX.'],
      keyIdea: 'Use the proxy for coarse, early decisions: redirects, locale, headers.',
      frames: [{ state: view(ANON, false, 'no cookie', { text: 'anonymous visitor: redirected before any rendering', tone: 'ok' }), hold: 4000 }],
    },
    {
      label: 'Forged',
      title: 'A cookie is not a session',
      tag: 'trade-off',
      body: ['The proxy only checks that a cookie **exists**. A forged cookie passes.', 'With no other check, the page reads the database for an attacker.'],
      keyIdea: 'A proxy is not a security boundary, and one layer must never expose data alone.',
      frames: [{ state: view(FORGED, false, 'forged cookie', { text: '', tone: 'bad' }), hold: 4400 }],
    },
    {
      label: 'DAL',
      title: 'Verify at the data',
      tag: 'technique',
      body: ['The **Data Access Layer** is a server-only module every protected read goes through. It verifies the session and returns only safe fields.', 'The same forged cookie is now blocked at the data.'],
      keyIdea: 'One place to audit, and components never call the database directly.',
      frames: [{ state: view(FORGED, true, 'forged cookie', { text: 'the DAL verifies the session itself and refuses the forged cookie', tone: 'ok' }), hold: 3800 }, { state: view(UNMATCHED, true, 'proxy skipped', { text: 'even when the matcher misses the route, the DAL still blocks it', tone: 'ok' }), hold: 4000 }],
    },
    {
      label: 'Ownership',
      title: 'Authorise per resource',
      tag: 'technique',
      body: ['A valid session is still not permission. The DAL compares the invoice owner with the session user.', 'Another user asking for the invoice gets `403`, and the data never leaves.'],
      keyIdea: 'Fail closed: if the session or the resource cannot be matched, deny.',
      frames: [{ state: view(STRANGER, true, 'other user', { text: 'valid session, wrong owner: the DAL refuses', tone: 'ok' }), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'Where to check auth',
      tag: 'recap',
      body: [
        '- **proxy.ts:** coarse and early, not a boundary.',
        '- **Layouts:** do not rely on them, they may not re-render.',
        '- **DAL:** always, on every data access.',
        '- **Actions and Route Handlers:** always.',
        '- **Client components:** UX only.',
      ],
      keyIdea: 'Defence in depth: the proxy for speed, the DAL for safety.',
      frames: [{ state: view(STRANGER, true, 'other user', { text: 'two layers: a fast early check and a real boundary at the data', tone: 'ok' }) }],
    },
  ],
});
