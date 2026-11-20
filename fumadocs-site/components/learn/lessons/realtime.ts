import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';

const ACTORS: SeqActor[] = [
  { id: 'c', label: 'Client', kind: 'client' },
  { id: 's', label: 'Server', kind: 'service' },
];

const at = (messages: SeqMessage[], note?: SeqState['note'], extra: Partial<SeqState> = {}, fresh = 1): SeqState => ({ actors: ACTORS, messages, fresh, note, ...extra });

const poll = (n: number): SeqMessage[] => {
  const out: SeqMessage[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ from: 'c', to: 's', label: 'any news?' });
    out.push({ from: 's', to: 'c', label: i === n - 1 ? 'yes: msg #7' : 'no', dashed: true, tone: i === n - 1 ? 'ok' : 'neutral' });
  }
  return out;
};

const long: SeqMessage[] = [
  { from: 'c', to: 's', label: 'any news? (wait)' },
  { from: 's', to: 's', label: 'hold request open', tone: 'accent' },
  { from: 's', to: 'c', label: 'msg #7', dashed: true, tone: 'ok' },
  { from: 'c', to: 's', label: 'any news? (wait)' },
];

const sse: SeqMessage[] = [
  { from: 'c', to: 's', label: 'GET /events' },
  { from: 's', to: 'c', label: 'event: 1', dashed: true, tone: 'ok' },
  { from: 's', to: 'c', label: 'event: 2', dashed: true, tone: 'ok' },
  { from: 's', to: 'c', label: 'event: 3', dashed: true, tone: 'ok' },
];

const ws: SeqMessage[] = [
  { from: 'c', to: 's', label: 'Upgrade: websocket' },
  { from: 's', to: 'c', label: '101 Switching', dashed: true },
  { from: 'c', to: 's', label: 'hi', tone: 'accent' },
  { from: 's', to: 'c', label: 'hello', dashed: true, tone: 'ok' },
  { from: 's', to: 'c', label: 'new msg', dashed: true, tone: 'ok' },
  { from: 'c', to: 's', label: 'typing...', tone: 'accent' },
];

const stats = (a: string, b: string, c: string): SeqState['stats'] => [
  { label: 'Latency', value: a },
  { label: 'Cost', value: b },
  { label: 'Direction', value: c },
];

export default defineLesson('sequence', {
  slug: 'realtime',
  objectives: [
    { text: 'Why plain request/response cannot push', step: 1 },
    { text: 'Polling vs long polling', step: 3 },
    { text: 'When SSE is enough', step: 4 },
    { text: 'When to use WebSockets, and what they cost', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'The server cannot call you',
      tag: 'problem',
      body: ['HTTP is request and response. The server only speaks when the client asks.', 'For chat, feeds and live scores, the server needs to deliver data the moment it exists.'],
      keyIdea: 'Real-time techniques differ in latency, cost per client and direction. Pick the lightest one that fits.',
      frames: [{ state: at([{ from: 'c', to: 's', label: 'GET /feed' }, { from: 's', to: 'c', label: '200 (old data)', dashed: true }], { text: 'new data appears, but nobody tells the client', tone: 'bad' }, { actors: [{ ...ACTORS[0] }, { ...ACTORS[1], badge: { text: 'msg #7 arrives', tone: 'accent' } }] }, 2) }],
    },
    {
      label: 'Short polling',
      title: 'Ask every few seconds',
      tag: 'technique',
      body: ['The client asks on a timer. It is simple and works everywhere.', 'Most answers are "no", so it wastes requests, and data can wait up to one full interval.'],
      keyIdea: 'Short polling: latency up to the interval, wasteful. Fine for simple, low-frequency needs.',
      frames: [1, 2, 3].map((n) => ({ state: at(poll(n), n === 3 ? { text: 'found it, after two empty polls', tone: 'accent' } : undefined, { stats: stats('up to interval', 'many empty calls', 'client asks') }, 2), hold: 1800 })),
    },
    {
      label: 'Long polling',
      title: 'Hold the request open',
      tag: 'technique',
      body: ['The server keeps the request open until it has data or a timeout. The reply arrives the instant there is news.', 'The client immediately asks again. Latency is low, but each client holds one open request.'],
      keyIdea: 'Long polling is a good fallback when you cannot use streams. Simple infrastructure, one open request per client.',
      frames: [1, 2, 3, 4].map((n) => ({ state: at(long.slice(0, n), n === 2 ? { text: 'nothing yet: connection stays open', tone: 'accent' } : undefined, { stats: stats('low', 'one open request', 'client asks') }), hold: 1500 })),
    },
    {
      label: 'SSE',
      title: 'One response, many events',
      tag: 'technique',
      body: ['**Server-Sent Events**: one long HTTP response where the server streams events down.', 'It is cheap, one-directional, and the browser reconnects for you. A great fit for feeds, notifications and LLM token streaming.'],
      keyIdea: 'If data only flows server to client, SSE is usually enough and is simpler than WebSockets.',
      frames: [1, 2, 3, 4].map((n) => ({ state: at(sse.slice(0, n), undefined, { stats: stats('low', 'cheap', 'server → client') }), hold: 1300 })),
    },
    {
      label: 'WebSocket',
      title: 'A two-way connection',
      tag: 'technique',
      body: ['A **WebSocket** upgrades the HTTP connection to a persistent, full-duplex one. Both sides send whenever they like.', 'Lowest latency, but the connection is stateful: you must manage it, balance it, and reconnect after failures.'],
      keyIdea: 'Use WebSockets for chat, games and collaboration, where the client also sends often.',
      frames: [1, 2, 3, 4, 5, 6].map((n) => ({ state: at(ws.slice(0, n), undefined, { stats: stats('lowest', 'stateful', 'both ways') }), hold: 1100 })),
    },
    {
      label: 'Recap',
      title: 'Choose and scale',
      tag: 'recap',
      body: [
        '- **Polling:** simplest, wasteful. **Long polling:** low latency fallback.',
        '- **SSE:** one-way streams, auto reconnect. **WebSocket:** two-way, lowest latency.',
        '- **At scale:** a gateway tier holds connections, a registry maps user to gateway, pub/sub fans out messages.',
        '- **Reliability:** heartbeats, reconnect with backoff and jitter, resume from the last event id.',
        '- **Capacity:** one server holds tens of thousands to a few hundred thousand idle connections.',
      ],
      keyIdea: 'Connections are stateful, so plan for failure: clients must reconnect and resume without losing events.',
      frames: [{ state: at([{ from: 'c', to: 's', label: 'reconnect + last id=7' }, { from: 's', to: 'c', label: 'replay 8, 9', dashed: true, tone: 'ok' }], undefined, { stats: [] }) }],
    },
  ],
});
