import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the TypeScript notes: identity<T> infers T from the argument, extends narrows what is accepted,
 * and useState<T> carries one T through the value and the setter. The inferred names come from running typeof on real arguments.
 */

const identity = <T,>(v: T): T => v;
const INPUTS: unknown[] = [42, 'hi', true];
const INFERRED = INPUTS.map((v) => typeof identity(v));
const LABELS = ['42', '"hi"', 'true'];

const hasLength = (v: unknown): boolean => v !== null && v !== undefined && typeof (v as { length?: unknown }).length === 'number';
const CONSTRAINED: unknown[] = ['abc', [1, 2], 42];
const CLABELS = ['"abc"', '[1,2]', '42'];

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

// Step 1: any keeps the call working but loses the type, per-type copies repeat code.
const lossState = (kind: 'any' | 'generic'): FlowState => ({
  nodes: [
    { id: 'in', label: 'identity(42)', sub: 'number in', kind: 'client', x: 0.2, y: 1.7 },
    { id: 'fn', label: kind === 'any' ? 'identity(any)' : 'identity<T>', sub: kind === 'any' ? 'returns any' : 'returns T', kind: 'worker', x: 2.9, y: 1.7, status: 'active' },
    { id: 'out', label: kind === 'any' ? 'any' : 'number', sub: kind === 'any' ? 'type lost' : 'type kept', kind: 'storage', x: 5.7, y: 1.7, status: kind === 'any' ? 'hot' : 'active' },
  ],
  links: [{ from: 'in', to: 'fn' }, { from: 'fn', to: 'out' }],
  packets: [hop('in', 'fn', '42', 0, 'req'), hop('fn', 'out', kind === 'any' ? 'any' : 'number', 0.7, kind === 'any' ? 'bad' : 'ok')],
  stats: [
    { label: 'Returns', value: kind === 'any' ? 'any' : 'T = number', tone: kind === 'any' ? 'bad' : 'ok' },
    { label: 'Autocomplete', value: kind === 'any' ? 'none' : 'number methods', tone: kind === 'any' ? 'bad' : 'ok' },
    { label: 'Copies of fn', value: '1' },
  ],
  note: kind === 'any' ? { text: 'any works, but the caller learns nothing about the result', tone: 'bad' } : { text: 'a type parameter links the input type to the output type', tone: 'ok' },
});

// Step 2: T is inferred from the argument at each call.
const inferState = (k: number): FlowState => ({
  nodes: [
    { id: 'call', label: `identity(${LABELS[k]})`, sub: 'the call', kind: 'client', x: 0.2, y: 1.7, status: 'active' },
    { id: 't', label: `T = ${INFERRED[k]}`, sub: 'inferred', kind: 'cache', x: 3.0, y: 1.7, status: 'active' },
    { id: 'out', label: INFERRED[k], sub: 'param and return', kind: 'storage', x: 5.7, y: 1.7, status: 'active' },
  ],
  links: [{ from: 'call', to: 't' }, { from: 't', to: 'out' }],
  packets: [hop('call', 't', LABELS[k], 0, 'req'), hop('t', 'out', INFERRED[k], 0.7, 'ok')],
  stats: [
    { label: 'Argument', value: LABELS[k] },
    { label: 'T becomes', value: INFERRED[k], tone: 'ok' },
    { label: 'Written by you', value: 'nothing' },
  ],
  note: { text: 'you rarely write <number>, the compiler infers it from the argument', tone: 'ok' },
});

// Step 3: a constraint rejects arguments without the required shape.
const constraintState = (k: number): FlowState => {
  const ok = hasLength(CONSTRAINED[k]);
  return {
    nodes: [
      { id: 'call', label: `logLength(${CLABELS[k]})`, sub: 'the call', kind: 'client', x: 0.2, y: 1.7, status: 'active' },
      { id: 'chk', label: 'T extends', sub: '{ length: number }', kind: 'gateway', x: 3.0, y: 1.7, status: ok ? 'active' : 'hot' },
      { id: 'out', label: ok ? 'accepted' : 'compile error', sub: ok ? 'value.length is safe' : 'no length property', kind: 'storage', x: 5.7, y: 1.7, status: ok ? 'active' : 'down' },
    ],
    links: [{ from: 'call', to: 'chk' }, { from: 'chk', to: 'out' }],
    packets: [hop('call', 'chk', CLABELS[k], 0, ok ? 'req' : 'bad'), hop('chk', 'out', ok ? 'ok' : 'rejected', 0.7, ok ? 'ok' : 'bad')],
    stats: [
      { label: 'Argument', value: CLABELS[k] },
      { label: 'Has length', value: ok ? 'yes' : 'no', tone: ok ? 'ok' : 'bad' },
      { label: 'Result', value: ok ? 'accepted' : 'rejected', tone: ok ? 'ok' : 'bad' },
    ],
    note: ok ? { text: 'T satisfies the constraint, so value.length is allowed in the body', tone: 'ok' } : { text: 'a number has no length, so the call does not compile', tone: 'bad' },
  };
};

// Step 4: one T flows through useState<number>.
const stateHook = (phase: 0 | 1 | 2): FlowState => ({
  nodes: [
    { id: 'h', label: 'useState<number>', sub: 'T = number', kind: 'gateway', x: 0.2, y: 1.7, status: 'active' },
    { id: 'v', label: 'count: number', sub: 'T', kind: 'service', x: 3.5, y: 0.4, status: 'normal' },
    { id: 's', label: 'setCount', sub: '(v: T)', kind: 'service', x: 3.5, y: 3.0, status: phase === 2 ? 'down' : phase === 1 ? 'active' : 'normal' },
  ],
  links: [{ from: 'h', to: 'v' }, { from: 'h', to: 's' }],
  packets: phase === 0 ? [hop('h', 'v', 'number', 0, 'ok'), hop('h', 's', 'number', 0.2, 'ok')] : phase === 1 ? [hop('s', 'v', '5', 0, 'ok')] : [hop('s', 'v', '"x"', 0, 'bad')],
  stats: [
    { label: 'T', value: 'number' },
    { label: 'setCount(5)', value: phase === 1 ? 'compiles' : '-', tone: phase === 1 ? 'ok' : 'neutral' },
    { label: 'setCount("x")', value: phase === 2 ? 'error' : '-', tone: phase === 2 ? 'bad' : 'neutral' },
  ],
  note: phase === 0 ? { text: 'one type parameter types the value and the setter together', tone: 'accent' } : phase === 1 ? { text: 'a number matches T, so the update is accepted', tone: 'ok' } : { text: 'a string is not T, so the compiler rejects it', tone: 'bad' },
});

export default defineLesson('flow', {
  slug: 'ts-generics',
  objectives: [
    { text: 'Why a type parameter beats any or per-type copies', step: 1 },
    { text: 'How T is inferred from the argument', step: 2 },
    { text: 'How extends constrains what a generic accepts', step: 3 },
    { text: 'How one T flows through a hook like useState', step: 4 },
  ],
  steps: [
    {
      label: 'Why',
      title: 'Keep the type, write it once',
      tag: 'problem',
      body: ['A function that returns what it was given should return the **same type**. With `any` the result is `any`, and a copy per type repeats code.', 'A **type parameter** `T` links the input type to the output type.'],
      keyIdea: 'Generics are the reusable-and-typed combination.',
      frames: [{ state: lossState('any'), hold: 2800 }, { state: lossState('generic'), hold: 3200 }],
    },
    {
      label: 'Inference',
      title: 'T comes from the argument',
      tag: 'concept',
      body: ['`identity(42)` makes `T` a `number`, `identity("hi")` makes it a `string`.', 'The parameter and the return type share that `T`, with nothing written at the call site.'],
      keyIdea: 'Let inference work: explicit type arguments are rarely needed.',
      frames: [0, 1, 2].map((k) => ({ state: inferState(k), hold: 2400 })),
    },
    {
      label: 'Constraints',
      title: 'extends limits T',
      tag: 'technique',
      body: ['`T extends { length: number }` accepts only types that have a `length`. Inside the function, `value.length` is safe.', 'Strings and arrays pass, and a plain number is a compile error.'],
      keyIdea: 'A constraint is a promise about T that the body can rely on.',
      frames: [0, 1, 2].map((k) => ({ state: constraintState(k), hold: 2600 })),
    },
    {
      label: 'In practice',
      title: 'useState<T> in React',
      tag: 'in practice',
      body: ['`useState<number>(0)` fixes `T` as `number` for the value and for the setter.', 'Passing a string to `setCount` fails at compile time.'],
      keyIdea: 'Generic components and hooks keep one type consistent across their whole API.',
      frames: [{ state: stateHook(0), hold: 2200 }, { state: stateHook(1), hold: 2400 }, { state: stateHook(2), hold: 3200 }],
    },
    {
      label: 'Recap',
      title: 'Generics in one page',
      tag: 'recap',
      body: [
        '- **T:** a placeholder type that the compiler fills in.',
        '- **Inference:** T comes from the argument, you rarely write it.',
        '- **extends:** a constraint that limits T and unlocks its members.',
        '- **Hooks and components:** one T is shared across inputs and outputs.',
        '- **vs any:** the type is kept, not erased.',
      ],
      keyIdea: 'If a function should work for many types and still be checked, add a type parameter.',
      frames: [{ state: inferState(0) }],
    },
  ],
});
