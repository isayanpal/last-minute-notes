import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the React Native notes on app startup: native init, bundle load, module execution, first render and data.
 * Hermes precompiles bytecode, inline requires defer module work, and cached data renders before the network.
 * The phase durations are EXAMPLE values chosen to show the effect, the totals are computed from them.
 */

type Phase = 'native' | 'bundle' | 'modules' | 'render' | 'data';
type Plan = Record<Phase, number>;
const TONE: Record<Phase, TimelineBar['tone']> = { native: 'neutral', bundle: 'data', modules: 'violet', render: 'req', data: 'ok' };
const NAME: Record<Phase, string> = { native: 'native', bundle: 'bundle', modules: 'modules', render: 'render', data: 'data' };

const BASELINE: Plan = { native: 300, bundle: 600, modules: 400, render: 200, data: 500 };
const HERMES: Plan = { ...BASELINE, bundle: 150 }; // bytecode is memory-mapped, nothing to parse
const INLINE: Plan = { ...HERMES, modules: 150 }; // inline requires defer unused modules
const CACHED: Plan = { ...INLINE, data: 0 }; // render cached data first, the network refreshes later
const total = (p: Plan) => Object.values(p).reduce((a, b) => a + b, 0);

const PX_PER_MS = 0.25;
const bars = (lane: string, p: Plan): TimelineBar[] => {
  let t = 0;
  return (Object.keys(p) as Phase[])
    .filter((k) => p[k] > 0)
    .map((k) => {
      const bar: TimelineBar = { id: `${lane}-${k}`, from: t, to: t + p[k], tone: TONE[k], label: p[k] * PX_PER_MS > NAME[k].length * 6 + 12 ? NAME[k] : undefined };
      t += p[k];
      return bar;
    });
};

const PLANS: { label: string; plan: Plan }[] = [
  { label: 'baseline', plan: BASELINE },
  { label: 'Hermes', plan: HERMES },
  { label: '+ inline', plan: INLINE },
  { label: '+ cache', plan: CACHED },
];

const view = (n: number, note: TimelineState['note']): TimelineState => {
  const shown = PLANS.slice(0, n);
  const last = shown[shown.length - 1];
  const saved = total(BASELINE) - total(last.plan);
  return {
    from: 0,
    to: 2000,
    unit: 'ms',
    ticks: [0, 500, 1000, 1500, 2000],
    lanes: shown.map((s) => ({ label: s.label, bars: bars(s.label, s.plan) })),
    stats: [
      { label: 'Usable at', value: `${total(last.plan)} ms`, tone: n > 1 ? 'ok' : 'neutral' },
      { label: 'Saved', value: n > 1 ? `${saved} ms` : '-', tone: n > 1 ? 'ok' : 'neutral' },
      { label: 'Biggest phase', value: NAME[(Object.keys(last.plan) as Phase[]).reduce((a, b) => (last.plan[a] >= last.plan[b] ? a : b))] },
    ],
    note,
  };
};

export default defineLesson('timeline', {
  slug: 'rn-startup',
  objectives: [
    { text: 'Where startup time goes', step: 1 },
    { text: 'How Hermes bytecode shrinks bundle load', step: 2 },
    { text: 'How inline requires defer module work', step: 3 },
    { text: 'How cached data gets a usable screen sooner', step: 4 },
  ],
  steps: [
    {
      label: 'Phases',
      title: 'Five phases before usable',
      tag: 'problem',
      body: ['Startup runs **native init, bundle load, module execution, first render** and then data.', 'The durations here are example values, so read the shape, not the numbers.'],
      keyIdea: 'Measure the phases before optimising any of them.',
      frames: [{ state: view(1, { text: 'colours mark the phases: native, bundle, modules, render, data', tone: 'accent' }), hold: 4200 }],
    },
    {
      label: 'Hermes',
      title: 'Bytecode, not source',
      tag: 'technique',
      body: ['Hermes compiles JS to **bytecode at build time** and memory-maps it. At launch there is nothing to parse.', 'Bundle load shrinks, and only touched pages are loaded.'],
      keyIdea: 'Hermes is the default engine since 0.70.',
      frames: [{ state: view(2, { text: 'the bundle phase shrinks because the app no longer parses JavaScript', tone: 'ok' }), hold: 4400 }],
    },
    {
      label: 'Inline',
      title: 'Run less at startup',
      tag: 'technique',
      body: ['Imports run their top-level code at startup. **Inline requires** load a module only when it is first used.', 'Avoid side effects at module top level, and lazy-init SDKs.'],
      keyIdea: 'Module execution is time you can defer, not just cut.',
      frames: [{ state: view(3, { text: 'unused modules no longer run at launch, so the modules phase shrinks', tone: 'ok' }), hold: 4400 }],
    },
    {
      label: 'Cached data',
      title: 'Render before the network',
      tag: 'in practice',
      body: ['Render the last-known data from MMKV or SQLite first, and let the network refresh it afterwards.', 'The user sees a usable screen without waiting for the request.'],
      keyIdea: 'Render a light shell first, defer offscreen screens and tabs.',
      frames: [{ state: view(4, { text: 'the data phase left the critical path: the screen is usable after render', tone: 'ok' }), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Cutting startup time',
      tag: 'recap',
      body: [
        '- **Native init:** avoid heavy work, lazy-init SDKs.',
        '- **Bundle load:** Hermes bytecode, smaller bundle.',
        '- **Modules:** inline requires, no top-level side effects.',
        '- **First render:** a light shell.',
        '- **Data:** cache and show it first.',
      ],
      keyIdea: 'Turbo Modules being lazy is a startup win too.',
      frames: [{ state: view(4, { text: 'each step removed time from a different phase', tone: 'accent' }) }],
    },
  ],
});
