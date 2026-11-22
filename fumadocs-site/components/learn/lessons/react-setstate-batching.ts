import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the React notes on state updates: updates are queued, the variable inside one render never changes,
 * updater functions chain, and React batches the queue into one re-render. A real queue runs the updates.
 */

type Update = number | ((prev: number) => number);
const applyQueue = (start: number, queue: Update[]): number[] => {
  const steps: number[] = [];
  let cur = start;
  for (const u of queue) {
    cur = typeof u === 'function' ? u(cur) : u;
    steps.push(cur);
  }
  return steps;
};

const count = 0; // the value captured by this render's closure
const direct: Update[] = [count + 1, count + 1, count + 1]; // setCount(count + 1) three times
const updater: Update[] = [(c) => c + 1, (c) => c + 1, (c) => c + 1]; // setCount(c => c + 1) three times
const directSteps = applyQueue(count, direct);
const updaterSteps = applyQueue(count, updater);

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

// Steps 1, 3: process the queue one entry at a time.
const queueState = (kind: 'direct' | 'updater', k: number): ArrayState => {
  const steps = kind === 'direct' ? directSteps : updaterSteps;
  const labels = kind === 'direct' ? ['set 1', 'set 1', 'set 1'] : ['+1', '+1', '+1'];
  const done = k;
  return {
    rows: [
      { label: 'queue', cells: labels, states: paint(3, (i) => (i < done ? 'done' : i === done ? 'active' : 'normal')), showIndex: false },
      { label: 'state', cells: steps.map((v, i) => (i < done ? v : '')), states: paint(3, (i) => (i < done ? (kind === 'direct' ? 'bad' : 'found') : 'dim')), showIndex: false },
    ],
    stats: [
      { label: 'Handler', value: kind === 'direct' ? 'count + 1' : 'c => c + 1' },
      { label: 'Applied', value: `${done} of 3` },
      { label: 'Final state', value: done === 3 ? String(steps[2]) : '-', tone: done === 3 ? (kind === 'direct' ? 'bad' : 'ok') : 'neutral' },
    ],
    note:
      done === 3
        ? kind === 'direct'
          ? { text: `three clicks of work, but state is ${steps[2]}, not 3`, tone: 'bad' }
          : { text: `each updater receives the previous result, so state is ${steps[2]}`, tone: 'ok' }
        : { text: kind === 'direct' ? 'every call queues the same value' : 'every call queues a function', tone: 'accent' },
  };
};

// Step 2: count is a constant inside one render.
const closureState = (): ArrayState => ({
  rows: [
    { label: 'count', cells: [count, count, count], states: paint(3, () => 'visited'), showIndex: false },
    { label: 'count + 1', cells: direct as number[], states: paint(3, () => 'bad'), showIndex: false },
  ],
  stats: [
    { label: 'count here', value: String(count) },
    { label: 'Each call sees', value: String(count), tone: 'bad' },
    { label: 'Each call queues', value: String(count + 1), tone: 'bad' },
  ],
  note: { text: 'count is a snapshot for this render: it does not change after setCount', tone: 'bad' },
});

// Step 4: one batched re-render.
const batchState = (phase: 0 | 1): ArrayState => ({
  rows: [
    { label: 'queued', cells: ['+1', '+1', '+1'], states: paint(3, () => (phase === 1 ? 'done' : 'active')), showIndex: false },
    { label: 'renders', cells: phase === 1 ? [1] : [0], states: { 0: phase === 1 ? 'found' : 'dim' }, showIndex: false },
  ],
  stats: [
    { label: 'Updates', value: '3' },
    { label: 'Re-renders', value: phase === 1 ? '1' : '0', tone: phase === 1 ? 'ok' : 'neutral' },
    { label: 'Final state', value: phase === 1 ? String(updaterSteps[2]) : '-', tone: phase === 1 ? 'ok' : 'neutral' },
  ],
  note: phase === 1 ? { text: 'the handler finished: React applied all three updates and rendered once', tone: 'ok' } : { text: 'while the handler runs, updates only pile up in the queue', tone: 'accent' },
});

export default defineLesson('array', {
  slug: 'react-setstate-batching',
  objectives: [
    { text: 'Why three setCount(count + 1) calls add only one', step: 1 },
    { text: 'Why count never changes inside one render', step: 2 },
    { text: 'How updater functions chain', step: 3 },
    { text: 'How React batches updates into one render', step: 4 },
  ],
  steps: [
    {
      label: 'The surprise',
      title: 'Three updates, one result',
      tag: 'problem',
      body: ['A button calls `setCount(count + 1)` three times. You expect 3, you get 1.', 'Each call puts an update in a queue, and the queue is processed after the handler.'],
      keyIdea: 'State updates are queued, not applied immediately.',
      frames: [0, 1, 2, 3].map((k) => ({ state: queueState('direct', k), hold: k === 3 ? 3600 : 1400 })),
    },
    {
      label: 'Snapshot',
      title: 'count is a constant per render',
      tag: 'concept',
      body: ['Inside one render, `count` is a plain variable with the value it had when React called the component.', 'All three calls read 0, so all three queue 1.'],
      keyIdea: 'Never mutate state or expect the variable to change mid-handler.',
      frames: [{ state: closureState(), hold: 3800 }],
    },
    {
      label: 'Updater',
      title: 'Pass a function instead',
      tag: 'technique',
      body: ['`setCount(c => c + 1)` queues a function. React runs the queued functions in order, each one getting the previous result.', 'Three calls now give 3.'],
      keyIdea: 'Use the updater form whenever the new state depends on the old state.',
      frames: [0, 1, 2, 3].map((k) => ({ state: queueState('updater', k), hold: k === 3 ? 3600 : 1400 })),
    },
    {
      label: 'Batching',
      title: 'One re-render for all of them',
      tag: 'in practice',
      body: ['React **batches** the queued updates: it waits for the handler to finish, applies them all, and re-renders once.', 'Three updates do not cost three renders.'],
      keyIdea: 'Batching is a performance feature, and it is why state looks asynchronous.',
      frames: [{ state: batchState(0), hold: 2200 }, { state: batchState(1), hold: 3400 }],
    },
    {
      label: 'Recap',
      title: 'How setState really works',
      tag: 'recap',
      body: [
        '- **Queue:** `setState` queues an update.',
        '- **Snapshot:** the variable never changes inside a render.',
        '- **Updater:** `setCount(c => c + 1)` chains correctly.',
        '- **Batching:** one re-render per handler.',
        '- **Immutability:** never mutate state, always set a new value.',
      ],
      keyIdea: 'If the next state depends on the previous one, pass a function.',
      frames: [{ state: queueState('updater', 3) }],
    },
  ],
});
