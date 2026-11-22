import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the Java notes on pass by value: primitives are copied, object references are copied,
 * so a method can mutate the shared object but cannot repoint the caller. The outputs come from running the same calls
 * on real values and references.
 */

type SB = { text: string };
const bump = (x: number) => {
  x++;
  return x;
};
const mutate = (sb: SB) => {
  sb.text += ' world';
};
const reassign = (sb: SB): SB => {
  sb = { text: 'new' };
  return sb;
};

const prim = 5;
const primInside = bump(prim);

const a: SB = { text: 'hello' };
mutate(a);
const afterMutate = a.text;

const b: SB = { text: 'hello' };
const inside = reassign(b);
const afterReassign = b.text;

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

// Step 1: the claim.
const claim = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'main', label: 'main: sb', sub: 'a reference', kind: 'client', x: 0.2, y: 1.7 },
    { id: 'm', label: 'method: sb', sub: phase === 1 ? 'a copy of it' : 'not created yet', kind: 'client', x: 2.6, y: 3.0, status: phase === 1 ? 'active' : 'dim' },
    { id: 'obj', label: 'StringBuilder', sub: 'heap: "hello"', kind: 'storage', x: 5.0, y: 1.7 },
  ],
  links: [{ from: 'main', to: 'obj' }, ...(phase === 1 ? [{ from: 'm', to: 'obj' }] : [])],
  packets: phase === 1 ? [hop('main', 'm', 'copy of ref', 0, 'data')] : [],
  stats: [
    { label: 'Java passes', value: 'a value' },
    { label: 'For objects', value: 'a ref copy', tone: 'ok' },
    { label: 'Never', value: 'by reference', tone: 'bad' },
  ],
  note: phase === 1 ? { text: 'the method gets its own copy of the reference, pointing at the same object', tone: 'ok' } : { text: 'Java is always pass by value', tone: 'accent' },
});

// Step 2: primitives are copied entirely.
const primitive = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'main', label: 'main: x', sub: `value ${prim}`, kind: 'client', x: 0.4, y: 1.7, status: 'active' },
    { id: 'm', label: 'bump: x', sub: phase === 1 ? `copy, now ${primInside}` : 'not called yet', kind: 'worker', x: 4.6, y: 1.7, status: phase === 1 ? 'active' : 'dim' },
  ],
  links: [{ from: 'main', to: 'm', label: phase === 1 ? 'copy' : undefined }],
  packets: phase === 1 ? [hop('main', 'm', String(prim), 0, 'data')] : [],
  stats: [
    { label: 'Inside bump', value: phase === 1 ? String(primInside) : '-', tone: phase === 1 ? 'ok' : 'neutral' },
    { label: 'Caller x', value: String(prim), tone: 'ok' },
    { label: 'Changed?', value: 'no' },
  ],
  note: phase === 1 ? { text: `bump changed its own copy to ${primInside}, the caller still has ${prim}`, tone: 'ok' } : { text: 'a primitive is copied entirely into the parameter', tone: 'accent' },
});

// Step 3: mutating through the copied reference is visible to the caller.
const mutating = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'main', label: 'main: sb', sub: 'reference', kind: 'client', x: 0.2, y: 0.5 },
    { id: 'm', label: 'mutate: sb', sub: 'copy of reference', kind: 'worker', x: 0.2, y: 2.9, status: 'active' },
    { id: 'obj', label: 'StringBuilder', sub: `"${phase === 1 ? afterMutate : 'hello'}"`, kind: 'storage', x: 4.6, y: 1.7, status: phase === 1 ? 'active' : 'normal' },
  ],
  links: [{ from: 'main', to: 'obj' }, { from: 'm', to: 'obj' }],
  packets: phase === 1 ? [hop('m', 'obj', 'append', 0, 'ok')] : [],
  stats: [
    { label: 'Objects', value: '1' },
    { label: 'Caller sees', value: phase === 1 ? afterMutate : 'hello', tone: phase === 1 ? 'ok' : 'neutral' },
    { label: 'Visible?', value: phase === 1 ? 'yes' : '-', tone: phase === 1 ? 'ok' : 'neutral' },
  ],
  note: phase === 1 ? { text: 'both references reach the same object, so the append is seen by the caller', tone: 'ok' } : { text: 'sb.append(" world") follows the copied reference', tone: 'accent' },
});

// Step 4: reassigning the parameter only repoints the copy.
const reassigning = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'main', label: 'main: sb', sub: 'reference', kind: 'client', x: 0.2, y: 0.5 },
    { id: 'm', label: 'reassign: sb', sub: phase === 1 ? 'repointed' : 'copy of reference', kind: 'worker', x: 0.2, y: 2.9, status: 'active' },
    { id: 'old', label: 'StringBuilder', sub: `original "${afterReassign}"`, kind: 'storage', x: 4.6, y: 0.5 },
    { id: 'new', label: 'StringBuilder', sub: phase === 1 ? `new "${inside.text}"` : 'not created yet', kind: 'storage', x: 4.6, y: 2.9, status: phase === 1 ? 'active' : 'dim' },
  ],
  links: [{ from: 'main', to: 'old' }, ...(phase === 0 ? [{ from: 'm', to: 'old' }] : [{ from: 'm', to: 'new' }])],
  packets: phase === 1 ? [hop('m', 'new', 'sb = new ...', 0, 'ok')] : [],
  stats: [
    { label: 'Caller sees', value: afterReassign, tone: 'ok' },
    { label: 'Method sees', value: phase === 1 ? inside.text : afterReassign },
    { label: 'Caller moved?', value: 'no', tone: 'ok' },
  ],
  note: phase === 1 ? { text: 'only the local copy now points at the new object, the caller is untouched', tone: 'ok' } : { text: 'sb = new StringBuilder("new") changes the local copy of the reference', tone: 'accent' },
});

export default defineLesson('flow', {
  slug: 'java-pass-by-value',
  objectives: [
    { text: 'Why Java is always pass by value', step: 1 },
    { text: 'What happens to a primitive argument', step: 2 },
    { text: 'Why mutating an object parameter is visible to the caller', step: 3 },
    { text: 'Why reassigning a parameter is not', step: 4 },
  ],
  steps: [
    {
      label: 'The claim',
      title: 'Always a copy',
      tag: 'problem',
      body: ['**Java is always pass by value.** For objects, the value that is copied is the **reference**, not the object.', 'That one fact explains both surprising and unsurprising behaviour.'],
      keyIdea: 'There is no pass by reference in Java.',
      frames: [{ state: claim(0), hold: 2400 }, { state: claim(1), hold: 3400 }],
    },
    {
      label: 'Primitives',
      title: 'A primitive is fully copied',
      tag: 'concept',
      body: ['`bump(int x)` receives its own copy of the number. Incrementing it never reaches the caller.', 'No object, no reference, so nothing is shared.'],
      keyIdea: 'Changes to a primitive parameter never propagate.',
      frames: [{ state: primitive(0), hold: 2200 }, { state: primitive(1), hold: 3400 }],
    },
    {
      label: 'Mutate',
      title: 'Same object, visible change',
      tag: 'technique',
      body: ['The copied reference still points at the **same object**. `sb.append(" world")` changes that object.', 'The caller holds a reference to it, so it sees the change.'],
      keyIdea: 'Mutating through the parameter is visible to the caller.',
      frames: [{ state: mutating(0), hold: 2200 }, { state: mutating(1), hold: 3400 }],
    },
    {
      label: 'Reassign',
      title: 'Repointing stays local',
      tag: 'trade-off',
      body: ['`sb = new StringBuilder("new")` changes only the **local copy** of the reference.', 'The caller still points at the original, so a method cannot swap the caller\'s object.'],
      keyIdea: 'Reassigning the parameter is not visible to the caller.',
      frames: [{ state: reassigning(0), hold: 2200 }, { state: reassigning(1), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Pass by value, in full',
      tag: 'recap',
      body: [
        '- **Always** pass by value.',
        '- **Primitives:** the whole value is copied.',
        '- **Objects:** the reference is copied.',
        '- **Mutate:** visible to the caller.',
        '- **Reassign:** invisible to the caller.',
      ],
      keyIdea: 'Ask whether the method changes the object or the variable that points at it.',
      frames: [{ state: reassigning(1) }],
    },
  ],
});
