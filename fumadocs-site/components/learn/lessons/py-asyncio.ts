import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the Python notes on asyncio: one thread, an event loop, switches only at await, gather and TaskGroup for concurrency,
 * cancellation when a TaskGroup member fails, and a blocking call that freezes every task. A virtual-time event loop runs the scripts,
 * so the totals (3 s, 1 s, 0.5 s and 3 s) are computed. The 1 second sleeps and the 0.5 second failure are the notes' and an EXAMPLE value.
 */

type Op = { lane: number; kind: 'sleep' | 'block' | 'fail'; ms: number };
type Seg = { lane: number; kind: 'sleep' | 'block' | 'cancelled' | 'fail'; from: number; to: number };

function runLoop(tasks: Op[][]): { segs: Seg[]; end: number; failedAt?: number } {
  const segs: Seg[] = [];
  const idx = tasks.map(() => 0);
  const wake: number[] = tasks.map(() => 0); // when each task is next ready
  const alive = new Set(tasks.map((_, i) => i));
  const current: { task: number; lane: number; from: number }[] = []; // sleeps in flight
  let time = 0;
  let failedAt: number | undefined;
  while (alive.size) {
    const ready = [...alive].filter((t) => wake[t] <= time);
    if (!ready.length) {
      time = Math.min(...[...alive].map((t) => wake[t]));
      continue;
    }
    const t = ready[0];
    const op = tasks[t][idx[t]];
    if (!op) {
      alive.delete(t);
      continue;
    }
    idx[t]++;
    if (op.kind === 'block') {
      segs.push({ lane: op.lane, kind: 'block', from: time, to: time + op.ms });
      time += op.ms; // the whole loop is stuck
      wake[t] = time;
    } else if (op.kind === 'sleep') {
      segs.push({ lane: op.lane, kind: 'sleep', from: time, to: time + op.ms });
      current.push({ task: t, lane: op.lane, from: time });
      wake[t] = time + op.ms;
    } else {
      // fail: raise after op.ms of waiting, then cancel everyone else (TaskGroup)
      segs.push({ lane: op.lane, kind: 'fail', from: time, to: time + op.ms });
      failedAt = time + op.ms;
      wake[t] = failedAt;
      for (const other of [...alive]) {
        if (other === t) continue;
        for (const s of segs) if (s.kind === 'sleep' && s.from < failedAt && s.to > failedAt) {
          s.to = failedAt;
          s.kind = 'cancelled';
        }
        alive.delete(other);
      }
      alive.delete(t);
    }
  }
  return { segs, end: Math.max(...segs.map((s) => s.to)), failedAt };
}

const S = 1000;
const SEQ = runLoop([[{ lane: 0, kind: 'sleep', ms: S }, { lane: 1, kind: 'sleep', ms: S }, { lane: 2, kind: 'sleep', ms: S }]]);
const GATHER = runLoop([0, 1, 2].map((lane) => [{ lane, kind: 'sleep' as const, ms: S }]));
const GROUP = runLoop([[{ lane: 0, kind: 'sleep', ms: S }], [{ lane: 1, kind: 'fail', ms: 500 }], [{ lane: 2, kind: 'sleep', ms: S }]]);
const BLOCKED = runLoop([0, 1, 2].map((lane) => [{ lane, kind: 'block' as const, ms: S }]));

const view = (r: ReturnType<typeof runLoop>, note: TimelineState['note'], stats: TimelineState['stats']): TimelineState => ({
  from: 0,
  to: 3,
  unit: 's',
  ticks: [0, 1, 2, 3],
  lanes: [0, 1, 2].map((lane) => ({
    label: `fetch(${lane + 1})`,
    bars: r.segs.filter((s) => s.lane === lane).map((s, i): TimelineBar => ({ id: `${lane}-${s.kind}-${i}`, from: s.from / S, to: s.to / S, label: s.kind === 'sleep' ? 'await' : s.kind === 'block' ? 'blocked' : s.kind === 'fail' ? 'raises' : 'cancel', tone: s.kind === 'sleep' ? 'info' : s.kind === 'block' ? 'bad' : s.kind === 'fail' ? 'bad' : 'neutral', state: s.kind === 'cancelled' ? 'dim' : 'normal' })),
  })),
  markers: r.failedAt ? [{ at: r.failedAt / S, label: 'error', tone: 'bad' }] : undefined,
  stats,
  note,
});

export default defineLesson('timeline', {
  slug: 'py-asyncio',
  objectives: [
    { text: 'Why awaiting one after another is sequential', step: 1 },
    { text: 'How gather runs them together', step: 2 },
    { text: 'How a TaskGroup cancels siblings on failure', step: 3 },
    { text: 'Why one blocking call freezes every task', step: 4 },
  ],
  steps: [
    {
      label: 'Sequential',
      title: 'await after await',
      tag: 'problem',
      body: ['`asyncio` runs coroutines on **one thread** with an event loop. A coroutine yields control only at an `await`.', '`await fetch(1)`, then `await fetch(2)`, then `await fetch(3)` runs them one after another: 3 seconds.'],
      keyIdea: '`await coro()` is sequential. Concurrency needs tasks.',
      frames: [{ state: view(SEQ, { text: 'each await finishes before the next one starts', tone: 'bad' }, [{ label: 'Total', value: `${SEQ.end / S} s`, tone: 'bad' }, { label: 'Tasks', value: '1' }, { label: 'Waiting overlaps', value: 'no', tone: 'bad' }]), hold: 4400 }],
    },
    {
      label: 'gather',
      title: 'Schedule them together',
      tag: 'concept',
      body: ['`asyncio.gather(fetch(1), fetch(2), fetch(3))` wraps each coroutine in a **task**. All three start, and the loop switches while they wait.', 'The total is the longest one: 1 second.'],
      keyIdea: 'Keep a reference to tasks you create, the loop holds them only weakly.',
      frames: [{ state: view(GATHER, { text: 'three sleeps overlap on a single thread', tone: 'ok' }, [{ label: 'Total', value: `${GATHER.end / S} s`, tone: 'ok' }, { label: 'Tasks', value: '3' }, { label: 'Waiting overlaps', value: 'yes', tone: 'ok' }]), hold: 4400 }],
    },
    {
      label: 'TaskGroup',
      title: 'Structured concurrency',
      tag: 'technique',
      body: ['In an `async with asyncio.TaskGroup()` block, if one task fails the others are **cancelled**.', 'Here `fetch(2)` raises after 0.5 s, so the other two stop at the same moment, and the errors surface as an `ExceptionGroup`.'],
      keyIdea: 'No task outlives the block.',
      frames: [{ state: view(GROUP, { text: `at ${(GROUP.failedAt ?? 0) / S} s the failure cancels the others, nothing keeps running`, tone: 'ok' }, [{ label: 'Total', value: `${GROUP.end / S} s`, tone: 'ok' }, { label: 'Failed at', value: `${(GROUP.failedAt ?? 0) / S} s` }, { label: 'Cancelled', value: '2', tone: 'ok' }]), hold: 4800 }],
    },
    {
      label: 'Blocking',
      title: 'time.sleep freezes everything',
      tag: 'trade-off',
      body: ['`time.sleep(1)` does not await. It holds the thread, so the loop cannot run any other task.', 'Even with `gather`, three blocking calls take 3 seconds. A `requests.get` or a CPU-heavy loop does the same.'],
      keyIdea: 'Use `await asyncio.sleep`, an async client, or `asyncio.to_thread` for blocking code.',
      frames: [{ state: view(BLOCKED, { text: 'each blocking call runs to the end before the loop can switch', tone: 'bad' }, [{ label: 'Total', value: `${BLOCKED.end / S} s`, tone: 'bad' }, { label: 'Tasks', value: '3' }, { label: 'Loop', value: 'frozen', tone: 'bad' }]), hold: 4800 }],
    },
    {
      label: 'Recap',
      title: 'asyncio rules',
      tag: 'recap',
      body: [
        '- **One thread,** switches only at `await`.',
        '- **Sequential awaits** add up, tasks overlap.',
        '- **TaskGroup:** failure cancels the siblings.',
        '- **Blocking calls** freeze every task.',
        '- **Best for:** many I/O-bound tasks.',
      ],
      keyIdea: 'Anything that blocks without awaiting stops the whole loop.',
      frames: [{ state: view(GATHER, { text: 'overlapping waits on one thread is the whole point', tone: 'accent' }, [{ label: 'Sequential', value: `${SEQ.end / S} s` }, { label: 'gather', value: `${GATHER.end / S} s`, tone: 'ok' }, { label: 'Blocking', value: `${BLOCKED.end / S} s`, tone: 'bad' }]) }],
    },
  ],
});
