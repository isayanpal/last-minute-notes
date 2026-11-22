import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the SDLC notes on the seven phases and their two loops. The phase after each event is computed by folding the events through a
 * real transition table (an event that does not start from the current phase throws), using the notes' checkout example: the double-click
 * bug found in testing sends the work back to implementation, and new needs after release start the cycle again.
 */

type Ph = 'req' | 'plan' | 'design' | 'impl' | 'test' | 'deploy' | 'maint';
type Ev = { name: string; from: Ph; to: Ph };
const EVENTS: Ev[] = [
  { name: 'SRS approved', from: 'req', to: 'plan' },
  { name: '3 sprints, 2 backend', from: 'plan', to: 'design' },
  { name: 'HLD and LLD', from: 'design', to: 'impl' },
  { name: 'PR merged', from: 'impl', to: 'test' },
  { name: 'double-click bug', from: 'test', to: 'impl' },
  { name: 'fix merged', from: 'impl', to: 'test' },
  { name: 'tests pass', from: 'test', to: 'deploy' },
  { name: 'canary to 100%', from: 'deploy', to: 'maint' },
  { name: 'new needs', from: 'maint', to: 'req' },
];
const stateAt = (k: number) => {
  let cur: Ph = 'req';
  let prev: Ph | null = null;
  let ev: Ev | null = null;
  for (let i = 0; i < k; i++) {
    if (EVENTS[i].from !== cur) throw new Error(`${EVENTS[i].name} does not start from ${cur}`);
    prev = cur;
    cur = EVENTS[i].to;
    ev = EVENTS[i];
  }
  const bugLoops = EVENTS.slice(0, k).filter((e) => e.from === 'test' && e.to === 'impl').length;
  return { cur, prev, ev, bugLoops };
};

const INFO: Record<Ph, { label: string; sub: string; out: string; kind: FlowNode['kind']; x: number; y: number }> = {
  req: { label: 'Requirements', sub: 'what to build', out: 'SRS', kind: 'client', x: 0.1, y: 0.5 },
  plan: { label: 'Planning', sub: 'cost, time, risk', out: 'estimate', kind: 'gateway', x: 1.9, y: 0.5 },
  design: { label: 'Design', sub: 'HLD and LLD', out: 'HLD + LLD', kind: 'service', x: 3.7, y: 0.5 },
  impl: { label: 'Implementation', sub: 'code, review', out: 'merged PR', kind: 'worker', x: 5.5, y: 0.5 },
  test: { label: 'Testing', sub: 'verify the spec', out: 'test report', kind: 'monitor', x: 5.5, y: 2.9 },
  deploy: { label: 'Deployment', sub: 'staged rollout', out: 'release', kind: 'cdn', x: 3.7, y: 2.9 },
  maint: { label: 'Maintenance', sub: 'fix, patch', out: 'hotfix', kind: 'storage', x: 1.9, y: 2.9 },
};
const ORDER: Ph[] = ['req', 'plan', 'design', 'impl', 'test', 'deploy', 'maint'];
const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

const view = (k: number, note: FlowState['note']): FlowState => {
  const s = stateAt(k);
  const loop = s.prev && s.ev && ((s.ev.from === 'test' && s.ev.to === 'impl') || (s.ev.from === 'maint' && s.ev.to === 'req'));
  return {
    nodes: ORDER.map((p): FlowNode => ({ id: p, label: INFO[p].label, sub: INFO[p].sub, kind: INFO[p].kind, x: INFO[p].x, y: INFO[p].y, status: p === s.cur ? (loop ? 'hot' : 'active') : 'normal' })),
    links: [
      { from: 'req', to: 'plan' },
      { from: 'plan', to: 'design' },
      { from: 'design', to: 'impl' },
      { from: 'impl', to: 'test' },
      { from: 'test', to: 'deploy' },
      { from: 'deploy', to: 'maint' },
      { from: 'test', to: 'impl', dashed: true, label: 'bugs' },
      { from: 'maint', to: 'req', dashed: true, label: 'new needs' },
    ],
    packets: s.prev && s.ev ? [hop(s.prev, s.cur, s.ev.name.slice(0, 14), 0, loop ? 'bad' : 'ok')] : [],
    stats: [
      { label: 'Phase', value: INFO[s.cur].label },
      { label: 'Output', value: INFO[s.cur].out },
      { label: 'Bug loops', value: String(s.bugLoops), tone: s.bugLoops ? 'bad' : 'neutral' },
    ],
    note,
  };
};

export default defineLesson('flow', {
  slug: 'sdlc-phases',
  objectives: [
    { text: 'The seven phases and what each produces', step: 1 },
    { text: 'How design leads into implementation', step: 2 },
    { text: 'How a bug sends work back', step: 3 },
    { text: 'How release leads into maintenance and a new cycle', step: 4 },
  ],
  steps: [
    {
      label: 'Phases',
      title: 'From need to design',
      tag: 'problem',
      body: ['Every SDLC model arranges the same **seven phases**. Requirements say **what** to build and end in an SRS.', 'Planning estimates cost and risk, and design turns requirements into HLD and LLD.'],
      keyIdea: 'Models differ in how the phases are arranged, not in what they are.',
      frames: [0, 1, 2].map((k) => ({ state: view(k, k === 0 ? { text: 'checkout: pay by card, UPI or wallet, and 10,000 concurrent checkouts', tone: 'accent' } : k === 1 ? { text: 'planning: 3 sprints, 2 backend engineers, and a payment gateway rate limit risk', tone: 'accent' } : { text: 'design: a separate payment service, and a POST /api/checkout contract', tone: 'accent' }), hold: 2400 })),
    },
    {
      label: 'Build, test',
      title: 'Code against the design',
      tag: 'concept',
      body: ['Implementation writes code against the LLD, with reviews and unit tests, and merges to `main`.', 'Testing then verifies the system against the requirements.'],
      keyIdea: 'Each phase has an output that the next phase consumes.',
      frames: [3, 4].map((k) => ({ state: view(k, k === 3 ? { text: 'the PR for POST /api/checkout is reviewed and merged', tone: 'accent' } : { text: 'a tester finds that a double-click creates two orders for one cart', tone: 'bad' }), hold: 2800 })),
    },
    {
      label: 'Bug loop',
      title: 'Back to implementation',
      tag: 'trade-off',
      body: ['A bug found in testing goes **back** to implementation. The fix is merged and tested again.', 'The loop costs more the later the bug is found.'],
      keyIdea: 'Testing is not a gate you pass once, it is a loop.',
      frames: [5, 6, 7].map((k) => ({ state: view(k, k === 5 ? { text: 'the race condition is reported back to development', tone: 'bad' } : k === 6 ? { text: 'the fix is merged and the build goes back to testing', tone: 'accent' } : { text: 'this time every test passes', tone: 'ok' }), hold: 2400 })),
    },
    {
      label: 'Release',
      title: 'Deploy, maintain, repeat',
      tag: 'technique',
      body: ['Deployment is usually staged: a canary to 5 percent of users, then 100 percent.', 'Maintenance fixes bugs and patches. **New needs** feed back into requirements and start the next cycle.'],
      keyIdea: 'The second loop is what makes it a life cycle.',
      frames: [8, 9, 10].slice(0, 2).map((k) => ({ state: view(k, k === 8 ? { text: 'feature flag to 5 percent, watch errors, then 100 percent', tone: 'ok' } : { text: 'the next need starts a new cycle from requirements', tone: 'accent' }), hold: 3000 })),
    },
    {
      label: 'Recap',
      title: 'The seven phases',
      tag: 'recap',
      body: [
        '- **Requirements:** SRS.',
        '- **Planning:** cost, timeline, risk.',
        '- **Design:** HLD and LLD.',
        '- **Implementation and testing:** with a bug loop.',
        '- **Deployment and maintenance:** with a new-needs loop.',
      ],
      keyIdea: 'Pick the model by how you want these loops to behave.',
      frames: [{ state: view(9, { text: 'after maintenance a new need goes round again', tone: 'accent' }) }],
    },
  ],
});
