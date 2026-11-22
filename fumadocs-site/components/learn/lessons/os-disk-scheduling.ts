import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the OS notes on disk scheduling with the notes' queue: head at cylinder 53, requests 98 183 37 122 14 124 65 67,
 * cylinders 0 to 199. Real FCFS, SSTF, SCAN and C-SCAN schedulers produce the service order and the head movement,
 * so 640, 236, 236 and 382 are computed.
 */

const HEAD = 53;
const REQS = [98, 183, 37, 122, 14, 124, 65, 67];
const MAX_CYL = 199;

type Plan = { order: (number | string)[]; moves: number[]; edges: number[]; total: number };
const plan = (visits: { at: number; edge?: boolean }[]): Plan => {
  let pos = HEAD;
  const moves = visits.map((v) => {
    const d = Math.abs(v.at - pos);
    pos = v.at;
    return d;
  });
  return { order: visits.map((v) => v.at), moves, edges: visits.map((v, i) => (v.edge ? i : -1)).filter((i) => i >= 0), total: moves.reduce((a, b) => a + b, 0) };
};

const fcfs = () => plan(REQS.map((at) => ({ at })));
const sstf = () => {
  const left = [...REQS];
  let pos = HEAD;
  const out: { at: number }[] = [];
  while (left.length) {
    left.sort((a, b) => Math.abs(a - pos) - Math.abs(b - pos));
    pos = left.shift()!;
    out.push({ at: pos });
  }
  return plan(out);
};
const scan = () => {
  const below = REQS.filter((r) => r < HEAD).sort((a, b) => b - a);
  const above = REQS.filter((r) => r > HEAD).sort((a, b) => a - b);
  return plan([...below.map((at) => ({ at })), { at: 0, edge: true }, ...above.map((at) => ({ at }))]);
};
const cscan = () => {
  const below = REQS.filter((r) => r < HEAD).sort((a, b) => a - b);
  const above = REQS.filter((r) => r > HEAD).sort((a, b) => a - b);
  return plan([...above.map((at) => ({ at })), { at: MAX_CYL, edge: true }, { at: 0, edge: true }, ...below.map((at) => ({ at }))]);
};
const PLANS = { FCFS: fcfs(), SSTF: sstf(), SCAN: scan(), 'C-SCAN': cscan() };
const NO_RETURN = PLANS['C-SCAN'].total - MAX_CYL; // without counting the jump back from 199 to 0

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const view = (name: keyof typeof PLANS, shown: number, note: ArrayState['note']): ArrayState => {
  const p = PLANS[name];
  const n = p.order.length;
  const moved = p.moves.slice(0, shown).reduce((a, b) => a + b, 0);
  return {
    rows: [
      { label: 'served', cells: p.order.map((v, i) => (i < shown ? v : '')), states: paint(n, (i) => (i >= shown ? 'dim' : p.edges.includes(i) ? 'swap' : i === shown - 1 ? 'active' : 'done')), showIndex: false },
      { label: 'moved', cells: p.moves.map((v, i) => (i < shown ? v : '')), states: paint(n, (i) => (i >= shown ? 'dim' : 'visited')), showIndex: false },
    ],
    stats: [
      { label: 'Algorithm', value: name },
      { label: 'Head moves', value: String(moved), tone: shown === n ? (p.total > 400 ? 'bad' : 'ok') : 'neutral' },
      { label: 'Start', value: `cyl ${HEAD}` },
    ],
    note,
  };
};

export default defineLesson('array', {
  slug: 'os-disk-scheduling',
  objectives: [
    { text: 'Why request order changes head movement', step: 1 },
    { text: 'How SSTF cuts the distance and what it risks', step: 2 },
    { text: 'How the elevator (SCAN) sweeps', step: 3 },
    { text: 'How C-SCAN gives uniform waits', step: 4 },
  ],
  steps: [
    {
      label: 'FCFS',
      title: 'In arrival order',
      tag: 'problem',
      body: ['On an HDD the head must travel to each cylinder. The head starts at 53 and the queue is `98 183 37 122 14 124 65 67`.', 'Serving them in arrival order makes the head zigzag across the disk.'],
      keyIdea: 'Seek distance is the cost, and order decides it.',
      frames: [{ state: view('FCFS', 4, { text: 'it jumps from 98 to 183, then back to 37: long seeks', tone: 'accent' }), hold: 2600 }, { state: view('FCFS', 8, { text: `FCFS moves ${PLANS.FCFS.total} cylinders in total`, tone: 'bad' }), hold: 4000 }],
    },
    {
      label: 'SSTF',
      title: 'Shortest seek first',
      tag: 'technique',
      body: ['SSTF always serves the **nearest** request next.', `It cuts the movement to ${PLANS.SSTF.total}, but far requests can wait a long time while nearer ones keep arriving.`],
      keyIdea: 'SSTF can starve far requests.',
      frames: [{ state: view('SSTF', 8, { text: `SSTF moves ${PLANS.SSTF.total} cylinders, nearly a third of FCFS`, tone: 'ok' }), hold: 4400 }],
    },
    {
      label: 'SCAN',
      title: 'The elevator',
      tag: 'technique',
      body: ['SCAN sweeps in one direction serving requests, goes to the end of the disk, then reverses. Here it goes toward 0 first.', 'Wait times are more uniform than SSTF.'],
      keyIdea: 'LOOK is SCAN that turns at the last request instead of the disk end.',
      frames: [{ state: view('SCAN', 9, { text: `SCAN reaches cylinder 0, then sweeps up: ${PLANS.SCAN.total} cylinders`, tone: 'ok' }), hold: 4400 }],
    },
    {
      label: 'C-SCAN',
      title: 'One direction only',
      tag: 'trade-off',
      body: ['C-SCAN serves requests in one direction, then jumps back to the start and sweeps again.', `Counting the return jump it moves ${PLANS['C-SCAN'].total}, or ${NO_RETURN} without it.`],
      keyIdea: 'Every request waits about the same, at the price of the return trip.',
      frames: [{ state: view('C-SCAN', 10, { text: `${PLANS['C-SCAN'].total} with the return jump, ${NO_RETURN} without it`, tone: 'accent' }), hold: 4600 }],
    },
    {
      label: 'Recap',
      title: 'Disk scheduling',
      tag: 'recap',
      body: [
        `- **FCFS:** ${PLANS.FCFS.total} cylinders, simple and unfair to distance.`,
        `- **SSTF:** ${PLANS.SSTF.total}, can starve far requests.`,
        `- **SCAN:** ${PLANS.SCAN.total}, uniform waits.`,
        `- **C-SCAN:** ${PLANS['C-SCAN'].total}, even waits, one direction.`,
        '- **Today:** `none` for NVMe, `mq-deadline` for SATA and HDD.',
      ],
      keyIdea: 'SSDs have no head, so ordering matters far less.',
      frames: [{ state: view('SSTF', 8, { text: 'same eight requests, four very different distances', tone: 'accent' }) }],
    },
  ],
});
