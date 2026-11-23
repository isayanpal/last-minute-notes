import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Layout: Browser (x 0.2), Edge (x 1.9), Server (x 3.7), Database (x 5.5) on y 1.7.
 * Status codes, error table and probe split come from the Backend Fundamentals notes.
 */

const BROWSER: FlowNode = { id: 'b', label: 'Browser', kind: 'client', shape: 'laptop', x: 0.2, y: 1.7 };
const EDGE: FlowNode = { id: 'e', label: 'Edge', sub: 'CDN, LB, gateway', kind: 'lb', x: 1.9, y: 1.7 };
const SERVER: FlowNode = { id: 's', label: 'Server', sub: 'your app', kind: 'service', shape: 'server', x: 3.7, y: 1.7 };
const DB: FlowNode = { id: 'd', label: 'Database', kind: 'db', shape: 'db', x: 5.5, y: 1.7 };
const LINKS = [
  { from: 'b', to: 'e' },
  { from: 'e', to: 's' },
  { from: 's', to: 'd' },
];

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });

// Step 1: one call, four hops.
const trip = (withDb: boolean): FlowState => ({
  nodes: [BROWSER, EDGE, SERVER, DB],
  links: LINKS,
  packets: withDb
    ? [hop('b', 'e', 'GET /users/42', 0), hop('e', 's', 'GET', 0.6), hop('s', 'd', 'SELECT', 1.2, 'data'), hop('d', 's', 'row', 1.8, 'res'), hop('s', 'e', '200', 2.4, 'res'), hop('e', 'b', '200', 3, 'res')]
    : [hop('b', 'e', 'GET /users/42', 0), hop('e', 's', 'GET', 0.6)],
  stats: [
    { label: 'Before this', value: 'DNS, TCP, TLS' },
    { label: 'Hops', value: '4' },
    { label: 'Reuse', value: 'keep-alive', tone: 'ok' },
  ],
  note: { text: 'connections stay open so the next request skips the handshakes', tone: 'accent' },
});

// Step 2: the edge does shared work so every app does not have to.
const edge: FlowState = {
  nodes: [BROWSER, { ...EDGE, status: 'active', items: ['TLS', 'limits', 'cache', 'route'] }, SERVER, DB],
  links: LINKS,
  packets: [hop('b', 'e', 'GET', 0), hop('e', 's', 'GET', 0.7)],
  stats: [
    { label: 'Edge', value: 'terminates TLS' },
    { label: 'Also', value: 'cache, limit' },
    { label: 'App sees', value: 'clean request' },
  ],
  note: { text: 'CDN, load balancer and gateway handle the cross-cutting parts', tone: 'accent' },
};

// Step 3: inside the app. Each stage adds a chip so the order is visible.
const STAGES = ['route', 'authn', 'validate', 'handler'];
const inside = (n: number): FlowState => ({
  nodes: [{ ...BROWSER, status: 'dim' }, { ...EDGE, status: 'dim' }, { ...SERVER, status: 'active', items: STAGES.slice(0, n) }, { ...DB, status: n >= 4 ? 'normal' : 'dim' }],
  links: LINKS,
  packets: n >= 4 ? [hop('s', 'd', 'SELECT', 0, 'data'), hop('d', 's', 'row', 0.6, 'res')] : [],
  stats: [
    { label: 'Stage', value: STAGES[n - 1] },
    { label: 'Cheap first', value: 'fail early', tone: 'ok' },
    { label: 'Then', value: n >= 4 ? 'serialize' : 'next stage' },
  ],
  note: { text: ['match the path to a handler', 'who is calling?', 'is the input acceptable?', 'business logic and data access'][n - 1], tone: 'accent' },
});

// Step 4: validate at the boundary, reject early with field errors.
const validate = (bad: boolean): FlowState => ({
  nodes: [BROWSER, EDGE, { ...SERVER, status: bad ? 'down' : 'active', items: ['validate'] }, { ...DB, status: bad ? 'dim' : 'normal' }],
  links: LINKS,
  packets: bad
    ? [hop('b', 'e', 'POST', 0), hop('e', 's', 'POST', 0.6), hop('s', 'e', '422', 1.2, 'bad'), hop('e', 'b', '422', 1.8, 'bad')]
    : [hop('b', 'e', 'POST', 0), hop('e', 's', 'POST', 0.6), hop('s', 'd', 'INSERT', 1.2, 'data')],
  stats: bad
    ? [{ label: 'Result', value: '422 + fields', tone: 'bad' }, { label: 'Never reaches', value: 'the database', tone: 'ok' }, { label: 'Allowlist', value: 'no isAdmin' }]
    : [{ label: 'Checks', value: 'shape, format' }, { label: 'Also', value: 'ranges, rules' }, { label: 'Tools', value: 'Zod, Bean Val.' }],
  note: bad ? { text: 'bad input is rejected at the boundary with machine-readable errors', tone: 'bad' } : { text: 'valid input flows on, only allowed fields are bound', tone: 'ok' },
});

// Step 5: one central handler maps failures to status codes. Details stay in the logs.
type Failure = { code: string; title: string; kind: string; level: string; node?: Partial<FlowNode>; db?: Partial<FlowNode> };
const FAILS: Failure[] = [
  { code: '401', title: 'bad token', kind: 'authentication', level: 'info' },
  { code: '409', title: 'duplicate email', kind: 'conflict', level: 'info' },
  { code: '503', title: 'database down', kind: 'dependency', level: 'error', db: { status: 'down' } },
  { code: '500', title: 'a bug', kind: 'unexpected', level: 'error + trace', node: { status: 'hot' } },
];
const failure = (f: Failure): FlowState => ({
  nodes: [BROWSER, EDGE, { ...SERVER, sub: f.title, status: 'active', ...f.node }, { ...DB, ...f.db }],
  links: LINKS,
  packets: [hop('b', 'e', 'req', 0), hop('e', 's', 'req', 0.6), hop('s', 'e', f.code, 1.2, 'bad'), hop('e', 'b', f.code, 1.8, 'bad')],
  stats: [
    { label: 'Kind', value: f.kind },
    { label: 'Status', value: f.code, tone: 'bad' },
    { label: 'Log level', value: f.level },
  ],
  note: f.code === '500' ? { text: 'generic body plus an error id, stack trace stays in the logs', tone: 'bad' } : { text: 'central handler: controllers stay clean, bodies stay consistent', tone: 'accent' },
});

// Step 6: liveness is shallow, readiness is per instance. The LB routes only to ready ones.
const probes = (ready: boolean): FlowState => ({
  nodes: [
    { id: 'lb', label: 'Load balancer', kind: 'lb', shape: 'lb', x: 0.4, y: 1.7 },
    { id: 'a', label: 'Instance A', sub: '/readyz ok', kind: 'service', shape: 'server', x: 3.4, y: 0.7, badge: { text: 'ready', tone: 'ok' } },
    { id: 'c', label: 'Instance B', sub: ready ? '/readyz ok' : '/readyz fails', kind: 'service', shape: 'server', x: 3.4, y: 2.8, status: ready ? 'normal' : 'hot', badge: { text: ready ? 'ready' : 'not ready', tone: ready ? 'ok' : 'bad' } },
    { id: 'd', label: 'Database', kind: 'db', shape: 'db', x: 5.7, y: 1.7 },
  ],
  links: [{ from: 'lb', to: 'a' }, { from: 'lb', to: 'c', dashed: !ready }, { from: 'a', to: 'd' }, { from: 'c', to: 'd' }],
  packets: ready
    ? [{ from: 'lb', to: 'a', label: 'req', dur: 0.8 }, { from: 'lb', to: 'c', label: 'req', delay: 0.3, dur: 0.8 }]
    : [{ from: 'lb', to: 'a', label: 'req', dur: 0.8 }, { from: 'lb', to: 'a', label: 'req', delay: 0.4, dur: 0.8 }],
  stats: [
    { label: 'Liveness', value: 'shallow' },
    { label: 'Readiness', value: 'this instance' },
    { label: 'If not ready', value: ready ? 'in rotation' : 'no traffic', tone: ready ? 'neutral' : 'ok' },
  ],
  note: ready ? { text: 'liveness must not check the database: an outage would restart everything', tone: 'accent' } : { text: 'readiness fails: stop routing here, do not restart it', tone: 'ok' },
});

export default defineLesson('flow', {
  slug: 'be-request-lifecycle',
  objectives: [
    { text: 'The hops a request takes before and inside your app', step: 1 },
    { text: 'What the edge does so your app does not have to', step: 2 },
    { text: 'The order of stages inside a request handler', step: 3 },
    { text: 'Why validation sits at the boundary', step: 4 },
    { text: 'How a central handler maps failures to status codes', step: 5 },
    { text: 'Liveness versus readiness probes', step: 6 },
  ],
  steps: [
    {
      label: 'The trip',
      title: 'What happens on one GET',
      tag: 'problem',
      body: ['A browser calls `/users/42`. After DNS, TCP and TLS, the request goes through an edge, your server, the database, and back as JSON.', 'Connections stay open (keep-alive, HTTP/2) so later requests skip the handshakes.'],
      keyIdea: 'Most backend time is spent waiting on other systems, not computing.',
      frames: [{ state: trip(false), hold: 1900 }, { state: trip(true), hold: 4200 }],
    },
    {
      label: 'The edge',
      title: 'Shared work before your code',
      tag: 'concept',
      body: ['A CDN, load balancer and often an API gateway **terminate TLS, route, rate limit and cache**.', 'Your app then receives an already cleaned-up request instead of repeating this in every service.'],
      keyIdea: 'Put cross-cutting traffic concerns at the edge and business rules in the app.',
      frames: [{ state: edge, hold: 3000 }],
    },
    {
      label: 'Pipeline',
      title: 'Route, authenticate, validate, handle',
      tag: 'technique',
      body: ['Inside the app a request moves through stages: **routing**, **authentication**, **validation**, then the handler with its business logic and data access.', 'Cheap checks come first so bad requests fail before touching the database.'],
      keyIdea: 'Order matters: reject unauthenticated or invalid calls before spending a database query on them.',
      frames: [1, 2, 3, 4].map((n) => ({ state: inside(n), hold: n === 4 ? 2600 : 1400 })),
    },
    {
      label: 'Validation',
      title: 'Never trust input',
      tag: 'technique',
      body: ['Validate **shape**, **format**, **ranges** and **business rules** at the boundary with a schema library (Zod, Joi, Bean Validation).', '**Allowlist** the fields you bind so a caller cannot send `isAdmin: true`. Validate on the way out too.'],
      keyIdea: 'Reject early with a clear, machine-readable message: 400 or 422 with field errors.',
      frames: [{ state: validate(false), hold: 2400 }, { state: validate(true), hold: 3000 }],
    },
    {
      label: 'Errors',
      title: 'One handler, honest status codes',
      tag: 'technique',
      body: ['A **central error handler** maps exceptions to responses: 401 for bad auth, 409 for conflicts, 503 for a failed dependency, 500 for bugs.', 'Never leak stack traces or SQL. Log the details with a **correlation id** and return only the id.'],
      keyIdea: 'Use RFC 9457 Problem Details for a consistent error body.',
      frames: FAILS.map((f) => ({ state: failure(f), hold: 2600 })),
    },
    {
      label: 'Health',
      title: 'Liveness is not readiness',
      tag: 'in practice',
      body: ['**Liveness** (`/healthz`) says the process is alive, and a failure restarts it. **Readiness** (`/readyz`) says this instance can serve, and a failure removes it from rotation.', 'Keep liveness shallow. If it checks the database, a database outage restarts every instance in a loop.'],
      keyIdea: 'Readiness reflects whether this instance can serve, not whether the whole system is healthy.',
      frames: [{ state: probes(true), hold: 2400 }, { state: probes(false), hold: 3000 }],
    },
    {
      label: 'Recap',
      title: 'A request, end to end',
      tag: 'recap',
      body: [
        '- **Edge:** TLS, rate limits, cache, routing.',
        '- **App pipeline:** route, authenticate, validate, handle.',
        '- **Validation:** at the boundary, allowlisted fields.',
        '- **Errors:** one central handler, no leaked internals, correlation id.',
        '- **Probes:** shallow liveness, per-instance readiness.',
      ],
      keyIdea: 'Structured logs with a request id on every hop turn this diagram into something you can debug.',
      frames: [{ state: inside(4) }],
    },
  ],
});
