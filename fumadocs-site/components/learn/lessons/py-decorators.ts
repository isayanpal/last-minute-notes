import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Python notes on decorators: @deco above a def is f = deco(f), the name then points at a wrapper that closes over the original,
 * stacked decorators wrap inside out (@a @b def f is f = a(b(f))), and functools.wraps keeps the original name. Real wrapper functions
 * run and record a call log, and the function names are read from the real function objects, so every trace and name is computed.
 */

const log: string[] = [];
type Fn = (...args: number[]) => number;
const named = (f: Fn, name: string): Fn => Object.defineProperty(f, 'name', { value: name });

const makeDeco = (label: string, wraps: boolean) => (fn: Fn): Fn => {
  const wrapper: Fn = (...args) => {
    log.push(`${label}: before`);
    const r = fn(...args);
    log.push(`${label}: after`);
    return r;
  };
  return named(wrapper, wraps ? fn.name : 'wrapper'); // functools.wraps copies __name__
};

const original = (n: number) => {
  log.push('work runs');
  return n * 2;
};
const work: Fn = named(original, 'work');

const timed = makeDeco('timed', true);
const decorated = timed(work); // work = timed(work)
log.length = 0;
decorated(21);
const SINGLE = [...log];

const f: Fn = named((n: number) => {
  log.push('f runs');
  return n;
}, 'f');
const stacked = makeDeco('a', true)(makeDeco('b', true)(f)); // @a @b def f: f = a(b(f))
log.length = 0;
stacked(1);
const STACK = [...log];

const withWraps = makeDeco('timed', true)(work).name;
const withoutWraps = makeDeco('timed', false)(work).name;

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });

const rebind = (after: boolean): FlowState => ({
  nodes: [
    { id: 'name', label: 'work', sub: 'name', kind: 'client', x: 0.1, y: 1.7, status: 'active' },
    ...(after ? ([{ id: 'wrap', label: 'wrapper', sub: 'returned by timed', kind: 'gateway', x: 2.9, y: 1.7, status: 'active' }] as FlowNode[]) : []),
    { id: 'orig', label: 'work()', sub: 'original function', kind: 'service', x: 5.6, y: 1.7, status: after ? 'normal' : 'active' },
  ],
  links: after ? [{ from: 'name', to: 'wrap' }, { from: 'wrap', to: 'orig', dashed: true, label: 'closure' }] : [{ from: 'name', to: 'orig' }],
  packets: after ? [hop('name', 'wrap', 'work = timed(work)', 0, 'ok')] : [],
  stats: [
    { label: 'Statement', value: after ? 'timed(work)' : 'def work(n)' },
    { label: 'work now is', value: after ? 'the wrapper' : 'the original', tone: after ? 'ok' : 'neutral' },
    { label: 'Original', value: after ? 'in a closure' : 'bound' },
  ],
  note: after ? { text: '@timed above def work is just work = timed(work): the name now points at the wrapper', tone: 'ok' } : { text: 'before decoration the name points straight at the function', tone: 'accent' },
});

const call = (k: number): FlowState => {
  const place = [['name', 'wrap'], ['wrap', 'orig'], ['orig', 'wrap']][k - 1];
  return {
    nodes: [
      { id: 'name', label: 'work(21)', sub: 'the call', kind: 'client', x: 0.1, y: 1.7, status: 'normal' },
      { id: 'wrap', label: 'wrapper', sub: 'extra code', kind: 'gateway', x: 2.9, y: 1.7, status: k === 1 || k === 3 ? 'active' : 'normal', items: SINGLE.filter((s) => s.startsWith('timed')).slice(0, k === 3 ? 2 : 1).map((s) => s.replace('timed: ', '')) },
      { id: 'orig', label: 'work()', sub: 'original', kind: 'service', x: 5.6, y: 1.7, status: k === 2 ? 'active' : 'normal' },
    ],
    links: [{ from: 'name', to: 'wrap' }, { from: 'wrap', to: 'orig' }],
    packets: [hop(place[0], place[1], ['call', 'fn(*args)', 'result'][k - 1], 0, k === 3 ? 'res' : 'req')],
    stats: [
      { label: 'Log lines', value: String(k) },
      { label: 'Last line', value: SINGLE[k - 1] },
      { label: 'Result', value: k === 3 ? '42' : '-', tone: k === 3 ? 'ok' : 'neutral' },
    ],
    note: [{ text: 'the call reaches the wrapper first, which runs its "before" code', tone: 'accent' as const }, { text: 'the wrapper then calls the original function', tone: 'accent' as const }, { text: 'back in the wrapper: the "after" code runs, then the result is returned', tone: 'ok' as const }][k - 1],
  };
};

const NODE_OF = ['a', 'b', 'f', 'b', 'a'];
const stack = (k: number): FlowState => {
  const active = NODE_OF[k - 1];
  const nodes: FlowNode[] = [
    { id: 'name', label: 'f', sub: 'name', kind: 'client', x: 0.1, y: 1.7, status: 'normal' },
    { id: 'a', label: 'a wrapper', sub: 'outermost', kind: 'gateway', x: 1.9, y: 1.7, status: active === 'a' ? 'active' : 'normal' },
    { id: 'b', label: 'b wrapper', sub: 'wraps f first', kind: 'worker', x: 3.7, y: 1.7, status: active === 'b' ? 'active' : 'normal' },
    { id: 'f', label: 'f()', sub: 'original', kind: 'service', x: 5.5, y: 1.7, status: active === 'f' ? 'active' : 'normal' },
  ];
  return {
    nodes,
    links: [{ from: 'name', to: 'a' }, { from: 'a', to: 'b' }, { from: 'b', to: 'f' }],
    packets: [],
    stats: [
      { label: 'Step', value: `${k} of ${STACK.length}` },
      { label: 'Now', value: STACK[k - 1], tone: 'ok' },
      { label: 'Same as', value: 'f = a(b(f))' },
    ],
    note: { text: ['a is the outermost wrapper, so its code runs first on the way in', 'b wraps f directly, so it runs next', 'only now does the original f run', 'b finishes first on the way out', 'a runs last on the way out: the order mirrors itself'][k - 1], tone: 'accent' },
  };
};

const names = (wraps: boolean): FlowState => ({
  nodes: [
    { id: 'name', label: 'work', sub: 'name', kind: 'client', x: 0.2, y: 1.7, status: 'active' },
    { id: 'fn', label: wraps ? 'wrapper (wraps)' : 'wrapper', sub: `__name__ = ${wraps ? withWraps : withoutWraps}`, kind: 'gateway', x: 3.4, y: 1.7, status: wraps ? 'active' : 'hot' },
  ],
  links: [{ from: 'name', to: 'fn' }],
  packets: [],
  stats: [
    { label: 'work.__name__', value: wraps ? withWraps : withoutWraps, tone: wraps ? 'ok' : 'bad' },
    { label: 'functools.wraps', value: wraps ? 'used' : 'missing', tone: wraps ? 'ok' : 'bad' },
    { label: 'Logs show', value: wraps ? 'work' : 'wrapper', tone: wraps ? 'ok' : 'bad' },
  ],
  note: wraps ? { text: 'wraps copies __name__, __doc__ and __wrapped__ onto the wrapper', tone: 'ok' } : { text: 'without wraps the function reports itself as "wrapper", which confuses logs and debuggers', tone: 'bad' },
});

export default defineLesson('flow', {
  slug: 'py-decorators',
  objectives: [
    { text: 'What @deco really does', step: 1 },
    { text: 'What happens on each call', step: 2 },
    { text: 'In what order stacked decorators run', step: 3 },
    { text: 'Why functools.wraps matters', step: 4 },
  ],
  steps: [
    {
      label: 'Rebinding',
      title: 'f = deco(f)',
      tag: 'problem',
      body: ['A decorator is a callable that takes a function and returns a replacement. `@timed` above `def work` is only syntax for `work = timed(work)`.', 'The name `work` now points at the wrapper.'],
      keyIdea: 'Nothing magic: a function call and a rebinding.',
      frames: [{ state: rebind(false), hold: 2400 }, { state: rebind(true), hold: 3800 }],
    },
    {
      label: 'A call',
      title: 'Wrapper, then original',
      tag: 'concept',
      body: ['Calling `work(21)` runs the wrapper first. It does its extra work, calls the original with the same arguments, and returns the result.', 'The wrapper keeps the original alive through a closure.'],
      keyIdea: 'Use `*args, **kwargs` so the wrapper fits any signature.',
      frames: [1, 2, 3].map((k) => ({ state: call(k), hold: k === 3 ? 3400 : 1900 })),
    },
    {
      label: 'Stacking',
      title: 'Inside out',
      tag: 'technique',
      body: ['`@a` over `@b` over `def f` means `f = a(b(f))`. `b` wraps first, `a` is the outermost wrapper.', 'On each call `a` runs first on the way in and last on the way out.'],
      keyIdea: 'Read decorators from the bottom up when you build, top down when you call.',
      frames: [1, 2, 3, 4, 5].map((k) => ({ state: stack(k), hold: k === 5 ? 3400 : 1500 })),
    },
    {
      label: 'wraps',
      title: 'Keep the identity',
      tag: 'in practice',
      body: ['Without `functools.wraps`, `work.__name__` becomes `"wrapper"`. That breaks logging, debugging and signature introspection.', '`@functools.wraps(fn)` copies the name, docstring and `__wrapped__`.'],
      keyIdea: 'Always put `@functools.wraps(fn)` on the inner wrapper.',
      frames: [{ state: names(false), hold: 3400 }, { state: names(true), hold: 3800 }],
    },
    {
      label: 'Recap',
      title: 'Decorators',
      tag: 'recap',
      body: [
        '- **@deco:** `f = deco(f)`.',
        '- **Wrapper:** closes over the original.',
        '- **Stacking:** `a(b(f))`, b wraps first.',
        '- **wraps:** keeps `__name__` and `__doc__`.',
        '- **With arguments:** a factory returns the real decorator.',
      ],
      keyIdea: 'Used by `@property`, `@lru_cache`, `@dataclass`, FastAPI routes and pytest fixtures.',
      frames: [{ state: rebind(true) }],
    },
  ],
});
