import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Java notes on the String pool and the Integer cache: == compares references, equals compares content.
 * Identity results come from a small model of the pool and of Integer.valueOf, compared with real object identity.
 */

type Obj = { value: string | number };

const pool = new Map<string, Obj>();
const literal = (s: string): Obj => {
  if (!pool.has(s)) pool.set(s, { value: s });
  return pool.get(s)!;
};
const newString = (s: string): Obj => ({ value: s });
const intern = (o: Obj): Obj => literal(o.value as string);

const sa = literal('java');
const sb = literal('java');
const sc = newString('java');
const sd = intern(sc);

const cache = new Map<number, Obj>();
const valueOf = (n: number): Obj => {
  if (n < -128 || n > 127) return { value: n };
  if (!cache.has(n)) cache.set(n, { value: n });
  return cache.get(n)!;
};
const i1 = valueOf(127);
const i2 = valueOf(127);
const i3 = valueOf(128);
const i4 = valueOf(128);

const yes = (b: boolean) => (b ? 'true' : 'false');
const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

const refs = (labels: string[], status: FlowNode['status'] = 'normal'): FlowNode[] => labels.map((label, i) => ({ id: `r${i}`, label, kind: 'client', x: 0.2, y: 0.3 + i * 1.1, size: 'sm', status }));

// Step 1: same characters, different objects.
const compare = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'a', label: 'a', sub: '"java"', kind: 'client', x: 0.3, y: 0.6 },
    { id: 'c', label: 'c', sub: '"java"', kind: 'client', x: 0.3, y: 2.8 },
    { id: 'oa', label: 'object 1', sub: 'chars: java', kind: 'storage', x: 4.8, y: 0.6, items: ['java'] },
    { id: 'oc', label: 'object 2', sub: 'chars: java', kind: 'storage', x: 4.8, y: 2.8, items: ['java'] },
  ],
  links: [{ from: 'a', to: 'oa' }, { from: 'c', to: 'oc' }],
  packets: phase === 1 ? [hop('a', 'oa', 'a == c ?', 0, 'bad')] : [],
  stats: [
    { label: 'a == c', value: phase === 1 ? yes(sa === sc) : '-', tone: phase === 1 ? 'bad' : 'neutral' },
    { label: 'a.equals(c)', value: phase === 1 ? yes(sa.value === sc.value) : '-', tone: phase === 1 ? 'ok' : 'neutral' },
    { label: '== compares', value: 'references' },
  ],
  note: phase === 1 ? { text: 'same characters, two objects: == says false, equals says true', tone: 'bad' } : { text: 'two variables can hold equal text in separate objects', tone: 'accent' },
});

// Step 2: literals share a pooled object, new String makes another.
const poolState = (): FlowState => ({
  nodes: [
    ...refs(['a', 'b', 'c']),
    { id: 'pool', label: 'String pool', sub: 'shared literal', kind: 'cache', x: 4.8, y: 0.5, items: ['java'], status: 'active' },
    { id: 'heap', label: 'Heap object', sub: 'new String("java")', kind: 'storage', x: 4.8, y: 2.8, items: ['java'] },
  ],
  links: [{ from: 'r0', to: 'pool' }, { from: 'r1', to: 'pool' }, { from: 'r2', to: 'heap' }],
  packets: [hop('r0', 'pool', 'literal', 0, 'ok'), hop('r1', 'pool', 'literal', 0.2, 'ok'), hop('r2', 'heap', 'new String', 0.4, 'data')],
  stats: [
    { label: 'a == b', value: yes(sa === sb), tone: 'ok' },
    { label: 'a == c', value: yes(sa === sc), tone: 'bad' },
    { label: 'a.equals(c)', value: yes(sa.value === sc.value), tone: 'ok' },
  ],
  note: { text: 'literals are reused from the pool, new String always allocates', tone: 'accent' },
});

// Step 3: intern returns the pooled instance.
const internState = (phase: 0 | 1): FlowState => ({
  nodes: [
    ...refs(['a', 'c', 'd']),
    { id: 'pool', label: 'String pool', sub: 'shared literal', kind: 'cache', x: 4.8, y: 0.5, items: ['java'], status: 'active' },
    { id: 'heap', label: 'Heap object', sub: 'new String("java")', kind: 'storage', x: 4.8, y: 2.8, items: ['java'] },
  ],
  links: [{ from: 'r0', to: 'pool' }, { from: 'r1', to: 'heap' }, ...(phase === 1 ? [{ from: 'r2', to: 'pool' }] : [])],
  packets: phase === 1 ? [hop('heap', 'pool', 'c.intern()', 0, 'ok'), hop('pool', 'r2', 'pooled', 0.7, 'ok')] : [],
  stats: [
    { label: 'd = c.intern()', value: phase === 1 ? 'pooled' : '-' },
    { label: 'a == d', value: phase === 1 ? yes(sa === sd) : '-', tone: phase === 1 ? 'ok' : 'neutral' },
    { label: 'a == c', value: yes(sa === sc), tone: 'bad' },
  ],
  note: phase === 1 ? { text: 'intern() hands back the pooled instance, so d is the same object as a', tone: 'ok' } : { text: 'c lives on the heap, outside the pool', tone: 'accent' },
});

// Step 4: the Integer cache holds -128 to 127.
const cacheState = (phase: 0 | 1): FlowState => ({
  nodes: [
    ...refs(phase === 0 ? ['a = 127', 'b = 127'] : ['c = 128', 'd = 128']),
    ...(phase === 0
      ? ([{ id: 'cache', label: 'Integer cache', sub: '-128 to 127', kind: 'cache', x: 4.8, y: 0.6, items: ['127'], status: 'active' }] as FlowNode[])
      : ([
          { id: 'o1', label: 'Integer 128', sub: 'new object', kind: 'storage', x: 4.8, y: 0.3, items: ['128'] },
          { id: 'o2', label: 'Integer 128', sub: 'new object', kind: 'storage', x: 4.8, y: 1.5, items: ['128'] },
        ] as FlowNode[])),
  ],
  links: phase === 0 ? [{ from: 'r0', to: 'cache' }, { from: 'r1', to: 'cache' }] : [{ from: 'r0', to: 'o1' }, { from: 'r1', to: 'o2' }],
  packets: phase === 0 ? [hop('r0', 'cache', 'valueOf', 0, 'ok'), hop('r1', 'cache', 'valueOf', 0.2, 'ok')] : [hop('r0', 'o1', 'valueOf', 0, 'bad'), hop('r1', 'o2', 'valueOf', 0.2, 'bad')],
  stats: [
    { label: phase === 0 ? 'a == b' : 'c == d', value: phase === 0 ? yes(i1 === i2) : yes(i3 === i4), tone: phase === 0 ? 'ok' : 'bad' },
    { label: phase === 0 ? 'a.equals(b)' : 'c.equals(d)', value: 'true', tone: 'ok' },
    { label: 'Cached range', value: '-128 to 127' },
  ],
  note: phase === 0 ? { text: '127 is in the cache, so both variables share one Integer', tone: 'ok' } : { text: '128 is outside the cache, so autoboxing makes two objects', tone: 'bad' },
});

export default defineLesson('flow', {
  slug: 'java-string-boxing',
  objectives: [
    { text: 'What == compares on objects', step: 1 },
    { text: 'How the string pool shares literals', step: 2 },
    { text: 'What intern does', step: 3 },
    { text: 'Why Integer == works for 127 but not 128', step: 4 },
  ],
  steps: [
    {
      label: '== vs equals',
      title: 'Same text, different objects',
      tag: 'problem',
      body: ['`==` on objects compares **references**. `equals` compares content.', 'Two strings with identical characters can still be two objects.'],
      keyIdea: 'Compare strings and wrappers with `.equals()`, never `==`.',
      frames: [{ state: compare(0), hold: 2200 }, { state: compare(1), hold: 3400 }],
    },
    {
      label: 'String pool',
      title: 'Literals are shared',
      tag: 'concept',
      body: ['String literals live in the **string pool** and are reused. `new String("java")` always creates a new heap object.', 'The pool is only safe because strings are immutable.'],
      keyIdea: 'Immutability enables sharing, thread safety and a cached hashCode.',
      frames: [{ state: poolState(), hold: 3800 }],
    },
    {
      label: 'intern',
      title: 'Back into the pool',
      tag: 'technique',
      body: ['`c.intern()` returns the pooled instance for those characters.', 'That makes `==` true again, but `equals` is still the right comparison.'],
      keyIdea: 'You rarely need intern. Use equals and skip the question.',
      frames: [{ state: internState(0), hold: 2200 }, { state: internState(1), hold: 3400 }],
    },
    {
      label: 'Integer cache',
      title: 'The 127 and 128 trap',
      tag: 'trade-off',
      body: ['`Integer.valueOf` caches objects for **-128 to 127**. Two boxed 127s are the same object, two boxed 128s are not.', 'So `==` on wrappers is true for small values and false for larger ones.'],
      keyIdea: 'Always compare wrapper objects with `.equals()`.',
      frames: [{ state: cacheState(0), hold: 3000 }, { state: cacheState(1), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Identity versus equality',
      tag: 'recap',
      body: [
        '- **==:** compares references on objects.',
        '- **equals:** compares content.',
        '- **String pool:** shares literals, `new String` does not.',
        '- **intern:** returns the pooled instance.',
        '- **Integer cache:** -128 to 127 only.',
      ],
      keyIdea: 'If `==` on objects ever looks right, it is by accident of caching.',
      frames: [{ state: poolState() }],
    },
  ],
});
