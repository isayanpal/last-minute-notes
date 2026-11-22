import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the React notes on useEffect: the dependency array decides when an effect runs, and cleanup runs before the next run
 * and on unmount. A real dependency comparison (Object.is) decides run or skip for each render.
 */

type Deps = undefined | unknown[];
type Variant = 'none' | 'empty' | 'dep';
const A = [1, 1, 2, 2, 3]; // the value of `a` on each of five renders

const depsFor = (v: Variant, i: number): Deps => (v === 'none' ? undefined : v === 'empty' ? [] : [A[i]]);

/** Decide, per render, whether the effect runs and whether a previous cleanup runs first. */
function simulate(v: Variant): { ran: boolean; cleanup: boolean }[] {
  const out: { ran: boolean; cleanup: boolean }[] = [];
  let prev: Deps = undefined;
  for (let i = 0; i < A.length; i++) {
    const deps = depsFor(v, i);
    const ran = i === 0 || deps === undefined || deps.some((d, j) => !Object.is(d, (prev as unknown[])[j]));
    out.push({ ran, cleanup: ran && i > 0 });
    prev = deps;
  }
  return out;
}
const SIM: Record<Variant, { ran: boolean; cleanup: boolean }[]> = { none: simulate('none'), empty: simulate('empty'), dep: simulate('dep') };
const DEPS_LABEL: Record<Variant, string> = { none: 'none', empty: '[]', dep: '[a]' };

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

/** Show the first k renders, optionally with the cleanup row and the unmount column. */
const view = (v: Variant, k: number, opts: { cleanup?: boolean; unmount?: boolean } = {}): ArrayState => {
  const sim = SIM[v];
  const cols = A.length + (opts.cleanup ? 1 : 0);
  const shown = (i: number) => i < k;
  const lastCleanup = opts.unmount && k >= A.length;
  const runs = sim.slice(0, k).filter((s) => s.ran).length;
  const rows: ArrayState['rows'] = [
    { label: 'render', cells: [...A.map((_, i) => `#${i + 1}`), ...(opts.cleanup ? ['end'] : [])], states: paint(cols, (i) => (i === k - 1 ? 'active' : i < k ? 'visited' : 'normal')), showIndex: false },
    { label: 'a', cells: [...A.map((x, i) => (shown(i) ? x : '')), ...(opts.cleanup ? [''] : [])], states: paint(cols, (i) => (i < k && i < A.length ? 'done' : 'dim')), showIndex: false },
    { label: 'effect', cells: [...sim.map((s, i) => (shown(i) ? (s.ran ? 'run' : 'skip') : '')), ...(opts.cleanup ? [''] : [])], states: paint(cols, (i) => (i >= A.length || i >= k ? 'dim' : sim[i].ran ? 'found' : 'normal')), showIndex: false },
  ];
  if (opts.cleanup) {
    rows.push({ label: 'cleanup', cells: [...sim.map((s, i) => (shown(i) ? (s.cleanup ? 'stop' : '-') : '')), lastCleanup ? 'stop' : ''], states: paint(cols, (i) => (i === A.length ? (lastCleanup ? 'swap' : 'dim') : i < k && sim[i].cleanup ? 'swap' : 'dim')), showIndex: false });
  }
  const cleanups = sim.slice(0, k).filter((s) => s.cleanup).length + (lastCleanup ? 1 : 0);
  return {
    rows,
    stats: [
      { label: 'Deps', value: DEPS_LABEL[v] },
      { label: 'Effect runs', value: `${runs} of ${k}`, tone: v === 'none' ? 'bad' : 'ok' },
      opts.cleanup ? { label: 'Cleanups', value: String(cleanups), tone: 'ok' } : { label: 'Skipped', value: String(k - runs) },
    ],
    note: opts.cleanup
      ? lastCleanup
        ? { text: 'on unmount the last cleanup runs, so the interval never leaks', tone: 'ok' }
        : { text: 'before each new run, the previous cleanup runs: clearInterval, then setInterval again', tone: 'accent' }
      : v === 'none'
        ? { text: 'no array means the effect runs after every render', tone: 'bad' }
        : v === 'empty'
          ? { text: 'an empty array means run once, on mount', tone: 'ok' }
          : { text: 'the effect runs on mount and when a changes, and is skipped otherwise', tone: 'ok' },
  };
};

export default defineLesson('array', {
  slug: 'react-useeffect',
  objectives: [
    { text: 'What happens with no dependency array', step: 1 },
    { text: 'What an empty array means', step: 2 },
    { text: 'How a dependency list decides when to re-run', step: 3 },
    { text: 'When cleanup runs', step: 4 },
  ],
  steps: [
    {
      label: 'No array',
      title: 'Every render, every time',
      tag: 'problem',
      body: ['Without a dependency array, the effect runs after **every** render.', 'An effect that sets state then triggers another render, and another.'],
      keyIdea: 'Forgetting the array is the classic way to build an infinite loop.',
      frames: [1, 2, 3, 4, 5].map((k) => ({ state: view('none', k), hold: k === 5 ? 3200 : 900 })),
    },
    {
      label: 'Empty array',
      title: 'Once, on mount',
      tag: 'concept',
      body: ['With `[]` the effect has no dependencies that can change, so it runs once after the first render.', 'Good for one-time setup like subscribing or the first fetch.'],
      keyIdea: '`[]` means mount only.',
      frames: [1, 3, 5].map((k) => ({ state: view('empty', k), hold: k === 5 ? 3200 : 1200 })),
    },
    {
      label: 'Dependencies',
      title: 'Re-run when a changes',
      tag: 'technique',
      body: ['With `[a]` React compares `a` with its last value using `Object.is`. The effect runs on mount and whenever `a` changed.', 'Renders where `a` is the same skip the effect.'],
      keyIdea: 'List every reactive value the effect reads.',
      frames: [1, 2, 3, 4, 5].map((k) => ({ state: view('dep', k), hold: k === 5 ? 3200 : 1100 })),
    },
    {
      label: 'Cleanup',
      title: 'Undo before redoing',
      tag: 'technique',
      body: ['If an effect returns a function, React runs it **before the next run** and on **unmount**.', 'Use it to clear timers and unsubscribe, so each run starts clean.'],
      keyIdea: 'Cleanup always runs before the next effect, then once more on unmount.',
      frames: [3, 5].map((k) => ({ state: view('dep', k, { cleanup: true }), hold: 2400 })).concat([{ state: view('dep', 5, { cleanup: true, unmount: true }), hold: 3600 }]),
    },
    {
      label: 'Recap',
      title: 'useEffect rules',
      tag: 'recap',
      body: [
        '- **No array:** every render.',
        '- **`[]`:** once, on mount.',
        '- **`[a]`:** on mount and when `a` changes.',
        '- **Cleanup:** before the next run and on unmount.',
        '- **Purpose:** side effects, never plain calculations.',
      ],
      keyIdea: 'If a value is derived from props or state, compute it during render instead of in an effect.',
      frames: [{ state: view('dep', 5, { cleanup: true, unmount: true }) }],
    },
  ],
});
