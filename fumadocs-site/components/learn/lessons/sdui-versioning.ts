import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the SDUI notes on versioning and fallback. A real server function picks, for each client, the schema version and the component versions
 * that client declared it supports, and a real decision function applies the notes' unknown-component rules (render it, render the server fallback,
 * require an update for critical ones, otherwise ignore). Every response and verdict is computed.
 */

type Client = { name: string; schema: number; banner: number; knows: string[] };
const OLD: Client = { name: 'App 2.1', schema: 2, banner: 1, knows: ['hero', 'banner', 'text'] };
const NEW: Client = { name: 'App 3.0', schema: 3, banner: 2, knows: ['hero', 'banner', 'text', 'new_component'] };

/** The server never guesses: it sends a payload version-appropriate for what the client declared. */
const respond = (c: Client) => ({ schema: c.schema, bannerComponent: `banner:v${c.banner}`, extra: c.schema >= 3 ? 'new_component' : 'text (fallback)' });
const R_OLD = respond(OLD);
const R_NEW = respond(NEW);

type Case = { label: string; registered: boolean; fallback: boolean; critical: boolean };
const decide = (c: Case): string => (c.registered ? 'render it' : c.fallback ? 'fallback' : c.critical ? 'ask to update' : 'ignore it');
const CASES: Case[] = [
  { label: 'known type', registered: true, fallback: false, critical: false },
  { label: 'with fallback', registered: false, fallback: true, critical: false },
  { label: 'critical', registered: false, fallback: false, critical: true },
  { label: 'optional', registered: false, fallback: false, critical: false },
];

const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });
const ACTORS: SeqState['actors'] = [{ id: 'app', label: 'Client app', kind: 'client' }, { id: 'api', label: 'SDUI server', kind: 'service' }];

const negotiation = (c: Client, r: ReturnType<typeof respond>, n: number, custom?: string): SeqState => ({
  actors: ACTORS,
  messages: [m('app', 'api', `GET home, SDUI-Version: ${c.schema}`, 'req'), m('api', 'app', `schema v${r.schema}, ${r.bannerComponent}`, 'ok', true)].slice(0, n),
  stats: [
    { label: 'Client', value: c.name },
    { label: 'Declares', value: `schema ${c.schema}` },
    { label: 'Receives', value: n >= 2 ? r.bannerComponent : '-', tone: n >= 2 ? 'ok' : 'neutral' },
  ],
  note: n >= 2 ? { text: custom ?? `the server sent ${r.bannerComponent} to ${c.name}, a payload it can render`, tone: 'ok' } : { text: 'the client says which schema version it supports', tone: 'accent' },
});

const unknown = (i: number): SeqState => {
  const c = CASES[i];
  const verdict = decide(c);
  return {
    actors: ACTORS,
    messages: [m('api', 'app', c.registered ? 'banner' : c.fallback ? 'new_component + fallback' : 'new_component', c.registered ? 'ok' : 'data', true)],
    stats: [
      { label: 'Case', value: c.label },
      { label: 'Registered', value: String(c.registered), tone: c.registered ? 'ok' : 'bad' },
      { label: 'Client does', value: verdict, tone: verdict === 'ask to update' ? 'bad' : 'ok' },
    ],
    note: { text: [`the type is registered: ${verdict}`, 'the server shipped a fallback: it renders instead', 'a critical component with no fallback: prompt the user to update', 'a non-critical unknown component is simply not rendered'][i], tone: verdict === 'ask to update' ? 'bad' : 'ok' },
  };
};

export default defineLesson('sequence', {
  slug: 'sdui-versioning',
  objectives: [
    { text: 'Why old app versions stay in the wild', step: 1 },
    { text: 'How a component evolves from banner:v1 to v2', step: 2 },
    { text: 'How the client declares the schema it supports', step: 3 },
    { text: 'What happens to an unknown component', step: 4 },
  ],
  steps: [
    {
      label: 'Old clients',
      title: 'Binaries live for a long time',
      tag: 'problem',
      body: ['Installed apps stay out there for months. A payload that only the newest client understands would break everyone else.', 'The contract needs **two layers** of versioning.'],
      keyIdea: 'The server cannot assume every client is current.',
      frames: [{ state: negotiation(OLD, R_OLD, 2), hold: 3000 }, { state: negotiation(NEW, R_NEW, 2), hold: 3400 }],
    },
    {
      label: 'Components',
      title: 'banner:v1 and banner:v2',
      tag: 'concept',
      body: ['When `banner` gains new props, ship it as `banner:v2` and keep `banner:v1` registered.', 'Old clients keep rendering `v1`, new ones get `v2`.'],
      keyIdea: 'Add a version, never change one in place.',
      frames: [{ state: negotiation(OLD, R_OLD, 2, 'banner:v1 stays registered, so App 2.1 keeps rendering it'), hold: 3400 }, { state: negotiation(NEW, R_NEW, 2, 'banner:v2 adds the new props and goes to App 3.0'), hold: 3400 }],
    },
    {
      label: 'Negotiation',
      title: 'The client states its version',
      tag: 'technique',
      body: ['The whole response is versioned too. The client sends `X-SDUI-Version: 3` and the server picks a payload that client can render.', 'The server never has to guess.'],
      keyIdea: 'Schema negotiation: the client declares, the server adapts.',
      frames: [1, 2].map((n) => ({ state: negotiation(NEW, R_NEW, n), hold: n === 2 ? 3400 : 1800 })),
    },
    {
      label: 'Unknown',
      title: 'Decide on purpose',
      tag: 'trade-off',
      body: ['If the client does not recognise a type it can **render a server-supplied fallback**, **ignore** it, or **require an update** for critical components.', 'Production systems must never crash on an unknown type.'],
      keyIdea: 'Decide per component, up front.',
      frames: [0, 1, 2, 3].map((i) => ({ state: unknown(i), hold: 2800 })),
    },
    {
      label: 'Recap',
      title: 'Versioning and fallback',
      tag: 'recap',
      body: [
        '- **Component versions:** `banner:v1`, `banner:v2` side by side.',
        '- **Schema version:** declared by the client.',
        '- **Unknown type:** fallback, ignore, or require update.',
        '- **Testing:** app version x schema version matrix.',
        '- **Rule:** the server only asks for what is installed.',
      ],
      keyIdea: 'Every SDUI contract decision follows from old clients still being out there.',
      frames: [{ state: unknown(1) }],
    },
  ],
});
