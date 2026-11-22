import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the SDLC notes on CI, Continuous Delivery and Continuous Deployment. A real pipeline runner executes the stages for the checkout change:
 * the first push fails integration tests, the developer fixes it, the second run passes, then Delivery stops at a manual approval while Deployment goes
 * straight to production. Every stage result and the final state are computed by the runner.
 */

type Stage = 'push' | 'unit' | 'integ' | 'build' | 'staging' | 'approval' | 'prod';
type Mode = 'delivery' | 'deployment';
type Step = { stage: Stage; result: 'pass' | 'fail' | 'wait' | 'approved'; run: number };

function runPipeline(mode: Mode, failOnFirstIntegration: boolean): Step[] {
  const out: Step[] = [];
  let run = 0;
  let broken = failOnFirstIntegration;
  while (true) {
    run++;
    out.push({ stage: 'push', result: 'pass', run });
    out.push({ stage: 'unit', result: 'pass', run });
    if (broken) {
      out.push({ stage: 'integ', result: 'fail', run });
      broken = false; // the developer fixes it and pushes again
      continue;
    }
    out.push({ stage: 'integ', result: 'pass', run });
    out.push({ stage: 'build', result: 'pass', run });
    out.push({ stage: 'staging', result: 'pass', run });
    if (mode === 'delivery') {
      out.push({ stage: 'approval', result: 'wait', run });
      out.push({ stage: 'approval', result: 'approved', run });
    }
    out.push({ stage: 'prod', result: 'pass', run });
    return out;
  }
}
const DELIVERY = runPipeline('delivery', true);
const DEPLOYMENT = runPipeline('deployment', true);

const POS: Record<Stage, { x: number; y: number; label: string; sub: string; kind: FlowNode['kind'] }> = {
  push: { x: 0.1, y: 0.5, label: 'git push', sub: 'trigger', kind: 'client' },
  unit: { x: 1.9, y: 0.5, label: 'Unit tests', sub: 'fast', kind: 'worker' },
  integ: { x: 3.7, y: 0.5, label: 'Integration', sub: 'modules together', kind: 'worker' },
  build: { x: 5.5, y: 0.5, label: 'Build image', sub: 'docker', kind: 'storage' },
  staging: { x: 5.5, y: 2.9, label: 'Staging', sub: 'deploy, smoke test', kind: 'service' },
  approval: { x: 3.7, y: 2.9, label: 'Approval', sub: 'manual gate', kind: 'gateway' },
  prod: { x: 1.9, y: 2.9, label: 'Production', sub: 'live', kind: 'cdn' },
};
const ORDER: Stage[] = ['push', 'unit', 'integ', 'build', 'staging', 'approval', 'prod'];
const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });

const view = (steps: Step[], k: number, mode: Mode, note: FlowState['note']): FlowState => {
  const s = steps[k - 1];
  const prev = steps[k - 2];
  const reached = new Set(steps.slice(0, k).filter((x) => x.run === s.run).map((x) => x.stage));
  const nodes: FlowNode[] = ORDER.map((st): FlowNode => ({
    id: st,
    label: POS[st].label,
    sub: st === 'approval' && mode === 'deployment' ? 'no gate' : POS[st].sub,
    kind: POS[st].kind,
    x: POS[st].x,
    y: POS[st].y,
    status: st === s.stage ? (s.result === 'fail' ? 'down' : s.result === 'wait' ? 'hot' : 'active') : st === 'approval' && mode === 'deployment' ? 'dim' : reached.has(st) ? 'normal' : 'dim',
  }));
  const pk: Packet[] = prev && prev.stage !== s.stage && prev.run === s.run ? [hop(prev.stage, s.stage, s.result === 'fail' ? 'fail' : 'pass', 0, s.result === 'fail' ? 'bad' : 'ok')] : [];
  return {
    nodes,
    links: [
      { from: 'push', to: 'unit' },
      { from: 'unit', to: 'integ' },
      { from: 'integ', to: 'build' },
      { from: 'build', to: 'staging' },
      { from: 'staging', to: 'approval', dashed: mode === 'deployment' },
      { from: 'approval', to: 'prod' },
      ...(mode === 'deployment' ? [{ from: 'staging', to: 'prod', label: 'no gate' }] : []),
      { from: 'integ', to: 'push', dashed: true, label: 'fix' },
    ],
    packets: pk,
    stats: [
      { label: 'Stage', value: POS[s.stage].label },
      { label: 'Result', value: s.result, tone: s.result === 'fail' ? 'bad' : s.result === 'wait' ? 'neutral' : 'ok' },
      { label: 'Pipeline run', value: String(s.run) },
    ],
    note,
  };
};

const idx = (steps: Step[], stage: Stage, result: Step['result'], run?: number) => steps.findIndex((x) => x.stage === stage && x.result === result && (run === undefined || x.run === run)) + 1;

export default defineLesson('flow', {
  slug: 'sdlc-ci-cd',
  objectives: [
    { text: 'What CI runs on every merge', step: 1 },
    { text: 'What a failing stage does', step: 2 },
    { text: 'How Continuous Delivery stops at an approval', step: 3 },
    { text: 'How Continuous Deployment removes the gate', step: 4 },
  ],
  steps: [
    {
      label: 'CI',
      title: 'Every push runs the checks',
      tag: 'problem',
      body: ['**Continuous Integration** builds and tests every change automatically: unit tests, then integration tests, then a build.', 'It catches integration bugs minutes after they are written, not weeks.'],
      keyIdea: 'A PR merge can be in production the same day.',
      frames: [idx(DELIVERY, 'push', 'pass', 1), idx(DELIVERY, 'unit', 'pass', 1)].map((k) => ({ state: view(DELIVERY, k, 'delivery', { text: k === 1 ? 'a developer pushes the checkout change' : 'unit tests pass quickly', tone: 'accent' }), hold: 1800 })),
    },
    {
      label: 'Failure',
      title: 'A broken build stops here',
      tag: 'concept',
      body: ['The integration tests run the double-click scenario and fail. The change goes **back to the developer**.', 'A broken build never reaches production.'],
      keyIdea: 'Any failing stage sends the change back.',
      frames: [idx(DELIVERY, 'integ', 'fail', 1), idx(DELIVERY, 'integ', 'pass', 2)].map((k, i) => ({ state: view(DELIVERY, k, 'delivery', i === 0 ? { text: 'integration tests fail: fix and push again', tone: 'bad' } : { text: 'second run: the fix passes integration tests', tone: 'ok' }), hold: 3000 })),
    },
    {
      label: 'Delivery',
      title: 'Always ready, one click away',
      tag: 'technique',
      body: ['**Continuous Delivery** packages every passing change and deploys it to staging with smoke tests.', 'It then waits at a **manual approval**. Once approved it goes to production.'],
      keyIdea: 'The change is always releasable, a person decides when.',
      frames: [idx(DELIVERY, 'staging', 'pass', 2), idx(DELIVERY, 'approval', 'wait', 2), idx(DELIVERY, 'prod', 'pass', 2)].map((k, i) => ({ state: view(DELIVERY, k, 'delivery', [{ text: 'staging deploy and smoke tests pass', tone: 'ok' as const }, { text: 'the pipeline waits for a human to approve the release', tone: 'accent' as const }, { text: 'approved: deployed to production', tone: 'ok' as const }][i]), hold: 2600 })),
    },
    {
      label: 'Deployment',
      title: 'No gate at all',
      tag: 'in practice',
      body: ['**Continuous Deployment** removes the approval. Every change that passes goes straight to production.', 'It needs strong automated tests and monitoring, since nothing else stands in the way.'],
      keyIdea: 'Delivery keeps the approval, Deployment removes it.',
      frames: [idx(DEPLOYMENT, 'staging', 'pass', 2), idx(DEPLOYMENT, 'prod', 'pass', 2)].map((k, i) => ({ state: view(DEPLOYMENT, k, 'deployment', i === 0 ? { text: 'smoke tests pass and there is no approval step', tone: 'ok' } : { text: 'straight to production with no human gate', tone: 'ok' }), hold: 3200 })),
    },
    {
      label: 'Recap',
      title: 'CI and CD',
      tag: 'recap',
      body: [
        '- **CI:** build and test every merge.',
        '- **Delivery:** always ready to deploy, manual approval.',
        '- **Deployment:** automatic to production.',
        '- **Failures:** go back to the developer.',
        '- **Result:** feedback in minutes, not weeks.',
      ],
      keyIdea: 'Pipelines turn Deployment and Maintenance into a continuous loop.',
      frames: [{ state: view(DEPLOYMENT, DEPLOYMENT.length, 'deployment', { text: `${DELIVERY.length} stage results with a gate, ${DEPLOYMENT.length} without`, tone: 'accent' }) }],
    },
  ],
});
