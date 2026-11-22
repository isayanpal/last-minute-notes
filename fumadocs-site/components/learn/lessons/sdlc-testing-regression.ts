import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the SDLC notes on testing levels and the double-checkout regression. Two checkout requests are interleaved against an order store.
 * Without a guard each request checks and then creates, so both see no order and two orders appear. With a unique guard the second create is rejected.
 * The regression test asserts one order, and it fails on the buggy code and passes after the fix, all computed from the run.
 */

type Req = 'A' | 'B';
type Ev = { who: Req; op: 'check' | 'create' };
const SCHEDULE: Ev[] = [
  { who: 'A', op: 'check' },
  { who: 'B', op: 'check' },
  { who: 'A', op: 'create' },
  { who: 'B', op: 'create' },
];

function run(guard: boolean) {
  const orders: string[] = [];
  const sawNone: Record<Req, boolean> = { A: false, B: false };
  const counts = SCHEDULE.map((e) => {
    if (e.op === 'check') sawNone[e.who] = orders.length === 0;
    else if (guard ? orders.length === 0 : sawNone[e.who]) orders.push(`order-${e.who}`); // the guard makes the check and the insert one step
    return orders.length;
  });
  return { counts, orders: orders.length };
}
const BUGGY = run(false);
const FIXED = run(true);
const regressionTest = (r: { orders: number }) => (r.orders === 1 ? 'pass' : 'fail');

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const levels = (k: number): ArrayState => ({
  rows: [{ label: 'level', cells: ['unit', 'int', 'sys', 'UAT'], states: paint(4, (i) => (i === k ? 'active' : i < k ? 'done' : 'normal')), showIndex: false }],
  stats: [
    { label: 'Scope', value: ['1 function', 'modules', 'whole app', 'the client'][k] },
    { label: 'Owner', value: ['developer', 'dev and QA', 'QA', 'client'][k] },
    { label: 'Regression', value: 're-run each' },
  ],
  note: [{ text: 'unit tests check one function or class in isolation', tone: 'accent' as const }, { text: 'integration tests check modules, like checkout talking to the payment gateway', tone: 'accent' as const }, { text: 'system tests exercise the whole application against the requirements', tone: 'accent' as const }, { text: 'acceptance tests let the client confirm it meets real needs', tone: 'ok' as const }][k],
});

const race = (r: ReturnType<typeof run>, k: number, note: ArrayState['note']): ArrayState => ({
  rows: [
    { label: 'event', cells: SCHEDULE.map((e, i) => (i < k ? `${e.who} ${e.op === 'check' ? 'chk' : 'new'}` : '')), states: paint(4, (i) => (i === k - 1 ? 'active' : i < k ? 'done' : 'dim')), showIndex: false },
    { label: 'orders', cells: r.counts.map((c, i) => (i < k ? c : '')), states: paint(4, (i) => (i < k ? (r.counts[i] > 1 ? 'bad' : 'found') : 'dim')), showIndex: false },
  ],
  stats: [
    { label: 'Orders', value: String(r.counts[k - 1]), tone: r.counts[k - 1] > 1 ? 'bad' : 'ok' },
    { label: 'Requests', value: '2 at once' },
    { label: 'Guard', value: r === FIXED ? 'on' : 'off', tone: r === FIXED ? 'ok' : 'bad' },
  ],
  note,
});

const regression = (): ArrayState => ({
  rows: [
    { label: 'before fix', cells: [regressionTest(BUGGY)], states: { 0: 'bad' }, showIndex: false },
    { label: 'after fix', cells: [regressionTest(FIXED)], states: { 0: 'found' }, showIndex: false },
  ],
  stats: [
    { label: 'Assertion', value: 'orders == 1' },
    { label: 'Buggy code', value: `${BUGGY.orders} orders: ${regressionTest(BUGGY)}`, tone: 'bad' },
    { label: 'Fixed code', value: `${FIXED.orders} order: ${regressionTest(FIXED)}`, tone: 'ok' },
  ],
  note: { text: 'the regression test submits checkout twice at once: it fails on the old code and guards the fix', tone: 'ok' },
});

export default defineLesson('array', {
  slug: 'sdlc-testing-regression',
  objectives: [
    { text: 'How testing levels widen', step: 1 },
    { text: 'How a race creates two orders', step: 2 },
    { text: 'How a guard fixes it', step: 3 },
    { text: 'What a regression test protects', step: 4 },
  ],
  steps: [
    {
      label: 'Levels',
      title: 'From a function to the client',
      tag: 'problem',
      body: ['Testing happens at **four levels** that widen in scope: unit, integration, system and acceptance.', 'Regression testing is not a level. It re-runs the existing tests after any change.'],
      keyIdea: 'Each level catches a different kind of bug.',
      frames: [0, 1, 2, 3].map((k) => ({ state: levels(k), hold: k === 3 ? 3000 : 1900 })),
    },
    {
      label: 'The bug',
      title: 'Double-click, two orders',
      tag: 'concept',
      body: ['Two checkout requests for the same cart arrive together. Each **checks** whether an order exists, then **creates** one.', 'Both check before either creates, so both see nothing, and two orders are made.'],
      keyIdea: 'A check followed by an insert is a race unless it is one atomic step.',
      frames: [1, 2, 3, 4].map((k) => ({ state: race(BUGGY, k, k === 4 ? { text: 'two orders for one cart: the bug QA reported', tone: 'bad' } : { text: ['A checks: no order yet', 'B checks: still no order', 'A creates the order', ''][k - 1], tone: 'accent' }), hold: k === 4 ? 3600 : 1500 })),
    },
    {
      label: 'The fix',
      title: 'Make it one step',
      tag: 'technique',
      body: ['Guard the insert, for example with a unique constraint on the cart, so the check and the create happen together.', 'The second create is rejected and only one order exists.'],
      keyIdea: 'Let the database enforce the rule, not the application timing.',
      frames: [1, 2, 3, 4].map((k) => ({ state: race(FIXED, k, k === 4 ? { text: 'the second create hit the guard: one order', tone: 'ok' } : { text: ['A checks', 'B checks', 'A creates the order', ''][k - 1], tone: 'accent' }), hold: k === 4 ? 3600 : 1500 })),
    },
    {
      label: 'Regression',
      title: 'Never again',
      tag: 'in practice',
      body: ['The team adds a **regression test** that submits checkout twice concurrently and asserts only one order exists.', 'It fails on the old code and passes now, and it runs on every future change.'],
      keyIdea: 'Every fixed bug becomes a permanent test.',
      frames: [{ state: regression(), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Testing across the SDLC',
      tag: 'recap',
      body: [
        '- **Unit, integration, system, acceptance:** widening scope.',
        '- **Regression:** re-run after changes.',
        '- **Races:** need atomic check-and-act.',
        '- **Bug to test:** add a test for every fix.',
        '- **Where:** automated in CI, UAT by the client.',
      ],
      keyIdea: 'Testing is a loop that grows a safety net.',
      frames: [{ state: regression() }],
    },
  ],
});
