import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the SDUI notes on runtime validation and the layers of trust. A real validator checks a payload through the schema, the registry, the action
 * allowlist and the URL allowlist, and reports the first layer that rejects it, so every verdict is computed.
 */

type Payload = { label: string; component: { type: string; props?: { title?: string }; action?: { type: string; url?: string } } };
type Layer = 'schema' | 'registry' | 'actions' | 'urls';
const REGISTRY = new Set(['hero', 'button']);
const ACTIONS = new Set(['navigate', 'deeplink', 'open_url', 'open_modal', 'submit_form', 'login', 'add_to_cart']);
const URL_HOSTS = new Set(['shop.example.com']);

function validate(p: Payload): { failed: Layer | null; reason: string } {
  const c = p.component;
  if (typeof c.type !== 'string' || (c.type === 'hero' && typeof c.props?.title !== 'string')) return { failed: 'schema', reason: 'hero needs a string title' };
  if (!REGISTRY.has(c.type)) return { failed: 'registry', reason: `unknown type ${c.type}` };
  if (c.action && !ACTIONS.has(c.action.type)) return { failed: 'actions', reason: `${c.action.type} is not allowlisted` };
  if (c.action?.url) {
    const host = new URL(c.action.url).hostname;
    if (!URL_HOSTS.has(host)) return { failed: 'urls', reason: `${host} is not allowlisted` };
  }
  return { failed: null, reason: 'all layers passed' };
}

const CASES: Payload[] = [
  { label: 'valid hero', component: { type: 'hero', props: { title: 'Summer Sale' } } },
  { label: 'missing title', component: { type: 'hero', props: {} } },
  { label: 'unknown type', component: { type: 'ai_widget' } },
  { label: 'code action', component: { type: 'button', action: { type: 'execute_arbitrary_code' } } },
  { label: 'evil URL', component: { type: 'button', action: { type: 'open_url', url: 'https://evil.example/pay' } } },
  { label: 'good button', component: { type: 'button', action: { type: 'open_url', url: 'https://shop.example.com/sale' } } },
];
const RESULTS = CASES.map((c) => ({ ...c, ...validate(c) }));

const LAYERS: Layer[] = ['schema', 'registry', 'actions', 'urls'];
const LABEL: Record<Layer, string> = { schema: 'Schema', registry: 'Registry', actions: 'Actions', urls: 'URLs' };
const POS = [0.05, 1.2, 2.35, 3.5, 4.65, 5.8];
const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.4 });

const view = (i: number): FlowState => {
  const r = RESULTS[i];
  const failIdx = r.failed ? LAYERS.indexOf(r.failed) : LAYERS.length;
  const nodes: FlowNode[] = [
    { id: 'in', label: 'Payload', sub: r.label, kind: 'client', x: POS[0], y: 1.7, size: 'sm', status: 'active' },
    ...LAYERS.map((l, k): FlowNode => ({ id: l, label: LABEL[l], sub: k < failIdx ? 'passed' : k === failIdx ? 'rejected' : 'not reached', kind: 'gateway', x: POS[k + 1], y: 1.7, size: 'sm', status: k < failIdx ? 'normal' : k === failIdx ? 'down' : 'dim' })),
    { id: 'out', label: r.failed ? 'Fallback' : 'Render', sub: r.failed ? 'safe screen' : 'the component', kind: r.failed ? 'storage' : 'service', x: POS[5], y: 3.0, size: 'sm', status: r.failed ? 'hot' : 'active' },
  ];
  const path = ['in', ...LAYERS.slice(0, Math.min(failIdx + 1, LAYERS.length))];
  const packets: Packet[] = path.slice(0, -1).map((id, k) => hop(id, path[k + 1], k === path.length - 2 && r.failed ? 'fail' : 'ok', k * 0.45, k === path.length - 2 && r.failed ? 'bad' : 'ok'));
  return {
    nodes,
    links: [{ from: 'in', to: 'schema' }, ...LAYERS.slice(1).map((l, k) => ({ from: LAYERS[k], to: l })), { from: r.failed ?? 'urls', to: 'out', dashed: !!r.failed }],
    packets,
    stats: [
      { label: 'Payload', value: r.label },
      { label: 'Rejected by', value: r.failed ?? 'nobody', tone: r.failed ? 'bad' : 'ok' },
      { label: 'Result', value: r.failed ? 'fallback' : 'render', tone: r.failed ? 'bad' : 'ok' },
    ],
    note: r.failed ? { text: `${r.reason}: reject and fall back safely`, tone: 'bad' } : { text: r.reason, tone: 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'sdui-validation',
  objectives: [
    { text: 'Why the response must be validated at run time', step: 1 },
    { text: 'What the schema check catches', step: 2 },
    { text: 'How the registry and the action allowlist reject payloads', step: 3 },
    { text: 'Why URLs are allowlisted too', step: 4 },
  ],
  steps: [
    {
      label: 'Trust',
      title: 'The response is data, not code',
      tag: 'problem',
      body: ['TypeScript checks types at compile time, but the server response arrives at **run time**.', 'It decides what renders, what is tappable and where navigation goes, so every layer can reject it.'],
      keyIdea: 'Schema, registry, actions, URLs, then data: each can say no.',
      frames: [{ state: view(5), hold: 4000 }],
    },
    {
      label: 'Schema',
      title: 'safeParse before render',
      tag: 'concept',
      body: ['A schema validator such as Zod checks the shape. A `hero` without a string `title` fails.', 'On failure the client shows an error screen instead of rendering garbage.'],
      keyIdea: 'Validate before the renderer ever sees the data.',
      frames: [{ state: view(0), hold: 2600 }, { state: view(1), hold: 3400 }],
    },
    {
      label: 'Allowlists',
      title: 'Only known things',
      tag: 'technique',
      body: ['Components come from the **registry only**. Actions come from an **allowlist** only.', 'An `execute_arbitrary_code` action is never run, whatever the payload says.'],
      keyIdea: 'Never allow arbitrary native actions.',
      frames: [{ state: view(2), hold: 3000 }, { state: view(3), hold: 3400 }],
    },
    {
      label: 'URLs',
      title: 'Allowlist the destinations',
      tag: 'trade-off',
      body: ['An `open_url` action can point anywhere. The client checks the host against an allowlist before opening.', 'The data itself must also be only what this user may see, enforced on the server.'],
      keyIdea: 'Validate on both sides, and never trust arbitrary URLs.',
      frames: [{ state: view(4), hold: 3400 }, { state: view(5), hold: 3000 }],
    },
    {
      label: 'Recap',
      title: 'Layers of trust',
      tag: 'recap',
      body: [
        '- **Schema:** shape check, `safeParse`.',
        '- **Registry:** known components only.',
        '- **Actions:** allowlist of types.',
        '- **URLs:** allowlist of hosts.',
        '- **Failure:** reject and fall back safely.',
      ],
      keyIdea: 'Any layer failing sends the user to a safe screen, never a blank one.',
      frames: [{ state: view(3) }],
    },
  ],
});
