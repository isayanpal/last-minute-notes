import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GridState } from '../engines/grid';
import type { Frame } from '../types';

/*
 * Frames come from running the notes' DP code (house robber, coin change, LCS, unique paths),
 * so every cell shows the value the real table would hold. Arrows run from the cell being computed to what it reads.
 */

type Cell = number | string | null;
const key = (r: number, c: number) => `${r},${c}`;

// ---------- House robber: take / skip ----------
const HOUSES = [2, 7, 9, 3, 1];
function robberFrames(): Frame<GridState>[] {
  const take: Cell[] = HOUSES.map(() => null);
  const skip: Cell[] = HOUSES.map(() => null);
  const frames: Frame<GridState>[] = [];
  let t = 0;
  let s = 0;
  const snap = (i: number | undefined, note: string, extra: GridState['arrows'] = []) => {
    const states: Record<string, ItemState> = {};
    for (let c = 0; c < HOUSES.length; c++) {
      states[key(0, c)] = i === c ? 'active' : 'normal';
      if (take[c] !== null) states[key(1, c)] = i === c ? 'active' : 'done';
      if (skip[c] !== null) states[key(2, c)] = i === c ? 'active' : 'done';
    }
    frames.push({
      hold: 1800,
      state: {
        cells: [HOUSES, take, skip],
        rowHeaders: ['house', 'take', 'skip'],
        states,
        arrows: extra,
        stats: [{ label: 'take', value: String(t) }, { label: 'skip', value: String(s) }, { label: 'Best so far', value: String(Math.max(t, s)), tone: 'ok' }],
        note: { text: note, tone: 'accent' },
      },
    });
  };
  snap(undefined, 'take = best if we rob this house, skip = best if we do not');
  HOUSES.forEach((n, i) => {
    [t, s] = [s + n, Math.max(t, s)];
    take[i] = t;
    skip[i] = s;
    snap(i, `house ${i + 1} (${n}): take = prev skip + ${n} = ${t}, skip = max(prev take, prev skip) = ${s}`, i ? [{ from: [1, i], to: [2, i - 1] }, { from: [2, i], to: [1, i - 1], tone: 'info' }, { from: [2, i], to: [2, i - 1], tone: 'info' }] : []);
  });
  frames.push({ hold: 2400, state: { ...frames[frames.length - 1].state, arrows: [], note: { text: `answer = max(take, skip) = ${Math.max(t, s)}`, tone: 'ok' }, states: { ...frames[frames.length - 1].state.states, [key(1, 4)]: 'found' } } });
  return frames;
}

// ---------- Coin change: dp over amounts, laid out 6 per row ----------
const COINS = [1, 2, 5];
const AMOUNT = 11;
const PER_ROW = 6;
function coinFrames(): Frame<GridState>[] {
  const dp: number[] = new Array(AMOUNT + 1).fill(Infinity);
  dp[0] = 0;
  const rows = Math.ceil((AMOUNT + 1) / PER_ROW);
  const at = (a: number): [number, number] => [Math.floor(a / PER_ROW), a % PER_ROW];
  const grid = (upTo: number): Cell[][] =>
    Array.from({ length: rows }, (_, r) => Array.from({ length: PER_ROW }, (_, c) => {
      const a = r * PER_ROW + c;
      if (a > AMOUNT || a > upTo) return null;
      return dp[a] === Infinity ? '∞' : dp[a];
    }));
  const frames: Frame<GridState>[] = [];
  const base = { colHeaders: Array.from({ length: PER_ROW }, (_, c) => `+${c}`), rowHeaders: Array.from({ length: rows }, (_, r) => String(r * PER_ROW)), title: 'dp[a] = fewest coins to make amount a' };
  const states = (upTo: number, cur?: number, deps: number[] = []): Record<string, ItemState> => {
    const st: Record<string, ItemState> = {};
    for (let a = 0; a <= upTo; a++) st[key(...at(a))] = 'done';
    for (const d of deps) st[key(...at(d))] = 'visited';
    if (cur !== undefined) st[key(...at(cur))] = 'active';
    return st;
  };
  frames.push({ hold: 1500, state: { ...base, cells: grid(0), states: states(0), stats: [{ label: 'Coins', value: '1, 2, 5' }, { label: 'Base', value: 'dp[0] = 0' }, { label: 'Others', value: 'start at ∞' }], note: { text: 'zero coins make amount 0', tone: 'accent' } } });
  for (let a = 1; a <= AMOUNT; a++) {
    const deps: number[] = [];
    let via = 0;
    for (const c of COINS) {
      if (c <= a) {
        deps.push(a - c);
        if (dp[a - c] + 1 < dp[a]) {
          dp[a] = dp[a - c] + 1;
          via = c;
        }
      }
    }
    frames.push({
      hold: a === AMOUNT ? 2400 : 1000,
      state: {
        ...base,
        cells: grid(a),
        states: states(a - 1, a, deps),
        arrows: deps.map((d) => ({ from: at(a), to: at(d) })),
        stats: [{ label: 'Amount', value: String(a) }, { label: 'Best last coin', value: String(via) }, { label: `dp[${a}]`, value: String(dp[a]), tone: 'ok' }],
        note: { text: `min over coins of dp[${a} - coin] + 1 = ${dp[a]}`, tone: a === AMOUNT ? 'ok' : 'accent' },
      },
    });
  }
  return frames;
}

// ---------- LCS of "abcde" and "ace" ----------
const A = 'abcde';
const B = 'ace';
function lcsFrames(): Frame<GridState>[] {
  const dp: number[][] = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  const frames: Frame<GridState>[] = [];
  const base = { rowHeaders: ['""', ...A.split('')], colHeaders: ['""', ...B.split('')], title: 'dp[i][j] = LCS of first i of a and first j of b' };
  const snapshot = (ci: number, cj: number): { cells: Cell[][]; states: Record<string, ItemState> } => {
    const cells: Cell[][] = dp.map((row, i) => row.map((v, j) => (i === 0 || j === 0 || i < ci || (i === ci && j <= cj) ? v : null)));
    const states: Record<string, ItemState> = {};
    cells.forEach((row, i) => row.forEach((v, j) => v !== null && (states[key(i, j)] = 'done')));
    return { cells, states };
  };
  const first = snapshot(0, 0);
  frames.push({ hold: 1500, state: { ...base, cells: first.cells, states: first.states, stats: [{ label: 'a', value: A }, { label: 'b', value: B }, { label: 'Base', value: 'empty = 0' }], note: { text: 'an empty string has no common subsequence', tone: 'accent' } } });
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      const match = A[i - 1] === B[j - 1];
      dp[i][j] = match ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      const { cells, states } = snapshot(i, j);
      states[key(i, j)] = 'active';
      const deps: [number, number][] = match ? [[i - 1, j - 1]] : [[i - 1, j], [i, j - 1]];
      for (const [r, c] of deps) states[key(r, c)] = 'visited';
      frames.push({
        hold: i === A.length && j === B.length ? 2600 : 850,
        state: {
          ...base,
          cells,
          states,
          arrows: deps.map(([r, c]) => ({ from: [i, j] as [number, number], to: [r, c] as [number, number] })),
          stats: [{ label: 'Compare', value: `${A[i - 1]} vs ${B[j - 1]}`, tone: match ? 'ok' : 'neutral' }, { label: 'Rule', value: match ? 'diagonal + 1' : 'max(up, left)' }, { label: `dp[${i}][${j}]`, value: String(dp[i][j]), tone: 'ok' }],
          note: { text: match ? `${A[i - 1]} matches: dp[${i - 1}][${j - 1}] + 1 = ${dp[i][j]}` : `no match: max(${dp[i - 1][j]}, ${dp[i][j - 1]}) = ${dp[i][j]}`, tone: match ? 'ok' : 'accent' },
        },
      });
    }
  }
  const last = frames[frames.length - 1].state;
  frames.push({ state: { ...last, arrows: [], states: { ...last.states, [key(A.length, B.length)]: 'found' }, note: { text: `answer is the bottom-right cell: ${dp[A.length][B.length]} ("ace")`, tone: 'ok' } } });
  return frames;
}

// ---------- Grid paths: the same recipe on a 2D table ----------
function pathsState(): GridState {
  const R = 3;
  const C = 4;
  const dp: number[][] = Array.from({ length: R }, () => new Array(C).fill(1));
  for (let i = 1; i < R; i++) for (let j = 1; j < C; j++) dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
  const states: Record<string, ItemState> = {};
  dp.forEach((row, i) => row.forEach((_, j) => (states[key(i, j)] = 'done')));
  states[key(R - 1, C - 1)] = 'found';
  return {
    cells: dp,
    title: 'paths(i, j) = paths(i - 1, j) + paths(i, j - 1)',
    states,
    arrows: [{ from: [2, 3], to: [1, 3] }, { from: [2, 3], to: [2, 2] }],
    stats: [{ label: 'Grid', value: '3 × 4' }, { label: 'Paths', value: String(dp[R - 1][C - 1]), tone: 'ok' }, { label: 'Memory', value: 'O(rows) ok' }],
    note: { text: 'edges are 1: only one way along the border', tone: 'accent' },
  };
}

const ROBBER = robberFrames();
const COIN = coinFrames();
const LCS = lcsFrames();

export default defineLesson('isoGrid', {
  slug: 'dynamic-programming',
  pseudocode: [
    'state: what few values describe a subproblem?',
    'meaning: what does dp[state] store?',
    'base cases: the smallest answers you know',
    'transition: dp[state] from smaller states',
    'order: fill so every dependency is ready',
    'answer: the cell that holds the whole problem',
  ],
  objectives: [
    { text: 'The five questions to ask for every DP problem', step: 1 },
    { text: 'A 1D table that only needs the previous two states', step: 2 },
    { text: 'Unbounded choices: coin change', step: 3 },
    { text: 'A 2D table over two strings: longest common subsequence', step: 4 },
  ],
  steps: [
    {
      label: 'The recipe',
      title: 'Recursion plus a cache',
      tag: 'problem',
      code: [1, 2],
      body: [
        'DP is recursion where subproblems **overlap**, so each answer is computed once and reused.',
        'Ask five questions: the **state**, what `dp[state]` **means**, the **transition**, the **base cases**, and the **fill order and answer**.',
      ],
      keyIdea: 'If you can say what dp[i] means in one sentence, the transition usually follows.',
      frames: [ROBBER[0]],
    },
    {
      label: 'House robber',
      title: 'Only the last two states matter',
      tag: 'technique',
      code: [4],
      body: [
        'Rob a house and you must skip the next. Track `take` (best if we rob this house) and `skip` (best if we do not).',
        'Each house updates both from the previous pair, so the whole table collapses to two variables: O(1) space.',
      ],
      keyIdea: 'When a state depends only on a few previous states, keep only those.',
      frames: ROBBER.slice(1),
    },
    {
      label: 'Coin change',
      title: 'Try every coin for every amount',
      tag: 'technique',
      code: [3, 4],
      body: [
        '`dp[a]` is the fewest coins for amount `a`. For each coin `c <= a`, `dp[a] = min(dp[a], dp[a - c] + 1)`.',
        'The answer for 11 is 3 (5 + 5 + 1). Use a sentinel that cannot overflow, not `Integer.MAX_VALUE`, in Java.',
      ],
      keyIdea: 'Unbounded choices and "fewest" or "count" questions are knapsack-shaped. Fill amounts upward.',
      frames: COIN,
    },
    {
      label: 'LCS',
      title: 'A 2D table over two strings',
      tag: 'technique',
      code: [4, 5],
      body: [
        '`dp[i][j]` is the LCS of the first `i` characters of `a` and the first `j` of `b`. A match extends the diagonal. A mismatch takes the better of up or left.',
        'Fill row by row. The answer sits in the bottom-right cell.',
      ],
      keyIdea: 'Two sequences mean two indexes mean a 2D table. Edit distance has the same shape.',
      frames: LCS,
    },
    {
      label: 'Families',
      title: 'Spot the family',
      tag: 'in practice',
      code: [1],
      body: [
        'Common families: **1D** (climb stairs, house robber), **knapsack** (subset sum, coin change), **strings** (LCS, edit distance), **grids** (unique paths), **intervals** (burst balloons).',
        'Grid paths use the same recipe: each cell is the sum of the cell above and the cell to its left.',
      ],
      keyIdea: 'Recognise the family, then answer the five questions.',
      frames: [{ state: pathsState() }],
    },
    {
      label: 'Recap',
      title: 'The DP checklist',
      tag: 'recap',
      body: [
        '- **State and meaning:** name the few variables, and say what `dp[state]` stores.',
        '- **Transition and bases:** derive from smaller states, set the trivial cases.',
        '- **Order:** fill so dependencies exist first. Answer is a known cell.',
        '- **Space:** keep only the rows or variables you still read.',
        '- **Traps:** overflow with an "infinity" sentinel, and in JavaScript `fill` shares one row reference.',
      ],
      keyIdea: 'DP is not a trick. It is five questions answered carefully.',
      frames: [{ state: LCS.at(-1)!.state }],
    },
  ],
});
