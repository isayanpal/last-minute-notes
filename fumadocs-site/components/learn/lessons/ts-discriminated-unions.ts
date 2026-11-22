import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the TypeScript notes: a shared kind tag narrows a union, and a never check in default
 * turns a forgotten variant into a compile error. The areas are computed by running real code.
 */

type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; size: number };
const area = (s: Shape): number => {
  switch (s.kind) {
    case 'circle':
      return Math.PI * s.radius ** 2;
    case 'square':
      return s.size ** 2;
  }
};
const circleArea = area({ kind: 'circle', radius: 2 });
const squareArea = area({ kind: 'square', size: 3 });
// The loose shape from step 1: every field optional, so nothing stops a wrong read.
const loose = { kind: 'square', size: 3 } as { kind: string; radius?: number; size?: number };
const looseArea = Math.PI * (loose.radius as number) ** 2;
const fmt = (n: number) => (Number.isNaN(n) ? 'NaN' : String(Math.round(n * 100) / 100));

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

// Step 1: one object type with optional fields cannot say which fields belong together.
const looseState = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'shape', label: 'Shape', sub: 'kind, radius?, size?', kind: 'client', x: 0.2, y: 1.7, items: ['kind', 'radius?', 'size?'] },
    { id: 'fn', label: 'area(shape)', sub: 'reads shape.radius', kind: 'worker', x: 3.2, y: 1.7, status: phase === 1 ? 'hot' : 'active' },
    { id: 'out', label: phase === 1 ? 'NaN' : 'result', sub: phase === 1 ? 'radius was undefined' : 'waiting', kind: 'storage', x: 5.9, y: 1.7, status: phase === 1 ? 'down' : 'dim' },
  ],
  links: [{ from: 'shape', to: 'fn' }, { from: 'fn', to: 'out' }],
  packets: phase === 1 ? [hop('shape', 'fn', 'square, size 3', 0, 'bad'), hop('fn', 'out', 'NaN', 0.7, 'bad')] : [],
  stats: [
    { label: 'Shape given', value: 'square' },
    { label: 'radius read', value: phase === 1 ? 'undefined' : '-', tone: phase === 1 ? 'bad' : 'neutral' },
    { label: 'area()', value: phase === 1 ? fmt(looseArea) : '-', tone: phase === 1 ? 'bad' : 'neutral' },
  ],
  note: phase === 1 ? { text: 'the optional radius type-checks, then silently becomes NaN', tone: 'bad' } : { text: 'optional fields let a square be read as a circle', tone: 'accent' },
});

// Step 2: a union with a literal kind tag, one variant per shape.
const unionNodes: FlowNode[] = [
  { id: 'u', label: 'Shape', sub: 'union of two', kind: 'gateway', x: 0.2, y: 1.7, status: 'active' },
  { id: 'c', label: 'circle', sub: 'kind: "circle"', kind: 'service', x: 3.4, y: 0.5, items: ['radius'] },
  { id: 's', label: 'square', sub: 'kind: "square"', kind: 'service', x: 3.4, y: 2.9, items: ['size'] },
];
const unionState = (phase: 0 | 1): FlowState => ({
  nodes: unionNodes.map((n) => (n.id === 'u' ? n : { ...n, status: phase === 0 ? 'dim' : 'normal' })),
  links: [{ from: 'u', to: 'c', label: 'or' }, { from: 'u', to: 's', label: 'or' }],
  packets: phase === 1 ? [hop('u', 'c', 'kind', 0, 'ok'), hop('u', 's', 'kind', 0.2, 'ok')] : [],
  stats: [
    { label: 'Variants', value: '2' },
    { label: 'Shared field', value: 'kind', tone: 'ok' },
    { label: 'Own fields', value: 'per variant', tone: 'ok' },
  ],
  note: phase === 1 ? { text: 'the literal kind field is the discriminant: it tells variants apart', tone: 'ok' } : { text: 'each variant carries only the fields that belong to it', tone: 'accent' },
});

// Step 3: switch on kind narrows shape inside every case.
const narrowState = (which: 'circle' | 'square'): FlowState => ({
  nodes: [
    { id: 'sw', label: 'switch', sub: 'shape.kind', kind: 'lb', x: 0.2, y: 1.7, status: 'active' },
    { id: 'c', label: 'circle case', sub: 'radius available', kind: 'service', x: 3.4, y: 0.5, status: which === 'circle' ? 'active' : 'dim', items: ['radius'] },
    { id: 's', label: 'square case', sub: 'size available', kind: 'service', x: 3.4, y: 2.9, status: which === 'square' ? 'active' : 'dim', items: ['size'] },
    { id: 'out', label: 'area', sub: 'a number', kind: 'storage', x: 5.9, y: 1.7, status: 'active', items: [fmt(which === 'circle' ? circleArea : squareArea)] },
  ],
  links: [{ from: 'sw', to: 'c' }, { from: 'sw', to: 's' }, { from: which === 'circle' ? 'c' : 's', to: 'out' }],
  packets: [hop('sw', which === 'circle' ? 'c' : 's', which, 0, 'ok'), hop(which === 'circle' ? 'c' : 's', 'out', fmt(which === 'circle' ? circleArea : squareArea), 0.7, 'res')],
  stats: [
    { label: 'kind', value: which },
    { label: 'Narrowed to', value: which === 'circle' ? 'circle' : 'square', tone: 'ok' },
    { label: 'area()', value: fmt(which === 'circle' ? circleArea : squareArea), tone: 'ok' },
  ],
  note: { text: which === 'circle' ? 'case "circle": shape.radius is a number, shape.size is an error' : 'case "square": shape.size is a number, shape.radius is an error', tone: 'ok' },
});

// Step 4: adding a variant breaks the never check in default, so the compiler lists what you forgot.
const exhaustState = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'sw', label: 'switch', sub: 'shape.kind', kind: 'lb', x: 0.2, y: 1.7, status: 'active' },
    { id: 'c', label: 'circle', sub: 'handled', kind: 'service', x: 2.8, y: 0.3, status: 'normal' },
    { id: 's', label: 'square', sub: 'handled', kind: 'service', x: 2.8, y: 1.7, status: 'normal' },
    ...(phase === 1 ? ([{ id: 't', label: 'triangle', sub: 'new, not handled', kind: 'service', x: 2.8, y: 3.1, status: 'hot' }] as FlowNode[]) : []),
    { id: 'n', label: 'default: never', sub: phase === 1 ? 'got triangle' : 'nothing left', kind: 'monitor', x: 5.6, y: 1.7, status: phase === 1 ? 'down' : 'active' },
  ],
  links: [{ from: 'sw', to: 'c' }, { from: 'sw', to: 's' }, ...(phase === 1 ? [{ from: 'sw', to: 't' }, { from: 't', to: 'n', tone: 'bad' as const }] : []), ...(phase === 0 ? [{ from: 's', to: 'n', dashed: true }] : [])],
  packets: phase === 1 ? [hop('sw', 't', 'triangle', 0, 'bad'), hop('t', 'n', 'not never', 0.7, 'bad')] : [],
  stats: [
    { label: 'Variants', value: phase === 1 ? '3' : '2' },
    { label: 'Handled', value: '2' },
    { label: 'Build', value: phase === 1 ? 'compile error' : 'passes', tone: phase === 1 ? 'bad' : 'ok' },
  ],
  note: phase === 1 ? { text: 'triangle reaches default, which expects never: the build fails', tone: 'bad' } : { text: 'every variant is handled, so default sees type never', tone: 'ok' },
});

export default defineLesson('flow', {
  slug: 'ts-discriminated-unions',
  objectives: [
    { text: 'Why optional fields cannot model separate shapes', step: 1 },
    { text: 'How a literal kind tag defines a discriminated union', step: 2 },
    { text: 'How a switch narrows the value in each case', step: 3 },
    { text: 'How never makes the compiler list forgotten variants', step: 4 },
  ],
  steps: [
    {
      label: 'Loose shape',
      title: 'Optional fields hide mistakes',
      tag: 'problem',
      body: ['If one type has `radius?` and `size?`, nothing ties a field to a `kind`. A square can be read as a circle.', 'The read type-checks, then returns `undefined`, and the maths becomes `NaN`.'],
      keyIdea: 'Fields that belong together should travel together, in the type.',
      frames: [{ state: looseState(0), hold: 2200 }, { state: looseState(1), hold: 3400 }],
    },
    {
      label: 'The union',
      title: 'One variant per shape',
      tag: 'concept',
      body: ['A **discriminated union** is a union where each variant has the same field with a different literal value, here `kind`.', 'Each variant lists only its own data.'],
      keyIdea: 'The shared literal field is the discriminant.',
      frames: [{ state: unionState(0), hold: 2200 }, { state: unionState(1), hold: 3200 }],
    },
    {
      label: 'Narrowing',
      title: 'switch narrows each case',
      tag: 'technique',
      body: ['Inside `case "circle"` the compiler knows the value is the circle variant, so `shape.radius` is a number.', 'Reading `shape.size` there is a compile error.'],
      keyIdea: 'Checking the tag proves which variant you have. No casts needed.',
      frames: [{ state: narrowState('circle'), hold: 3000 }, { state: narrowState('square'), hold: 3000 }],
    },
    {
      label: 'Exhaustive',
      title: 'never catches the forgotten case',
      tag: 'trade-off',
      body: ['End the switch with `default: return assertNever(shape)`. If every variant is handled, `shape` is `never` there and it compiles.', 'Add a `triangle` variant and the default now receives a real type, so the build fails until you handle it.'],
      keyIdea: 'The compiler gives future safety: a new variant points at every switch that needs updating.',
      frames: [{ state: exhaustState(0), hold: 2600 }, { state: exhaustState(1), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Unions that cannot lie',
      tag: 'recap',
      body: [
        '- **Problem:** optional fields allow combinations that make no sense.',
        '- **Union:** one variant per case, sharing a literal tag.',
        '- **Narrowing:** `switch` on the tag gives exactly that variant.',
        '- **never:** an exhaustive check fails the build when a variant is missed.',
        '- **Used in:** API states, reducers, UI state machines.',
      ],
      keyIdea: 'Model the states, then let the compiler check every place that handles them.',
      frames: [{ state: narrowState('square') }],
    },
  ],
});
