import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Layout: clients (x 0), one API server with a thread pool (x 2.6), the database (x 5).
 */

const CLIENT: FlowNode = { id: 'c', label: 'Clients', sub: '1,000 req / s', kind: 'client', x: 0, y: 1.6 };
const api = (over: Partial<FlowNode> = {}): FlowNode => ({ id: 'api', label: 'API server', sub: 'thread pool', kind: 'service', x: 2.6, y: 1.6, ...over });
const db = (over: Partial<FlowNode> = {}): FlowNode => ({ id: 'db', label: 'Database', kind: 'db', x: 5.1, y: 1.6, ...over });

const LINKS = [
  { from: 'c', to: 'api' },
  { from: 'api', to: 'db' },
];

/** A stream of requests entering the server, then going on to the database. */
const stream = (n: number, tone: Packet['tone'] = 'req'): Packet[] =>
  Array.from({ length: n }, (_, i) => ({ from: 'c', to: 'api', delay: i * 0.18, dur: 0.6, tone }));

const scene = (nodes: FlowNode[], over: Partial<FlowState> = {}): FlowState => ({ nodes, links: LINKS, ...over });

const lawStats = (rate: string, time: string, load: string, tone?: 'ok' | 'bad'): FlowState['stats'] => [
  { label: 'λ arrivals', value: rate },
  { label: 'W time each', value: time },
  { label: 'L in flight', value: load, tone },
];

export default defineLesson('flow', {
  slug: 'littles-law',
  objectives: [
    { text: 'Read L = λ × W and what each letter means', step: 2 },
    { text: 'Use it to size a thread or connection pool', step: 3 },
    { text: 'See how a slow dependency makes overload spiral', step: 4 },
    { text: 'Cap W and L so the spiral cannot start', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'How big should the pool be?',
      tag: 'problem',
      body: [
        'Traffic is 1,000 requests per second and each request takes about 200 ms. You must pick a thread pool size, a connection pool size, a queue length.',
        'Too small and requests wait. Too big and you waste memory and hammer the database.',
      ],
      keyIdea: 'Pool sizes are not guesses. A one-line law links arrival rate, latency and concurrency.',
      frames: [
        {
          state: scene([CLIENT, api({ badge: { text: 'pool size = ?', tone: 'accent' } }), db()], {
            packets: stream(3),
            stats: lawStats('1,000 / s', '200 ms', '?'),
            note: { text: 'how many requests are in the server at once?', tone: 'accent' },
          }),
        },
      ],
    },
    {
      label: 'The law',
      title: 'L = λ × W',
      tag: 'concept',
      body: [
        '**Little\'s Law**: the average number of requests in a system (**L**) equals the arrival rate (**λ**) times the average time each one spends inside (**W**).',
        '1,000 per second times 0.2 seconds is **200** requests in flight at any moment.',
      ],
      keyIdea: 'It holds for any stable system: a server, a queue, a coffee shop. No assumptions about the distribution.',
      frames: [
        {
          state: scene([CLIENT, api({ meter: { value: 0.8, label: '200 in flight', tone: 'ok' } }), db()], {
            packets: [...stream(5), ...Array.from({ length: 4 }, (_, i): Packet => ({ from: 'api', to: 'db', delay: 0.5 + i * 0.18, dur: 0.6, tone: 'data' }))],
            stats: lawStats('1,000 / s', '0.2 s', '200', 'ok'),
            note: { text: '1,000 × 0.2 = 200 requests in flight', tone: 'accent' },
          }),
          hold: 2600,
        },
      ],
    },
    {
      label: 'Size the pool',
      title: 'Pool size comes from L',
      tag: 'technique',
      body: [
        'You need at least **200** workers to keep up. With a pool of 100, half the requests queue and W climbs for everyone.',
        'Add headroom. A pool of 250 runs at 80% and absorbs bursts.',
      ],
      keyIdea: 'Pool ≥ λ × W, plus headroom. The same maths sizes DB connection pools and queue consumers.',
      frames: [
        {
          state: scene([CLIENT, api({ sub: 'pool 100', status: 'hot', meter: { value: 1, label: '100 / 100 busy', tone: 'bad' }, badge: { text: '100 waiting', tone: 'bad' } }), db()], {
            packets: stream(4, 'bad'),
            stats: lawStats('1,000 / s', '0.2 s', '200 needed', 'bad'),
            note: { text: 'pool of 100 cannot hold 200: a queue builds', tone: 'bad' },
          }),
          hold: 2400,
        },
        {
          state: scene([CLIENT, api({ sub: 'pool 250', meter: { value: 0.8, label: '200 / 250 busy', tone: 'ok' } }), db()], {
            packets: stream(4),
            stats: lawStats('1,000 / s', '0.2 s', '200 of 250', 'ok'),
            note: { text: 'pool of 250 keeps 20% headroom', tone: 'accent' },
          }),
        },
      ],
    },
    {
      label: 'The spiral',
      title: 'When W grows, L grows with it',
      tag: 'trade-off',
      body: [
        'The database slows from 200 ms to 1 second. Traffic did not change, but L is now 1,000 requests in flight.',
        'The pool of 250 is full, new requests queue, clients time out and **retry**, which raises λ as well. That is how a small slowdown becomes an outage.',
      ],
      keyIdea: 'Latency is a load multiplier. A slow dependency is an overload even when traffic is flat.',
      frames: [
        {
          state: scene([CLIENT, api({ sub: 'pool 250', meter: { value: 0.8, label: '200 in flight', tone: 'ok' } }), db()], {
            packets: stream(3),
            stats: lawStats('1,000 / s', '0.2 s', '200', 'ok'),
            note: { text: 'healthy', tone: 'accent' },
          }),
          hold: 1500,
        },
        {
          state: scene([CLIENT, api({ sub: 'pool 250', status: 'hot', meter: { value: 1, label: '250 / 250 busy', tone: 'bad' }, badge: { text: '750 stuck', tone: 'bad' } }), db({ status: 'hot', badge: { text: 'now 1 s / query', tone: 'bad' } })], {
            packets: stream(4, 'bad'),
            stats: lawStats('1,000 / s', '1 s', '1,000', 'bad'),
            note: { text: 'same traffic, 5× the concurrency, pool exhausted', tone: 'bad' },
          }),
          hold: 3000,
        },
      ],
    },
    {
      label: 'Cap both',
      title: 'Break the spiral on purpose',
      tag: 'technique',
      body: [
        'Cap **W** with a timeout so no request holds a worker forever. Cap **L** with a concurrency limit, and answer the rest straight away with `429` or `503`.',
        'Retries need a budget and backoff, or they feed λ right back in.',
      ],
      keyIdea: 'Fast failure keeps the pool free for requests that can still succeed. A rejected request costs microseconds, a stuck one costs a thread.',
      frames: [
        {
          state: scene([CLIENT, api({ sub: 'timeout 300 ms', meter: { value: 0.96, label: '240 / 250 busy', tone: 'accent' }, badge: { text: 'shed the rest', tone: 'accent' } }), db({ status: 'hot' })], {
            packets: [...stream(3), { from: 'api', to: 'c', delay: 0.9, dur: 0.6, tone: 'bad', label: '429' }],
            stats: [
              { label: 'W capped', value: '≤ 300 ms', tone: 'ok' },
              { label: 'L capped', value: '≤ 240', tone: 'ok' },
              { label: 'Excess', value: 'rejected', tone: 'bad' },
            ],
            note: { text: 'bounded W and bounded L: the server stays alive', tone: 'accent' },
          }),
        },
      ],
    },
    {
      label: 'Recap',
      title: 'One formula, many uses',
      tag: 'recap',
      body: [
        '- **Law:** L = λ × W. In-flight requests = arrival rate × time in system.',
        '- **Sizing:** thread, connection and consumer pools must be at least λ × W, with headroom.',
        '- **Watch W:** when a dependency slows, L rises and pools drain even with flat traffic.',
        '- **Defences:** timeouts, concurrency limits, load shedding, retry budgets.',
        '- **Interviews:** state L = λ × W when you size servers, pools or queues.',
      ],
      keyIdea: 'Before picking a number for any pool or queue, multiply the rate by the time.',
      frames: [
        {
          state: scene([CLIENT, api({ sub: 'pool 250', meter: { value: 0.8, label: '200 in flight', tone: 'ok' } }), db()], {
            packets: stream(3),
            stats: lawStats('1,000 / s', '0.2 s', '200', 'ok'),
          }),
        },
      ],
    },
  ],
});
