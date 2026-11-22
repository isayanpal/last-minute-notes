import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the React notes on rendering: trigger, render, reconcile, commit, effects.
 * The pure-versus-impure result and the diff counts come from running a real view function and a real tree comparison.
 */

type VNode = { tag: string; text: string };
const view = (count: number): VNode[] => [
  { tag: 'h1', text: `Count: ${count}` },
  { tag: 'button', text: '+' },
  { tag: 'p', text: 'static' },
];
const changedTags = (a: VNode[], b: VNode[]) => b.filter((n, i) => n.tag !== a[i].tag || n.text !== a[i].text).map((n) => n.tag);

const prev = view(0);
const next = view(1);
const CHANGED = changedTags(prev, next);
const pureSame = JSON.stringify(view(1)) === JSON.stringify(view(1));
const impure = (): VNode[] => [{ tag: 'h1', text: `Value: ${Math.random()}` }];
const impureSame = JSON.stringify(impure()) === JSON.stringify(impure());

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

type Phase = 'trigger' | 'render' | 'reconcile' | 'commit' | 'effects';
const ORDER: Phase[] = ['trigger', 'render', 'reconcile', 'commit', 'effects'];
const nodes = (active: Phase, extra: Partial<Record<Phase, Partial<FlowNode>>> = {}): FlowNode[] => {
  const base: Record<Phase, FlowNode> = {
    trigger: { id: 'trigger', label: 'Trigger', sub: 'setState or props', kind: 'client', x: 0.1, y: 1.7 },
    render: { id: 'render', label: 'Render', sub: 'call components', kind: 'worker', x: 1.55, y: 1.7 },
    reconcile: { id: 'reconcile', label: 'Reconcile', sub: 'diff the trees', kind: 'gateway', x: 3.0, y: 1.7 },
    commit: { id: 'commit', label: 'Commit', sub: 'update the DOM', kind: 'storage', x: 4.45, y: 1.7 },
    effects: { id: 'effects', label: 'Effects', sub: 'after paint', kind: 'service', x: 5.9, y: 1.7 },
  };
  const at = ORDER.indexOf(active);
  return ORDER.map((p, i) => ({ ...base[p], status: i === at ? 'active' : i < at ? 'normal' : 'dim', ...extra[p] }));
};
const links = ORDER.slice(1).map((p, i) => ({ from: ORDER[i], to: p }));

// Step 1: something triggers a render, nothing is drawn yet.
const trigger = (): FlowState => ({
  nodes: nodes('trigger'),
  links,
  packets: [hop('trigger', 'render', 'schedule', 0, 'req')],
  stats: [
    { label: 'Triggers', value: '3 kinds' },
    { label: 'Screen', value: 'unchanged' },
    { label: 'Next', value: 'render' },
  ],
  note: { text: 'first render, setState or new props only schedule work: the screen has not changed yet', tone: 'accent' },
});

// Step 2: render calls your components, so they must be pure.
const render = (pure: boolean): FlowState => ({
  nodes: nodes('render', { render: { status: pure ? 'active' : 'hot', sub: pure ? 'call components' : 'impure component' } }),
  links,
  packets: [hop('render', 'reconcile', pure ? 'new tree' : 'random tree', 0, pure ? 'ok' : 'bad')],
  stats: [
    { label: 'Same props', value: pure ? 'same output' : 'differs', tone: pure ? 'ok' : 'bad' },
    { label: 'Called twice', value: pure ? (pureSame ? 'identical' : 'differs') : impureSame ? 'identical' : 'differs', tone: pure ? 'ok' : 'bad' },
    { label: 'Side effects', value: pure ? 'none' : 'in render', tone: pure ? 'ok' : 'bad' },
  ],
  note: pure ? { text: 'render is a pure function of props and state: view(1) always gives the same tree', tone: 'ok' } : { text: 'Math.random() in render gives a different tree each call, so React cannot trust it', tone: 'bad' },
});

// Step 3: reconcile and commit touch only what changed.
const diff = (phase: 'reconcile' | 'commit'): FlowState => ({
  nodes: nodes(phase, { commit: { items: phase === 'commit' ? CHANGED : undefined } }),
  links,
  packets: [phase === 'reconcile' ? hop('reconcile', 'commit', 'only the diff', 0, 'data') : hop('commit', 'effects', 'painted', 0, 'ok')],
  stats: [
    { label: 'Nodes compared', value: String(next.length) },
    { label: 'Changed', value: String(CHANGED.length), tone: 'ok' },
    { label: 'DOM touched', value: phase === 'commit' ? CHANGED.join(', ') : '-', tone: phase === 'commit' ? 'ok' : 'neutral' },
  ],
  note: phase === 'reconcile' ? { text: `old and new trees compared: only ${CHANGED[0]} has different text`, tone: 'accent' } : { text: `commit updates ${CHANGED[0]} only: the button and paragraph are never touched`, tone: 'ok' },
});

// Step 4: effects run after paint.
const effects = (): FlowState => ({
  nodes: nodes('effects', { effects: { items: ['fetch'] } }),
  links,
  packets: [hop('commit', 'effects', 'after paint', 0, 'ok')],
  stats: [
    { label: 'Runs', value: 'after paint' },
    { label: 'Blocks screen', value: 'no', tone: 'ok' },
    { label: 'Use for', value: 'side effects' },
  ],
  note: { text: 'useEffect callbacks run after the browser has painted, so they never delay the update', tone: 'ok' },
});

export default defineLesson('flow', {
  slug: 'react-render-commit',
  objectives: [
    { text: 'What triggers a render', step: 1 },
    { text: 'Why components must be pure', step: 2 },
    { text: 'How reconcile and commit change only what differs', step: 3 },
    { text: 'When effects run', step: 4 },
  ],
  steps: [
    {
      label: 'Trigger',
      title: 'A render is scheduled',
      tag: 'problem',
      body: ['A render starts from the first mount, a `setState`, or new props. Triggering does not change the screen.', 'React then goes through render, reconcile, commit and effects.'],
      keyIdea: 'State updates trigger a render, they do not mutate anything directly.',
      frames: [{ state: trigger(), hold: 3400 }],
    },
    {
      label: 'Render',
      title: 'React calls your components',
      tag: 'concept',
      body: ['In the render phase React calls your components and builds a new tree. The same props and state must give the same output.', 'Side effects during render, like `Math.random()` or a fetch, break that.'],
      keyIdea: 'Components should be pure: no side effects during render.',
      frames: [{ state: render(true), hold: 3000 }, { state: render(false), hold: 3400 }],
    },
    {
      label: 'Commit',
      title: 'Only the diff reaches the DOM',
      tag: 'technique',
      body: ['**Reconciliation** compares the old and new trees. **Commit** updates only the DOM nodes that changed.', 'Here one of three nodes changed, so one DOM node is touched.'],
      keyIdea: 'The virtual DOM exists so React can compute a minimal update.',
      frames: [{ state: diff('reconcile'), hold: 2800 }, { state: diff('commit'), hold: 3400 }],
    },
    {
      label: 'Effects',
      title: 'Effects run after paint',
      tag: 'concept',
      body: ['`useEffect` callbacks run after the commit and after the browser paints.', 'That keeps API calls, subscriptions and timers off the critical path.'],
      keyIdea: 'Render must be pure. Everything else goes in an effect or an event handler.',
      frames: [{ state: effects(), hold: 3400 }],
    },
    {
      label: 'Recap',
      title: 'Render and commit',
      tag: 'recap',
      body: [
        '- **Trigger:** mount, setState or new props.',
        '- **Render:** call components, which must be pure.',
        '- **Reconcile:** diff against the previous tree.',
        '- **Commit:** update only changed DOM nodes.',
        '- **Effects:** run after paint.',
      ],
      keyIdea: 'A parent re-render re-renders its children unless memoization stops it.',
      frames: [{ state: diff('commit') }],
    },
  ],
});
