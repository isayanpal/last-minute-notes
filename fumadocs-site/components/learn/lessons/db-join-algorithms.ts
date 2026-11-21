import { defineLesson } from '../define';
import type { ArrayRow, ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import type { Frame } from '../types';

/*
 * The join is employees.dept_id = departments.id on the notes dataset: 8 employees (Hana has no department), 4 departments.
 * Each algorithm below is run for real and its operation count is shown, so the comparison in the last steps is measured, not claimed.
 */

const EMP: (number | null)[] = [1, 1, 1, 2, 2, 2, 3, null];
const DEPT = [1, 2, 3, 4];
const show = (v: number | null) => (v === null ? '-' : String(v));
const paint = (n: number, f: (i: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, f(i)])) as Record<number, ItemState>;

// Run each algorithm once and keep the counts.
const nlOps = EMP.length * DEPT.length;
const idxOps = EMP.length;
const hashOps = DEPT.length + EMP.length;
const SORTED_EMP = EMP.filter((e): e is number => e !== null).sort((a, b) => a - b);
type MergeStep = { i: number; j: number; comps: number; emitted: number };
const mergeSteps: MergeStep[] = [];
{
  let i = 0;
  let j = 0;
  let comps = 0;
  let emitted = 0;
  while (i < SORTED_EMP.length && j < DEPT.length) {
    comps++;
    if (SORTED_EMP[i] === DEPT[j]) {
      emitted++;
      mergeSteps.push({ i, j, comps, emitted });
      i++;
    } else if (SORTED_EMP[i] < DEPT[j]) {
      mergeSteps.push({ i, j, comps, emitted });
      i++;
    } else {
      mergeSteps.push({ i, j, comps, emitted });
      j++;
    }
  }
}
const mergeOps = mergeSteps.length;
const matches = EMP.filter((e) => e !== null && DEPT.includes(e)).length;

const empRow = (states?: Record<number, ItemState>, pointers?: ArrayRow['pointers']): ArrayRow => ({ label: 'employees', cells: EMP.map(show), states, pointers, showIndex: false });
const deptRow = (states?: Record<number, ItemState>, pointers?: ArrayRow['pointers']): ArrayRow => ({ label: 'departments', cells: DEPT, states, pointers, showIndex: false });

// Step 1: a logical join, many physical ways to run it.
const problem: ArrayState = {
  rows: [empRow(paint(EMP.length, (i) => (EMP[i] === null ? 'bad' : 'normal'))), deptRow()],
  panels: [{ title: 'ON dept_id = id', kind: 'list', items: ['8 employees', '4 departments', `${matches} matches`, 'Hana: NULL, none'], highlight: 2 }],
  stats: [
    { label: 'Logical join', value: 'INNER' },
    { label: 'Matches', value: String(matches), tone: 'ok' },
    { label: 'Physical', value: 'engine picks' },
  ],
  note: { text: 'NULL never equals anything, so Hana can match no department', tone: 'accent' },
};

// Step 2: nested loop. For each outer row, scan the whole inner side.
const nested = (outer: number): ArrayState => {
  const comps = (outer + 1) * DEPT.length;
  return {
    rows: [
      empRow(paint(EMP.length, (i) => (i < outer ? 'done' : i === outer ? 'active' : 'dim')), [{ i: outer, label: 'outer', tone: 'accent', up: true }]),
      deptRow(paint(DEPT.length, (j) => (EMP[outer] === DEPT[j] ? 'found' : 'visited'))),
    ],
    stats: [
      { label: 'Outer rows done', value: `${outer + 1} of ${EMP.length}` },
      { label: 'Comparisons', value: String(comps), tone: comps > 16 ? 'bad' : 'neutral' },
      { label: 'Total', value: `${EMP.length} x ${DEPT.length} = ${nlOps}` },
    ],
    note: { text: `outer row ${outer + 1} compared against all ${DEPT.length} inner rows`, tone: outer === EMP.length - 1 ? 'bad' : 'accent' },
  };
};

// Step 3: an index on the inner side replaces the scan with a lookup.
const indexed = (outer: number): ArrayState => ({
  rows: [
    empRow(paint(EMP.length, (i) => (i < outer ? 'done' : i === outer ? 'active' : 'dim')), [{ i: outer, label: 'outer', tone: 'accent', up: true }]),
    {
      label: 'index on id',
      cells: DEPT,
      states: paint(DEPT.length, (j) => (EMP[outer] === DEPT[j] ? 'found' : 'dim')),
      pointers: EMP[outer] !== null ? [{ i: DEPT.indexOf(EMP[outer]!), label: 'seek', tone: 'ok' }] : undefined,
      showIndex: false,
    },
  ],
  stats: [
    { label: 'Lookups', value: String(outer + 1) },
    { label: 'Per lookup', value: 'O(log m)' },
    { label: 'Total', value: `${idxOps} seeks`, tone: 'ok' },
  ],
  note: { text: 'with an index on the inner join column each outer row does one seek', tone: 'ok' },
});

// Step 4: hash join. Build on the smaller side, probe with the larger.
const hash = (phase: 'build' | number): ArrayState => {
  const probing = phase !== 'build';
  const i = probing ? (phase as number) : -1;
  return {
    rows: [
      deptRow(paint(DEPT.length, (j) => (probing ? (EMP[i] === DEPT[j] ? 'found' : 'dim') : 'active')), probing ? undefined : [{ i: 0, label: 'build', tone: 'accent', up: true }]),
      empRow(paint(EMP.length, (k) => (!probing ? 'dim' : k < i ? 'done' : k === i ? 'active' : 'dim')), probing ? [{ i, label: 'probe', tone: 'accent', up: true }] : undefined),
    ],
    panels: [{ title: 'hash table', kind: 'map', items: DEPT.map((d) => `${d} to dept ${d}`), highlight: probing && EMP[i] !== null ? DEPT.indexOf(EMP[i]!) : undefined }],
    stats: [
      { label: 'Build', value: `${DEPT.length} (smaller)` },
      { label: 'Probe', value: probing ? `${i + 1} of ${EMP.length}` : '0' },
      { label: 'Total', value: `${DEPT.length} + ${EMP.length} = ${hashOps}`, tone: 'ok' },
    ],
    note: !probing ? { text: 'hash the smaller input first: needs memory for the table', tone: 'accent' } : EMP[i] === null ? { text: 'NULL hashes to nothing: no match, no extra scan', tone: 'accent' } : { text: 'one hash lookup per probe row, no scanning', tone: 'ok' },
  };
};

// Step 5: merge join. Both sides sorted on the key, walk them together.
const merge = (n: number): ArrayState => {
  const s = mergeSteps[n];
  return {
    rows: [
      { label: 'employees', cells: SORTED_EMP, states: paint(SORTED_EMP.length, (k) => (k < s.i ? 'done' : k === s.i ? 'active' : 'dim')), pointers: [{ i: s.i, label: 'i', tone: 'accent', up: true }], showIndex: false },
      deptRow(paint(DEPT.length, (j) => (j < s.j ? 'done' : j === s.j ? 'active' : 'dim')), [{ i: s.j, label: 'j', tone: 'accent' }]),
    ],
    stats: [
      { label: 'Comparisons', value: String(s.comps) },
      { label: 'Emitted', value: String(s.emitted), tone: 'ok' },
      { label: 'Total', value: `${mergeOps} walk steps`, tone: 'ok' },
    ],
    note: { text: 'advance whichever side is behind, never look back', tone: 'accent' },
  };
};

// Step 6: the measured comparison.
const compare = (focus?: number): ArrayState => {
  const labels = ['NL', 'Idx', 'Hash', 'Merge'];
  const values = [nlOps, idxOps, hashOps, mergeOps];
  const states = focus === undefined ? undefined : paint(4, (i) => (i === focus ? 'active' : 'dim'));
  return {
    rows: [
      { label: 'Algorithm', cells: labels, states, showIndex: false },
      { label: 'Operations', cells: values, states, bars: true, showIndex: false },
    ],
    stats: [
      { label: 'Worst', value: `nested ${nlOps}`, tone: 'bad' },
      { label: 'Best here', value: 'index NL', tone: 'ok' },
      { label: 'Scale', value: 'n x m vs n + m' },
    ],
    note: { text: 'tiny inputs hide the gap: at a million rows nested loop is hopeless', tone: 'accent' },
  };
};

const frames = (list: ArrayState[], holds: number[]): Frame<ArrayState>[] => list.map((state, i) => ({ state, hold: holds[i] ?? 1800 }));

export default defineLesson('array', {
  slug: 'db-join-algorithms',
  objectives: [
    { text: 'The difference between a logical join and a physical algorithm', step: 1 },
    { text: 'How nested loop joins work and why they scale as n x m', step: 2 },
    { text: 'What an index on the inner side changes', step: 3 },
    { text: 'How hash joins build and probe', step: 4 },
    { text: 'How merge joins walk two sorted inputs', step: 5 },
    { text: 'Which algorithm fits which workload', step: 6 },
  ],
  steps: [
    {
      label: 'Logical, physical',
      title: 'INNER is what, not how',
      tag: 'problem',
      body: ['`INNER`, `LEFT` and friends say **what** rows to return. The engine chooses **how**: nested loop, hash join or merge join.', 'The same logical join can be thousands of times cheaper with the right physical choice.'],
      keyIdea: 'Join pitfalls are logical (NULL never matches). Join performance is physical.',
      frames: [{ state: problem, hold: 3000 }],
    },
    {
      label: 'Nested loop',
      title: 'For each row, scan the other side',
      tag: 'concept',
      body: ['A **nested loop** takes each outer row and compares it with every inner row: O(n x m).', 'Fine for tiny tables, a red flag on big ones when the inner side is a sequential scan.'],
      keyIdea: 'A nested loop with a sequential scan on a large inner side usually means a missing index.',
      frames: frames([nested(0), nested(3), nested(7)], [1800, 1800, 3000]),
    },
    {
      label: 'Index NL',
      title: 'Seek instead of scan',
      tag: 'technique',
      body: ['With an index on the inner join column, each outer row does one **seek** instead of a scan: O(n log m).', 'This is the normal plan for OLTP lookups with a small outer side.'],
      keyIdea: 'Index the foreign key column you join on, or this plan is not available.',
      frames: frames([indexed(0), indexed(3), indexed(6)], [1800, 1800, 3000]),
    },
    {
      label: 'Hash join',
      title: 'Build small, probe big',
      tag: 'technique',
      body: ['A **hash join** builds a hash table on the smaller input, then probes it with each row of the larger one: O(n + m).', 'It needs memory and spills to disk in partitions when the table is too big. It handles equality joins only.'],
      keyIdea: 'A hash join over two big scans is normal for reports.',
      frames: frames([hash('build'), hash(0), hash(3), hash(7)], [2000, 1700, 1700, 3000]),
    },
    {
      label: 'Merge join',
      title: 'Two sorted lists, one pass',
      tag: 'technique',
      body: ['A **merge join** needs both inputs sorted on the key, then walks them together, advancing whichever side is behind.', 'It costs O(n + m) when inputs are already ordered (for example by an index), and it also handles range joins.'],
      keyIdea: 'If sorting is needed first, add O(n log n) per input.',
      frames: frames([merge(0), merge(Math.floor(mergeSteps.length / 2)), merge(mergeSteps.length - 1)], [1800, 1800, 3000]),
    },
    {
      label: 'Choosing',
      title: 'Measured on this data',
      tag: 'trade-off',
      body: [`On 8 and 4 rows the nested loop does ${nlOps} comparisons, the hash join ${hashOps}, the merge ${mergeOps} steps and the index loop ${idxOps} seeks.`, 'Equality on large unsorted inputs favors hash. Sorted inputs or range joins favor merge. A small outer with an indexed inner favors an index nested loop.'],
      keyIdea: 'Read plans for the odd one out: a nested loop over large tables, or a hash join spilling to disk.',
      frames: [{ state: compare(), hold: 2200 }, { state: compare(0), hold: 1800 }, { state: compare(2), hold: 1800 }, { state: compare(1), hold: 2800 }],
    },
    {
      label: 'Recap',
      title: 'Pick the join by shape',
      tag: 'recap',
      body: [
        '- **Nested loop:** O(n x m), small outer plus indexed inner is fine.',
        '- **Hash join:** O(n + m), equality only, needs memory.',
        '- **Merge join:** O(n + m) on sorted inputs, handles ranges.',
        '- **Check plans:** nested loop with a seq scan inner means a missing index.',
        '- **NULL** never matches in any of them.',
      ],
      keyIdea: 'Statistics drive the choice, so stale statistics can pick the wrong join.',
      frames: [{ state: compare(1) }],
    },
  ],
});
