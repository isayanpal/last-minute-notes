import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the JavaScript notes: Person.prototype.sayHi, the lookup walk through __proto__ until null,
 * and classes as syntactic sugar. The lookup results are produced by running real property lookups on a real chain.
 */

function Person(this: { name: string }, name: string) {
  this.name = name;
}
Person.prototype.sayHi = function (this: { name: string }) {
  return this.name;
};
const person = new (Person as unknown as new (n: string) => { name: string; sayHi(): string })('Ana');

/** Walk the real chain and report which link owns the property, mirroring the engine. */
const owner = (o: object, key: string): 'own' | 'proto' | 'object' | 'none' => {
  if (Object.prototype.hasOwnProperty.call(o, key)) return 'own';
  const p = Object.getPrototypeOf(o);
  if (p && Object.prototype.hasOwnProperty.call(p, key)) return 'proto';
  const pp = p ? Object.getPrototypeOf(p) : null;
  if (pp && Object.prototype.hasOwnProperty.call(pp, key)) return 'object';
  return 'none';
};
const where = { name: owner(person, 'name'), sayHi: owner(person, 'sayHi'), toString: owner(person, 'toString'), missing: owner(person, 'missing') };

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

// Step 1: copying methods onto every object wastes memory. Share them instead.
const copies = (shared: boolean): FlowState => ({
  nodes: shared
    ? [
        { id: 'a', label: 'person A', kind: 'client', x: 0.2, y: 0.5, size: 'sm' },
        { id: 'b', label: 'person B', kind: 'client', x: 0.2, y: 1.8, size: 'sm' },
        { id: 'c', label: 'person C', kind: 'client', x: 0.2, y: 3.1, size: 'sm' },
        { id: 'p', label: 'Person.prototype', sub: 'one sayHi', kind: 'service', x: 4.4, y: 1.8, status: 'active', items: ['sayHi'] },
      ]
    : [
        { id: 'a', label: 'person A', kind: 'client', x: 0.4, y: 0.5, items: ['name', 'sayHi'] },
        { id: 'b', label: 'person B', kind: 'client', x: 2.9, y: 0.5, items: ['name', 'sayHi'] },
        { id: 'c', label: 'person C', kind: 'client', x: 5.4, y: 0.5, items: ['name', 'sayHi'] },
      ],
  links: shared ? [{ from: 'a', to: 'p' }, { from: 'b', to: 'p' }, { from: 'c', to: 'p' }] : [],
  stats: shared
    ? [{ label: 'sayHi copies', value: '1', tone: 'ok' }, { label: 'Objects', value: '3 link to it' }, { label: 'Link', value: '__proto__' }]
    : [{ label: 'sayHi copies', value: '3', tone: 'bad' }, { label: 'Per object', value: 'own method' }, { label: 'Memory', value: 'grows with N', tone: 'bad' }],
  note: shared ? { text: 'methods live once on the prototype, objects link to it', tone: 'ok' } : { text: 'a copy of every method on every object does not scale', tone: 'bad' },
});

// Step 2: new Person() links the new object to Person.prototype.
const construct = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'fn', label: 'Person', sub: 'constructor fn', kind: 'worker', x: 0.2, y: 0.5, status: phase === 0 ? 'active' : 'normal' },
    { id: 'p', label: 'Person.prototype', sub: 'sayHi', kind: 'service', x: 4.0, y: 0.5, items: ['sayHi'] },
    { id: 'o', label: 'person', sub: phase === 1 ? 'new object' : 'not created yet', kind: 'client', x: 2.0, y: 2.9, status: phase === 1 ? 'active' : 'dim', items: phase === 1 ? [`name ${person.name}`] : undefined },
  ],
  links: [{ from: 'fn', to: 'p', label: '.prototype' }, ...(phase === 1 ? [{ from: 'o', to: 'p', label: '__proto__', dashed: true }] : [])],
  packets: phase === 1 ? [hop('fn', 'o', 'new Person("Ana")', 0, 'ok')] : [],
  stats: [
    { label: 'new', value: 'creates object' },
    { label: 'Links it to', value: 'Person.proto', tone: 'ok' },
    { label: 'Then', value: 'runs ctor' },
  ],
  note: phase === 1 ? { text: 'obj.__proto__ === Person.prototype', tone: 'ok' } : { text: 'a function has a .prototype object that new will link to', tone: 'accent' },
});

// Step 3: the lookup chain. Own property, Person.prototype, Object.prototype, then null.
const CHAIN: FlowNode[] = [
  { id: 'o', label: 'person', sub: 'own: name', kind: 'client', x: 0.1, y: 1.7 },
  { id: 'p', label: 'Person.prototype', sub: 'sayHi', kind: 'service', x: 2.2, y: 1.7 },
  { id: 'b', label: 'Object.prototype', sub: 'toString', kind: 'worker', x: 4.2, y: 1.7 },
  { id: 'n', label: 'null', sub: 'end of chain', kind: 'storage', x: 6.0, y: 1.7 },
];
const lookup = (key: 'sayHi' | 'toString' | 'missing'): FlowState => {
  const found = where[key];
  const depth = found === 'proto' ? 1 : found === 'object' ? 2 : 3;
  const ids = ['o', 'p', 'b', 'n'];
  return {
    nodes: CHAIN.map((n, i) => ({ ...n, status: i === depth ? (found === 'none' ? 'down' : 'active') : i < depth ? 'normal' : 'dim' })),
    links: [{ from: 'o', to: 'p', label: '__proto__' }, { from: 'p', to: 'b', label: '__proto__' }, { from: 'b', to: 'n', label: '__proto__' }],
    packets: Array.from({ length: depth }, (_, i) => hop(ids[i], ids[i + 1], 'not here', i * 0.7, 'bad')),
    stats: [
      { label: 'Lookup', value: key },
      { label: 'Found on', value: found === 'proto' ? 'Person.proto' : found === 'object' ? 'Object.proto' : 'nowhere', tone: found === 'none' ? 'bad' : 'ok' },
      { label: 'Result', value: found === 'none' ? 'undefined' : 'function', tone: found === 'none' ? 'bad' : 'ok' },
    ],
    note: found === 'none' ? { text: 'reached null: the property does not exist', tone: 'bad' } : { text: `walked ${depth} link${depth > 1 ? 's' : ''} to find ${key}`, tone: 'ok' },
  };
};

// Step 4: class syntax builds the same chain.
const sugar = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'cl', label: 'class Person', sub: phase === 0 ? 'constructor + greet' : 'sugar', kind: 'gateway', x: 0.2, y: 1.7, status: 'active' },
    { id: 'p', label: 'Person.prototype', sub: 'greet', kind: 'service', x: 3.4, y: 0.5, items: phase === 1 ? ['greet'] : undefined, status: phase === 1 ? 'active' : 'dim' },
    { id: 'o', label: 'person', kind: 'client', x: 3.4, y: 2.9, status: phase === 1 ? 'active' : 'dim' },
  ],
  links: [{ from: 'cl', to: 'p', dashed: true }, { from: 'o', to: 'p', label: '__proto__' }],
  packets: phase === 1 ? [hop('cl', 'p', 'methods go here', 0, 'ok')] : [],
  stats: [
    { label: 'class', value: 'syntax only' },
    { label: 'Under it', value: 'prototypes', tone: 'ok' },
    { label: 'Classes', value: 'no real ones' },
  ],
  note: phase === 1 ? { text: 'class methods land on Person.prototype, same as the manual version', tone: 'ok' } : { text: 'there is no class at the engine level', tone: 'accent' },
});

export default defineLesson('flow', {
  slug: 'js-prototypes',
  objectives: [
    { text: 'Why methods are shared through a prototype', step: 1 },
    { text: 'What new does to link an object to a prototype', step: 2 },
    { text: 'How a property lookup walks the chain', step: 3 },
    { text: 'Why class syntax is sugar over prototypes', step: 4 },
  ],
  steps: [
    {
      label: 'Sharing',
      title: 'One method, many objects',
      tag: 'problem',
      body: ['Copying `sayHi` onto every object wastes memory. JavaScript objects can instead **link to a shared prototype**.', 'Each object keeps its own data, and methods live once.'],
      keyIdea: 'Prototypal inheritance means objects delegate to other objects.',
      frames: [{ state: copies(false), hold: 2600 }, { state: copies(true), hold: 3000 }],
    },
    {
      label: 'new',
      title: 'Linking with new',
      tag: 'concept',
      body: ['A constructor function has a `.prototype` object. `new Person("Ana")` creates an object, sets its `__proto__` to that prototype, and runs the constructor.', 'Methods added with `Person.prototype.sayHi = ...` are shared by every instance.'],
      keyIdea: '`obj.__proto__ === Person.prototype`',
      frames: [{ state: construct(0), hold: 2200 }, { state: construct(1), hold: 3200 }],
    },
    {
      label: 'Lookup',
      title: 'Walk the chain until null',
      tag: 'technique',
      body: ['A property lookup checks the object, then its `__proto__`, and so on until it finds a match or reaches `null`.', '`sayHi` is found on `Person.prototype`, `toString` on `Object.prototype`, and a missing property gives `undefined`.'],
      keyIdea: 'Own properties shadow prototype ones, because the walk stops at the first match.',
      frames: [{ state: lookup('sayHi'), hold: 2600 }, { state: lookup('toString'), hold: 2800 }, { state: lookup('missing'), hold: 3000 }],
    },
    {
      label: 'Classes',
      title: 'class is sugar',
      tag: 'trade-off',
      body: ['`class Person { constructor() {} greet() {} }` creates the same chain. `greet` ends up on `Person.prototype`.', 'JavaScript has no real classes at the engine level, only objects linked through `[[Prototype]]`.'],
      keyIdea: 'Mixins add extra links: a function that returns a class extending its argument.',
      frames: [{ state: sugar(0), hold: 2200 }, { state: sugar(1), hold: 3000 }],
    },
    {
      label: 'Recap',
      title: 'The prototype chain',
      tag: 'recap',
      body: [
        '- **Share:** methods live on the prototype, once.',
        '- **new:** links the new object to `Constructor.prototype`.',
        '- **Lookup:** own property, then each `__proto__`, then `null`.',
        '- **class:** syntax over the same mechanism.',
        '- **Shadowing:** an own property hides one further up.',
      ],
      keyIdea: 'When a method is not found, trace the chain from the object up to null.',
      frames: [{ state: lookup('sayHi') }],
    },
  ],
});
