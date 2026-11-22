import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the React notes on why hooks must be called at the top level: React matches hook calls to stored state by call order.
 * A tiny hook runtime with real slots runs a component with a conditional hook and shows the wrong value it reads.
 */

function createRuntime() {
  const slots: unknown[] = [];
  let next = 0;
  const reads: { call: string; slot: number; value: unknown }[] = [];
  return {
    slots,
    reads,
    begin() {
      next = 0;
      reads.length = 0;
    },
    useState<T>(call: string, init: T): T {
      const slot = next++;
      if (!(slot in slots)) slots[slot] = init;
      reads.push({ call, slot, value: slots[slot] });
      return slots[slot] as T;
    },
  };
}

type Run = { reads: { call: string; slot: number; value: unknown }[]; slots: unknown[] };

function component(rt: ReturnType<typeof createRuntime>, hasAge: boolean, fixed: boolean) {
  rt.useState('name', 'Ann');
  if (fixed) {
    const age = rt.useState('age', 30); // always called
    void (hasAge ? age : null); // branch inside, after the hook
  } else if (hasAge) {
    rt.useState('age', 30); // conditional hook
  }
  rt.useState('city', 'Pune');
}

const run = (rt: ReturnType<typeof createRuntime>, hasAge: boolean, fixed: boolean): Run => {
  rt.begin();
  component(rt, hasAge, fixed);
  return { reads: [...rt.reads], slots: [...rt.slots] };
};

const rtBad = createRuntime();
const bad1 = run(rtBad, true, false);
const bad2 = run(rtBad, false, false);
const rtGood = createRuntime();
const good1 = run(rtGood, true, true);
const good2 = run(rtGood, false, true);

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;
const cityOf = (r: Run) => r.reads.find((x) => x.call === 'city')!;

const view = (r: Run, label: string, tone: 'ok' | 'bad' | 'neutral', note: string, expectCity = 'Pune', callsOnly = false): ArrayState => {
  const city = cityOf(r);
  const wrong = String(city.value) !== expectCity;
  const rows: ArrayState['rows'] = [
      { label: 'slots', cells: r.slots.map(String), states: paint(r.slots.length, (i) => (r.reads.some((x) => x.slot === i) ? 'done' : 'dim')), showIndex: true },
      { label: 'hook call', cells: r.reads.map((x) => x.call), states: paint(r.reads.length, (i) => (r.reads[i].call === 'city' && wrong ? 'bad' : 'visited')), showIndex: false },
      { label: 'slot read', cells: r.reads.map((x) => x.slot), states: paint(r.reads.length, (i) => (r.reads[i].call === 'city' && wrong ? 'bad' : 'normal')), showIndex: false },
      { label: 'gets', cells: r.reads.map((x) => String(x.value)), states: paint(r.reads.length, (i) => (r.reads[i].call === 'city' && wrong ? 'bad' : 'found')), showIndex: false },
  ];
  if (callsOnly) {
    return {
      rows: [{ label: 'hook call', cells: r.reads.map((x) => x.call), states: paint(r.reads.length, () => 'visited'), showIndex: false }],
      stats: [
        { label: 'Hook calls', value: String(r.reads.length) },
        { label: 'Names given', value: 'none', tone: 'bad' },
        { label: 'Matched by', value: 'call order', tone: 'ok' },
      ],
      note: { text: note, tone: 'accent' },
    };
  }
  return {
    rows,
    stats: [
      { label: 'Render', value: label },
      { label: 'city reads slot', value: String(city.slot), tone: tone },
      { label: 'city gets', value: String(city.value), tone: wrong ? 'bad' : 'ok' },
    ],
    note: { text: note, tone: tone === 'neutral' ? 'accent' : tone },
  };
};

export default defineLesson('array', {
  slug: 'react-hook-order',
  objectives: [
    { text: 'How React matches a hook call to its state', step: 1 },
    { text: 'What the slots look like after the first render', step: 2 },
    { text: 'What goes wrong with a conditional hook', step: 3 },
    { text: 'How to branch safely', step: 4 },
  ],
  steps: [
    {
      label: 'Which state?',
      title: 'Hooks have no names',
      tag: 'problem',
      body: ['`useState` does not receive a name. When a component calls it three times, how does React know which state belongs to which call?', 'It does not know by name. It counts.'],
      keyIdea: 'Hook state is matched by the order of the calls.',
      frames: [{ state: view(bad1, 'first', 'neutral', 'three hook calls, and none of them carries a name', 'Pune', true), hold: 3600 }],
    },
    {
      label: 'Slots',
      title: 'One slot per call, in order',
      tag: 'concept',
      body: ['React keeps a list of slots per component. The first `useState` reads slot 0, the second slot 1, the third slot 2.', 'Every render starts counting from 0 again.'],
      keyIdea: 'Consistent hook order is what makes the lookup work.',
      frames: [{ state: view(bad1, 'first', 'neutral', 'render 1: name reads slot 0, age slot 1, city slot 2'), hold: 3600 }],
    },
    {
      label: 'Conditional',
      title: 'Skip a hook, shift every slot',
      tag: 'trade-off',
      body: ['If the second render skips the `age` hook, `city` becomes the second call. It now reads **slot 1**, which holds the age.', 'The value comes from the wrong slot.'],
      keyIdea: 'This is why hooks must never run inside conditions, loops or nested functions.',
      frames: [{ state: view(bad2, 'second', 'bad', `age was skipped, so city reads slot 1 and gets ${cityOf(bad2).value}`), hold: 4200 }],
    },
    {
      label: 'Safe branch',
      title: 'Call the hook, branch after',
      tag: 'technique',
      body: ['Always call the hook at the top level and put the condition **inside** or after it.', 'The same three calls happen every render, so every slot lines up.'],
      keyIdea: 'Condition on the value, never on the call.',
      frames: [{ state: view(good1, 'first', 'neutral', 'always call all three hooks, in the same order'), hold: 2400 }, { state: view(good2, 'second', 'ok', 'age is not needed this time, but the hook still runs: city reads slot 2'), hold: 3800 }],
    },
    {
      label: 'Recap',
      title: 'Rules of hooks, explained',
      tag: 'recap',
      body: [
        '- **Matching:** hooks are matched to state by call order.',
        '- **Slots:** one per call, counted from 0 each render.',
        '- **Conditional hook:** shifts the later slots.',
        '- **Rule:** call hooks at the top level only.',
        '- **Branch:** on values, after the hook has run.',
      ],
      keyIdea: 'Consistent hook order is the whole reason for the top-level rule.',
      frames: [{ state: view(good2, 'second', 'ok', 'same calls every render, so every slot lines up') }],
    },
  ],
});
