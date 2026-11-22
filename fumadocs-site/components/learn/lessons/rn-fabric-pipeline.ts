import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the React Native notes on Fabric: render builds an immutable shadow tree, commit runs Yoga layout, mount diffs trees
 * and applies minimal mutations on the UI thread. A real persistent tree computes how many nodes an update clones and shares,
 * which mutations the diff produces, and how many views view flattening removes.
 */

type SNode = { id: string; props: string; layoutOnly?: boolean; children: SNode[] };
const leaf = (id: string, props: string): SNode => ({ id, props, children: [] });
const TREE: SNode = {
  id: 'Root',
  props: 'column',
  layoutOnly: true,
  children: [leaf('Header', 'title'), { id: 'List', props: 'list', layoutOnly: true, children: [leaf('Row1', 'Ana'), leaf('Row2', 'Bo'), leaf('Row3', 'Cy')] }, leaf('Footer', 'ok')],
};

const count = (n: SNode): number => 1 + n.children.reduce((s, c) => s + count(c), 0);
const flat = (n: SNode, out: SNode[] = []): SNode[] => (out.push(n), n.children.forEach((c) => flat(c, out)), out);

/** Path copying: an update clones the changed node and its ancestors, and shares everything else. */
function update(n: SNode, id: string, props: string, cloned: string[]): SNode {
  if (n.id === id) {
    cloned.push(n.id);
    return { ...n, props };
  }
  const kids = n.children.map((c) => update(c, id, props, cloned));
  if (kids.some((k, i) => k !== n.children[i])) {
    cloned.push(n.id);
    return { ...n, children: kids };
  }
  return n;
}

const CLONED: string[] = [];
const NEXT = update(TREE, 'Row2', 'Bo (online)', CLONED);
const TOTAL = count(TREE);
const SHARED = TOTAL - CLONED.length;

/** The mount phase compares the mounted tree with the new one and emits only the differences. */
const mutations = (a: SNode, b: SNode): string[] => {
  if (a === b) return []; // a shared subtree is the same object: nothing to compare
  const out: string[] = [];
  if (a.props !== b.props) out.push(`update ${b.id}`);
  a.children.forEach((c, i) => out.push(...mutations(c, b.children[i])));
  return out;
};
const MUTATIONS = mutations(TREE, NEXT);
const HOST_VIEWS = flat(TREE).filter((n) => !n.layoutOnly).length; // layout-only views are flattened away

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });
type Phase = 'react' | 'shadow' | 'yoga' | 'mount' | 'host';
const ORDER: Phase[] = ['react', 'shadow', 'yoga', 'mount', 'host'];
const BASE: Record<Phase, Omit<FlowNode, 'status' | 'items'>> = {
  react: { id: 'react', label: 'React', sub: 'JS thread', kind: 'client', x: 0.1, y: 1.7 },
  shadow: { id: 'shadow', label: 'Shadow tree', sub: 'C++, immutable', kind: 'service', x: 1.55, y: 1.7 },
  yoga: { id: 'yoga', label: 'Yoga layout', sub: 'commit phase', kind: 'gateway', x: 3.0, y: 1.7 },
  mount: { id: 'mount', label: 'Mount', sub: 'UI thread', kind: 'worker', x: 4.45, y: 1.7 },
  host: { id: 'host', label: 'Host views', sub: 'UIKit, Android', kind: 'storage', x: 5.9, y: 1.7 },
};
const links = ORDER.slice(1).map((p, i) => ({ from: ORDER[i], to: p }));
const nodes = (active: Phase, items: Partial<Record<Phase, string[]>> = {}): FlowNode[] => {
  const at = ORDER.indexOf(active);
  return ORDER.map((p, i) => ({ ...BASE[p], status: i === at ? 'active' : i < at ? 'normal' : 'dim', items: items[p] }));
};

const render = (): FlowState => ({
  nodes: nodes('shadow', { shadow: ['7 nodes'] }),
  links,
  packets: [hop('react', 'shadow', 'create nodes', 0, 'req')],
  stats: [
    { label: 'Phase', value: '1 Render' },
    { label: 'Shadow nodes', value: String(TOTAL) },
    { label: 'Runs on', value: 'JS thread' },
  ],
  note: { text: 'React reconciles and creates one C++ shadow node per host component, through JSI', tone: 'accent' },
});

const immutable = (): FlowState => ({
  nodes: nodes('shadow', { shadow: CLONED.map((c) => c.slice(0, 9)), react: ['Row2'] }),
  links,
  packets: [hop('react', 'shadow', 'update Row2', 0, 'data')],
  stats: [
    { label: 'Cloned', value: `${CLONED.length} of ${TOTAL}`, tone: 'ok' },
    { label: 'Shared', value: `${SHARED} of ${TOTAL}`, tone: 'ok' },
    { label: 'Old tree', value: 'untouched', tone: 'ok' },
  ],
  note: { text: `changing Row2 clones ${CLONED.join(', ')} and shares the other ${SHARED} nodes with the old tree`, tone: 'ok' },
});

const commit = (): FlowState => ({
  nodes: nodes('yoga', { yoga: ['layout'] }),
  links,
  packets: [hop('shadow', 'yoga', 'next tree', 0, 'req')],
  stats: [
    { label: 'Phase', value: '2 Commit' },
    { label: 'Trees alive', value: '2', tone: 'ok' },
    { label: 'Runs on', value: 'any thread' },
  ],
  note: { text: 'Yoga lays out the new tree off the UI thread, and the old tree stays valid, so React can interrupt', tone: 'ok' },
});

const mount = (): FlowState => ({
  nodes: nodes('mount', { mount: MUTATIONS.map((x) => x.slice(0, 9)), host: [`${HOST_VIEWS} views`] }),
  links,
  packets: [hop('yoga', 'mount', 'diff trees', 0, 'req'), hop('mount', 'host', MUTATIONS[0] ?? 'no change', 0.6, 'ok')],
  stats: [
    { label: 'Mutations', value: String(MUTATIONS.length), tone: 'ok' },
    { label: 'Host views', value: `${HOST_VIEWS} of ${TOTAL}`, tone: 'ok' },
    { label: 'Runs on', value: 'UI thread' },
  ],
  note: { text: `the diff yields ${MUTATIONS.length} mutation, and layout-only views are flattened so only ${HOST_VIEWS} native views exist`, tone: 'ok' },
});

export default defineLesson('flow', {
  slug: 'rn-fabric-pipeline',
  objectives: [
    { text: 'What the render phase builds', step: 1 },
    { text: 'How an update clones only part of an immutable tree', step: 2 },
    { text: 'What commit does and why two trees can exist', step: 3 },
    { text: 'How mount applies the minimal mutations', step: 4 },
  ],
  steps: [
    {
      label: 'Render',
      title: 'React builds a shadow tree',
      tag: 'problem',
      body: ['Fabric moves rendering into shared C++ and splits it into **render, commit and mount**.', 'In render, React creates **shadow nodes** in C++, one for each host component.'],
      keyIdea: 'The shadow tree is the renderer\'s own copy of the UI, before any native view exists.',
      frames: [{ state: render(), hold: 3600 }],
    },
    {
      label: 'Immutable',
      title: 'An update clones a path',
      tag: 'concept',
      body: ['The shadow tree is **immutable**. Updating `Row2` clones that node and its ancestors, and shares the rest.', 'Any thread can read a committed tree, because it never changes.'],
      keyIdea: 'Thread safety comes from immutability.',
      frames: [{ state: immutable(), hold: 4400 }],
    },
    {
      label: 'Commit',
      title: 'Layout on the new tree',
      tag: 'technique',
      body: ['Commit runs **Yoga** layout on the new tree and promotes it as the next one.', 'The old and new trees exist at once, which is what makes concurrent React possible.'],
      keyIdea: 'Layout runs off the UI thread, and `measure` can resolve in the same frame.',
      frames: [{ state: commit(), hold: 4000 }],
    },
    {
      label: 'Mount',
      title: 'Minimal mutations',
      tag: 'in practice',
      body: ['On the UI thread the renderer diffs the new tree against the mounted one and applies only the differences.', '**View flattening** also removes views that only affect layout, so fewer native views exist.'],
      keyIdea: 'Fewer native views means less memory and less drawing.',
      frames: [{ state: mount(), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Fabric in one page',
      tag: 'recap',
      body: [
        '- **Render:** React makes shadow nodes in C++ (JS thread).',
        '- **Commit:** Yoga layout, promote the new immutable tree.',
        '- **Mount:** diff and apply mutations (UI thread).',
        '- **Immutable trees:** clone the path, share the rest.',
        '- **Result:** synchronous layout, concurrent React, flattened views.',
      ],
      keyIdea: 'Shared C++ means one implementation and fewer platform bugs.',
      frames: [{ state: mount() }],
    },
  ],
});
