import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the Java notes on initialization order. JavaScript classes initialise in the same order for the cases
 * shown (static blocks when the class is defined, parent fields and constructor before child fields and constructor),
 * so the order below is produced by running an equivalent class hierarchy and recording each step.
 */

function runChild(): string[] {
  const log: string[] = [];
  class Parent {
    static {
      log.push('Parent static block');
    }
    _i = log.push('Parent instance block');
    constructor() {
      log.push('Parent constructor');
    }
  }
  class Child extends Parent {
    static {
      log.push('Child static block');
    }
    _j = log.push('Child instance block');
    constructor() {
      super();
      log.push('Child constructor');
    }
  }
  void new Child();
  return log;
}
const ORDER = runChild();

function runTrap(): string {
  let seen: unknown = 'unset';
  class Base {
    constructor() {
      this.init();
    }
    init(): void {}
  }
  class Derived extends Base {
    value = 'set';
    override init(): void {
      seen = (this as { value?: string }).value;
    }
  }
  void new Derived();
  return seen === undefined ? 'null' : String(seen);
}
const TRAP = runTrap();

const owner = (entry: string) => (entry.startsWith('Parent') ? 'parent' : 'child');
const ACTORS: SeqState['actors'] = [
  { id: 'main', label: 'main', kind: 'client' },
  { id: 'parent', label: 'Parent', kind: 'service' },
  { id: 'child', label: 'Child', kind: 'service' },
];
const NEW: SeqMessage = { from: 'main', to: 'child', label: 'new Child()' };
const MESSAGES: SeqMessage[] = [
  NEW,
  ...ORDER.map((entry, i): SeqMessage => ({ from: 'main', to: owner(entry), label: `${i + 1}. ${entry}`, tone: entry.includes('static') ? 'violet' : entry.includes('constructor') ? 'ok' : 'req' })),
];

const upTo = (n: number): SeqState => {
  const staticN = Math.min(Math.max(n - 1, 0), 2);
  const instN = Math.max(n - 3, 0);
  return {
    actors: ACTORS,
    messages: MESSAGES.slice(0, n),
    stats: [
      { label: 'Static blocks', value: n >= 3 ? 'ran once' : n === 2 ? '1 of 2' : '-', tone: n >= 3 ? 'ok' : 'neutral' },
      { label: 'Instance steps', value: n >= 3 ? `${instN} of 4` : '-', tone: instN === 4 ? 'ok' : 'neutral' },
      { label: 'Steps run', value: `${staticN + instN} of 6` },
    ],
    note:
      n === 1
        ? { text: 'which of the six steps runs first?', tone: 'accent' }
        : n <= 3
          ? { text: 'static initialisation runs once per class, parent first', tone: 'accent' }
          : n === 7
            ? { text: 'every new Child() repeats the last four steps, never the static ones', tone: 'ok' }
            : { text: 'for each new object, the parent is fully set up before the child', tone: 'accent' },
  };
};

// Step 4: calling an overridable method from a constructor.
const TRAP_ACTORS: SeqState['actors'] = [
  { id: 'main', label: 'main', kind: 'client' },
  { id: 'base', label: 'Base', kind: 'service' },
  { id: 'derived', label: 'Derived', kind: 'service' },
];
const TRAP_MESSAGES: SeqMessage[] = [
  { from: 'main', to: 'derived', label: 'new Derived()' },
  { from: 'derived', to: 'base', label: 'super() runs first', tone: 'violet' },
  { from: 'base', to: 'derived', label: 'init() override runs', tone: 'bad' },
  { from: 'derived', to: 'main', label: `prints: ${TRAP}`, tone: 'bad', dashed: true },
];
const trapState = (n: number): SeqState => ({
  actors: TRAP_ACTORS,
  messages: TRAP_MESSAGES.slice(0, n),
  stats: [
    { label: 'Base()', value: 'calls init()' },
    { label: 'value is', value: n >= 4 ? TRAP : '-', tone: n >= 4 ? 'bad' : 'neutral' },
    { label: 'Field set', value: n >= 4 ? 'later' : '-' },
  ],
  note: n >= 4 ? { text: `Derived's field initialiser has not run yet, so value is ${TRAP}`, tone: 'bad' } : { text: 'the parent constructor calls a method the child overrides', tone: 'accent' },
});

export default defineLesson('sequence', {
  slug: 'java-init-order',
  objectives: [
    { text: 'The order of static blocks, instance blocks and constructors', step: 1 },
    { text: 'Why static initialisation runs once, parent first', step: 2 },
    { text: 'Why the parent is built before the child on every new', step: 3 },
    { text: 'Why calling an overridable method in a constructor is a bug', step: 4 },
  ],
  steps: [
    {
      label: 'The puzzle',
      title: 'new Child(): what runs first?',
      tag: 'problem',
      body: ['Two classes each have a static block, an instance block and a constructor. Calling `new Child()` triggers all of them.', 'The order is fixed, and it is a favourite interview question.'],
      keyIdea: 'Learn the rule, not the output.',
      frames: [{ state: upTo(1), hold: 2600 }],
    },
    {
      label: 'Static',
      title: 'Class setup, once',
      tag: 'concept',
      body: ['Static blocks run when the class is first loaded, **once per class**, and a parent is initialised before its child.', 'A second `new Child()` does not run them again.'],
      keyIdea: 'Static init: top-down from parent to child, once.',
      frames: [{ state: upTo(2), hold: 1800 }, { state: upTo(3), hold: 3000 }],
    },
    {
      label: 'Instance',
      title: 'Parent before child, every time',
      tag: 'technique',
      body: ['For each `new`, the parent runs its instance block and constructor first, then the child runs its own.', 'Every constructor implicitly calls `super()` first, which is what forces that order.'],
      keyIdea: 'Instance init: parent block, parent constructor, child block, child constructor.',
      frames: [{ state: upTo(4), hold: 1500 }, { state: upTo(5), hold: 1500 }, { state: upTo(6), hold: 1500 }, { state: upTo(7), hold: 3400 }],
    },
    {
      label: 'The trap',
      title: 'Overridable call in a constructor',
      tag: 'trade-off',
      body: ['If the `Base` constructor calls a method that `Derived` overrides, the override runs before `Derived`\'s fields are initialised.', `The override reads a field that is still unset, so it prints ${TRAP}.`],
      keyIdea: 'Never call overridable methods from a constructor.',
      frames: [{ state: trapState(1), hold: 1600 }, { state: trapState(2), hold: 1600 }, { state: trapState(3), hold: 1600 }, { state: trapState(4), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Initialisation order',
      tag: 'recap',
      body: [
        '- **Static blocks:** once per class, parent then child.',
        '- **Per object:** parent instance block, parent constructor, child instance block, child constructor.',
        '- **super():** implicit first statement in every constructor.',
        '- **Trap:** an overridden method called from a constructor sees unset fields.',
      ],
      keyIdea: 'Parents are always fully built before the child starts.',
      frames: [{ state: upTo(7) }],
    },
  ],
});
