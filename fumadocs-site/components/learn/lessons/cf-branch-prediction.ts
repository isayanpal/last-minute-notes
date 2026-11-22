import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on branch prediction: the classic sum-above-a-threshold loop is much faster on sorted data
 * because the branch becomes predictable. Real predictors (always taken, 2-bit saturating counter) run over 256 pseudo-random values
 * and the same values sorted. The misprediction penalty of 17 cycles is the midpoint of the notes' 15 to 20 cycles, an EXAMPLE value.
 */

const N = 256;
const THRESHOLD = 128;
const PENALTY = 17;

const random = (() => {
  let x = 12345;
  return Array.from({ length: N }, () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x >>> 24; // 0..255
  });
})();
const sorted = [...random].sort((a, b) => a - b);
const taken = (v: number) => v >= THRESHOLD; // if (data[i] >= 128) sum += data[i]

type Run = { predictions: boolean[]; counters: number[]; wrong: boolean[]; mispredicts: number };
function simulate(outcomes: boolean[], kind: 'always' | 'two-bit'): Run {
  let counter = 2; // weakly taken
  const predictions: boolean[] = [];
  const counters: number[] = [];
  const wrong: boolean[] = [];
  for (const o of outcomes) {
    const p = kind === 'always' ? true : counter >= 2;
    predictions.push(p);
    counters.push(counter);
    wrong.push(p !== o);
    if (kind === 'two-bit') counter = o ? Math.min(3, counter + 1) : Math.max(0, counter - 1);
  }
  return { predictions, counters, wrong, mispredicts: wrong.filter(Boolean).length };
}

const RANDOM_OUT = random.map(taken);
const SORTED_OUT = sorted.map(taken);
const STATIC_RANDOM = simulate(RANDOM_OUT, 'always');
const TWO_RANDOM = simulate(RANDOM_OUT, 'two-bit');
const TWO_SORTED = simulate(SORTED_OUT, 'two-bit');
const SHOWN = 12;
const pct = (n: number) => `${Math.round((n / N) * 100)}%`;

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;
const tn = (b: boolean) => (b ? 'T' : 'N');

const view = (data: number[], out: boolean[], run: Run, label: string, note: ArrayState['note'], from = 0): ArrayState => ({
  rows: [
    { label: 'data', cells: data.slice(from, from + SHOWN), states: paint(SHOWN, () => 'normal'), showIndex: false },
    { label: 'taken', cells: out.slice(from, from + SHOWN).map(tn), states: paint(SHOWN, (i) => (out[from + i] ? 'visited' : 'dim')), showIndex: false },
    { label: 'predicted', cells: run.predictions.slice(from, from + SHOWN).map(tn), states: paint(SHOWN, (i) => (run.wrong[from + i] ? 'bad' : 'found')), showIndex: false },
  ],
  stats: [
    { label: 'Predictor', value: label },
    { label: `Wrong of ${N}`, value: `${run.mispredicts} (${pct(run.mispredicts)})`, tone: run.mispredicts > N * 0.2 ? 'bad' : 'ok' },
    { label: 'Cycles lost', value: String(run.mispredicts * PENALTY), tone: run.mispredicts > N * 0.2 ? 'bad' : 'ok' },
  ],
  note,
});

const counterDemo = (k: number): ArrayState => {
  const seq = [true, true, true, false, true, true, true];
  const r = simulate(seq, 'two-bit');
  return {
    rows: [
      { label: 'outcome', cells: seq.map((o, i) => (i < k ? tn(o) : '')), states: paint(7, (i) => (i === k - 1 ? 'active' : i < k ? 'done' : 'dim')), showIndex: false },
      { label: 'counter', cells: r.counters.map((c, i) => (i < k ? c : '')), states: paint(7, (i) => (i < k ? 'visited' : 'dim')), showIndex: false },
      { label: 'predicted', cells: r.predictions.map((p, i) => (i < k ? tn(p) : '')), states: paint(7, (i) => (i < k ? (r.wrong[i] ? 'bad' : 'found') : 'dim')), showIndex: false },
    ],
    stats: [
      { label: 'Counter', value: '0..3' },
      { label: 'Predict taken', value: '2 or 3' },
      { label: 'Wrong so far', value: String(r.wrong.slice(0, k).filter(Boolean).length) },
    ],
    note: { text: 'one not-taken outcome only lowers the counter from 3 to 2, so the next prediction is still taken', tone: 'ok' },
  };
};

export default defineLesson('array', {
  slug: 'cf-branch-prediction',
  objectives: [
    { text: 'Why a mispredicted branch is expensive', step: 1 },
    { text: 'How a 2-bit counter tolerates one surprise', step: 2 },
    { text: 'Why random data defeats any predictor', step: 3 },
    { text: 'Why sorting makes the same loop faster', step: 4 },
  ],
  steps: [
    {
      label: 'The cost',
      title: 'Guess, then pay if wrong',
      tag: 'problem',
      body: ['A deep pipeline cannot wait to resolve each branch, so the CPU **predicts** and runs ahead. A wrong guess discards the work, roughly 15 to 20 cycles.', 'Take `if (data[i] >= 128) sum += data[i]`. A predictor that always says "taken" is wrong whenever the value is small.'],
      keyIdea: 'The penalty here is 17 cycles, an example inside the notes\' range.',
      frames: [{ state: view(random, RANDOM_OUT, STATIC_RANDOM, 'always taken', { text: `on random data about half the branches go the other way: ${STATIC_RANDOM.mispredicts} wrong`, tone: 'bad' }), hold: 4600 }],
    },
    {
      label: '2-bit counter',
      title: 'Two wrong guesses to flip',
      tag: 'concept',
      body: ['A **2-bit saturating counter** moves up on taken and down on not taken. It predicts taken when it is 2 or 3.', 'One surprise in a loop only moves it from 3 to 2, so it needs two in a row to change its mind.'],
      keyIdea: 'That hysteresis suits loops, where the exit is a rare surprise.',
      frames: [3, 4, 7].map((k) => ({ state: counterDemo(k), hold: k === 7 ? 3800 : 2200 })),
    },
    {
      label: 'Random data',
      title: 'No pattern to learn',
      tag: 'trade-off',
      body: ['On random values the branch outcome is a coin flip. The 2-bit counter cannot learn anything.', 'It is wrong about half the time, which is a lot of 17-cycle penalties.'],
      keyIdea: 'A good predictor needs a pattern. Random data has none.',
      frames: [{ state: view(random, RANDOM_OUT, TWO_RANDOM, '2-bit counter', { text: `${TWO_RANDOM.mispredicts} of ${N} wrong, ${TWO_RANDOM.mispredicts * PENALTY} cycles lost`, tone: 'bad' }), hold: 4600 }],
    },
    {
      label: 'Sorted data',
      title: 'Same data, sorted',
      tag: 'technique',
      body: ['Sort the same values first and the branch is not taken for the first half, then taken for the second half.', 'The predictor is wrong only a couple of times, at the switch.'],
      keyIdea: 'The same loop runs several times faster on sorted data.',
      frames: [{ state: view(sorted, SORTED_OUT, TWO_SORTED, '2-bit counter', { text: `${TWO_SORTED.mispredicts} of ${N} wrong, ${TWO_SORTED.mispredicts * PENALTY} cycles lost`, tone: 'ok' }, 120), hold: 4800 }],
    },
    {
      label: 'Recap',
      title: 'Branch prediction',
      tag: 'recap',
      body: [
        '- **Speculation:** run the predicted path, discard if wrong.',
        '- **Cost:** about 15 to 20 cycles per miss.',
        '- **Predictors:** static, 2-bit, history based, TAGE.',
        '- **Predictable data:** sorted or patterned.',
        '- **Branchless code:** `cmov` or masks for random data.',
      ],
      keyIdea: 'Spectre showed speculative execution can leak data through the cache.',
      frames: [{ state: view(sorted, SORTED_OUT, TWO_SORTED, '2-bit counter', { text: `${TWO_RANDOM.mispredicts} wrong on random data against ${TWO_SORTED.mispredicts} on sorted`, tone: 'accent' }, 120) }],
    },
  ],
});
