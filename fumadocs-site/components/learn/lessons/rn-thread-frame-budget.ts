import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the React Native notes on threads and animation jank: a frame has 16.7 ms at 60 Hz and 8.3 ms at 120 Hz,
 * and an animation driven from JS needs the JS thread free on every frame. A frame simulator decides which frames are
 * delivered. The 80 ms JS task is an EXAMPLE value, the dropped-frame counts are computed.
 */

const SPAN = 150; // ms shown
const BUSY: [number, number] = [33.4, 113.4]; // an 80 ms JS task, starting after two frames

type Frame = { n: number; from: number; to: number; ok: boolean };

/** A JS-driven animation delivers a frame only if the JS thread is free when the frame is due. */
const frames = (hz: number, driver: 'js' | 'native', busy: boolean): Frame[] => {
  const slot = 1000 / hz;
  const count = Math.floor(SPAN / slot);
  return Array.from({ length: count }, (_, i) => {
    const due = (i + 1) * slot;
    const blocked = busy && driver === 'js' && due > BUSY[0] && due < BUSY[1];
    return { n: i, from: i * slot, to: (i + 1) * slot, ok: !blocked };
  });
};
const dropped = (fs: Frame[]) => fs.filter((f) => !f.ok).length;

const bars = (lane: string, fs: Frame[]): TimelineBar[] => fs.map((f) => ({ id: `${lane}-${f.n}`, from: f.from, to: f.to, tone: f.ok ? 'ok' : 'bad', state: f.ok ? 'normal' : 'bad' }));

const view = (hz: number, opts: { busy: boolean; native?: boolean; note: TimelineState['note'] }): TimelineState => {
  const js = frames(hz, 'js', opts.busy);
  const nat = frames(hz, 'native', opts.busy);
  const lanes: TimelineState['lanes'] = [
    { label: 'JS thread', bars: opts.busy ? [{ id: 'busy', from: BUSY[0], to: BUSY[1], label: 'heavy work', tone: 'bad' }] : [{ id: 'idle', from: 0, to: SPAN, label: 'free', tone: 'neutral', state: 'dim' }] },
    { label: 'JS-driven', bars: bars('js', js) },
  ];
  if (opts.native) lanes.push({ label: 'UI-driven', bars: bars('nat', nat) });
  return {
    from: 0,
    to: SPAN,
    unit: 'ms',
    ticks: [0, 50, 100, 150],
    lanes,
    stats: [
      { label: 'Frame budget', value: `${(1000 / hz).toFixed(1)} ms` },
      { label: 'JS-driven drops', value: String(dropped(js)), tone: dropped(js) ? 'bad' : 'ok' },
      { label: 'UI-driven drops', value: opts.native ? String(dropped(nat)) : '-', tone: opts.native ? 'ok' : 'neutral' },
    ],
    note: opts.note,
  };
};

export default defineLesson('timeline', {
  slug: 'rn-thread-frame-budget',
  objectives: [
    { text: 'How big a frame is at 60 and 120 Hz', step: 1 },
    { text: 'Why a busy JS thread drops JS-driven frames', step: 2 },
    { text: 'Why UI-thread animations keep running', step: 3 },
    { text: 'Why 120 Hz makes jank easier to cause', step: 4 },
  ],
  steps: [
    {
      label: 'Budget',
      title: '16.7 ms per frame',
      tag: 'problem',
      body: ['At 60 Hz each frame has about **16.7 ms**. The **UI thread** draws views and handles touch and scroll, the **JS thread** runs your React code.', 'Every frame is a green slot when the thread driving it is free.'],
      keyIdea: 'Blocking the UI thread freezes the whole app, blocking the JS thread lags taps and JS-driven updates.',
      frames: [{ state: view(60, { busy: false, note: { text: 'nothing is blocking: every JS-driven frame is delivered', tone: 'ok' } }), hold: 3600 }],
    },
    {
      label: 'JS busy',
      title: 'A long JS task drops frames',
      tag: 'concept',
      body: ['An 80 ms JS task (an example) lands in the middle of an animation. A frame driven from JS needs JS free when it is due, so the frames inside the task are dropped.', 'The animation visibly stutters.'],
      keyIdea: 'A JS task longer than one frame drops frames for anything JS drives.',
      frames: [{ state: view(60, { busy: true, note: { text: 'frames due while JS was busy never arrived: the animation jumps', tone: 'bad' } }), hold: 4200 }],
    },
    {
      label: 'UI thread',
      title: 'Let native drive it',
      tag: 'technique',
      body: ['With the native driver or a Reanimated worklet, the animation is sent to the UI thread **once**, and native computes every frame.', 'The same busy JS task no longer affects it.'],
      keyIdea: 'Animate on the UI thread, keep JS for logic.',
      frames: [{ state: view(60, { busy: true, native: true, note: { text: 'the UI-driven lane never depended on JS, so no frame is lost', tone: 'ok' } }), hold: 4400 }],
    },
    {
      label: '120 Hz',
      title: 'Half the budget',
      tag: 'trade-off',
      body: ['At 120 Hz a frame has about **8.3 ms**. The same 80 ms task now spans roughly twice as many frames.', 'ProMotion iPhones and many Android phones run at 120 Hz.'],
      keyIdea: 'The faster the screen, the less slack JS has.',
      frames: [{ state: view(120, { busy: true, native: true, note: { text: 'more frames per task, so more drops for JS-driven motion', tone: 'bad' } }), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Threads and frames',
      tag: 'recap',
      body: [
        '- **UI thread:** views, touch, native scroll and animations.',
        '- **JS thread:** React code, handlers, business logic.',
        '- **Budget:** 16.7 ms at 60 Hz, 8.3 ms at 120 Hz.',
        '- **JS-driven motion:** drops frames when JS is busy.',
        '- **UI-driven motion:** native driver or worklets keep going.',
      ],
      keyIdea: 'Heavy computation belongs in native code or off the critical path.',
      frames: [{ state: view(60, { busy: true, native: true, note: { text: 'same busy period, two different drivers', tone: 'accent' } }) }],
    },
  ],
});
