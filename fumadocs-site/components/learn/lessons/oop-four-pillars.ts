import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Examples follow the OOP notes: BankAccount with a private balance, a PaymentGateway interface, Employee and Manager,
 * and Shape with Circle and Rectangle. The areas are computed with Math.PI so 12.57 and 12 match the notes.
 */

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };

function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

type Tone = 'ok' | 'bad' | 'accent';
const badge = (actors: SeqActor[], id: string, text: string, tone: Tone = 'accent'): SeqActor[] => actors.map((a) => (a.id === id ? { ...a, badge: { text, tone } } : a));

// Step 1: without protection, any code can break the object's rules.
const OPEN: SeqActor[] = [
  { id: 'c', label: 'Any caller', kind: 'client' },
  { id: 'a', label: 'Account', kind: 'db', badge: { text: 'balance 100', tone: 'accent' } },
];
const openFrames = reveal(OPEN, [
  {
    msgs: [{ from: 'c', to: 'a', label: 'balance = -5', tone: 'bad' }],
    actors: badge(OPEN, 'a', 'balance -5', 'bad'),
    hold: 3000,
    stats: [{ label: 'Public field', value: 'anyone writes' }, { label: 'Invariant', value: 'broken', tone: 'bad' }, { label: 'Four pillars', value: 'manage change' }],
    note: { text: 'nothing stops code from putting an object in an invalid state', tone: 'bad' },
  },
]);

// Step 2: encapsulation. Private state, mutation only through methods that enforce the rule.
const ACC: SeqActor[] = [
  { id: 'c', label: 'Caller', kind: 'client' },
  { id: 'a', label: 'BankAccount', kind: 'service', badge: { text: '#balance 100', tone: 'accent' } },
];
const encStats = (state: string): Stat[] => [{ label: 'Field', value: '#balance' }, { label: 'Only way in', value: 'withdraw()' }, { label: 'Balance', value: state }];
const encFrames = reveal(ACC, [
  { msgs: [{ from: 'c', to: 'a', label: 'acc.balance = -5', lost: true, tone: 'bad' }], hold: 2000, stats: encStats('100'), note: { text: 'blocked: the field is private', tone: 'bad' } },
  { msgs: [{ from: 'c', to: 'a', label: 'withdraw(500)' }, { from: 'a', to: 'c', label: 'Insufficient funds', dashed: true, tone: 'bad' }], hold: 2200, stats: encStats('100'), note: { text: 'the method enforces the rule before changing state', tone: 'accent' } },
  { msgs: [{ from: 'c', to: 'a', label: 'withdraw(30)' }, { from: 'a', to: 'c', label: 'ok', dashed: true, tone: 'ok' }], actors: badge(ACC, 'a', '#balance 70', 'ok'), hold: 3000, stats: encStats('70'), note: { text: 'valid change: 100 - 30 = 70', tone: 'ok' } },
]);

// Step 3: abstraction. Callers depend on a small contract, implementations stay hidden and swappable.
const ABS: SeqActor[] = [
  { id: 'c', label: 'Checkout', kind: 'client' },
  { id: 'g', label: 'PaymentGateway', kind: 'gateway', badge: { text: 'interface', tone: 'accent' } },
  { id: 's', label: 'StripeGateway', kind: 'external' },
];
const absStats: Stat[] = [{ label: 'Caller knows', value: 'charge()' }, { label: 'Hidden', value: 'API, retries' }, { label: 'Swap impl', value: 'no edits', tone: 'ok' }];
const absFrames = reveal(ABS, [
  { msgs: [{ from: 'c', to: 'g', label: 'charge(50)' }], hold: 1700, stats: absStats },
  { msgs: [{ from: 'g', to: 's', label: 'HTTP call, retries', tone: 'data' }, { from: 's', to: 'c', label: 'receipt', dashed: true, tone: 'ok' }], hold: 3000, stats: absStats, note: { text: 'complexity lives behind the interface', tone: 'ok' } },
]);

// Step 4: inheritance. Manager is an Employee, and overrides one method.
const BASE = 5000;
const BONUS = 1000;
const INH: SeqActor[] = [
  { id: 'c', label: 'Caller', kind: 'client' },
  { id: 'm', label: 'Manager', kind: 'service', badge: { text: 'extends Employee', tone: 'accent' } },
  { id: 'e', label: 'Employee', kind: 'worker', badge: { text: 'superclass', tone: 'accent' } },
];
const inhStats: Stat[] = [{ label: 'Is-a', value: 'Manager is-a' }, { label: 'Reuses', value: 'name, salary' }, { label: 'Overrides', value: 'getSalary()' }];
const inhFrames = reveal(INH, [
  { msgs: [{ from: 'm', to: 'e', label: 'inherits fields', dashed: true, tone: 'accent' }], hold: 1800, stats: inhStats },
  { msgs: [{ from: 'c', to: 'm', label: 'getSalary()' }, { from: 'm', to: 'm', label: `${BASE} + ${BONUS}`, tone: 'data' }, { from: 'm', to: 'c', label: String(BASE + BONUS), dashed: true, tone: 'ok' }], hold: 3200, stats: inhStats, note: { text: 'the subclass replaces the parent behavior (example numbers)', tone: 'ok' } },
]);

// Step 5: polymorphism. One call, the actual type decides. Areas computed for real.
const circle = Math.PI * 2 ** 2;
const rect = 3 * 4;
const POLY: SeqActor[] = [
  { id: 'p', label: 'printArea(shape)', kind: 'client' },
  { id: 'c', label: 'Circle r=2', kind: 'service' },
  { id: 'r', label: 'Rectangle 3x4', kind: 'worker' },
];
const polyStats = (a: string): Stat[] => [{ label: 'Call', value: 'shape.area()' }, { label: 'Chosen by', value: 'actual type' }, { label: 'Result', value: a, tone: 'ok' }];
const polyFrames = reveal(POLY, [
  { msgs: [{ from: 'p', to: 'c', label: 'area()' }, { from: 'c', to: 'p', label: circle.toFixed(2), dashed: true, tone: 'ok' }], hold: 2200, stats: polyStats(circle.toFixed(2)), note: { text: 'Circle runs its own area(): pi x r squared', tone: 'accent' } },
  { msgs: [{ from: 'p', to: 'r', label: 'area()' }, { from: 'r', to: 'p', label: String(rect), dashed: true, tone: 'ok' }], hold: 3200, stats: polyStats(String(rect)), note: { text: 'same call, other type, other behavior: width x height', tone: 'ok' } },
]);

// Step 6: encapsulation versus abstraction, with the car from the notes.
const CAR: SeqActor[] = [
  { id: 'd', label: 'Driver', kind: 'client' },
  { id: 'w', label: 'Steering wheel', kind: 'gateway', badge: { text: 'abstraction', tone: 'accent' } },
  { id: 'k', label: 'Steering rack', kind: 'worker', badge: { text: 'encapsulated', tone: 'accent' } },
];
const carStats: Stat[] = [{ label: 'Abstraction', value: 'complexity' }, { label: 'Encapsulation', value: 'hides data' }, { label: 'Kind', value: 'design' }];
const carFrames = reveal(CAR, [
  { msgs: [{ from: 'd', to: 'w', label: 'turn left' }, { from: 'w', to: 'k', label: 'rack moves', dashed: true, tone: 'data' }], hold: 2200, stats: carStats, note: { text: 'you do not need to know how the rack works to drive', tone: 'accent' } },
  { msgs: [{ from: 'd', to: 'k', label: 'tamper with it', lost: true, tone: 'bad' }], hold: 3200, stats: carStats, note: { text: 'the rack is sealed inside the body: you cannot touch it', tone: 'bad' } },
]);

export default defineLesson('sequence', {
  slug: 'oop-four-pillars',
  objectives: [
    { text: 'What each pillar protects you from', step: 1 },
    { text: 'How encapsulation guards an invariant', step: 2 },
    { text: 'How abstraction hides complexity behind an interface', step: 3 },
    { text: 'How inheritance reuses and overrides', step: 4 },
    { text: 'How polymorphism picks behavior at runtime', step: 5 },
    { text: 'The difference between encapsulation and abstraction', step: 6 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Objects that anyone can break',
      tag: 'problem',
      body: ['OOP bundles **state and behavior** into objects. Each pillar answers a different question about managing change.', 'Without rules, any code can write any value into any field.'],
      keyIdea: 'The pillars are tools for managing change, not checkboxes to recite.',
      frames: openFrames,
    },
    {
      label: 'Encapsulation',
      title: 'Protect the invariant',
      tag: 'concept',
      body: ['**Encapsulation** keeps state private and exposes methods that enforce the rules. `#balance` cannot be set from outside.', 'All mutation goes through `withdraw`, so the balance can never become invalid.'],
      keyIdea: 'Expose a getter, not a setter, when callers should only read.',
      frames: encFrames,
    },
    {
      label: 'Abstraction',
      title: 'Hide the complexity',
      tag: 'concept',
      body: ['**Abstraction** gives callers a small contract: an interface or abstract class. How it works stays out of sight.', 'Checkout calls `charge(50)` and never learns whether Stripe or another provider answers.'],
      keyIdea: 'Abstraction hides volatility: the part most likely to change sits behind the stable interface.',
      frames: absFrames,
    },
    {
      label: 'Inheritance',
      title: 'Reuse through is-a',
      tag: 'concept',
      body: ['A subclass acquires fields and methods from its superclass. `Manager` **is an** `Employee`, reuses `name` and `baseSalary`, and overrides `getSalary()`.', 'It is code reuse, but it also couples the child to the parent.'],
      keyIdea: 'Use it only for true is-a relationships. Otherwise prefer composition.',
      frames: inhFrames,
    },
    {
      label: 'Polymorphism',
      title: 'One call, many behaviors',
      tag: 'concept',
      body: ['`printArea(shape)` calls `shape.area()` and the **actual type** decides what runs. A circle with radius 2 gives 12.57, a 3 by 4 rectangle gives 12.', 'New shapes plug in without changing `printArea`.'],
      keyIdea: 'Overriding is resolved at runtime. Overloading (same name, different signature) is resolved at compile time.',
      frames: polyFrames,
    },
    {
      label: 'Which is which',
      title: 'Encapsulation vs abstraction',
      tag: 'trade-off',
      body: ['**Encapsulation** hides data. It is a mechanism: `private`, `#field`, getters. **Abstraction** hides complexity. It is a design decision: interfaces and abstract classes.', 'The steering wheel is abstraction. The sealed steering rack is encapsulation.'],
      keyIdea: 'Ask what is being hidden: state from outside changes, or implementation behind a simpler interface.',
      frames: carFrames,
    },
    {
      label: 'Recap',
      title: 'The four pillars',
      tag: 'recap',
      body: [
        '- **Encapsulation:** private state, methods enforce invariants.',
        '- **Abstraction:** small interface, hidden complexity.',
        '- **Inheritance:** is-a reuse, override what differs.',
        '- **Polymorphism:** the actual type picks the behavior at runtime.',
        '- **Together:** new types plug in without touching existing code.',
      ],
      keyIdea: 'Encapsulation protects invariants, abstraction hides volatility, polymorphism lets new types plug in.',
      frames: [polyFrames[polyFrames.length - 1]],
    },
  ],
});
