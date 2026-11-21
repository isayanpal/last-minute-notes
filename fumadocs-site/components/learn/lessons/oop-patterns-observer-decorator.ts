import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Follows the OOP notes: the orderPlaced EventEmitter with email and inventory listeners, the SimpleCoffee and MilkDecorator example
 * (2 + 0.5 = 2.5), and the prototype chain lookup of user.toJSON() through a Serializable mixin.
 */

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };

function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

// Step 1: a publisher that calls each dependent directly must be edited for every new one.
const DIRECT: SeqActor[] = [
  { id: 'o', label: 'OrderService', kind: 'service' },
  { id: 'e', label: 'Email', kind: 'external' },
  { id: 'i', label: 'Inventory', kind: 'db' },
];
const directFrames = reveal(DIRECT, [
  {
    msgs: [{ from: 'o', to: 'e', label: 'sendConfirmation()' }, { from: 'o', to: 'i', label: 'updateStock()' }],
    hold: 3200,
    stats: [{ label: 'Publisher knows', value: 'every listener' }, { label: 'New listener', value: 'edit publisher', tone: 'bad' }, { label: 'Coupling', value: 'tight', tone: 'bad' }],
    note: { text: 'OrderService must change every time someone cares about an order', tone: 'bad' },
  },
]);

// Step 2: observer. Subscribers register, the publisher notifies without knowing who they are.
const OBS: SeqActor[] = [
  { id: 'm', label: 'Email listener', kind: 'external' },
  { id: 'p', label: 'orderPlaced', kind: 'queue' },
  { id: 'v', label: 'Inventory', kind: 'db' },
  { id: 'a', label: 'Application', kind: 'client' },
];
const obsStats = (n: number): Stat[] => [{ label: 'Subscribers', value: String(n) }, { label: 'Publisher knows', value: 'only a list' }, { label: 'Same idea', value: 'DOM, Redux' }];
const observerFrames = reveal(OBS, [
  { msgs: [{ from: 'm', to: 'p', label: 'subscribe(fn)' }, { from: 'v', to: 'p', label: 'subscribe(fn)' }], hold: 2200, stats: obsStats(2), note: { text: 'listeners register themselves', tone: 'accent' } },
  { msgs: [{ from: 'a', to: 'p', label: 'publish({orderId})' }], hold: 1700, stats: obsStats(2) },
  { msgs: [{ from: 'p', to: 'm', label: 'fn(data)', tone: 'ok' }, { from: 'p', to: 'v', label: 'fn(data)', tone: 'ok' }], hold: 3200, stats: obsStats(2), note: { text: 'everyone subscribed is notified: email sent, stock updated', tone: 'ok' } },
]);

// Step 3: decorator. Wrap an object to add behavior. Cost is computed through the wrapping.
const SIMPLE = 2;
const MILK = 0.5;
const DEC: SeqActor[] = [
  { id: 'c', label: 'Caller', kind: 'client' },
  { id: 'm', label: 'MilkDecorator', kind: 'gateway', badge: { text: 'wraps a Coffee', tone: 'accent' } },
  { id: 's', label: 'SimpleCoffee', kind: 'service' },
];
const decStats = (cost: string): Stat[] => [{ label: 'Interface', value: 'Coffee' }, { label: 'Other coffees', value: 'untouched', tone: 'ok' }, { label: 'cost()', value: cost, tone: 'ok' }];
const decoratorFrames = reveal(DEC, [
  { msgs: [{ from: 'c', to: 'm', label: 'cost()' }, { from: 'm', to: 's', label: 'cost()' }], hold: 2000, stats: decStats('?') },
  { msgs: [{ from: 's', to: 'm', label: String(SIMPLE), dashed: true }, { from: 'm', to: 'm', label: `+ ${MILK}`, tone: 'data' }], hold: 2000, stats: decStats('?') },
  { msgs: [{ from: 'm', to: 'c', label: String(SIMPLE + MILK), dashed: true, tone: 'ok' }], hold: 3200, stats: decStats(String(SIMPLE + MILK)), note: { text: 'each decorator calls the wrapped object and adds its own part', tone: 'ok' } },
]);

// Step 4: JavaScript has no class at the engine level. A method call walks the prototype chain.
const CHAIN: SeqActor[] = [
  { id: 'u', label: 'user.toJSON()', kind: 'client' },
  { id: 'p', label: 'User.prototype', kind: 'worker' },
  { id: 'x', label: 'Serializable mixin', kind: 'gateway' },
  { id: 'm', label: 'Model.prototype', kind: 'service' },
];
const chainStats = (where: string): Stat[] => [{ label: 'Lookup', value: 'walks chain' }, { label: 'Found on', value: where }, { label: 'Mixin', value: 'adds one link' }];
const chainFrames = reveal(CHAIN, [
  { msgs: [{ from: 'u', to: 'u', label: 'own property? no', tone: 'bad' }], hold: 1500, stats: chainStats('?') },
  { msgs: [{ from: 'u', to: 'p', label: 'on User.prototype?' }, { from: 'p', to: 'u', label: 'no', dashed: true, tone: 'bad' }], hold: 1700, stats: chainStats('?') },
  { msgs: [{ from: 'u', to: 'x', label: 'on the mixin?' }, { from: 'x', to: 'u', label: 'yes: toJSON', dashed: true, tone: 'ok' }], hold: 3200, stats: chainStats('mixin'), note: { text: 'found: the walk stops, Model.prototype is never reached', tone: 'ok' } },
]);

export default defineLesson('sequence', {
  slug: 'oop-patterns-observer-decorator',
  objectives: [
    { text: 'Why a publisher that calls dependents directly does not scale', step: 1 },
    { text: 'How Observer decouples publisher and listeners', step: 2 },
    { text: 'How Decorator adds behavior by wrapping', step: 3 },
    { text: 'How JavaScript resolves methods through the prototype chain', step: 4 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'One change, many dependents',
      tag: 'problem',
      body: ['When an order is placed, the confirmation email and the inventory must react. If `OrderService` calls each one directly, it must change whenever a new dependent appears.'],
      keyIdea: 'The thing that changes (who cares) should not live inside the thing that announces.',
      frames: directFrames,
    },
    {
      label: 'Observer',
      title: 'Subscribe, publish, notify',
      tag: 'concept',
      body: ['In the **Observer** pattern listeners `subscribe(fn)` to a subject. `publish(data)` calls every registered listener.', 'The publisher only holds a list. It does not know who is listening.'],
      keyIdea: 'This is the idea behind DOM events, Redux subscriptions and pub/sub systems.',
      frames: observerFrames,
    },
    {
      label: 'Decorator',
      title: 'Wrap to add behavior',
      tag: 'technique',
      body: ['A **decorator** implements the same interface and wraps another object. `MilkDecorator` calls the wrapped `SimpleCoffee` and adds 0.5.', 'Only that one object changes, other instances are untouched.'],
      keyIdea: '`java.io` is the classic case: a `BufferedReader` wraps an `InputStreamReader`.',
      frames: decoratorFrames,
    },
    {
      label: 'Prototype',
      title: 'How JavaScript finds a method',
      tag: 'in practice',
      body: ['JS classes are **syntactic sugar over prototypes**. A call walks `[[Prototype]]` links until it finds the property or reaches `null`.', 'A **mixin** (a function returning a class that extends its argument) adds one more link, and it is how JS gets multiple-inheritance-like reuse.'],
      keyIdea: 'Java reaches for multiple interfaces with `default` methods where JS uses mixins.',
      frames: chainFrames,
    },
    {
      label: 'Recap',
      title: 'Patterns that bend with change',
      tag: 'recap',
      body: [
        '- **Observer:** one-to-many notification, publisher knows only a list.',
        '- **Decorator:** wrap an object, same interface, extra behavior.',
        '- **Prototype chain:** lookups walk `[[Prototype]]` until found.',
        '- **Mixins:** functions that return a class extending their input.',
        '- **Theme:** keep the changing part out of the stable part.',
      ],
      keyIdea: 'Polymorphism lets new listeners, wrappers and mixins plug in without editing existing code.',
      frames: [observerFrames[observerFrames.length - 1]],
    },
  ],
});
