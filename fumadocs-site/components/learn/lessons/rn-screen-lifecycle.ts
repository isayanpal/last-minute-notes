import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the React Native notes on mobile navigation and screen lifecycle: stack screens stay mounted under the new one,
 * so effects do not re-run on return, and focus events are the signal for "visible again". A real stack simulator
 * produces every mount, focus, blur and unmount event shown.
 */

type Ev = 'mount' | 'focus' | 'blur' | 'unmount';
class Nav {
  stack: string[] = [];
  log: Record<string, Ev[]> = {};
  private ev(s: string, e: Ev) {
    (this.log[s] ??= []).push(e);
  }
  push(name: string) {
    const top = this.stack[this.stack.length - 1];
    if (top) this.ev(top, 'blur'); // the previous screen stays mounted
    this.stack.push(name);
    this.ev(name, 'mount');
    this.ev(name, 'focus');
  }
  pop() {
    const gone = this.stack.pop()!;
    this.ev(gone, 'blur');
    this.ev(gone, 'unmount');
    const top = this.stack[this.stack.length - 1];
    if (top) this.ev(top, 'focus'); // no mount: it was never unmounted
  }
  snapshot() {
    return { stack: [...this.stack], log: Object.fromEntries(Object.entries(this.log).map(([k, v]) => [k, [...v]])) as Record<string, Ev[]> };
  }
}

const nav = new Nav();
nav.push('Feed');
const s1 = nav.snapshot();
nav.push('Post');
const s2 = nav.snapshot();
nav.pop();
const s3 = nav.snapshot();

type Snap = ReturnType<Nav['snapshot']>;
const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.5 });
const SCREENS = ['Feed', 'Post'];
const X: Record<string, number> = { Feed: 0.4, Post: 4.8 };

const view = (s: Snap, note: FlowState['note'], extra?: { refetchOn?: string }): FlowState => {
  const nodes: FlowNode[] = SCREENS.map((name) => {
    const mounted = s.stack.includes(name);
    const focused = s.stack[s.stack.length - 1] === name;
    const evs = (s.log[name] ?? []).slice(-4);
    return { id: name, label: name, sub: !mounted ? 'not in stack' : focused ? 'focused' : 'mounted, hidden', kind: 'service', x: X[name], y: 1.7, status: !mounted ? 'dim' : focused ? 'active' : 'normal', items: evs };
  });
  const mountsOfFeed = (s.log.Feed ?? []).filter((e) => e === 'mount').length;
  const focusOfFeed = (s.log.Feed ?? []).filter((e) => e === 'focus').length;
  return {
    nodes,
    links: [{ from: 'Feed', to: 'Post', dashed: !s.stack.includes('Post') }],
    packets: s.stack.length === 2 ? [hop('Feed', 'Post', 'push', 0, 'req')] : s === s3 ? [hop('Post', 'Feed', 'pop', 0, 'data')] : [],
    stats: [
      { label: 'Feed mounts', value: String(mountsOfFeed), tone: 'ok' },
      { label: 'Feed focuses', value: String(focusOfFeed), tone: focusOfFeed > mountsOfFeed ? 'ok' : 'neutral' },
      { label: 'Stack', value: s.stack.join(' > ') || '-' },
    ],
    note: extra?.refetchOn ? { text: extra.refetchOn, tone: 'ok' } : note,
  };
};

export default defineLesson('flow', {
  slug: 'rn-screen-lifecycle',
  objectives: [
    { text: 'How mobile navigation differs from the web', step: 1 },
    { text: 'What happens to the screen below a pushed screen', step: 2 },
    { text: 'Why effects do not re-run when you come back', step: 3 },
    { text: 'How useFocusEffect fixes it', step: 4 },
  ],
  steps: [
    {
      label: 'Mental model',
      title: 'Many histories, not one',
      tag: 'problem',
      body: ['On the web, navigating away unmounts the page. On mobile each stack and tab has its own history, and **previous screens stay mounted** under the new one.', 'Back is a swipe, a system button or a header button.'],
      keyIdea: 'The key consequence: screens stay mounted.',
      frames: [{ state: view(s1, { text: 'Feed mounts and focuses when it is first pushed', tone: 'accent' }), hold: 3600 }],
    },
    {
      label: 'Push',
      title: 'The screen below stays alive',
      tag: 'concept',
      body: ['Pushing `Post` blurs `Feed`. It is hidden but still **mounted**, with its state, effects and timers alive.', 'A mounted hidden screen still consumes resources.'],
      keyIdea: 'Pause polling, video, camera and location on blur.',
      frames: [{ state: view(s2, { text: 'Feed received a blur, not an unmount', tone: 'ok' }), hold: 4000 }],
    },
    {
      label: 'Return',
      title: 'Back: focus, not mount',
      tag: 'trade-off',
      body: ['Popping `Post` unmounts it and **focuses** `Feed` again. `Feed` never unmounted, so its mount effect does not run.', 'Anything fetched on mount is now stale.'],
      keyIdea: 'An effect with `[]` runs once per mount, not once per visit.',
      frames: [{ state: view(s3, { text: 'Feed mounted once but focused twice: the data it loaded earlier is not refreshed', tone: 'bad' }), hold: 4400 }],
    },
    {
      label: 'Focus effect',
      title: 'Refresh on focus',
      tag: 'technique',
      body: ['`useFocusEffect` runs every time the screen becomes visible, and its cleanup runs on blur.', 'Use it to refetch when the user comes back and to stop timers when they leave.'],
      keyIdea: 'Use focus events for "refresh when visible".',
      frames: [{ state: view(s3, { text: '', tone: 'ok' }, { refetchOn: 'useFocusEffect fires on every focus: Feed refetches when the user returns' }), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Screen lifecycle',
      tag: 'recap',
      body: [
        '- **Stacks:** each has its own history.',
        '- **Push:** the screen below blurs and stays mounted.',
        '- **Pop:** the screen below focuses, no new mount.',
        '- **Mount effects:** run once per mount.',
        '- **useFocusEffect:** runs on every visit, with cleanup on blur.',
      ],
      keyIdea: 'Think visibility, not mounting.',
      frames: [{ state: view(s3, { text: '', tone: 'ok' }, { refetchOn: 'mount once, focus on every visit' }) }],
    },
  ],
});
