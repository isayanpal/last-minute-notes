import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

const T = { from: 0, to: 120, unit: 'm', ticks: [0, 30, 60, 90, 120] } as const;

const tl = (lanes: TimelineState['lanes'], over: Partial<TimelineState> = {}): TimelineState => ({ ...T, ticks: [...T.ticks], lanes, ...over });

const impact = (to: number, tone: TimelineBar['tone'] = 'bad'): TimelineBar => ({ id: 'impact', from: 0, to, label: 'users impacted', tone });

// Step 1: a bad deploy, errors start.
const START = tl([{ label: 'Customer impact', bars: [impact(120)] }], {
  markers: [{ at: 0, label: 'bad deploy', tone: 'accent' }],
  stats: [{ label: 'Deploy', value: 'T+0' }, { label: 'Errors', value: '8%', tone: 'bad' }, { label: 'Aware?', value: 'nobody yet', tone: 'bad' }],
  note: { text: 'impact starts the minute the change ships', tone: 'bad' },
});

// Step 2: detection. Alerts beat customer reports.
const SLOW_DETECT = tl(
  [
    { label: 'Customer impact', bars: [impact(120)] },
    { label: 'Detection', bars: [{ id: 'det', from: 0, to: 40, label: 'noticed via support tickets', tone: 'bad' }] },
  ],
  { markers: [{ at: 0, label: 'deploy', tone: 'accent' }, { at: 40, label: 'ticket spike', tone: 'bad' }], stats: [{ label: 'Detect by', value: 'customers' }, { label: 'Time to detect', value: '40 min', tone: 'bad' }, { label: 'Biggest gap', value: 'detection', tone: 'bad' }] },
);
const FAST_DETECT = tl(
  [
    { label: 'Customer impact', bars: [impact(120)] },
    { label: 'Detection', bars: [{ id: 'det', from: 0, to: 6, label: 'burn-rate alert', tone: 'ok' }] },
  ],
  { markers: [{ at: 0, label: 'deploy', tone: 'accent' }, { at: 6, label: 'page', tone: 'ok' }], stats: [{ label: 'Detect by', value: 'SLO alert' }, { label: 'Time to detect', value: '6 min', tone: 'ok' }, { label: 'Signal', value: 'budget burn' }] },
);

// Step 3: mitigate first, diagnose later.
const DIAGNOSE_FIRST = tl(
  [
    { label: 'Customer impact', bars: [impact(95)] },
    { label: 'Detection', bars: [{ id: 'det', from: 0, to: 6, label: 'alert', tone: 'ok' }] },
    { label: 'Hunt root cause', bars: [{ id: 'rca', from: 6, to: 90, label: 'reading logs and code', tone: 'bad' }] },
    { label: 'Fix', bars: [{ id: 'fix', from: 90, to: 95, label: 'fix', tone: 'ok' }] },
  ],
  { markers: [{ at: 6, label: 'page', tone: 'ok' }, { at: 95, label: 'resolved', tone: 'ok' }], stats: [{ label: 'Approach', value: 'diagnose first' }, { label: 'Time to mitigate', value: '95 min', tone: 'bad' }, { label: 'Users hurt', value: 'for 95 min', tone: 'bad' }] },
);
const MITIGATE_FIRST = tl(
  [
    { label: 'Customer impact', bars: [impact(14)] },
    { label: 'Detection', bars: [{ id: 'det', from: 0, to: 6, label: 'alert', tone: 'ok' }] },
    { label: 'Mitigate', bars: [{ id: 'mit', from: 6, to: 14, label: 'roll back', tone: 'ok' }] },
    { label: 'Root cause', bars: [{ id: 'rca', from: 14, to: 90, label: 'diagnose calmly', tone: 'info' }] },
  ],
  { markers: [{ at: 6, label: 'page', tone: 'ok' }, { at: 14, label: 'mitigated', tone: 'ok' }], stats: [{ label: 'Approach', value: 'mitigate first' }, { label: 'Time to mitigate', value: '14 min', tone: 'ok' }, { label: 'Root cause', value: 'can wait' }] },
);

// Step 4: roles and communication cadence.
const ROLES = tl(
  [
    { label: 'Commander', bars: [{ id: 'ic', from: 6, to: 60, label: 'decides, delegates', tone: 'accent' }] },
    { label: 'Operations', bars: [{ id: 'op', from: 8, to: 40, label: 'rollback, checks', tone: 'info' }] },
    { label: 'Comms lead', bars: [{ id: 'cm1', from: 12, to: 18, label: 'update', tone: 'violet' }, { id: 'cm2', from: 27, to: 33, label: 'update', tone: 'violet' }, { id: 'cm3', from: 42, to: 48, label: 'update', tone: 'violet' }] },
    { label: 'Scribe', bars: [{ id: 'sc', from: 6, to: 60, label: 'timeline of events', tone: 'neutral' }] },
  ],
  { to: 60, ticks: [0, 15, 30, 45, 60], markers: [{ at: 15, label: 'update +15', tone: 'accent' }, { at: 30, label: '+30', tone: 'accent' }, { at: 45, label: '+45', tone: 'accent' }], stats: [{ label: 'One person', value: 'drives', tone: 'ok' }, { label: 'Updates', value: 'fixed cadence' }, { label: 'Even if', value: '"no change"' }] },
);

// Step 5: postmortem and follow-through, on a days scale.
const POST = tl(
  [
    { label: 'Incident', bars: [{ id: 'inc', from: 0, to: 0.5, label: '2 h', tone: 'bad' }] },
    { label: 'Postmortem', bars: [{ id: 'pm', from: 1, to: 3, label: 'blameless draft + review', tone: 'info' }] },
    { label: 'Action items', bars: [{ id: 'ai', from: 3, to: 14, label: 'owners, deadlines', tone: 'accent' }] },
    { label: 'Verified', bars: [{ id: 'vf', from: 12, to: 14, label: 'closed', tone: 'ok' }] },
  ],
  { from: 0, to: 14, unit: 'd', ticks: [0, 3.5, 7, 10.5, 14], stats: [{ label: 'Focus', value: 'systems' }, { label: 'Factors', value: 'several' }, { label: 'Ends when', value: 'actions done', tone: 'ok' }], note: { text: 'a postmortem without tracked actions changes nothing', tone: 'accent' } },
);

// Recap: all three clocks.
const CLOCKS = tl(
  [
    { label: 'Detect', bars: [{ id: 'det', from: 0, to: 6, label: 'TTD', tone: 'info' }] },
    { label: 'Mitigate', bars: [{ id: 'mit', from: 6, to: 14, label: 'TTM', tone: 'ok' }] },
    { label: 'Recover', bars: [{ id: 'rec', from: 14, to: 40, label: 'TTR: fully healthy', tone: 'accent' }] },
  ],
  { markers: [{ at: 0, label: 'start', tone: 'accent' }], stats: [{ label: 'TTD', value: '6 min' }, { label: 'TTM', value: '14 min' }, { label: 'TTR', value: '40 min' }] },
);

export default defineLesson('timeline', {
  slug: 'incident-response',
  objectives: [
    { text: 'Why detection is usually the biggest gap', step: 2 },
    { text: 'Mitigate before you diagnose', step: 3 },
    { text: 'Who does what during an incident', step: 4 },
    { text: 'How a blameless postmortem turns into real fixes', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'It is 2 a.m. and errors are rising',
      tag: 'problem',
      body: [
        'A change ships and users start failing. Nothing in your design stops incidents entirely, so the question is how fast you notice, stop the damage and learn from it.',
        'Response is a process, not heroics.',
      ],
      keyIdea: 'Incidents are certain. Time to detect, mitigate and recover is the part you control.',
      frames: [{ state: START }],
    },
    {
      label: 'Detect',
      title: 'Find out before customers do',
      tag: 'concept',
      body: [
        'Detection is often the largest gap. If the first signal is a support ticket, you are already 40 minutes late.',
        'Alert on **SLO burn rate** so a real, user-visible problem pages you within minutes.',
      ],
      keyIdea: 'Track **time to detect**, **time to mitigate** and **time to recover** separately. Each has its own fix.',
      frames: [{ state: SLOW_DETECT, hold: 2800 }, { state: FAST_DETECT }],
    },
    {
      label: 'Mitigate first',
      title: 'Stop the bleeding, then investigate',
      tag: 'technique',
      body: [
        'Roll back, fail over, shed load or flip a feature flag. These are fast and reversible.',
        'Root cause can wait until users are no longer hurt. Hunting for it first keeps the incident open for no benefit.',
      ],
      keyIdea: 'Mitigate before you diagnose. Resolve and verify, then find out why.',
      frames: [{ state: DIAGNOSE_FIRST, hold: 2800 }, { state: MITIGATE_FIRST }],
    },
    {
      label: 'Roles',
      title: 'One person drives',
      tag: 'technique',
      body: [
        'Assign an **incident commander** who decides and delegates, an **operations** lead who changes the system, a **communications** lead and a **scribe**.',
        'Update stakeholders and customers on a fixed cadence, even to say "no change".',
      ],
      keyIdea: 'Parallel debugging with no commander is how fixes collide. Clear roles keep the room calm.',
      frames: [{ state: ROLES }],
    },
    {
      label: 'Postmortem',
      title: 'Learn without blame',
      tag: 'technique',
      body: [
        'Write a **blameless postmortem**: timeline, impact, contributing factors (plural), what went well, what was lucky.',
        'Turn it into action items with owners and dates, and track them to done. Focus on systems, not people.',
      ],
      keyIdea: 'The follow-through is the point. Unfixed actions mean the same incident returns.',
      frames: [{ state: POST }],
    },
    {
      label: 'Recap',
      title: 'The incident loop',
      tag: 'recap',
      body: [
        '- **Detect:** alert on user impact and SLO burn, not only on causes.',
        '- **Triage:** set severity and scope fast.',
        '- **Mitigate first:** rollback, failover, load shedding, feature flags.',
        '- **Run it:** commander, operations, comms, scribe, on a steady update cadence.',
        '- **Learn:** blameless postmortem, tracked action items, then back to detect.',
      ],
      keyIdea: 'Measure the three clocks every time: detect, mitigate, recover. Make the biggest one smaller.',
      frames: [{ state: CLOCKS }],
    },
  ],
});
