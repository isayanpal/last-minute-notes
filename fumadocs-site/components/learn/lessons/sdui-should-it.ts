import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the SDUI notes on what should and should not be server-driven. The notes' three questions are a real function: security, hardware or native SDK work
 * stays client-owned, gesture or GPU heavy interaction is native with server configuration, and reusable components that change often are server-driven.
 * Six screens run through it, so each verdict and the answers behind it are computed.
 */

type Screen = { name: string; sensitive: boolean; gesture: boolean; changesOften: boolean };
const S = (name: string, o: Partial<Screen>): Screen => ({ name, sensitive: false, gesture: false, changesOften: false, ...o });

function decide(s: Screen): { verdict: string; deciding: string } {
  if (s.sensitive) return { verdict: 'Client-owned', deciding: 'secure or SDK' };
  if (s.gesture) return { verdict: 'Native+config', deciding: 'gesture or GPU' };
  if (s.changesOften) return { verdict: 'Server-driven', deciding: 'changes often' };
  return { verdict: 'Client-owned', deciding: 'not worth it' };
}

const SCREENS: Screen[] = [
  S('Login', { sensitive: true }),
  S('Payment SDK', { sensitive: true }),
  S('3D editor', { gesture: true }),
  S('Home screen', { changesOften: true }),
  S('Brand store', { changesOften: true }),
  S('Rare settings', {}),
];
const RESULTS = SCREENS.map((s) => ({ s, ...decide(s) }));
const yn = (b: boolean) => (b ? 'yes' : 'no');

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });

const view = (i: number, note: FlowState['note']): FlowState => {
  const r = RESULTS[i];
  const good = r.verdict === 'Server-driven';
  return {
    nodes: [
      { id: 's', label: r.s.name, sub: 'the screen', kind: 'client', x: 0.1, y: 1.7, status: 'active' },
      { id: 'q', label: 'Three questions', sub: 'sec, gesture, change', kind: 'gateway', x: 2.9, y: 1.7, status: 'active', items: [`sec ${yn(r.s.sensitive)}`, `ges ${yn(r.s.gesture)}`, `chg ${yn(r.s.changesOften)}`] },
      { id: 'v', label: r.verdict, sub: r.deciding, kind: good ? 'service' : 'storage', x: 5.5, y: 1.7, status: good ? 'active' : 'hot' },
    ],
    links: [{ from: 's', to: 'q' }, { from: 'q', to: 'v' }],
    packets: [hop('s', 'q', 'ask', 0, 'req'), hop('q', 'v', r.verdict.slice(0, 12), 0.6, good ? 'ok' : 'data')],
    stats: [
      { label: 'Screen', value: r.s.name },
      { label: 'Deciding factor', value: r.deciding },
      { label: 'Verdict', value: r.verdict, tone: good ? 'ok' : 'neutral' },
    ],
    note,
  };
};

export default defineLesson('flow', {
  slug: 'sdui-should-it',
  objectives: [
    { text: 'Which question comes first', step: 1 },
    { text: 'What stays client-owned', step: 2 },
    { text: 'How gesture-heavy screens are split', step: 3 },
    { text: 'What a good SDUI fit looks like', step: 4 },
  ],
  steps: [
    {
      label: 'Questions',
      title: 'Ask three things in order',
      tag: 'problem',
      body: ['First: is it security-sensitive, hardware, or native SDK work? Then: is it gesture-heavy or GPU-heavy? Then: do reusable components change often?', 'The first yes decides.'],
      keyIdea: 'Safety first, then interaction, then change frequency.',
      frames: [{ state: view(3, { text: 'the home screen answers no, no, yes: server-driven', tone: 'ok' }), hold: 4200 }],
    },
    {
      label: 'Client-owned',
      title: 'Keep the sensitive parts native',
      tag: 'concept',
      body: ['Authentication internals, payment SDKs, biometrics, camera, Bluetooth, permissions and maps stay client-owned.', 'The server must not drive security-sensitive flows.'],
      keyIdea: 'Hardware and security belong to the client.',
      frames: [0, 1].map((i) => ({ state: view(i, { text: `${RESULTS[i].s.name}: ${RESULTS[i].deciding}, so ${RESULTS[i].verdict.toLowerCase()}`, tone: 'accent' }), hold: 3000 })),
    },
    {
      label: 'Gestures',
      title: 'Native plus configuration',
      tag: 'technique',
      body: ['A 3D or gesture-heavy editor driven by GPU state and device sensors is a poor fit.', 'The native implementation stays, and the server can still configure it.'],
      keyIdea: 'Split the screen: native behaviour, server settings.',
      frames: [{ state: view(2, { text: 'native implementation plus server-driven configuration', tone: 'accent' }), hold: 4200 }],
    },
    {
      label: 'Good fit',
      title: 'Reusable and changing',
      tag: 'in practice',
      body: ['Home screens, listings, promotions, onboarding and brand pages are many reusable components whose order and content change often.', 'A screen that rarely changes is not worth the platform cost.'],
      keyIdea: 'The ideal problem: frequent composition changes without a release.',
      frames: [3, 4, 5].map((i) => ({ state: view(i, { text: i === 5 ? 'it rarely changes: keep it client-owned, SDUI is not worth it here' : `${RESULTS[i].s.name}: reusable components that change often`, tone: i === 5 ? 'accent' : 'ok' }), hold: 3000 })),
    },
    {
      label: 'Recap',
      title: 'Server-driven or not',
      tag: 'recap',
      body: [
        '- **Sensitive or native SDK:** client-owned.',
        '- **Gesture or GPU heavy:** native plus config.',
        '- **Reusable and changing:** server-driven.',
        '- **Otherwise:** keep it client-owned.',
        '- **Rollout:** a hybrid shell, SDUI surfaces added one at a time.',
      ],
      keyIdea: 'Start with home page sections, not everything.',
      frames: [{ state: view(3, { text: 'a hybrid app: native shell, server-driven surfaces', tone: 'accent' }) }],
    },
  ],
});
