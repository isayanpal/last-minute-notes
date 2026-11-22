import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the Python notes on the GIL: one thread runs bytecode at a time, threads take turns every 5 ms (the switch interval), blocking I/O
 * releases the GIL, and separate processes each have their own. A tick-by-tick scheduler runs the scripts, so every total (40 ms, 45 ms and 20 ms)
 * is computed. The 20 ms CPU bursts and the 30 ms I/O wait are EXAMPLE values.
 */

type Op = { kind: 'cpu' | 'io'; ms: number };
type Seg = { th: number; kind: 'run' | 'wait' | 'io'; from: number; to: number };

function simulate(scripts: Op[][], gil: boolean, interval = 5): { segs: Seg[]; end: number } {
  const n = scripts.length;
  const idx = scripts.map(() => 0);
  const rem = scripts.map((s) => s[0].ms);
  const phase = scripts.map((s) => (s[0].kind === 'cpu' ? 'want' : 'io')) as ('want' | 'io' | 'done')[];
  let holder = -1;
  let slice = 0;
  const ticks: ('run' | 'wait' | 'io' | 'done')[][] = [];
  const advance = (t: number) => {
    idx[t]++;
    if (idx[t] >= scripts[t].length) {
      phase[t] = 'done';
      return;
    }
    rem[t] = scripts[t][idx[t]].ms;
    phase[t] = scripts[t][idx[t]].kind === 'cpu' ? 'want' : 'io';
  };
  for (let time = 0; time < 400 && phase.some((p) => p !== 'done'); time++) {
    const row: ('run' | 'wait' | 'io' | 'done')[] = Array(n).fill('done');
    // pick who may run
    const wanting = phase.map((p, i) => (p === 'want' ? i : -1)).filter((i) => i >= 0);
    const runners: number[] = [];
    if (!gil) runners.push(...wanting);
    else if (wanting.length) {
      if (holder === -1 || !wanting.includes(holder) || (slice >= interval && wanting.length > 1)) {
        const after = wanting.filter((i) => i > holder);
        holder = after.length ? after[0] : wanting[0];
        slice = 0;
      }
      runners.push(holder);
    } else holder = -1;
    for (let i = 0; i < n; i++) {
      if (phase[i] === 'done') continue;
      if (phase[i] === 'io') row[i] = 'io';
      else row[i] = runners.includes(i) ? 'run' : 'wait';
    }
    ticks.push(row);
    for (let i = 0; i < n; i++) {
      if (phase[i] === 'done') continue;
      if (phase[i] === 'io') {
        rem[i]--;
        if (rem[i] === 0) advance(i);
      } else if (runners.includes(i)) {
        rem[i]--;
        if (gil) slice++;
        if (rem[i] === 0) {
          advance(i);
          if (gil && phase[i] !== 'want') slice = 0;
        }
      }
    }
  }
  const segs: Seg[] = [];
  ticks.forEach((row, t) =>
    row.forEach((k, th) => {
      if (k === 'done') return;
      const last = [...segs].reverse().find((s) => s.th === th);
      if (last && last.kind === k && last.to === t) last.to = t + 1;
      else segs.push({ th, kind: k, from: t, to: t + 1 });
    }),
  );
  return { segs, end: ticks.length };
}

const cpu = (ms: number): Op => ({ kind: 'cpu', ms });
const io = (ms: number): Op => ({ kind: 'io', ms });
const CPU2 = simulate([[cpu(20)], [cpu(20)]], true);
const IO2 = simulate([[cpu(5), io(30), cpu(5)], [cpu(5), io(30), cpu(5)]], true);
const PROCS = simulate([[cpu(20)], [cpu(20)]], false);
const SEQ_CPU = 40;
const SEQ_IO = 80;

const bars = (sim: ReturnType<typeof simulate>, th: number, tag: string): TimelineBar[] =>
  sim.segs
    .filter((s) => s.th === th)
    .map((s, i): TimelineBar => ({ id: `${tag}-${th}-${i}`, from: s.from, to: s.to, label: s.kind === 'run' ? 'run' : s.kind === 'io' ? 'I/O' : undefined, tone: s.kind === 'run' ? 'ok' : s.kind === 'io' ? 'info' : 'neutral', state: s.kind === 'wait' ? 'dim' : 'normal' }));

const view = (sim: ReturnType<typeof simulate>, tag: string, lane: string, end: number, note: TimelineState['note'], stats: TimelineState['stats']): TimelineState => ({
  from: 0,
  to: end,
  unit: 'ms',
  ticks: Array.from({ length: 5 }, (_, i) => Math.round((end * i) / 4)),
  lanes: [0, 1].map((th) => ({ label: `${lane} ${th + 1}`, bars: bars(sim, th, tag) })),
  stats,
  note,
});

export default defineLesson('timeline', {
  slug: 'py-gil',
  objectives: [
    { text: 'Why two CPU-bound threads are not faster', step: 1 },
    { text: 'How threads take turns', step: 2 },
    { text: 'Why I/O-bound threads do overlap', step: 3 },
    { text: 'What really runs in parallel', step: 4 },
  ],
  steps: [
    {
      label: 'CPU-bound',
      title: 'Two threads, one at a time',
      tag: 'problem',
      body: ['The **Global Interpreter Lock** lets only one thread run Python bytecode at a time.', 'Two threads each needing 20 ms of CPU still take 40 ms in total, the same as running them one after the other.'],
      keyIdea: 'The GIL protects interpreter internals such as reference counts.',
      frames: [{ state: view(CPU2, 'cpu', 'Thread', CPU2.end, { text: 'the grey stretches are a thread waiting for the GIL', tone: 'bad' }, [{ label: 'Two threads', value: `${CPU2.end} ms`, tone: 'bad' }, { label: 'One after other', value: `${SEQ_CPU} ms` }, { label: 'Speedup', value: `${SEQ_CPU / CPU2.end}x`, tone: 'bad' }]), hold: 4800 }],
    },
    {
      label: 'Switching',
      title: 'A turn every 5 ms',
      tag: 'concept',
      body: ['A waiting thread asks the running one to drop the GIL after the **switch interval**, 5 ms by default.', 'The threads alternate, but only one is ever running.'],
      keyIdea: '`sys.getswitchinterval()` is 0.005 seconds.',
      frames: [{ state: view(CPU2, 'cpu', 'Thread', CPU2.end, { text: 'run, wait, run, wait: the GIL moves every 5 ms', tone: 'accent' }, [{ label: 'Interval', value: '5 ms' }, { label: 'Handovers', value: String(CPU2.segs.filter((s) => s.kind === 'run').length - 2) }, { label: 'Running at once', value: '1', tone: 'bad' }]), hold: 4400 }],
    },
    {
      label: 'I/O-bound',
      title: 'Waiting releases the GIL',
      tag: 'technique',
      body: ['Blocking I/O, such as a socket read, **releases the GIL**. While one thread waits, the other runs.', `Two threads with 30 ms of waiting finish in ${IO2.end} ms instead of ${SEQ_IO} ms.`],
      keyIdea: 'Threads or asyncio are the right tool for I/O-bound work.',
      frames: [{ state: view(IO2, 'io', 'Thread', IO2.end, { text: 'the waits overlap: while thread 1 is in I/O, thread 2 holds the GIL', tone: 'ok' }, [{ label: 'Two threads', value: `${IO2.end} ms`, tone: 'ok' }, { label: 'One after other', value: `${SEQ_IO} ms` }, { label: 'Speedup', value: `${Math.round((SEQ_IO / IO2.end) * 100) / 100}x`, tone: 'ok' }]), hold: 4800 }],
    },
    {
      label: 'Processes',
      title: 'One GIL each',
      tag: 'in practice',
      body: ['`multiprocessing` and `ProcessPoolExecutor` start separate interpreters, each with its own GIL.', 'The two CPU-bound jobs now truly run at the same time and finish in 20 ms.'],
      keyIdea: 'Other options: subinterpreters, the free-threaded build, or native code that releases the GIL.',
      frames: [{ state: view(PROCS, 'proc', 'Process', PROCS.end, { text: 'no shared GIL, so both processes run at once', tone: 'ok' }, [{ label: 'Two processes', value: `${PROCS.end} ms`, tone: 'ok' }, { label: 'One after other', value: `${SEQ_CPU} ms` }, { label: 'Speedup', value: `${SEQ_CPU / PROCS.end}x`, tone: 'ok' }]), hold: 4600 }],
    },
    {
      label: 'Recap',
      title: 'The GIL',
      tag: 'recap',
      body: [
        '- **One thread** runs bytecode at a time.',
        '- **Handover:** every 5 ms, or on blocking I/O.',
        '- **I/O-bound:** threads help.',
        '- **CPU-bound:** use processes or native code.',
        '- **Not thread-safe:** `counter += 1` is several bytecodes, still needs a lock.',
      ],
      keyIdea: 'The GIL does not make your code thread-safe.',
      frames: [{ state: view(IO2, 'io', 'Thread', IO2.end, { text: 'threads win when they wait, processes win when they compute', tone: 'accent' }, [{ label: 'CPU, threads', value: `${CPU2.end} ms`, tone: 'bad' }, { label: 'I/O, threads', value: `${IO2.end} ms`, tone: 'ok' }, { label: 'CPU, processes', value: `${PROCS.end} ms`, tone: 'ok' }]) }],
    },
  ],
});
