import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

const range = (a: number, b: number, s: ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: b - a + 1 }, (_, i) => [a + i, s]));

/** Token bucket: capacity 5, one token refills per tick. Requests arrive in a burst, then trickle. */
function bucketFrames(): Frame<ArrayState>[] {
  const CAP = 5;
  const arrivals = [0, 0, 6, 0, 0, 0, 1, 0, 1];
  let tokens = CAP;
  const frames: Frame<ArrayState>[] = [];
  arrivals.forEach((n, t) => {
    tokens = Math.min(CAP, tokens + (t === 0 ? 0 : 1));
    let allowed = 0;
    let dropped = 0;
    for (let i = 0; i < n; i++) (tokens > 0 ? (tokens--, allowed++) : dropped++);
    if (n === 0 && t > 1 && t !== 3) return;
    frames.push({
      hold: 1300,
      state: {
        rows: [
          {
            label: 'tokens',
            cells: Array.from({ length: CAP }, (_, i) => (i < tokens ? 'T' : '')),
            states: Object.fromEntries(Array.from({ length: CAP }, (_, i) => [i, i < tokens ? 'done' : 'dim'])) as Record<number, ItemState>,
            showIndex: false,
          },
        ],
        stats: [
          { label: 'Arrived', value: String(n) },
          { label: 'Allowed', value: String(allowed), tone: 'ok' },
          { label: 'Dropped', value: String(dropped), tone: dropped ? 'bad' : 'neutral' },
        ],
        note: dropped ? { text: `burst of ${n}: ${allowed} served, ${dropped} rejected (429)`, tone: 'bad' } : { text: `+1 token per tick, max ${CAP}`, tone: 'accent' },
      },
    });
  });
  return frames;
}

/** Fixed window: limit 3 per 5-slot window. Six requests squeeze across the boundary. */
function windowFrame(withSliding: boolean): ArrayState {
  const cells = ['', '', 'R', 'R', 'R', 'R', 'R', 'R', '', ''];
  return {
    rows: [
      {
        label: 'time',
        cells,
        states: { ...range(2, 7, withSliding ? 'bad' : 'done'), 0: 'dim', 1: 'dim', 8: 'dim', 9: 'dim' },
        window: withSliding ? { from: 2, to: 6, label: 'any 5 slots: 5 requests', tone: 'bad' } : undefined,
        showIndex: true,
      },
    ],
    stats: withSliding
      ? [{ label: 'Limit', value: '3 / 5 slots' }, { label: 'Real rate', value: '5 in 5 slots', tone: 'bad' }, { label: 'Fix', value: 'sliding window', tone: 'ok' }]
      : [{ label: 'Window A', value: '3 / 3', tone: 'ok' }, { label: 'Window B', value: '3 / 3', tone: 'ok' }, { label: 'Real burst', value: '6 in 6 slots', tone: 'bad' }],
    note: withSliding ? { text: 'a sliding view sees the burst', tone: 'bad' } : { text: 'each fixed window is within the limit', tone: 'accent' },
  };
}

const COUNTER: ArrayState = {
  rows: [
    {
      label: 'windows',
      cells: ['prev: 4', 'now: 3'],
      states: { 0: 'visited', 1: 'active' },
      pointers: [{ i: 1, label: '40% in', tone: 'accent' }],
      showIndex: false,
    },
  ],
  panels: [{ title: 'estimate', kind: 'list', items: ['3 + 4 × (1 - 0.4)', '= 3 + 2.4', '= 5.4 requests', 'limit 6: allow'] }],
  stats: [{ label: 'Memory', value: 'O(1)', tone: 'ok' }, { label: 'Accuracy', value: 'very good' }, { label: 'Error', value: 'small' }],
};

export default defineLesson('array', {
  slug: 'rate-limiting',
  objectives: [
    { text: 'How a token bucket allows bursts but caps the rate', step: 2 },
    { text: 'Why fixed windows leak a double burst at the edge', step: 3 },
    { text: 'The sliding window counter formula', step: 4 },
    { text: 'How to share a limit across servers', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Protect the service from overload',
      tag: 'problem',
      body: ['A client or a bug sends far more requests than the service can handle. It slows down for everyone, not just the noisy caller.', 'Rate limiting says: you may do N requests per time window, the rest get `429 Too Many Requests`.'],
      keyIdea: 'Rate limiting protects against overload, abuse and noisy neighbours. The choice of algorithm decides how bursts are handled.',
      frames: [
        { state: { rows: [{ label: 'per second', cells: [4, 5, 5, 31, 6, 4], states: { 3: 'bad' }, bars: true }], stats: [{ label: 'Capacity', value: '~10 / s' }, { label: 'Spike', value: '31 / s', tone: 'bad' }, { label: 'Result', value: 'overload', tone: 'bad' }] } },
      ],
    },
    {
      label: 'Token bucket',
      title: 'Spend a token per request',
      tag: 'technique',
      body: ['A bucket holds up to **b** tokens and refills at **r** per second. Each request takes one token. No token, no service.', 'A full bucket absorbs a short burst. After that you are held to the refill rate.'],
      keyIdea: 'Token bucket allows bursts up to b while the long-term rate stays at r. O(1) memory per key.',
      frames: bucketFrames(),
    },
    {
      label: 'Fixed window',
      title: 'A counter per window has an edge',
      tag: 'trade-off',
      body: ['**Fixed window** keeps one counter per time window and resets it at the boundary. It is O(1) and simple.', 'But a burst at the end of one window and the start of the next passes both checks. You can get up to **2x** the limit in a short span.'],
      keyIdea: 'Fixed windows are cheap and inaccurate at the edges. Sliding windows fix that.',
      frames: [{ state: windowFrame(false), hold: 2500 }, { state: windowFrame(true) }],
    },
    {
      label: 'Sliding window',
      title: 'Weigh the previous window',
      tag: 'technique',
      body: ['**Sliding window counter** blends two counters: `current + previous x (1 - fraction of current window elapsed)`.', 'It is O(1) memory and a very good approximation. The exact alternative, the sliding window **log**, stores every timestamp.'],
      keyIdea: 'Counter: small error, constant memory. Log: exact, memory grows with request count.',
      frames: [{ state: COUNTER }],
    },
    {
      label: 'Distributed',
      title: 'Share the counter across servers',
      tag: 'in practice',
      body: ['With many app servers, each one sees only part of the traffic. A per-server limiter lets users exceed the real limit.', 'Use a shared counter, usually **Redis** with an atomic script. If a small error is fine, use local limiters that sync periodically.'],
      keyIdea: 'Atomic check-and-update matters: two servers must not both read "4 left" and both allow the request.',
      frames: [
        { state: { rows: [{ label: 'servers', cells: ['A', 'B', 'C'], states: { 0: 'active', 1: 'active', 2: 'active' }, showIndex: false }], panels: [{ title: 'redis', kind: 'map', items: ['user:7 -> 4 left', 'EVAL script', 'atomic dec + ttl'] }], stats: [{ label: 'Source', value: 'one counter', tone: 'ok' }, { label: 'Race', value: 'avoided by Lua' }, { label: 'Cost', value: '+1 hop' }] } },
      ],
    },
    {
      label: 'Recap',
      title: 'Which one to pick',
      tag: 'recap',
      body: [
        '- **Token bucket:** allows bursts, O(1). Good default.',
        '- **Leaky bucket:** queue drained at a fixed rate, smooths traffic.',
        '- **Fixed window:** simplest, up to 2x burst at the edges.',
        '- **Sliding log:** exact, memory heavy. **Sliding counter:** near exact, O(1).',
        '- **Across servers:** a shared Redis counter with an atomic script.',
      ],
      keyIdea: 'Return 429 with a `Retry-After` header so clients know when to try again.',
      frames: [{ state: windowFrame(true) }],
    },
  ],
});
