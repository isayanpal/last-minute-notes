import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the React 19.2 notes: Activity keeps hidden state alive where conditional rendering destroys it,
 * and useEffectEvent stops non-reactive values from re-running an Effect. Both outcomes are computed by running small models.
 */

// Activity versus conditional rendering: a counter at 5 is hidden, then shown again.
type Tab = { count: number };
const start: Tab = { count: 5 };
const condHidden: Tab = { count: 0 }; // unmounted: state is destroyed
const condShown: Tab = { count: 0 }; // remounted from the initial state
const actHidden: Tab = start; // hidden, but state and DOM stay alive
const actShown: Tab = start;

// useEffectEvent: count how many times the connection is rebuilt for a series of changes.
const CHANGES: ('theme' | 'theme2' | 'room')[] = ['theme', 'theme2', 'room'];
const reconnects = (reactive: ('theme' | 'room')[], k: number) => {
  let n = 1; // the first connection
  CHANGES.slice(0, k).forEach((c) => {
    const key = c === 'room' ? 'room' : 'theme';
    if (reactive.includes(key)) n++;
  });
  return n;
};

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

const tabView = (mode: 'cond' | 'activity', phase: 0 | 1 | 2): FlowState => {
  const tab = phase === 0 ? start : phase === 1 ? (mode === 'cond' ? condHidden : actHidden) : mode === 'cond' ? condShown : actShown;
  const hidden = phase === 1;
  const alive = mode === 'activity' || phase !== 1;
  return {
    nodes: [
      { id: 'p', label: 'Tab switch', sub: mode === 'cond' ? '{open && <Panel/>}' : '<Activity mode>', kind: 'gateway', x: 0.1, y: 1.7, status: 'active' },
      { id: 'panel', label: 'Panel', sub: alive ? (hidden ? 'hidden, state alive' : 'visible') : 'unmounted', kind: 'service', x: 2.9, y: 1.7, status: alive ? (hidden ? 'dim' : 'active') : 'down', items: alive ? [`count ${tab.count}`] : undefined },
      { id: 'dom', label: 'DOM', sub: alive ? 'kept' : 'destroyed', kind: 'storage', x: 5.6, y: 1.7, status: alive ? 'normal' : 'down' },
    ],
    links: [{ from: 'p', to: 'panel' }, { from: 'panel', to: 'dom' }],
    packets: phase === 1 ? [hop('p', 'panel', 'hide', 0, mode === 'cond' ? 'bad' : 'data')] : phase === 2 ? [hop('p', 'panel', 'show', 0, mode === 'cond' ? 'bad' : 'ok')] : [],
    stats: [
      { label: 'Mode', value: mode === 'cond' ? 'conditional' : 'Activity' },
      { label: 'State', value: phase === 1 && mode === 'cond' ? 'destroyed' : String(tab.count), tone: phase === 2 ? (tab.count === 5 ? 'ok' : 'bad') : 'neutral' },
      { label: 'Showing again', value: phase === 2 ? (mode === 'cond' ? 'full remount' : 'instant') : '-', tone: phase === 2 ? (mode === 'cond' ? 'bad' : 'ok') : 'neutral' },
    ],
    note:
      phase === 0
        ? { text: 'the panel holds a counter at 5', tone: 'accent' }
        : phase === 1
          ? mode === 'cond'
            ? { text: 'conditional rendering unmounts the panel: state and DOM are destroyed', tone: 'bad' }
            : { text: 'Activity hides it, detaches its effects and lowers priority, but keeps state and DOM', tone: 'ok' }
          : mode === 'cond'
            ? { text: `shown again it remounts from scratch: the counter is back to ${tab.count}`, tone: 'bad' }
            : { text: 'shown again it restores instantly with the counter still at 5', tone: 'ok' },
  };
};

const effectView = (useEvent: boolean, k: number): FlowState => {
  const reactive: ('theme' | 'room')[] = useEvent ? ['room'] : ['room', 'theme'];
  const n = reconnects(reactive, k);
  const last = CHANGES[k - 1];
  const rebuilt = k > 0 && reactive.includes(last === 'room' ? 'room' : 'theme');
  return {
    nodes: [
      { id: 'e', label: 'Effect', sub: useEvent ? 'deps: roomId' : 'deps: roomId, theme', kind: 'worker', x: 0.1, y: 1.7, status: rebuilt ? 'hot' : 'active' },
      { id: 'c', label: 'Connection', sub: rebuilt ? 'rebuilt' : 'kept', kind: 'external', x: 2.9, y: 1.7, status: 'normal', items: [`conn ${n}`] },
      { id: 't', label: useEvent ? 'Effect Event' : 'Callback', sub: 'reads theme', kind: 'service', x: 5.6, y: 1.7, status: useEvent ? 'active' : 'normal' },
    ],
    links: [{ from: 'e', to: 'c' }, { from: 'c', to: 't' }],
    packets: k > 0 ? [hop('e', 'c', last === 'room' ? 'roomId' : 'theme', 0, rebuilt ? 'bad' : 'ok')] : [],
    stats: [
      { label: 'Change', value: k === 0 ? '-' : last === 'room' ? 'roomId' : 'theme' },
      { label: 'Connections', value: String(n), tone: useEvent ? 'ok' : n > 2 ? 'bad' : 'neutral' },
      { label: 'Theme read', value: useEvent ? 'always latest' : 'via deps', tone: useEvent ? 'ok' : 'neutral' },
    ],
    note:
      k === 0
        ? { text: useEvent ? 'the effect lists only reactive values; theme is read through an Effect Event' : 'the effect lists theme because the callback reads it', tone: 'accent' }
        : rebuilt
          ? { text: `${last === 'room' ? 'roomId' : 'theme'} changed: the effect cleans up and reconnects`, tone: last === 'room' ? 'accent' : 'bad' }
          : { text: 'theme changed but the effect does not re-run: the Effect Event still reads the latest theme', tone: 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'react-19-2',
  objectives: [
    { text: 'What conditional rendering throws away', step: 1 },
    { text: 'How Activity keeps hidden UI alive', step: 2 },
    { text: 'Why a non-reactive value re-runs an Effect', step: 3 },
    { text: 'How useEffectEvent separates the two', step: 4 },
  ],
  steps: [
    {
      label: 'Hide, show',
      title: 'Conditional rendering destroys state',
      tag: 'problem',
      body: ['With `{open && <Panel />}`, hiding the panel unmounts it. Its state and DOM are destroyed.', 'Showing it again is a full remount, and the counter is back to 0.'],
      keyIdea: 'Tab switches and back navigation lose state when the subtree unmounts.',
      frames: [{ state: tabView('cond', 0), hold: 2000 }, { state: tabView('cond', 1), hold: 2600 }, { state: tabView('cond', 2), hold: 3600 }],
    },
    {
      label: 'Activity',
      title: 'Hidden, but alive',
      tag: 'concept',
      body: ['`<Activity mode="hidden">` keeps state and DOM alive, detaches effects and lowers priority.', 'Showing it again is instant, with the counter still at 5.'],
      keyIdea: 'Use it for tab switching, pre-rendering off-screen routes and back/forward caches.',
      frames: [{ state: tabView('activity', 0), hold: 2000 }, { state: tabView('activity', 1), hold: 2800 }, { state: tabView('activity', 2), hold: 3600 }],
    },
    {
      label: 'Over-listing',
      title: 'Effects re-run too often',
      tag: 'trade-off',
      body: ['An Effect that connects to a chat room also reads `theme` in a callback. To be correct, `theme` goes in the dependency array.', 'Now every theme change tears down the connection and reconnects.'],
      keyIdea: 'Not every value an Effect reads should make it re-run.',
      frames: [0, 1, 2, 3].map((k) => ({ state: effectView(false, k), hold: k === 3 ? 3600 : 1700 })),
    },
    {
      label: 'useEffectEvent',
      title: 'Read the latest, never re-run',
      tag: 'technique',
      body: ['`useEffectEvent` extracts the non-reactive logic. The returned function always sees the latest props and state, but is not a dependency.', 'Only `roomId` re-runs the Effect.'],
      keyIdea: 'No more over-listing, or intentionally omitting, dependencies.',
      frames: [0, 1, 2, 3].map((k) => ({ state: effectView(true, k), hold: k === 3 ? 3600 : 1700 })),
    },
    {
      label: 'Recap',
      title: 'React 19.2 in one page',
      tag: 'recap',
      body: [
        '- **Conditional rendering:** unmounts, state is lost.',
        '- **Activity:** hidden mode keeps state and DOM, shows instantly.',
        '- **Dependencies:** list reactive values only.',
        '- **useEffectEvent:** reads the latest values without re-running.',
        '- **Also new:** `cacheSignal`, `useId` prefix and performance tracks.',
      ],
      keyIdea: 'Hide with Activity when state matters, split reactive from non-reactive with Effect Events.',
      frames: [{ state: effectView(true, 3) }],
    },
  ],
});
