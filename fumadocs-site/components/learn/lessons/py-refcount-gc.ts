import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Python notes on reference counting and the cycle collector. A real object graph tracks refcounts, frees objects at zero,
 * leaks the A and B cycle, and then runs the notes' gc_ref algorithm (copy the refcount, subtract references between tracked objects,
 * keep what is referenced from outside plus everything reachable from it), so every count and verdict is computed.
 */

type Obj = { id: string; refs: string[] };
const OBJS: Obj[] = [
  { id: 'A', refs: ['B'] },
  { id: 'B', refs: ['A'] },
  { id: 'C', refs: ['D'] },
  { id: 'D', refs: [] },
];
const EXTERNAL: Record<string, number> = { A: 0, B: 0, C: 1, D: 0 }; // C is held by the name c, the A and B names were deleted

const refcounts = (objs: Obj[], external: Record<string, number>) => {
  const rc: Record<string, number> = { ...external };
  objs.forEach((o) => o.refs.forEach((r) => (rc[r] = (rc[r] ?? 0) + 1)));
  return rc;
};
const RC = refcounts(OBJS, EXTERNAL);

/** gc_ref algorithm from the notes. */
function cycleGc(objs: Obj[], rc: Record<string, number>) {
  const gcRef: Record<string, number> = { ...rc }; // 1. copy each refcount
  objs.forEach((o) => o.refs.forEach((r) => gcRef[r]--)); // 2. subtract one per reference between tracked objects
  const reachable = new Set(objs.filter((o) => gcRef[o.id] > 0).map((o) => o.id)); // 3. gc_ref > 0: referenced from outside
  const stack = [...reachable];
  while (stack.length) {
    const id = stack.pop()!;
    const o = objs.find((x) => x.id === id)!;
    o.refs.forEach((r) => {
      if (!reachable.has(r)) {
        reachable.add(r);
        stack.push(r);
      }
    });
  }
  return { gcRef, reachable, garbage: objs.filter((o) => !reachable.has(o.id)).map((o) => o.id) };
}
const GC = cycleGc(OBJS, RC);

// Step 1: refcount of one list as names come and go.
const lifeline = [
  { what: 'x = []', rc: 1, names: ['x'] },
  { what: 'y = x', rc: 2, names: ['x', 'y'] },
  { what: 'del y', rc: 1, names: ['x'] },
  { what: 'del x', rc: 0, names: [] as string[] },
];

// Step 2: a weak reference does not count.
const weak = (deleted: boolean) => ({ rc: deleted ? 0 : 1, alive: !deleted, call: deleted ? 'None' : 'Node' });

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });

const life = (k: number): FlowState => {
  const s = lifeline[k];
  const nodes: FlowNode[] = [
    ...s.names.map((n, i): FlowNode => ({ id: `n-${n}`, label: n, sub: 'name', kind: 'client', x: 0.2, y: 0.8 + i * 1.6, size: 'sm', status: 'active' })),
    { id: 'obj', label: 'list', sub: s.rc === 0 ? 'freed at once' : 'in memory', kind: 'storage', x: 4.5, y: 1.7, status: s.rc === 0 ? 'down' : 'active', items: s.rc ? [`rc ${s.rc}`] : undefined },
  ];
  return {
    nodes,
    links: s.names.map((n) => ({ from: `n-${n}`, to: 'obj' })),
    packets: k === 1 ? [hop('n-y', 'obj', '+1', 0, 'ok')] : [],
    stats: [
      { label: 'Statement', value: s.what },
      { label: 'Refcount', value: String(s.rc), tone: s.rc === 0 ? 'bad' : 'ok' },
      { label: 'Object', value: s.rc === 0 ? 'freed' : 'alive', tone: s.rc === 0 ? 'bad' : 'ok' },
    ],
    note: s.what === 'del y' ? { text: 'del removes a NAME, not the object: the count drops back to 1', tone: 'accent' } : s.rc === 0 ? { text: 'the last reference is gone: the object is freed immediately', tone: 'ok' } : { text: `${s.what}: the count is ${s.rc}`, tone: 'accent' },
  };
};

const weakView = (deleted: boolean): FlowState => {
  const w = weak(deleted);
  return {
    nodes: [
      ...(deleted ? [] : [{ id: 'n', label: 'n', sub: 'name', kind: 'client', x: 0.2, y: 0.6, size: 'sm', status: 'active' } as FlowNode]),
      { id: 'r', label: 'r', sub: 'weakref', kind: 'cache', x: 0.2, y: 2.9, size: 'sm', status: 'active' },
      { id: 'obj', label: 'Node', sub: w.alive ? 'alive' : 'freed', kind: 'storage', x: 4.5, y: 1.7, status: w.alive ? 'active' : 'down', items: w.alive ? [`rc ${w.rc}`] : undefined },
    ],
    links: [...(deleted ? [] : [{ from: 'n', to: 'obj' }]), { from: 'r', to: 'obj', dashed: true }],
    packets: [],
    stats: [
      { label: 'Strong refs', value: String(w.rc), tone: w.rc ? 'ok' : 'bad' },
      { label: 'r()', value: w.call, tone: w.alive ? 'ok' : 'bad' },
      { label: 'Weakref counts', value: 'no' },
    ],
    note: deleted ? { text: 'del n dropped the only strong reference: the object is gone and r() returns None', tone: 'ok' } : { text: 'a weak reference does not raise the count, so it cannot keep the object alive', tone: 'accent' },
  };
};

const POS: Record<string, { x: number; y: number }> = { A: { x: 2.0, y: 0.4 }, B: { x: 4.0, y: 0.4 }, C: { x: 2.0, y: 3.0 }, D: { x: 4.0, y: 3.0 } };
type Show = { label: string; per: Record<string, string>; status?: Record<string, FlowNode['status']>; sub?: Record<string, string> };
const graph = (s: Show, note: FlowState['note'], stats: FlowState['stats']): FlowState => ({
  nodes: [
    { id: 'name-c', label: 'c', sub: 'name', kind: 'client', x: 0.1, y: 3.0, size: 'sm', status: 'active' },
    ...OBJS.map((o): FlowNode => ({ id: o.id, label: `Object ${o.id}`, sub: s.sub?.[o.id] ?? 'container', kind: 'service', ...POS[o.id], status: s.status?.[o.id] ?? 'normal', items: [s.per[o.id]] })),
  ],
  links: [{ from: 'name-c', to: 'C' }, ...OBJS.flatMap((o) => o.refs.map((r) => ({ from: o.id, to: r })))],
  packets: [],
  stats,
  note,
});

const gcRefStr = (k: string) => `gc ${GC.gcRef[k]}`;

export default defineLesson('flow', {
  slug: 'py-refcount-gc',
  objectives: [
    { text: 'How refcounts rise and fall', step: 1 },
    { text: 'Why a weak reference does not keep an object alive', step: 2 },
    { text: 'Why a reference cycle is never freed by counting', step: 3 },
    { text: 'How the cycle collector finds it', step: 4 },
  ],
  steps: [
    {
      label: 'Counting',
      title: 'Freed at zero',
      tag: 'problem',
      body: ['Every new reference increments an object\'s count and every dropped reference decrements it. At zero the object is **freed immediately**.', '`del y` removes a name, not the object.'],
      keyIdea: 'That gives deterministic cleanup: a file closes when its last reference goes.',
      frames: [0, 1, 2, 3].map((k) => ({ state: life(k), hold: k === 3 ? 3400 : 1700 })),
    },
    {
      label: 'Weakref',
      title: 'A reference that does not count',
      tag: 'concept',
      body: ['A `weakref.ref` points at an object without raising its count. After `del n` the object is gone and `r()` returns `None`.', 'Use `WeakValueDictionary` for caches that must not leak.'],
      keyIdea: 'Weak references let you observe an object without owning it.',
      frames: [{ state: weakView(false), hold: 2600 }, { state: weakView(true), hold: 3600 }],
    },
    {
      label: 'Cycles',
      title: 'Two objects keep each other',
      tag: 'trade-off',
      body: ['`a.other = b; b.other = a`, then `del a; del b`. Each object is still referenced by the other, so both counts stay at 1.', 'Nothing can reach them, but counting alone never frees them.'],
      keyIdea: 'Reference counting cannot free cycles.',
      frames: [{ state: graph({ label: 'rc', per: Object.fromEntries(OBJS.map((o) => [o.id, `rc ${RC[o.id]}`])), status: { A: 'hot', B: 'hot' }, sub: { A: 'leaked?', B: 'leaked?' } }, { text: 'A and B have count 1 each from one another: they are unreachable but not freed', tone: 'bad' }, [{ label: 'A, B counts', value: `${RC.A}, ${RC.B}`, tone: 'bad' }, { label: 'C count', value: String(RC.C) }, { label: 'Reachable', value: 'C and D' }]), hold: 4600 }],
    },
    {
      label: 'Cycle GC',
      title: 'Subtract the internal references',
      tag: 'technique',
      body: ['The `gc` module copies each refcount into `gc_ref`, then subtracts one for every reference **between tracked objects**.', 'Anything left above zero is referenced from outside. It, and everything it references, is reachable. The rest is cycle garbage.'],
      keyIdea: 'Only container objects are tracked, since ints and strings cannot form cycles.',
      frames: [
        { state: graph({ label: 'copy', per: Object.fromEntries(OBJS.map((o) => [o.id, `gc ${RC[o.id]}`])) }, { text: 'step 1: gc_ref starts as a copy of each refcount', tone: 'accent' }, [{ label: 'Step', value: '1 copy' }, { label: 'A, B, C, D', value: OBJS.map((o) => RC[o.id]).join(' ') }, { label: 'Tracked', value: '4' }]), hold: 2400 },
        { state: graph({ label: 'subtract', per: Object.fromEntries(OBJS.map((o) => [o.id, gcRefStr(o.id)])) }, { text: 'step 2: subtract references between tracked objects, so A, B and D drop to 0', tone: 'accent' }, [{ label: 'Step', value: '2 subtract' }, { label: 'A, B, C, D', value: OBJS.map((o) => GC.gcRef[o.id]).join(' ') }, { label: 'Above 0', value: [...OBJS.filter((o) => GC.gcRef[o.id] > 0).map((o) => o.id)].join(', ') || '-' }]), hold: 3200 },
        { state: graph({ label: 'verdict', per: Object.fromEntries(OBJS.map((o) => [o.id, GC.reachable.has(o.id) ? 'kept' : 'garbage'])), status: Object.fromEntries(OBJS.map((o) => [o.id, GC.reachable.has(o.id) ? 'active' : 'down'])) }, { text: `C is referenced from outside and keeps D alive. ${GC.garbage.join(' and ')} are unreachable and collected`, tone: 'ok' }, [{ label: 'Kept', value: [...GC.reachable].sort().join(', '), tone: 'ok' }, { label: 'Collected', value: GC.garbage.join(', '), tone: 'ok' }, { label: 'Step', value: '3 verdict' }]), hold: 4600 },
      ],
    },
    {
      label: 'Recap',
      title: 'Memory in CPython',
      tag: 'recap',
      body: [
        '- **Refcount:** immediate, deterministic cleanup.',
        '- **Cycles:** need the cycle detector.',
        '- **gc_ref:** copy, subtract, keep the outside-referenced.',
        '- **Generational:** young objects are scanned often.',
        '- **Leaks:** usually live references, not GC bugs.',
      ],
      keyIdea: 'Diagnose leaks with tracemalloc, gc.get_referrers or memray.',
      frames: [{ state: graph({ label: 'verdict', per: Object.fromEntries(OBJS.map((o) => [o.id, GC.reachable.has(o.id) ? 'kept' : 'garbage'])), status: Object.fromEntries(OBJS.map((o) => [o.id, GC.reachable.has(o.id) ? 'active' : 'down'])) }, { text: 'counting frees the easy cases, the collector handles cycles', tone: 'ok' }, [{ label: 'Kept', value: [...GC.reachable].sort().join(', ') }, { label: 'Collected', value: GC.garbage.join(', ') }, { label: 'Cycles', value: 'handled', tone: 'ok' }]) }],
    },
  ],
});
