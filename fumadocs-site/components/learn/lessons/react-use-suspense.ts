import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the React 19 notes on use(): a component calls use(promise) during render, suspends while it is pending,
 * the nearest Suspense boundary shows its fallback, and React re-renders when the promise resolves.
 * A small promise model decides what use() does at each moment.
 */

type PromiseState = 'pending' | 'resolved';
/** What use(promise) does: return the value if resolved, otherwise suspend. */
const usePromise = (state: PromiseState): 'value' | 'suspend' => (state === 'resolved' ? 'value' : 'suspend');

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

type Phase = 0 | 1 | 2 | 3;
const view = (phase: Phase): FlowState => {
  const promise: PromiseState = phase >= 2 ? 'resolved' : 'pending';
  const result = usePromise(promise);
  const suspended = result === 'suspend' && phase >= 1;
  return {
    nodes: [
      { id: 'c', label: 'Comments', sub: suspended ? 'suspended' : phase === 3 ? 'rendered' : 'use(promise)', kind: 'worker', x: 0.1, y: 1.7, status: suspended ? 'hot' : 'active' },
      { id: 's', label: 'Suspense', sub: 'nearest boundary', kind: 'gateway', x: 2.8, y: 0.3, status: phase === 1 ? 'active' : 'normal' },
      { id: 'p', label: 'Promise', sub: promise, kind: 'external', x: 2.8, y: 3.1, status: phase === 2 ? 'active' : 'normal' },
      { id: 'ui', label: 'Screen', sub: phase === 3 ? 'real content' : phase >= 1 ? 'fallback' : 'blank', kind: 'client', x: 5.5, y: 1.7, status: phase >= 1 ? 'active' : 'dim', items: phase === 3 ? ['comments'] : phase >= 1 ? ['spinner'] : undefined },
    ],
    links: [{ from: 'c', to: 'p' }, { from: 'c', to: 's', dashed: true }, { from: 's', to: 'ui' }, { from: 'c', to: 'ui', dashed: phase !== 3 }],
    packets:
      phase === 0
        ? [hop('c', 'p', 'use(promise)', 0, 'req')]
        : phase === 1
          ? [hop('c', 's', 'suspends', 0, 'bad'), hop('s', 'ui', 'fallback', 0.7, 'data')]
          : phase === 2
            ? [hop('p', 'c', 'resolved value', 0, 'ok')]
            : [hop('c', 'ui', 'comments', 0, 'ok')],
    stats: [
      { label: 'Promise', value: promise, tone: promise === 'resolved' ? 'ok' : 'neutral' },
      { label: 'use() returns', value: phase === 0 ? '?' : result === 'value' ? 'the value' : 'suspends', tone: result === 'value' ? 'ok' : 'bad' },
      { label: 'Screen shows', value: phase === 3 ? 'content' : phase >= 1 ? 'fallback' : '-', tone: phase === 3 ? 'ok' : 'neutral' },
    ],
    note:
      phase === 0
        ? { text: 'the component reads the promise during render with use()', tone: 'accent' }
        : phase === 1
          ? { text: 'the promise is pending, so the component suspends and Suspense shows its fallback', tone: 'bad' }
          : phase === 2
            ? { text: 'the promise resolves: React re-renders the component', tone: 'ok' }
            : { text: 'use() now returns the value and rendering continues with real content', tone: 'ok' },
  };
};

// Step 4: use() works inside conditions, hooks do not.
const conditional = (open: boolean): FlowState => ({
  nodes: [
    { id: 'c', label: 'Button', sub: 'component', kind: 'worker', x: 0.2, y: 1.7, status: 'active' },
    { id: 'g', label: 'if (open)', sub: 'a condition', kind: 'gateway', x: 2.8, y: 1.7, status: 'active' },
    { id: 'u', label: 'use(Theme)', sub: open ? 'called' : 'skipped', kind: 'service', x: 5.4, y: 1.7, status: open ? 'active' : 'dim' },
  ],
  links: [{ from: 'c', to: 'g' }, { from: 'g', to: 'u', dashed: !open }],
  packets: open ? [hop('c', 'g', 'render', 0), hop('g', 'u', 'open is true', 0.6, 'ok')] : [hop('c', 'g', 'render', 0)],
  stats: [
    { label: 'Condition', value: open ? 'true' : 'false' },
    { label: 'use() runs', value: open ? 'yes' : 'no', tone: open ? 'ok' : 'neutral' },
    { label: 'Allowed', value: 'conditionally', tone: 'ok' },
  ],
  note: { text: 'unlike other hooks, use() may be called conditionally and inside loops', tone: 'ok' },
});

export default defineLesson('flow', {
  slug: 'react-use-suspense',
  objectives: [
    { text: 'How use(promise) reads async data during render', step: 1 },
    { text: 'What happens while the promise is pending', step: 2 },
    { text: 'How the component recovers when it resolves', step: 3 },
    { text: 'Why use() can be called conditionally', step: 4 },
  ],
  steps: [
    {
      label: 'Read',
      title: 'Await data in render',
      tag: 'problem',
      body: ['`use(promise)` reads a promise **during render**, instead of an effect that sets state after the fact.', 'The component asks for the value as if it were already there.'],
      keyIdea: 'use() reads the value of a resource: a Promise or a Context.',
      frames: [{ state: view(0), hold: 3200 }],
    },
    {
      label: 'Suspend',
      title: 'Pending means suspend',
      tag: 'concept',
      body: ['If the promise has not resolved, the component **suspends**. The nearest `Suspense` boundary shows its `fallback`.', 'Rendering of that subtree pauses until the data is ready.'],
      keyIdea: 'Loading UI is declared once, on the boundary, not in every component.',
      frames: [{ state: view(1), hold: 3800 }],
    },
    {
      label: 'Resolve',
      title: 'Re-render with the value',
      tag: 'technique',
      body: ['When the promise resolves, React re-renders the suspended component.', 'This time `use()` returns the value and the real content replaces the fallback.'],
      keyIdea: 'No loading flag, no effect, no extra state.',
      frames: [{ state: view(2), hold: 2600 }, { state: view(3), hold: 3600 }],
    },
    {
      label: 'Conditional',
      title: 'Not bound by hook rules',
      tag: 'trade-off',
      body: ['Normal hooks must run in the same order every render. `use()` may be called conditionally and inside loops.', 'Reading context with `use(ThemeContext)` works the same way.'],
      keyIdea: 'This is the one hook-like API exempt from the top-level rule.',
      frames: [{ state: conditional(false), hold: 2400 }, { state: conditional(true), hold: 3200 }],
    },
    {
      label: 'Recap',
      title: 'use() and Suspense',
      tag: 'recap',
      body: [
        '- **use(promise):** read async data in render.',
        '- **Pending:** the component suspends.',
        '- **Suspense:** the nearest boundary shows the fallback.',
        '- **Resolved:** React re-renders with the value.',
        '- **Flexible:** callable in conditions and loops.',
      ],
      keyIdea: 'Wrap components that call use() in a Suspense boundary.',
      frames: [{ state: view(3) }],
    },
  ],
});
