import { defineLesson } from '../define';
import type { FlowState } from '../engines/flow';

/*
 * Follows the SOLID section of the OOP notes: the fat Worker interface split into Workable and Eatable,
 * and OrderService depending on a Database interface so MySQLDatabase and InMemoryTestDatabase are interchangeable.
 */

// Step 1: a fat interface forces implementers to carry methods they cannot honor.
const fat = (robot: boolean): FlowState => ({
  nodes: [
    { id: 'w', label: 'Worker', sub: 'work() + eat()', kind: 'gateway', x: 2.9, y: 0.4 },
    { id: 'h', label: 'Human', kind: 'client', x: 0.4, y: 2.9, status: 'active' },
    { id: 'r', label: 'Robot', sub: robot ? 'eat() makes no sense' : 'implements Worker', kind: 'worker', x: 5.4, y: 2.9, status: robot ? 'down' : 'normal' },
  ],
  links: [{ from: 'h', to: 'w', dashed: true }, { from: 'r', to: 'w', dashed: true }],
  packets: robot ? [{ from: 'w', to: 'r', label: 'eat()?', tone: 'bad', dur: 0.9 }] : [],
  stats: [
    { label: 'Interface', value: 'one fat Worker' },
    { label: 'Robot forced to', value: robot ? 'add eat()' : 'implement all', tone: robot ? 'bad' : 'neutral' },
    { label: 'Usual result', value: robot ? 'throws, no-op' : '?', tone: robot ? 'bad' : 'neutral' },
  ],
  note: robot ? { text: 'implementers carry methods they cannot honor', tone: 'bad' } : { text: 'one general-purpose interface for every kind of worker', tone: 'accent' },
});

// Step 2: ISP. Small interfaces, each class picks what it needs.
const isp: FlowState = {
  nodes: [
    { id: 'wk', label: 'Workable', sub: 'work()', kind: 'gateway', x: 2.9, y: 0.3 },
    { id: 'ea', label: 'Eatable', sub: 'eat()', kind: 'gateway', x: 5.6, y: 1.7 },
    { id: 'r', label: 'Robot', kind: 'worker', x: 0.4, y: 3.0 },
    { id: 'h', label: 'Human', kind: 'client', x: 3.4, y: 3.0, status: 'active' },
  ],
  links: [{ from: 'r', to: 'wk', dashed: true }, { from: 'h', to: 'wk', dashed: true }, { from: 'h', to: 'ea', dashed: true }],
  stats: [
    { label: 'Robot implements', value: 'Workable', tone: 'ok' },
    { label: 'Human implements', value: 'both', tone: 'ok' },
    { label: 'Dead methods', value: '0', tone: 'ok' },
  ],
  note: { text: 'many small interfaces beat one large general-purpose one', tone: 'ok' },
};

// Step 3: DIP, the bad version. The high-level class builds a concrete low-level one.
const coupled: FlowState = {
  nodes: [
    { id: 'o', label: 'OrderService', sub: 'high level', kind: 'service', x: 0.5, y: 1.7 },
    { id: 'm', label: 'MySQLDatabase', sub: 'new MySQLDatabase()', kind: 'db', x: 4.8, y: 1.7 },
  ],
  links: [{ from: 'o', to: 'm', label: 'creates' }],
  packets: [{ from: 'o', to: 'm', label: 'save', dur: 0.9 }],
  stats: [
    { label: 'Coupling', value: 'concrete class', tone: 'bad' },
    { label: 'Unit test needs', value: 'a real MySQL', tone: 'bad' },
    { label: 'Switch database', value: 'edit service', tone: 'bad' },
  ],
  note: { text: 'the policy class is welded to a detail', tone: 'bad' },
};

// Step 4: DIP, the good version. Both depend on the abstraction, the dependency is injected.
const inverted = (swap: 'mysql' | 'memory'): FlowState => ({
  nodes: [
    { id: 'o', label: 'OrderService', sub: 'constructor(db)', kind: 'service', x: 0.1, y: 1.7 },
    { id: 'd', label: 'Database', sub: 'interface: save()', kind: 'gateway', x: 2.8, y: 1.7 },
    { id: 'm', label: 'MySQLDatabase', kind: 'db', x: 5.4, y: 0.5, status: swap === 'mysql' ? 'active' : 'dim' },
    { id: 'i', label: 'InMemoryTestDb', kind: 'cache', x: 5.4, y: 2.9, status: swap === 'memory' ? 'active' : 'dim' },
  ],
  links: [{ from: 'o', to: 'd' }, { from: 'm', to: 'd', dashed: true }, { from: 'i', to: 'd', dashed: true }],
  packets: [{ from: 'o', to: 'd', label: 'save', dur: 0.6 }, { from: 'd', to: swap === 'mysql' ? 'm' : 'i', label: 'save', delay: 0.6, tone: 'ok', dur: 0.7 }],
  stats: [
    { label: 'OrderService', value: 'unchanged', tone: 'ok' },
    { label: 'Injected', value: swap === 'mysql' ? 'MySQL' : 'in-memory', tone: 'ok' },
    { label: 'Unit test', value: swap === 'memory' ? 'no database' : 'needs DB' },
  ],
  note: swap === 'memory' ? { text: 'tests inject a fake: no server, no setup', tone: 'ok' } : { text: 'production injects the real database', tone: 'accent' },
});

export default defineLesson('flow', {
  slug: 'oop-solid-isp-dip',
  objectives: [
    { text: 'Why a fat interface forces dead methods on implementers', step: 1 },
    { text: 'How Interface Segregation splits it', step: 2 },
    { text: 'What goes wrong when a class creates its own dependencies', step: 3 },
    { text: 'How Dependency Inversion and injection fix it', step: 4 },
  ],
  steps: [
    {
      label: 'Fat interface',
      title: 'Forced to implement everything',
      tag: 'problem',
      body: ['A `Worker` interface with `work()` and `eat()` forces a `Robot` to implement `eat()`, which makes no sense.', 'It ends up throwing or doing nothing.'],
      keyIdea: 'Methods an implementer cannot honor are a design smell, not a coding problem.',
      frames: [{ state: fat(false), hold: 2000 }, { state: fat(true), hold: 3000 }],
    },
    {
      label: 'ISP',
      title: 'Many small interfaces',
      tag: 'technique',
      body: ['Split into `Workable` and `Eatable`. `Robot` implements `Workable`, `Human` implements both.', 'Callers that only need `work()` depend only on `Workable`.'],
      keyIdea: 'No class should depend on methods it does not use.',
      frames: [{ state: isp, hold: 3200 }],
    },
    {
      label: 'Coupled',
      title: 'High level welded to low level',
      tag: 'problem',
      body: ['`OrderService` that does `new MySQLDatabase()` is tightly coupled to one concrete database.', 'Unit tests need a real MySQL, and switching databases means editing the service.'],
      keyIdea: 'Business policy should not know which database or API it runs against.',
      frames: [{ state: coupled, hold: 3200 }],
    },
    {
      label: 'DIP',
      title: 'Depend on an abstraction',
      tag: 'technique',
      body: ['Both `OrderService` and the databases depend on a `Database` interface. The concrete one is **injected** through the constructor.', 'The dependency arrow into the concrete database is inverted.'],
      keyIdea: 'Swapping `MySQLDatabase` for `InMemoryTestDatabase` in unit tests becomes trivial.',
      frames: [{ state: inverted('mysql'), hold: 2600 }, { state: inverted('memory'), hold: 3200 }],
    },
    {
      label: 'Recap',
      title: 'Interfaces and inversion',
      tag: 'recap',
      body: [
        '- **ISP:** small, specific interfaces so no one implements dead methods.',
        '- **DIP:** depend on abstractions, inject the concrete class.',
        '- **Payoff:** swappable implementations and tests without real infrastructure.',
        '- **Smells:** methods that throw "not supported", `new` of infrastructure inside services.',
        '- **Together with SRP, OCP, LSP:** the five SOLID principles.',
      ],
      keyIdea: 'Dependency injection is how DIP shows up in real code: constructors take interfaces.',
      frames: [{ state: inverted('memory') }],
    },
  ],
});
