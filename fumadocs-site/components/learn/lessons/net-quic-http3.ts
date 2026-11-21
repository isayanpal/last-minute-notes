import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Illustrative timings on a 100 ms RTT path. The shape follows the notes:
 * TCP + TLS 1.3 = 2 RTT before the request, QUIC = 1 RTT, 0-RTT resumption = request in the first flight.
 */

const bar = (id: string, from: number, to: number, label: string, extra: Partial<TimelineBar> = {}): TimelineBar => ({ id, from, to, label, ...extra });
const ILLUSTRATIVE = { text: 'illustrative: 100 ms round trip', tone: 'neutral' as const };

// Step 1: one request per connection, or many streams on one connection.
const h1 = (): TimelineState => ({
  from: 0,
  to: 600,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500, 600],
  lanes: [
    { label: 'Connection 1', bars: [bar('a1', 0, 200, 'handshakes', { tone: 'data' }), bar('a2', 200, 300, 'GET a', { tone: 'ok' }), bar('a3', 300, 400, 'GET d', { tone: 'ok' })] },
    { label: 'Connection 2', bars: [bar('b1', 0, 200, 'handshakes', { tone: 'data' }), bar('b2', 200, 300, 'GET b', { tone: 'ok' }), bar('b3', 300, 400, 'GET e', { tone: 'ok' })] },
    { label: 'Connection 3', bars: [bar('c1', 0, 200, 'handshakes', { tone: 'data' }), bar('c2', 200, 300, 'GET c', { tone: 'ok' }), bar('c3', 300, 400, 'GET f', { tone: 'ok' })] },
  ],
  stats: [
    { label: 'HTTP/1.1', value: '1 req per conn' },
    { label: 'Browsers open', value: '6 per origin' },
    { label: 'Cost', value: '3 handshakes', tone: 'bad' },
  ],
  note: ILLUSTRATIVE,
});
const h2 = (): TimelineState => ({
  from: 0,
  to: 600,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500, 600],
  lanes: [
    { label: 'Handshakes', bars: [bar('h', 0, 200, 'once', { tone: 'data' })] },
    { label: 'Stream 1', bars: [bar('s1', 200, 300, 'GET a', { tone: 'ok' }), bar('s1b', 300, 400, 'GET d', { tone: 'ok' })] },
    { label: 'Stream 2', bars: [bar('s2', 200, 300, 'GET b', { tone: 'ok' }), bar('s2b', 300, 400, 'GET e', { tone: 'ok' })] },
    { label: 'Stream 3', bars: [bar('s3', 200, 300, 'GET c', { tone: 'ok' }), bar('s3b', 300, 400, 'GET f', { tone: 'ok' })] },
  ],
  stats: [
    { label: 'HTTP/2', value: 'multiplexed' },
    { label: 'Handshakes', value: '1', tone: 'ok' },
    { label: 'Headers', value: 'HPACK' },
  ],
  note: { text: 'frames from many streams share one connection', tone: 'ok' },
});

// Step 2: TCP delivers in order, so one lost packet stalls every stream. QUIC stalls only its own.
const hol = (quic: boolean): TimelineState => ({
  from: 0,
  to: 500,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500],
  lanes: [
    { label: 'Stream 1', bars: [bar('a', 0, 100, 'data', { tone: 'ok' }), bar('a2', 100, 300, 'waits for retx', { tone: 'bad', state: 'bad' }), bar('a3', 300, 400, 'resumes', { tone: 'ok' })] },
    {
      label: 'Stream 2',
      bars: quic
        ? [bar('b', 0, 400, 'keeps flowing', { tone: 'ok' })]
        : [bar('b', 0, 100, 'data', { tone: 'ok' }), bar('b2', 100, 300, 'stalled too', { tone: 'bad', state: 'bad' }), bar('b3', 300, 400, 'resumes', { tone: 'ok' })],
    },
    {
      label: 'Stream 3',
      bars: quic
        ? [bar('c', 0, 400, 'keeps flowing', { tone: 'ok' })]
        : [bar('c', 0, 100, 'data', { tone: 'ok' }), bar('c2', 100, 300, 'stalled too', { tone: 'bad', state: 'bad' }), bar('c3', 300, 400, 'resumes', { tone: 'ok' })],
    },
  ],
  markers: [{ at: 100, label: 'packet lost', tone: 'bad' }],
  stats: [
    { label: 'Transport', value: quic ? 'QUIC' : 'TCP', tone: quic ? 'ok' : 'neutral' },
    { label: 'Stalled', value: quic ? '1 stream' : 'all streams', tone: quic ? 'ok' : 'bad' },
    { label: 'Why', value: quic ? 'per stream' : 'ordered pipe' },
  ],
  note: quic ? { text: 'QUIC orders bytes per stream, so loss stays local', tone: 'ok' } : { text: 'HTTP/2 fixed HTTP blocking, TCP still blocks everything', tone: 'bad' },
});

// Step 3: setup cost. TCP + TLS is two round trips, QUIC combines them.
const setup = (): TimelineState => ({
  from: 0,
  to: 400,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400],
  lanes: [
    { label: 'TCP + TLS 1.3', bars: [bar('t1', 0, 100, 'TCP', { tone: 'data' }), bar('t2', 100, 200, 'TLS', { tone: 'data' }), bar('t3', 200, 300, 'request', { tone: 'ok' })] },
    { label: 'QUIC', bars: [bar('q1', 0, 100, 'QUIC + TLS', { tone: 'data' }), bar('q2', 100, 200, 'request', { tone: 'ok' })] },
  ],
  markers: [{ at: 200, label: 'QUIC done', tone: 'ok' }],
  stats: [
    { label: 'TCP + TLS', value: '2 RTT' },
    { label: 'QUIC', value: '1 RTT', tone: 'ok' },
    { label: 'Why', value: 'one handshake' },
  ],
  note: { text: 'QUIC carries TLS 1.3 inside its own handshake', tone: 'ok' },
});

// Step 4: connection migration. A connection ID survives an IP change.
const migrate = (quic: boolean): TimelineState => ({
  from: 0,
  to: 600,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500, 600],
  lanes: [
    {
      label: 'TCP',
      bars: [bar('t1', 0, 200, 'Wi-Fi', { tone: 'ok' }), bar('t2', 200, 400, 'new handshakes', { tone: 'bad', state: 'bad' }), bar('t3', 400, 600, 'cellular', { tone: 'ok' })],
    },
    {
      label: 'QUIC',
      bars: quic ? [bar('q1', 0, 200, 'Wi-Fi', { tone: 'ok' }), bar('q2', 200, 600, 'cellular, same connection ID', { tone: 'ok' })] : [bar('q1', 0, 200, 'Wi-Fi', { tone: 'ok' })],
    },
  ],
  markers: [{ at: 200, label: 'IP changes', tone: 'accent' }],
  stats: [
    { label: 'TCP identity', value: 'IP + ports' },
    { label: 'QUIC identity', value: 'connection ID', tone: 'ok' },
    { label: 'Switch', value: quic ? 'seamless' : 'reconnect', tone: quic ? 'ok' : 'bad' },
  ],
  note: quic ? { text: 'Wi-Fi to cellular without dropping the session', tone: 'ok' } : { text: 'the 4-tuple changed, so TCP must start over', tone: 'bad' },
});

// Step 5: discovery. Learn h3 from Alt-Svc, and fall back to TCP when UDP is blocked.
const discover = (blocked: boolean): TimelineState => ({
  from: 0,
  to: 500,
  unit: 'ms',
  ticks: [0, 100, 200, 300, 400, 500],
  lanes: blocked
    ? [
        { label: 'Try QUIC', bars: [bar('q', 0, 200, 'UDP blocked', { tone: 'bad', state: 'bad' })] },
        { label: 'Fall back', bars: [bar('f1', 200, 300, 'TCP', { tone: 'data' }), bar('f2', 300, 400, 'TLS', { tone: 'data' }), bar('f3', 400, 500, 'h2', { tone: 'ok' })] },
      ]
    : [
        { label: 'First visit', bars: [bar('a', 0, 200, 'TCP + TLS, h2', { tone: 'data' }), bar('a2', 200, 300, 'Alt-Svc: h3', { tone: 'accent' })] },
        { label: 'Next visit', bars: [bar('b', 0, 100, 'QUIC', { tone: 'ok' }), bar('b2', 100, 200, 'h3', { tone: 'ok' })] },
      ],
  stats: [
    { label: 'Advertised by', value: 'Alt-Svc, DNS' },
    { label: 'Headers', value: 'QPACK' },
    { label: 'UDP blocked', value: blocked ? 'TCP fallback' : 'rare', tone: blocked ? 'bad' : 'neutral' },
  ],
  note: blocked ? { text: 'enterprise firewalls sometimes block UDP: the browser retries on TCP', tone: 'bad' } : { text: 'the browser tries QUIC and keeps TCP as the safety net', tone: 'accent' },
});

// Step 6: 0-RTT sends data in the first flight, at the price of replayability.
const zero = (rtt0: boolean): TimelineState => ({
  from: 0,
  to: 300,
  unit: 'ms',
  ticks: [0, 100, 200, 300],
  lanes: [
    { label: 'QUIC 1-RTT', bars: [bar('a', 0, 100, 'handshake', { tone: 'data' }), bar('a2', 100, 200, 'request', { tone: 'ok' })] },
    ...(rtt0 ? [{ label: 'QUIC 0-RTT', bars: [bar('z', 0, 100, 'hello + request', { tone: 'ok' })] }] : []),
  ],
  stats: [
    { label: '0-RTT', value: 'known servers' },
    { label: 'Risk', value: 'replayable', tone: 'bad' },
    { label: 'Use for', value: 'idempotent', tone: 'ok' },
  ],
  note: rtt0 ? { text: 'GET is safe to replay, a payment POST is not', tone: 'accent' } : ILLUSTRATIVE,
});

export default defineLesson('timeline', {
  slug: 'net-quic-http3',
  objectives: [
    { text: 'How HTTP/1.1 and HTTP/2 use connections', step: 1 },
    { text: 'Why TCP still causes head-of-line blocking under HTTP/2', step: 2 },
    { text: 'How QUIC cuts connection setup to 1 RTT', step: 3 },
    { text: 'What connection IDs and migration give mobile users', step: 4 },
    { text: 'How browsers discover HTTP/3 and fall back', step: 5 },
    { text: 'What 0-RTT buys and what it risks', step: 6 },
  ],
  steps: [
    {
      label: 'Connections',
      title: 'From six connections to one',
      tag: 'problem',
      body: ['HTTP/1.1 allows one outstanding request per connection, so browsers open **6 per origin** and pay a handshake each.', '**HTTP/2** multiplexes many streams over one connection, with binary frames and HPACK header compression.'],
      keyIdea: 'Under HTTP/2 and HTTP/3, domain sharding, sprite sheets and heavy concatenation are anti-patterns.',
      frames: [{ state: h1(), hold: 2400 }, { state: h2(), hold: 2800 }],
    },
    {
      label: 'HOL blocking',
      title: 'One lost packet stalls everything',
      tag: 'concept',
      body: ['TCP delivers bytes strictly in order. A lost segment blocks all data behind it, even from unrelated HTTP/2 streams.', '**QUIC** orders data per stream, so a loss only stalls the stream it hit.'],
      keyIdea: 'HTTP/2 solved head-of-line blocking at the HTTP layer. HTTP/3 solves it at the transport layer.',
      frames: [{ state: hol(false), hold: 2800 }, { state: hol(true), hold: 2800 }],
    },
    {
      label: 'Setup',
      title: 'One handshake, not two',
      tag: 'technique',
      body: ['TCP plus TLS 1.3 needs **2 round trips** before the request. QUIC merges transport and crypto, so it needs **1**.', 'QUIC runs over UDP with TLS 1.3 built in. HTTP/3 maps HTTP onto QUIC streams.'],
      keyIdea: 'On a 100 ms path, QUIC saves 100 ms on every new connection.',
      frames: [{ state: setup(), hold: 3000 }],
    },
    {
      label: 'Migration',
      title: 'A connection that survives roaming',
      tag: 'technique',
      body: ['TCP identifies a connection by IPs and ports, so switching from Wi-Fi to cellular breaks it.', 'QUIC uses a **connection ID** independent of the address, so the session continues after the IP changes.'],
      keyIdea: 'This is the main win on mobile and lossy networks. On a clean wired link the difference is small.',
      frames: [{ state: migrate(false), hold: 2400 }, { state: migrate(true), hold: 2800 }],
    },
    {
      label: 'Discovery',
      title: 'How a browser finds HTTP/3',
      tag: 'in practice',
      body: ['A server advertises HTTP/3 with an `Alt-Svc: h3=":443"` header or an **HTTPS DNS record**. The browser tries QUIC next time.', 'If UDP is blocked or rate limited, it falls back to TCP.'],
      keyIdea: 'Always keep a TCP path working. QUIC is an upgrade, not a requirement.',
      frames: [{ state: discover(false), hold: 2600 }, { state: discover(true), hold: 2800 }],
    },
    {
      label: '0-RTT',
      title: 'Data in the first flight',
      tag: 'trade-off',
      body: ['With **0-RTT resumption**, a client can send a request in its first packet to a server it has met before.', 'That data can be replayed by an attacker, so only send idempotent requests this way.'],
      keyIdea: 'Costs of QUIC: more CPU than kernel TCP, harder debugging (packets are encrypted), and some firewalls block UDP.',
      frames: [{ state: zero(false), hold: 1800 }, { state: zero(true), hold: 2800 }],
    },
    {
      label: 'Recap',
      title: 'Choosing the transport',
      tag: 'recap',
      body: [
        '- **HTTP/1.1:** one request per connection, 6 connections per origin.',
        '- **HTTP/2:** multiplexed streams on TCP, still blocked by one loss.',
        '- **HTTP/3:** QUIC over UDP, per-stream ordering, 1-RTT setup.',
        '- **Migration:** connection IDs survive IP changes.',
        '- **Safety:** fall back to TCP, use 0-RTT only for idempotent requests.',
      ],
      keyIdea: 'Pick by network: QUIC shines on mobile and lossy paths, TCP stays the universal fallback.',
      frames: [{ state: hol(true) }],
    },
  ],
});
