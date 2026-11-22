import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Follows the SDLC notes on Waterfall, Iterative and Agile. The same project is scheduled three ways and the schedule functions compute when
 * working software first exists and how much work is built on a wrong requirement. All durations (in weeks) are EXAMPLE values.
 */

type Phase = { name: string; weeks: number; tone: TimelineBar['tone'] };
type Model = { label: string; bars: TimelineBar[]; end: number; firstWorking: number; discoveredAt: number };

const bar = (id: string, from: number, weeks: number, label: string, tone: TimelineBar['tone']): TimelineBar => ({ id, from, to: from + weeks, label, tone });

const waterfall = (): Model => {
  const phases: Phase[] = [{ name: 'req', weeks: 2, tone: 'neutral' }, { name: 'design', weeks: 2, tone: 'violet' }, { name: 'build', weeks: 6, tone: 'req' }, { name: 'test', weeks: 2, tone: 'ok' }, { name: 'ship', weeks: 1, tone: 'data' }];
  let t = 0;
  const bars = phases.map((p) => {
    const b = bar(`w-${p.name}`, t, p.weeks, p.name, p.tone);
    t += p.weeks;
    return b;
  });
  // a wrong requirement is only noticed when design cannot be completed: end of the design phase
  return { label: 'Waterfall', bars, end: t, firstWorking: t, discoveredAt: phases[0].weeks + phases[1].weeks };
};
const iterative = (): Model => {
  const bars: TimelineBar[] = [];
  let t = 0;
  for (let i = 1; i <= 3; i++) {
    bars.push(bar(`i-${i}`, t, 4, `iteration ${i}`, i === 1 ? 'ok' : 'info'));
    t += 4;
  }
  return { label: 'Iterative', bars, end: t, firstWorking: 4, discoveredAt: 4 };
};
const agile = (): Model => {
  const bars: TimelineBar[] = [];
  let t = 0;
  for (let i = 1; i <= 6; i++) {
    bars.push(bar(`a-${i}`, t, 2, `S${i}`, i === 1 ? 'ok' : 'info'));
    t += 2;
  }
  return { label: 'Agile', bars, end: t, firstWorking: 2, discoveredAt: 2 };
};
const W = waterfall();
const I = iterative();
const A = agile();

const view = (models: Model[], markers: boolean, note: TimelineState['note'], stats: TimelineState['stats']): TimelineState => ({
  from: 0,
  to: 14,
  unit: 'wk',
  ticks: [0, 4, 8, 12],
  lanes: models.map((m) => ({ label: m.label, bars: m.bars })),
  markers: markers ? models.map((m) => ({ at: m.firstWorking, label: `${m.label.slice(0, 4)} ${m.firstWorking}`, tone: 'accent' as const })) : undefined,
  stats,
  note,
});

export default defineLesson('timeline', {
  slug: 'sdlc-waterfall-vs-agile',
  objectives: [
    { text: 'When Waterfall delivers its first working software', step: 1 },
    { text: 'How iterations deliver earlier', step: 2 },
    { text: 'How short Agile sprints shorten feedback further', step: 3 },
    { text: 'What a wrong requirement costs in each', step: 4 },
  ],
  steps: [
    {
      label: 'Waterfall',
      title: 'Everything in order',
      tag: 'problem',
      body: ['**Waterfall** finishes each phase before the next starts: requirements, design, implementation, testing, deployment.', 'The durations here are example values, so read the shape.'],
      keyIdea: 'No working software exists until the end.',
      frames: [{ state: view([W], false, { text: `nothing runs until week ${W.firstWorking}, the end of the last phase`, tone: 'bad' }, [{ label: 'First software', value: `week ${W.firstWorking}`, tone: 'bad' }, { label: 'Phases', value: '5 in a row' }, { label: 'Loops back', value: 'none' }]), hold: 4400 }],
    },
    {
      label: 'Iterative',
      title: 'Build in slices',
      tag: 'concept',
      body: ['The **iterative** model repeats plan, build and test for one slice of features at a time.', 'Iteration 1 is login only, but it is usable and testable.'],
      keyIdea: 'Each iteration ends with a working, if incomplete, increment.',
      frames: [{ state: view([W, I], true, { text: `iteration 1 gives working software at week ${I.firstWorking}`, tone: 'ok' }, [{ label: 'First software', value: `week ${I.firstWorking}`, tone: 'ok' }, { label: 'Waterfall', value: `week ${W.firstWorking}` }, { label: 'Iterations', value: '3' }]), hold: 4400 }],
    },
    {
      label: 'Agile',
      title: 'Short sprints',
      tag: 'technique',
      body: ['**Agile** delivers working software every 1 to 4 weeks, with the customer in the loop and a plan that is expected to change.', 'Two-week sprints give the first feedback at week 2.'],
      keyIdea: 'Feedback from working software flows straight back into the backlog.',
      frames: [{ state: view([W, I, A], true, { text: `first feedback at week ${A.firstWorking} instead of ${W.firstWorking}`, tone: 'ok' }, [{ label: 'First software', value: `week ${A.firstWorking}`, tone: 'ok' }, { label: 'Sprint', value: '2 weeks' }, { label: 'Sprints', value: '6' }]), hold: 4600 }],
    },
    {
      label: 'Wrong need',
      title: 'What a mistake costs',
      tag: 'trade-off',
      body: [`A requirement that is wrong is noticed when someone uses the software. In Waterfall that is after ${W.discoveredAt} weeks of design built on it.`, `With 2-week sprints the same mistake costs at most ${A.discoveredAt} weeks.`],
      keyIdea: 'Waterfall is costly when a requirement turns out wrong, which is why it needs stable requirements.',
      frames: [{ state: view([W, A], false, { text: `found at week ${W.discoveredAt} in Waterfall, ${A.discoveredAt} in Agile`, tone: 'bad' }, [{ label: 'Work at risk, W', value: `${W.discoveredAt} weeks`, tone: 'bad' }, { label: 'Work at risk, A', value: `${A.discoveredAt} weeks`, tone: 'ok' }, { label: 'Fits', value: 'stable needs' }]), hold: 4600 }],
    },
    {
      label: 'Recap',
      title: 'Models and feedback',
      tag: 'recap',
      body: [
        '- **Waterfall:** sequential, no software until the end.',
        '- **Iterative:** usable increments each cycle.',
        '- **Agile:** weekly feedback, adaptive plan.',
        '- **Trade-off:** flexibility against predictability.',
        '- **Choose** by how stable the requirements are.',
      ],
      keyIdea: 'Shorter loops find mistakes while they are cheap.',
      frames: [{ state: view([W, I, A], true, { text: `first working software: week ${W.firstWorking}, ${I.firstWorking} and ${A.firstWorking}`, tone: 'accent' }, [{ label: 'Waterfall', value: `week ${W.firstWorking}`, tone: 'bad' }, { label: 'Iterative', value: `week ${I.firstWorking}` }, { label: 'Agile', value: `week ${A.firstWorking}`, tone: 'ok' }]) }],
    },
  ],
});
