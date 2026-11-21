import { defineLesson } from '../define';
import type { FlowNode, FlowState } from '../engines/flow';

/*
 * Follows the SOLID section of the OOP notes: Invoice split by reason to change, PriceCalculator with DiscountStrategy,
 * and the Bird, Penguin, Flyable, Sparrow fix for Liskov. Classes are flow nodes, links are the class relationships.
 */

// Step 1: a god class has three reasons to change.
const god = (reason: number): FlowState => ({
  nodes: [
    { id: 'inv', label: 'Invoice', sub: 'does everything', kind: 'service', x: 2.9, y: 1.7, status: 'hot', items: ['total', 'save', 'pdf'] },
    { id: 't', label: 'Tax rules', kind: 'external', x: 0.2, y: 0.4, status: reason === 0 ? 'active' : 'dim' },
    { id: 'd', label: 'Schema change', kind: 'db', x: 5.6, y: 0.4, status: reason === 1 ? 'active' : 'dim' },
    { id: 'p', label: 'PDF design', kind: 'cdn', x: 2.9, y: 3.2, status: reason === 2 ? 'active' : 'dim' },
  ],
  links: [{ from: 't', to: 'inv' }, { from: 'd', to: 'inv' }, { from: 'p', to: 'inv' }],
  packets: [{ from: ['t', 'd', 'p'][reason], to: 'inv', label: 'edit', tone: 'bad', dur: 0.8 }],
  stats: [
    { label: 'Reasons to change', value: '3', tone: 'bad' },
    { label: 'Edits touch', value: 'one big class' },
    { label: 'Risk', value: 'regressions', tone: 'bad' },
  ],
  note: { text: 'three unrelated reasons to change live in one class', tone: 'bad' },
});

// Step 2: SRP. One class per reason.
const srp: FlowState = {
  nodes: [
    { id: 'inv', label: 'Invoice', sub: 'data + calculation', kind: 'service', x: 0.2, y: 1.7, status: 'active', items: ['total'] },
    { id: 'repo', label: 'InvoiceRepo', sub: 'persistence', kind: 'db', x: 3.1, y: 0.4, items: ['save'] },
    { id: 'pdf', label: 'InvoicePdfFormat', sub: 'presentation', kind: 'cdn', x: 3.1, y: 3.0, items: ['format'] },
  ],
  links: [{ from: 'repo', to: 'inv', label: 'uses' }, { from: 'pdf', to: 'inv', label: 'uses' }],
  packets: [{ from: 'inv', to: 'repo', label: 'save', tone: 'ok', dur: 0.8 }, { from: 'inv', to: 'pdf', label: 'format', tone: 'ok', delay: 0.4, dur: 0.8 }],
  stats: [
    { label: 'Reasons each', value: '1', tone: 'ok' },
    { label: 'Tax change', value: 'Invoice only', tone: 'ok' },
    { label: 'Schema change', value: 'Repo only', hint: 'one class' },
  ],
  note: { text: 'a class should have only one reason to change', tone: 'ok' },
};

// Step 3: OCP. Add a discount by adding a class, not by editing finalPrice.
const ocp = (withNew: boolean): FlowState => {
  const strategies: FlowNode[] = [
    { id: 'n', label: 'NoDiscount', kind: 'worker', x: 5.4, y: 0.3 },
    { id: 's', label: 'SeasonalDiscount', kind: 'worker', x: 5.4, y: 1.7 },
    ...(withNew ? [{ id: 'b', label: 'BlackFriday', sub: 'new class', kind: 'worker' as const, x: 5.4, y: 3.1, status: 'active' as const }] : []),
  ];
  return {
    nodes: [
      { id: 'c', label: 'finalPrice()', sub: 'closed', kind: 'service', x: 0.1, y: 1.7, badge: { text: 'not edited', tone: 'ok' } },
      { id: 'i', label: 'DiscountStrategy', sub: 'interface', kind: 'gateway', x: 2.8, y: 1.7 },
      ...strategies,
    ],
    links: [{ from: 'c', to: 'i' }, { from: 'i', to: 'n', dashed: true }, { from: 'i', to: 's', dashed: true }, ...(withNew ? [{ from: 'i', to: 'b', dashed: true }] : [])],
    packets: withNew ? [{ from: 'c', to: 'i', label: 'apply', dur: 0.6 }, { from: 'i', to: 'b', label: 'apply', delay: 0.6, tone: 'ok', dur: 0.6 }] : [{ from: 'c', to: 'i', label: 'apply', dur: 0.6 }, { from: 'i', to: 's', label: 'apply', delay: 0.6, dur: 0.6 }],
    stats: [
      { label: 'Strategies', value: withNew ? '3' : '2' },
      { label: 'Edits to finalPrice', value: '0', tone: 'ok' },
      { label: 'To extend', value: 'add a class' },
    ],
    note: withNew ? { text: 'open for extension, closed for modification', tone: 'ok' } : { text: 'finalPrice depends on the interface, not on concrete discounts', tone: 'accent' },
  };
};

// Step 4: LSP. A Penguin that throws on fly() cannot stand in for a Bird.
const lspBad = (crash: boolean): FlowState => ({
  nodes: [
    { id: 'u', label: 'bird.fly()', sub: 'caller', kind: 'client', x: 0.1, y: 1.7 },
    { id: 'b', label: 'Bird', sub: 'fly()', kind: 'service', x: 2.9, y: 0.5 },
    { id: 'p', label: 'Penguin', sub: 'fly() throws', kind: 'worker', x: 2.9, y: 2.9, status: crash ? 'down' : 'normal' },
  ],
  links: [{ from: 'p', to: 'b', label: 'extends' }, { from: 'u', to: 'b' }],
  packets: crash ? [{ from: 'u', to: 'p', label: 'fly()', dur: 0.9 }, { from: 'p', to: 'u', label: 'throws!', delay: 0.9, tone: 'bad', dur: 0.9 }] : [{ from: 'u', to: 'b', label: 'fly()', dur: 0.8 }],
  stats: [
    { label: 'Caller expects', value: 'any Bird flies' },
    { label: 'Penguin', value: crash ? 'crashes caller' : 'looks fine', tone: crash ? 'bad' : 'neutral' },
    { label: 'Substitutable', value: crash ? 'no' : 'not yet tested', tone: crash ? 'bad' : 'neutral' },
  ],
  note: crash ? { text: 'overriding to throw breaks every caller that trusts Bird', tone: 'bad' } : { text: 'Penguin extends Bird and overrides fly()', tone: 'accent' },
});
const lspFix: FlowState = {
  nodes: [
    { id: 'bird', label: 'Bird', sub: 'eat, layEggs', kind: 'service', x: 2.9, y: 0.3 },
    { id: 'fly', label: 'Flyable', sub: 'interface: fly()', kind: 'gateway', x: 5.6, y: 1.7 },
    { id: 'sp', label: 'Sparrow', kind: 'worker', x: 0.4, y: 3.1, status: 'active' },
    { id: 'pe', label: 'Penguin', sub: 'no fly()', kind: 'worker', x: 2.9, y: 3.1 },
  ],
  links: [{ from: 'sp', to: 'bird' }, { from: 'pe', to: 'bird' }, { from: 'sp', to: 'fly', dashed: true }],
  stats: [
    { label: 'fly() promised by', value: 'Flyable only' },
    { label: 'Penguin', value: 'nothing broken', tone: 'ok' },
    { label: 'Callers of Flyable', value: 'safe', tone: 'ok' },
  ],
  note: { text: 'only birds that can fly promise fly()', tone: 'ok' },
};

export default defineLesson('flow', {
  slug: 'oop-solid-srp-ocp-lsp',
  objectives: [
    { text: 'What it means for a class to have several reasons to change', step: 1 },
    { text: 'How to split a class with the Single Responsibility Principle', step: 2 },
    { text: 'How the Open/Closed Principle adds features without edits', step: 3 },
    { text: 'The Liskov Substitution Principle and a classic violation', step: 4 },
  ],
  steps: [
    {
      label: 'God class',
      title: 'Three reasons to change',
      tag: 'problem',
      body: ['An `Invoice` that calculates totals, saves itself and renders a PDF changes when tax rules, the schema or the PDF design change.', 'Each edit risks breaking the other two jobs.'],
      keyIdea: 'SOLID names the smell: here, too many reasons to change.',
      frames: [{ state: god(0), hold: 1800 }, { state: god(1), hold: 1800 }, { state: god(2), hold: 2600 }],
    },
    {
      label: 'SRP',
      title: 'One reason to change',
      tag: 'technique',
      body: ['Split into `Invoice` (data and calculation), `InvoiceRepository` (persistence) and `InvoicePdfFormatter` (presentation).', 'Now a schema change touches only the repository.'],
      keyIdea: 'A class should have only one reason to change.',
      frames: [{ state: srp, hold: 3200 }],
    },
    {
      label: 'OCP',
      title: 'Extend without editing',
      tag: 'technique',
      body: ['`finalPrice` depends on a `DiscountStrategy` interface. A new `BlackFridayDiscount` is a **new class**, and `finalPrice` is not touched.', 'This is also the Strategy pattern.'],
      keyIdea: 'Open for extension, closed for modification.',
      frames: [{ state: ocp(false), hold: 2400 }, { state: ocp(true), hold: 3200 }],
    },
    {
      label: 'LSP',
      title: 'Subclasses must substitute',
      tag: 'trade-off',
      body: ['If `Penguin extends Bird` and `fly()` throws, any code expecting a `Bird` to fly crashes when handed a `Penguin`.', 'Fix the model: only birds that can fly implement `Flyable`, or use composition.'],
      keyIdea: 'Overriding a method to throw or do nothing is the usual sign of a broken hierarchy.',
      frames: [{ state: lspBad(false), hold: 1800 }, { state: lspBad(true), hold: 3000 }, { state: lspFix, hold: 3200 }],
    },
    {
      label: 'Recap',
      title: 'Three principles, three smells',
      tag: 'recap',
      body: [
        '- **SRP:** one reason to change, so split persistence, logic and presentation.',
        '- **OCP:** add behavior by adding classes behind an interface.',
        '- **LSP:** a subtype must work anywhere its base type is used.',
        '- **Smells:** god classes, edits to `if` chains, overrides that throw.',
        '- **Next:** interface segregation and dependency inversion.',
      ],
      keyIdea: 'Ask of any design: can I change one thing without touching the others, and can I swap a type safely?',
      frames: [{ state: ocp(true) }],
    },
  ],
});
