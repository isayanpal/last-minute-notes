import { defineLesson } from '../define';
import type { TimelineBar, TimelineState } from '../engines/timeline';

/*
 * Durations and percentages are illustrative. The facts from the notes are the ORDER of stages,
 * the "under about 10 minutes" feedback target, backend-first deploys and mitigate-before-investigate.
 */

const bar = (id: string, from: number, to: number, label: string, extra: Partial<TimelineBar> = {}): TimelineBar => ({ id, from, to, label, ...extra });
const ILLUSTRATIVE = { text: 'illustrative numbers, the order is the point', tone: 'neutral' as const };

// Step 1: the testing trophy. Bar length is relative effort, not minutes.
const TROPHY: TimelineState = {
  from: 0,
  to: 10,
  unit: '',
  ticks: [],
  lanes: [
    { label: 'Static', bars: [bar('s', 0, 3, 'TypeScript, lint', { tone: 'info' })] },
    { label: 'Unit', bars: [bar('u', 0, 4, 'pure logic', { tone: 'ok' })] },
    { label: 'Integration', bars: [bar('i', 0, 9, 'components + state, mock network (MSW)', { tone: 'accent', state: 'active' })] },
    { label: 'End-to-end', bars: [bar('e', 0, 3, 'critical journeys', { tone: 'data' })] },
  ],
  stats: [
    { label: 'Most tests', value: 'integration', tone: 'ok' },
    { label: 'Query by', value: 'role + label' },
    { label: 'E2E', value: 'few, valuable' },
  ],
  note: { text: 'test behavior the user can observe, not implementation', tone: 'accent' },
};

// Step 2: the pipeline, fast feedback first.
const PIPELINE: TimelineState = {
  from: 0,
  to: 14,
  unit: 'm',
  ticks: [0, 2, 4, 6, 8, 10, 12, 14],
  lanes: [
    { label: 'Static checks', bars: [bar('a', 0, 1, 'types, lint', { tone: 'info' })] },
    { label: 'Unit + component', bars: [bar('b', 1, 4, 'tests', { tone: 'ok' })] },
    { label: 'Build + budget', bars: [bar('c', 4, 6, 'bundle size', { tone: 'data' })] },
    { label: 'E2E + visual', bars: [bar('d', 6, 10, 'preview URL', { tone: 'violet' })] },
    { label: 'Canary', bars: [bar('e', 10, 14, 'small %', { tone: 'accent' })] },
  ],
  markers: [{ at: 10, label: 'required checks done', tone: 'ok' }],
  stats: [
    { label: 'Feedback', value: '< ~10 min', tone: 'ok' },
    { label: 'Artifact', value: 'build once' },
    { label: 'Previews', value: 'URL per PR' },
  ],
  note: ILLUSTRATIVE,
};

// Step 3: progressive delivery. Roll out in rings, watch the guardrails.
const rollout = (bad: boolean): TimelineState => ({
  from: 0,
  to: 60,
  unit: 'm',
  ticks: [0, 10, 20, 30, 40, 50, 60],
  lanes: [
    { label: 'Staff ring', bars: [bar('r1a', 0, 12, 'staff', { tone: 'ok' })] },
    { label: 'Canary 5%', bars: [bar('r2', 12, bad ? 24 : 36, bad ? '5%: errors up' : '5%', { tone: bad ? 'bad' : 'ok', state: bad ? 'bad' : 'normal' })] },
    { label: 'Gradual 50%', bars: bad ? [] : [bar('r3', 36, 48, '50%', { tone: 'ok' })] },
    { label: 'Everyone', bars: bad ? [] : [bar('r4', 48, 60, '100%', { tone: 'ok' })] },
    { label: 'Rollback', bars: bad ? [bar('rb', 24, 30, 'auto rollback', { tone: 'accent' })] : [] },
  ],
  markers: bad ? [{ at: 24, label: 'error rate threshold', tone: 'bad' }] : [{ at: 60, label: 'done', tone: 'ok' }],
  stats: [
    { label: 'Bucketing', value: 'cookie/header' },
    { label: 'Guardrails', value: 'errors, vitals', tone: 'ok' },
    { label: 'Result', value: bad ? 'rollback at 5%' : 'full rollout', tone: bad ? 'bad' : 'ok' },
  ],
  note: bad ? { text: 'only 5% of users saw the bug', tone: 'ok' } : ILLUSTRATIVE,
});

// Step 4: version skew. Backend first, frontend second, cleanup last.
const SKEW: TimelineState = {
  from: 0,
  to: 10,
  unit: 'd',
  ticks: [0, 2, 4, 6, 8, 10],
  lanes: [
    { label: 'API', bars: [bar('a1', 0, 2, 'v1', { tone: 'info' }), bar('a2', 2, 8, 'v1 + v2 (additive)', { tone: 'ok' }), bar('a3', 8, 10, 'v2 only', { tone: 'info' })] },
    { label: 'Frontend', bars: [bar('f1', 0, 4, 'v1', { tone: 'info' }), bar('f2', 4, 10, 'v2', { tone: 'ok' })] },
    { label: 'Old tabs', bars: [bar('t', 4, 9, 'v1 client, old tabs', { tone: 'data' })] },
  ],
  markers: [
    { at: 2, label: '1. backend first', tone: 'accent' },
    { at: 4, label: '2. frontend', tone: 'accent' },
    { at: 8, label: '3. remove old paths', tone: 'accent' },
  ],
  stats: [
    { label: 'Order', value: 'API, UI, clean', tone: 'ok' },
    { label: 'API changes', value: 'additive' },
    { label: 'Old chunks', value: 'keep for days' },
  ],
  note: { text: 'both versions must work while old tabs are still open', tone: 'accent' },
};

// Step 5: an incident. Mitigate first, then investigate.
const incident = (phase: 1 | 2): TimelineState => ({
  from: 0,
  to: 40,
  unit: 'm',
  ticks: [0, 10, 20, 30, 40],
  lanes: [
    { label: 'Release 4.12', bars: [bar('rel2', 0, 4, 'ship', { tone: 'info' })] },
    { label: 'Error rate', bars: [bar('err', 4, phase === 1 ? 18 : 24, 'rising', { tone: 'bad', state: 'bad' }), ...(phase === 2 ? [bar('err2', 24, 34, 'recovering', { tone: 'ok' })] : [])] },
    { label: 'Detect', bars: [bar('det', 12, 18, 'RUM alert', { tone: 'accent' })] },
    { label: 'Triage', bars: [bar('tri', 18, 22, 'which release, flag?', { tone: 'violet' })] },
    { label: 'Mitigate', bars: phase === 2 ? [bar('mit', 22, 26, 'flag off or rollback', { tone: 'ok' })] : [] },
    { label: 'Fix forward', bars: phase === 2 ? [bar('fix', 26, 40, 'repro + test + ship', { tone: 'info' })] : [] },
  ],
  markers: phase === 2 ? [{ at: 26, label: 'user impact ends', tone: 'ok' }] : [{ at: 12, label: 'alert fires', tone: 'bad' }],
  stats: [
    { label: 'First move', value: 'mitigate', tone: 'ok' },
    { label: 'Then', value: 'investigate' },
    { label: 'After', value: 'postmortem' },
  ],
  note: phase === 2 ? { text: 'turn off the flag or roll back, then find the cause', tone: 'ok' } : ILLUSTRATIVE,
});

// Step 6: rollback is slower on the web. Users keep old tabs and cached HTML.
const ROLLBACK: TimelineState = {
  from: 0,
  to: 60,
  unit: 'm',
  ticks: [0, 10, 20, 30, 40, 50, 60],
  lanes: [
    { label: 'Rollback issued', bars: [bar('r', 0, 2, 'now', { tone: 'accent' })] },
    { label: 'New page loads', bars: [bar('n', 2, 60, 'get the good version', { tone: 'ok' })] },
    { label: 'Cached HTML', bars: [bar('c', 2, 25, 'TTL expires', { tone: 'data' })] },
    { label: 'Open tabs', bars: [bar('t', 2, 60, 'still run the bad build', { tone: 'bad', state: 'bad' })] },
    { label: 'Version check', bars: [bar('v', 15, 40, 'prompt reload', { tone: 'accent' })] },
  ],
  markers: [{ at: 40, label: 'forced refresh for a critical fix', tone: 'accent' }],
  stats: [
    { label: 'Rollback', value: 'not instant', tone: 'bad' },
    { label: 'Fix', value: 'version check', tone: 'ok' },
    { label: 'Stuck worker', value: 'killing SW' },
  ],
  note: ILLUSTRATIVE,
};

export default defineLesson('timeline', {
  slug: 'fe-release',
  objectives: [
    { text: 'Where tests give the most confidence per cost', step: 1 },
    { text: 'The stages of a fast CI/CD pipeline', step: 2 },
    { text: 'Canary and ring rollouts with automatic rollback', step: 3 },
    { text: 'How to deploy without version skew', step: 4 },
    { text: 'The incident loop and why web rollbacks are slow', step: 5 },
  ],
  steps: [
    {
      label: 'Testing',
      title: 'Mostly integration tests',
      tag: 'concept',
      body: ['The **testing trophy** puts static analysis at the base, a few unit tests, mostly integration (component) tests, and a thin layer of end-to-end tests.', 'Mock the network with MSW, query by role and label, and assert on what the user sees.'],
      keyIdea: '"Write tests, not too many, mostly integration." Integration tests give the highest confidence per cost.',
      frames: [{ state: TROPHY }],
    },
    {
      label: 'Pipeline',
      title: 'Fast feedback, build once',
      tag: 'technique',
      body: ['Static checks, then unit and component tests, then build with a bundle-size check, then E2E and visual tests against a **preview deployment**.', 'Keep required checks under about 10 minutes, and promote the same immutable artifact through environments.'],
      keyIdea: 'Quality gates: types, lint, tests, bundle budgets, Lighthouse CI, accessibility checks, dependency audit, secret scan.',
      frames: [{ state: PIPELINE }],
    },
    {
      label: 'Rollouts',
      title: 'Show it to a few users first',
      tag: 'technique',
      body: ['**Canary** routes a small percentage to the new version. Bucket by cookie or header at the CDN or edge so a user stays on one version.', 'Guardrail metrics (errors, Web Vitals) trigger an automatic rollback.'],
      keyIdea: 'Feature flags ship code dark. Also useful: blue-green, ring deployment, dark launch and a kill switch that works even if the main bundle is broken.',
      frames: [{ state: rollout(false), hold: 2600 }, { state: rollout(true), hold: 3200 }],
    },
    {
      label: 'Skew',
      title: 'Client and server rarely match',
      tag: 'trade-off',
      body: ['**Version skew** is old HTML with deleted assets, new HTML with old cached assets, or old clients calling a changed API.', 'Rule: deploy the backend first with backward compatibility, then the frontend, then remove old paths later.'],
      keyIdea: 'Use content hashing, additive API changes, and keep previous assets for days.',
      frames: [{ state: SKEW }],
    },
    {
      label: 'Incident',
      title: 'Mitigate first, then investigate',
      tag: 'in practice',
      body: ['An alert fires from RUM or error tracking. Triage by release, route, browser or flag, then **turn the flag off or roll back**.', 'Only after that: reproduce, fix with a test, and hold a blameless postmortem with action items.'],
      keyIdea: 'Error tracking needs the release id and uploaded (not public) source maps, so triage takes minutes.',
      frames: [{ state: incident(1), hold: 2200 }, { state: incident(2), hold: 3200 }],
    },
    {
      label: 'Rollback',
      title: 'On the web, rollback is slow',
      tag: 'trade-off',
      body: ['Users keep old tabs and cached HTML, so a rollback does not change what everyone runs right away.', 'A **version check** can prompt "new version available" or force a refresh. A stuck service worker needs an update path, or a killing worker that unregisters itself.'],
      keyIdea: 'Backward-compatible APIs (expand, then contract) let old and new clients coexist during the tail.',
      frames: [{ state: ROLLBACK }],
    },
    {
      label: 'Recap',
      title: 'Ship safely, undo quickly',
      tag: 'recap',
      body: [
        '- **Tests:** static base, mostly integration, few E2E.',
        '- **CI/CD:** under 10 minutes, preview URLs, build once, budgets as gates.',
        '- **Delivery:** flags, canary, rings, automatic rollback on guardrails.',
        '- **Skew:** backend first, additive changes, keep old assets.',
        '- **Incidents:** detect, triage, mitigate, fix forward, postmortem.',
      ],
      keyIdea: 'Name what you would measure (error rate, vitals, conversion) and what would trigger a rollback.',
      frames: [{ state: rollout(true), hold: 3200 }],
    },
  ],
});
