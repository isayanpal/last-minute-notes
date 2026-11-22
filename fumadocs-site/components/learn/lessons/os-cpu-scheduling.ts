import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the OS notes on CPU scheduling with the notes' own workload: P1 (arrival 0, burst 8), P2 (1, 4), P3 (2, 9), P4 (3, 5).
 * A real scheduler simulator produces every Gantt bar and every waiting, turnaround and response time, so the averages
 * (FCFS 8.75, SJF 7.75, SRTF 6.5, round robin 11.75) are computed, not typed in.
 */

type Proc = { name: string; arrival: number; burst: number };
const WORKLOAD: Proc[] = [
  { name: 'P1', arrival: 0, burst: 8 },
  { name: 'P2', arrival: 1, burst: 4 },
  { name: 'P3', arrival: 2, burst: 9 },
  { name: 'P4', arrival: 3, burst: 5 },
];
type Seg = { name: string; from: number; to: number };
type Policy = 'FCFS' | 'SJF' | 'SRTF' | 'RR';
type Result = { segs: Seg[]; stats: Record<string, { completion: number; turnaround: number; waiting: number; response: number }>; avgWait: number; avgTurn: number; maxResponse: number };

const finish = (segs: Seg[]): Result => {
  const merged: Seg[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && last.name === s.name && last.to === s.from) last.to = s.to;
    else merged.push({ ...s });
  }
  const stats: Result['stats'] = {};
  for (const p of WORKLOAD) {
    const mine = merged.filter((s) => s.name === p.name);
    const completion = mine[mine.length - 1].to;
    const turnaround = completion - p.arrival;
    stats[p.name] = { completion, turnaround, waiting: turnaround - p.burst, response: mine[0].from - p.arrival };
  }
  const vals = Object.values(stats);
  const avg = (f: (s: Result['stats'][string]) => number) => vals.reduce((a, s) => a + f(s), 0) / vals.length;
  return { segs: merged, stats, avgWait: avg((s) => s.waiting), avgTurn: avg((s) => s.turnaround), maxResponse: Math.max(...vals.map((s) => s.response)) };
};

function simulate(policy: Policy, quantum = 4): Result {
  const rem = Object.fromEntries(WORKLOAD.map((p) => [p.name, p.burst]));
  const segs: Seg[] = [];
  if (policy === 'RR') {
    const queue: string[] = [];
    let t = 0;
    let admitted = 0;
    const admit = () => {
      while (admitted < WORKLOAD.length && WORKLOAD[admitted].arrival <= t) queue.push(WORKLOAD[admitted++].name);
    };
    admit();
    while (queue.length || admitted < WORKLOAD.length) {
      if (!queue.length) {
        t = WORKLOAD[admitted].arrival;
        admit();
        continue;
      }
      const n = queue.shift()!;
      const run = Math.min(quantum, rem[n]);
      segs.push({ name: n, from: t, to: t + run });
      t += run;
      rem[n] -= run;
      admit(); // arrivals during the quantum join before the preempted process
      if (rem[n] > 0) queue.push(n);
    }
    return finish(segs);
  }
  let t = 0;
  let current: string | null = null;
  while (Object.values(rem).some((r) => r > 0)) {
    const ready = WORKLOAD.filter((p) => p.arrival <= t && rem[p.name] > 0);
    if (!ready.length) {
      t++;
      continue;
    }
    if (policy === 'FCFS' || policy === 'SJF') {
      if (!current || rem[current] === 0) current = (policy === 'FCFS' ? [...ready].sort((a, b) => a.arrival - b.arrival) : [...ready].sort((a, b) => a.burst - b.burst || a.arrival - b.arrival))[0].name;
    } else {
      current = [...ready].sort((a, b) => rem[a.name] - rem[b.name] || a.arrival - b.arrival)[0].name; // SRTF re-decides every tick
    }
    segs.push({ name: current, from: t, to: t + 1 });
    rem[current]--;
    t++;
  }
  return finish(segs);
}

const RESULTS: Record<Policy, Result> = { FCFS: simulate('FCFS'), SJF: simulate('SJF'), SRTF: simulate('SRTF'), RR: simulate('RR', 4) };
const TONE: Record<string, TimelineBar['tone']> = { P1: 'req', P2: 'ok', P3: 'data', P4: 'violet' };
const f2 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

const view = (p: Policy, note: TimelineState['note'], highlight?: string): TimelineState => {
  const r = RESULTS[p];
  const end = Math.max(...r.segs.map((s) => s.to));
  return {
    from: 0,
    to: end,
    unit: 'ms',
    ticks: Array.from({ length: 5 }, (_, i) => Math.round((end * i) / 4)),
    lanes: WORKLOAD.map((w) => ({
      label: w.name,
      bars: r.segs.filter((s) => s.name === w.name).map((s, i) => ({ id: `${p}-${w.name}-${i}`, from: s.from, to: s.to, label: s.to - s.from >= 3 ? String(s.to - s.from) : undefined, tone: TONE[w.name], state: highlight && highlight !== w.name ? 'dim' : 'normal' })),
    })),
    stats: [
      { label: 'Avg waiting', value: `${f2(r.avgWait)} ms`, tone: p === 'FCFS' || p === 'RR' ? 'bad' : 'ok' },
      { label: 'Avg turnaround', value: `${f2(r.avgTurn)} ms` },
      { label: 'Max response', value: `${r.maxResponse} ms` },
    ],
    note,
  };
};

export default defineLesson('timeline', {
  slug: 'os-cpu-scheduling',
  objectives: [
    { text: 'What the convoy effect does to waiting time', step: 1 },
    { text: 'How shortest-job-first lowers the average wait', step: 2 },
    { text: 'How preemption improves it further', step: 3 },
    { text: 'What round robin trades for responsiveness', step: 4 },
  ],
  steps: [
    {
      label: 'FCFS',
      title: 'First come, first served',
      tag: 'problem',
      body: ['Four processes arrive almost together. FCFS runs them in arrival order with no preemption.', 'P2 needs only 4 ms but waits behind the 8 ms P1, the **convoy effect**.'],
      keyIdea: 'Short jobs wait behind one long job, like cars behind a truck.',
      frames: [{ state: view('FCFS', { text: 'P1 runs to completion first, so everyone else waits for it', tone: 'bad' }, 'P1'), hold: 2400 }, { state: view('FCFS', { text: 'average waiting time is 8.75 ms for this workload', tone: 'bad' }), hold: 3600 }],
    },
    {
      label: 'SJF',
      title: 'Shortest job first',
      tag: 'technique',
      body: ['When the CPU frees up, SJF picks the ready job with the shortest burst. At 8 ms that is P2, then P4, then P3.', 'It is still non-preemptive, so P1 runs to completion at the start.'],
      keyIdea: 'Running short jobs first lowers the average wait.',
      frames: [{ state: view('SJF', { text: 'P4 (5 ms) now goes before P3 (9 ms): average waiting drops to 7.75 ms', tone: 'ok' }), hold: 4000 }],
    },
    {
      label: 'SRTF',
      title: 'Preempt for the shortest remaining',
      tag: 'technique',
      body: ['**SRTF** is preemptive SJF. At 1 ms P2 arrives with 4 ms, less than P1\'s 7 ms remaining, so P2 preempts P1.', 'It gives the minimum average waiting time of any algorithm.'],
      keyIdea: 'The OS does not know burst times, so it predicts them, and long jobs can starve.',
      frames: [{ state: view('SRTF', { text: 'P1 is split in two by P2 and P4, and the average waiting time is 6.5 ms', tone: 'ok' }), hold: 4200 }],
    },
    {
      label: 'Round robin',
      title: 'A quantum for everyone',
      tag: 'trade-off',
      body: ['Round robin gives each process a **4 ms quantum**, then sends it to the back of the queue.', 'The average wait is worse here, but every process starts early and none starves.'],
      keyIdea: 'A huge quantum degenerates into FCFS, a tiny one drowns in context switches.',
      frames: [{ state: view('RR', { text: 'worse average waiting, but the longest response time is only 9 ms', tone: 'accent' }), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Scheduling trade-offs',
      tag: 'recap',
      body: [
        '- **FCFS:** simple, convoy effect.',
        '- **SJF:** lowest average wait without preemption.',
        '- **SRTF:** minimum average wait, needs burst predictions.',
        '- **Round robin:** best response, higher average wait.',
        '- **Goals conflict:** throughput, response time and fairness.',
      ],
      keyIdea: 'Batch systems chase throughput, interactive systems chase response time.',
      frames: [{ state: view('SRTF', { text: 'same workload, four policies, four different averages', tone: 'accent' }) }],
    },
  ],
});
