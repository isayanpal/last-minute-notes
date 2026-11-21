import { defineLesson } from '../define';
import type { ArrayRow, ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame, Stat } from '../types';

/*
 * The cwnd series is simulated with the rules from the notes: initial window 10 segments, slow start doubles per RTT,
 * congestion avoidance adds 1, three duplicate ACKs halve (ssthresh = cwnd / 2, cwnd = ssthresh), a timeout collapses to 1 segment.
 * Units are segments, one value per RTT.
 */

type Phase = 'slow start' | 'avoid' | 'loss' | 'timeout';
type Point = { cwnd: number; phase: Phase; ssthresh: number };

function simulate(rtts: number, ssthresh0: number, events: Record<number, 'loss' | 'timeout'> = {}): Point[] {
  const out: Point[] = [];
  let cwnd = 10;
  let ssthresh = ssthresh0;
  for (let t = 0; t < rtts; t++) {
    if (t > 0) {
      const prev = out[t - 1];
      if (events[t] === 'loss') {
        ssthresh = Math.max(2, Math.floor(prev.cwnd / 2));
        cwnd = ssthresh;
        out.push({ cwnd, phase: 'loss', ssthresh });
        continue;
      }
      if (events[t] === 'timeout') {
        ssthresh = Math.max(2, Math.floor(prev.cwnd / 2));
        cwnd = 1;
        out.push({ cwnd, phase: 'timeout', ssthresh });
        continue;
      }
      cwnd = prev.cwnd < ssthresh ? Math.min(prev.cwnd * 2, ssthresh) : prev.cwnd + 1;
    }
    out.push({ cwnd, phase: cwnd < ssthresh ? 'slow start' : 'avoid', ssthresh });
  }
  return out;
}

const STATE_OF: Record<Phase, ItemState> = { 'slow start': 'visited', avoid: 'found', loss: 'bad', timeout: 'bad' };
const cwndRow = (pts: Point[], total: number): ArrayRow => ({
  label: 'cwnd',
  cells: Array.from({ length: total }, (_, i) => (pts[i] ? pts[i].cwnd : 0)),
  states: Object.fromEntries(Array.from({ length: total }, (_, i) => [i, pts[i] ? STATE_OF[pts[i].phase] : 'dim'])) as Record<number, ItemState>,
  bars: true,
  showIndex: true,
});

// Step 1: two windows, two different protected parties.
const windows = (cwnd: number, rwnd: number): ArrayState => ({
  rows: [
    {
      label: 'Window',
      cells: [cwnd, rwnd, Math.min(cwnd, rwnd)],
      states: { 0: 'visited', 1: 'swap', 2: 'found' },
      bars: true,
      showIndex: false,
    },
    { cells: ['cwnd', 'rwnd', 'min'], showIndex: false },
  ],
  stats: [
    { label: 'cwnd guards', value: 'the network' },
    { label: 'rwnd guards', value: 'the receiver' },
    { label: 'In flight', value: `min = ${Math.min(cwnd, rwnd)}`, tone: 'ok' },
  ],
  note: { text: 'the sender may have at most min(cwnd, rwnd) bytes unacknowledged', tone: 'accent' },
});

// Step 2: flow control. The receiver advertises how much buffer is left.
const RWND = [64, 48, 32, 16, 0, 0, 32, 64];
const flow = (n: number): ArrayState => {
  const shown = RWND.slice(0, n);
  return {
    rows: [
      {
        label: 'rwnd',
        cells: RWND.map((v, i) => (i < n ? v : 0)),
        states: Object.fromEntries(RWND.map((v, i) => [i, i >= n ? 'dim' : v === 0 ? 'bad' : 'swap'])) as Record<number, ItemState>,
        bars: true,
        showIndex: true,
      },
    ],
    stats: [
      { label: 'Window', value: `${shown[shown.length - 1] ?? 64} KB`, tone: shown[shown.length - 1] === 0 ? 'bad' : 'neutral' },
      { label: 'At zero', value: 'sender stops', tone: 'bad' },
      { label: 'Then', value: 'window probes' },
    ],
    note:
      shown[shown.length - 1] === 0
        ? { text: 'zero window: the slow consumer pauses the producer', tone: 'bad' }
        : n === RWND.length
          ? { text: 'buffer drained: window reopens and data flows again', tone: 'ok' }
          : { text: 'every ACK carries the receiver free buffer space', tone: 'accent' },
  };
};

// Step 3: slow start, then congestion avoidance.
const SS = simulate(6, 64);
const ssFrames: Frame<ArrayState>[] = SS.map((p, i) => ({
  hold: i === SS.length - 1 ? 2600 : 900,
  state: {
    rows: [cwndRow(SS.slice(0, i + 1), 6)],
    stats: [
      { label: 'Phase', value: p.phase },
      { label: 'cwnd', value: `${p.cwnd} seg`, tone: p.phase === 'slow start' ? 'neutral' : 'ok' },
      { label: 'ssthresh', value: `${p.ssthresh} seg` },
    ],
    note: p.phase === 'slow start' ? { text: 'doubles every RTT: exponential, despite the name', tone: 'accent' } : { text: 'past ssthresh: add one segment per RTT', tone: 'ok' },
  },
}));

// Step 4: AIMD. Triple duplicate ACK halves, timeout collapses to one segment.
const LOSS = simulate(12, 64, { 7: 'loss' });
const TIMEOUT = simulate(12, 64, { 7: 'timeout' });
const aimd = (pts: Point[], kind: 'loss' | 'timeout'): Frame<ArrayState> => {
  const at = pts[7];
  return {
    hold: 3000,
    state: {
      rows: [cwndRow(pts, 12)],
      stats: [
        { label: 'Before', value: `${pts[6].cwnd} seg` },
        { label: kind === 'loss' ? '3 dup ACKs' : 'Timeout', value: `cwnd ${at.cwnd}`, tone: 'bad' },
        { label: 'ssthresh', value: `${at.ssthresh} seg` },
      ],
      note: kind === 'loss' ? { text: 'multiplicative decrease: halve, then keep growing by 1', tone: 'accent' } : { text: 'timeout: back to 1 segment and slow start again', tone: 'bad' },
    },
  };
};

// Step 5: algorithms differ in the signal they trust.
const ALGOS = ['Reno', 'CUBIC', 'BBR', 'DCTCP'];
const SIGNAL = ['loss', 'loss', 'delay', 'ECN'];
const algos = (focus?: number): ArrayState => {
  const states = focus === undefined ? undefined : (Object.fromEntries(ALGOS.map((_, i) => [i, i === focus ? 'active' : 'dim'])) as Record<number, ItemState>);
  const notes = [
    'the textbook AIMD sawtooth',
    'cubic growth since last loss, default on Linux, Windows, macOS',
    'models bottleneck bandwidth and min RTT, does not wait for loss',
    'uses ECN marks to keep data center queues short',
  ];
  return {
    rows: [
      { label: 'Algorithm', cells: ALGOS, states, showIndex: false },
      { label: 'Signal', cells: SIGNAL, states, showIndex: false },
    ],
    stats: [
      { label: 'Default', value: 'CUBIC' },
      { label: 'Lossy paths', value: 'BBR helps' },
      { label: 'ECN', value: 'mark, not drop' },
    ],
    note: { text: focus === undefined ? 'same goal, different signal: loss, delay or marks' : notes[focus], tone: 'accent' },
  };
};

// Step 6: a warm connection skips slow start. Bytes sent per RTT, cold versus warm.
const COLD = simulate(6, 64).map((p) => p.cwnd);
const WARM = [64, 64, 64, 64, 64, 64];
const warm = (showWarm: boolean): ArrayState => ({
  rows: [
    { label: 'Cold', cells: COLD, states: Object.fromEntries(COLD.map((_, i) => [i, 'visited'])) as Record<number, ItemState>, bars: true, showIndex: true },
    ...(showWarm ? [{ label: 'Warm', cells: WARM, states: Object.fromEntries(WARM.map((_, i) => [i, 'found'])) as Record<number, ItemState>, bars: true, showIndex: false } as ArrayRow] : []),
  ],
  stats: [
    { label: 'Cold, 6 RTTs', value: `${COLD.reduce((a, b) => a + b, 0)} seg` },
    { label: 'Warm, 6 RTTs', value: showWarm ? `${WARM.reduce((a, b) => a + b, 0)} seg` : '?', tone: showWarm ? 'ok' : 'neutral' },
    { label: 'Nagle + delayed ACK', value: '~40 ms stall' } as Stat,
  ],
  note: showWarm ? { text: 'a warm connection keeps its window, a new one starts small', tone: 'ok' } : { text: 'a fresh connection climbs from 10 segments', tone: 'accent' },
});

export default defineLesson('array', {
  slug: 'net-tcp-congestion',
  objectives: [
    { text: 'Flow control versus congestion control', step: 1 },
    { text: 'How the receive window and zero window work', step: 2 },
    { text: 'Slow start and congestion avoidance', step: 3 },
    { text: 'AIMD: what loss and timeout do to the window', step: 4 },
    { text: 'How Reno, CUBIC, BBR and DCTCP differ', step: 5 },
    { text: 'Why warm connections and TCP_NODELAY matter', step: 6 },
  ],
  steps: [
    {
      label: 'Two windows',
      title: 'Protect the receiver, protect the network',
      tag: 'problem',
      body: ['**Flow control** keeps the sender from overrunning the receiver. **Congestion control** keeps the sender from overrunning the network.', 'The sender may have at most `min(cwnd, rwnd)` bytes in flight.'],
      keyIdea: 'Interviewers love this distinction: `rwnd` comes from the receiver, `cwnd` is the sender own estimate of the path.',
      frames: [{ state: windows(40, 20), hold: 2200 }, { state: windows(12, 30), hold: 2400 }],
    },
    {
      label: 'Flow control',
      title: 'The receive window',
      tag: 'concept',
      body: ['Each ACK advertises `rwnd`, the buffer space left. When the buffer fills, the receiver advertises a **zero window** and the sender stops, probing now and then.', 'A slow consumer therefore slows the producer: built-in backpressure.'],
      keyIdea: 'The 16-bit window caps at 64 KB, so the window scale option stretches it to about 1 GB for fast long paths.',
      frames: [{ state: flow(2), hold: 1000 }, { state: flow(4), hold: 1300 }, { state: flow(5), hold: 1600 }, { state: flow(6), hold: 1400 }, { state: flow(7), hold: 1100 }, { state: flow(8), hold: 2200 }],
    },
    {
      label: 'Slow start',
      title: 'Start small, double fast',
      tag: 'technique',
      body: ['A new connection starts at an initial window (10 segments on modern stacks) and **doubles every RTT** until it reaches `ssthresh`.', 'After that, congestion avoidance adds about one segment per RTT: **additive increase**.'],
      keyIdea: 'The sender probes for bandwidth: fast at first, then carefully, until the network pushes back.',
      frames: ssFrames,
    },
    {
      label: 'AIMD',
      title: 'Loss tells the sender to back off',
      tag: 'technique',
      body: ['On three duplicate ACKs the sender sets `ssthresh = cwnd / 2` and `cwnd = ssthresh`: **multiplicative decrease**.', 'On a timeout it collapses to 1 segment and slow starts again. Additive increase plus multiplicative decrease makes the sawtooth.'],
      keyIdea: 'A duplicate-ACK loss costs half the window, a timeout costs nearly all of it. That is why fast retransmit matters.',
      frames: [aimd(LOSS, 'loss'), aimd(TIMEOUT, 'timeout')],
    },
    {
      label: 'Algorithms',
      title: 'Same goal, different signal',
      tag: 'trade-off',
      body: ['**Reno** and **CUBIC** react to loss, **BBR** models bandwidth and minimum RTT, **DCTCP** reacts to ECN marks.', 'Loss-based algorithms back off on Wi-Fi or mobile loss even when the link is idle. That is one reason BBR exists.'],
      keyIdea: 'ECN lets routers mark packets instead of dropping them, so senders slow down without losing data.',
      frames: [{ state: algos(), hold: 1800 }, { state: algos(0), hold: 1500 }, { state: algos(1), hold: 1800 }, { state: algos(2), hold: 2000 }, { state: algos(3), hold: 2000 }],
    },
    {
      label: 'In practice',
      title: 'Warm connections win',
      tag: 'in practice',
      body: ['A fresh connection starts slow, so **reusing warm connections** moves more data than opening new ones.', 'Small writes can stall too: Nagle plus delayed ACK costs about 40 ms. Set `TCP_NODELAY` for RPC, games and databases.'],
      keyIdea: 'TCP keepalive defaults to 2 hours on Linux. Load balancers drop idle connections sooner, so heartbeat faster.',
      frames: [{ state: warm(false), hold: 2000 }, { state: warm(true), hold: 2800 }],
    },
    {
      label: 'Recap',
      title: 'Two controls, one pipe',
      tag: 'recap',
      body: [
        '- **Flow control:** `rwnd`, zero window, window scale.',
        '- **Congestion control:** `cwnd`, slow start, additive increase.',
        '- **On loss:** halve on 3 dup ACKs, collapse on timeout.',
        '- **Algorithms:** CUBIC default, BBR for lossy paths, DCTCP in data centers.',
        '- **Practice:** reuse connections, set NODELAY, heartbeat under LB timeouts.',
      ],
      keyIdea: 'Throughput is bounded by min(cwnd, rwnd) divided by RTT, so both windows and latency decide speed.',
      frames: [aimd(LOSS, 'loss')],
    },
  ],
});
