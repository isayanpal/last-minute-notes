import { defineLesson } from '../define';
import type { GridState } from '../engines/grid';
import type { ItemState } from '../engines/common';

/*
 * Follows the OS notes on page replacement with the notes' reference string 7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1 and 3 frames.
 * Real FIFO, LRU and Optimal simulators produce every frame state, so the fault counts (15, 12, 9) and Belady's anomaly
 * (FIFO on 1 2 3 4 1 2 5 1 2 3 4 5: 9 faults with 3 frames, 10 with 4) are computed.
 */

type Algo = 'FIFO' | 'LRU' | 'OPT';
type Column = { ref: number; slots: (number | null)[]; fault: boolean; changed: number };

function run(algo: Algo, refs: number[], frames: number): { cols: Column[]; faults: number } {
  const slots: (number | null)[] = Array(frames).fill(null);
  const loadedAt: Record<number, number> = {};
  const usedAt: Record<number, number> = {};
  const cols: Column[] = [];
  refs.forEach((ref, t) => {
    let changed = -1;
    let fault = false;
    if (!slots.includes(ref)) {
      fault = true;
      let target = slots.indexOf(null);
      if (target === -1) {
        const resident = slots as number[];
        if (algo === 'FIFO') target = slots.indexOf(resident.reduce((a, b) => (loadedAt[a] <= loadedAt[b] ? a : b)));
        else if (algo === 'LRU') target = slots.indexOf(resident.reduce((a, b) => (usedAt[a] <= usedAt[b] ? a : b)));
        else {
          const nextUse = (p: number) => {
            const i = refs.indexOf(p, t + 1);
            return i === -1 ? Infinity : i;
          };
          target = slots.indexOf(resident.reduce((a, b) => (nextUse(a) >= nextUse(b) ? a : b)));
        }
      }
      slots[target] = ref;
      loadedAt[ref] = t;
      changed = target;
    }
    usedAt[ref] = t;
    cols.push({ ref, slots: [...slots], fault, changed });
  });
  return { cols, faults: cols.filter((c) => c.fault).length };
}

const REFS = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
const BELADY = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
const R = { FIFO: run('FIFO', REFS, 3), LRU: run('LRU', REFS, 3), OPT: run('OPT', REFS, 3) };
const B3 = run('FIFO', BELADY, 3);
const B4 = run('FIFO', BELADY, 4);

const view = (res: ReturnType<typeof run>, frames: number, shown: number, title: string, note: GridState['note']): GridState => {
  const n = res.cols.length;
  const rows = frames + 1;
  const cells: (string | number | null)[][] = Array.from({ length: rows }, (_, r) =>
    res.cols.map((c, k) => (k >= shown ? null : r < frames ? c.slots[r] : c.fault ? 'F' : '')),
  );
  const states: Record<string, ItemState> = {};
  res.cols.forEach((c, k) => {
    if (k >= shown) return;
    for (let r = 0; r < frames; r++) states[`${r},${k}`] = c.changed === r ? 'active' : c.slots[r] === null ? 'dim' : 'done';
    states[`${frames},${k}`] = c.fault ? 'bad' : 'dim';
  });
  const faults = res.cols.slice(0, shown).filter((c) => c.fault).length;
  return {
    title,
    colHeaders: res.cols.map((c) => String(c.ref)),
    rowHeaders: [...Array.from({ length: frames }, (_, i) => `f${i + 1}`), 'fault'],
    cells,
    states,
    stats: [
      { label: 'Faults', value: `${faults}${shown < n ? ` of ${shown}` : ''}`, tone: shown === n ? (faults > 12 ? 'bad' : 'ok') : 'neutral' },
      { label: 'Hits', value: String(shown - faults) },
      { label: 'References', value: `${shown} of ${n}` },
    ],
    note,
  };
};

export default defineLesson('grid', {
  slug: 'os-page-replacement',
  objectives: [
    { text: 'How FIFO picks a victim and what it costs', step: 1 },
    { text: 'How LRU uses recent history', step: 2 },
    { text: 'What the Optimal algorithm shows', step: 3 },
    { text: 'What Belady\'s anomaly is', step: 4 },
  ],
  steps: [
    {
      label: 'FIFO',
      title: 'Evict the oldest page',
      tag: 'problem',
      body: ['When RAM is full the OS must evict a page. **FIFO** removes the page that has been loaded the longest.', 'On the reference string below, with 3 frames, it faults 15 times in 20 references.'],
      keyIdea: 'Age since loading says nothing about whether the page is still useful.',
      frames: [{ state: view(R.FIFO, 3, 9, 'FIFO, 3 frames', { text: 'yellow cells are pages just loaded, F marks every fault', tone: 'accent' }), hold: 3200 }, { state: view(R.FIFO, 3, 20, 'FIFO, 3 frames', { text: `FIFO: ${R.FIFO.faults} faults`, tone: 'bad' }), hold: 4000 }],
    },
    {
      label: 'LRU',
      title: 'Evict the least recently used',
      tag: 'technique',
      body: ['**LRU** evicts the page unused for the longest time, betting on locality of reference.', 'The same string now faults 12 times.'],
      keyIdea: 'Exact LRU is too expensive, so real systems approximate it with the accessed bit and a clock hand.',
      frames: [{ state: view(R.LRU, 3, 20, 'LRU, 3 frames', { text: `LRU: ${R.LRU.faults} faults`, tone: 'ok' }), hold: 4400 }],
    },
    {
      label: 'Optimal',
      title: 'The benchmark',
      tag: 'concept',
      body: ['**Optimal** evicts the page that will be used furthest in the future. It needs the future, so it is impossible in practice.', 'It faults 9 times, which is the lower bound.'],
      keyIdea: 'Judge real algorithms by how close they get to Optimal.',
      frames: [{ state: view(R.OPT, 3, 20, 'Optimal, 3 frames', { text: `Optimal: ${R.OPT.faults} faults, nothing can do better`, tone: 'ok' }), hold: 4400 }],
    },
    {
      label: 'Belady',
      title: 'More frames, more faults',
      tag: 'trade-off',
      body: ['With FIFO, **adding frames can increase faults**. On `1 2 3 4 1 2 5 1 2 3 4 5`, 3 frames fault 9 times and 4 frames fault 10 times.', 'LRU and Optimal are stack algorithms and never do this.'],
      keyIdea: 'Belady\'s anomaly is a FIFO property, not a bug in your trace.',
      frames: [{ state: view(B3, 3, 12, 'FIFO, 3 frames', { text: `3 frames: ${B3.faults} faults`, tone: 'accent' }), hold: 3400 }, { state: view(B4, 4, 12, 'FIFO, 4 frames', { text: `4 frames: ${B4.faults} faults, one more`, tone: 'bad' }), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'Page replacement',
      tag: 'recap',
      body: [
        '- **FIFO:** simple, 15 faults here, suffers Belady\'s anomaly.',
        '- **LRU:** 12 faults, approximated with clock algorithms.',
        '- **Optimal:** 9 faults, the unreachable benchmark.',
        '- **Dirty pages:** must be written back before eviction.',
        '- **Linux:** active and inactive lists, multi-gen LRU since 6.1.',
      ],
      keyIdea: 'Locality is what makes LRU-like policies work.',
      frames: [{ state: view(R.OPT, 3, 20, 'Optimal, 3 frames', { text: 'fewest faults: 9, then 12, then 15', tone: 'accent' }) }],
    },
  ],
});
