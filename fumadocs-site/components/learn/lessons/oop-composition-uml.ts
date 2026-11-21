import { defineLesson } from '../define';
import type { FlowNode, FlowState } from '../engines/flow';

/*
 * Follows the OOP notes: is-a versus has-a, the decision flowchart for inheritance, and the five UML relationships
 * (association, aggregation, composition, inheritance, realization) with the Teacher, Department, House, Employee and PaymentGateway examples.
 * Classes are drawn as flow nodes. Layout: two columns for pairs, a vertical chain for hierarchies.
 */

// Step 1: a deep chain. A change in the base ripples to every descendant.
const chain = (changed: boolean): FlowState => ({
  nodes: [
    { id: 'a', label: 'Employee', sub: 'base class', kind: 'service', x: 2.9, y: 0.2, status: changed ? 'hot' : 'normal', badge: changed ? { text: 'getSalary() changed', tone: 'bad' } : undefined },
    { id: 'b', label: 'Manager', kind: 'service', x: 2.9, y: 1.2, status: changed ? 'hot' : 'normal' },
    { id: 'c', label: 'Director', kind: 'service', x: 2.9, y: 2.2, status: changed ? 'hot' : 'normal' },
    { id: 'd', label: 'VP', kind: 'service', x: 2.9, y: 3.2, status: changed ? 'hot' : 'normal' },
  ],
  links: [{ from: 'b', to: 'a' }, { from: 'c', to: 'b' }, { from: 'd', to: 'c' }],
  packets: changed
    ? [
        { from: 'a', to: 'b', label: 'ripple', tone: 'bad', dur: 0.6 },
        { from: 'b', to: 'c', label: 'ripple', tone: 'bad', delay: 0.6, dur: 0.6 },
        { from: 'c', to: 'd', label: 'ripple', tone: 'bad', delay: 1.2, dur: 0.6 },
      ]
    : [],
  stats: [
    { label: 'Depth', value: changed ? '4 levels' : '4 levels', tone: 'bad' },
    { label: 'Tracing a call', value: 'which class?' },
    { label: 'Problem', value: 'fragile base' },
  ],
  note: changed ? { text: 'one edit to the base class can break every descendant', tone: 'bad' } : { text: 'deep chains make it hard to see where behavior is defined', tone: 'accent' },
});

// Step 2: composition. Car has an Engine, and the Engine can be swapped.
const car = (engine: 'Petrol' | 'Electric'): FlowState => ({
  nodes: [
    { id: 'c', label: 'Car', sub: 'has-a Engine', kind: 'service', x: 1.2, y: 1.7, status: 'active' },
    { id: 'e', label: `${engine}Engine`, sub: 'start()', kind: 'worker', x: 4.6, y: 1.7, status: 'active' },
  ],
  links: [{ from: 'c', to: 'e', label: 'engine' }],
  packets: [{ from: 'c', to: 'e', label: 'start()', tone: 'ok', dur: 0.8 }],
  stats: [
    { label: 'Relationship', value: 'has-a' },
    { label: 'Car code', value: 'unchanged', tone: 'ok' },
    { label: 'Engine', value: engine, tone: 'ok' },
  ],
  note: { text: 'Car delegates start() to its engine, so engines are swappable and testable', tone: 'ok' },
});

// Step 3: the inheritance checklist. Default to composition unless every check passes.
type Q = { id: string; label: string; sub: string };
const QS: Q[] = [
  { id: 'q1', label: 'True is-a?', sub: 'in every context' },
  { id: 'q2', label: 'Liskov holds?', sub: 'safe to substitute' },
  { id: 'q3', label: 'Shallow, stable?', sub: 'parent stable' },
];
const checklist = (passed: number, failAt: number | null): FlowState => ({
  nodes: [
    ...QS.map((q, i): FlowNode => ({ id: q.id, label: q.label, sub: q.sub, kind: 'lb', x: i * 2.4 + 0.4, y: 1.2, status: failAt === i ? 'down' : i < passed ? 'normal' : i === passed ? 'active' : 'dim' })),
    { id: 'inh', label: 'Inheritance', sub: 'B extends A', kind: 'service', x: 5.4, y: 3.0, status: failAt === null && passed >= 3 ? 'active' : 'dim' },
    { id: 'comp', label: 'Composition', sub: 'A has a B', kind: 'worker', x: 0.9, y: 3.0, status: failAt !== null ? 'active' : 'dim' },
  ],
  links: [
    { from: 'q1', to: 'q2' },
    { from: 'q2', to: 'q3' },
    { from: 'q3', to: 'inh' },
    { from: 'q1', to: 'comp', dashed: true },
  ],
  stats: [
    { label: 'Checks passed', value: `${passed} of 3`, tone: failAt === null && passed === 3 ? 'ok' : 'neutral' },
    { label: 'Default', value: 'composition', tone: 'ok' },
    { label: 'Rule', value: 'all must pass' },
  ],
  note: failAt !== null ? { text: 'one failed check is enough: fall back to composition', tone: 'bad' } : passed === 3 ? { text: 'only now is inheritance a reasonable choice', tone: 'ok' } : { text: 'ask each question in order', tone: 'accent' },
});

// Step 4: the five UML relationships, from weakest to strongest coupling.
type Rel = { name: string; a: string; b: string; link: string; dashed?: boolean; meaning: string; kinds: [FlowNode['kind'], FlowNode['kind']] };
const RELS: Rel[] = [
  { name: 'Association', a: 'Teacher', b: 'Student', link: 'teaches', meaning: 'neither owns', kinds: ['client', 'client'] },
  { name: 'Aggregation', a: 'Department', b: 'Professor', link: 'has', meaning: 'part outlives', kinds: ['service', 'worker'] },
  { name: 'Composition', a: 'House', b: 'Room', link: 'owns', meaning: 'part dies too', kinds: ['service', 'worker'] },
  { name: 'Inheritance', a: 'Manager', b: 'Employee', link: 'is-a', meaning: 'subclass of', kinds: ['service', 'service'] },
  { name: 'Realization', a: 'StripeGateway', b: 'PaymentGateway', link: 'implements', dashed: true, meaning: 'meets contract', kinds: ['external', 'gateway'] },
];
const rel = (i: number): FlowState => {
  const r = RELS[i];
  return {
    nodes: [
      { id: 'a', label: r.a, kind: r.kinds[0], x: 0.8, y: 1.7, status: 'active' },
      { id: 'b', label: r.b, kind: r.kinds[1], x: 4.8, y: 1.7, status: 'active' },
    ],
    links: [{ from: 'a', to: 'b', label: r.link, dashed: r.dashed }],
    packets: [{ from: 'a', to: 'b', label: r.link, tone: 'accent', dur: 1 }],
    stats: [
      { label: 'Relationship', value: r.name },
      { label: 'Meaning', value: r.meaning },
      { label: 'Coupling', value: `${i + 1} of 5`, hint: 'weakest to strongest' },
    ],
    note: { text: `${r.a} ${r.link} ${r.b}`, tone: 'accent' },
  };
};

// Step 5: lifecycle. Dissolve the department and the professors live on, demolish the house and the rooms go.
const lifecycle = (kind: 'aggregation' | 'composition', gone: boolean): FlowState => {
  const whole = kind === 'aggregation' ? 'Department' : 'House';
  const part = kind === 'aggregation' ? 'Professor' : 'Room';
  const partsDie = kind === 'composition' && gone;
  return {
    nodes: [
      { id: 'w', label: whole, sub: gone ? (kind === 'aggregation' ? 'dissolved' : 'demolished') : 'exists', kind: 'service', x: 1.0, y: 1.7, status: gone ? 'down' : 'active' },
      { id: 'p', label: part, sub: partsDie ? 'gone with it' : 'still exists', kind: 'worker', x: 4.8, y: 1.7, status: partsDie ? 'down' : 'active' },
    ],
    links: [{ from: 'w', to: 'p', label: kind === 'aggregation' ? 'has' : 'owns' }],
    stats: [
      { label: 'Relationship', value: kind },
      { label: part, value: partsDie ? 'destroyed' : 'survives', tone: partsDie ? 'bad' : 'ok' },
      { label: 'Lifecycle', value: kind === 'aggregation' ? 'independent' : 'bound' },
    ],
    note: gone
      ? { text: partsDie ? 'a room cannot exist without its house' : 'a professor still exists if the department is dissolved', tone: partsDie ? 'bad' : 'ok' }
      : { text: kind === 'aggregation' ? 'parts can exist on their own' : 'the part lives and dies with the whole', tone: 'accent' },
  };
};

export default defineLesson('flow', {
  slug: 'oop-composition-uml',
  objectives: [
    { text: 'Why deep inheritance chains are fragile', step: 1 },
    { text: 'How composition models has-a and keeps parts swappable', step: 2 },
    { text: 'The checks before choosing inheritance', step: 3 },
    { text: 'The five UML relationships and their arrows', step: 4 },
    { text: 'Aggregation versus composition lifecycle', step: 5 },
  ],
  steps: [
    {
      label: 'Fragile base',
      title: 'Inheritance for reuse gets brittle',
      tag: 'problem',
      body: ['Using inheritance only to reuse code builds deep chains of four or five levels. It becomes hard to tell which class defines a behavior.', 'A change in the base class ripples to every descendant: the **fragile base class** problem.'],
      keyIdea: 'Inheritance couples a child to its parent for life.',
      frames: [{ state: chain(false), hold: 2200 }, { state: chain(true), hold: 3200 }],
    },
    {
      label: 'Composition',
      title: 'Has-a instead of is-a',
      tag: 'concept',
      body: ['**Composition** includes other objects as fields and delegates to them. A `Car` has an `Engine` instead of extending it.', 'Components stay swappable and independently testable.'],
      keyIdea: 'Favor composition over inheritance: it is flexible, easier to test, and avoids the fragile base class.',
      frames: [{ state: car('Petrol'), hold: 2400 }, { state: car('Electric'), hold: 2800 }],
    },
    {
      label: 'Checklist',
      title: 'When inheritance is fine',
      tag: 'technique',
      body: ['Use inheritance only when `B` is truly an `A` in every context, `B` can replace `A` anywhere without breaking callers (Liskov), and the hierarchy is shallow with a stable parent.', 'If any answer is no, use composition.'],
      keyIdea: 'Composition is the default. Inheritance has to earn its place.',
      frames: [{ state: checklist(0, null), hold: 1500 }, { state: checklist(1, null), hold: 1300 }, { state: checklist(2, null), hold: 1300 }, { state: checklist(3, null), hold: 2200 }, { state: checklist(1, 1), hold: 2800 }],
    },
    {
      label: 'UML',
      title: 'Five relationships',
      tag: 'concept',
      body: ['From weakest to strongest coupling: **association**, **aggregation**, **composition**, **inheritance** and **realization**.', 'Start with is-a, then ask about ownership and lifecycle.'],
      keyIdea: 'Realization (a dashed arrow) is a class fulfilling an interface contract, not inheriting code.',
      frames: RELS.map((_, i) => ({ state: rel(i), hold: 2200 })),
    },
    {
      label: 'Lifecycle',
      title: 'Aggregation or composition?',
      tag: 'trade-off',
      body: ['Both are has-a. The difference is the lifecycle of the part.', 'A professor survives when the department is dissolved (**aggregation**). A room does not survive its house (**composition**).'],
      keyIdea: 'Ask: if the whole disappears, should the part disappear too?',
      frames: [{ state: lifecycle('aggregation', false), hold: 1600 }, { state: lifecycle('aggregation', true), hold: 2600 }, { state: lifecycle('composition', false), hold: 1600 }, { state: lifecycle('composition', true), hold: 2800 }],
    },
    {
      label: 'Recap',
      title: 'Choosing relationships',
      tag: 'recap',
      body: [
        '- **Default:** composition (has-a), delegate to parts.',
        '- **Inheritance** only if true is-a, Liskov holds and the hierarchy is shallow.',
        '- **Aggregation:** part outlives the whole. **Composition:** part dies with it.',
        '- **Realization:** implement an interface to promise a contract.',
        '- **Smell:** 4 to 5 level chains and overrides that throw.',
      ],
      keyIdea: 'Model relationships by lifecycle and substitutability, not by what saves typing.',
      frames: [{ state: checklist(3, null) }],
    },
  ],
});
