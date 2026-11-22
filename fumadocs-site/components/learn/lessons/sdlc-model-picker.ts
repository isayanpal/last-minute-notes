import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the SDLC notes on picking a model. The notes' decision flowchart is implemented as a real function that returns both the model and
 * the path of answers, and it is run on project descriptions, so each recommendation is computed rather than typed in.
 */

type Project = { name: string; fixed: boolean; regulated: boolean; highRisk: boolean; unpredictable: boolean; roadmap: boolean; closeCustomer: boolean };
const P = (name: string, o: Partial<Project>): Project => ({ name, fixed: false, regulated: false, highRisk: false, unpredictable: false, roadmap: false, closeCustomer: false, ...o });

function pick(p: Project): { model: string; path: string[] } {
  const path: string[] = [];
  if (p.fixed) {
    path.push('fixed');
    if (p.regulated) return { model: 'V-Model', path: [...path, 'regulated'] };
    return { model: 'Waterfall', path: [...path, 'plain'] };
  }
  path.push('changing');
  if (p.highRisk) return { model: 'Spiral', path: [...path, 'risky'] };
  path.push('low risk');
  if (p.unpredictable) return { model: 'Kanban', path: [...path, 'ad hoc'] };
  if (p.roadmap) return { model: 'Scrum', path: [...path, 'roadmap'] };
  if (p.closeCustomer) return { model: 'Agile', path: [...path, 'customer'] };
  return { model: 'Iterative', path: [...path, 'no signal'] };
}

const CASES: Project[] = [
  P('Med firmware', { fixed: true, regulated: true }),
  P('Report tool', { fixed: true }),
  P('Trading engine', { highRisk: true }),
  P('Support team', { unpredictable: true }),
  P('Product team', { roadmap: true }),
  P('Startup app', { closeCustomer: true }),
  P('Side project', {}),
];
const RESULTS = CASES.map((c) => ({ c, ...pick(c) }));

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

const view = (i: number, note: FlowState['note']): FlowState => {
  const r = RESULTS[i];
  return {
    nodes: [
      { id: 'p', label: r.c.name, sub: 'the project', kind: 'client', x: 0.1, y: 1.7, status: 'active' },
      { id: 'q', label: 'Decision tree', sub: 'notes, section 4', kind: 'gateway', x: 2.9, y: 1.7, status: 'active', items: r.path.slice(0, 4) },
      { id: 'm', label: r.model, sub: 'recommended', kind: 'service', x: 5.6, y: 1.7, status: 'active' },
    ],
    links: [{ from: 'p', to: 'q' }, { from: 'q', to: 'm' }],
    packets: [hop('p', 'q', 'answers', 0, 'req'), hop('q', 'm', r.model, 0.6, 'ok')],
    stats: [
      { label: 'Project', value: r.c.name },
      { label: 'Answers', value: String(r.path.length) },
      { label: 'Model', value: r.model, tone: 'ok' },
    ],
    note,
  };
};

export default defineLesson('flow', {
  slug: 'sdlc-model-picker',
  objectives: [
    { text: 'Which questions decide the model', step: 1 },
    { text: 'When fixed requirements point to V-Model or Waterfall', step: 2 },
    { text: 'When risk points to Spiral', step: 3 },
    { text: 'How the agile family is chosen', step: 4 },
  ],
  steps: [
    {
      label: 'Questions',
      title: 'Seven models, a few questions',
      tag: 'problem',
      body: ['Waterfall, V-Model, Iterative, Spiral, Agile, Scrum and Kanban all fit somewhere.', 'The deciding questions are how stable the requirements are, how risky the project is, and how work arrives.'],
      keyIdea: 'Ask the stability question first.',
      frames: [{ state: view(6, { text: 'with no strong signal, the fallback is Iterative: build and refine in cycles', tone: 'accent' }), hold: 4000 }],
    },
    {
      label: 'Fixed',
      title: 'Requirements that will not move',
      tag: 'concept',
      body: ['When requirements are fixed and well understood, the choice is between V-Model and Waterfall.', 'Safety-critical or regulated work gets the **V-Model**, where every phase has a matching test level.'],
      keyIdea: 'Medical firmware: fixed by regulation, so V-Model.',
      frames: [{ state: view(0, { text: 'fixed and regulated: V-Model', tone: 'ok' }), hold: 3000 }, { state: view(1, { text: 'fixed but not regulated: plain Waterfall is enough', tone: 'ok' }), hold: 3400 }],
    },
    {
      label: 'Risk',
      title: 'Unknowns first',
      tag: 'technique',
      body: ['When requirements change and the project is large and risky, the **Spiral** model puts risk analysis at the start of every loop.', 'A trading engine that may not handle order bursts is the notes\' example.'],
      keyIdea: 'Settle the biggest unknown while it is still cheap.',
      frames: [{ state: view(2, { text: 'changing and high risk: Spiral', tone: 'ok' }), hold: 3800 }],
    },
    {
      label: 'Agile family',
      title: 'Kanban, Scrum or Agile',
      tag: 'in practice',
      body: ['If work arrives unpredictably, like bugs and support, use **Kanban**. With a stable roadmap and fixed sprints, use **Scrum**.', 'With close customer input and fast feedback, plain **Agile**.'],
      keyIdea: 'Scrum is a specific Agile framework, Kanban is continuous flow.',
      frames: [3, 4, 5].map((i) => ({ state: view(i, { text: `${RESULTS[i].c.name}: ${RESULTS[i].model}`, tone: 'ok' }), hold: 2600 })),
    },
    {
      label: 'Recap',
      title: 'Choosing a model',
      tag: 'recap',
      body: [
        '- **Fixed and regulated:** V-Model.',
        '- **Fixed:** Waterfall.',
        '- **High risk:** Spiral.',
        '- **Unpredictable inflow:** Kanban.',
        '- **Roadmap, sprints:** Scrum. **Customer feedback:** Agile.',
      ],
      keyIdea: 'No model is best, each fits a kind of uncertainty.',
      frames: [{ state: view(4, { text: 'a product team with a stable roadmap and sprints: Scrum', tone: 'ok' }) }],
    },
  ],
});
