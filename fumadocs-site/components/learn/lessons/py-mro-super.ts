import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Python notes on inheritance, the MRO and super(). A real C3 linearization computes the order of M(L, R) where L and R both
 * extend Base, super() walks that order for real and prints M, L, R, Base, and the inconsistent hierarchy Z(X, Y) with Y(X) makes
 * the C3 merge fail, which is the TypeError in the notes.
 */

type Cls = { name: string; bases: string[] };
const DIAMOND: Cls[] = [
  { name: 'object', bases: [] },
  { name: 'Base', bases: ['object'] },
  { name: 'L', bases: ['Base'] },
  { name: 'R', bases: ['Base'] },
  { name: 'M', bases: ['L', 'R'] },
];
const BAD: Cls[] = [
  { name: 'object', bases: [] },
  { name: 'X', bases: ['object'] },
  { name: 'Y', bases: ['X'] },
  { name: 'Z', bases: ['X', 'Y'] },
];

/** C3 merge: returns null when no consistent order exists. */
function c3(name: string, table: Cls[]): string[] | null {
  const by = new Map(table.map((c) => [c.name, c]));
  const cls = by.get(name)!;
  const seqs: string[][] = [];
  for (const b of cls.bases) {
    const m = c3(b, table);
    if (!m) return null;
    seqs.push(m);
  }
  seqs.push([...cls.bases]);
  const out = [name];
  const work = seqs.map((s) => [...s]).filter((s) => s.length);
  while (work.length) {
    const head = work.map((s) => s[0]).find((h) => work.every((s) => !s.slice(1).includes(h)));
    if (!head) return null; // no consistent linearization
    out.push(head);
    for (const s of work) if (s[0] === head) s.shift();
    for (let i = work.length - 1; i >= 0; i--) if (!work[i].length) work.splice(i, 1);
  }
  return out;
}

const MRO = c3('M', DIAMOND)!;
const BAD_MRO = c3('Z', BAD);

/** super().__init__() in each class: print the name, then call the next class in the instance's MRO. */
const printed: string[] = [];
function runInit(order: string[], at: number) {
  const cls = order[at];
  if (cls === 'object') return;
  printed.push(cls);
  runInit(order, at + 1);
}
runInit(MRO, 0);

const POS: Record<string, { x: number; y: number }> = { M: { x: 0.1, y: 1.7 }, L: { x: 1.9, y: 0.5 }, R: { x: 1.9, y: 2.9 }, Base: { x: 3.8, y: 1.7 }, object: { x: 5.6, y: 1.7 } };
const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });
const inherits = DIAMOND.filter((c) => c.name !== 'object').flatMap((c) => c.bases.map((b) => ({ from: c.name, to: b })));

const view = (note: FlowState['note'], stats: FlowState['stats'], opts: { order?: string[]; active?: string; packets?: Packet[] } = {}): FlowState => ({
  nodes: DIAMOND.map((c): FlowNode => ({
    id: c.name,
    label: c.name === 'M' ? 'M(L, R)' : c.name,
    sub: c.bases.length ? `extends ${c.bases.join(', ')}` : 'root',
    kind: 'service',
    ...POS[c.name],
    status: opts.active === c.name ? 'active' : opts.order && opts.order.indexOf(c.name) > opts.order.indexOf(opts.active ?? '') && opts.active ? 'dim' : 'normal',
    items: opts.order ? [`mro ${opts.order.indexOf(c.name) + 1}`] : undefined,
  })),
  links: inherits,
  packets: opts.packets ?? [],
  stats,
  note,
});

const badView = (): FlowState => {
  const pos: Record<string, { x: number; y: number }> = { Z: { x: 0.1, y: 1.7 }, Y: { x: 2.4, y: 1.7 }, X: { x: 4.2, y: 1.7 } };
  return {
    nodes: BAD.filter((c) => c.name !== 'object').map((c): FlowNode => ({ id: c.name, label: c.name === 'Z' ? 'Z(X, Y)' : c.name === 'Y' ? 'Y(X)' : 'X', sub: c.name === 'Z' ? 'cannot linearize' : 'class', kind: 'service', ...pos[c.name], status: c.name === 'Z' ? 'down' : 'normal' })),
    links: [{ from: 'Z', to: 'Y' }, { from: 'Y', to: 'X' }, { from: 'Z', to: 'X', dashed: true }],
    packets: [hop('Z', 'X', 'X before Y?', 0, 'bad')],
    stats: [
      { label: 'Wanted', value: 'X before Y', tone: 'bad' },
      { label: 'But Y(X)', value: 'Y before X', tone: 'bad' },
      { label: 'C3', value: BAD_MRO ? 'found' : 'no order', tone: BAD_MRO ? 'ok' : 'bad' },
    ],
    note: { text: 'Z wants X before Y, but Y must precede its base X: no order fits, so class creation raises TypeError', tone: 'bad' },
  };
};

export default defineLesson('flow', {
  slug: 'py-mro-super',
  objectives: [
    { text: 'What the diamond looks like', step: 1 },
    { text: 'How C3 orders the classes', step: 2 },
    { text: 'What super() really calls', step: 3 },
    { text: 'When no order exists', step: 4 },
  ],
  steps: [
    {
      label: 'Diamond',
      title: 'Two paths to Base',
      tag: 'problem',
      body: ['`M(L, R)` inherits from `L` and `R`, and both inherit from `Base`. Python allows multiple inheritance.', 'When `M` calls a method, which class is searched first?'],
      keyIdea: 'The answer is the Method Resolution Order, computed once per class.',
      frames: [{ state: view({ text: 'Base is reachable through both L and R', tone: 'accent' }, [{ label: 'Classes', value: String(DIAMOND.length - 1) }, { label: 'Paths to Base', value: '2' }, { label: 'Question', value: 'who first?' }]), hold: 3800 }],
    },
    {
      label: 'C3',
      title: 'Children before parents',
      tag: 'concept',
      body: ['Python uses **C3 linearization**: children come before their parents, and the left-to-right order of the bases is kept.', `For \`M(L, R)\` that gives ${MRO.join(', ')}.`],
      keyIdea: '`M.__mro__` is `(M, L, R, Base, object)`.',
      frames: [{ state: view({ text: `MRO: ${MRO.join(' > ')}`, tone: 'ok' }, [{ label: 'MRO length', value: String(MRO.length) }, { label: 'Rule 1', value: 'child first' }, { label: 'Rule 2', value: 'left to right' }], { order: MRO }), hold: 4600 }],
    },
    {
      label: 'super()',
      title: 'Next in the instance\'s MRO',
      tag: 'technique',
      body: ['`super()` does **not** mean "my parent". It means the next class in the MRO of the **instance**.', 'So `L`\'s `super().__init__()` calls `R`, a class `L` knows nothing about.'],
      keyIdea: 'Cooperative inheritance: every class calls `super()` and passes unused arguments on.',
      frames: MRO.filter((c) => c !== 'object').map((c, k, arr) => ({
        state: view({ text: k === arr.length - 1 ? `all four ran: ${printed.join(', ')}` : `${c} prints its name, then super() moves to ${MRO[k + 1]}`, tone: 'accent' }, [{ label: 'Printed', value: printed.slice(0, k + 1).join(' ') }, { label: 'Running', value: c }, { label: 'super() goes to', value: MRO[k + 1], tone: 'ok' }], { order: MRO, active: c, packets: MRO[k + 1] ? [hop(c, MRO[k + 1], 'super()', 0, 'ok')] : [] }),
        hold: k === arr.length - 1 ? 3800 : 1600,
      })),
    },
    {
      label: 'No order',
      title: 'Inconsistent hierarchies',
      tag: 'trade-off',
      body: ['`class Z(X, Y)` with `class Y(X)` asks for X before Y, but Y must come before its own base X.', 'C3 finds no consistent order and raises `TypeError: Cannot create a consistent method resolution order`.'],
      keyIdea: 'List the more specific base first: `Z(Y, X)` works.',
      frames: [{ state: badView(), hold: 4600 }],
    },
    {
      label: 'Recap',
      title: 'MRO and super()',
      tag: 'recap',
      body: [
        '- **MRO:** C3 linearization of the class.',
        '- **Rules:** children first, base order kept.',
        '- **super():** next class in the instance\'s MRO.',
        '- **Mixins:** put them left of the main base.',
        '- **Failure:** an inconsistent order is a TypeError.',
      ],
      keyIdea: 'Prefer duck typing and composition when the hierarchy gets tangled.',
      frames: [{ state: view({ text: `${MRO.join(' > ')}`, tone: 'ok' }, [{ label: 'MRO length', value: String(MRO.length) }, { label: 'Printed', value: printed.join(' ') }, { label: 'Consistent', value: 'yes', tone: 'ok' }], { order: MRO }) }],
    },
  ],
});
