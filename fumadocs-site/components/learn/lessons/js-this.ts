import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Every result below is evaluated for real, so what each call site produces is JavaScript's answer, not ours.
 * Module code is strict, so a plain call gives this = undefined (a sloppy script would give window).
 */

type Named = { name?: string };
// The arrow captures the `this` of the function that creates it. Here that is undefined (module code is strict).
const makeArrow = function (this: Named | undefined) {
  return () => this?.name;
};
const obj = {
  name: 'JS',
  getName(this: Named | undefined) {
    return this?.name;
  },
  arrow: makeArrow.call(undefined),
};
const fn = obj.getName;
const detached = fn as unknown as () => unknown; // calling it plain, as a detached callback would
const other = { name: 'Ana' };
const bound = fn.bind({ name: 'Bo' });

const results = {
  method: obj.getName(),
  lost: detached(),
  call: fn.call(other),
  bound: bound(),
  boundCall: bound.call({ name: 'X' }),
  arrow: obj.arrow(),
};
const show = (v: unknown) => (v === undefined ? 'undefined' : JSON.stringify(v));

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };
function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

const ACTORS: SeqActor[] = [
  { id: 'c', label: 'Call site', kind: 'client' },
  { id: 'f', label: 'getName()', kind: 'service' },
  { id: 't', label: 'this', kind: 'cache' },
];
const stats = (rule: string, value: string): Stat[] => [{ label: 'Decided by', value: 'call site' }, { label: 'Rule', value: rule }, { label: 'name', value, tone: value === 'undefined' ? 'bad' : 'ok' }];

// Step 1: the same function gives different answers.
const problemFrames = reveal(ACTORS, [
  { msgs: [{ from: 'c', to: 'f', label: 'obj.getName()' }, { from: 'f', to: 'c', label: show(results.method), dashed: true, tone: 'ok' }], hold: 2200, stats: stats('method call', show(results.method)) },
  { msgs: [{ from: 'c', to: 'f', label: 'fn()  (same function)' }, { from: 'f', to: 'c', label: show(results.lost), dashed: true, tone: 'bad' }], hold: 3200, stats: stats('plain call', show(results.lost)), note: { text: 'same code, different answer: this is set at call time', tone: 'bad' } },
]);

// Step 2: method call, this is the object before the dot.
const methodFrames = reveal(ACTORS, [
  { msgs: [{ from: 'c', to: 'f', label: 'obj.getName()' }, { from: 'f', to: 't', label: 'this = obj', tone: 'ok' }, { from: 'f', to: 'c', label: `this.name = ${show(results.method)}`, dashed: true, tone: 'ok' }], hold: 3200, stats: stats('obj before dot', show(results.method)), note: { text: 'called as obj.method(): this is obj', tone: 'ok' } },
]);

// Step 3: lost context. Pull the method off the object and the object is gone.
const lostFrames = reveal(ACTORS, [
  { msgs: [{ from: 'c', to: 'c', label: 'const fn = obj.getName' }], hold: 1800, stats: stats('no call yet', '-'), note: { text: 'fn now holds just the function, not the object', tone: 'accent' } },
  { msgs: [{ from: 'c', to: 'f', label: 'fn()' }, { from: 'f', to: 't', label: 'this = undefined', tone: 'bad' }, { from: 'f', to: 'c', label: `this.name = ${show(results.lost)}`, dashed: true, tone: 'bad' }], hold: 3200, stats: stats('plain call', show(results.lost)), note: { text: 'plain call: window, or undefined in strict mode', tone: 'bad' } },
]);

// Step 4: call, apply and bind set this explicitly. A bound function keeps its this.
const bindFrames = reveal(ACTORS, [
  { msgs: [{ from: 'c', to: 'f', label: 'fn.call({name:"Ana"})' }, { from: 'f', to: 'c', label: `this.name = ${show(results.call)}`, dashed: true, tone: 'ok' }], hold: 2200, stats: stats('call / apply', show(results.call)), note: { text: 'call passes this explicitly and runs now', tone: 'ok' } },
  { msgs: [{ from: 'c', to: 'f', label: 'bound = fn.bind({Bo})' }, { from: 'c', to: 'f', label: 'bound()' }, { from: 'f', to: 'c', label: `this.name = ${show(results.bound)}`, dashed: true, tone: 'ok' }], hold: 2200, stats: stats('bind: a copy', show(results.bound)) },
  { msgs: [{ from: 'c', to: 'f', label: 'bound.call({X})' }, { from: 'f', to: 'c', label: `this.name = ${show(results.boundCall)}`, dashed: true, tone: 'ok' }], hold: 3200, stats: stats('bind wins', show(results.boundCall)), note: { text: 'a bound function ignores later call, its this is fixed', tone: 'ok' } },
]);

// Step 5: arrow functions have no this. They use the surrounding one.
const arrowFrames = reveal(ACTORS.map((a) => (a.id === 'f' ? { ...a, label: 'arrow()' } : a)), [
  { msgs: [{ from: 'c', to: 'f', label: 'obj.arrow()' }, { from: 'f', to: 't', label: 'no own this: lexical', tone: 'accent' }, { from: 'f', to: 'c', label: `this.name = ${show(results.arrow)}`, dashed: true, tone: 'bad' }], hold: 3400, stats: stats('arrow: lexical', show(results.arrow)), note: { text: 'obj.arrow() does not make obj the this of an arrow function', tone: 'bad' } },
]);

export default defineLesson('sequence', {
  slug: 'js-this',
  objectives: [
    { text: 'Why this depends on the call site', step: 1 },
    { text: 'What this is in a method call', step: 2 },
    { text: 'How a method loses its object', step: 3 },
    { text: 'How call, apply and bind set this', step: 4 },
    { text: 'Why arrow functions behave differently', step: 5 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'One function, two answers',
      tag: 'problem',
      body: ['`this` is not decided where a function is written. It is decided by **how the function is called**.', 'The same `getName` returns `"JS"` in one call and `undefined` in another.'],
      keyIdea: 'Ask "who called it, and how?", not "where is it defined?".',
      frames: problemFrames,
    },
    {
      label: 'Method call',
      title: 'The object before the dot',
      tag: 'concept',
      body: ['When called as `obj.method()`, `this` is `obj`. That is the case most code relies on.'],
      keyIdea: 'Precedence: arrow (lexical), then call, apply or bind, then method call, then plain call.',
      frames: methodFrames,
    },
    {
      label: 'Lost context',
      title: 'Detach it and this is gone',
      tag: 'trade-off',
      body: ['`const fn = obj.getName; fn()` is a plain call. `this` becomes `window`, or `undefined` in strict mode.', 'This is the classic bug when passing methods as callbacks.'],
      keyIdea: 'Fix it with `bind`, an arrow wrapper, or by calling `obj.getName()` directly.',
      frames: lostFrames,
    },
    {
      label: 'call, bind',
      title: 'Set this yourself',
      tag: 'technique',
      body: ['`call` and `apply` run the function now with the `this` you pass. `bind` returns a **new function** with `this` fixed.', 'A bound function keeps its `this` even if you `call` it with another.'],
      keyIdea: 'Use `call` and `apply` to borrow methods, `bind` to hand a method to something else.',
      frames: bindFrames,
    },
    {
      label: 'Arrows',
      title: 'No this of their own',
      tag: 'technique',
      body: ['Arrow functions take `this` from the **enclosing scope**, and `obj.arrow()` cannot change that.', 'They also have no `arguments` and cannot be constructors.'],
      keyIdea: 'Do not use an arrow function as an object method that needs `this`.',
      frames: arrowFrames,
    },
    {
      label: 'Recap',
      title: 'Finding this',
      tag: 'recap',
      body: [
        '- **Arrow:** lexical this from the surrounding scope.',
        '- **call, apply, bind:** the value you passed.',
        '- **obj.method():** this is obj.',
        '- **Plain call:** window, or undefined in strict mode.',
        '- **Callbacks:** detach a method and you lose this.',
      ],
      keyIdea: 'Walk the list top to bottom and stop at the first rule that matches the call.',
      frames: [bindFrames[bindFrames.length - 1]],
    },
  ],
});
