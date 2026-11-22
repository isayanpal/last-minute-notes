import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

const py = (xs: number[]) => `[${xs.join(', ')}]`;

/*
 * Follows the Python notes on names, objects and references: a name is bound to an object, assignment never copies, mutation is shared,
 * rebinding is local, and arguments are passed by object reference. A small environment of names and a heap of lists runs the notes' own
 * statements, so every snapshot (and the final [1, 99]) is computed.
 */

type Snap = { names: [string, string][]; heap: Record<string, number[]> };

class Env {
  heap = new Map<string, number[]>();
  names = new Map<string, string>();
  private next = 1;
  list(values: number[]) {
    const id = `#${this.next++}`;
    this.heap.set(id, values);
    return id;
  }
  bind(name: string, id: string) {
    this.names.set(name, id);
  }
  unbind(name: string) {
    this.names.delete(name);
  }
  snap(): Snap {
    return { names: [...this.names.entries()], heap: Object.fromEntries([...this.heap.entries()].map(([k, v]) => [k, [...v]])) };
  }
  get(name: string) {
    return this.heap.get(this.names.get(name)!)!;
  }
  isSame(a: string, b: string) {
    return this.names.get(a) === this.names.get(b);
  }
}

// a = [1, 2, 3]; b = a; b.append(4); b = [9]
const e1 = new Env();
e1.bind('a', e1.list([1, 2, 3]));
const S0 = e1.snap();
e1.bind('b', e1.names.get('a')!);
const S1 = e1.snap();
const SAME = e1.isSame('a', 'b');
e1.get('b').push(4);
const S2 = e1.snap();
e1.bind('b', e1.list([9]));
const S3 = e1.snap();
const A_AFTER = [...e1.get('a')];

// def mutate(lst): lst.append(99);  def rebind(lst): lst = [0]
const e2 = new Env();
e2.bind('nums', e2.list([1]));
const T0 = e2.snap();
e2.bind('lst', e2.names.get('nums')!); // calling mutate(nums) binds the parameter
const T1 = e2.snap();
e2.get('lst').push(99);
const T2 = e2.snap();
e2.unbind('lst'); // mutate returns, its local name disappears
e2.bind('lst', e2.names.get('nums')!); // calling rebind(nums)
e2.bind('lst', e2.list([0])); // lst = [0] rebinds the local name only
const T3 = e2.snap();
const NUMS_AFTER = [...e2.get('nums')];

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });
const NAME_Y = [0.6, 2.9];

const view = (s: Snap, note: FlowState['note'], extra: { packets?: Packet[]; stats?: FlowState['stats']; fresh?: string[] } = {}): FlowState => {
  const ids = Object.keys(s.heap);
  const nodes: FlowNode[] = [
    ...s.names.map(([n], i): FlowNode => ({ id: `n-${n}`, label: n, sub: 'name', kind: 'client', x: 0.2, y: NAME_Y[i] ?? 3.0, size: 'sm', status: 'active' })),
    ...ids.map((id, i): FlowNode => ({ id, label: `list ${id}`, sub: `refs: ${s.names.filter(([, t]) => t === id).length}`, kind: 'storage', x: 4.5, y: ids.length === 1 ? 1.7 : 0.6 + i * 2.3, status: extra.fresh?.includes(id) ? 'hot' : 'normal', items: s.heap[id].slice(0, 4).map(String) })),
  ];
  return {
    nodes,
    links: s.names.map(([n, t]) => ({ from: `n-${n}`, to: t })),
    packets: extra.packets ?? [],
    stats: extra.stats ?? [{ label: 'Names', value: String(s.names.length) }, { label: 'Objects', value: String(ids.length) }, { label: 'Copies made', value: '0', tone: 'ok' }],
    note,
  };
};

export default defineLesson('flow', {
  slug: 'py-names-references',
  objectives: [
    { text: 'Why b = a copies nothing', step: 1 },
    { text: 'Why mutation through one name shows in the other', step: 2 },
    { text: 'Why rebinding a name leaves the other alone', step: 3 },
    { text: 'How function arguments behave', step: 4 },
  ],
  steps: [
    {
      label: 'Binding',
      title: 'A name, not a box',
      tag: 'problem',
      body: ['A Python variable is a **name bound to an object**. `a = [1, 2, 3]` creates a list and binds `a` to it.', '`b = a` binds a second name to the **same** list. Nothing is copied.'],
      keyIdea: '`a is b` is `True` because both names point at one object.',
      frames: [{ state: view(S0, { text: 'a names a new list', tone: 'accent' }), hold: 2200 }, { state: view(S1, { text: `b = a: one list, two names, a is b is ${SAME ? 'True' : 'False'}`, tone: 'ok' }, { packets: [hop('n-b', '#1', 'same object', 0, 'ok')] }), hold: 3400 }],
    },
    {
      label: 'Mutation',
      title: 'Both names see it',
      tag: 'concept',
      body: ['`b.append(4)` changes the list object itself.', 'Because `a` names the same object, `print(a)` shows `[1, 2, 3, 4]`.'],
      keyIdea: 'Mutating shared state is the source of many aliasing bugs.',
      frames: [{ state: view(S2, { text: 'append mutated the one list, so a sees [1, 2, 3, 4]', tone: 'accent' }, { packets: [hop('n-b', '#1', 'append(4)', 0, 'data')] }), hold: 3800 }],
    },
    {
      label: 'Rebinding',
      title: 'A new object, a new binding',
      tag: 'technique',
      body: ['`b = [9]` creates a **new** list and rebinds only `b`.', `The old list is untouched, so \`a\` is still ${py(A_AFTER)}.`],
      keyIdea: 'Assignment rebinds a name, it never writes into the old object.',
      frames: [{ state: view(S3, { text: 'b now names a different list, and a still names the first one', tone: 'ok' }, { fresh: ['#2'], packets: [hop('n-b', '#2', 'rebind', 0, 'ok')] }), hold: 4000 }],
    },
    {
      label: 'Arguments',
      title: 'Pass by object reference',
      tag: 'trade-off',
      body: ['A function receives a reference to the object, bound to its parameter name. `mutate(lst)` can change the list, `rebind(lst)` only repoints its local name.', 'The caller\'s list ends up as `[1, 99]`.'],
      keyIdea: 'Mutating a parameter is visible to the caller, rebinding it is not.',
      frames: [{ state: view(T1, { text: 'calling mutate(nums) binds the parameter lst to the same list', tone: 'accent' }), hold: 2200 }, { state: view(T2, { text: 'lst.append(99) mutates the shared list, the caller sees it', tone: 'ok' }, { packets: [hop('n-lst', '#1', 'append(99)', 0, 'data')] }), hold: 3000 }, { state: view(T3, { text: `lst = [0] rebinds only the local name: nums is still ${py(NUMS_AFTER)}`, tone: 'ok' }, { fresh: ['#2'] }), hold: 4000 }],
    },
    {
      label: 'Recap',
      title: 'Names and objects',
      tag: 'recap',
      body: [
        '- **Name:** a binding to an object.',
        '- **Assignment:** rebinds, never copies.',
        '- **Mutation:** shared by every name for the object.',
        '- **Arguments:** references passed by value.',
        '- **Copies:** `copy.copy` and `copy.deepcopy` make real ones.',
      ],
      keyIdea: '`==` compares values, `is` compares identity.',
      frames: [{ state: view(S3, { text: 'two lists, two names: identity follows the binding', tone: 'accent' }, { fresh: ['#2'] }) }],
    },
  ],
});
