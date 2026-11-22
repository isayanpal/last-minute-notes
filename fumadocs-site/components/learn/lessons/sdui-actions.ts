import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the SDUI notes on actions: the payload names an action and the client's ActionDispatcher decides whether and how to run it, against an allowlist
 * of action types and an allowlist of URL hosts. A real dispatcher runs five actions from payloads, so each accept or reject, and which side owns the
 * handler, is computed.
 */

type Action = { type: string; target?: string; url?: string };
const TYPES = new Set(['navigate', 'deeplink', 'open_url', 'open_modal', 'submit_form', 'login', 'add_to_cart']);
const HOSTS = new Set(['shop.example.com']);

function dispatch(a: Action): { ok: boolean; handler: string; reason: string } {
  if (!TYPES.has(a.type)) return { ok: false, handler: '-', reason: `${a.type} is not on the allowlist` };
  if (a.type === 'navigate') return { ok: true, handler: 'router call', reason: 'the server named the destination, the client makes the call' };
  if (a.type === 'open_url' || a.type === 'deeplink') {
    const host = new URL(a.url ?? '').hostname;
    if (!HOSTS.has(host)) return { ok: false, handler: '-', reason: `${host} is not an allowed host` };
    return { ok: true, handler: 'open link', reason: `${host} is on the URL allowlist` };
  }
  return { ok: true, handler: 'client handler', reason: `${a.type} runs code that shipped in the app` };
}

const CASES: { label: string; action: Action }[] = [
  { label: 'Shop Now', action: { type: 'navigate', target: '/products' } },
  { label: 'Add', action: { type: 'add_to_cart' } },
  { label: 'Sale link', action: { type: 'open_url', url: 'https://shop.example.com/sale' } },
  { label: 'Evil link', action: { type: 'open_url', url: 'https://evil.example/pay' } },
  { label: 'Run code', action: { type: 'execute_arbitrary_code' } },
];
const RESULTS = CASES.map((c) => ({ ...c, ...dispatch(c.action) }));

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.5 });

const view = (i: number): FlowState => {
  const r = RESULTS[i];
  return {
    nodes: [
      { id: 'tap', label: r.label, sub: 'user taps', kind: 'client', x: 0.1, y: 1.7, status: 'active', items: [r.action.type.replace('execute_arbitrary_code', 'arbitrary').slice(0, 9)] },
      { id: 'dis', label: 'Dispatcher', sub: 'reads the action', kind: 'worker', x: 1.9, y: 1.7, status: 'active' },
      { id: 'al', label: 'Allowlist', sub: 'types and hosts', kind: 'gateway', x: 3.8, y: 1.7, status: r.ok ? 'active' : 'hot' },
      { id: 'out', label: r.ok ? r.handler : 'Rejected', sub: r.ok ? 'owned by client' : 'logged', kind: r.ok ? 'service' : 'external', x: 5.7, y: 1.7, status: r.ok ? 'active' : 'down' },
    ],
    links: [{ from: 'tap', to: 'dis' }, { from: 'dis', to: 'al' }, { from: 'al', to: 'out' }],
    packets: [hop('tap', 'dis', r.action.type.slice(0, 10), 0, 'req'), hop('dis', 'al', 'check', 0.5, 'req'), hop('al', 'out', r.ok ? 'run' : 'reject', 1.0, r.ok ? 'ok' : 'bad')],
    stats: [
      { label: 'Action type', value: r.action.type.replace('execute_arbitrary_code', 'arbitrary') },
      { label: 'Allowed', value: String(r.ok), tone: r.ok ? 'ok' : 'bad' },
      { label: 'Runs as', value: r.handler },
    ],
    note: { text: r.reason, tone: r.ok ? 'ok' : 'bad' },
  };
};

export default defineLesson('flow', {
  slug: 'sdui-actions',
  objectives: [
    { text: 'What an action in a payload is', step: 1 },
    { text: 'Who makes the navigation call', step: 2 },
    { text: 'Which actions the client runs for itself', step: 3 },
    { text: 'What gets rejected', step: 4 },
  ],
  steps: [
    {
      label: 'Actions',
      title: 'The server describes taps too',
      tag: 'problem',
      body: ['A button in the payload carries an **action**: `{ type: "navigate", target: "/products" }`.', 'The payload only names the action. The client decides whether and how to run it.'],
      keyIdea: 'Actions are intent, not code.',
      frames: [{ state: view(1), hold: 4000 }],
    },
    {
      label: 'navigate',
      title: 'The client owns the call',
      tag: 'concept',
      body: ['For `navigate` the server names the destination, for example a screen and an id.', 'The client makes the actual navigation call: React Navigation on mobile, the router on web.'],
      keyIdea: 'The schema expresses intent, not platform implementation.',
      frames: [{ state: view(0), hold: 4000 }],
    },
    {
      label: 'Handlers',
      title: 'Client-owned handlers',
      tag: 'technique',
      body: ['`add_to_cart`, `login`, `open_modal` and `submit_form` run **handlers that shipped in the app**.', 'Links are checked against a URL allowlist first.'],
      keyIdea: 'The allowlist: navigate, deeplink, open_url, open_modal, submit_form, login, add_to_cart.',
      frames: [{ state: view(2), hold: 4000 }],
    },
    {
      label: 'Rejected',
      title: 'Never arbitrary code',
      tag: 'trade-off',
      body: ['An unknown type such as `execute_arbitrary_code` is rejected and logged. A link to a host that is not allowlisted is rejected too.', 'The payload cannot talk the client into anything it did not ship.'],
      keyIdea: 'Never allow arbitrary native actions.',
      frames: [3, 4].map((i) => ({ state: view(i), hold: 3600 })),
    },
    {
      label: 'Recap',
      title: 'Action dispatch',
      tag: 'recap',
      body: [
        '- **Action:** a type plus a target.',
        '- **Dispatcher:** reads it, checks the allowlist.',
        '- **navigate:** server names, client calls.',
        '- **Handlers:** client-owned code.',
        '- **Rejected:** unknown types and unlisted hosts.',
      ],
      keyIdea: 'The same intent can be a sheet on iOS and a modal on web.',
      frames: [{ state: view(4) }],
    },
  ],
});
