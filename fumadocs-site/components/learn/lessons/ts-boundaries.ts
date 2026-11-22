import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the TypeScript notes: be strict at boundaries, flexible inside. The unknown JSON goes through a type guard,
 * and a mapper converts the API shape once. The guard verdicts and the date conversion are computed by running real code.
 */

type User = { id: string; name: string; createdAt: Date };
type ApiUser = { id: string; name: string; created_at: string };

const isApiUser = (v: unknown): v is ApiUser => {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.name === 'string' && typeof o.created_at === 'string';
};
const mapUser = (api: ApiUser): User => ({ id: api.id, name: api.name, createdAt: new Date(api.created_at) });

const GOOD: unknown = { id: 'u1', name: 'Ana', created_at: '2024-01-02' };
const BAD: unknown = { id: 7, name: 'Ana' };
const goodOk = isApiUser(GOOD);
const badOk = isApiUser(BAD);
const mapped = goodOk ? mapUser(GOOD as ApiUser) : null;
const isDate = mapped ? mapped.createdAt instanceof Date : false;

const ACTORS: SeqState['actors'] = [
  { id: 'api', label: 'API', kind: 'external' },
  { id: 'guard', label: 'Boundary', kind: 'gateway' },
  { id: 'app', label: 'App code', kind: 'client' },
];

const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });

// Step 1: trusting res.json() as any.
const TRUST: SeqMessage[] = [
  m('app', 'api', 'GET /user/7'),
  m('api', 'app', 'JSON: id is a number', 'bad', true),
];
const trustState = (n: number): SeqState => ({
  actors: ACTORS.map((a) => (a.id === 'guard' ? { ...a, status: 'dim' as const } : a)),
  messages: TRUST.slice(0, n),
  stats: [
    { label: 'res.json()', value: 'any' },
    { label: 'Checked', value: n >= 2 ? 'nothing' : '-', tone: n >= 2 ? 'bad' : 'neutral' },
    { label: 'user.id', value: n >= 2 ? 'a number' : '-', tone: n >= 2 ? 'bad' : 'neutral' },
  ],
  note: n >= 2 ? { text: 'the type says string, the data says number: the lie spreads everywhere', tone: 'bad' } : { text: 'a network response is data from outside your program', tone: 'accent' },
});

// Step 2: the response enters as unknown and a type guard checks it.
const GUARD: SeqMessage[] = [
  m('app', 'api', 'GET /user/u1'),
  m('api', 'guard', 'JSON as unknown', 'data', true),
  m('guard', 'app', goodOk ? 'isApiUser: true' : 'isApiUser: false', goodOk ? 'ok' : 'bad', true),
];
const guardState = (n: number): SeqState => ({
  actors: ACTORS,
  messages: GUARD.slice(0, n),
  stats: [
    { label: 'Enters as', value: 'unknown' },
    { label: 'Guard says', value: n >= 3 ? (goodOk ? 'valid' : 'invalid') : '-', tone: n >= 3 ? 'ok' : 'neutral' },
    { label: 'Leaves as', value: n >= 3 ? 'ApiUser' : '-', tone: n >= 3 ? 'ok' : 'neutral' },
  ],
  note: n >= 3 ? { text: 'the guard proved the shape once, at the edge', tone: 'ok' } : { text: 'unknown cannot be used until a check narrows it', tone: 'accent' },
});

// Step 3: a payload that fails the guard never enters the app as a User.
const REJECT: SeqMessage[] = [
  m('app', 'api', 'GET /user/7'),
  m('api', 'guard', 'JSON as unknown', 'data', true),
  m('guard', 'app', badOk ? 'isApiUser: true' : 'isApiUser: false', badOk ? 'ok' : 'bad', true),
];
const rejectState = (n: number): SeqState => ({
  actors: ACTORS,
  messages: REJECT.slice(0, n),
  stats: [
    { label: 'Payload', value: 'id is a number' },
    { label: 'Guard says', value: n >= 3 ? (badOk ? 'valid' : 'invalid') : '-', tone: n >= 3 ? 'bad' : 'neutral' },
    { label: 'App receives', value: n >= 3 ? 'an error' : '-', tone: n >= 3 ? 'ok' : 'neutral' },
  ],
  note: n >= 3 ? { text: 'the bad shape is stopped here and becomes a handled error', tone: 'ok' } : { text: 'same call, but the server sent an id the wrong type', tone: 'accent' },
});

// Step 4: convert the API shape to the domain shape once.
const CONVERT: SeqMessage[] = [
  m('api', 'guard', 'created_at: a string', 'data', true),
  m('guard', 'app', isDate ? 'createdAt: a Date' : 'createdAt: a string', 'ok', true),
];
const convertState = (n: number): SeqState => ({
  actors: ACTORS,
  messages: CONVERT.slice(0, n),
  stats: [
    { label: 'API shape', value: 'ApiUser' },
    { label: 'created_at', value: n >= 2 ? 'Date' : 'string', tone: n >= 2 ? 'ok' : 'neutral' },
    { label: 'App sees', value: n >= 2 ? 'User only' : '-', tone: n >= 2 ? 'ok' : 'neutral' },
  ],
  note: n >= 2 ? { text: 'convert once: no component ever parses a date string again', tone: 'ok' } : { text: 'strict at the boundary means the conversion happens in one place', tone: 'accent' },
});

export default defineLesson('sequence', {
  slug: 'ts-boundaries',
  objectives: [
    { text: 'Why a cast on API data is a lie the compiler believes', step: 1 },
    { text: 'How unknown plus a type guard validates data at the edge', step: 2 },
    { text: 'What happens to a payload that fails the check', step: 3 },
    { text: 'Why you convert the API shape once, at the boundary', step: 4 },
  ],
  steps: [
    {
      label: 'Trust',
      title: 'A cast is not a check',
      tag: 'problem',
      body: ['`response.json()` returns `any`. Casting it to `User` tells the compiler to believe you, but nothing verifies the data.', 'When the server sends a number for `id`, the type is wrong everywhere it travels.'],
      keyIdea: 'Types describe what you expect. Only a runtime check proves what arrived.',
      frames: [{ state: trustState(1), hold: 1600 }, { state: trustState(2), hold: 3000 }],
    },
    {
      label: 'Guard',
      title: 'Validate at the edge',
      tag: 'concept',
      body: ['Treat the response as `unknown` and pass it through a **type guard**. The guard returns `value is ApiUser`.', 'Only data that passes enters the app typed.'],
      keyIdea: 'Be strict at boundaries, flexible internally.',
      frames: [{ state: guardState(1), hold: 1600 }, { state: guardState(2), hold: 1800 }, { state: guardState(3), hold: 3000 }],
    },
    {
      label: 'Reject',
      title: 'Bad data stops at the door',
      tag: 'technique',
      body: ['If `id` arrives as a number, the guard returns `false` and the caller handles an error.', 'The fault shows up where the data enters, not three components later.'],
      keyIdea: 'Boundaries are API responses, props, hook returns, store slices and form schemas.',
      frames: [{ state: rejectState(1), hold: 1600 }, { state: rejectState(2), hold: 1800 }, { state: rejectState(3), hold: 3200 }],
    },
    {
      label: 'Convert',
      title: 'Convert once',
      tag: 'in practice',
      body: ['The API sends `created_at` as a string. `mapUser` turns it into a `Date` in one place.', 'Components, hooks and the store then see only `User`.'],
      keyIdea: 'A central conversion prevents date bugs everywhere else and keeps UI code clean.',
      frames: [{ state: convertState(1), hold: 1800 }, { state: convertState(2), hold: 3200 }],
    },
    {
      label: 'Recap',
      title: 'Types at boundaries',
      tag: 'recap',
      body: [
        '- **Cast:** tells the compiler to trust, verifies nothing.',
        '- **unknown + guard:** proves the shape at runtime.',
        '- **Failure:** handled where the data enters.',
        '- **Mapper:** converts the API shape to the domain shape once.',
        '- **Inside:** components only ever see the clean type.',
      ],
      keyIdea: 'Spend the strictness at the edges and let inference handle the middle.',
      frames: [{ state: guardState(3) }],
    },
  ],
});
