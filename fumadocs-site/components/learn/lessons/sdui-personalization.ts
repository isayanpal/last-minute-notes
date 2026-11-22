import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the SDUI notes on personalization and A/B testing: the server chooses which composition to return for a request, and cache keys must include the
 * segment, experiment and location or the cache fragments. A real hash assigns users to variants deterministically, and the cache keys are enumerated from
 * the real combinations (3 segments x 2 experiments x 4 locations is an EXAMPLE).
 */

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
};
const bucket = (user: string) => hash(user) % 100;
const variantOf = (user: string) => (bucket(user) < 50 ? 'A' : 'B');
const USERS = ['ana', 'bo', 'cy', 'dee'];
const REPEAT = [variantOf('ana'), variantOf('ana'), variantOf('ana')];
const STABLE = REPEAT.every((v) => v === REPEAT[0]);

const COMPOSITION = { A: ['Hero', 'Grid', 'Banner'], B: ['Hero', 'Carousel', 'Banner'] };

const SEGMENTS = ['free', 'plus', 'pro'];
const EXPERIMENTS = ['A', 'B'];
const LOCATIONS = ['IN', 'US', 'UK', 'DE'];
const KEYS: string[] = [];
for (const s of SEGMENTS) for (const e of EXPERIMENTS) for (const l of LOCATIONS) KEYS.push(`${s}-${e}-${l}`);

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.5 });

const assign = (user: string, note: FlowState['note']): FlowState => {
  const v = variantOf(user);
  const nodes: FlowNode[] = [
    { id: 'req', label: `user ${user}`, sub: 'request', kind: 'client', x: 0.1, y: 1.7, status: 'active' },
    { id: 'be', label: 'SDUI backend', sub: 'picks a variant', kind: 'gateway', x: 2.0, y: 1.7, status: 'active', items: [`hash ${bucket(user)}`] },
    { id: 'A', label: 'Variant A', sub: 'bucket under 50', kind: 'service', x: 4.0, y: 0.4, status: v === 'A' ? 'active' : 'dim', items: COMPOSITION.A.map((c) => c.slice(0, 9)) },
    { id: 'B', label: 'Variant B', sub: 'bucket 50 or more', kind: 'service', x: 4.0, y: 3.0, status: v === 'B' ? 'active' : 'dim', items: COMPOSITION.B.map((c) => c.slice(0, 9)) },
    { id: 'cl', label: 'Same renderer', sub: 'one client', kind: 'client', x: 5.8, y: 1.7, status: 'active' },
  ];
  return {
    nodes,
    links: [{ from: 'req', to: 'be' }, { from: 'be', to: 'A' }, { from: 'be', to: 'B' }, { from: 'A', to: 'cl' }, { from: 'B', to: 'cl' }],
    packets: [hop('req', 'be', 'GET home', 0, 'req'), hop('be', v, `variant ${v}`, 0.5, 'ok'), hop(v, 'cl', 'screen', 1.0, 'ok')],
    stats: [
      { label: 'User', value: user },
      { label: 'Bucket', value: `${bucket(user)} of 100` },
      { label: 'Variant', value: v, tone: 'ok' },
    ],
    note,
  };
};

const cache = (personalized: boolean): FlowState => {
  const n = personalized ? KEYS.length : 1;
  return {
    nodes: [
      { id: 'cli', label: 'Clients', sub: 'many users', kind: 'client', x: 0.2, y: 1.7, status: 'active' },
      { id: 'cdn', label: 'CDN cache', sub: personalized ? 'one entry per key' : 'one entry', kind: 'cdn', x: 3.0, y: 1.7, status: personalized ? 'hot' : 'active', items: personalized ? KEYS.slice(0, 4) : ['home'], meter: { value: Math.min(1, n / KEYS.length), label: `${n} keys`, tone: personalized ? 'bad' : 'info' } },
      { id: 'be', label: 'Backend', sub: 'builds the screen', kind: 'service', x: 5.6, y: 1.7, status: 'active' },
    ],
    links: [{ from: 'cli', to: 'cdn' }, { from: 'cdn', to: 'be', dashed: true }],
    packets: [hop('cli', 'cdn', 'GET home', 0, 'req')],
    stats: [
      { label: 'Cache keys', value: String(n), tone: personalized ? 'bad' : 'ok' },
      { label: 'Key made of', value: personalized ? 'seg, exp, loc' : 'the screen' },
      { label: 'Sharing', value: personalized ? 'fragmented' : 'high', tone: personalized ? 'bad' : 'ok' },
    ],
    note: personalized ? { text: `${SEGMENTS.length} segments x ${EXPERIMENTS.length} experiments x ${LOCATIONS.length} locations = ${KEYS.length} separate cache entries`, tone: 'bad' } : { text: 'a non-personalised screen can be cached aggressively at the CDN', tone: 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'sdui-personalization',
  objectives: [
    { text: 'How one mechanism gives A/B tests and personalisation', step: 1 },
    { text: 'How users are split into variants', step: 2 },
    { text: 'Why a user keeps the same variant', step: 3 },
    { text: 'How personalisation fragments caches', step: 4 },
  ],
  steps: [
    {
      label: 'Composition',
      title: 'The server picks the screen',
      tag: 'problem',
      body: ['Variant A sends Hero, Grid and Banner. Variant B sends Hero, Carousel and Banner. The client is the **same renderer** for both.', 'A/B testing and personalisation are the same mechanism: choose a composition for this request.'],
      keyIdea: 'No `if (user.interest ...)` branches scattered through the client.',
      frames: [{ state: assign('ana', { text: 'the backend chose a composition and the client rendered it', tone: 'accent' }), hold: 4200 }],
    },
    {
      label: 'Assignment',
      title: 'Hash the user id',
      tag: 'concept',
      body: ['A hash of the user id gives a bucket from 0 to 99. Buckets under 50 get variant A, the rest get B.', 'The split is roughly even and needs no stored state.'],
      keyIdea: 'Deterministic assignment keeps experiments clean.',
      frames: USERS.slice(0, 3).map((u) => ({ state: assign(u, { text: `${u} hashes to bucket ${bucket(u)}, so variant ${variantOf(u)}`, tone: 'ok' }), hold: 2400 })),
    },
    {
      label: 'Stable',
      title: 'Same user, same variant',
      tag: 'technique',
      body: ['Calling the assignment again with the same id gives the same variant every time.', 'A user does not flip between layouts from one launch to the next.'],
      keyIdea: 'Stable bucketing is what makes a test measurable.',
      frames: [{ state: assign('ana', { text: `three calls for ana gave ${REPEAT.join(', ')}: stable is ${STABLE}`, tone: 'ok' }), hold: 4200 }],
    },
    {
      label: 'Cache keys',
      title: 'One screen becomes many',
      tag: 'trade-off',
      body: ['A non-personalised screen is one cache entry. A personalised one needs the **segment, experiment and location** in the key.', 'Three segments, two experiments and four locations make 24 separate entries.'],
      keyIdea: 'Personalisation costs cache hit rate.',
      frames: [{ state: cache(false), hold: 3200 }, { state: cache(true), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Personalisation',
      tag: 'recap',
      body: [
        '- **Server picks** the composition per request.',
        '- **A/B:** a stable hash of the user id.',
        '- **Same client** renders every variant.',
        '- **Cache keys:** segment, experiment, location.',
        '- **Fragmentation:** more variants, fewer hits.',
      ],
      keyIdea: 'Keep the key as small as the personalisation allows.',
      frames: [{ state: cache(true) }],
    },
  ],
});
