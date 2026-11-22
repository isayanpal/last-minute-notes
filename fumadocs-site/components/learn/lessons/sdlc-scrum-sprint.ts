import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the SDLC notes on Scrum: a 2-week sprint, a commitment of 20 story points, daily standups, a review and a retrospective. The burndown is
 * computed from story completions. The five stories (5, 3, 8, 2, 2 points) and the days they finish are EXAMPLE values that sum to the notes' 20.
 */

type Story = { name: string; points: number; doneOnDay: number };
const STORIES: Story[] = [
  { name: 'S1', points: 5, doneOnDay: 3 },
  { name: 'S2', points: 3, doneOnDay: 5 },
  { name: 'S3', points: 8, doneOnDay: 8 },
  { name: 'S4', points: 2, doneOnDay: 9 },
  { name: 'S5', points: 2, doneOnDay: 10 },
];
const COMMIT = STORIES.reduce((a, s) => a + s.points, 0);
const DAYS = 10;
const remaining = (day: number) => COMMIT - STORIES.filter((s) => s.doneOnDay <= day).reduce((a, s) => a + s.points, 0);
const ideal = (day: number) => Math.round((COMMIT * (DAYS - day)) / DAYS);
const BURN = Array.from({ length: DAYS + 1 }, (_, d) => remaining(d));
const IDEAL = Array.from({ length: DAYS + 1 }, (_, d) => ideal(d));

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const plan = (): ArrayState => ({
  rows: [{ label: 'story pts', cells: STORIES.map((s) => s.points), bars: true, states: paint(5, () => 'visited'), pointers: STORIES.map((s, i) => ({ i, label: s.name })), showIndex: false }],
  stats: [
    { label: 'Stories', value: String(STORIES.length) },
    { label: 'Committed', value: `${COMMIT} points`, tone: 'ok' },
    { label: 'Sprint', value: '2 weeks' },
  ],
  note: { text: `sprint planning: the team commits to ${COMMIT} story points from the top of the backlog`, tone: 'accent' },
});

const burndown = (day: number, note: ArrayState['note']): ArrayState => ({
  rows: [
    { label: 'remaining', cells: BURN.map((v, d) => (d <= day ? v : '')), bars: true, states: paint(DAYS + 1, (d) => (d === day ? 'active' : d < day ? 'visited' : 'dim')), pointers: [{ i: day, label: `day ${day}` }], showIndex: true },
  ],
  stats: [
    { label: 'Day', value: `${day} of ${DAYS}` },
    { label: 'Points left', value: String(BURN[day]), tone: BURN[day] <= IDEAL[day] ? 'ok' : 'bad' },
    { label: 'Ideal line', value: String(IDEAL[day]) },
  ],
  note,
});

export default defineLesson('array', {
  slug: 'sdlc-scrum-sprint',
  objectives: [
    { text: 'What sprint planning commits to', step: 1 },
    { text: 'What the daily standup is for', step: 2 },
    { text: 'How a burndown shows progress', step: 3 },
    { text: 'What review and retrospective add', step: 4 },
  ],
  steps: [
    {
      label: 'Planning',
      title: 'Commit to a slice',
      tag: 'problem',
      body: ['**Scrum** works in fixed-length **sprints**, usually 2 weeks. The Product Owner orders the backlog and the team commits to what fits.', 'This sprint commits to 20 story points.'],
      keyIdea: 'The Product Owner owns priority, the Scrum Master removes blockers.',
      frames: [{ state: plan(), hold: 4400 }],
    },
    {
      label: 'Standup',
      title: 'Fifteen minutes a day',
      tag: 'concept',
      body: ['Every day the team holds a 15-minute **standup** to share progress and blockers.', 'Between standups they build and test the increment.'],
      keyIdea: 'The standup is a sync point, not a status report to management.',
      frames: [{ state: burndown(0, { text: 'day 0: all 20 points remain', tone: 'accent' }), hold: 2800 }, { state: burndown(3, { text: 'S1 (5 points) finished on day 3: 15 remain', tone: 'ok' }), hold: 3000 }],
    },
    {
      label: 'Burndown',
      title: 'Points left each day',
      tag: 'technique',
      body: ['A **burndown** plots the points still open. It falls in steps as stories finish.', 'Staying near the ideal line means the sprint is on track.'],
      keyIdea: 'A flat line for days is a conversation for the next standup.',
      frames: [{ state: burndown(5, { text: 'S2 finished on day 5: 12 points remain, ideal is 10', tone: 'bad' }), hold: 2800 }, { state: burndown(8, { text: 'S3 (8 points) lands on day 8: 4 remain', tone: 'ok' }), hold: 3000 }, { state: burndown(10, { text: 'day 10: everything finished, a working increment', tone: 'ok' }), hold: 3400 }],
    },
    {
      label: 'Review, retro',
      title: 'Demo, then improve',
      tag: 'in practice',
      body: ['The **sprint review** demos the increment to stakeholders. The **retrospective** is about the process, for example slow code review turnaround.', 'Then the next sprint starts from planning.'],
      keyIdea: 'Review improves the product, retro improves the team.',
      frames: [{ state: burndown(10, { text: 'review: demo the checkout feature. retro: code review was too slow', tone: 'accent' }), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'One Scrum sprint',
      tag: 'recap',
      body: [
        '- **Roles:** Product Owner, Scrum Master, team.',
        '- **Ceremonies:** planning, standup, review, retrospective.',
        '- **Sprint:** fixed length, usually 2 weeks.',
        '- **Commitment:** story points from the backlog.',
        '- **Burndown:** remaining points per day.',
      ],
      keyIdea: 'Scrum fits product teams with a stable roadmap.',
      frames: [{ state: burndown(10, { text: `${COMMIT} points committed, ${COMMIT - BURN[10]} delivered`, tone: 'ok' }) }],
    },
  ],
});
