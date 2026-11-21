import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Axis: minutes of a 45 minute interview. Budgets come from the RADIO table in the notes:
 * R 5 to 7, A 8 to 10, D 5 to 7, I 7 to 10, O 10 to 12. We draw the middle of each range.
 */

const MIN = { from: 0, to: 45, unit: 'm', ticks: [0, 10, 20, 30, 40] };

const bar = (id: string, from: number, to: number, label: string, extra: Partial<TimelineBar> = {}): TimelineBar => ({ id, from, to, label, ...extra });

// Step 1: the failure mode. Everything goes into the component tree.
const FAILED: TimelineState = {
  ...MIN,
  lanes: [
    { label: 'Requirements', bars: [bar('r', 0, 2, 'R', { tone: 'info' })] },
    { label: 'Architecture', bars: [bar('a', 2, 36, 'component tree, state, props...', { tone: 'bad', state: 'bad' })] },
    { label: 'Data model', bars: [bar('d', 36, 39, 'D', { tone: 'info' })] },
    { label: 'Interface', bars: [bar('i', 39, 43, 'I', { tone: 'info' })] },
    { label: 'Optimizations', bars: [bar('o', 43, 45, 'O', { tone: 'bad', state: 'bad' })] },
  ],
  stats: [
    { label: 'On the tree', value: '34 of 45 min', tone: 'bad' },
    { label: 'Optimizations', value: '2 min', tone: 'bad' },
    { label: 'Senior signals', value: 'missed', tone: 'bad' },
  ],
  note: { text: 'no plan: the hour disappears into one box', tone: 'bad' },
};

// Step 2: the RADIO budget.
const BUDGET_BARS: [string, string, number, number, string, TimelineBar['tone']][] = [
  ['R', 'Requirements', 0, 6, '5-7 min', 'info'],
  ['A', 'Architecture', 6, 15, '8-10 min', 'violet'],
  ['D', 'Data model', 15, 21, '5-7 min', 'ok'],
  ['I', 'Interface', 21, 29, '7-10 min', 'data'],
  ['O', 'Optimizations', 29, 41, '10-12 min', 'accent'],
];
const budget = (shown: number, active?: string): TimelineState => ({
  ...MIN,
  lanes: BUDGET_BARS.map(([k, label, from, to, text, tone], i) => ({
    label,
    bars: i < shown ? [bar(k, from, to, text, { tone, state: active && active !== k ? 'dim' : 'normal' })] : [],
  })),
  stats: [
    { label: 'Framework', value: 'RADIO' },
    { label: 'Biggest slice', value: 'Optimizations', tone: 'ok' },
    { label: 'Slack', value: '~4 min' },
  ],
  note: { text: 'R, A, D, I, O: one checklist for the whole talk', tone: 'accent' },
});

// Step 3: the opening move, zoomed to the first three minutes.
const OPENING: TimelineState = {
  from: 0,
  to: 3,
  unit: 'm',
  ticks: [0, 1, 2, 3],
  lanes: [
    { label: '1. Restate', bars: [bar('s1', 0, 0.4, 'one sentence', { tone: 'info' })] },
    { label: '2. Clarify', bars: [bar('s2', 0.4, 1.7, '5 to 8 questions', { tone: 'accent' })] },
    { label: '3. Summarize', bars: [bar('s3', 1.7, 2.6, 'scope + targets', { tone: 'ok' })] },
    { label: '4. Name plan', bars: [bar('s4', 2.6, 3, 'RADIO', { tone: 'violet' })] },
  ],
  markers: [{ at: 1.7, label: 'scope written down', tone: 'accent' }],
  stats: [
    { label: 'Questions', value: '5 to 8' },
    { label: 'Example target', value: 'p75 LCP < 2.5s', tone: 'ok' },
    { label: 'Written', value: 'in / out scope' },
  ],
  note: { text: 'public pages, mobile first, 4G: assumptions out loud', tone: 'accent' },
};

// Step 4: go broad, then deep. The interviewer picks the dive.
const broadDeep = (deep: boolean): TimelineState => ({
  from: 0,
  to: 45,
  unit: 'm',
  ticks: [0, 10, 20, 30, 40],
  lanes: [
    { label: 'Pass 1: broad', bars: [bar('p1', 0, 24, 'R A D I O at a high level', { tone: 'info' })] },
    { label: 'Pass 2: deep', bars: deep ? [bar('p2', 24, 45, 'where the interviewer points', { tone: 'accent', state: 'active' })] : [] },
  ],
  markers: deep ? [{ at: 24, label: 'you check in', tone: 'accent' }] : [],
  stats: [
    { label: 'Pass 1', value: 'every letter', tone: 'ok' },
    { label: 'Pass 2', value: deep ? 'their pick' : 'not yet' },
    { label: 'Split', value: 'illustrative' },
  ],
  note: deep ? { text: '"Deeper on the data layer or performance?"', tone: 'accent' } : { text: 'cover every letter before diving into one', tone: 'accent' },
});

// Step 5: the trade-off sentence.
const SENTENCE: TimelineState = {
  from: 0,
  to: 4,
  unit: 's',
  ticks: [0, 1, 2, 3, 4],
  lanes: [
    { label: 'Choice', bars: [bar('c', 0, 1, 'I choose SSR', { tone: 'info' })] },
    { label: 'Because', bars: [bar('b', 1, 2, 'SEO + first paint', { tone: 'ok' })] },
    { label: 'Cost', bars: [bar('k', 2, 3, 'server load', { tone: 'bad', state: 'bad' })] },
    { label: 'Mitigation', bars: [bar('m', 3, 4, 'CDN caching', { tone: 'accent' })] },
  ],
  stats: [
    { label: 'Pattern', value: 'X, Y, Z, W' },
    { label: 'Every decision', value: 'gets a cost', tone: 'ok' },
    { label: 'Without it', value: 'a tool list', tone: 'bad' },
  ],
  note: { text: 'I choose X because Y, the cost is Z, I mitigate with W', tone: 'accent' },
};

// Step 6: show the states, not just the happy path.
const STATES: TimelineState = {
  from: 0,
  to: 14,
  unit: 's',
  ticks: [0, 2, 4, 6, 8, 10, 12, 14],
  lanes: [
    { label: 'Loading', bars: [bar('l', 0, 2, 'skeleton', { tone: 'info' })] },
    { label: 'Content', bars: [bar('c', 2, 7, 'happy path', { tone: 'ok' })] },
    { label: 'Stale', bars: [bar('s', 7, 9, 'refetching', { tone: 'data' })] },
    { label: 'Offline', bars: [bar('o', 9, 12, 'cached + banner', { tone: 'violet' })] },
    { label: 'Error', bars: [bar('e', 12, 14, 'retry', { tone: 'bad', state: 'bad' })] },
  ],
  stats: [
    { label: 'States', value: '5, not 1' },
    { label: 'Also', value: 'empty, denied' },
    { label: 'Interviewer', value: 'checks these', tone: 'ok' },
  ],
  note: { text: 'a table of states for the main view beats a happy path', tone: 'accent' },
};

export default defineLesson('timeline', {
  slug: 'fe-radio',
  objectives: [
    { text: 'Why a framework beats starting with React and Redux', step: 1 },
    { text: 'The five RADIO steps and their time budget', step: 2 },
    { text: 'What to do in the first three minutes', step: 3 },
    { text: 'Going broad first, then deep where asked', step: 4 },
    { text: 'The sentence that makes a trade-off', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'The hour that vanishes',
      tag: 'problem',
      body: ['Many candidates open with a tool choice and then spend almost the whole interview on the component tree.', 'Data, the API contract and optimizations get a few rushed minutes, and those are the senior signals.'],
      keyIdea: 'A frontend design interview tests judgment across the whole system, not how fast you draw boxes.',
      frames: [{ state: FAILED }],
    },
    {
      label: 'RADIO',
      title: 'Five steps, one checklist',
      tag: 'concept',
      body: ['**R**equirements, **A**rchitecture, **D**ata model, **I**nterface, **O**ptimizations. Each letter has a time budget out of 45 minutes.', 'Optimizations get the biggest slice: performance, accessibility, security, observability and release.'],
      keyIdea: 'RADIO is a map for the conversation. Cover every letter, then let the interviewer choose where to dive.',
      frames: [
        { state: budget(1), hold: 1000 },
        { state: budget(2), hold: 1000 },
        { state: budget(3), hold: 1000 },
        { state: budget(4), hold: 1000 },
        { state: budget(5), hold: 2200 },
      ],
    },
    {
      label: 'Opening',
      title: 'The first three minutes',
      tag: 'technique',
      body: ['Restate the problem in one sentence. Ask 5 to 8 clarifying questions grouped by users, network, content, data and quality bars.', 'Then summarize scope and targets, write them down, and name the framework you will follow.'],
      keyIdea: 'Write in-scope and out-of-scope items down. A visible list stops scope creep and shows discipline.',
      frames: [{ state: OPENING }],
    },
    {
      label: 'Broad then deep',
      title: 'Breadth first, then let them pick',
      tag: 'technique',
      body: ['Draw one boxes-and-arrows diagram of components and data flow, then cover every letter at a high level.', 'After that, check in and let the interviewer choose where to go deep. State a default and move on instead of stalling on open questions.'],
      keyIdea: 'Go broad, then deep. "I will assume read-heavy and mobile first, tell me if that is wrong" beats an open question.',
      frames: [{ state: broadDeep(false), hold: 1600 }, { state: broadDeep(true), hold: 2200 }],
    },
    {
      label: 'Trade-offs',
      title: 'Name the cost of every choice',
      tag: 'trade-off',
      body: ['Senior answers name trade-offs precisely: SSR or CSR, cache or fetch, optimistic or pessimistic, polling or WebSocket.', 'Use one sentence pattern for each decision: **choice, reason, cost, mitigation**.'],
      keyIdea: '"I choose X because requirement Y, the cost is Z, and I mitigate it with W."',
      frames: [{ state: SENTENCE }],
    },
    {
      label: 'States',
      title: 'Show every state of the screen',
      tag: 'in practice',
      body: ['Designing only the happy path is a common mistake. Show loading, empty, error, offline and stale states for the main view.', 'Name what you would measure too: LCP, INP, error rate and cache hit rate.'],
      keyIdea: 'Use numbers from your estimation, and say what result would make you change the design.',
      frames: [{ state: STATES }],
    },
    {
      label: 'Recap',
      title: 'What to carry into the room',
      tag: 'recap',
      body: [
        '- **Do not** start with "I will use React and Redux". Requirements first, tools justified afterward.',
        '- **RADIO:** requirements, architecture, data model, interface, optimizations.',
        '- **First 3 minutes:** restate, ask 5 to 8 questions, summarize scope, name the plan.',
        '- **Broad then deep:** one diagram, every letter, then the interviewer picks.',
        '- **Every decision:** choice, reason, cost, mitigation. Reserve time for optimizations.',
      ],
      keyIdea: 'Draw early, refer back to it, and finish with how you would measure and release.',
      frames: [{ state: budget(5) }],
    },
  ],
});
