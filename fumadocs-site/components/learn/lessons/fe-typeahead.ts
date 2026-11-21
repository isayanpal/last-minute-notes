import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * One slot is 100 ms. The word is "apple", typed one key per slot.
 * Debounce, latency and cache behaviour below are simulated, not hard coded per frame.
 */

const SLOTS = 10;
const WORD = 'apple';
const blank = (n = SLOTS) => Array.from({ length: n }, () => '');
const at = (cells: string[], i: number, v: string) => {
  const out = [...cells];
  out[i] = v;
  return out;
};

// Step 1: naive, one request per key.
const NAIVE: ArrayState = (() => {
  let keys = blank();
  let reqs = blank();
  const states: Record<number, ItemState> = {};
  for (let i = 0; i < WORD.length; i++) {
    keys = at(keys, i, WORD[i]);
    reqs = at(reqs, i, WORD.slice(0, i + 1));
    states[i] = 'bad';
  }
  return {
    rows: [
      { label: 'keys', cells: keys, states: { 0: 'visited', 1: 'visited', 2: 'visited', 3: 'visited', 4: 'visited' }, showIndex: true },
      { label: 'requests', cells: reqs, states, showIndex: false },
    ],
    stats: [
      { label: 'Keystrokes', value: '5' },
      { label: 'Requests', value: '5', tone: 'bad' },
      { label: 'Useful', value: '1', tone: 'bad' },
    ],
    note: { text: 'four of five requests are answered for text that is already gone', tone: 'bad' },
  };
})();

// Step 2: debounce. Fire only after a 200 ms pause.
const DEBOUNCE_MS = 2;
function debounceFrames(): Frame<ArrayState>[] {
  const frames: Frame<ArrayState>[] = [];
  const show = new Set([0, 2, 4, 5, 6]);
  let keys = blank();
  let reqs = blank();
  let lastKey = -1;
  let fired = false;
  for (let t = 0; t <= 6; t++) {
    if (t < WORD.length) {
      keys = at(keys, t, WORD[t]);
      lastKey = t;
    }
    const quiet = t - lastKey;
    const fireNow = !fired && quiet >= DEBOUNCE_MS;
    if (fireNow) {
      reqs = at(reqs, t, WORD);
      fired = true;
    }
    if (!show.has(t)) continue;
    const waiting = !fired && quiet > 0;
    frames.push({
      hold: fireNow ? 2600 : 1100,
      state: {
        rows: [
          {
            label: 'keys',
            cells: [...keys],
            states: Object.fromEntries(keys.map((k, i) => [i, k ? 'visited' : 'normal'])) as Record<number, ItemState>,
            window: waiting ? { from: lastKey + 1, to: t, label: 'quiet', tone: 'accent' } : undefined,
            showIndex: true,
          },
          { label: 'requests', cells: [...reqs], states: Object.fromEntries(reqs.map((r, i) => [i, r ? 'found' : 'normal'])) as Record<number, ItemState>, showIndex: false },
        ],
        stats: [
          { label: 'Debounce', value: '200 ms' },
          { label: 'Requests', value: fired ? '1' : '0', tone: fired ? 'ok' : 'neutral' },
          { label: 'Min length', value: '1 to 2 chars' },
        ],
        note: fireNow ? { text: 'typing stopped: send one request for "apple"', tone: 'ok' } : { text: 'each key restarts the timer', tone: 'accent' },
      },
    });
  }
  return frames;
}

// Step 3: out-of-order responses. "a" is slow, "ap" is fast.
const LAT: Record<string, number> = { a: 5, ap: 1 };
function raceFrame(t: number, guard: boolean): ArrayState {
  const sent = blank();
  const arrive = blank();
  const arriveStates: Record<number, ItemState> = {};
  let shown = '-';
  let latest = '';
  ['a', 'ap'].forEach((q, i) => {
    if (t >= i) {
      sent[i] = q;
      latest = q;
    }
  });
  const events = ['a', 'ap']
    .map((q, i) => ({ q, slot: i + LAT[q] }))
    .sort((x, y) => x.slot - y.slot);
  events.forEach((e) => {
    if (t >= e.slot) {
      arrive[e.slot] = e.q;
      const stale = e.q !== latest;
      if (guard && stale) arriveStates[e.slot] = 'dim';
      else {
        shown = e.q;
        arriveStates[e.slot] = !guard && stale ? 'bad' : 'found';
      }
    }
  });
  const wrong = shown !== '-' && shown !== 'ap';
  return {
    rows: [
      { label: 'sent', cells: sent, states: Object.fromEntries(sent.map((s, i) => [i, s ? 'visited' : 'normal'])) as Record<number, ItemState>, showIndex: true },
      { label: 'arrives', cells: arrive, states: arriveStates, showIndex: false },
    ],
    panels: [{ title: 'UI shows', kind: 'list', items: [shown === '-' ? 'nothing yet' : `results for "${shown}"`, 'input says "ap"'], highlight: 0 }],
    stats: [
      { label: 'Input', value: '"ap"' },
      { label: 'Shown', value: shown === '-' ? '-' : `"${shown}"`, tone: wrong ? 'bad' : shown === '-' ? 'neutral' : 'ok' },
      { label: 'Guard', value: guard ? 'abort + id' : 'none', tone: guard ? 'ok' : 'bad' },
    ],
    note: wrong ? { text: 'the slow response for "a" overwrote the right one', tone: 'bad' } : guard && t >= 5 ? { text: 'stale response ignored, UI still matches the input', tone: 'ok' } : undefined,
  };
}

// Step 4: prefix cache. Answer locally when you can.
type Lookup = { q: string; from: 'cache' | 'prefix' | 'network' };
const cacheState = (l: Lookup, cached: string[]): ArrayState => {
  // Longest cached prefix of the query, if any.
  const best = cached.reduce((acc, c, i) => (l.q.startsWith(c) && (acc < 0 || c.length > cached[acc].length) ? i : acc), -1);
  const hit = l.from !== 'network' && best >= 0;
  return {
    rows: [
      {
        label: 'cache',
        cells: cached,
        states: Object.fromEntries(cached.map((_, i) => [i, hit && i === best ? (cached[i] === l.q ? 'found' : 'path') : 'normal'])) as Record<number, ItemState>,
        pointers: [{ i: hit ? best : 0, label: l.from === 'cache' ? 'exact hit' : l.from === 'prefix' ? 'prefix hit' : 'miss', tone: hit ? 'ok' : 'bad', up: true }],
        showIndex: false,
      },
    ],
    panels: [
      {
        title: `query "${l.q}"`,
        kind: 'list',
        items: l.from === 'cache' ? ['in cache', 'no request'] : l.from === 'prefix' ? ['"ap" had the full set', 'filter locally', 'no request'] : ['no cached prefix', 'abort previous', 'fetch with signal'],
        highlight: 0,
      },
    ],
    stats: [
      { label: 'Source', value: l.from, tone: l.from === 'network' ? 'neutral' : 'ok' },
      { label: 'Network', value: l.from === 'network' ? '1 request' : 'none', tone: l.from === 'network' ? 'neutral' : 'ok' },
      { label: 'Key', value: 'norm. prefix' },
    ],
  };
};

// Step 5: the state model, walked once.
const STATES = ['idle', 'type', 'load', 'items', 'empty', 'error'];
const stateFrame = (active: number, note: string): ArrayState => ({
  rows: [
    {
      label: 'state',
      cells: STATES,
      states: Object.fromEntries(STATES.map((_, i) => [i, i === active ? 'active' : i < active ? 'done' : 'normal'])) as Record<number, ItemState>,
      pointers: active === 3 ? [{ i: 3, label: 'highlightedIndex', tone: 'ok', up: true }] : [{ i: active, label: 'now', tone: 'accent', up: true }],
      showIndex: false,
    },
  ],
  stats: [
    { label: 'isOpen', value: active >= 2 ? 'true' : 'false' },
    { label: 'Keys', value: 'arrows, Enter' },
    { label: 'Show', value: 'every state', tone: 'ok' },
  ],
  note: { text: note, tone: active === 5 ? 'bad' : 'accent' },
});

// Step 6: IME composition. Do not search while the user is still composing.
const IME: ArrayState = {
  rows: [
    {
      label: 'events',
      cells: ['start', 'n', 'ni', 'nih', 'end'],
      states: { 0: 'dim', 1: 'dim', 2: 'dim', 3: 'dim', 4: 'found' },
      pointers: [{ i: 4, label: 'search once', tone: 'ok', up: true }],
      window: { from: 0, to: 3, label: 'composing: no search', tone: 'bad' },
      showIndex: false,
    },
  ],
  panels: [{ title: 'also', kind: 'list', items: ['escape, then highlight', 'recents on focus', 'inputmode, enterkeyhint'] }],
  stats: [
    { label: 'Between', value: 'IME events' },
    { label: 'Applies to', value: 'CJK input' },
    { label: 'Highlight', value: 'escape first', tone: 'ok' },
  ],
  note: { text: 'IME input produces many events for one intended word', tone: 'accent' },
};

export default defineLesson('array', {
  slug: 'fe-typeahead',
  objectives: [
    { text: 'Why one request per keystroke is wasteful', step: 1 },
    { text: 'How debounce collapses a burst of typing', step: 2 },
    { text: 'Why a slow old response can overwrite a new one', step: 3 },
    { text: 'How a prefix cache answers queries without the network', step: 4 },
    { text: 'The state model and accessibility contract', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'A request for every key',
      tag: 'problem',
      body: ['A search box with suggestions has to feel instant, work by keyboard and for screen readers, and survive slow networks and many results.', 'Firing a request on every keystroke sends four answers nobody will see.'],
      keyIdea: 'Requirements first: fast, keyboard and screen reader friendly, reusable, handles slow networks and large result sets.',
      frames: [{ state: NAIVE }],
    },
    {
      label: 'Debounce',
      title: 'Wait for a pause',
      tag: 'technique',
      body: ['**Debounce** 100 to 300 ms: every keystroke restarts a timer and only the last one fires. Start searching at 1 or 2 characters.', 'Optionally throttle for long typing sessions.'],
      keyIdea: 'Five keystrokes, one request. The rate you choose trades responsiveness against load.',
      frames: debounceFrames(),
    },
    {
      label: 'Races',
      title: 'The slow answer arrives last',
      tag: 'trade-off',
      body: ['Type "a" then "ap". The response for "a" is slower and arrives after the one for "ap". Without a guard it overwrites the right results.', '**Abort** the previous request with `AbortController`, and only render results whose query matches the current input.'],
      keyIdea: 'Compare each response to the latest request id (or input value) before you use it.',
      frames: [
        { hold: 1400, state: raceFrame(1, false) },
        { hold: 1600, state: raceFrame(2, false) },
        { hold: 2600, state: raceFrame(5, false) },
        { hold: 3000, state: raceFrame(5, true) },
      ],
    },
    {
      label: 'Cache',
      title: 'Answer from what you already have',
      tag: 'technique',
      body: ['Keep a map from **normalized prefix** to results. Exact hits skip the network.', 'If the server returned the complete match set for "ap", a longer query like "apr" can be filtered locally.'],
      keyIdea: 'Also show recent searches on focus, and prefetch popular prefixes.',
      frames: [
        { hold: 2200, state: cacheState({ q: 'ap', from: 'cache' }, ['a', 'ap']) },
        { hold: 2200, state: cacheState({ q: 'apr', from: 'prefix' }, ['a', 'ap']) },
        { hold: 2600, state: cacheState({ q: 'b', from: 'network' }, ['a', 'ap']) },
      ],
    },
    {
      label: 'State',
      title: 'Model every state',
      tag: 'concept',
      body: ['The component is a small state machine: `idle`, `typing`, `loading`, `results`, `empty`, `error`, plus `highlightedIndex` and `isOpen`.', 'Arrow keys move the highlight, `Enter` selects, `Esc` closes. Use the ARIA combobox pattern and a live region that says "5 results".'],
      keyIdea: 'API sketch: `value`, `onChange`, `onSelect(item)`, `fetchSuggestions(query, signal)`, `renderOption`, `getOptionLabel`.',
      frames: [
        { hold: 1100, state: stateFrame(0, 'nothing typed, list closed') },
        { hold: 1100, state: stateFrame(1, 'typing: debounce timer running') },
        { hold: 1100, state: stateFrame(2, 'loading: keep the old list or show a skeleton') },
        { hold: 1600, state: stateFrame(3, 'results: arrow keys move the highlight') },
        { hold: 1300, state: stateFrame(4, 'empty: say "no matches", do not close silently') },
        { hold: 2200, state: stateFrame(5, 'error: inline message with a retry') },
      ],
    },
    {
      label: 'Edge cases',
      title: 'IME, highlighting and mobile',
      tag: 'in practice',
      body: ['Do not fire searches between `compositionstart` and `compositionend`, or Chinese, Japanese and Korean input searches half-typed text.', '**Escape** user input before highlighting the matched substring (avoid XSS). On mobile use large tap targets and keep the keyboard from covering the list.'],
      keyIdea: 'Server side: a trie or prefix index, cache hot prefixes, return 5 to 10 items.',
      frames: [{ state: IME }],
    },
    {
      label: 'Recap',
      title: 'The whole component',
      tag: 'recap',
      body: [
        '- **Request rate:** debounce 100 to 300 ms, minimum length 1 or 2.',
        '- **Races:** abort the previous request, render only the latest query.',
        '- **Cache:** normalized prefix map, filter locally from a complete shorter prefix.',
        '- **States:** idle, typing, loading, results, empty, error, with keyboard and ARIA combobox.',
        '- **Edge cases:** IME composition, escape before highlight, mobile targets.',
      ],
      keyIdea: 'Walk the template: requirements, state model, API, performance, accessibility, edge cases.',
      frames: [{ state: raceFrame(5, true) }],
    },
  ],
});
