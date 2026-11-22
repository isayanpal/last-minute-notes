import { defineLesson } from '../define';
import type { GridState } from '../engines/grid';
import type { ItemState } from '../engines/common';

/*
 * Follows the OS notes on the Banker's algorithm with the notes' table: 5 processes, 3 resource types (10, 5, 7 instances),
 * Available (3, 3, 2). A real safety check runs on it and reproduces the safe sequence P1, P3, P0, P2, P4. A real request check
 * then pretends to grant a request and re-runs the safety check.
 */

type Vec = [number, number, number];
const ALLOC: Vec[] = [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]];
const MAX: Vec[] = [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]];
const AVAILABLE: Vec = [3, 3, 2];
const NEED = (alloc: Vec[], max: Vec[]): Vec[] => alloc.map((a, i) => a.map((x, k) => max[i][k] - x) as Vec);
const fits = (need: Vec, work: Vec) => need.every((n, k) => n <= work[k]);
const add = (a: Vec, b: Vec): Vec => a.map((x, k) => x + b[k]) as Vec;
const fmt = (v: Vec) => v.join(' ');

type StepRec = { pick: number; need: Vec; workBefore: Vec; workAfter: Vec };
function safety(alloc: Vec[], max: Vec[], available: Vec): { safe: boolean; sequence: number[]; steps: StepRec[] } {
  const need = NEED(alloc, max);
  let work = [...available] as Vec;
  const finished = new Set<number>();
  const steps: StepRec[] = [];
  let progress = true;
  while (progress && finished.size < alloc.length) {
    progress = false;
    for (let i = 0; i < alloc.length; i++) {
      if (finished.has(i) || !fits(need[i], work)) continue;
      const after = add(work, alloc[i]);
      steps.push({ pick: i, need: need[i], workBefore: work, workAfter: after });
      work = after;
      finished.add(i);
      progress = true;
      break; // restart the scan so the order is deterministic, like the notes
    }
  }
  return { safe: finished.size === alloc.length, sequence: steps.map((s) => s.pick), steps };
}

const BASE = safety(ALLOC, MAX, AVAILABLE);

type State = { alloc: Vec[]; avail: Vec };
const START: State = { alloc: ALLOC, avail: AVAILABLE };

/** Pretend to grant a request, then run the safety check on the result. Returns the new state when it is granted. */
function request(st: State, i: number, req: Vec): { granted: boolean; reason: string; state: State } {
  const need = NEED(st.alloc, MAX);
  if (!fits(req, need[i])) return { granted: false, reason: 'asks above its need', state: st };
  if (!fits(req, st.avail)) return { granted: false, reason: 'not available', state: st };
  const alloc = st.alloc.map((a, k) => (k === i ? add(a, req) : a));
  const avail = st.avail.map((x, k) => x - req[k]) as Vec;
  const s = safety(alloc, MAX, avail);
  return s.safe ? { granted: true, reason: 'state stays safe', state: { alloc, avail } } : { granted: false, reason: 'state would be unsafe', state: st };
}
const REQ_OK = request(START, 1, [1, 0, 2]); // the classic safe request
const REQ_BAD = request(REQ_OK.state, 0, [0, 2, 0]); // after P1 holds more, this leaves no safe order

const paint = (f: (r: number, c: number) => ItemState): Record<string, ItemState> => {
  const out: Record<string, ItemState> = {};
  for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) out[`${r},${c}`] = f(r, c);
  return out;
};

const NEEDS = NEED(ALLOC, MAX);
const table = (k: number, note: GridState['note'], panelExtra?: string[]): GridState => {
  const done = new Set(BASE.sequence.slice(0, k));
  const cur = k > 0 ? BASE.sequence[k - 1] : -1;
  const work = k === 0 ? AVAILABLE : BASE.steps[k - 1].workAfter;
  return {
    title: 'allocation | need',
    colHeaders: ['A', 'B', 'C', 'A', 'B', 'C'],
    rowHeaders: ['P0', 'P1', 'P2', 'P3', 'P4'],
    cells: ALLOC.map((a, i) => [...a, ...NEEDS[i]]),
    states: paint((r, c) => (r === cur ? 'active' : done.has(r) ? 'done' : c < 3 ? 'visited' : 'normal')),
    panels: [{ title: 'work', kind: 'list', items: [`Work ${fmt(work)}`, ...(k > 0 ? [`picked P${cur}`] : []), ...(panelExtra ?? [])], highlight: 0 }],
    stats: [
      { label: 'Work', value: fmt(work) },
      { label: 'Finished', value: `${done.size} of 5`, tone: done.size === 5 ? 'ok' : 'neutral' },
      { label: 'Order so far', value: BASE.sequence.slice(0, k).map((i) => `P${i}`).join(' ') || '-' },
    ],
    note,
  };
};

const reqView = (label: string, req: { granted: boolean; reason: string }, st: State, who: string, vec: Vec): GridState => ({
  title: 'allocation | need',
  colHeaders: ['A', 'B', 'C', 'A', 'B', 'C'],
  rowHeaders: ['P0', 'P1', 'P2', 'P3', 'P4'],
  cells: st.alloc.map((a, i) => [...a, ...NEED(st.alloc, MAX)[i]]),
  states: paint((r) => (`P${r}` === who ? (req.granted ? 'found' : 'bad') : 'normal')),
  panels: [{ title: 'request', kind: 'list', items: [`${who} asks ${fmt(vec)}`, req.granted ? 'GRANT' : 'DENY'], highlight: 1 }],
  stats: [
    { label: 'Request', value: `${who}: ${fmt(vec)}` },
    { label: 'After granting', value: req.granted ? 'safe' : 'unsafe', tone: req.granted ? 'ok' : 'bad' },
    { label: 'Decision', value: req.granted ? 'grant' : 'deny', tone: req.granted ? 'ok' : 'bad' },
  ],
  note: { text: label, tone: req.granted ? 'ok' : 'bad' },
});

export default defineLesson('grid', {
  slug: 'os-banker',
  objectives: [
    { text: 'What allocation, need and available mean', step: 1 },
    { text: 'How the safety check finds a safe sequence', step: 2 },
    { text: 'Why a request is only granted if the state stays safe', step: 3 },
    { text: 'Why an unsafe state is not yet a deadlock', step: 4 },
  ],
  steps: [
    {
      label: 'The table',
      title: 'Who holds what, who needs what',
      tag: 'problem',
      body: ['Five processes share three resource types with 10, 5 and 7 instances. **Allocation** is what each holds, **Need** is what it may still ask for.', '**Available** is what is free right now: 3, 3, 2.'],
      keyIdea: 'Need = Max - Allocation. Avoidance requires max demands in advance.',
      frames: [{ state: table(0, { text: 'Work starts as Available = 3 3 2', tone: 'accent' }), hold: 4200 }],
    },
    {
      label: 'Safety check',
      title: 'Find a safe order',
      tag: 'technique',
      body: ['Repeatedly find a process whose **Need fits in Work**, pretend it finishes, and add its allocation back to Work.', 'If every process can finish this way, the state is safe.'],
      keyIdea: 'A safe sequence is a proof that everyone can finish.',
      frames: [1, 2, 3, 4, 5].map((k) => ({ state: table(k, { text: `P${BASE.sequence[k - 1]} need ${fmt(BASE.steps[k - 1].need)} fits in ${fmt(BASE.steps[k - 1].workBefore)}, so Work becomes ${fmt(BASE.steps[k - 1].workAfter)}`, tone: 'ok' }), hold: k === 5 ? 3800 : 1700 })),
    },
    {
      label: 'Requests',
      title: 'Grant only if still safe',
      tag: 'concept',
      body: ['When a process asks for resources, pretend to grant them and run the safety check on the result.', 'If a safe sequence still exists the request is granted, otherwise it waits.'],
      keyIdea: 'The algorithm never leaves the safe region.',
      frames: [{ state: reqView(`P1 asking 1 0 2: ${REQ_OK.reason}, so it is granted`, REQ_OK, START, 'P1', [1, 0, 2]), hold: 4200 }, { state: reqView(`P0 asking 0 2 0 next: ${REQ_BAD.reason}, so it is denied`, REQ_BAD, REQ_OK.state, 'P0', [0, 2, 0]), hold: 4600 }],
    },
    {
      label: 'Unsafe',
      title: 'Unsafe is not deadlocked',
      tag: 'trade-off',
      body: ['An unsafe state is not necessarily a deadlock. It only means the OS can no longer **guarantee** avoiding one.', 'Because it needs maximum demands up front, the Banker\'s algorithm is rare in practice.'],
      keyIdea: 'Real systems prefer lock ordering, or detect and recover.',
      frames: [{ state: reqView('denying the request keeps the system in the safe region', REQ_BAD, REQ_OK.state, 'P0', [0, 2, 0]), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'Banker\'s algorithm',
      tag: 'recap',
      body: [
        '- **Need:** Max minus Allocation.',
        '- **Safety check:** pick a process whose Need fits Work, release its allocation.',
        `- **Safe sequence here:** ${BASE.sequence.map((i) => `P${i}`).join(', ')}.`,
        '- **Request:** pretend to grant, then check safety.',
        '- **Cost:** needs maximum demands in advance.',
      ],
      keyIdea: 'Avoidance checks every request, prevention designs the cycle away.',
      frames: [{ state: table(5, { text: `safe sequence: ${BASE.sequence.map((i) => `P${i}`).join(', ')}`, tone: 'ok' }) }],
    },
  ],
});
