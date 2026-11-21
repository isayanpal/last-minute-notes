import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GridState } from '../engines/grid';
import type { Panel } from '../engines/common';

/*
 * Uses the dataset from the SQL Essentials notes. Every stage below is computed from the real rows, so counts match what the query returns:
 *   SELECT dept_id, COUNT(*) AS c FROM employees WHERE salary >= 80
 *   GROUP BY dept_id HAVING COUNT(*) > 1 ORDER BY c DESC, dept_id LIMIT 1
 */

type Emp = { name: string; dept: number | null; salary: number };
const EMPLOYEES: Emp[] = [
  { name: 'Asha', dept: 1, salary: 180 },
  { name: 'Bo', dept: 1, salary: 140 },
  { name: 'Chen', dept: 1, salary: 140 },
  { name: 'Dara', dept: 2, salary: 120 },
  { name: 'Eli', dept: 2, salary: 90 },
  { name: 'Fay', dept: 2, salary: 90 },
  { name: 'Gus', dept: 3, salary: 80 },
  { name: 'Hana', dept: null, salary: 70 },
];
const DEPTS = [
  { id: 1, name: 'Eng' },
  { id: 2, name: 'Sales' },
  { id: 3, name: 'HR' },
  { id: 4, name: 'Legal' },
];

const afterWhere = EMPLOYEES.filter((e) => e.salary >= 80);
const groups = new Map<number, Emp[]>();
for (const e of afterWhere) groups.set(e.dept as number, [...(groups.get(e.dept as number) ?? []), e]);
const afterHaving = [...groups.entries()].filter(([, rows]) => rows.length > 1);
const ordered = afterHaving.map(([dept, rows]) => ({ dept, c: rows.length })).sort((a, b) => b.c - a.c || a.dept - b.dept);
const limited = ordered.slice(0, 1);

const ORDER = ['1 FROM', '2 WHERE', '3 GROUP BY', '4 HAVING', '5 SELECT', '6 ORDER BY', '7 LIMIT'];
const panel = (at: number): Panel[] => [{ title: 'logical order', kind: 'list', items: ORDER, highlight: at }];
const key = (r: number, c: number) => `${r},${c}`;
const GROUP_STATE: Record<number, ItemState> = { 1: 'visited', 2: 'path', 3: 'swap' };

const base = (): GridState['cells'] => EMPLOYEES.map((e) => [e.name, e.dept ?? '-', e.salary]);
const rowStates = (f: (e: Emp, i: number) => ItemState): Record<string, ItemState> => {
  const out: Record<string, ItemState> = {};
  EMPLOYEES.forEach((e, i) => {
    for (let c = 0; c < 3; c++) out[key(i, c)] = f(e, i);
  });
  return out;
};

const baseState = (at: number, f: (e: Emp, i: number) => ItemState, stats: GridState['stats'], note: GridState['note']): GridState => ({
  cells: base(),
  colHeaders: ['name', 'dept_id', 'salary'],
  states: rowStates(f),
  panels: panel(at),
  stats,
  note,
});

// Step 1: the order you write is not the order it runs.
const writeOrder: GridState = {
  cells: base(),
  colHeaders: ['name', 'dept_id', 'salary'],
  panels: [{ title: 'you write', kind: 'list', items: ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT'], highlight: 0 }],
  stats: [
    { label: 'You write', value: 'SELECT first' },
    { label: 'It runs', value: 'FROM first' },
    { label: 'Rows in', value: String(EMPLOYEES.length) },
  ],
  note: { text: 'the database evaluates clauses in a different logical order', tone: 'accent' },
};

// Step 2: FROM builds the row set, WHERE filters rows.
const from = baseState(0, () => 'normal', [{ label: 'Rows', value: String(EMPLOYEES.length) }, { label: 'Stage', value: 'FROM' }, { label: 'Joins', value: 'happen here' }], { text: 'FROM and JOIN build the full row set first', tone: 'accent' });
const where = baseState(
  1,
  (e) => (e.salary >= 80 ? 'found' : 'bad'),
  [{ label: 'Kept', value: `${afterWhere.length} of ${EMPLOYEES.length}`, tone: 'ok' }, { label: 'Dropped', value: EMPLOYEES.filter((e) => e.salary < 80).map((e) => e.name).join(', '), tone: 'bad' }, { label: 'Aliases', value: 'not yet' }],
  { text: 'WHERE filters rows, so it cannot see SELECT aliases or aggregates', tone: 'bad' },
);

// Step 3: GROUP BY forms groups, HAVING filters groups.
const group = baseState(
  2,
  (e) => (e.salary < 80 ? 'dim' : GROUP_STATE[e.dept as number]),
  [{ label: 'Groups', value: String(groups.size) }, { label: 'Sizes', value: [...groups.values()].map((g) => g.length).join(', ') }, { label: 'Stage', value: 'GROUP BY' }],
  { text: 'rows with the same dept_id fall into one group', tone: 'accent' },
);
const having = baseState(
  3,
  (e) => (e.salary < 80 ? 'dim' : (groups.get(e.dept as number)!.length > 1 ? GROUP_STATE[e.dept as number] : 'dim')),
  [{ label: 'Groups kept', value: `${afterHaving.length} of ${groups.size}`, tone: 'ok' }, { label: 'Condition', value: 'COUNT(*) > 1' }, { label: 'Aggregates', value: 'allowed here', tone: 'ok' }],
  { text: 'HAVING filters whole groups, and can use aggregates', tone: 'ok' },
);

// Step 4: SELECT computes columns, ORDER BY can use aliases, LIMIT cuts.
const resultGrid = (rows: { dept: number; c: number }[], at: number, note: GridState['note'], stats: GridState['stats']): GridState => ({
  cells: rows.map((r) => [r.dept, r.c]),
  colHeaders: ['dept_id', 'c'],
  states: Object.fromEntries(rows.flatMap((_, i) => [[key(i, 0), 'found'], [key(i, 1), 'found']])) as Record<string, ItemState>,
  panels: panel(at),
  stats,
  note,
});
const select = resultGrid(afterHaving.map(([dept, rows]) => ({ dept, c: rows.length })), 4, { text: 'SELECT creates the alias c, which exists only from here on', tone: 'accent' }, [{ label: 'Columns', value: 'dept_id, c' }, { label: 'Alias c', value: 'created now' }, { label: 'Rows', value: String(afterHaving.length) }]);
const orderBy = resultGrid(ordered, 5, { text: 'ORDER BY runs after SELECT, so it can use the alias', tone: 'ok' }, [{ label: 'Sort', value: 'c DESC, id' }, { label: 'Tie', value: 'dept_id' }, { label: 'Alias c', value: 'usable', tone: 'ok' }]);
const limit = resultGrid(limited, 6, { text: 'LIMIT keeps the first row of the sorted result', tone: 'ok' }, [{ label: 'Result', value: `dept ${limited[0].dept}, c ${limited[0].c}`, tone: 'ok' }, { label: 'Rows', value: '1' }, { label: 'Window fns', value: 'before SELECT' }]);

// Step 5: the LEFT JOIN trap. A WHERE on the right table throws away the unmatched rows.
const highPaid = (d: { id: number }) => EMPLOYEES.filter((e) => e.dept === d.id && e.salary > 100).length;
const leftJoin = (inWhere: boolean): GridState => {
  const rows = DEPTS.map((d) => ({ name: d.name, n: highPaid(d) })).filter((r) => !inWhere || r.n > 0);
  return {
    cells: rows.map((r) => [r.name, r.n]),
    colHeaders: ['department', 'salary > 100'],
    states: Object.fromEntries(rows.flatMap((r, i) => [[key(i, 0), r.n ? 'found' : 'swap'], [key(i, 1), r.n ? 'found' : 'swap']])) as Record<string, ItemState>,
    panels: [{ title: inWhere ? 'filter in WHERE' : 'filter in ON', kind: 'list', items: inWhere ? ['LEFT JOIN e', 'WHERE salary>100', 'NULL rows fail', 'acts as INNER'] : ['LEFT JOIN e', 'ON salary>100', 'NULL rows stay', 'all depts kept'], highlight: inWhere ? 3 : 3 }],
    stats: [
      { label: 'Departments', value: `${rows.length} of ${DEPTS.length}`, tone: inWhere ? 'bad' : 'ok' },
      { label: 'Filter in', value: inWhere ? 'WHERE' : 'ON' },
      { label: 'Result', value: inWhere ? 'inner join' : 'left join', tone: inWhere ? 'bad' : 'ok' },
    ],
    note: inWhere ? { text: 'HR and Legal vanished: the NULL rows failed the WHERE', tone: 'bad' } : { text: 'put the condition in ON to keep unmatched rows', tone: 'ok' },
  };
};

export default defineLesson('grid', {
  slug: 'db-query-execution',
  objectives: [
    { text: 'Why SQL is written in one order and run in another', step: 1 },
    { text: 'What FROM and WHERE do to the row set', step: 2 },
    { text: 'How GROUP BY and HAVING differ', step: 3 },
    { text: 'Why ORDER BY can use aliases but WHERE cannot', step: 4 },
    { text: 'How a WHERE on a LEFT JOIN silently becomes an INNER JOIN', step: 5 },
  ],
  steps: [
    {
      label: 'Two orders',
      title: 'Written order is not run order',
      tag: 'problem',
      body: ['You write `SELECT` first, but the database evaluates `FROM` first. That explains most "why can I not use my alias here" errors.', 'Watch one query move through the stages on the real employee rows.'],
      keyIdea: 'The optimizer may reorder joins and push filters down, but results are as if the logical order applied.',
      frames: [{ state: writeOrder, hold: 2800 }],
    },
    {
      label: 'FROM, WHERE',
      title: 'Build the rows, then filter',
      tag: 'concept',
      body: ['`FROM` and `JOIN` build the row set. `WHERE` then filters individual rows.', 'At this point no aliases or aggregates exist yet, so `WHERE` cannot use either.'],
      keyIdea: 'Use `HAVING` to filter on an aggregate, never `WHERE`.',
      frames: [{ state: from, hold: 1600 }, { state: where, hold: 3000 }],
    },
    {
      label: 'GROUP, HAVING',
      title: 'Form groups, then filter groups',
      tag: 'concept',
      body: ['`GROUP BY` collects rows with the same key into groups. `HAVING` filters whole groups, and it may use aggregates like `COUNT(*)`.', 'Window functions run after both, so you cannot filter on them directly. Wrap them in a CTE.'],
      keyIdea: '`WHERE` removes rows before grouping. `HAVING` removes groups after.',
      frames: [{ state: group, hold: 2400 }, { state: having, hold: 3000 }],
    },
    {
      label: 'SELECT, ORDER',
      title: 'Aliases appear at SELECT',
      tag: 'technique',
      body: ['`SELECT` computes the output columns and aliases. `DISTINCT`, `ORDER BY` and `LIMIT` run after it.', 'That is why `ORDER BY c` works while `WHERE c > 1` does not.'],
      keyIdea: 'Add a unique tiebreaker to `ORDER BY` so `LIMIT` returns the same row every time.',
      frames: [{ state: select, hold: 2200 }, { state: orderBy, hold: 2400 }, { state: limit, hold: 3000 }],
    },
    {
      label: 'LEFT JOIN trap',
      title: 'WHERE can undo your LEFT JOIN',
      tag: 'trade-off',
      body: ['A `LEFT JOIN` keeps left rows that have no match by filling the right side with `NULL`.', 'Filtering the right table in `WHERE` makes those `NULL` rows fail, so the query behaves like an inner join. Put the condition in `ON`.'],
      keyIdea: 'Also watch fan-out: joining a one-to-many table multiplies rows, so `SUM` on the parent side double counts.',
      frames: [{ state: leftJoin(true), hold: 3000 }, { state: leftJoin(false), hold: 3200 }],
    },
    {
      label: 'Recap',
      title: 'The logical order',
      tag: 'recap',
      body: [
        '- **Run order:** FROM, WHERE, GROUP BY, HAVING, SELECT, DISTINCT, ORDER BY, LIMIT.',
        '- **WHERE** filters rows, **HAVING** filters groups.',
        '- **Aliases** exist from SELECT on, so ORDER BY can use them.',
        '- **LEFT JOIN:** put right-table filters in `ON`.',
        '- **Ties:** add a unique tiebreaker before `LIMIT`.',
      ],
      keyIdea: 'When a query surprises you, replay it stage by stage and count the rows at each one.',
      frames: [{ state: limit }],
    },
  ],
});
