import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the React notes on React.memo, useMemo and useCallback: a parent re-render re-renders children unless memo finds
 * every prop equal by reference. A real shallow comparison (Object.is) counts the child renders over three parent renders.
 */

type Props = Record<string, unknown>;
const shallowEqual = (a: Props, b: Props) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => Object.is(a[k], b[k]));
};

/** Returns, for each parent render, whether the child rendered. */
function childRenders(memo: boolean, propsPerRender: Props[]): boolean[] {
  let prev: Props | null = null;
  return propsPerRender.map((p) => {
    const rendered = !memo || prev === null || !shallowEqual(prev, p);
    prev = p;
    return rendered;
  });
}

const PARENT_RENDERS = 3; // the parent re-renders because of an unrelated state change
const STABLE_STYLE = {};
const stableFn = () => {};

type Scenario = { memo: boolean; props: (i: number) => Props; prop: string };
const SCENARIOS: Record<'plain' | 'memo' | 'inline' | 'stable', Scenario> = {
  plain: { memo: false, props: () => ({ value: 1 }), prop: 'value = 1' },
  memo: { memo: true, props: () => ({ value: 1 }), prop: 'value = 1' },
  inline: { memo: true, props: () => ({ style: {}, onClick: () => {} }), prop: 'style = {}' },
  stable: { memo: true, props: () => ({ style: STABLE_STYLE, onClick: stableFn }), prop: 'useMemo style' },
};
const RESULT = Object.fromEntries(
  (Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]).map((k) => [k, childRenders(SCENARIOS[k].memo, Array.from({ length: PARENT_RENDERS }, (_, i) => SCENARIOS[k].props(i)))]),
) as Record<keyof typeof SCENARIOS, boolean[]>;

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

const view = (key: keyof typeof SCENARIOS, k: number): FlowState => {
  const sc = SCENARIOS[key];
  const rendered = RESULT[key];
  const total = rendered.slice(0, k).filter(Boolean).length;
  const did = rendered[k - 1];
  const bad = (key === 'plain' || key === 'inline') && k > 1;
  return {
    nodes: [
      { id: 'p', label: 'Parent', sub: 'unrelated state', kind: 'worker', x: 0.2, y: 1.7, status: 'active', items: [`render ${k}`] },
      { id: 'm', label: sc.memo ? 'memo check' : 'no memo', sub: sc.memo ? 'compare props' : 'always render', kind: 'gateway', x: 2.6, y: 1.7, status: 'normal' },
      { id: 'c', label: 'Child', sub: sc.prop, kind: 'service', x: 5.2, y: 1.7, status: did ? 'active' : 'dim', items: [`render ${total}`] },
    ],
    links: [{ from: 'p', to: 'm' }, { from: 'm', to: 'c', dashed: !did }],
    packets: [hop('p', 'm', 'new props', 0, 'req'), ...(did ? [hop('m', 'c', 'render', 0.7, bad ? 'bad' : 'ok')] : [])],
    stats: [
      { label: 'Parent renders', value: String(k) },
      { label: 'Child renders', value: String(total), tone: total === k && k > 1 ? 'bad' : 'ok' },
      { label: 'This time', value: did ? 'rendered' : 'skipped', tone: did ? (bad ? 'bad' : 'neutral') : 'ok' },
    ],
    note: did
      ? k === 1
        ? { text: 'first render: the child has to render once', tone: 'accent' }
        : key === 'plain'
        ? { text: 'no memo: a parent re-render always re-renders the child', tone: 'bad' }
        : key === 'inline'
          ? { text: 'style={} and an inline function are new references each render, so props look changed', tone: 'bad' }
          : { text: 'first render: the child has to render once', tone: 'accent' }
      : { text: 'every prop is equal to last time: React reuses the previous output', tone: 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'react-memo',
  objectives: [
    { text: 'Why children re-render when a parent does', step: 1 },
    { text: 'How React.memo skips a render', step: 2 },
    { text: 'Why inline objects and functions defeat memo', step: 3 },
    { text: 'How useMemo and useCallback keep props stable', step: 4 },
  ],
  steps: [
    {
      label: 'Cascade',
      title: 'Parent renders, children follow',
      tag: 'problem',
      body: ['When a parent re-renders, React re-renders its children, even when their props did not change.', 'Here the parent re-renders three times for an unrelated reason.'],
      keyIdea: 'Parent re-render means child re-render, by default.',
      frames: [1, 2, 3].map((k) => ({ state: view('plain', k), hold: k === 3 ? 3400 : 1700 })),
    },
    {
      label: 'React.memo',
      title: 'Skip when props are equal',
      tag: 'technique',
      body: ['`React.memo(Child)` compares each prop with its previous value. If every prop is equal, React reuses the last output.', 'The child now renders once.'],
      keyIdea: 'memo compares props by reference, shallowly.',
      frames: [1, 2, 3].map((k) => ({ state: view('memo', k), hold: k === 3 ? 3400 : 1700 })),
    },
    {
      label: 'New references',
      title: 'Inline props break memo',
      tag: 'trade-off',
      body: ['`style={{}}` and `onClick={() => {}}` create a **new object and function on every render**. By reference they are never equal.', 'memo re-renders the child each time, and the wrapper is wasted work.'],
      keyIdea: 'Object and function props are new every render unless you stabilise them.',
      frames: [1, 2, 3].map((k) => ({ state: view('inline', k), hold: k === 3 ? 3600 : 1700 })),
    },
    {
      label: 'Stable props',
      title: 'useMemo and useCallback',
      tag: 'in practice',
      body: ['`useMemo` keeps an object stable and `useCallback` keeps a function stable between renders.', 'The child gets the same references, so memo can skip it again.'],
      keyIdea: 'memo, useMemo and useCallback only pay off together.',
      frames: [1, 2, 3].map((k) => ({ state: view('stable', k), hold: k === 3 ? 3600 : 1700 })),
    },
    {
      label: 'Recap',
      title: 'Stopping wasted renders',
      tag: 'recap',
      body: [
        '- **Default:** parent re-render re-renders children.',
        '- **React.memo:** skip when all props are equal by reference.',
        '- **Trap:** inline objects and functions are always new.',
        '- **Fix:** `useMemo` for values, `useCallback` for functions.',
        '- **Measure first:** memoize where renders are costly.',
      ],
      keyIdea: 'Use these to prevent unnecessary re-renders in memoized children, not everywhere.',
      frames: [{ state: view('stable', 3) }],
    },
  ],
});
