import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the React notes on the Context API: it removes prop drilling, every consumer re-renders when the value changes,
 * so it suits low-frequency global state. The re-render counts come from multiplying real consumer and update counts.
 */

const CONSUMERS = ['button', 'badge'];
const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.5 });

const tree = (opts: { carry?: boolean; hot?: string[]; dim?: string[] } = {}): FlowNode[] => {
  const st = (id: string): FlowNode['status'] => (opts.hot?.includes(id) ? 'hot' : opts.dim?.includes(id) ? 'dim' : 'normal');
  return [
    { id: 'app', label: 'App', sub: 'Provider', kind: 'gateway', x: 0.1, y: 1.7, status: 'active' },
    { id: 'layout', label: 'Layout', sub: opts.carry ? 'passes theme on' : 'ignores theme', kind: 'service', x: 1.6, y: 1.7, status: st('layout'), items: opts.carry ? ['theme'] : undefined },
    { id: 'page', label: 'Page', sub: opts.carry ? 'passes theme on' : 'ignores theme', kind: 'service', x: 3.1, y: 1.7, status: st('page'), items: opts.carry ? ['theme'] : undefined },
    { id: 'button', label: 'Button', sub: 'reads theme', kind: 'worker', x: 4.7, y: 0.4, status: st('button'), items: opts.carry ? ['theme'] : undefined },
    { id: 'badge', label: 'Badge', sub: 'reads theme', kind: 'worker', x: 4.7, y: 3.0, status: st('badge') },
  ];
};
const chain = [{ from: 'app', to: 'layout' }, { from: 'layout', to: 'page' }, { from: 'page', to: 'button' }, { from: 'page', to: 'badge' }];

// Step 1: prop drilling.
const drilling = (): FlowState => ({
  nodes: tree({ carry: true }),
  links: chain,
  packets: [hop('app', 'layout', 'theme', 0), hop('layout', 'page', 'theme', 0.55), hop('page', 'button', 'theme', 1.1), hop('page', 'badge', 'theme', 1.1)],
  stats: [
    { label: 'Layers', value: '3 deep' },
    { label: 'Pass-through', value: '2 layers', tone: 'bad' },
    { label: 'Needs theme', value: '2 leaves' },
  ],
  note: { text: 'Layout and Page do not use theme, but must carry it so the leaves can read it', tone: 'bad' },
});

// Step 2: the provider reaches consumers directly.
const direct = (): FlowState => ({
  nodes: tree(),
  links: [...chain, { from: 'app', to: 'button', dashed: true }, { from: 'app', to: 'badge', dashed: true }],
  packets: [hop('app', 'button', 'theme', 0, 'ok'), hop('app', 'badge', 'theme', 0.15, 'ok')],
  stats: [
    { label: 'Provider', value: 'value="dark"' },
    { label: 'Consumers', value: 'useContext' },
    { label: 'Pass-through', value: 'none', tone: 'ok' },
  ],
  note: { text: 'the value skips every layer in between and goes straight to the consumers', tone: 'ok' },
});

// Step 3: a new value re-renders every consumer.
const changed = (): FlowState => ({
  nodes: tree({ hot: CONSUMERS }),
  links: [...chain, { from: 'app', to: 'button', dashed: true }, { from: 'app', to: 'badge', dashed: true }],
  packets: [hop('app', 'button', 'light', 0, 'data'), hop('app', 'badge', 'light', 0.15, 'data')],
  stats: [
    { label: 'Value', value: 'dark to light' },
    { label: 'Consumers', value: `${CONSUMERS.length} re-render`, tone: 'bad' },
    { label: 'Reading it', value: 'useContext' },
  ],
  note: { text: 'when the value changes, every component that reads it re-renders', tone: 'accent' },
});

// Step 4: frequent updates multiply the cost.
const frequent = (updates: number): FlowState => {
  const renders = updates * CONSUMERS.length;
  return {
    nodes: tree({ hot: CONSUMERS }),
    links: [{ from: 'app', to: 'button', dashed: true }, { from: 'app', to: 'badge', dashed: true }, ...chain],
    packets: [hop('app', 'button', `update ${updates}`, 0, 'bad'), hop('app', 'badge', `update ${updates}`, 0.15, 'bad')],
    stats: [
      { label: 'Updates', value: String(updates) },
      { label: 'Consumers', value: String(CONSUMERS.length) },
      { label: 'Consumer renders', value: String(renders), tone: 'bad' },
    ],
    note: { text: 'a value that changes often re-renders every consumer on every change', tone: 'bad' },
  };
};

export default defineLesson('flow', {
  slug: 'react-context',
  objectives: [
    { text: 'What prop drilling is', step: 1 },
    { text: 'How context delivers a value directly', step: 2 },
    { text: 'What re-renders when the value changes', step: 3 },
    { text: 'Why context suits low-frequency state', step: 4 },
  ],
  steps: [
    {
      label: 'Drilling',
      title: 'Props carried through layers',
      tag: 'problem',
      body: ['To give a deep component the theme, every layer in between has to pass it down as a prop.', 'That is **prop drilling**.'],
      keyIdea: 'Intermediate components end up knowing about data they never use.',
      frames: [{ state: drilling(), hold: 4000 }],
    },
    {
      label: 'Context',
      title: 'Provider to consumer',
      tag: 'concept',
      body: ['`createContext`, a `Provider` with a `value`, and `useContext` in the consumers.', 'The value goes straight to whoever reads it.'],
      keyIdea: 'Context removes prop drilling for shared values.',
      frames: [{ state: direct(), hold: 3800 }],
    },
    {
      label: 'Updates',
      title: 'Consumers re-render',
      tag: 'trade-off',
      body: ['When the provider value changes, every component that calls `useContext` for it re-renders.', 'Components that never read it are not subscribed.'],
      keyIdea: 'Context has no selector: all consumers re-render on any change of the value.',
      frames: [{ state: changed(), hold: 3800 }],
    },
    {
      label: 'Frequency',
      title: 'Low-frequency state only',
      tag: 'in practice',
      body: ['Updating a context value many times a second re-renders all consumers each time.', 'Use context for themes, locale and the current user, and Redux or similar for complex state logic.'],
      keyIdea: 'Context for low-frequency global state, Redux for complex state logic.',
      frames: [1, 3, 5].map((u) => ({ state: frequent(u), hold: u === 5 ? 3600 : 1500 })),
    },
    {
      label: 'Recap',
      title: 'Context in one page',
      tag: 'recap',
      body: [
        '- **Problem:** prop drilling through unrelated layers.',
        '- **Solution:** `Provider` plus `useContext`.',
        '- **Cost:** all consumers re-render on any value change.',
        '- **Fit:** theme, locale, auth user.',
        '- **Not for:** fast-changing or complex state.',
      ],
      keyIdea: 'Split contexts or pick a state library when updates are frequent.',
      frames: [{ state: changed() }],
    },
  ],
});
