import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Follows the Advanced JavaScript notes: async/await internals (output C A D B), await and then share the microtask queue,
 * and a blocked call stack delaying a 0 ms timer (output B A). The resume order comes from the order the continuations were queued.
 */

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };
function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

const MAIN: SeqActor[] = [
  { id: 'm', label: 'Main script', kind: 'client' },
  { id: 't', label: 'test()', kind: 'service' },
  { id: 'q', label: 'Microtask queue', kind: 'queue' },
];
const withQ = (text: string): SeqActor[] => MAIN.map((a) => (a.id === 'q' ? { ...a, badge: { text, tone: 'accent' as const } } : a));
const out = (s: string): Stat => ({ label: 'Output so far', value: s });

// Step 1: await looks like blocking, but it is not.
const problemFrames = reveal(MAIN, [
  {
    msgs: [{ from: 'm', to: 't', label: 'test()  (has an await)' }],
    hold: 3200,
    stats: [{ label: 'await', value: 'pauses test()' }, { label: 'Pauses the thread?', value: 'no', tone: 'ok' }, { label: 'Resumes via', value: 'microtask' }],
    note: { text: 'await pauses the function, not the whole program', tone: 'accent' },
  },
]);

// Step 2: C A D B. The rest of the function after await becomes a microtask.
const flowFrames = reveal(MAIN, [
  { msgs: [{ from: 'm', to: 'm', label: 'log C' }], hold: 1400, stats: [out('C'), { label: 'Queue', value: 'empty' }, { label: 'Stack', value: 'main' }] },
  { msgs: [{ from: 'm', to: 't', label: 'call test()' }, { from: 't', to: 't', label: 'log A' }], hold: 1600, stats: [out('C A'), { label: 'Queue', value: 'empty' }, { label: 'Stack', value: 'test()' }] },
  { msgs: [{ from: 't', to: 'q', label: 'await: queue the rest' }, { from: 't', to: 'm', label: 'return control', dashed: true }], actors: withQ('rest of test()'), hold: 2000, stats: [out('C A'), { label: 'Queue', value: '1 task' }, { label: 'Control', value: 'back to main' }], note: { text: 'await hands control back to the caller', tone: 'accent' } },
  { msgs: [{ from: 'm', to: 'm', label: 'log D' }], actors: withQ('rest of test()'), hold: 1500, stats: [out('C A D'), { label: 'Queue', value: '1 task' }, { label: 'Stack', value: 'empty next' }] },
  { msgs: [{ from: 'q', to: 't', label: 'resume test()', tone: 'ok' }, { from: 't', to: 't', label: 'log B' }], actors: withQ('empty'), hold: 3200, stats: [out('C A D B'), { label: 'Queue', value: 'empty' }, { label: 'Order', value: 'C A D B', tone: 'ok' }], note: { text: 'the stack emptied, so the microtask resumed test()', tone: 'ok' } },
]);

// Step 3: await and then use the same queue, first come first served.
const SAME: SeqActor[] = [
  { id: 'a', label: 'await', kind: 'worker' },
  { id: 'q', label: 'Microtask queue', kind: 'queue' },
  { id: 'n', label: 'then', kind: 'service' },
];
const sameFrames = reveal(SAME, [
  { msgs: [{ from: 'a', to: 'q', label: 'await: queue continuation' }], hold: 1900, stats: [{ label: 'Queue', value: 'await first' }, { label: 'Same queue', value: 'as then', tone: 'ok' }, { label: 'Order', value: 'FIFO' }] },
  { msgs: [{ from: 'n', to: 'q', label: '.then(): queue callback' }], hold: 1900, stats: [{ label: 'Queue', value: 'await, then' }, { label: 'Same queue', value: 'as then', tone: 'ok' }, { label: 'Order', value: 'FIFO' }] },
  { msgs: [{ from: 'q', to: 'a', label: 'runs 1st', tone: 'ok' }, { from: 'q', to: 'n', label: 'runs 2nd', tone: 'ok' }], hold: 3200, stats: [{ label: 'Queue', value: 'drained' }, { label: 'Priority', value: 'equal', tone: 'ok' }, { label: 'Decides', value: 'queue order' }], note: { text: 'same priority, so queue order decides', tone: 'ok' } },
]);

// Step 4: a blocked stack delays even a 0 ms timer. Output is B then A.
const BLOCK: SeqActor[] = [
  { id: 'm', label: 'Main script', kind: 'client' },
  { id: 'w', label: 'Timer (Web API)', kind: 'external' },
  { id: 'l', label: 'Event loop', kind: 'gateway' },
];
const blockFrames = reveal(BLOCK, [
  { msgs: [{ from: 'm', to: 'w', label: 'setTimeout(A, 0)' }, { from: 'w', to: 'l', label: 'ready: A', dashed: true }], hold: 2000, stats: [out('-'), { label: 'Timer', value: 'ready now' }, { label: 'Stack', value: 'busy' }] },
  { msgs: [{ from: 'l', to: 'm', label: 'stack busy: wait', lost: true, tone: 'bad' }, { from: 'm', to: 'm', label: 'long for loop', tone: 'bad' }], hold: 2200, stats: [out('-'), { label: 'Loop', value: 'holds stack', tone: 'bad' }, { label: 'A', value: 'waiting', tone: 'bad' }] },
  { msgs: [{ from: 'm', to: 'm', label: 'log B' }, { from: 'l', to: 'm', label: 'now run A', tone: 'ok' }], hold: 3200, stats: [out('B A'), { label: 'Order', value: 'B then A', tone: 'ok' }, { label: 'Lesson', value: 'never block' }], note: { text: 'a 0 ms timer still waits for the stack to clear', tone: 'bad' } },
]);

export default defineLesson('sequence', {
  slug: 'js-async-await',
  objectives: [
    { text: 'That await pauses a function, not the thread', step: 1 },
    { text: 'The step-by-step order behind C A D B', step: 2 },
    { text: 'How await and then share one microtask queue', step: 3 },
    { text: 'Why a blocked call stack delays timers', step: 4 },
  ],
  steps: [
    {
      label: 'What await does',
      title: 'Pause the function, not the program',
      tag: 'problem',
      body: ['`await` makes async code read like synchronous code, which makes it look like it blocks.', 'It does not. It pauses only the function it is in.'],
      keyIdea: 'Everything after the await is scheduled to resume later.',
      frames: problemFrames,
    },
    {
      label: 'Order',
      title: 'Follow the control flow',
      tag: 'concept',
      body: ['`test()` runs synchronously until its first `await`, so `A` logs before `D`.', 'At the `await`, the rest of the function is queued as a **microtask** and control returns to the caller. When the stack is empty, it resumes and logs `B`.'],
      keyIdea: 'Output order: C, A, D, B.',
      frames: flowFrames,
    },
    {
      label: 'await vs then',
      title: 'One queue, first come first served',
      tag: 'technique',
      body: ['An `await` continuation and a `.then()` callback both go to the **microtask queue**.', 'They have equal priority, so whichever was queued first runs first.'],
      keyIdea: 'async/await is promises with nicer syntax, not a different scheduling system.',
      frames: sameFrames,
    },
    {
      label: 'Blocking',
      title: 'A busy stack stalls timers',
      tag: 'trade-off',
      body: ['`setTimeout(A, 0)` followed by a very long `for` loop still logs `B` before `A`.', 'The timer is ready, but the event loop cannot push its callback until the call stack is free.'],
      keyIdea: 'Await does not make slow synchronous code non-blocking. Offload it to a worker.',
      frames: blockFrames,
    },
    {
      label: 'Recap',
      title: 'Async JavaScript rules',
      tag: 'recap',
      body: [
        '- **await** pauses only its function and queues the rest as a microtask.',
        '- **Control** returns to the caller at the first await.',
        '- **await and then** share the microtask queue, FIFO.',
        '- **Microtasks** run before the next macrotask.',
        '- **Long sync work** blocks timers and rendering.',
      ],
      keyIdea: 'To predict output: run sync code, then drain microtasks in queue order, then take one timer.',
      frames: [flowFrames[flowFrames.length - 1]],
    },
  ],
});
