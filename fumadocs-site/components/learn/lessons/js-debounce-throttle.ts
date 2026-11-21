import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * The two wrappers from the notes are simulated on a fixed stream of events, so every run shown is where the real logic would fire.
 *   debounce(fn, delay): every event restarts a timer, fn runs once the events stop for delay ms.
 *   throttle(fn, limit): fn runs on an event only if limit ms have passed since the last run.
 * Event times are in ms.
 */

const EVENTS = [0, 80, 160, 240, 320, 1200, 1280];
const DELAY = 300;
const LIMIT = 300;

function runDebounce(events: number[], delay: number): number[] {
  const fires: number[] = [];
  events.forEach((t, i) => {
    const next = events[i + 1];
    if (next === undefined || next - t >= delay) fires.push(t + delay); // timer not cleared by a later event
  });
  return fires;
}
function runThrottle(events: number[], limit: number): number[] {
  const runs: number[] = [];
  let last = -Infinity;
  for (const t of events) {
    if (t - last >= limit) {
      last = t;
      runs.push(t);
    }
  }
  return runs;
}
const DEB = runDebounce(EVENTS, DELAY);
const THR = runThrottle(EVENTS, LIMIT);

const dot = (id: string, at: number, tone: TimelineBar['tone'], label = ''): TimelineBar => ({ id, from: at, to: at + 30, label, tone });
const base = (lanes: TimelineState['lanes'], stats: TimelineState['stats'], note: TimelineState['note']): TimelineState => ({
  from: 0,
  to: 1800,
  unit: 'ms',
  ticks: [0, 300, 600, 900, 1200, 1500, 1800],
  lanes,
  stats,
  note,
});
const eventsLane = (upTo = EVENTS.length) => ({ label: 'Events', bars: EVENTS.slice(0, upTo).map((t, i) => dot(`e${i}`, t, 'accent')) });
const debLane = (upTo = DEB.length) => ({ label: 'Debounce runs', bars: DEB.slice(0, upTo).map((t, i) => dot(`d${i}`, t, 'ok')) });
const thrLane = (upTo = THR.length) => ({ label: 'Throttle runs', bars: THR.slice(0, upTo).map((t, i) => dot(`t${i}`, t, 'info')) });

// Step 1: raw events.
const raw = base(
  [eventsLane(), { label: 'fn runs', bars: EVENTS.map((t, i) => dot(`r${i}`, t, 'bad')) }],
  [{ label: 'Events', value: String(EVENTS.length) }, { label: 'fn runs', value: String(EVENTS.length), tone: 'bad' }, { label: 'Bursts', value: '2' }],
  { text: 'without a wrapper, a burst of keystrokes runs fn on every one', tone: 'bad' },
);

// Step 2: debounce waits for quiet.
const debounce = (n: number): TimelineState =>
  base(
    [eventsLane(), debLane(n)],
    [{ label: 'Delay', value: `${DELAY} ms` }, { label: 'fn runs', value: `${n} of ${DEB.length}`, tone: 'ok' }, { label: 'Runs', value: n ? DEB.slice(0, n).map((t) => `${t}`).join(', ') : '-' }],
    n === 0 ? { text: 'every event cancels the timer and starts a new one', tone: 'accent' } : n === 1 ? { text: `first burst ends at 320: fn runs once at ${DEB[0]} ms`, tone: 'ok' } : { text: `second burst ends at 1280: fn runs once at ${DEB[1]} ms`, tone: 'ok' },
  );

// Step 3: throttle caps the rate.
const throttle = (n: number): TimelineState =>
  base(
    [eventsLane(), thrLane(n)],
    [{ label: 'Limit', value: `${LIMIT} ms` }, { label: 'fn runs', value: `${n} of ${THR.length}`, tone: 'ok' }, { label: 'Runs at', value: n ? THR.slice(0, n).join(', ') : '-' }],
    n === 0 ? { text: 'the first event runs at once, later ones inside the limit are dropped', tone: 'accent' } : { text: `runs at most once per ${LIMIT} ms, spaced from the last run`, tone: 'ok' },
  );

// Step 4: side by side.
const compare = base(
  [eventsLane(), debLane(), thrLane()],
  [{ label: 'Raw', value: `${EVENTS.length} runs`, tone: 'bad' }, { label: 'Debounce', value: `${DEB.length} runs`, tone: 'ok' }, { label: 'Throttle', value: `${THR.length} runs`, tone: 'ok' }],
  { text: 'debounce runs after the burst, throttle runs during it', tone: 'accent' },
);

export default defineLesson('timeline', {
  slug: 'js-debounce-throttle',
  objectives: [
    { text: 'Why bursts of events need rate limiting', step: 1 },
    { text: 'How debounce waits for events to stop', step: 2 },
    { text: 'How throttle caps how often fn runs', step: 3 },
    { text: 'When to choose debounce or throttle', step: 4 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Too many events',
      tag: 'problem',
      body: ['A user types, scrolls or resizes, and the browser fires dozens of events per second.', 'Calling an expensive function on every one wastes work.'],
      keyIdea: 'You want fewer calls, not fewer events.',
      frames: [{ state: raw, hold: 3200 }],
    },
    {
      label: 'Debounce',
      title: 'Wait for quiet',
      tag: 'technique',
      body: ['Every event runs `clearTimeout(timer)` and starts a new timer. The function runs only after events stop for `delay` ms.', 'A burst of five keystrokes produces one call.'],
      keyIdea: 'Good for search input and resize: you only care about the final value.',
      frames: [{ state: debounce(0), hold: 1800 }, { state: debounce(1), hold: 2400 }, { state: debounce(2), hold: 3200 }],
    },
    {
      label: 'Throttle',
      title: 'At most once per window',
      tag: 'technique',
      body: ['Throttle remembers the time of the last run. An event runs the function only if `limit` ms have passed, otherwise it is dropped.', 'The function keeps running during a burst, but at a capped rate.'],
      keyIdea: 'Good for scroll and infinite scroll: you want steady updates while it happens.',
      frames: [{ state: throttle(0), hold: 1800 }, { state: throttle(THR.length), hold: 3200 }],
    },
    {
      label: 'Compare',
      title: 'Same events, two behaviors',
      tag: 'trade-off',
      body: [`Seven events: raw runs ${EVENTS.length}, debounce runs ${DEB.length} (after each burst), throttle runs ${THR.length} (during the bursts).`, 'Debounce delays the result. Throttle gives early, regular updates.'],
      keyIdea: 'Pick by question: "only the final one" is debounce, "keep updating, but slowly" is throttle.',
      frames: [{ state: compare, hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Rate limiting events',
      tag: 'recap',
      body: [
        '- **Debounce:** restart a timer on each event, run after quiet.',
        '- **Throttle:** run at most once per `limit` ms.',
        '- **Use debounce** for search boxes and resize.',
        '- **Use throttle** for scroll and mouse move.',
        '- **Both** are closures: the timer or last-call time lives in the outer scope.',
      ],
      keyIdea: 'Both wrap a function and keep private state in a closure.',
      frames: [{ state: compare }],
    },
  ],
});
