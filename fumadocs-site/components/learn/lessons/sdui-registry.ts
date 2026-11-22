import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the SDUI notes on the registry and renderer: the server sends a declarative description, the client maps each "type" to a component that
 * already shipped, and code strings are never accepted. A real renderer runs the notes' home screen payload against a registry, so which
 * components render, which one is unknown, and when a new component becomes possible are computed.
 */

type Comp = { type: string; props?: Record<string, unknown>; code?: string };
const REGISTRY_V1 = new Set(['hero', 'product_carousel', 'category_grid']);
const REGISTRY_V2 = new Set([...REGISTRY_V1, 'ai_workout_planner']);

/** The renderer: unknown types are handled explicitly, and executable code is never accepted. */
const render = (c: Comp, registry: Set<string>): { out: string; ok: boolean } => {
  if (c.code !== undefined) return { out: 'rejected: code string', ok: false };
  if (!registry.has(c.type)) return { out: 'null (unknown type)', ok: false };
  return { out: c.type.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(''), ok: true };
};

const SCREEN: Comp[] = [
  { type: 'hero', props: { title: 'Summer Sale' } },
  { type: 'product_carousel', props: { title: 'Trending' } },
  { type: 'category_grid', props: { columns: 2 } },
];
const RENDERED = SCREEN.map((c) => render(c, REGISTRY_V1));
const CODE = render({ type: 'banner', code: 'return <View/>' }, REGISTRY_V1);
const NEW = { type: 'ai_workout_planner' };
const ON_OLD = render(NEW, REGISTRY_V1);
const ON_NEW = render(NEW, REGISTRY_V2);

const TRAD = ['Code', 'PR', 'Build', 'QA', 'Store', 'Users'];
const SDUI = ['Backend', 'App fetches', 'New UI'];

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.5 });

const release = (sdui: boolean): FlowState => {
  const steps = sdui ? SDUI : TRAD;
  const xs = sdui ? [0.3, 2.9, 5.5] : [0.05, 1.2, 2.35, 3.5, 4.65, 5.8];
  const nodes: FlowNode[] = steps.map((s, i) => ({ id: `s${i}`, label: s, kind: sdui ? 'service' : 'worker', x: xs[i], y: 1.7, status: i === steps.length - 1 ? 'active' : 'normal', size: sdui ? 'md' : 'sm' }));
  return {
    nodes,
    links: steps.slice(1).map((_, i) => ({ from: `s${i}`, to: `s${i + 1}` })),
    packets: [hop('s0', 's1', 'change', 0, sdui ? 'ok' : 'req')],
    stats: [
      { label: 'Steps to ship', value: String(steps.length), tone: sdui ? 'ok' : 'bad' },
      { label: 'App store', value: sdui ? 'not needed' : 'required', tone: sdui ? 'ok' : 'bad' },
      { label: 'Users wait', value: sdui ? 'no' : 'for updates', tone: sdui ? 'ok' : 'bad' },
    ],
    note: sdui ? { text: 'the server changes its response and the app fetches it: no release', tone: 'ok' } : { text: 'a layout change goes through code, review, build, QA, a store release and user updates', tone: 'bad' },
  };
};

const lookup = (i: number): FlowState => {
  const c = SCREEN[i];
  const r = RENDERED[i];
  return {
    nodes: [
      { id: 'json', label: c.type, sub: 'JSON from server', kind: 'client', x: 0.1, y: 1.7, status: 'active' },
      { id: 'reg', label: 'Registry', sub: 'type to component', kind: 'gateway', x: 2.9, y: 1.7, status: 'active', items: [...REGISTRY_V1].map((t) => t.slice(0, 9)).slice(0, 3) },
      { id: 'cmp', label: r.out, sub: 'already in the app', kind: 'service', x: 5.5, y: 1.7, status: r.ok ? 'active' : 'down' },
    ],
    links: [{ from: 'json', to: 'reg' }, { from: 'reg', to: 'cmp' }],
    packets: [hop('json', 'reg', 'lookup', 0, 'req'), hop('reg', 'cmp', 'render', 0.6, 'ok')],
    stats: [
      { label: 'Component', value: `${i + 1} of ${SCREEN.length}` },
      { label: 'Registered', value: String(REGISTRY_V1.has(c.type)), tone: 'ok' },
      { label: 'Props', value: Object.keys(c.props ?? {}).join(', ') },
    ],
    note: { text: `${c.type} with its props becomes <${r.out} />`, tone: 'ok' },
  };
};

const boundary = (code: boolean): FlowState => {
  const r = code ? CODE : RENDERED[0];
  return {
    nodes: [
      { id: 'srv', label: code ? 'code string' : 'declarative', sub: code ? 'executable' : 'type and props', kind: 'external', x: 0.1, y: 1.7, status: code ? 'hot' : 'active' },
      { id: 'cli', label: 'Client', sub: 'owns implementation', kind: 'gateway', x: 2.9, y: 1.7, status: 'active' },
      { id: 'out', label: r.ok ? 'Hero' : 'Rejected', sub: r.ok ? 'shipped component' : 'never executed', kind: r.ok ? 'service' : 'storage', x: 5.5, y: 1.7, status: r.ok ? 'active' : 'down' },
    ],
    links: [{ from: 'srv', to: 'cli' }, { from: 'cli', to: 'out' }],
    packets: [hop('srv', 'cli', code ? 'code' : 'banner', 0, code ? 'bad' : 'req'), hop('cli', 'out', r.ok ? 'render' : 'reject', 0.6, r.ok ? 'ok' : 'bad')],
    stats: [
      { label: 'Server sends', value: code ? 'code' : 'description' },
      { label: 'Client does', value: r.ok ? 'looks up type' : 'refuses', tone: r.ok ? 'ok' : 'bad' },
      { label: 'Controls', value: 'composition' },
    ],
    note: code ? { text: 'a code string is never accepted: SDUI is not remote code execution', tone: 'bad' } : { text: 'the server controls composition, the client controls implementation', tone: 'ok' },
  };
};

const oneRule = (installed: 'old' | 'new'): FlowState => {
  const r = installed === 'old' ? ON_OLD : ON_NEW;
  return {
    nodes: [
      { id: 'srv', label: 'Server', sub: 'wants new type', kind: 'service', x: 0.1, y: 1.7, status: 'active' },
      { id: 'app', label: installed === 'old' ? 'App 1.0' : 'App 2.0', sub: installed === 'old' ? 'component missing' : 'component shipped', kind: 'client', x: 2.9, y: 1.7, status: 'active', items: [installed === 'old' ? '3 types' : '4 types'] },
      { id: 'out', label: r.ok ? 'Renders' : 'Cannot', sub: r.ok ? 'the planner' : 'needs a release', kind: r.ok ? 'service' : 'external', x: 5.5, y: 1.7, status: r.ok ? 'active' : 'down' },
    ],
    links: [{ from: 'srv', to: 'app' }, { from: 'app', to: 'out' }],
    packets: [hop('srv', 'app', 'new type', 0, 'req'), hop('app', 'out', r.ok ? 'render' : 'unknown', 0.6, r.ok ? 'ok' : 'bad')],
    stats: [
      { label: 'Installed types', value: String(installed === 'old' ? REGISTRY_V1.size : REGISTRY_V2.size) },
      { label: 'Planner', value: r.ok ? 'renders' : 'unknown', tone: r.ok ? 'ok' : 'bad' },
      { label: 'Needs', value: r.ok ? 'nothing' : 'app release', tone: r.ok ? 'ok' : 'bad' },
    ],
    note: r.ok ? { text: 'the component shipped in this release, so the server can now ask for it', tone: 'ok' } : { text: 'the server can only ask for capabilities the installed client contains', tone: 'bad' },
  };
};

export default defineLesson('flow', {
  slug: 'sdui-registry',
  objectives: [
    { text: 'What SDUI saves compared with a release', step: 1 },
    { text: 'Why the server sends a description, not code', step: 2 },
    { text: 'How the registry turns a type into a component', step: 3 },
    { text: 'Why a new component still needs a release', step: 4 },
  ],
  steps: [
    {
      label: 'Release path',
      title: 'Changing a screen',
      tag: 'problem',
      body: ['Normally a layout change goes through code, review, build, QA, an app store release and waiting for users to update.', 'With **SDUI** the backend changes its response and the app fetches the new screen.'],
      keyIdea: 'No native release, as long as every component already exists in the installed client.',
      frames: [{ state: release(false), hold: 3600 }, { state: release(true), hold: 3600 }],
    },
    {
      label: 'Boundary',
      title: 'Description, not code',
      tag: 'concept',
      body: ['The server sends a **declarative** description: `{ type: "banner", props: ... }`. It does not send code.', 'The client maps the type to a component that is already in the app.'],
      keyIdea: 'The server controls composition. The client controls implementation.',
      frames: [{ state: boundary(false), hold: 3200 }, { state: boundary(true), hold: 3800 }],
    },
    {
      label: 'Registry',
      title: 'type to component',
      tag: 'technique',
      body: ['The **registry** maps a `type` string to a component: `hero` to `Hero`, `product_carousel` to `ProductCarousel`.', 'It doubles as the executable version of your design system.'],
      keyIdea: 'The renderer must handle an unknown type explicitly.',
      frames: [0, 1, 2].map((i) => ({ state: lookup(i), hold: 2600 })),
    },
    {
      label: 'One rule',
      title: 'Only what is installed',
      tag: 'trade-off',
      body: ['A brand-new component such as `ai_workout_planner` must be implemented on each client, registered, released and adopted **before** the server can use it.', 'This one constraint explains versioning, fallbacks and the hybrid shell.'],
      keyIdea: 'The server can only ask an installed client to render what it actually contains.',
      frames: [{ state: oneRule('old'), hold: 3800 }, { state: oneRule('new'), hold: 3800 }],
    },
    {
      label: 'Recap',
      title: 'Registry and renderer',
      tag: 'recap',
      body: [
        '- **SDUI:** server composition, client implementation.',
        '- **Payload:** type, props, never code.',
        '- **Registry:** the type-to-component map.',
        '- **Unknown types:** handled on purpose.',
        '- **New components:** need a release first.',
      ],
      keyIdea: 'Airbnb\'s Ghost Platform and Shopify\'s Store Screen are production examples.',
      frames: [{ state: lookup(0) }],
    },
  ],
});
