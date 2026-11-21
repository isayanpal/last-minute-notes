import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Follows the Design Patterns section of the OOP notes: ConfigManager singleton, createNotification factory,
 * PriceCalculator with DiscountStrategy. The strategy prices are computed (100 x 0.9 for the seasonal discount).
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

// Step 1: callers that call `new` are welded to concrete classes.
const NEWS: SeqActor[] = [
  { id: 'c', label: 'Caller', kind: 'client' },
  { id: 'e', label: 'EmailNotification', kind: 'service' },
  { id: 's', label: 'SmsNotification', kind: 'worker' },
];
const newFrames = reveal(NEWS, [
  {
    msgs: [{ from: 'c', to: 'e', label: 'new EmailNotification()' }, { from: 'c', to: 's', label: 'new SmsNotification()' }],
    hold: 3200,
    stats: [{ label: 'Caller knows', value: 'every class' }, { label: 'New channel', value: 'edit callers', tone: 'bad' }, { label: 'Fix', value: 'own creation' }],
    note: { text: 'creation logic is scattered and callers know concrete types', tone: 'bad' },
  },
]);

// Step 2: singleton. A private constructor forces everyone through getInstance().
const SINGLE: SeqActor[] = [
  { id: 'a', label: 'Caller A', kind: 'client' },
  { id: 'm', label: 'ConfigManager', kind: 'service' },
  { id: 'b', label: 'Caller B', kind: 'client' },
];
const singleStats = (n: string): Stat[] => [{ label: 'Instances', value: n, tone: 'ok' }, { label: 'Constructor', value: 'private' }, { label: 'Access', value: 'getInstance()' }];
const singletonFrames = reveal(SINGLE, [
  { msgs: [{ from: 'a', to: 'm', label: 'new ConfigManager()', lost: true, tone: 'bad' }], hold: 1900, stats: singleStats('0'), note: { text: 'blocked: the constructor is private', tone: 'bad' } },
  { msgs: [{ from: 'a', to: 'm', label: 'getInstance()' }, { from: 'm', to: 'm', label: 'none yet: create', tone: 'data' }], actors: badge(SINGLE, 'm', 'instance #1', 'ok'), hold: 2000, stats: singleStats('1') },
  { msgs: [{ from: 'b', to: 'm', label: 'getInstance()' }, { from: 'm', to: 'b', label: 'same instance #1', dashed: true, tone: 'ok' }], actors: badge(SINGLE, 'm', 'instance #1', 'ok'), hold: 3200, stats: singleStats('1'), note: { text: 'use it for config or a pool, but beware hidden global state in tests', tone: 'accent' } },
]);

// Step 3: factory. The caller asks by name and only sees the interface.
const FACT: SeqActor[] = [
  { id: 'c', label: 'Caller', kind: 'client' },
  { id: 'f', label: 'createNotification', kind: 'gateway' },
  { id: 'n', label: 'Notification', kind: 'service', badge: { text: 'interface', tone: 'accent' } },
];
const factStats = (type: string): Stat[] => [{ label: 'Asked for', value: type }, { label: 'Caller sees', value: 'Notification' }, { label: 'New type', value: 'edit factory', tone: 'ok' }];
const factoryFrames = reveal(FACT, [
  { msgs: [{ from: 'c', to: 'f', label: 'create("sms")' }, { from: 'f', to: 'c', label: 'SmsNotification', dashed: true, tone: 'ok' }], hold: 2400, stats: factStats('sms') },
  { msgs: [{ from: 'c', to: 'n', label: 'send(msg)', tone: 'ok' }], hold: 3000, stats: factStats('sms'), note: { text: 'the caller never names a concrete class', tone: 'ok' } },
]);

// Step 4: strategy. Swap the algorithm at runtime. Prices are computed from the strategies.
const PRICE = 100;
const strategies = { NoDiscount: (p: number) => p, SeasonalDiscount: (p: number) => p * 0.9 };
const STRAT: SeqActor[] = [
  { id: 'c', label: 'Caller', kind: 'client' },
  { id: 'p', label: 'PriceCalculator', kind: 'service' },
  { id: 's', label: 'strategy', kind: 'worker' },
];
const withStrategy = (name: keyof typeof strategies): SeqActor[] => STRAT.map((a) => (a.id === 's' ? { ...a, label: name, badge: { text: 'swappable', tone: 'accent' as const } } : a));
const stratStats = (price: number): Stat[] => [{ label: 'Input', value: String(PRICE) }, { label: 'Price', value: String(price), tone: 'ok' }, { label: 'Calculator code', value: 'unchanged' }];
const strategyFrames = (['NoDiscount', 'SeasonalDiscount'] as const).flatMap((name, i): Frame<SeqState>[] => {
  const price = strategies[name](PRICE);
  return reveal(withStrategy(name), [
    { msgs: [{ from: 'c', to: 'p', label: `finalPrice(${PRICE})` }, { from: 'p', to: 's', label: 'apply(100)' }, { from: 's', to: 'c', label: String(price), dashed: true, tone: 'ok' }], hold: i === 0 ? 2400 : 3200, stats: stratStats(price), note: { text: i === 0 ? 'NoDiscount returns the price unchanged' : 'SeasonalDiscount applies 0.9: same call, new behavior', tone: i === 0 ? 'accent' : 'ok' } },
  ]);
});

export default defineLesson('sequence', {
  slug: 'oop-patterns-creation-strategy',
  objectives: [
    { text: 'Why scattering `new` calls couples callers to concrete classes', step: 1 },
    { text: 'How a singleton guarantees one instance', step: 2 },
    { text: 'How a factory hides concrete types', step: 3 },
    { text: 'How Strategy swaps an algorithm at runtime', step: 4 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Callers know too much',
      tag: 'problem',
      body: ['When every caller writes `new EmailNotification()` or `new SmsNotification()`, each one knows every concrete class.', 'Adding a channel means editing every caller.'],
      keyIdea: 'Patterns move creation and variation out of the callers.',
      frames: newFrames,
    },
    {
      label: 'Singleton',
      title: 'Exactly one instance',
      tag: 'concept',
      body: ['A **singleton** has a private constructor and a static `getInstance()`. The first call creates the object, every later call returns it.', 'Good for app-wide config or a shared connection pool.'],
      keyIdea: 'Overused singletons become hidden global state and make tests harder.',
      frames: singletonFrames,
    },
    {
      label: 'Factory',
      title: 'Ask by name, get an interface',
      tag: 'concept',
      body: ['A **factory** method takes a type name and returns a `Notification`. The caller only ever sees the interface.', 'Adding a channel means changing the factory, not the callers.'],
      keyIdea: 'Factories pair naturally with abstraction: the return type is the interface.',
      frames: factoryFrames,
    },
    {
      label: 'Strategy',
      title: 'Swap the algorithm',
      tag: 'technique',
      body: ['**Strategy** puts interchangeable algorithms behind one interface. The context holds a strategy and delegates to it.', 'Swapping `NoDiscount` for `SeasonalDiscount` changes 100 into 90 without touching `PriceCalculator`.'],
      keyIdea: 'It is the Open/Closed Principle in practice: new behavior by adding a class.',
      frames: strategyFrames,
    },
    {
      label: 'Recap',
      title: 'Three patterns',
      tag: 'recap',
      body: [
        '- **Singleton:** one instance, private constructor, `getInstance()`.',
        '- **Factory:** callers ask by name and see only the interface.',
        '- **Strategy:** interchangeable algorithms, chosen at runtime.',
        '- **Watch out:** singletons are global state.',
        '- **Common root:** program to an abstraction, not a concrete class.',
      ],
      keyIdea: 'Reach for a pattern when you feel the pain it solves, not before.',
      frames: [strategyFrames[strategyFrames.length - 1]],
    },
  ],
});
