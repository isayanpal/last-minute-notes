import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Every result is produced by evaluating the real operators, so the booleans and strings on screen are JavaScript's own answers.
 * The helpers take unknown so TypeScript does not reject comparisons that JavaScript happily coerces.
 */

const loose = (a: unknown, b: unknown) => a == b; // eslint-disable-line eqeqeq
const strict = (a: unknown, b: unknown) => a === b;
const plus = (a: unknown, b: unknown) => (a as number) + (b as number);
const minus = (a: unknown, b: unknown) => (a as number) - (b as number);
const not = (v: unknown) => !v;
const show = (v: unknown) => (typeof v === 'string' ? `"${v}"` : String(v));

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };
function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

const A: SeqActor[] = [
  { id: 'e', label: 'Expression', kind: 'client' },
  { id: 'j', label: 'JS engine', kind: 'service' },
];
const msg = (label: string, result: unknown, tone: 'ok' | 'bad' | 'accent' = 'accent'): SeqMessage[] => [
  { from: 'e', to: 'j', label },
  { from: 'j', to: 'e', label: show(result), dashed: true, tone },
];

// Step 1: implicit coercion changes types behind your back.
const coerce = (): Frame<SeqState>[] =>
  reveal(A, [
    { msgs: msg('"5" + 1', plus('5', 1)), hold: 2000, stats: [{ label: '+ with a string', value: 'concatenates' }, { label: '- with a string', value: 'to number' }, { label: 'Same inputs', value: 'type differs', tone: 'bad' }] },
    { msgs: msg('"5" - 1', minus('5', 1), 'ok'), hold: 3200, stats: [{ label: '+ with a string', value: 'concatenates' }, { label: '- with a string', value: 'to number' }, { label: 'Same inputs', value: 'type differs', tone: 'bad' }], note: { text: '+ prefers strings, - always works on numbers', tone: 'accent' } },
  ]);

// Step 2: == coerces, === does not.
const equality = (): Frame<SeqState>[] =>
  reveal(A, [
    { msgs: msg('5 == "5"', loose(5, '5'), 'bad'), hold: 1900, stats: [{ label: '==', value: 'coerces types' }, { label: '===', value: 'compares as is', tone: 'ok' }, { label: 'Prefer', value: '===', tone: 'ok' }] },
    { msgs: msg('5 === "5"', strict(5, '5'), 'ok'), hold: 1900, stats: [{ label: '==', value: 'coerces types' }, { label: '===', value: 'compares as is', tone: 'ok' }, { label: 'Prefer', value: '===', tone: 'ok' }] },
    { msgs: msg('null == undefined', loose(null, undefined), 'accent'), hold: 3200, stats: [{ label: '==', value: 'coerces types' }, { label: '===', value: 'compares as is', tone: 'ok' }, { label: 'Prefer', value: '===', tone: 'ok' }], note: { text: 'the only place most teams still allow == is a null check', tone: 'accent' } },
  ]);

// Step 3: [] == ![] is true. Each step is one coercion, each result computed.
const steps = {
  not: not([]),
  asBool: loose([], false),
  empty: String([]),
  num: Number(''),
  zero: loose(0, 0),
  final: loose([], not([])),
};
const chain = (): Frame<SeqState>[] =>
  reveal(A, [
    { msgs: msg('![]', steps.not), hold: 1700, stats: [{ label: 'Expression', value: '[] == ![]' }, { label: 'Final answer', value: String(steps.final), tone: 'bad' }, { label: 'Rule', value: 'step by step' }], note: { text: 'an array is truthy, so negating it gives false', tone: 'accent' } },
    { msgs: msg('[] == false', steps.asBool), hold: 1700, stats: [{ label: 'Expression', value: '[] == false' }, { label: 'Final answer', value: String(steps.final), tone: 'bad' }, { label: 'Rule', value: 'bool to number' }] },
    { msgs: msg('String([])', steps.empty), hold: 1700, stats: [{ label: 'Object', value: 'to primitive' }, { label: 'Final answer', value: String(steps.final), tone: 'bad' }, { label: 'Rule', value: 'empty gives ""' }] },
    { msgs: msg('Number("")', steps.num), hold: 1700, stats: [{ label: 'Both sides', value: 'become numbers' }, { label: 'Final answer', value: String(steps.final), tone: 'bad' }, { label: 'Then', value: '0 == 0' }] },
    { msgs: msg('[] == ![]', steps.final, 'bad'), hold: 3400, stats: [{ label: 'Expression', value: '[] == ![]' }, { label: 'Final answer', value: String(steps.final), tone: 'bad' }, { label: 'Lesson', value: 'avoid ==' }], note: { text: 'every step is legal, the result is still surprising', tone: 'bad' } },
  ]);

// Step 4: falsy values. Everything else is truthy, including [] and {}.
const VALUES: [string, unknown][] = [['0', 0], ['""', ''], ['null', null], ['undefined', undefined], ['NaN', NaN], ['[]', []], ['{}', {}], ['"0"', '0']];
const truthy = (): Frame<SeqState>[] => {
  const half = (list: [string, unknown][]): Beat => ({
    msgs: list.flatMap(([label, v]) => msg(`Boolean(${label})`, Boolean(v), Boolean(v) ? 'ok' : 'bad')),
    hold: 3600,
    stats: [{ label: 'Falsy values', value: '6 of them' }, { label: 'Everything else', value: 'truthy', tone: 'ok' }, { label: 'Surprise', value: '[] and "0"' }],
    note: { text: 'falsy: false, 0, "", null, undefined, NaN', tone: 'accent' },
  });
  return [reveal(A, [half(VALUES.slice(0, 4))])[0], reveal(A, [half(VALUES.slice(4))])[0]];
};

export default defineLesson('sequence', {
  slug: 'js-coercion',
  objectives: [
    { text: 'How + and - treat strings differently', step: 1 },
    { text: 'The difference between == and ===', step: 2 },
    { text: 'Why [] == ![] is true, one coercion at a time', step: 3 },
    { text: 'Which values are falsy', step: 4 },
  ],
  steps: [
    {
      label: 'Coercion',
      title: 'Types change behind your back',
      tag: 'problem',
      body: ['JavaScript converts values between types automatically. `"5" + 1` becomes the string `"51"`, but `"5" - 1` becomes the number `4`.', 'The engine applies a fixed set of rules, but they are easy to forget.'],
      keyIdea: '`+` concatenates when either side is a string. `-` always means numeric subtraction.',
      frames: coerce(),
    },
    {
      label: '== vs ===',
      title: 'Loose and strict equality',
      tag: 'concept',
      body: ['`==` coerces both sides to a common type first. `===` compares type and value with no conversion.', 'So `5 == "5"` is true and `5 === "5"` is false.'],
      keyIdea: 'Always prefer `===`.',
      frames: equality(),
    },
    {
      label: 'The oddity',
      title: '[] == ![] is true',
      tag: 'technique',
      body: ['`![]` is `false`, so the comparison becomes `[] == false`. Both sides turn into numbers: `""` becomes `0`, `false` becomes `0`.', 'Then `0 == 0` is true.'],
      keyIdea: 'Each step follows the rules, which is exactly why the end result looks absurd.',
      frames: chain(),
    },
    {
      label: 'Falsy',
      title: 'Six falsy values',
      tag: 'concept',
      body: ['Falsy values are `false`, `0`, `""`, `null`, `undefined` and `NaN`. Everything else is truthy.', 'That includes `[]`, `{}` and the string `"0"`.'],
      keyIdea: 'Check for emptiness explicitly (`arr.length`) instead of relying on truthiness of arrays.',
      frames: truthy(),
    },
    {
      label: 'Recap',
      title: 'Coercion rules of thumb',
      tag: 'recap',
      body: [
        '- **`+`:** string wins and concatenates. **`-`:** numbers only.',
        '- **`==`:** coerces. **`===`:** does not. Use `===`.',
        '- **`[] == ![]`:** a chain of legal coercions ending in true.',
        '- **Falsy:** `false`, `0`, `""`, `null`, `undefined`, `NaN`.',
        '- **Not falsy:** `[]`, `{}`, `"0"`.',
      ],
      keyIdea: 'When output surprises you, write out each coercion step by step.',
      frames: [chain()[4]],
    },
  ],
});
