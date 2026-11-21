import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Sequence numbers are real: 1000-byte segments from seq 1000, cumulative ACKs name the next byte expected.
 * States and timers come from the notes: SYN_SENT, SYN_RECEIVED, ESTABLISHED, FIN_WAIT, CLOSE_WAIT, TIME_WAIT (2 x MSL, 60 s on Linux).
 */

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };

function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

const pair = (c?: string, s?: string, tone: 'ok' | 'bad' | 'accent' = 'accent', sTone: 'ok' | 'bad' | 'accent' = 'accent'): SeqActor[] => [
  { id: 'c', label: 'Client', kind: 'client', badge: c ? { text: c, tone } : undefined },
  { id: 's', label: 'Server', kind: 'service', badge: s ? { text: s, tone: sTone } : undefined },
];

// Step 1: two sides need agreed starting numbers before any data.
const problemFrames = reveal(pair(), [
  {
    msgs: [{ from: 'c', to: 's', label: 'data? (no shared state)', lost: true, tone: 'bad' }],
    hold: 2400,
    stats: [
      { label: 'IP gives', value: 'best effort' },
      { label: 'TCP needs', value: 'agreed ISNs' },
      { label: 'Each side', value: 'picks its own' },
    ],
    note: { text: 'before data flows, both sides must agree where counting starts', tone: 'accent' },
  },
]);

// Step 2: SYN, SYN+ACK, ACK.
const hsStats: Stat[] = [
  { label: 'Cost', value: '1 RTT' },
  { label: 'Options', value: 'MSS, SACK' },
  { label: 'ISN', value: 'random' },
];
const handshakeFrames = reveal(pair(undefined, 'LISTEN'), [
  { msgs: [{ from: 'c', to: 's', label: 'SYN seq=100' }], actors: pair('SYN_SENT', 'LISTEN'), hold: 1700, stats: hsStats },
  { msgs: [{ from: 's', to: 'c', label: 'SYN+ACK seq=300 ack=101', dashed: true }], actors: pair('SYN_SENT', 'SYN_RECEIVED'), hold: 1900, stats: hsStats },
  {
    msgs: [{ from: 'c', to: 's', label: 'ACK ack=301', tone: 'ok' }],
    actors: pair('ESTABLISHED', 'ESTABLISHED', 'ok', 'ok'),
    hold: 2800,
    stats: hsStats,
    note: { text: 'two directions, each opened and confirmed: the middle message does both', tone: 'ok' },
  },
]);

// Step 3: SYN flood and SYN cookies.
const FLOOD: SeqActor[] = [
  { id: 'a', label: 'Attacker', kind: 'external' },
  { id: 's', label: 'Server', kind: 'service' },
  { id: 'c', label: 'Real client', kind: 'client' },
];
const withBadge = (text: string, tone: 'ok' | 'bad' | 'accent'): SeqActor[] => FLOOD.map((x) => (x.id === 's' ? { ...x, badge: { text, tone } } : x));
const floodFrames = reveal(FLOOD, [
  {
    msgs: [{ from: 'a', to: 's', label: 'SYN (spoofed source)' }, { from: 's', to: 'a', label: 'SYN+ACK', dashed: true, lost: true, tone: 'bad' }],
    actors: withBadge('SYN queue filling', 'bad'),
    hold: 2000,
    stats: [
      { label: 'Attacker', value: 'never ACKs' },
      { label: 'Server holds', value: 'half-open', tone: 'bad' },
      { label: 'Queue', value: 'fills up', tone: 'bad' },
    ],
  },
  {
    msgs: [{ from: 'c', to: 's', label: 'SYN (real user)', lost: true, tone: 'bad' }],
    actors: withBadge('SYN queue full', 'bad'),
    hold: 2200,
    stats: [
      { label: 'Real SYN', value: 'dropped', tone: 'bad' },
      { label: 'Symptom', value: 'timeouts' },
      { label: 'Defense', value: 'SYN cookies' },
    ],
    note: { text: 'real clients are refused while the queue is full', tone: 'bad' },
  },
  {
    msgs: [{ from: 'c', to: 's', label: 'SYN (real user)' }, { from: 's', to: 'c', label: 'SYN+ACK (cookie ISN)', dashed: true }],
    actors: withBadge('SYN cookies, no state', 'ok'),
    hold: 2000,
    stats: [
      { label: 'Server stores', value: 'nothing', tone: 'ok' },
      { label: 'State is in', value: 'the ISN' },
      { label: 'Defense', value: 'SYN cookies', tone: 'ok' },
    ],
  },
  {
    msgs: [{ from: 'c', to: 's', label: 'ACK (cookie + 1)', tone: 'ok' }, { from: 's', to: 's', label: 'valid: create state', tone: 'ok' }],
    actors: withBadge('ESTABLISHED', 'ok'),
    hold: 2600,
    stats: [
      { label: 'State made', value: 'on final ACK', tone: 'ok' },
      { label: 'Spoofed hosts', value: 'never reply' },
      { label: 'Cost', value: 'little memory' },
    ],
    note: { text: 'only a client that really got the SYN+ACK can finish', tone: 'ok' },
  },
]);

// Step 4: reliability. 1000-byte segments, cumulative ACKs, three dup ACKs trigger a fast retransmit.
const relStats = (extra: Stat): Stat[] => [{ label: 'ACK means', value: 'next byte' }, { label: 'Window', value: 'many in flight' }, extra];
const relFrames = reveal(pair(), [
  { msgs: [{ from: 'c', to: 's', label: 'seq 1000 (1000 B)' }, { from: 's', to: 'c', label: 'ack 2000', dashed: true }], hold: 1700, stats: relStats({ label: 'Loss', value: 'none yet', tone: 'ok' }) },
  { msgs: [{ from: 'c', to: 's', label: 'seq 2000', lost: true, tone: 'bad' }], hold: 1600, stats: relStats({ label: 'Loss', value: 'seq 2000', tone: 'bad' }) },
  { msgs: [{ from: 'c', to: 's', label: 'seq 3000' }, { from: 's', to: 'c', label: 'ack 2000 (dup 1)', dashed: true, tone: 'bad' }], hold: 1500, stats: relStats({ label: 'Dup ACKs', value: '1' }) },
  { msgs: [{ from: 'c', to: 's', label: 'seq 4000' }, { from: 's', to: 'c', label: 'ack 2000 (dup 2)', dashed: true, tone: 'bad' }], hold: 1500, stats: relStats({ label: 'Dup ACKs', value: '2' }) },
  { msgs: [{ from: 'c', to: 's', label: 'seq 5000' }, { from: 's', to: 'c', label: 'ack 2000 (dup 3)', dashed: true, tone: 'bad' }], hold: 1700, stats: relStats({ label: 'Dup ACKs', value: '3: resend', tone: 'bad' }), note: { text: 'three duplicate ACKs: do not wait for the timer', tone: 'bad' } },
  {
    msgs: [{ from: 'c', to: 's', label: 'seq 2000 (fast retx)', tone: 'ok' }, { from: 's', to: 'c', label: 'ack 6000', dashed: true, tone: 'ok' }],
    hold: 2800,
    stats: relStats({ label: 'Hole', value: 'filled', tone: 'ok' }),
    note: { text: 'receiver had 3000 to 5000 buffered, so one ACK covers all', tone: 'ok' },
  },
]);

// Step 5: closing. FIN each way, and the closer waits in TIME_WAIT.
const CLOSE = (a?: string, b?: string, aTone: 'ok' | 'bad' | 'accent' = 'accent', bTone: 'ok' | 'bad' | 'accent' = 'accent'): SeqActor[] => [
  { id: 'a', label: 'Active closer', kind: 'client', badge: a ? { text: a, tone: aTone } : undefined },
  { id: 'b', label: 'Passive closer', kind: 'service', badge: b ? { text: b, tone: bTone } : undefined },
];
const closeStats: Stat[] = [
  { label: 'Each direction', value: 'own FIN' },
  { label: 'TIME_WAIT', value: '2 x MSL' },
  { label: 'On Linux', value: '60 s' },
];
const closeFrames = reveal(CLOSE(), [
  { msgs: [{ from: 'a', to: 'b', label: 'FIN' }], actors: CLOSE('FIN_WAIT_1'), hold: 1500, stats: closeStats },
  { msgs: [{ from: 'b', to: 'a', label: 'ACK', dashed: true }], actors: CLOSE('FIN_WAIT_2', 'CLOSE_WAIT'), hold: 1500, stats: closeStats, note: { text: 'CLOSE_WAIT: the app may still send, then must call close', tone: 'accent' } },
  { msgs: [{ from: 'b', to: 'a', label: 'FIN' }], actors: CLOSE('FIN_WAIT_2', 'LAST_ACK'), hold: 1500, stats: closeStats },
  {
    msgs: [{ from: 'a', to: 'b', label: 'ACK', dashed: true, tone: 'ok' }],
    actors: CLOSE('TIME_WAIT 2xMSL', 'CLOSED', 'accent', 'ok'),
    hold: 2800,
    stats: closeStats,
    note: { text: 'closer stays so a lost final ACK can be answered and old packets expire', tone: 'accent' },
  },
]);

// Step 6: the cost of a new connection versus reuse.
const reuseStats = (rtt: string, tone: 'ok' | 'bad'): Stat[] => [
  { label: 'RTTs before request', value: rtt, tone },
  { label: 'TCP', value: '1 RTT' },
  { label: 'TLS 1.3', value: '1 RTT' },
];
const newConn = reveal(pair(), [
  { msgs: [{ from: 'c', to: 's', label: 'SYN' }, { from: 's', to: 'c', label: 'SYN+ACK', dashed: true }], hold: 1500, stats: reuseStats('1 so far', 'bad') },
  { msgs: [{ from: 'c', to: 's', label: 'ClientHello (+ ACK)' }, { from: 's', to: 'c', label: 'ServerHello, Finished', dashed: true }], hold: 1700, stats: reuseStats('2', 'bad') },
  { msgs: [{ from: 'c', to: 's', label: 'GET /', tone: 'ok' }], hold: 2200, stats: reuseStats('2', 'bad'), note: { text: 'a new HTTPS connection pays two round trips before byte one', tone: 'bad' } },
]);
const reused = reveal(pair('ESTABLISHED', 'ESTABLISHED', 'ok', 'ok'), [
  { msgs: [{ from: 'c', to: 's', label: 'GET / (reused conn)', tone: 'ok' }, { from: 's', to: 'c', label: '200 OK', dashed: true, tone: 'ok' }], hold: 2800, stats: reuseStats('0', 'ok'), note: { text: 'keep-alive and pooling skip both handshakes', tone: 'ok' } },
]);

export default defineLesson('sequence', {
  slug: 'net-tcp-handshake',
  objectives: [
    { text: 'Why TCP needs a handshake before data', step: 1 },
    { text: 'What SYN, SYN+ACK and ACK each establish', step: 2 },
    { text: 'How a SYN flood works and how SYN cookies stop it', step: 3 },
    { text: 'How sequence numbers, ACKs and fast retransmit repair loss', step: 4 },
    { text: 'How a connection closes and why TIME_WAIT exists', step: 5 },
    { text: 'What a new connection costs and why reuse matters', step: 6 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Counting needs a shared start',
      tag: 'problem',
      body: ['IP is best effort. TCP numbers every **byte** to detect loss, duplicates and reordering, so both sides must agree where counting starts.', 'Each side picks an **initial sequence number** (ISN) and must learn that the other received it.'],
      keyIdea: 'No shared state, no reliable stream. The handshake builds that state.',
      frames: problemFrames,
    },
    {
      label: 'Handshake',
      title: 'SYN, SYN+ACK, ACK',
      tag: 'concept',
      body: ['The client SYN and the server ACK cover one direction. The server SYN and the client ACK cover the other. The middle message combines both.', 'Two messages would also let a delayed duplicate SYN open a phantom connection. ISNs are random so attackers cannot guess them.'],
      keyIdea: 'SYNs also negotiate options: MSS, window scale, SACK and timestamps.',
      frames: handshakeFrames,
    },
    {
      label: 'SYN flood',
      title: 'Half-open connections as a weapon',
      tag: 'trade-off',
      body: ['A **SYN flood** sends SYNs from spoofed addresses and never completes the handshake, filling the server SYN queue so real users are refused.', '**SYN cookies** encode the connection state in the server ISN and store nothing until the final ACK proves the client is real.'],
      keyIdea: 'State created on the first packet is an attack surface. Create it only after the peer proves it is real.',
      frames: floodFrames,
    },
    {
      label: 'Reliability',
      title: 'ACKs, holes and fast retransmit',
      tag: 'technique',
      body: ['ACKs are **cumulative**: `ack 2000` means "I have everything before byte 2000, send 2000 next". Many segments can be in flight at once.', 'Three duplicate ACKs mean a segment was probably lost, so the sender resends at once instead of waiting for the timer.'],
      keyIdea: 'SACK lets the receiver list the ranges it holds, so only the real holes are resent.',
      frames: relFrames,
    },
    {
      label: 'Close',
      title: 'FIN each way, then TIME_WAIT',
      tag: 'concept',
      body: ['TCP is full duplex, so each direction closes with its own FIN. The side that closes first waits in **TIME_WAIT** for 2 x MSL (60 s on Linux).', 'That covers a lost final ACK and lets delayed packets of the old connection expire before the 4-tuple is reused.'],
      keyIdea: 'Many `TIME_WAIT`: connection per request, so reuse. Many `CLOSE_WAIT`: your app never called close.',
      frames: closeFrames,
    },
    {
      label: 'Reuse',
      title: 'Why connection reuse matters',
      tag: 'in practice',
      body: ['A new HTTPS connection needs **1 RTT for TCP and 1 RTT for TLS 1.3** before the first request byte.', 'Keep-alive, pooling and HTTP/2 multiplexing amortize that cost over many requests.'],
      keyIdea: 'On a 100 ms path, a cold connection wastes about 200 ms before any data moves.',
      frames: [...newConn, ...reused],
    },
    {
      label: 'Recap',
      title: 'TCP lifecycle',
      tag: 'recap',
      body: [
        '- **Open:** SYN, SYN+ACK, ACK agree on ISNs and options.',
        '- **Protect:** SYN cookies keep a flood from filling the queue.',
        '- **Repair:** cumulative ACKs, fast retransmit on 3 dup ACKs, SACK.',
        '- **Close:** FIN each way, closer sits in TIME_WAIT 60 s.',
        '- **Save:** reuse connections to skip 2 RTTs.',
      ],
      keyIdea: 'Most TCP trouble shows up as a state count: `ss -s` tells you which half of the lifecycle is stuck.',
      frames: [closeFrames[closeFrames.length - 1]],
    },
  ],
});
