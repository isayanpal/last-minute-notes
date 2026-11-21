import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame } from '../types';

const CS: SeqActor[] = [
  { id: 'c', label: 'Client', kind: 'client' },
  { id: 's', label: 'Server', kind: 'service' },
];

const seq = (actors: SeqActor[], messages: SeqMessage[], stats: SeqState['stats'], note?: SeqState['note']): SeqState => ({
  actors,
  messages,
  stats,
  note,
  fresh: messages.length - 1,
});

/** Reveal messages one at a time, the last frame holds longer. */
const reveal = (actors: SeqActor[], messages: SeqMessage[], statsAt: (n: number) => SeqState['stats'], noteAt: (n: number) => SeqState['note'], hold = 1000): Frame<SeqState>[] =>
  messages.map((_, i) => ({ hold: i === messages.length - 1 ? 2400 : hold, state: seq(actors, messages.slice(0, i + 1), statsAt(i + 1), noteAt(i + 1)) }));

// Step 1: three transports for the same job. Show the cost of each.
const POLLING: SeqMessage[] = [
  { from: 'c', to: 's', label: 'GET /updates' },
  { from: 's', to: 'c', label: 'nothing new', dashed: true },
  { from: 'c', to: 's', label: 'GET /updates (5s later)' },
  { from: 's', to: 'c', label: 'nothing new', dashed: true },
  { from: 'c', to: 's', label: 'GET /updates' },
  { from: 's', to: 'c', label: 'one event, up to 5s late', dashed: true, tone: 'data' },
];
const SSE: SeqMessage[] = [
  { from: 'c', to: 's', label: 'GET /stream (stays open)' },
  { from: 's', to: 'c', label: 'event: score 1-0', dashed: true, tone: 'ok' },
  { from: 's', to: 'c', label: 'event: score 2-0', dashed: true, tone: 'ok' },
  { from: 's', to: 'c', label: 'event: full time', dashed: true, tone: 'ok' },
];
const WS: SeqMessage[] = [
  { from: 'c', to: 's', label: 'HTTP Upgrade: websocket' },
  { from: 's', to: 'c', label: '101 Switching Protocols', dashed: true, tone: 'ok' },
  { from: 'c', to: 's', label: 'msg: typing...', tone: 'accent' },
  { from: 's', to: 'c', label: 'msg: new chat message', dashed: true, tone: 'ok' },
  { from: 'c', to: 's', label: 'msg: send "hi"', tone: 'accent' },
  { from: 's', to: 'c', label: 'msg: ack', dashed: true, tone: 'ok' },
];

// Step 2: resume after a drop with a sequence number.
const RESUME: SeqMessage[] = [
  { from: 'c', to: 's', label: 'subscribe(room, lastSeq=120)' },
  { from: 's', to: 'c', label: 'replay 121..130', dashed: true, tone: 'ok' },
  { from: 's', to: 'c', label: 'live seq 131', dashed: true, tone: 'ok' },
  { from: 's', to: 'c', label: 'connection drops', dashed: true, lost: true, tone: 'bad' },
  { from: 'c', to: 's', label: 'reconnect, lastSeq=131', tone: 'accent' },
  { from: 's', to: 'c', label: 'replay 132..140, then live', dashed: true, tone: 'ok' },
];

// Step 3: gaps and duplicates. Apply each event once, in order.
const GAPS: SeqMessage[] = [
  { from: 's', to: 'c', label: 'seq 131 apply', dashed: true, tone: 'ok' },
  { from: 's', to: 'c', label: 'seq 135 gap: buffer it', dashed: true, tone: 'bad' },
  { from: 'c', to: 's', label: 'need 132..134', tone: 'accent' },
  { from: 's', to: 'c', label: 'seq 132, 133, 134', dashed: true, tone: 'ok' },
  { from: 's', to: 'c', label: 'seq 133 again: dedupe', dashed: true, tone: 'neutral' },
  { from: 's', to: 'c', label: 'drain buffer: 135 apply', dashed: true, tone: 'ok' },
];

// Step 4: backpressure. The stream is faster than the screen.
const FAST: SeqActor[] = [
  { id: 's', label: 'Server', kind: 'service' },
  { id: 'b', label: 'Buffer', kind: 'queue' },
  { id: 'u', label: 'UI', kind: 'client' },
];
const BURST: SeqMessage[] = [
  { from: 's', to: 'b', label: 'AAPL 101.1' },
  { from: 's', to: 'b', label: 'AAPL 101.2' },
  { from: 's', to: 'b', label: 'MSFT 330.4' },
  { from: 's', to: 'b', label: 'AAPL 101.3' },
  { from: 'b', to: 'u', label: 'flush: AAPL 101.3, MSFT 330.4', tone: 'ok' },
];

// Step 5: offline-first. Writes go to a local outbox, then sync.
const OFFLINE_ACTORS: SeqActor[] = [
  { id: 'u', label: 'UI', kind: 'client' },
  { id: 'o', label: 'Local store + outbox', kind: 'storage' },
  { id: 's', label: 'Server', kind: 'service' },
];
const OFFLINE: SeqMessage[] = [
  { from: 'u', to: 'o', label: 'edit note (offline)' },
  { from: 'o', to: 'u', label: 'saved locally, 1 pending', dashed: true, tone: 'ok' },
  { from: 'o', to: 's', label: 'network down: wait', dashed: true, lost: true, tone: 'bad' },
  { from: 'o', to: 's', label: 'online: push outbox + key', tone: 'accent' },
  { from: 's', to: 'o', label: 'ok + changes since cursor', dashed: true, tone: 'ok' },
  { from: 'o', to: 'u', label: 'synced, pending 0', dashed: true, tone: 'ok' },
];

// Step 6: conflicts. Two devices edit the same record.
const CONFLICT_ACTORS: SeqActor[] = [
  { id: 'p', label: 'Phone', kind: 'client' },
  { id: 's', label: 'Server', kind: 'service' },
  { id: 'l', label: 'Laptop', kind: 'client' },
];
const CONFLICT: SeqMessage[] = [
  { from: 'p', to: 's', label: 'edit v3 > v4 (If-Match 3)' },
  { from: 's', to: 'p', label: '200, now v4', dashed: true, tone: 'ok' },
  { from: 'l', to: 's', label: 'edit v3 > v4 (If-Match 3)' },
  { from: 's', to: 'l', label: '409: server is v4', dashed: true, tone: 'bad' },
  { from: 'l', to: 's', label: 'refetch v4, merge, retry', tone: 'accent' },
  { from: 's', to: 'l', label: '200, now v5', dashed: true, tone: 'ok' },
];

export default defineLesson('sequence', {
  slug: 'fe-realtime-sync',
  objectives: [
    { text: 'Picking polling, SSE or WebSocket for the job', step: 1 },
    { text: 'Resuming a stream after a drop with sequence numbers', step: 2 },
    { text: 'Handling gaps, duplicates and out-of-order events', step: 3 },
    { text: 'Keeping the UI alive under a fast stream', step: 4 },
    { text: 'The offline outbox and conflict strategies', step: 5 },
  ],
  steps: [
    {
      label: 'Transport',
      title: 'Start with the simplest thing',
      tag: 'concept',
      body: ['**Polling** is simple but late and wasteful. **SSE** is one long HTTP response for server push. **WebSocket** is a full-duplex socket.', 'Pick by who talks: rare updates mean polling, mostly server push means SSE, a stream of client messages means WebSocket.'],
      keyIdea: 'SSE covers notifications, live scores, progress and streaming LLM tokens. Reach for WebSocket when the client also sends a stream.',
      frames: [
        ...reveal(CS, POLLING, (n) => [{ label: 'Polling', value: n > 5 ? 'late, wasteful' : 'pull', tone: n > 5 ? 'bad' : 'neutral' }, { label: 'Requests', value: String(Math.ceil(n / 2)) }, { label: 'Latency', value: 'up to interval' }], () => undefined, 700).slice(-1),
        ...reveal(CS, SSE, () => [{ label: 'SSE', value: 'one connection', tone: 'ok' }, { label: 'Direction', value: 'server push' }, { label: 'Resume', value: 'Last-Event-ID', tone: 'ok' }], () => undefined, 700).slice(-1),
        ...reveal(CS, WS, () => [{ label: 'WebSocket', value: 'full duplex', tone: 'ok' }, { label: 'Reconnect', value: 'you build it' }, { label: 'Needs', value: 'auth, pings' }], () => undefined, 700).slice(-1),
      ],
    },
    {
      label: 'Resume',
      title: 'Reconnect without losing events',
      tag: 'technique',
      body: ['Networks drop connections. Give every event in a stream a **sequence number** and let the client say `lastSeq` when it reconnects.', 'The server replays what was missed. If the gap is too large and the server no longer has the events, fall back to a full refetch.'],
      keyIdea: 'Treat reconnect as normal: resume from `lastSeq`, with exponential backoff and a refetch fallback.',
      frames: reveal(
        CS,
        RESUME,
        (n) => [{ label: 'lastSeq', value: n > 4 ? '131' : n > 2 ? '131' : '120', tone: 'ok' }, { label: 'Connection', value: n === 4 ? 'dropped' : 'open', tone: n === 4 ? 'bad' : 'ok' }, { label: 'Missed', value: n > 5 ? '0' : '-', tone: n > 5 ? 'ok' : 'neutral' }],
        (n) => (n === 4 ? { text: 'no message is lost, the client knows where it was', tone: 'accent' } : undefined),
        1100,
      ),
    },
    {
      label: 'Order',
      title: 'Gaps, duplicates and shuffles',
      tag: 'technique',
      body: ['Messages can be missed, repeated or late. A jump in `seq` (131 then 135) is a gap: buffer 135 and request 132 to 134.', 'Dedupe by event id or `seq`, and drain the buffer in order. Make handlers idempotent.'],
      keyIdea: 'Initial state race: subscribe first, fetch the snapshot, then apply buffered events newer than the snapshot version.',
      frames: reveal(
        CS,
        GAPS,
        (n) => [{ label: 'Applied up to', value: n > 5 ? '135' : n > 3 ? '134' : '131', tone: 'ok' }, { label: 'Buffered', value: n === 2 || n === 3 ? '135' : '0' }, { label: 'Duplicates', value: n > 4 ? 'dropped' : '-', tone: n > 4 ? 'ok' : 'neutral' }],
        (n) => (n === 2 ? { text: 'seq jumped: gap detected', tone: 'bad' } : undefined),
        1100,
      ),
    },
    {
      label: 'Backpressure',
      title: 'A fast stream can freeze the UI',
      tag: 'trade-off',
      body: ['If every message triggers a render, a busy stream freezes the page.', '**Coalesce** to the latest value per key and flush once per frame (or every 250 to 1000 ms for dashboards). Subscribe only to what is visible.'],
      keyIdea: 'Also: send deltas not snapshots, bound buffers, parse in a worker, and pause rendering for hidden tabs.',
      frames: reveal(
        FAST,
        BURST,
        (n) => [{ label: 'Messages in', value: String(Math.min(n, 4)) }, { label: 'Renders', value: n > 4 ? '1' : '0', tone: n > 4 ? 'ok' : 'neutral' }, { label: 'Kept', value: 'latest per key' }],
        (n) => (n > 4 ? { text: 'four messages, one render', tone: 'ok' } : undefined),
        800,
      ),
    },
    {
      label: 'Offline-first',
      title: 'Write locally, sync later',
      tag: 'in practice',
      body: ['**Offline-first** means the UI reads and writes a local store first (IndexedDB). Writes go to a durable **outbox**.', 'When online: push the outbox in order with idempotency keys, then pull changes since a `cursor`. Show saved, saving, offline and failed states.'],
      keyIdea: '`navigator.onLine` is unreliable. Confirm reachability with a real request or heartbeat.',
      frames: reveal(
        OFFLINE_ACTORS,
        OFFLINE,
        (n) => [{ label: 'Pending', value: n > 5 ? '0' : n > 1 ? '1' : '0', tone: n > 5 ? 'ok' : 'neutral' }, { label: 'Network', value: n === 3 ? 'down' : n > 3 ? 'back' : 'offline', tone: n === 3 ? 'bad' : 'neutral' }, { label: 'Cursor', value: n > 4 ? 'advanced' : 'old' }],
        (n) => (n === 2 ? { text: 'the user can keep working', tone: 'ok' } : undefined),
        1000,
      ),
    },
    {
      label: 'Conflicts',
      title: 'Two devices, one record',
      tag: 'trade-off',
      body: ['Last write wins is simple but loses data silently. A version check with `If-Match` rejects stale writes with 409, and the client refetches, merges and retries.', 'For collaborative text and local-first apps, use OT or a **CRDT** such as Yjs or Automerge, which merge in any order.'],
      keyIdea: 'Match the strategy to the data: LWW for settings, version checks for records, CRDTs for collaboration, manual choice for high-value documents.',
      frames: reveal(
        CONFLICT_ACTORS,
        CONFLICT,
        (n) => [{ label: 'Server', value: n > 5 ? 'v5' : n > 1 ? 'v4' : 'v3' }, { label: 'Stale write', value: n > 3 ? 'rejected' : '-', tone: n > 3 ? 'bad' : 'neutral' }, { label: 'Data lost', value: 'none', tone: 'ok' }],
        (n) => (n === 4 ? { text: 'If-Match caught the stale edit', tone: 'accent' } : undefined),
        1000,
      ),
    },
    {
      label: 'Recap',
      title: 'From transport to sync',
      tag: 'recap',
      body: [
        '- **Transport:** polling, SSE, WebSocket. Start simple.',
        '- **Resume:** sequence numbers, `lastSeq`, refetch if the gap is too large.',
        '- **Order:** dedupe, buffer gaps, apply in `seq` order.',
        '- **Backpressure:** coalesce, batch per frame, scope subscriptions.',
        '- **Offline:** local store, outbox, cursor, visible status.',
        '- **Conflicts:** version checks, CRDTs, or ask the user.',
      ],
      keyIdea: 'Say which guarantees you need: at-least-once delivery with idempotent handlers is usually enough.',
      frames: [{ state: seq(CS, RESUME, [{ label: 'Resume', value: 'lastSeq', tone: 'ok' }, { label: 'Dedupe', value: 'by seq', tone: 'ok' }, { label: 'Fallback', value: 'full refetch' }], { text: 'resume, dedupe, apply in order', tone: 'accent' }) }],
    },
  ],
});
