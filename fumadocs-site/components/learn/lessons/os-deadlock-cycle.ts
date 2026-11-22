import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the OS notes on deadlock: a cycle in the wait-for graph means deadlock, and a global lock order removes the cycle.
 * Two threads and two locks run through a real round-robin lock simulator, and a real cycle detector decides when it is a deadlock.
 * The tryLock variant backs off when blocked, which breaks no-preemption.
 */

type T = 'T1' | 'T2';
type L = 'A' | 'B';
type Snap = { holds: Partial<Record<L, T>>; waits: Partial<Record<T, L>>; done: T[]; deadlock: boolean; what: string; actor: T; lock?: L; kind: 'take' | 'wait' | 'finish' | 'backoff' };

function simulate(orders: Record<T, L[]>, tryLock = false): Snap[] {
  const holds: Partial<Record<L, T>> = {};
  const waits: Partial<Record<T, L>> = {};
  const idx: Record<T, number> = { T1: 0, T2: 0 };
  const done: T[] = [];
  const snaps: Snap[] = [];
  const release = (t: T) => {
    for (const l of ['A', 'B'] as L[]) if (holds[l] === t) delete holds[l];
  };
  const cycle = () => {
    // wait-for graph: t -> holder of the lock t waits for
    for (const start of ['T1', 'T2'] as T[]) {
      let cur: T | undefined = start;
      const seen = new Set<T>();
      while (cur && waits[cur]) {
        const next: T | undefined = holds[waits[cur]!];
        if (!next) break;
        if (next === start) return true;
        if (seen.has(next)) break;
        seen.add(next);
        cur = next;
      }
    }
    return false;
  };
  for (let round = 0; round < 8; round++) {
    for (const t of ['T1', 'T2'] as T[]) {
      if (done.includes(t)) continue;
      const want = orders[t][idx[t]];
      let what: string;
      let kind: Snap['kind'];
      if (!holds[want]) {
        holds[want] = t;
        delete waits[t];
        idx[t]++;
        what = `${t} takes ${want}`;
        kind = 'take';
        if (idx[t] === orders[t].length) {
          release(t);
          done.push(t);
          what = `${t} finishes`;
          kind = 'finish';
        }
      } else if (tryLock) {
        release(t); // tryLock fails at once: give back what we hold and retry later
        delete waits[t];
        idx[t] = 0;
        what = `${t} backs off`;
        kind = 'backoff';
      } else {
        waits[t] = want;
        what = `${t} waits for ${want}`;
        kind = 'wait';
      }
      snaps.push({ holds: { ...holds }, waits: { ...waits }, done: [...done], deadlock: cycle(), what, actor: t, lock: kind === 'take' || kind === 'wait' ? want : undefined, kind });
      if (snaps[snaps.length - 1].deadlock) return snaps;
    }
    if (done.length === 2) return snaps;
  }
  return snaps;
}

const BAD = simulate({ T1: ['A', 'B'], T2: ['B', 'A'] });
const ORDERED = simulate({ T1: ['A', 'B'], T2: ['A', 'B'] });
const TRY = simulate({ T1: ['A', 'B'], T2: ['B', 'A'] }, true);

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.5 });
const POS: Record<string, { x: number; y: number }> = { T1: { x: 0.3, y: 0.4 }, T2: { x: 5.5, y: 0.4 }, A: { x: 0.3, y: 3.0 }, B: { x: 5.5, y: 3.0 } };

const view = (sims: Snap[], k: number, label: string): FlowState => {
  const s = sims[k - 1];
  const held = (t: T) => (['A', 'B'] as L[]).filter((l) => s.holds[l] === t);
  const nodes: FlowNode[] = [
    ...(['T1', 'T2'] as T[]).map((t): FlowNode => ({ id: t, label: t === 'T1' ? 'Thread 1' : 'Thread 2', sub: s.done.includes(t) ? 'finished' : s.waits[t] ? `waits for ${s.waits[t]}` : 'running', kind: 'worker', ...POS[t], status: s.done.includes(t) ? 'dim' : s.waits[t] ? 'hot' : 'active', items: held(t).map((l) => `holds ${l}`) })),
    ...(['A', 'B'] as L[]).map((l): FlowNode => ({ id: l, label: `Lock ${l}`, sub: s.holds[l] ? `held by ${s.holds[l]}` : 'free', kind: 'db', ...POS[l], status: s.holds[l] ? 'active' : 'normal' })),
  ];
  const links = [
    ...(['A', 'B'] as L[]).flatMap((l) => (s.holds[l] ? [{ from: s.holds[l]!, to: l, label: 'holds' }] : [])),
    ...(['T1', 'T2'] as T[]).flatMap((t) => (s.waits[t] ? [{ from: t, to: s.waits[t]!, dashed: true, label: 'waits' }] : [])),
  ];
  return {
    nodes,
    links,
    packets: s.lock ? [hop(s.actor, s.lock, s.kind === 'take' ? 'acquire' : 'blocked', 0, s.kind === 'take' ? 'ok' : 'bad')] : [],
    stats: [
      { label: 'Action', value: s.what },
      { label: 'Cycle', value: s.deadlock ? 'yes' : 'no', tone: s.deadlock ? 'bad' : 'ok' },
      { label: 'Finished', value: `${s.done.length} of 2`, tone: s.done.length === 2 ? 'ok' : 'neutral' },
    ],
    note: s.deadlock ? { text: `${label}: T1 waits for T2 and T2 waits for T1, a cycle with no way out`, tone: 'bad' } : s.done.length === 2 ? { text: 'both threads finished: no cycle ever formed', tone: 'ok' } : { text: s.what, tone: 'accent' },
  };
};

export default defineLesson('flow', {
  slug: 'os-deadlock-cycle',
  objectives: [
    { text: 'How two threads can each hold what the other needs', step: 1 },
    { text: 'How a wait-for cycle shows a deadlock', step: 2 },
    { text: 'How a global lock order removes the cycle', step: 3 },
    { text: 'How tryLock breaks no-preemption', step: 4 },
  ],
  steps: [
    {
      label: 'Two locks',
      title: 'Opposite orders',
      tag: 'problem',
      body: ['Thread 1 takes lock A then B. Thread 2 takes B then A.', 'Each grabs its first lock before the other has finished, which sets up a deadlock.'],
      keyIdea: 'A deadlock needs mutual exclusion, hold and wait, no preemption and circular wait, all at once.',
      frames: [1, 2].map((k) => ({ state: view(BAD, k, 'opposite order'), hold: 2400 })),
    },
    {
      label: 'Cycle',
      title: 'The wait-for cycle',
      tag: 'concept',
      body: ['Each thread now waits for a lock the other holds. In the **wait-for graph** that is a cycle: T1 to T2 to T1.', 'With one instance per resource, a cycle means deadlock.'],
      keyIdea: 'Detection means finding cycles, recovery means killing or rolling back a victim.',
      frames: [3, 4].map((k) => ({ state: view(BAD, Math.min(k, BAD.length), 'opposite order'), hold: k === 4 ? 4200 : 2400 })),
    },
    {
      label: 'Ordering',
      title: 'One global lock order',
      tag: 'technique',
      body: ['If both threads take A first, then B, the second thread simply waits for A. No cycle can form.', 'This breaks **circular wait**, and it is the most practical fix in application code.'],
      keyIdea: 'Document a global order, for example by account id when transferring money.',
      frames: ORDERED.map((_, i) => ({ state: view(ORDERED, i + 1, 'same order'), hold: i + 1 === ORDERED.length ? 3800 : 1500 })),
    },
    {
      label: 'tryLock',
      title: 'Back off instead of waiting',
      tag: 'trade-off',
      body: ['When ordering is impossible, use `tryLock` with a timeout. A thread that cannot get its second lock releases the first and retries.', 'That breaks **no preemption**.'],
      keyIdea: 'Watch for livelock: use randomised backoff so both do not retry in lockstep.',
      frames: TRY.slice(0, 6).map((_, i) => ({ state: view(TRY, i + 1, 'with tryLock'), hold: i === 5 ? 3400 : 1500 })),
    },
    {
      label: 'Recap',
      title: 'Deadlock',
      tag: 'recap',
      body: [
        '- **Four conditions:** mutual exclusion, hold and wait, no preemption, circular wait.',
        '- **Detection:** a cycle in the wait-for graph.',
        '- **Prevention:** global lock ordering.',
        '- **Avoidance:** Banker\'s algorithm, rarely used.',
        '- **Diagnosis:** thread dumps.',
      ],
      keyIdea: 'Break any one condition and deadlock cannot happen.',
      frames: [{ state: view(BAD, BAD.length, 'opposite order') }],
    },
  ],
});
