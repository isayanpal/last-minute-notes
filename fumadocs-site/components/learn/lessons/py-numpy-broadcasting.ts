import { defineLesson } from '../define';
import type { GridState } from '../engines/grid';
import type { ItemState } from '../engines/common';

/*
 * Follows the Python notes on broadcasting: compare shapes from the right, dimensions are compatible if they are equal or one of them is 1,
 * size-1 dimensions stretch. A real shape-broadcast function and real element-wise arithmetic produce every shape and value, including the
 * (3, 4) plus (3,) failure.
 */

type Shape = number[];
function broadcast(a: Shape, b: Shape): { ok: true; shape: Shape } | { ok: false; at: number } {
  const n = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let k = 1; k <= n; k++) {
    const x = a[a.length - k] ?? 1;
    const y = b[b.length - k] ?? 1;
    if (x !== y && x !== 1 && y !== 1) return { ok: false, at: n - k };
    out.unshift(Math.max(x, y));
  }
  return { ok: true, shape: out };
}
const show = (s: Shape) => `(${s.join(', ')}${s.length === 1 ? ',' : ''})`;

type Arr = { shape: Shape; data: number[][] }; // 2-d view of a 1-d or 2-d array
const arr2 = (rows: number[][]): Arr => ({ shape: [rows.length, rows[0].length], data: rows });
const row1 = (v: number[]): Arr => ({ shape: [v.length], data: [v] });
const col = (v: number[]): Arr => ({ shape: [v.length, 1], data: v.map((x) => [x]) });
const at = (x: Arr, i: number, j: number) => x.data[x.data.length === 1 ? 0 : i][x.data[0].length === 1 ? 0 : j];
const add = (x: Arr, y: Arr): number[][] => {
  const r = broadcast(x.shape, y.shape);
  if (!r.ok) throw new Error('shapes do not broadcast');
  const [h, w] = r.shape.length === 2 ? r.shape : [1, r.shape[0]];
  return Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => at(x, i, j) + at(y, i, j)));
};

const A = arr2([[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]]);
const B = row1([10, 20, 30, 40]);
const BAD = row1([1, 2, 3]);
const SUM = add(A, B);
const OUTER = add(col([0, 1, 2]), row1([0, 1, 2, 3]));
const R_OK = broadcast([3, 4], [4]);
const R_BAD = broadcast([3, 4], [3]);
const R_OUTER = broadcast([3, 1], [4]);

const M = arr2([[1, 1, 2], [2, 3, 5]]);
const SUMS = M.data.map((r) => r.reduce((a, b) => a + b, 0));
const NORM = M.data.map((r, i) => r.map((v) => Math.round((v / SUMS[i]) * 100) / 100));

const paint = (cells: unknown[][], f: (r: number, c: number) => ItemState): Record<string, ItemState> => {
  const out: Record<string, ItemState> = {};
  cells.forEach((row, r) => row.forEach((_, c) => (out[`${r},${c}`] = f(r, c))));
  return out;
};

const align = (a: Shape, b: Shape, res: ReturnType<typeof broadcast>, note: GridState['note']): GridState => {
  const n = Math.max(a.length, b.length);
  const pad = (s: Shape) => Array.from({ length: n }, (_, i) => (i - (n - s.length) >= 0 ? s[i - (n - s.length)] : null));
  const rows: (number | string | null)[][] = [pad(a), pad(b), res.ok ? res.shape : Array(n).fill('?')];
  const states = paint(rows, (r, c) => {
    if (r === 2) return res.ok ? 'found' : 'dim';
    const x = rows[0][c];
    const y = rows[1][c];
    if (!res.ok && c === res.at && x !== null && y !== null) return 'bad';
    return rows[r][c] === null ? 'dim' : 'visited';
  });
  return {
    title: `${show(a)} and ${show(b)}, aligned on the right`,
    colHeaders: Array.from({ length: n }, (_, i) => `d${i}`),
    rowHeaders: ['A', 'B', 'result'],
    cells: rows,
    states,
    stats: [
      { label: 'A shape', value: show(a) },
      { label: 'B shape', value: show(b) },
      { label: 'Result', value: res.ok ? show(res.shape) : 'ValueError', tone: res.ok ? 'ok' : 'bad' },
    ],
    note,
  };
};

const values = (title: string, cells: number[][], shape: Shape, note: GridState['note']): GridState => ({
  title,
  cells,
  states: paint(cells, () => 'found'),
  stats: [
    { label: 'Result shape', value: show(shape), tone: 'ok' },
    { label: 'Copies made', value: '0', tone: 'ok' },
    { label: 'Rule', value: 'equal or 1' },
  ],
  note,
});

export default defineLesson('grid', {
  slug: 'py-numpy-broadcasting',
  objectives: [
    { text: 'How shapes are aligned and compared', step: 1 },
    { text: 'How a row is added to every row', step: 2 },
    { text: 'Why (3, 4) plus (3,) fails', step: 3 },
    { text: 'How a column and a row make a table', step: 4 },
  ],
  steps: [
    {
      label: 'The rule',
      title: 'Compare from the right',
      tag: 'problem',
      body: ['Broadcasting lets arrays of different shapes combine **without copying**. Align the shapes on the **right**.', 'Two dimensions are compatible if they are equal or one of them is 1. Missing leading dimensions count as 1.'],
      keyIdea: 'The result takes the larger size in each dimension.',
      frames: [{ state: align([3, 4], [4], R_OK, { text: '4 and 4 match, and the missing leading dimension of B counts as 1, so the result is (3, 4)', tone: 'ok' }), hold: 4600 }],
    },
    {
      label: 'Row + matrix',
      title: 'Add a row to every row',
      tag: 'concept',
      body: ['`np.ones((3, 4)) + np.ones(4)` stretches the length-4 row down the three rows, without copying.', 'Here `[10, 20, 30, 40]` is added to each row of `arange(12).reshape(3, 4)`.'],
      keyIdea: 'Stretched dimensions get stride 0, so no data is duplicated.',
      frames: [{ state: values('A (3,4) + B (4,)', SUM, [3, 4], { text: 'each row of A got the same row added: 0 + 10, 1 + 20, 2 + 30, 3 + 40', tone: 'ok' }), hold: 4600 }],
    },
    {
      label: 'Mismatch',
      title: 'When it fails',
      tag: 'trade-off',
      body: ['`np.ones((3, 4)) + np.ones(3)` aligns 3 with 4. They are not equal and neither is 1.', 'NumPy raises `ValueError: operands could not be broadcast together`.'],
      keyIdea: 'A length-3 array lines up with the columns, not the rows.',
      frames: [{ state: align([3, 4], [3], R_BAD, { text: 'the last dimensions are 4 and 3: incompatible, so broadcasting stops', tone: 'bad' }), hold: 4600 }],
    },
    {
      label: 'Outer',
      title: 'Column plus row',
      tag: 'technique',
      body: ['A column `(3, 1)` plus a row `(4,)` stretches **both**: the column across the columns and the row down the rows.', 'The result is a `(3, 4)` table, an "outer" operation.'],
      keyIdea: '`arr[:, None]` adds a size-1 axis.',
      frames: [{ state: align([3, 1], [4], R_OUTER, { text: '1 stretches to 4 and the missing dimension stretches to 3', tone: 'ok' }), hold: 3000 }, { state: values('col (3,1) + row (4,)', OUTER, [3, 4], { text: 'cell (i, j) is i + j: a table built from two small vectors', tone: 'ok' }), hold: 4000 }],
    },
    {
      label: 'Recap',
      title: 'Normalise each row',
      tag: 'recap',
      body: [
        '- **Align** shapes on the right.',
        '- **Compatible** when equal or 1.',
        '- **Stretch** size-1 dimensions, no copy.',
        '- **keepdims=True** keeps the reduced axis as size 1.',
        '- **Watch memory:** pairwise distances build an (n, m, d) temporary.',
      ],
      keyIdea: '`M / M.sum(axis=1, keepdims=True)` divides each row by its own sum.',
      frames: [{ state: values('M / M.sum(axis=1, keepdims=True)', NORM, [2, 3], { text: `row sums ${SUMS.join(' and ')} stretch across the columns, so each row now sums to 1`, tone: 'ok' }) }],
    },
  ],
});
