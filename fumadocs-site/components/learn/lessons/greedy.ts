import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * Frames come from running the notes' greedy code, plus interval scheduling and a coin counter-example, so each number is real.
 */

const range = (from: number, to: number, st: ItemState): Record<number, ItemState> => {
  const out: Record<number, ItemState> = {};
  for (let i = from; i <= to; i++) out[i] = st;
  return out;
};

/** Jump game: track the farthest index reachable. Stops early when an index is out of reach. */
function jumpFrames(nums: number[]): Frame<ArrayState>[] {
  const frames: Frame<ArrayState>[] = [];
  let farthest = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i > farthest) {
      frames.push({
        hold: 2600,
        state: {
          rows: [{ cells: nums, states: { ...range(0, farthest, 'visited'), [i]: 'bad' }, pointers: [{ i, label: 'i', tone: 'bad' }, { i: farthest, label: 'reach', tone: 'info', up: true }], showIndex: true }],
          stats: [{ label: 'Index', value: String(i) }, { label: 'Farthest', value: String(farthest) }, { label: 'Result', value: 'false', tone: 'bad' }],
          note: { text: `index ${i} is beyond the farthest reach ${farthest}: stuck`, tone: 'bad' },
        },
      });
      return frames;
    }
    farthest = Math.max(farthest, i + nums[i]);
    const reach = Math.min(farthest, nums.length - 1);
    frames.push({
      hold: 1300,
      state: {
        rows: [{ cells: nums, states: { ...range(0, i - 1, 'done'), ...range(i + 1, reach, 'visited'), [i]: 'active' }, pointers: [{ i, label: 'i', tone: 'accent' }, { i: reach, label: 'reach', tone: 'info', up: true }], showIndex: true }],
        stats: [{ label: 'Index', value: String(i) }, { label: 'i + nums[i]', value: String(i + nums[i]) }, { label: 'Farthest', value: String(farthest), tone: 'ok' }],
        note: { text: `farthest = max(farthest, ${i} + ${nums[i]}) = ${farthest}`, tone: 'accent' },
      },
    });
    if (farthest >= nums.length - 1) break;
  }
  const last = frames[frames.length - 1].state;
  frames.push({ hold: 2400, state: { ...last, stats: [{ label: 'Farthest', value: String(farthest), tone: 'ok' }, { label: 'Last index', value: String(nums.length - 1) }, { label: 'Result', value: 'true', tone: 'ok' }], note: { text: 'the last index is reachable', tone: 'ok' } } });
  return frames;
}

// Interval scheduling: sort by end time, take every interval that starts after the last chosen one ends.
const INTERVALS: [number, number][] = [[1, 3], [2, 5], [4, 6], [5, 8], [7, 9]];
function scheduleFrames(): Frame<ArrayState>[] {
  const labels = INTERVALS.map(([s, e]) => `${s}-${e}`);
  const frames: Frame<ArrayState>[] = [];
  const states: Record<number, ItemState> = {};
  let lastEnd = -Infinity;
  let picked = 0;
  INTERVALS.forEach(([s, e], i) => {
    const take = s >= lastEnd;
    if (take) {
      lastEnd = e;
      picked++;
    }
    states[i] = take ? 'found' : 'bad';
    frames.push({
      hold: 1600,
      state: {
        rows: [{ label: 'by end', cells: labels, states: { ...states, [i]: take ? 'found' : 'bad' }, pointers: [{ i, label: take ? 'take' : 'skip', tone: take ? 'ok' : 'bad' }], showIndex: false }],
        stats: [{ label: 'Interval', value: `${s} to ${e}` }, { label: 'Last end', value: lastEnd === -Infinity ? '-' : String(take ? e : lastEnd) }, { label: 'Chosen', value: String(picked), tone: 'ok' }],
        note: { text: take ? `starts at ${s}, after the last end: take it` : `starts at ${s}, before the last end: overlaps, skip`, tone: take ? 'ok' : 'bad' },
      },
    });
  });
  return frames;
}

// Greedy coin change fails for coins 1, 3, 4 and amount 6.
const coinsState = (mode: 'greedy' | 'best'): ArrayState => ({
  rows: [
    mode === 'greedy'
      ? { label: 'greedy', cells: [4, 1, 1], states: { 0: 'bad', 1: 'bad', 2: 'bad' }, showIndex: false }
      : { label: 'optimal', cells: [3, 3], states: { 0: 'found', 1: 'found' }, showIndex: false },
  ],
  stats: mode === 'greedy'
    ? [{ label: 'Coins', value: '1, 3, 4' }, { label: 'Amount', value: '6' }, { label: 'Greedy uses', value: '3 coins', tone: 'bad' }]
    : [{ label: 'Coins', value: '1, 3, 4' }, { label: 'Best', value: '3 + 3', tone: 'ok' }, { label: 'Uses', value: '2 coins', tone: 'ok' }],
  note: mode === 'greedy' ? { text: 'always take the biggest coin: 4 + 1 + 1', tone: 'bad' } : { text: 'the local best choice was not part of the best answer: use DP', tone: 'bad' },
});

const JUMP_OK = jumpFrames([2, 3, 1, 1, 4]);
const JUMP_NO = jumpFrames([3, 2, 1, 0, 4]);
const SCHEDULE = scheduleFrames();

export default defineLesson('isoArray', {
  slug: 'greedy',
  pseudocode: [
    'farthest = 0',
    'for i in 0..n-1:',
    '    if i > farthest: return false',
    '    farthest = max(farthest, i + a[i])',
    'return true',
    '',
    'sort intervals by end time',
    'keep each one that starts after the last kept end',
  ],
  objectives: [
    { text: 'What makes a choice greedy and why it needs a proof', step: 1 },
    { text: 'Track the farthest reach in jump game', step: 2 },
    { text: 'Sort by end time for interval scheduling', step: 4 },
    { text: 'Recognise when greedy fails and DP is needed', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Take the best now, never look back',
      tag: 'problem',
      body: [
        'A **greedy** algorithm makes the locally best choice at each step and never reconsiders. It is simple and fast, but only correct when a proof exists.',
        'The usual proof is an **exchange argument**: swapping any optimal solution\'s choice for the greedy one does not make it worse.',
      ],
      keyIdea: 'Greedy is a claim about the problem, not a trick. If you cannot argue it, test it against brute force on small inputs.',
      frames: [{ state: { rows: [{ cells: [2, 3, 1, 1, 4], states: { 0: 'active' }, showIndex: true }], stats: [{ label: 'Choice', value: 'locally best' }, { label: 'Backtrack', value: 'never', tone: 'ok' }, { label: 'Needs', value: 'a proof', tone: 'bad' }], note: { text: 'example: can you jump from index 0 to the last index?', tone: 'accent' } } }],
    },
    {
      label: 'Jump game',
      title: 'Track the farthest reach',
      tag: 'technique',
      code: [1, 2, 4],
      body: [
        'Each `nums[i]` is the longest jump from `i`. Walk left to right and keep `farthest = max(farthest, i + nums[i])`.',
        'You never need the actual path, only how far you could get.',
      ],
      keyIdea: 'One pass, O(n) time and O(1) space. The reach is the only state that matters.',
      frames: JUMP_OK,
    },
    {
      label: 'Stuck',
      title: 'Detect when you cannot continue',
      tag: 'technique',
      code: [3],
      body: [
        'For `[3, 2, 1, 0, 4]` the reach stops at index 3, where the jump is 0. Index 4 is then out of reach.',
        'The check `if (i > farthest) return false` catches it the moment an index is unreachable.',
      ],
      keyIdea: 'The same loop answers both yes and no. The failure condition is part of the algorithm.',
      frames: JUMP_NO,
    },
    {
      label: 'Scheduling',
      title: 'Sort by end time',
      tag: 'technique',
      code: [7, 8],
      body: [
        'To fit the most non-overlapping intervals, sort by **end time** and take every interval that starts at or after the last chosen end.',
        'Finishing earliest leaves the most room for the rest. That is the exchange argument in action.',
      ],
      keyIdea: 'Classic greedy tells: sort by end time, sort by ratio (fractional knapsack), take the smallest each time (Huffman).',
      frames: SCHEDULE,
    },
    {
      label: 'When it fails',
      title: 'A greedy that looks right',
      tag: 'trade-off',
      body: [
        'With coins `1, 3, 4` and amount 6, taking the biggest coin gives `4 + 1 + 1`, three coins. The best is `3 + 3`, two coins.',
        'When an early best choice can block a better whole, greedy is wrong. Reach for dynamic programming.',
      ],
      keyIdea: 'Standard coin systems like 1, 5, 10, 25 happen to work greedily. General coin sets do not.',
      frames: [{ state: coinsState('greedy'), hold: 2400 }, { state: coinsState('best') }],
    },
    {
      label: 'Recap',
      title: 'Before you go greedy',
      tag: 'recap',
      body: [
        '- **Idea:** commit to the locally best choice and never undo it.',
        '- **Proof:** an exchange argument, or a brute-force comparison on small inputs.',
        '- **Patterns:** farthest reach, sort by end time, sort by ratio, smallest-first with a heap.',
        '- **Failure sign:** an early good choice can ruin the whole. Use DP then.',
        '- **Cost:** usually a sort, so O(n log n), or one pass, so O(n).',
      ],
      keyIdea: 'If you cannot explain why the greedy choice is safe, do not trust it.',
      frames: [JUMP_OK.at(-1)!],
    },
  ],
});
