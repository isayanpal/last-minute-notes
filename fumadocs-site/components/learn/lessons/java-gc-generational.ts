import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Java notes on garbage collection: reachability from GC roots, the generational hypothesis,
 * Eden to survivor to old generation, and leaks that are reachable but unneeded. The ages and promotions come from
 * running a small copying-collector model. The tenuring threshold of 2 is a demo value, real JVMs tune it.
 */

const THRESHOLD = 2;
const EDEN_CAP = 4;

type Surv = { id: string; age: number };
type Heap = { eden: string[]; surv: Surv[]; old: string[] };

const minorGC = (h: Heap, live: Set<string>): Heap => {
  const surv: Surv[] = [];
  const old = [...h.old];
  for (const id of h.eden) if (live.has(id)) surv.push({ id, age: 1 });
  for (const o of h.surv) {
    if (!live.has(o.id)) continue;
    const age = o.age + 1;
    if (age >= THRESHOLD) old.push(o.id);
    else surv.push({ id: o.id, age });
  }
  return { eden: [], surv, old };
};

const BATCH1 = ['o1', 'o2', 'o3', 'o4'];
const LIVE1 = new Set(['o1', 'o3']);
const BATCH2 = ['o5', 'o6', 'o7', 'o8'];
const LIVE2 = new Set(['o1', 'o5']);

const heap0: Heap = { eden: BATCH1, surv: [], old: [] };
const heap1 = minorGC(heap0, LIVE1);
const heap2full: Heap = { ...heap1, eden: BATCH2 };
const heap3 = minorGC(heap2full, LIVE2);

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });
const survItems = (s: Surv[]) => s.map((o) => `${o.id}/${o.age}`);

// Step 1: reachability from GC roots decides what is garbage.
const reach = (phase: 0 | 1): FlowState => ({
  nodes:
    phase === 0
      ? [
          { id: 'roots', label: 'GC roots', sub: 'stacks, statics', kind: 'monitor', x: 0.3, y: 1.7, status: 'active' },
          { id: 'heap', label: 'Heap', sub: 'all objects', kind: 'storage', x: 4.4, y: 1.7, items: BATCH1 },
        ]
      : [
          { id: 'roots', label: 'GC roots', sub: 'stacks, statics', kind: 'monitor', x: 0.3, y: 1.7, status: 'active' },
          { id: 'live', label: 'Reachable', sub: 'kept', kind: 'service', x: 4.4, y: 0.4, status: 'active', items: [...LIVE1] },
          { id: 'dead', label: 'Unreachable', sub: 'garbage', kind: 'external', x: 4.4, y: 3.0, status: 'down', items: BATCH1.filter((o) => !LIVE1.has(o)) },
        ],
  links: phase === 0 ? [{ from: 'roots', to: 'heap', dashed: true }] : [{ from: 'roots', to: 'live' }],
  packets: phase === 1 ? [hop('roots', 'live', 'follow refs', 0, 'ok')] : [],
  stats: [
    { label: 'Objects', value: String(BATCH1.length) },
    { label: 'Reachable', value: phase === 1 ? String(LIVE1.size) : '?', tone: phase === 1 ? 'ok' : 'neutral' },
    { label: 'Garbage', value: phase === 1 ? String(BATCH1.length - LIVE1.size) : '?', tone: phase === 1 ? 'bad' : 'neutral' },
  ],
  note: phase === 1 ? { text: 'follow references from the roots: what is not reached is garbage', tone: 'ok' } : { text: 'GC reclaims objects that no GC root can reach', tone: 'accent' },
});

const spaces = (h: Heap, active?: 'eden' | 'surv' | 'old', hot?: 'eden'): FlowNode[] => [
  { id: 'eden', label: 'Eden', sub: 'new objects', kind: 'cache', x: 0.4, y: 1.7, status: hot === 'eden' ? 'hot' : active === 'eden' ? 'active' : 'normal', items: h.eden, meter: { value: h.eden.length / EDEN_CAP, label: `${h.eden.length} of ${EDEN_CAP}`, tone: h.eden.length === EDEN_CAP ? 'bad' : 'info' } },
  { id: 'surv', label: 'Survivor', sub: 'id / age', kind: 'queue', x: 3.0, y: 1.7, status: active === 'surv' ? 'active' : 'normal', items: survItems(h.surv) },
  { id: 'old', label: 'Old generation', sub: 'long-lived', kind: 'db', x: 5.6, y: 1.7, status: active === 'old' ? 'active' : 'normal', items: h.old },
];
const spaceLinks = [{ from: 'eden', to: 'surv' }, { from: 'surv', to: 'old' }];

// Step 2: Eden fills, a minor GC copies the survivors.
const minor = (phase: 0 | 1 | 2): FlowState => ({
  nodes: phase === 0 ? spaces(heap0, undefined, 'eden') : phase === 1 ? spaces(heap0, 'surv', 'eden') : spaces(heap1, 'surv'),
  links: spaceLinks,
  packets: phase === 1 ? [hop('eden', 'surv', 'o1', 0, 'ok'), hop('eden', 'surv', 'o3', 0.3, 'ok')] : [],
  stats: [
    { label: 'Eden', value: phase === 2 ? 'empty' : 'full', tone: phase === 2 ? 'ok' : 'bad' },
    { label: 'Copied alive', value: phase === 0 ? '-' : String(LIVE1.size), tone: phase === 0 ? 'neutral' : 'ok' },
    { label: 'Dropped', value: phase === 2 ? String(BATCH1.length - LIVE1.size) : '-', tone: phase === 2 ? 'ok' : 'neutral' },
  ],
  note: phase === 0 ? { text: 'new objects are allocated in Eden until it is full', tone: 'bad' } : phase === 1 ? { text: 'minor GC copies only the live objects into a survivor space', tone: 'accent' } : { text: 'Eden is cleared in one go: most objects die young, so this is cheap', tone: 'ok' },
});

// Step 3: survivors age and are promoted.
const promote = (phase: 0 | 1): FlowState => ({
  nodes: phase === 0 ? spaces(heap2full, undefined, 'eden') : spaces(heap3, 'old'),
  links: spaceLinks,
  packets: phase === 1 ? [hop('surv', 'old', 'o1', 0, 'ok'), hop('eden', 'surv', 'o5', 0.3, 'ok')] : [],
  stats: [
    { label: 'Threshold', value: `age ${THRESHOLD} (demo)` },
    { label: 'Promoted', value: phase === 1 ? heap3.old.join(', ') : '-', tone: phase === 1 ? 'ok' : 'neutral' },
    { label: 'Still young', value: phase === 1 ? heap3.surv.map((o) => o.id).join(', ') : '-' },
  ],
  note: phase === 0 ? { text: 'a second batch fills Eden while o1 is still alive in survivor', tone: 'accent' } : { text: `o1 survived ${THRESHOLD} collections, so it is promoted to the old generation`, tone: 'ok' },
});

// Step 4: a reachable but unneeded cache fills the old generation.
const leakFill = [0.2, 0.55, 0.9, 1];
const leak = (k: number): FlowState => ({
  nodes: [
    { id: 'cache', label: 'static Map', sub: 'never evicted', kind: 'monitor', x: 0.3, y: 1.7, status: 'active', items: ['k1', 'k2', 'k3', 'k4'].slice(0, k + 1) },
    { id: 'old', label: 'Old generation', sub: 'long-lived', kind: 'db', x: 4.4, y: 1.7, status: leakFill[k] >= 1 ? 'down' : leakFill[k] > 0.8 ? 'hot' : 'active', meter: { value: leakFill[k], label: leakFill[k] >= 1 ? 'full' : `${Math.round(leakFill[k] * 100)}%`, tone: leakFill[k] > 0.8 ? 'bad' : 'info' } },
  ],
  links: [{ from: 'cache', to: 'old' }],
  packets: k < 3 ? [hop('cache', 'old', `k${k + 1}`, 0, 'data')] : [],
  stats: [
    { label: 'Cache entries', value: String(k + 1) },
    { label: 'Reachable', value: 'always', tone: 'bad' },
    { label: 'Result', value: leakFill[k] >= 1 ? 'OutOfMemory' : 'growing', tone: leakFill[k] >= 1 ? 'bad' : 'neutral' },
  ],
  note: leakFill[k] >= 1 ? { text: 'GC cannot free reachable objects: a full GC runs, then OutOfMemoryError', tone: 'bad' } : { text: 'a static collection keeps every entry reachable, so GC never frees them', tone: 'accent' },
});

export default defineLesson('flow', {
  slug: 'java-gc-generational',
  objectives: [
    { text: 'How reachability from GC roots decides garbage', step: 1 },
    { text: 'Why a minor GC is cheap', step: 2 },
    { text: 'When an object is promoted to the old generation', step: 3 },
    { text: 'How a Java memory leak happens despite the GC', step: 4 },
  ],
  steps: [
    {
      label: 'Reachability',
      title: 'Garbage is what no root reaches',
      tag: 'problem',
      body: ['The GC starts at **GC roots**: local variables on stacks, static fields, active threads. Everything reachable from them stays.', 'Reference counting is not used, so cycles between unreachable objects are collected fine.'],
      keyIdea: 'Reachable means alive, even if your code will never use it again.',
      frames: [{ state: reach(0), hold: 2400 }, { state: reach(1), hold: 3600 }],
    },
    {
      label: 'Minor GC',
      title: 'Most objects die young',
      tag: 'concept',
      body: ['New objects go to **Eden**. When it fills, a **minor GC** copies the few live objects to a survivor space.', 'Eden is then empty again, so the collection is short.'],
      keyIdea: 'The generational hypothesis: split the heap by age and collect the young part often.',
      frames: [{ state: minor(0), hold: 2400 }, { state: minor(1), hold: 2200 }, { state: minor(2), hold: 3400 }],
    },
    {
      label: 'Promotion',
      title: 'Old enough, move up',
      tag: 'technique',
      body: ['Each survived collection raises an object\'s age. Past the tenuring threshold it is **promoted** to the old generation.', 'When the old generation fills, an expensive **full GC** runs, which is a stop-the-world pause.'],
      keyIdea: 'A stop-the-world pause freezes application threads.',
      frames: [{ state: promote(0), hold: 2600 }, { state: promote(1), hold: 3800 }],
    },
    {
      label: 'Leaks',
      title: 'Reachable but unneeded',
      tag: 'trade-off',
      body: ['Java can leak memory even with a GC. A static collection that only grows keeps every entry reachable.', 'Typical causes: caches without eviction, listeners never removed, `ThreadLocal` values in pooled threads.'],
      keyIdea: 'Fix with bounded caches and by deregistering listeners, and investigate with a heap dump.',
      frames: [0, 1, 2, 3].map((k) => ({ state: leak(k), hold: k === 3 ? 3600 : 1700 })),
    },
    {
      label: 'Recap',
      title: 'Generational GC',
      tag: 'recap',
      body: [
        '- **Roots:** stacks, statics, threads. Reachable objects live.',
        '- **Eden:** new objects, collected often and cheaply.',
        '- **Survivor:** live objects age with each minor GC.',
        '- **Old generation:** promoted objects, full GC is expensive.',
        '- **Leaks:** reachable but unneeded objects are never freed.',
      ],
      keyIdea: 'G1 is the safe default, ZGC and Shenandoah target ultra-low pauses.',
      frames: [{ state: promote(1) }],
    },
  ],
});
