import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the SDLC notes on Kanban: work is pulled, never pushed, and a WIP limit of 3 caps In Progress. A real board enforces the limit,
 * so the refused pull of the fourth card, the finish, the review and the later successful pull are computed from the board state.
 */

const LIMIT = 3;
class Board {
  todo = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
  progress: string[] = [];
  review: string[] = [];
  done: string[] = [];
  refused = 0;
  pull(): boolean {
    if (this.progress.length >= LIMIT) {
      this.refused++;
      return false; // the limit says finish something first
    }
    this.progress.push(this.todo.shift()!);
    return true;
  }
  toReview(card: string) {
    this.progress = this.progress.filter((c) => c !== card);
    this.review.push(card);
  }
  approve(card: string) {
    this.review = this.review.filter((c) => c !== card);
    this.done.push(card);
  }
  snap() {
    return { todo: [...this.todo], progress: [...this.progress], review: [...this.review], done: [...this.done], refused: this.refused };
  }
}
type Snap = ReturnType<Board['snap']> & { what: string; ok: boolean };
const b = new Board();
const timeline: Snap[] = [];
const rec = (what: string, ok = true) => timeline.push({ ...b.snap(), what, ok });
rec('start');
for (let i = 0; i < 3; i++) {
  b.pull();
  rec(`pull C${i + 1}`);
}
const refused = b.pull();
rec('pull C4', refused);
b.toReview('C1');
rec('C1 to review');
b.approve('C1');
rec('C1 approved');
const later = b.pull();
rec('pull C4', later);

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });

const view = (k: number, note: FlowState['note']): FlowState => {
  const s = timeline[k];
  const wip = s.progress.length;
  const nodes: FlowNode[] = [
    { id: 'todo', label: 'To Do', sub: `${s.todo.length} cards`, kind: 'queue', x: 0.1, y: 1.7, status: 'normal', items: s.todo.slice(0, 4) },
    { id: 'prog', label: 'In Progress', sub: `WIP limit ${LIMIT}`, kind: 'worker', x: 2.0, y: 1.7, status: wip >= LIMIT ? 'hot' : 'active', items: s.progress, meter: { value: wip / LIMIT, label: `${wip} of ${LIMIT}`, tone: wip >= LIMIT ? 'bad' : 'info' } },
    { id: 'rev', label: 'Review', sub: 'peer review', kind: 'gateway', x: 3.9, y: 1.7, status: 'normal', items: s.review },
    { id: 'done', label: 'Done', sub: 'finished', kind: 'storage', x: 5.7, y: 1.7, status: 'normal', items: s.done },
  ];
  const packets: Packet[] = s.what.startsWith('pull') ? (s.ok ? [hop('todo', 'prog', s.what.slice(5), 0, 'ok')] : [hop('todo', 'prog', 'refused', 0, 'bad')]) : s.what.endsWith('review') ? [hop('prog', 'rev', 'C1', 0, 'data')] : s.what.endsWith('approved') ? [hop('rev', 'done', 'C1', 0, 'ok')] : [];
  return {
    nodes,
    links: [{ from: 'todo', to: 'prog' }, { from: 'prog', to: 'rev' }, { from: 'rev', to: 'done' }, { from: 'rev', to: 'prog', dashed: true }],
    packets,
    stats: [
      { label: 'In Progress', value: `${wip} of ${LIMIT}`, tone: wip >= LIMIT ? 'bad' : 'ok' },
      { label: 'Refused pulls', value: String(s.refused), tone: s.refused ? 'bad' : 'neutral' },
      { label: 'Done', value: String(s.done.length) },
    ],
    note,
  };
};

export default defineLesson('flow', {
  slug: 'sdlc-kanban-wip',
  objectives: [
    { text: 'How a Kanban board shows work', step: 1 },
    { text: 'What pull means', step: 2 },
    { text: 'What the WIP limit does at the limit', step: 3 },
    { text: 'How finishing work frees capacity', step: 4 },
  ],
  steps: [
    {
      label: 'The board',
      title: 'Visualise the flow',
      tag: 'problem',
      body: ['**Kanban** shows work on a board: To Do, In Progress, Review, Done. There are no fixed sprints, work flows continuously.', 'It suits teams whose work arrives unpredictably, like bugs and support.'],
      keyIdea: 'Limit work in progress instead of time.',
      frames: [{ state: view(0, { text: 'six cards waiting, nothing in progress, WIP limit 3', tone: 'accent' }), hold: 3600 }],
    },
    {
      label: 'Pull',
      title: 'Take work when you have room',
      tag: 'concept',
      body: ['Work is **pulled**, never pushed. A card enters In Progress only if the limit allows it.', 'Three pulls fit.'],
      keyIdea: 'The team decides when to start, not the backlog.',
      frames: [1, 2, 3].map((k) => ({ state: view(k, { text: `${timeline[k].what}: ${timeline[k].progress.length} of ${LIMIT} in progress`, tone: 'ok' }), hold: 1700 })),
    },
    {
      label: 'WIP limit',
      title: 'The fourth card waits',
      tag: 'technique',
      body: ['With three cards in progress, a fourth pull is **refused**. The rule says: help finish current work first.', 'That cuts context switching, which is why a cap of about 3 per engineer works.'],
      keyIdea: 'A limit turns a pile of half-done work into finished work.',
      frames: [{ state: view(4, { text: 'pull C4 refused: In Progress is at its limit of 3', tone: 'bad' }), hold: 4200 }],
    },
    {
      label: 'Finish',
      title: 'Done frees a slot',
      tag: 'in practice',
      body: ['C1 goes to review and is approved. That frees a slot in In Progress.', 'Now pulling C4 succeeds.'],
      keyIdea: 'Review that sends changes back to In Progress counts against the limit again.',
      frames: [5, 6, 7].map((k) => ({ state: view(k, k === 5 ? { text: 'C1 moves to review', tone: 'accent' } : k === 6 ? { text: 'approved: C1 is done and a slot opens', tone: 'ok' } : { text: 'pull C4 now succeeds', tone: 'ok' }), hold: k === 7 ? 3600 : 1800 })),
    },
    {
      label: 'Recap',
      title: 'Kanban',
      tag: 'recap',
      body: [
        '- **Board:** To Do, In Progress, Review, Done.',
        '- **Pull:** start only when there is room.',
        '- **WIP limit:** caps In Progress.',
        '- **Continuous flow:** no sprints.',
        '- **Fits:** support and maintenance work.',
      ],
      keyIdea: 'Kanban improves flow by limiting what is in flight.',
      frames: [{ state: view(7, { text: `${timeline[7].refused} pull was refused along the way`, tone: 'accent' }) }],
    },
  ],
});
