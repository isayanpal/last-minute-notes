import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the React Native notes on authentication flows and deep links: render different screens from auth state instead of
 * navigating imperatively, and queue a deep link that arrives before auth is ready. A real stack and a real link handler
 * compute what the back button can reach and what happens to the link.
 */

type Status = 'loading' | 'signedIn' | 'signedOut';
const screensFor = (s: Status): string[] => (s === 'loading' ? ['Splash'] : s === 'signedIn' ? ['App'] : ['SignIn', 'SignUp']);

// Imperative navigation: SignIn stays underneath App in the same stack.
const imperativeStack = ['SignIn'];
imperativeStack.push('App'); // navigate('App') after login
const canGoBackToSignIn = imperativeStack.length > 1 && imperativeStack[0] === 'SignIn';

// Conditional screens: after logout the private screen is simply not registered.
const afterLogout = screensFor('signedOut');
const backReachesPrivate = afterLogout.includes('App');

// Deep link handling.
const validId = (id: string) => /^\d+$/.test(id);
type LinkResult = { action: 'queued' | 'open' | 'rejected'; target: string };
const handleLink = (url: string, status: Status): LinkResult => {
  const m = /^myapp:\/\/post\/(.+)$/.exec(url);
  if (!m || !validId(m[1])) return { action: 'rejected', target: '-' };
  return status === 'signedIn' ? { action: 'open', target: `Post(${m[1]})` } : { action: 'queued', target: `Post(${m[1]})` };
};
const LINK = 'myapp://post/42';
const early = handleLink(LINK, 'loading');
const later = handleLink(LINK, 'signedIn');
const bad = handleLink('myapp://post/42;drop', 'signedIn');

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });

// Step 1: navigate() after login leaves SignIn reachable.
const imperative = (): FlowState => ({
  nodes: [
    { id: 'login', label: 'SignIn', sub: 'user logs in', kind: 'client', x: 0.2, y: 1.7, status: 'active' },
    { id: 'nav', label: 'navigate("App")', sub: 'imperative', kind: 'gateway', x: 2.9, y: 1.7, status: 'active' },
    { id: 'app', label: 'App', sub: 'on top of SignIn', kind: 'service', x: 5.6, y: 1.7, status: 'hot' },
  ],
  links: [{ from: 'login', to: 'nav' }, { from: 'nav', to: 'app' }],
  packets: [hop('login', 'nav', 'token saved?', 0, 'bad'), hop('nav', 'app', 'push', 0.6, 'bad')],
  stats: [
    { label: 'Stack', value: imperativeStack.join(' > ') },
    { label: 'Back reaches', value: canGoBackToSignIn ? 'SignIn' : '-', tone: canGoBackToSignIn ? 'bad' : 'ok' },
    { label: 'Race', value: 'token vs nav', tone: 'bad' },
  ],
  note: { text: 'the user can press back into the sign-in screen, and navigation can run before the token is saved', tone: 'bad' },
});

// Step 2: screens come from state.
const conditional = (s: Status): FlowState => {
  const screens = screensFor(s);
  const nodes: FlowNode[] = [
    { id: 'st', label: 'Auth status', sub: s, kind: 'gateway', x: 0.2, y: 1.7, status: 'active' },
    { id: 'nv', label: 'Navigator', sub: `${screens.length} screen${screens.length > 1 ? 's' : ''}`, kind: 'service', x: 2.9, y: 1.7, status: 'active', items: screens },
    { id: 'ui', label: 'Screen', sub: screens[0], kind: 'client', x: 5.6, y: 1.7, status: 'active' },
  ];
  return {
    nodes,
    links: [{ from: 'st', to: 'nv' }, { from: 'nv', to: 'ui' }],
    packets: [hop('st', 'nv', s, 0, 'req'), hop('nv', 'ui', screens[0], 0.6, 'ok')],
    stats: [
      { label: 'Status', value: s },
      { label: 'Registered', value: screens.join(', ').slice(0, 14) },
      { label: 'Race', value: 'none', tone: 'ok' },
    ],
    note: s === 'loading' ? { text: 'the token check runs first, so show a splash instead of flashing the sign-in screen', tone: 'accent' } : s === 'signedOut' ? { text: 'only the public screens are registered', tone: 'ok' } : { text: 'signed in: the private app is registered', tone: 'ok' },
  };
};

// Step 3: logging out removes the private screens.
const logout = (): FlowState => ({
  nodes: [
    { id: 'st', label: 'Auth status', sub: 'signedOut', kind: 'gateway', x: 0.2, y: 1.7, status: 'active' },
    { id: 'nv', label: 'Navigator', sub: 'public only', kind: 'service', x: 2.9, y: 1.7, status: 'active', items: afterLogout },
    { id: 'app', label: 'App', sub: 'no longer exists', kind: 'service', x: 5.6, y: 1.7, status: 'down' },
  ],
  links: [{ from: 'st', to: 'nv' }, { from: 'nv', to: 'app', dashed: true }],
  packets: [hop('st', 'nv', 'logout', 0, 'data')],
  stats: [
    { label: 'Private screens', value: backReachesPrivate ? '1' : '0', tone: backReachesPrivate ? 'bad' : 'ok' },
    { label: 'Back reaches', value: backReachesPrivate ? 'App' : 'nothing', tone: backReachesPrivate ? 'bad' : 'ok' },
    { label: 'Navigate call', value: 'not needed', tone: 'ok' },
  ],
  note: { text: 'after logout the user cannot go back into private screens, because they are not registered', tone: 'ok' },
});

// Step 4: a deep link that arrives early.
const link = (phase: 0 | 1 | 2): FlowState => {
  const r = phase === 0 ? early : phase === 1 ? later : bad;
  const status: Status = phase === 0 ? 'loading' : 'signedIn';
  return {
    nodes: [
      { id: 'u', label: phase === 2 ? 'post/42;drop' : 'post/42', sub: 'deep link', kind: 'client', x: 0.1, y: 1.7, status: 'active' },
      { id: 'cfg', label: 'Linking config', sub: 'path to screen', kind: 'gateway', x: 1.55, y: 1.7, status: 'active' },
      { id: 'gate', label: 'Auth gate', sub: status, kind: 'worker', x: 3.0, y: 1.7, status: phase === 0 ? 'hot' : 'active' },
      { id: 'q', label: 'Queue', sub: 'waits for sign-in', kind: 'queue', x: 4.45, y: 0.4, status: r.action === 'queued' ? 'active' : 'dim', items: r.action === 'queued' ? [r.target] : undefined },
      { id: 'scr', label: r.action === 'open' ? r.target : 'Screen', sub: r.action === 'rejected' ? 'rejected' : r.action === 'open' ? 'opened' : 'not yet', kind: 'service', x: 5.9, y: 1.7, status: r.action === 'open' ? 'active' : r.action === 'rejected' ? 'down' : 'dim' },
    ],
    links: [{ from: 'u', to: 'cfg' }, { from: 'cfg', to: 'gate' }, { from: 'gate', to: 'q', dashed: true }, { from: 'gate', to: 'scr' }],
    packets: [hop('u', 'cfg', 'open link', 0, 'req'), hop('cfg', 'gate', 'Post(42)', 0.5, 'req'), ...(r.action === 'queued' ? [hop('gate', 'q', 'hold', 1.0, 'data')] : r.action === 'open' ? [hop('gate', 'scr', 'open', 1.0, 'ok')] : [hop('gate', 'scr', 'invalid id', 1.0, 'bad')])],
    stats: [
      { label: 'Auth', value: status, tone: status === 'loading' ? 'bad' : 'ok' },
      { label: 'Link result', value: r.action, tone: r.action === 'open' ? 'ok' : r.action === 'queued' ? 'neutral' : 'bad' },
      { label: 'Target', value: r.target },
    ],
    note: phase === 0 ? { text: 'the link arrived before auth was ready: queue it instead of opening a private screen', tone: 'accent' } : phase === 1 ? { text: 'signed in: the queued link opens Post(42)', tone: 'ok' } : { text: 'link params are untrusted input: a non-numeric id is rejected', tone: 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'rn-auth-deeplink',
  objectives: [
    { text: 'Why navigating imperatively after login is fragile', step: 1 },
    { text: 'How screens follow auth state', step: 2 },
    { text: 'Why logout needs no navigate call', step: 3 },
    { text: 'How to handle a deep link that arrives early', step: 4 },
  ],
  steps: [
    {
      label: 'Imperative',
      title: 'navigate() after login',
      tag: 'problem',
      body: ['Pushing `App` after a successful login leaves `SignIn` underneath, so back returns to it.', 'It also races: navigation can run before the token is stored.'],
      keyIdea: 'Do not navigate imperatively after login.',
      frames: [{ state: imperative(), hold: 4200 }],
    },
    {
      label: 'By state',
      title: 'Render screens from auth status',
      tag: 'technique',
      body: ['Register different screens for each state: a splash while loading, sign-in screens when signed out, the app when signed in.', 'Keep the splash visible until the token check finishes.'],
      keyIdea: 'In Expo Router, `Stack.Protected` or a group redirect gives the same result.',
      frames: (['loading', 'signedOut', 'signedIn'] as Status[]).map((s) => ({ state: conditional(s), hold: 2800 })),
    },
    {
      label: 'Logout',
      title: 'Private screens vanish',
      tag: 'concept',
      body: ['When status becomes `signedOut`, the private screens are no longer registered.', 'There is nothing for the back button to reach, and no race between token and navigation.'],
      keyIdea: 'Authorisation of screens is just a conditional in the navigator.',
      frames: [{ state: logout(), hold: 4000 }],
    },
    {
      label: 'Deep links',
      title: 'A link before auth is ready',
      tag: 'in practice',
      body: ['A universal link can open the app before the token check ends. **Queue** it and open it after sign-in.', 'Treat link params as **untrusted**: validate ids, and never act on a link without confirmation.'],
      keyIdea: 'Cold start uses `getInitialURL`, a running app gets the `url` event.',
      frames: [0, 1, 2].map((p) => ({ state: link(p as 0 | 1 | 2), hold: 3800 })),
    },
    {
      label: 'Recap',
      title: 'Auth and links',
      tag: 'recap',
      body: [
        '- **Screens from state:** splash, public, private.',
        '- **No navigate after login:** the stack follows the state.',
        '- **Logout:** private screens disappear.',
        '- **Deep links:** queue until auth is ready.',
        '- **Params:** validate, never trust.',
      ],
      keyIdea: 'Let state decide what exists, not navigation calls.',
      frames: [{ state: link(1) }],
    },
  ],
});
