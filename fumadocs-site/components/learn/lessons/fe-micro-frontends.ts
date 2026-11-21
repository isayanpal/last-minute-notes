import { defineLesson } from '../define';
import type { FlowNode, FlowState } from '../engines/flow';

/*
 * Layout: browser (x 0), shell (x 1.6), micro-frontends (x 3.4), shared pieces (x 5.4).
 */

const BROWSER: FlowNode = { id: 'b', label: 'Browser', kind: 'client', x: 0, y: 1.7, size: 'sm' };
const SHELL = (extra: Partial<FlowNode> = {}): FlowNode => ({ id: 'sh', label: 'Shell', sub: 'auth, nav, routing', kind: 'gateway', x: 1.7, y: 1.7, size: 'sm', ...extra });
const MF = (id: string, label: string, y: number, extra: Partial<FlowNode> = {}): FlowNode => ({ id, label, sub: 'one team', kind: 'service', x: 3.7, y, size: 'sm', ...extra });
const DS: FlowNode = { id: 'ds', label: 'Design system', sub: 'tokens, singletons', kind: 'storage', x: 5.5, y: 1.7, size: 'sm' };

// Step 1: many teams, one pipeline.
const MONOLITH: FlowState = {
  nodes: [
    { id: 'ta', label: 'Team A', sub: 'catalog', kind: 'worker', x: 0.1, y: 0.2, size: 'sm' },
    { id: 'tb', label: 'Team B', sub: 'checkout', kind: 'worker', x: 0.1, y: 1.7, size: 'sm' },
    { id: 'tc', label: 'Team C', sub: 'account', kind: 'worker', x: 0.1, y: 3.2, size: 'sm' },
    { id: 'app', label: 'One frontend', sub: 'one build+deploy', kind: 'service', x: 3.0, y: 1.7, status: 'hot', badge: { text: 'merge queue', tone: 'bad' }, items: ['A', 'B', 'C'] },
    { id: 'rel', label: 'Release', sub: 'weekly train', kind: 'cdn', x: 5.5, y: 1.7, size: 'sm' },
  ],
  links: [
    { from: 'ta', to: 'app' },
    { from: 'tb', to: 'app' },
    { from: 'tc', to: 'app' },
    { from: 'app', to: 'rel' },
  ],
  packets: [
    { from: 'ta', to: 'app', label: 'PR', dur: 0.9 },
    { from: 'tb', to: 'app', label: 'PR', dur: 0.9, delay: 0.2 },
    { from: 'tc', to: 'app', label: 'PR', dur: 0.9, delay: 0.4 },
    { from: 'app', to: 'rel', label: 'all or none', delay: 1.6, dur: 0.9, tone: 'data' },
  ],
  stats: [
    { label: 'Teams', value: '3 or more' },
    { label: 'Deploys', value: 'coupled', tone: 'bad' },
    { label: 'Bottleneck', value: 'organization', tone: 'bad' },
  ],
  note: { text: 'organizational coupling, not code, is the problem', tone: 'bad' },
};

// Step 2: the shell and the micro-frontends.
const COMPOSED: FlowState = {
  nodes: [BROWSER, SHELL(), MF('cat', 'Catalog', 0.2), MF('chk', 'Checkout', 1.7), MF('acc', 'Account', 3.2), DS],
  links: [
    { from: 'b', to: 'sh' },
    { from: 'sh', to: 'cat' },
    { from: 'sh', to: 'chk' },
    { from: 'sh', to: 'acc' },
    { from: 'cat', to: 'ds', dashed: true },
    { from: 'chk', to: 'ds', dashed: true },
    { from: 'acc', to: 'ds', dashed: true },
  ],
  packets: [
    { from: 'b', to: 'sh', label: '/checkout', dur: 0.7 },
    { from: 'sh', to: 'chk', label: 'mount', delay: 0.8, dur: 0.8, tone: 'accent' },
  ],
  stats: [
    { label: 'Deploys', value: 'independent', tone: 'ok' },
    { label: 'Ownership', value: 'per team', tone: 'ok' },
    { label: 'Shared', value: 'design system' },
  ],
  note: { text: 'independently built, tested and deployed, one product', tone: 'accent' },
};

// Step 3: composition approaches, one frame each.
const approach = (body: FlowNode[], links: FlowState['links'], note: string, stats: FlowState['stats'], extra: Partial<FlowState> = {}): FlowState => ({
  nodes: body,
  links,
  stats,
  note: { text: note, tone: 'accent' },
  ...extra,
});

const BUILD_TIME = approach(
  [
    { id: 'ta', label: 'Team A pkg', sub: 'npm', kind: 'storage', x: 0.1, y: 0.4, size: 'sm' },
    { id: 'tb', label: 'Team B pkg', sub: 'npm', kind: 'storage', x: 0.1, y: 3.0, size: 'sm' },
    { id: 'sh', label: 'Shell build', sub: 'installs both', kind: 'service', x: 2.9, y: 1.7, size: 'sm' },
    { id: 'rel', label: 'One deploy', kind: 'cdn', x: 5.4, y: 1.7, size: 'sm', badge: { text: 'rebuild', tone: 'bad' } },
  ],
  [
    { from: 'ta', to: 'sh' },
    { from: 'tb', to: 'sh' },
    { from: 'sh', to: 'rel' },
  ],
  'build-time packages: simple, but any change rebuilds the shell',
  [{ label: 'Approach', value: 'build time' }, { label: 'Pro', value: 'simple', tone: 'ok' }, { label: 'Con', value: 'coupled', tone: 'bad' }],
);

const RUNTIME = approach(
  [
    BROWSER,
    SHELL({ x: 1.9 }),
    { id: 'r1', label: 'Remote A', sub: 'own URL', kind: 'cdn', x: 4.0, y: 0.4, size: 'sm' },
    { id: 'r2', label: 'Remote B', sub: 'own URL', kind: 'cdn', x: 4.0, y: 3.0, size: 'sm' },
  ],
  [
    { from: 'b', to: 'sh' },
    { from: 'sh', to: 'r1' },
    { from: 'sh', to: 'r2' },
  ],
  'runtime loading (Module Federation, import maps): deploy remotes alone',
  [{ label: 'Approach', value: 'runtime' }, { label: 'Pro', value: 'solo deploys', tone: 'ok' }, { label: 'Con', value: 'version skew', tone: 'bad' }],
  {
    packets: [
      { from: 'sh', to: 'r1', label: 'import(url)', dur: 0.8, tone: 'accent' },
      { from: 'sh', to: 'r2', label: 'import(url)', dur: 0.8, delay: 0.3, tone: 'accent' },
    ],
  },
);

const IFRAMES = approach(
  [
    SHELL({ x: 0.2 }),
    { id: 'f1', label: 'iframe A', sub: 'own CSS + JS', kind: 'service', x: 3.0, y: 0.5, size: 'sm' },
    { id: 'f2', label: 'iframe B', sub: 'own CSS + JS', kind: 'service', x: 3.0, y: 2.9, size: 'sm' },
  ],
  [
    { from: 'sh', to: 'f1' },
    { from: 'sh', to: 'f2' },
  ],
  'iframes: strong isolation, awkward routing, sizing and a11y',
  [{ label: 'Approach', value: 'iframes' }, { label: 'Pro', value: 'isolation', tone: 'ok' }, { label: 'Con', value: 'routing, a11y', tone: 'bad' }],
  { groups: [{ label: 'security boundary', nodes: ['f1', 'f2'], tone: 'accent' }] },
);

const EDGE = approach(
  [
    BROWSER,
    { id: 'edge', label: 'Edge', sub: 'stitches fragments', kind: 'cdn', x: 1.9, y: 1.7, size: 'sm' },
    { id: 'p1', label: 'Fragment A', kind: 'service', x: 4.2, y: 0.4, size: 'sm' },
    { id: 'p2', label: 'Fragment B', kind: 'service', x: 4.2, y: 3.0, size: 'sm' },
  ],
  [
    { from: 'b', to: 'edge' },
    { from: 'edge', to: 'p1' },
    { from: 'edge', to: 'p2' },
  ],
  'server or edge composition: good SEO and first paint',
  [{ label: 'Approach', value: 'server / edge' }, { label: 'Pro', value: 'SEO, 1st paint', tone: 'ok' }, { label: 'Con', value: 'fragment cache', tone: 'bad' }],
  {
    packets: [
      { from: 'b', to: 'edge', dur: 0.6 },
      { from: 'edge', to: 'p1', delay: 0.7, dur: 0.7 },
      { from: 'edge', to: 'p2', delay: 0.7, dur: 0.7 },
      { from: 'p1', to: 'edge', delay: 1.5, dur: 0.7, tone: 'res' },
      { from: 'p2', to: 'edge', delay: 1.5, dur: 0.7, tone: 'res' },
      { from: 'edge', to: 'b', delay: 2.3, dur: 0.6, tone: 'res', label: 'one page' },
    ],
  },
);

// Step 4: contracts. Talk through the URL and a few typed events, never a shared mutable store.
const CONTRACT = (bad: boolean): FlowState => ({
  nodes: [
    MF('cat', 'Catalog', 0.3, { x: 0.2 }),
    MF('chk', 'Checkout', 3.1, { x: 0.2 }),
    bad
      ? { id: 'bus', label: 'Global store', sub: 'shared and mutable', kind: 'db', x: 3.0, y: 1.7, status: 'hot', badge: { text: 'coupling', tone: 'bad' } }
      : { id: 'bus', label: 'URL + events', sub: 'typed, small', kind: 'queue', x: 3.0, y: 1.7, status: 'active', badge: { text: 'contract', tone: 'ok' }, items: ['cart:add', 'login'] },
    SHELL({ x: 5.4, y: 1.7, sub: 'auth, nav, errors' }),
  ],
  links: [
    { from: 'cat', to: 'bus' },
    { from: 'chk', to: 'bus' },
    { from: 'bus', to: 'sh', dashed: true },
  ],
  packets: bad
    ? [
        { from: 'cat', to: 'bus', label: 'write cart', dur: 0.7, tone: 'bad' },
        { from: 'chk', to: 'bus', label: 'write cart', dur: 0.7, delay: 0.2, tone: 'bad' },
      ]
    : [
        { from: 'cat', to: 'bus', label: 'cart:add', dur: 0.7, tone: 'ok' },
        { from: 'bus', to: 'chk', label: 'cart:add', delay: 0.8, dur: 0.7, tone: 'ok' },
      ],
  stats: [
    { label: 'Shared state', value: bad ? 'global store' : 'avoided', tone: bad ? 'bad' : 'ok' },
    { label: 'Shell does', value: 'auth, nav, err' },
    { label: 'Shared deps', value: 'framework + DS' },
  ],
  note: bad ? { text: 'teams now deploy together again', tone: 'bad' } : { text: 'prefer the URL and a small typed event set', tone: 'ok' },
});

// Step 5: a failing remote must not blank the page.
const failing = (contained: boolean): FlowState => ({
  nodes: [
    SHELL({ x: 0.2, status: contained ? 'active' : 'hot' }),
    MF('cat', 'Catalog', 0.3, { x: 3.0 }),
    MF('rec', 'Recs', 1.7, { x: 3.0, status: 'down', sub: 'remote timed out', badge: contained ? { text: 'fallback', tone: 'ok' } : { text: 'blank page', tone: 'bad' } }),
    MF('chk', 'Checkout', 3.1, { x: 3.0 }),
  ],
  links: [
    { from: 'sh', to: 'cat' },
    { from: 'sh', to: 'rec', dashed: true },
    { from: 'sh', to: 'chk' },
  ],
  packets: [
    { from: 'sh', to: 'cat', dur: 0.7, tone: 'ok' },
    { from: 'sh', to: 'rec', label: 'timeout', dur: 0.9, tone: 'bad' },
    { from: 'sh', to: 'chk', dur: 0.7, tone: 'ok' },
  ],
  stats: [
    { label: 'Boundary', value: contained ? 'per remote' : 'none', tone: contained ? 'ok' : 'bad' },
    { label: 'Page', value: contained ? 'still works' : 'blank', tone: contained ? 'ok' : 'bad' },
    { label: 'Load limit', value: 'timeout' },
  ],
  note: contained ? { text: 'hide the section, keep the page', tone: 'ok' } : { text: 'one remote takes the whole page down', tone: 'bad' },
});

// Step 6: when to use them. Teams, not code size, decide.
const choose = (many: boolean): FlowState => ({
  nodes: [
    { id: 'org', label: many ? '10+ teams' : '3 teams', sub: many ? 'ship on own' : 'one product', kind: 'worker', x: 0.2, y: 1.7, meter: { value: many ? 0.9 : 0.3, label: 'teams', tone: many ? 'bad' : 'ok' } },
    many
      ? { id: 'pick', label: 'Micro-frontends', sub: 'org coupling', kind: 'gateway', x: 3.4, y: 1.7, status: 'active', badge: { text: 'worth the cost', tone: 'ok' } }
      : { id: 'pick', label: 'Monorepo', sub: '+ module bounds', kind: 'storage', x: 3.4, y: 1.7, status: 'active', badge: { text: 'start here', tone: 'ok' } },
    { id: 'cost', label: many ? 'Duplicate deps' : 'Option kept', sub: many ? 'UX, debug cost' : 'can split later', kind: 'external', x: 5.6, y: 1.7, size: 'sm', status: many ? 'hot' : 'normal' },
  ],
  links: [
    { from: 'org', to: 'pick' },
    { from: 'pick', to: 'cost', dashed: true },
  ],
  packets: [{ from: 'org', to: 'pick', dur: 0.9, tone: 'accent' }],
  stats: [
    { label: 'Use when', value: '5 to 10+ teams' },
    { label: 'Not for', value: 'messy code', tone: 'bad' },
    { label: 'First step', value: 'monorepo', tone: 'ok' },
  ],
  note: many ? { text: 'many teams releasing independently: split', tone: 'accent' } : { text: 'do not use them to fix a messy codebase', tone: 'accent' },
});

export default defineLesson('flow', {
  slug: 'fe-micro-frontends',
  objectives: [
    { text: 'The problem micro-frontends solve, and the one they do not', step: 1 },
    { text: 'The shell and what it is responsible for', step: 2 },
    { text: 'Four ways to compose independently deployed pieces', step: 3 },
    { text: 'How pieces talk without becoming coupled', step: 4 },
    { text: 'Containing failures, and when not to use them', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Many teams, one pipeline',
      tag: 'problem',
      body: ['As teams grow, one frontend means one build, one merge queue and one release train. Teams wait on each other.', 'The bottleneck is organizational coupling, not the code.'],
      keyIdea: 'Micro-frontends split a frontend into independently built, tested and deployed pieces owned by separate teams.',
      frames: [{ state: MONOLITH, hold: 3600 }],
    },
    {
      label: 'The shell',
      title: 'A thin shell composes the pieces',
      tag: 'concept',
      body: ['The **shell** owns authentication, global navigation, routing between apps, error boundaries and shared observability. Nothing else.', 'Each micro-frontend mounts into it, and all share one design system and tokens.'],
      keyIdea: 'Keep the shell small. Every extra responsibility becomes shared coupling again.',
      frames: [{ state: COMPOSED, hold: 3400 }],
    },
    {
      label: 'Composition',
      title: 'Four ways to put it together',
      tag: 'technique',
      body: ['**Build-time packages**, **runtime loading** (Module Federation, import maps), **iframes**, and **server or edge composition**.', 'Route-based splitting and Web Components are other options. Each trades isolation against complexity.'],
      keyIdea: 'Runtime loading gives independent deploys, but shared dependency versions can skew.',
      frames: [{ state: BUILD_TIME, hold: 2600 }, { state: RUNTIME, hold: 2800 }, { state: IFRAMES, hold: 2600 }, { state: EDGE, hold: 3400 }],
    },
    {
      label: 'Contracts',
      title: 'Talk through the URL and events',
      tag: 'trade-off',
      body: ['Prefer the URL and a small set of custom events or a typed event bus. Avoid shared mutable global stores.', 'Share the framework runtime and design system as singletons, and accept duplicates for the rest.'],
      keyIdea: 'A shared store quietly puts the teams back into one release train.',
      frames: [{ state: CONTRACT(true), hold: 2600 }, { state: CONTRACT(false), hold: 3000 }],
    },
    {
      label: 'Resilience',
      title: 'A failing remote must not blank the page',
      tag: 'in practice',
      body: ['Wrap each remote in an error boundary with a timeout and a fallback. If recommendations fail, hide the section.', 'Deploy each micro-frontend with its own pipeline and canary, and roll back by pointing to the previous remote.'],
      keyIdea: 'Contract tests between the shell and remotes, plus end-to-end tests of the composed app.',
      frames: [{ state: failing(false), hold: 2600 }, { state: failing(true), hold: 3000 }],
    },
    {
      label: 'When to use',
      title: 'Teams decide, not lines of code',
      tag: 'trade-off',
      body: ['Use them when many teams (often more than 5 to 10) must release independently.', 'The costs are duplicated dependencies, inconsistent UX, harder performance, harder debugging and cross-app state and routing.'],
      keyIdea: 'A well-structured monorepo with enforced module boundaries is usually the better first step, and keeps the option to split later.',
      frames: [{ state: choose(false), hold: 2600 }, { state: choose(true), hold: 3000 }],
    },
    {
      label: 'Recap',
      title: 'Micro-frontends in one list',
      tag: 'recap',
      body: [
        '- **Why:** independent releases for many teams.',
        '- **Shell:** auth, navigation, routing, error boundaries, observability.',
        '- **Compose:** build-time, runtime, iframes, Web Components, server or edge, route based.',
        '- **Talk:** URL and typed events, share only the framework and design system.',
        '- **Protect:** fallback per remote, budgets per app, contract tests.',
      ],
      keyIdea: 'Choose the simplest architecture that meets the requirements. Say what the team count would have to be to change your mind.',
      frames: [{ state: COMPOSED, hold: 3400 }],
    },
  ],
});
