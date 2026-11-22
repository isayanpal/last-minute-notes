import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the Next.js notes on Server Components, the RSC payload and hydration. The hydration counts are computed from a real
 * component list, and the mismatch is produced by rendering the same view at two different clock times.
 */

type Comp = { name: string; client: boolean };
const COMPS: Comp[] = [
  { name: 'Header', client: false },
  { name: 'ProductList', client: false },
  { name: 'Reviews', client: false },
  { name: 'Footer', client: false },
  { name: 'AddToCart', client: true },
];
const hydratedAllClient = COMPS.length;
const hydratedRsc = COMPS.filter((c) => c.client).length;

// The mismatch: a view that reads the clock renders differently on the server and in the browser.
const SERVER_NOW = Date.UTC(2026, 10, 22, 10, 15, 30);
const CLIENT_NOW = SERVER_NOW + 2000;
const clock = (now: number) => new Date(now).toISOString().slice(11, 19);
const unstableView = (now: number) => clock(now); // new Date() in render
const stableView = (iso: string) => clock(Date.parse(iso)); // derived from a prop both sides share
const serverHtml = unstableView(SERVER_NOW);
const clientFirst = unstableView(CLIENT_NOW);
const mismatch = serverHtml !== clientFirst;
const fixedServer = stableView(new Date(SERVER_NOW).toISOString());
const fixedClient = stableView(new Date(SERVER_NOW).toISOString());

const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });
const ACTORS: SeqState['actors'] = [
  { id: 'server', label: 'Server', kind: 'service' },
  { id: 'browser', label: 'Browser', kind: 'client' },
  { id: 'react', label: 'React', kind: 'worker' },
];

// Step 1: hydrating everything.
const everything = (): SeqState => ({
  actors: ACTORS,
  messages: [m('browser', 'server', 'GET /products'), m('server', 'browser', 'HTML plus JS for all 5', 'bad', true), m('browser', 'react', `hydrate ${hydratedAllClient} components`, 'bad')],
  stats: [
    { label: 'Components', value: String(COMPS.length) },
    { label: 'Hydrated', value: String(hydratedAllClient), tone: 'bad' },
    { label: 'JS shipped', value: 'all of them', tone: 'bad' },
  ],
  note: { text: 'if every component were a Client Component, every one ships JavaScript and hydrates', tone: 'bad' },
});

// Step 2: the RSC payload.
const PAYLOAD: SeqMessage[] = [
  m('browser', 'server', 'GET /products'),
  m('server', 'browser', 'HTML for first paint', 'res', true),
  m('server', 'browser', 'RSC payload, streamed', 'data', true),
];
const payload = (n: number): SeqState => ({
  actors: ACTORS,
  messages: PAYLOAD.slice(0, n),
  stats: [
    { label: 'Server comps', value: String(COMPS.filter((c) => !c.client).length), tone: 'ok' },
    { label: 'Their JS', value: 'none', tone: 'ok' },
    { label: 'Client comps', value: 'as references' },
  ],
  note: n >= 3 ? { text: 'the payload holds server output as resolved elements and client components as references', tone: 'ok' } : { text: 'the HTML shows instantly, the payload describes the React tree', tone: 'accent' },
});

// Step 3: hydrate only client components.
const HYDRATE: SeqMessage[] = [
  ...PAYLOAD,
  m('server', 'browser', 'JS for AddToCart only', 'data', true),
  m('browser', 'react', 'rebuild tree from payload'),
  m('react', 'browser', `hydrate ${hydratedRsc} component`, 'ok', true),
];
const hydrate = (n: number): SeqState => ({
  actors: ACTORS,
  messages: HYDRATE.slice(0, n),
  stats: [
    { label: 'Hydrated', value: n >= 6 ? `${hydratedRsc} of ${COMPS.length}` : '-', tone: n >= 6 ? 'ok' : 'neutral' },
    { label: 'Not hydrated', value: n >= 6 ? String(COMPS.length - hydratedRsc) : '-', tone: n >= 6 ? 'ok' : 'neutral' },
    { label: 'JS shipped', value: n >= 4 ? 'AddToCart' : '-', tone: n >= 4 ? 'ok' : 'neutral' },
  ],
  note: n >= 6 ? { text: 'only the Client Component hydrates: Server Components are plain HTML plus payload data', tone: 'ok' } : { text: 'React hydrates the client islands and leaves the rest alone', tone: 'accent' },
});

// Step 4: a hydration mismatch.
const MISMATCH: SeqMessage[] = [
  m('server', 'browser', `HTML shows ${serverHtml}`, 'res', true),
  m('browser', 'react', `first render: ${clientFirst}`, mismatch ? 'bad' : 'ok'),
  m('react', 'browser', mismatch ? 'mismatch: text differs' : 'texts match', mismatch ? 'bad' : 'ok', true),
];
const mismatchState = (n: number): SeqState => ({
  actors: ACTORS,
  messages: MISMATCH.slice(0, n),
  stats: [
    { label: 'Server HTML', value: serverHtml },
    { label: 'Client render', value: n >= 2 ? clientFirst : '-', tone: n >= 2 ? 'bad' : 'neutral' },
    { label: 'Match', value: n >= 3 ? (mismatch ? 'no' : 'yes') : '-', tone: n >= 3 ? 'bad' : 'neutral' },
  ],
  note: n >= 3 ? { text: 'new Date() in render ran at two different times, so server HTML and client render differ', tone: 'bad' } : { text: 'the clock is read during render on both sides', tone: 'accent' },
});
const FIXED: SeqMessage[] = [
  m('server', 'browser', `HTML shows ${fixedServer}`, 'res', true),
  m('browser', 'react', `first render: ${fixedClient}`, 'ok'),
  m('react', 'browser', fixedServer === fixedClient ? 'texts match' : 'mismatch', 'ok', true),
];
const fixedState = (): SeqState => ({
  actors: ACTORS,
  messages: FIXED,
  stats: [
    { label: 'Server HTML', value: fixedServer },
    { label: 'Client render', value: fixedClient, tone: 'ok' },
    { label: 'Match', value: fixedServer === fixedClient ? 'yes' : 'no', tone: 'ok' },
  ],
  note: { text: 'pass the time in as a prop, then update it in useEffect after mount', tone: 'ok' },
});

export default defineLesson('sequence', {
  slug: 'next-rsc-hydration',
  objectives: [
    { text: 'What hydrating every component would cost', step: 1 },
    { text: 'What the RSC payload carries', step: 2 },
    { text: 'Why only Client Components hydrate', step: 3 },
    { text: 'What causes a hydration mismatch and how to avoid it', step: 4 },
  ],
  steps: [
    {
      label: 'Cost',
      title: 'Hydrating everything',
      tag: 'problem',
      body: ['**Hydration** attaches handlers and state to server HTML so it becomes interactive.', 'If all five components were Client Components, all five would ship JavaScript and hydrate.'],
      keyIdea: 'Less client JavaScript means less hydration work, which helps Interaction to Next Paint.',
      frames: [{ state: everything(), hold: 4000 }],
    },
    {
      label: 'Payload',
      title: 'HTML plus the RSC payload',
      tag: 'concept',
      body: ['A Server Component runs only on the server and **never ships its JavaScript**.', 'The server streams HTML for first paint and an **RSC payload** that describes the tree.'],
      keyIdea: 'Server Components are not SSR: they never hydrate.',
      frames: [1, 2, 3].map((n) => ({ state: payload(n), hold: n === 3 ? 3600 : 1600 })),
    },
    {
      label: 'Hydrate',
      title: 'Only the islands wake up',
      tag: 'technique',
      body: ['The browser rebuilds the tree from the payload and hydrates only the Client Components.', 'Here one of five components hydrates, and only its JavaScript is sent.'],
      keyIdea: 'Hydration cost follows the number of Client Components, not the size of the page.',
      frames: [4, 5, 6].map((n) => ({ state: hydrate(n), hold: n === 6 ? 3800 : 1600 })),
    },
    {
      label: 'Mismatch',
      title: 'Server and client must agree',
      tag: 'trade-off',
      body: ['A **hydration mismatch** happens when the server HTML differs from the first client render.', '`new Date()`, `Math.random()`, or `window` checks in render are the usual causes.'],
      keyIdea: 'Compute on the server and pass it down, or set it in an effect after mount.',
      frames: [1, 2, 3].map((n) => ({ state: mismatchState(n), hold: n === 3 ? 3400 : 1600 })).concat([{ state: fixedState(), hold: 3800 }]),
    },
    {
      label: 'Recap',
      title: 'RSC and hydration',
      tag: 'recap',
      body: [
        '- **Server Components:** no JavaScript shipped, never hydrate.',
        '- **RSC payload:** server output plus client component references.',
        '- **Hydration:** only Client Components.',
        '- **Mismatch:** server HTML and first client render must match.',
        '- **Navigation:** only the payload for changed segments is fetched.',
      ],
      keyIdea: 'Push work to the server, and hydrate as little as possible.',
      frames: [{ state: hydrate(6) }],
    },
  ],
});
