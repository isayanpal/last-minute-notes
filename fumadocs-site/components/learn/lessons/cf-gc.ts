import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Computer Fundamentals notes on garbage collection: reference counting frees immediately but leaks cycles,
 * mark and sweep traces from the roots and handles cycles. A real object graph runs both collectors, so the counts, the leak and the
 * mark order are computed.
 */

type Obj = { id: string; refs: string[] };
const GRAPH: Obj[] = [
  { id: 'A', refs: ['B'] },
  { id: 'B', refs: [] },
  { id: 'E', refs: [] },
  { id: 'C', refs: ['D'] },
  { id: 'D', refs: ['C'] },
];
const ROOT_REFS = ['A', 'E', 'C'];

const counts = (objs: Obj[], rootRefs: string[], alive: Set<string>) => {
  const c: Record<string, number> = Object.fromEntries(objs.map((o) => [o.id, 0]));
  rootRefs.forEach((r) => c[r]++);
  objs.filter((o) => alive.has(o.id)).forEach((o) => o.refs.forEach((r) => c[r]++));
  return c;
};
/** Reference counting: free any object whose count is 0, and let the frees cascade. */
function refcountCollect(objs: Obj[], rootRefs: string[]) {
  const alive = new Set(objs.map((o) => o.id));
  let changed = true;
  while (changed) {
    changed = false;
    const c = counts(objs, rootRefs, alive);
    for (const id of [...alive]) if (c[id] === 0) {
      alive.delete(id);
      changed = true;
    }
  }
  return alive;
}
/** Mark and sweep: mark everything reachable from the roots, sweep the rest. */
function mark(objs: Obj[], rootRefs: string[]) {
  const by = new Map(objs.map((o) => [o.id, o]));
  const order: string[] = [];
  const stack = [...rootRefs];
  while (stack.length) {
    const id = stack.pop()!;
    if (order.includes(id)) continue;
    order.push(id);
    by.get(id)!.refs.forEach((r) => stack.push(r));
  }
  return order;
}

const START = new Set(GRAPH.map((o) => o.id));
const ROOTS_AFTER_E = ROOT_REFS.filter((r) => r !== 'E'); // the program drops its reference to E
const ROOTS_AFTER_C = ROOTS_AFTER_E.filter((r) => r !== 'C'); // and then to the C and D cycle
const ALIVE_AFTER_E = refcountCollect(GRAPH, ROOTS_AFTER_E);
const ALIVE_AFTER_C = refcountCollect(GRAPH, ROOTS_AFTER_C);
const LEAKED = [...ALIVE_AFTER_C].filter((id) => !mark(GRAPH, ROOTS_AFTER_C).includes(id));
const MARKED = mark(GRAPH, ROOTS_AFTER_C);

const POS: Record<string, { x: number; y: number }> = {
  root: { x: 0.1, y: 1.7 },
  A: { x: 2.0, y: 0.4 },
  B: { x: 4.0, y: 0.4 },
  E: { x: 2.0, y: 1.7 },
  C: { x: 2.0, y: 3.0 },
  D: { x: 4.0, y: 3.0 },
};
const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.5 });

type Mode = { rootRefs: string[]; alive: Set<string>; rc?: boolean; marked?: string[]; gray?: string; leaked?: string[] };
const view = (m: Mode, note: FlowState['note'], stats: FlowState['stats'], packets: Packet[] = []): FlowState => {
  const c = counts(GRAPH, m.rootRefs, m.alive);
  const nodes: FlowNode[] = [
    { id: 'root', label: 'Roots', sub: 'stack, globals', kind: 'monitor', ...POS.root, status: 'active' },
    ...GRAPH.map((o): FlowNode => {
      const alive = m.alive.has(o.id);
      const leaked = m.leaked?.includes(o.id);
      const black = m.marked?.includes(o.id);
      return {
        id: o.id,
        label: `Object ${o.id}`,
        sub: !alive ? 'freed' : leaked ? 'leaked' : black ? 'reachable' : 'allocated',
        kind: 'service',
        ...POS[o.id],
        status: !alive ? 'dim' : leaked ? 'hot' : black || !m.marked ? 'active' : 'normal',
        items: !alive ? undefined : m.rc ? [`rc ${c[o.id]}`] : m.marked ? [m.gray === o.id ? 'gray' : black ? 'black' : 'white'] : undefined,
      };
    }),
  ];
  const links = [
    ...m.rootRefs.map((r) => ({ from: 'root', to: r })),
    ...GRAPH.filter((o) => m.alive.has(o.id)).flatMap((o) => o.refs.filter((r) => m.alive.has(r)).map((r) => ({ from: o.id, to: r }))),
  ];
  return { nodes, links, packets, stats, note };
};

export default defineLesson('flow', {
  slug: 'cf-gc',
  objectives: [
    { text: 'How reference counting tracks liveness', step: 1 },
    { text: 'Why it frees objects immediately', step: 2 },
    { text: 'Why a reference cycle leaks', step: 3 },
    { text: 'How mark and sweep handles cycles', step: 4 },
  ],
  steps: [
    {
      label: 'Counting',
      title: 'Count the references',
      tag: 'problem',
      body: ['**Reference counting** stores a count on each object: how many references point at it. Roots hold references too.', 'When the count reaches 0, nothing can reach the object.'],
      keyIdea: 'Used by CPython (with a cycle detector) and by Swift as ARC.',
      frames: [{ state: view({ rootRefs: ROOT_REFS, alive: START, rc: true }, { text: 'each object shows its count: C and D reference each other', tone: 'accent' }, [{ label: 'Objects', value: String(GRAPH.length) }, { label: 'Roots point at', value: String(ROOT_REFS.length) }, { label: 'Cycle', value: 'C and D' }]), hold: 4400 }],
    },
    {
      label: 'Immediate',
      title: 'Freed at zero',
      tag: 'concept',
      body: ['The program drops its reference to `E`. The count hits 0 and `E` is freed **immediately**.', 'Reclamation is prompt and predictable.'],
      keyIdea: 'The cost is updating counts, which must be atomic across threads.',
      frames: [{ state: view({ rootRefs: ROOTS_AFTER_E, alive: ALIVE_AFTER_E, rc: true }, { text: 'E had one reference, now none: it is gone at once', tone: 'ok' }, [{ label: 'Freed', value: [...START].filter((x) => !ALIVE_AFTER_E.has(x)).join(', ') || '-', tone: 'ok' }, { label: 'Alive', value: String(ALIVE_AFTER_E.size) }, { label: 'Leaked', value: '0', tone: 'ok' }]), hold: 4000 }],
    },
    {
      label: 'Cycle',
      title: 'Two objects keep each other alive',
      tag: 'trade-off',
      body: ['Now the program drops its reference to the cycle. `C` and `D` still point at each other, so both counts stay at 1.', 'Nothing can reach them, but counting never frees them: a **leak**.'],
      keyIdea: 'Reference counting needs a separate cycle collector, or weak references.',
      frames: [{ state: view({ rootRefs: ROOTS_AFTER_C, alive: ALIVE_AFTER_C, rc: true, leaked: LEAKED }, { text: `${LEAKED.join(' and ')} are unreachable but their counts are not 0`, tone: 'bad' }, [{ label: 'Leaked', value: LEAKED.join(', '), tone: 'bad' }, { label: 'Counts', value: 'C 1, D 1', tone: 'bad' }, { label: 'Reachable', value: 'no' }]), hold: 4600 }],
    },
    {
      label: 'Mark, sweep',
      title: 'Trace from the roots',
      tag: 'technique',
      body: ['**Mark and sweep** starts at the roots and marks everything it can reach. White objects are unseen, gray are seen with children unscanned, black are done.', 'Everything still white is garbage, cycles included.'],
      keyIdea: 'Cost is tracing live data, and the price is pauses or write barriers.',
      frames: [
        { state: view({ rootRefs: ROOTS_AFTER_C, alive: START, marked: [], gray: undefined }, { text: 'before marking every object is white', tone: 'accent' }, [{ label: 'Marked', value: '0' }, { label: 'Roots', value: String(ROOTS_AFTER_C.length) }, { label: 'Phase', value: 'start' }]), hold: 2200 },
        { state: view({ rootRefs: ROOTS_AFTER_C, alive: START, marked: MARKED }, { text: `marking from the roots reaches ${MARKED.join(', ')}`, tone: 'ok' }, [{ label: 'Marked', value: MARKED.join(', '), tone: 'ok' }, { label: 'Unmarked', value: GRAPH.filter((o) => !MARKED.includes(o.id)).map((o) => o.id).join(', '), tone: 'bad' }, { label: 'Phase', value: 'mark' }]), hold: 3600 },
        { state: view({ rootRefs: ROOTS_AFTER_C, alive: new Set(MARKED), marked: MARKED }, { text: 'sweep frees the unmarked objects: the cycle is collected', tone: 'ok' }, [{ label: 'Freed', value: GRAPH.filter((o) => !MARKED.includes(o.id)).map((o) => o.id).join(', '), tone: 'ok' }, { label: 'Leaked', value: '0', tone: 'ok' }, { label: 'Phase', value: 'sweep' }]), hold: 4200 },
      ],
    },
    {
      label: 'Recap',
      title: 'Two collectors',
      tag: 'recap',
      body: [
        '- **Reference counting:** immediate, leaks cycles.',
        '- **Mark and sweep:** handles cycles, needs pauses.',
        '- **Roots:** stack variables, registers, globals.',
        '- **Generational:** young objects collected often.',
        '- **Leaks remain:** reachable but unneeded objects.',
      ],
      keyIdea: 'GC frees the unreachable, never the reachable but forgotten.',
      frames: [{ state: view({ rootRefs: ROOTS_AFTER_C, alive: new Set(MARKED), marked: MARKED }, { text: 'tracing from the roots found what counting could not', tone: 'ok' }, [{ label: 'Alive', value: MARKED.join(', ') }, { label: 'Freed', value: 'C, D, E' }, { label: 'Cycles', value: 'handled', tone: 'ok' }]) }],
    },
  ],
});
