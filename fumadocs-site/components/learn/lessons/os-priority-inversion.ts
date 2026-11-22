import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the OS notes on priority scheduling: priority inversion happens when a high priority task waits on a lock held by a low
 * priority task while a medium priority task keeps the low one from running, and priority inheritance fixes it. A tick-by-tick
 * priority scheduler runs the three tasks with and without inheritance. The task lengths and the deadline are EXAMPLE values.
 */

type Task = { name: 'High' | 'Medium' | 'Low'; prio: number; arrival: number; burst: number; usesLock: boolean };
const TASKS: Task[] = [
  { name: 'Low', prio: 1, arrival: 0, burst: 6, usesLock: true }, // holds the lock for its first 5 ticks
  { name: 'High', prio: 3, arrival: 2, burst: 3, usesLock: true }, // needs the lock before it can run
  { name: 'Medium', prio: 2, arrival: 3, burst: 8, usesLock: false },
];
const CRITICAL = 5; // ticks Low spends inside the critical section
const DEADLINE = 10;

type Seg = { name: Task['name']; kind: 'run' | 'blocked'; from: number; to: number };

function simulate(inherit: boolean): { segs: Seg[]; done: Record<string, number> } {
  const rem = Object.fromEntries(TASKS.map((t) => [t.name, t.burst])) as Record<string, number>;
  const ranLow = { n: 0 };
  let lockHolder: string | null = null;
  const lockDone = { v: false };
  const ticks: { name: Task['name']; kind: 'run' | 'blocked' }[][] = [];
  const done: Record<string, number> = {};
  for (let t = 0; t < 40 && Object.keys(done).length < TASKS.length; t++) {
    const arrived = TASKS.filter((x) => x.arrival <= t && rem[x.name] > 0);
    const blocked = (x: Task) => x.name === 'High' && lockHolder !== 'High' && (lockHolder !== null || !lockDone.v) && lockHolder === 'Low';
    const eff = (x: Task) => (inherit && x.name === 'Low' && arrived.some((a) => a.name === 'High' && blocked(a)) ? 3 : x.prio);
    const runnable = arrived.filter((x) => !blocked(x));
    // Low takes the lock the first time it runs
    const pick = [...runnable].sort((a, b) => eff(b) - eff(a) || a.arrival - b.arrival)[0];
    const row: { name: Task['name']; kind: 'run' | 'blocked' }[] = [];
    for (const x of arrived) if (blocked(x)) row.push({ name: x.name, kind: 'blocked' });
    if (pick) {
      if (pick.name === 'Low' && lockHolder === null && !lockDone.v) lockHolder = 'Low';
      if (pick.name === 'High' && lockHolder === null) lockHolder = 'High';
      row.push({ name: pick.name, kind: 'run' });
      rem[pick.name]--;
      if (pick.name === 'Low') {
        ranLow.n++;
        if (ranLow.n === CRITICAL) {
          lockHolder = null;
          lockDone.v = true;
        }
      }
      if (pick.name === 'High' && rem.High === 0) lockHolder = null;
      if (rem[pick.name] === 0) done[pick.name] = t + 1;
    }
    ticks.push(row);
  }
  // merge ticks into segments
  const segs: Seg[] = [];
  ticks.forEach((row, t) => {
    for (const r of row) {
      const last = [...segs].reverse().find((s) => s.name === r.name && s.kind === r.kind);
      if (last && last.to === t) last.to = t + 1;
      else segs.push({ name: r.name, kind: r.kind, from: t, to: t + 1 });
    }
  });
  return { segs, done };
}

const PLAIN = simulate(false);
const INHERIT = simulate(true);
const TONE: Record<Task['name'], TimelineBar['tone']> = { High: 'pink', Medium: 'info', Low: 'data' };

const lanes = (sim: ReturnType<typeof simulate>, until: number, tag: string, suffix = ''): TimelineState['lanes'] =>
  (['High', 'Medium', 'Low'] as const).map((name) => ({
    label: `${name}${suffix}`,
    bars: sim.segs
      .filter((s) => s.name === name && s.from < until)
      .map((s, i): TimelineBar => ({ id: `${tag}-${name}-${s.kind}-${i}`, from: s.from, to: Math.min(s.to, until), label: s.kind === 'blocked' ? 'blocked' : undefined, tone: s.kind === 'blocked' ? 'neutral' : TONE[name], state: s.kind === 'blocked' ? 'dim' : 'normal' })),
  }));

const end = (sim: ReturnType<typeof simulate>) => Math.max(...Object.values(sim.done));
const view = (opts: { mode: 'plain' | 'inherit' | 'both'; until?: number; note: TimelineState['note']; deadline?: boolean }): TimelineState => {
  const span = Math.max(end(PLAIN), end(INHERIT));
  const until = opts.until ?? span;
  const sims = opts.mode === 'plain' ? [[PLAIN, 'plain', '']] : opts.mode === 'inherit' ? [[INHERIT, 'inh', '']] : [[PLAIN, 'plain', ' (none)'], [INHERIT, 'inh', ' (inherit)']];
  const hp = PLAIN.done.High;
  const hi = INHERIT.done.High;
  const both = opts.mode === 'both';
  return {
    from: 0,
    to: span,
    unit: 't',
    ticks: Array.from({ length: Math.floor(span / 4) + 1 }, (_, i) => i * 4),
    lanes: sims.flatMap(([sim, tag, suffix]) => lanes(sim as ReturnType<typeof simulate>, until, tag as string, both ? (suffix as string) : '')),
    markers: opts.deadline ? [{ at: DEADLINE, label: 'deadline 10', tone: 'bad' }] : undefined,
    stats: [
      { label: 'High done at', value: opts.mode === 'inherit' ? `t ${hi}` : opts.mode === 'plain' ? (until >= hp ? `t ${hp}` : '-') : `${hp} vs ${hi}`, tone: opts.mode === 'inherit' ? 'ok' : until >= hp ? 'bad' : 'neutral' },
      { label: 'Lock held by', value: 'Low' },
      { label: 'Deadline', value: opts.deadline ? `t ${DEADLINE}` : '-' },
    ],
    note: opts.note,
  };
};

export default defineLesson('timeline', {
  slug: 'os-priority-inversion',
  objectives: [
    { text: 'How a low priority task can block a high priority one', step: 1 },
    { text: 'Why a medium priority task makes it worse', step: 2 },
    { text: 'How priority inheritance fixes it', step: 3 },
    { text: 'How much it changes the high priority finish time', step: 4 },
  ],
  steps: [
    {
      label: 'The lock',
      title: 'High waits on Low',
      tag: 'problem',
      body: ['`Low` takes a lock first. When `High` arrives at t=2 it needs that lock, so it is **blocked** even though it has the top priority.', 'Waiting for a lower priority task is already surprising, and it is about to get worse.'],
      keyIdea: 'Priority only decides who runs among the tasks that can run.',
      frames: [{ state: view({ mode: 'plain', until: 3, note: { text: 'High is blocked at t=2 because Low holds the lock', tone: 'accent' } }), hold: 3800 }],
    },
    {
      label: 'Inversion',
      title: 'Medium jumps ahead',
      tag: 'concept',
      body: ['At t=3 `Medium` arrives. It outranks `Low`, so it runs, and `Low` cannot finish its critical section.', 'That keeps `High` blocked for as long as `Medium` runs: **priority inversion**.'],
      keyIdea: 'A medium priority task effectively runs ahead of the high priority one.',
      frames: [{ state: view({ mode: 'plain', deadline: true, note: { text: `High finishes at t=${PLAIN.done.High}, long after its deadline`, tone: 'bad' } }), hold: 4600 }],
    },
    {
      label: 'Inheritance',
      title: 'Lend the priority',
      tag: 'technique',
      body: ['With **priority inheritance**, the lock holder temporarily takes the waiter\'s priority. `Low` now outranks `Medium`.', 'It finishes the critical section, releases the lock, and `High` runs.'],
      keyIdea: 'The inherited priority is dropped when the lock is released.',
      frames: [{ state: view({ mode: 'inherit', deadline: true, note: { text: `High finishes at t=${INHERIT.done.High}, inside its deadline`, tone: 'ok' } }), hold: 4600 }],
    },
    {
      label: 'Compare',
      title: 'Same tasks, two outcomes',
      tag: 'in practice',
      body: ['Priority inversion repeatedly reset the **Mars Pathfinder** lander in 1997. It was fixed remotely by enabling priority inheritance on a mutex.', 'Mutexes support it, semaphores usually do not.'],
      keyIdea: 'Use a mutex, not a binary semaphore, when the lock protects shared state.',
      frames: [{ state: view({ mode: 'both', deadline: true, note: { text: `High completes at ${PLAIN.done.High} without inheritance and ${INHERIT.done.High} with it`, tone: 'accent' } }), hold: 5000 }],
    },
    {
      label: 'Recap',
      title: 'Priority inversion',
      tag: 'recap',
      body: [
        '- **Inversion:** high waits on a lock held by low.',
        '- **Medium task:** keeps the low task off the CPU.',
        '- **Priority inheritance:** the holder inherits the waiter\'s priority.',
        '- **Related:** starvation is fixed with aging.',
        '- **Real case:** Mars Pathfinder, 1997.',
      ],
      keyIdea: 'Locks and priorities interact, so design them together.',
      frames: [{ state: view({ mode: 'both', deadline: true, note: { text: 'inheritance removes the wait that the medium task caused', tone: 'ok' } }) }],
    },
  ],
});
