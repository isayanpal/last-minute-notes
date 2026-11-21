import { defineLesson } from '../define';
import type { ArrayRow, ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * One product page with seven components. Row 1 is the server HTML (always visible).
 * Row 2 shows which components have handlers attached. Static parts are Hero, Text and Foot.
 */

const NAMES = ['Nav', 'Hero', 'Text', 'Buy', 'Cmts', 'Chat', 'Foot'];
const INTERACTIVE = new Set([0, 3, 4, 5]);

type H = 'off' | 'running' | 'on' | 'skip';

const htmlRow = (clicked?: number, bad = false): ArrayRow => ({
  label: 'HTML',
  cells: NAMES,
  states: Object.fromEntries(NAMES.map((_, i) => [i, 'visited'])) as Record<number, ItemState>,
  pointers: clicked === undefined ? undefined : [{ i: clicked, label: 'click', tone: bad ? 'bad' : 'ok', up: true }],
  showIndex: false,
});

const handlerRow = (h: H[]): ArrayRow => {
  const states: Record<number, ItemState> = {};
  const cells = h.map((v, i) => {
    states[i] = v === 'on' ? 'done' : v === 'running' ? 'active' : v === 'skip' ? 'dim' : 'normal';
    return v === 'on' ? 'on' : v === 'running' ? '...' : v === 'skip' ? 'html' : '';
  });
  return { label: 'JS', cells, states, showIndex: false };
};

const count = (h: H[]) => h.filter((v) => v === 'on').length;

const make = (h: H[], opts: { clicked?: number; bad?: boolean; stats?: ArrayState['stats']; note?: ArrayState['note'] } = {}): ArrayState => ({
  rows: [htmlRow(opts.clicked, opts.bad), handlerRow(h)],
  stats: opts.stats ?? [
    { label: 'Hydrated', value: `${count(h)} / ${NAMES.length}`, tone: count(h) === NAMES.length ? 'ok' : 'neutral' },
    { label: 'Static parts', value: `${NAMES.length - INTERACTIVE.size}` },
    { label: 'Handlers', value: `${count(h)}` },
  ],
  note: opts.note,
});

const off = (): H[] => NAMES.map(() => 'off');

// Step 1: looks ready, is not.
const NOT_READY: ArrayState = make(off(), {
  clicked: 3,
  bad: true,
  stats: [
    { label: 'Content', value: 'visible', tone: 'ok' },
    { label: 'Handlers', value: '0', tone: 'bad' },
    { label: 'Click on Buy', value: 'does nothing', tone: 'bad' },
  ],
  note: { text: 'looks ready but is not interactive yet', tone: 'bad' },
});

// Step 2: full hydration walks every component, static ones included.
function fullFrames(): Frame<ArrayState>[] {
  const frames: Frame<ArrayState>[] = [];
  [0, 2, 4, 6].forEach((i) => {
    const h: H[] = NAMES.map((_, j) => (j < i ? 'on' : 'off'));
    h[i] = 'running';
    frames.push({ hold: 900, state: make(h, { note: { text: `running ${NAMES[i]} again in the browser`, tone: 'accent' } }) });
  });
  frames.push({ hold: 2400, state: make(NAMES.map(() => 'on'), { note: { text: 'all code downloaded and executed, even for static parts', tone: 'bad' } }) });
  return frames;
}

// Step 3: ship less. Only interactive components hydrate.
const SHIP_LESS: H[] = NAMES.map((_, i) => (INTERACTIVE.has(i) ? 'on' : 'skip'));
const SHIP_LESS_STATE = make(SHIP_LESS, {
  stats: [
    { label: 'Hydrated', value: `${INTERACTIVE.size} / ${NAMES.length}`, tone: 'ok' },
    { label: 'Static', value: 'never ship JS', tone: 'ok' },
    { label: 'Via', value: 'RSC or islands' },
  ],
  note: { text: 'static parts never hydrate because they never ship', tone: 'ok' },
});

// Step 4: selective hydration. A click moves that boundary to the front of the queue.
const SELECTIVE: Frame<ArrayState>[] = [
  { hold: 1300, state: make(['on', 'skip', 'skip', 'running', 'off', 'off', 'skip'], { note: { text: 'default order: left to right, boundary by boundary', tone: 'accent' } }) },
  { hold: 1500, state: make(['on', 'skip', 'skip', 'running', 'off', 'off', 'skip'], { clicked: 5, note: { text: 'user clicks Chat while Buy is hydrating', tone: 'accent' } }) },
  { hold: 1500, state: make(['on', 'skip', 'skip', 'on', 'off', 'running', 'skip'], { clicked: 5, note: { text: 'Chat jumps the queue', tone: 'ok' } }) },
  { hold: 2000, state: make(['on', 'skip', 'skip', 'on', 'running', 'on', 'skip'], { note: { text: 'the rest follows, independent Suspense boundaries', tone: 'ok' } }) },
];

// Step 5: lazy hydration, directives like on visible and on idle.
const LAZY: Frame<ArrayState>[] = [
  { hold: 1300, state: make(['on', 'skip', 'skip', 'on', 'off', 'off', 'skip'], { note: { text: 'above the fold hydrates first, the rest waits', tone: 'accent' } }) },
  { hold: 1500, state: make(['on', 'skip', 'skip', 'on', 'running', 'off', 'skip'], { note: { text: 'Cmts scrolls into view: hydrate on visible', tone: 'accent' } }) },
  { hold: 2200, state: make(['on', 'skip', 'skip', 'on', 'on', 'running', 'skip'], { note: { text: 'Chat is rarely used: hydrate on idle or on click', tone: 'accent' } }) },
];

// Step 6: no hydration at all.
const RESUME: ArrayState = {
  rows: [
    htmlRow(),
    {
      label: 'listeners',
      cells: ['', '', '', 'in HTML', 'in HTML', 'in HTML', ''],
      states: { 0: 'dim', 1: 'dim', 2: 'dim', 3: 'found', 4: 'found', 5: 'found', 6: 'dim' },
      showIndex: false,
    },
  ],
  stats: [
    { label: 'Startup', value: 'no re-run', tone: 'ok' },
    { label: 'Code loads', value: 'on interaction', tone: 'ok' },
    { label: 'Example', value: 'Qwik' },
  ],
  note: { text: 'resumability: serialize listeners and state into the HTML', tone: 'ok' },
};

export default defineLesson('array', {
  slug: 'fe-hydration',
  objectives: [
    { text: 'What hydration is and why the page looks ready before it is', step: 1 },
    { text: 'The three costs of hydrating everything', step: 2 },
    { text: 'Hydrating less: RSC, islands, selective and lazy hydration', step: 3 },
    { text: 'How resumability and progressive enhancement avoid the tax', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'It looks ready, but it is not',
      tag: 'problem',
      body: ['SSR sends finished HTML, so the user sees content early. But the buttons have no handlers until JavaScript runs.', 'Clicks in that window do nothing. That is a source of poor INP and rage clicks.'],
      keyIdea: 'Hydration attaches event handlers and state to server-rendered HTML by running the components again in the browser.',
      frames: [{ state: NOT_READY }],
    },
    {
      label: 'Full hydration',
      title: 'Everything runs again',
      tag: 'concept',
      body: ['The framework downloads and executes all component code, even for parts that never change.', 'Server and client output must also match. Dates, random ids and `window` checks cause **hydration mismatches**.'],
      keyIdea: 'Hydration is the tax SSR pays for interactivity. The cost grows with the amount of JavaScript.',
      frames: fullFrames(),
    },
    {
      label: 'Ship less',
      title: 'Do not hydrate what never changes',
      tag: 'technique',
      body: ['**Server Components** and **islands** keep static parts as plain HTML. Only the interactive pieces ship code and hydrate.', 'Islands use directives such as on load, on visible or on idle to say when.'],
      keyIdea: 'Reduce the amount of JavaScript that has to hydrate rather than hiding the cost.',
      frames: [{ state: SHIP_LESS_STATE }],
    },
    {
      label: 'Selective',
      title: 'Hydrate what the user touches first',
      tag: 'technique',
      body: ['**Selective hydration** hydrates Suspense boundaries independently and prioritizes the one the user interacts with.', 'A slow widget no longer blocks a fast one from becoming interactive.'],
      keyIdea: 'Independent boundaries turn one long task into smaller ones the user can steer.',
      frames: SELECTIVE,
    },
    {
      label: 'Lazy',
      title: 'Wait until it is needed',
      tag: 'technique',
      body: ['**Lazy hydration** delays below-the-fold or rarely used widgets until they are visible or interacted with.', 'The main thread stays free for what the user is actually doing.'],
      keyIdea: 'Hydrate on visible, on idle or on interaction for anything that is not needed at first paint.',
      frames: LAZY,
    },
    {
      label: 'No hydration',
      title: 'Resume instead of replay',
      tag: 'in practice',
      body: ['**Resumability** (Qwik) serializes listeners and state into the HTML. The client resumes without re-executing components and loads code on interaction.', '**Progressive enhancement** is the simplest form: links and forms work as HTML first, JavaScript improves them.'],
      keyIdea: 'The cheapest hydration is the one that never has to happen.',
      frames: [{ state: RESUME }],
    },
    {
      label: 'Recap',
      title: 'Four ways to pay less',
      tag: 'recap',
      body: [
        '- **Ship less JS:** Server Components, islands.',
        '- **Hydrate less, later:** selective, lazy, on visible or idle.',
        '- **Hydrate nothing:** resumability.',
        '- **Make it cheaper:** smaller trees, React Compiler.',
        '- **Watch for:** hydration mismatches from dates, random ids and `window` checks.',
      ],
      keyIdea: 'In an interview: "hydration is the tax SSR pays for interactivity, so I reduce the JS that must hydrate."',
      frames: [{ state: SHIP_LESS_STATE }],
    },
  ],
});
