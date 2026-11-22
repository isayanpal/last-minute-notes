import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the React Native notes on animations: the native driver only handles opacity and transform, Reanimated runs worklets
 * on the UI thread, drag gestures must not round-trip through JS, and the tool depends on what is animated.
 * The property check, the interpolation and the lag are computed by real code. The 3 blocked JS frames and 10 px per frame are EXAMPLE values.
 */

// Step 1: which properties the native driver supports.
const NATIVE_OK = new Set(['opacity', 'transform']);
const nativeDriver = (prop: string) => NATIVE_OK.has(prop);
const PROPS = ['opacity', 'transform', 'width', 'color'];

// Step 2: a worklet maps a shared value to a style on the UI thread.
const interpolate = (v: number, [a, b]: [number, number], [c, d]: [number, number]) => c + ((v - a) / (b - a)) * (d - c);
const scaleAt = (pressed: number) => interpolate(pressed, [0, 1], [1, 0.96]);

// Step 3: a finger moves 10 px per frame, JS is blocked for three frames.
const FINGER_STEP = 10;
const BLOCKED = [3, 4, 5];
const lagAt = (frame: number, nativeDriven: boolean) => {
  const finger = frame * FINGER_STEP;
  if (nativeDriven) return 0;
  const lastDelivered = [...Array(frame + 1).keys()].filter((f) => !BLOCKED.includes(f)).pop() ?? 0;
  return finger - lastDelivered * FINGER_STEP;
};
const MAX_LAG = Math.max(...[0, 1, 2, 3, 4, 5, 6].map((f) => lagAt(f, false)));

// Step 4: choosing a tool from what is animated.
const TOOLS: { what: string; tool: string; why: string }[] = [
  { what: 'expand toggle', tool: 'CSS transition', why: 'a simple state change needs no gesture or scroll' },
  { what: 'drag a card', tool: 'Gesture+Reanim', why: 'it must follow the finger on the UI thread' },
  { what: 'parallax', tool: 'scroll handler', why: 'it follows the scroll offset' },
  { what: 'custom chart', tool: 'Skia', why: 'custom drawing, charts and shaders' },
];

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

const driver = (i: number): FlowState => {
  const prop = PROPS[i];
  const ok = nativeDriver(prop);
  return {
    nodes: [
      { id: 'p', label: prop, sub: 'animated property', kind: 'client', x: 0.1, y: 1.7, status: 'active' },
      { id: 'd', label: 'Animated.timing', sub: 'useNativeDriver', kind: 'gateway', x: 2.9, y: 1.7, status: 'active' },
      { id: 'r', label: ok ? 'UI thread' : 'Not supported', sub: ok ? 'native per frame' : 'needs layout', kind: ok ? 'service' : 'external', x: 5.5, y: 1.7, status: ok ? 'active' : 'down' },
    ],
    links: [{ from: 'p', to: 'd' }, { from: 'd', to: 'r' }],
    packets: [hop('p', 'd', prop, 0, ok ? 'req' : 'bad'), hop('d', 'r', ok ? 'start once' : 'rejected', 0.6, ok ? 'ok' : 'bad')],
    stats: [
      { label: 'Property', value: prop },
      { label: 'Native driver', value: ok ? 'works' : 'no', tone: ok ? 'ok' : 'bad' },
      { label: 'Alternative', value: ok ? '-' : 'Reanimated' },
    ],
    note: ok ? { text: 'non-layout properties can be described once and run natively', tone: 'ok' } : { text: `${prop} needs a layout or colour pass the native driver cannot do`, tone: 'bad' },
  };
};

const worklet = (phase: 0 | 1 | 2): FlowState => {
  const pressed = phase === 0 ? 0 : 1;
  return {
    nodes: [
      { id: 'sv', label: 'Shared value', sub: `pressed = ${pressed}`, kind: 'cache', x: 0.1, y: 1.7, status: 'active' },
      { id: 'w', label: 'Worklet', sub: 'UI thread', kind: 'worker', x: 2.9, y: 1.7, status: phase >= 1 ? 'active' : 'normal', items: phase >= 1 ? ['scale'] : undefined },
      { id: 'st', label: 'Style', sub: `scale ${scaleAt(pressed).toFixed(2)}`, kind: 'storage', x: 5.5, y: 1.7, status: phase === 2 ? 'active' : 'normal' },
      { id: 'rx', label: 'React render', sub: 'not involved', kind: 'client', x: 2.9, y: 3.2, status: 'dim' },
    ],
    links: [{ from: 'sv', to: 'w' }, { from: 'w', to: 'st' }],
    packets: phase === 1 ? [hop('sv', 'w', 'value changed', 0, 'req')] : phase === 2 ? [hop('w', 'st', `scale ${scaleAt(1).toFixed(2)}`, 0, 'ok')] : [],
    stats: [
      { label: 'Scale', value: scaleAt(pressed).toFixed(2), tone: pressed ? 'ok' : 'neutral' },
      { label: 'React renders', value: '0', tone: 'ok' },
      { label: 'Layout props', value: 'allowed', tone: 'ok' },
    ],
    note: phase === 0 ? { text: 'a shared value is readable from JS and the UI thread, and changing it does not re-render React', tone: 'accent' } : phase === 1 ? { text: 'press: the UI-thread worklet re-runs because the shared value changed', tone: 'accent' } : { text: 'useAnimatedStyle maps the value to a style on the UI thread, with no React render', tone: 'ok' },
  };
};

const gesture = (nativeDriven: boolean): FlowState => {
  const lag = nativeDriven ? 0 : MAX_LAG;
  const nodes: FlowNode[] = [
    { id: 'f', label: 'Finger', sub: `${FINGER_STEP} px per frame`, kind: 'client', x: 0.1, y: 1.7, status: 'active' },
    { id: 'g', label: 'Gesture', sub: 'handler', kind: 'gateway', x: 1.9, y: 1.7, status: 'active' },
    { id: 'js', label: 'JS thread', sub: nativeDriven ? 'not needed' : 'blocked 3 frames', kind: 'worker', x: 3.9, y: 0.4, status: nativeDriven ? 'dim' : 'hot' },
    { id: 'w', label: 'Worklet', sub: 'UI thread', kind: 'service', x: 3.9, y: 3.0, status: nativeDriven ? 'active' : 'dim' },
    { id: 'v', label: 'View', sub: nativeDriven ? 'sticks to finger' : `lags ${lag} px`, kind: 'storage', x: 5.7, y: 1.7, status: nativeDriven ? 'active' : 'down' },
  ];
  const via = nativeDriven ? 'w' : 'js';
  return {
    nodes,
    links: [{ from: 'f', to: 'g' }, { from: 'g', to: via }, { from: via, to: 'v' }],
    packets: [hop('f', 'g', 'touch', 0, 'req'), hop('g', via, 'position', 0.5, nativeDriven ? 'ok' : 'bad'), hop(via, 'v', 'move', 1.0, nativeDriven ? 'ok' : 'bad')],
    stats: [
      { label: 'Handled on', value: nativeDriven ? 'UI thread' : 'JS thread', tone: nativeDriven ? 'ok' : 'bad' },
      { label: 'Max lag', value: `${lag} px`, tone: lag ? 'bad' : 'ok' },
      { label: 'JS blocked', value: '3 frames' },
    ],
    note: nativeDriven ? { text: 'the worklet moves the view on the UI thread, so a busy JS thread cannot make it lag', tone: 'ok' } : { text: `touch goes to JS and back: while JS is busy the view falls ${lag} px behind the finger`, tone: 'bad' },
  };
};

const choose = (i: number): FlowState => {
  const t = TOOLS[i];
  return {
    nodes: [
      { id: 'q', label: t.what, sub: 'what animates', kind: 'client', x: 0.1, y: 1.7, status: 'active' },
      { id: 'c', label: 'Pick a tool', sub: 'by motion type', kind: 'gateway', x: 2.9, y: 1.7, status: 'active' },
      { id: 't', label: t.tool, sub: 'recommended', kind: 'service', x: 5.4, y: 1.7, status: 'active' },
    ],
    links: [{ from: 'q', to: 'c' }, { from: 'c', to: 't' }],
    packets: [hop('q', 'c', t.what, 0, 'req'), hop('c', 't', t.tool, 0.6, 'ok')],
    stats: [
      { label: 'Animating', value: t.what },
      { label: 'Tool', value: t.tool, tone: 'ok' },
      { label: 'Runs on', value: t.tool === 'CSS transition' ? 'UI thread' : 'UI thread', tone: 'ok' },
    ],
    note: { text: t.why, tone: 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'rn-animation-tools',
  objectives: [
    { text: 'What the native driver can and cannot animate', step: 1 },
    { text: 'How a Reanimated worklet runs without React', step: 2 },
    { text: 'Why drag gestures must stay on the UI thread', step: 3 },
    { text: 'How to pick a tool for a given motion', step: 4 },
  ],
  steps: [
    {
      label: 'Native driver',
      title: 'Only opacity and transform',
      tag: 'problem',
      body: ['`useNativeDriver: true` sends the whole animation to native once, and native computes every frame.', 'It works for `opacity` and `transform`. Anything that needs layout, like `width`, or most colours, does not.'],
      keyIdea: 'Animate size with `transform: scale`, or use Reanimated.',
      frames: [0, 1, 2, 3].map((i) => ({ state: driver(i), hold: i === 3 ? 3400 : 2200 })),
    },
    {
      label: 'Reanimated',
      title: 'Worklets on the UI thread',
      tag: 'concept',
      body: ['A **shared value** is readable from JS and the UI thread. A **worklet** is a function copied to the UI runtime.', 'Changing `.value` does not re-render React, and Reanimated can animate layout properties too.'],
      keyIdea: 'Use `runOnJS` only when a worklet must call back into React.',
      frames: [0, 1, 2].map((p) => ({ state: worklet(p as 0 | 1 | 2), hold: p === 2 ? 3800 : 2200 })),
    },
    {
      label: 'Gestures',
      title: 'Follow the finger natively',
      tag: 'trade-off',
      body: ['If every touch event goes to JS and back, the view lags behind the finger whenever JS is busy.', 'Gesture Handler plus a Reanimated worklet keeps the whole loop on the UI thread.'],
      keyIdea: 'Gesture-driven motion has the same jank problem as JS-driven animation.',
      frames: [{ state: gesture(false), hold: 4200 }, { state: gesture(true), hold: 4200 }],
    },
    {
      label: 'Choosing',
      title: 'Match the tool to the motion',
      tag: 'in practice',
      body: ['A simple state change needs a CSS-style transition. A drag needs Gesture Handler and Reanimated. Scroll-linked effects need a scroll handler.', 'Custom drawing and charts go to Skia.'],
      keyIdea: 'Pick the simplest tool that runs on the UI thread.',
      frames: [0, 1, 2, 3].map((i) => ({ state: choose(i), hold: 2800 })),
    },
    {
      label: 'Recap',
      title: 'Animation tools',
      tag: 'recap',
      body: [
        '- **Native driver:** opacity and transform only.',
        '- **Reanimated:** shared values and worklets on the UI thread.',
        '- **Gestures:** keep the touch loop off the JS thread.',
        '- **CSS transitions:** simple state-driven changes.',
        '- **Skia and Lottie:** custom drawing and designer files.',
      ],
      keyIdea: 'If it must stay smooth while JS is busy, it must run on the UI thread.',
      frames: [{ state: gesture(true) }],
    },
  ],
});
