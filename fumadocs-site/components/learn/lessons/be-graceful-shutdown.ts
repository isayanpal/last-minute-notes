import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Follows the Deployment and Runtime notes: SIGTERM then SIGKILL after the grace period, endpoint removal is asynchronous,
 * a preStop sleep covers the race, liveness must stay shallow, and workers finish their current job.
 */

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };

function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

type Tone = 'ok' | 'bad' | 'accent';
const trio = (app?: string, appTone: Tone = 'accent', lb?: string, lbTone: Tone = 'accent', status?: SeqActor['status']): SeqActor[] => [
  { id: 'k', label: 'Orchestrator', kind: 'gateway' },
  { id: 'l', label: 'Load balancer', kind: 'lb', badge: lb ? { text: lb, tone: lbTone } : undefined },
  { id: 'a', label: 'App', kind: 'service', status, badge: app ? { text: app, tone: appTone } : undefined },
];

// Step 1: a hard kill drops whatever was running.
const killFrames = reveal(trio(), [
  { msgs: [{ from: 'l', to: 'a', label: 'POST /report (slow)' }], hold: 1600, stats: [{ label: 'Deploy', value: 'starts' }, { label: 'In flight', value: '1 request' }, { label: 'Signal', value: 'none yet' }] },
  {
    msgs: [{ from: 'k', to: 'a', label: 'SIGKILL', tone: 'bad' }, { from: 'a', to: 'l', label: 'response', dashed: true, lost: true, tone: 'bad' }],
    actors: trio('killed', 'bad', undefined, 'accent', 'down'),
    hold: 3000,
    stats: [{ label: 'SIGKILL', value: 'cannot handle', tone: 'bad' }, { label: 'Request', value: 'dropped', tone: 'bad' }, { label: 'User sees', value: '502', tone: 'bad' }],
    note: { text: 'every deploy would drop in-flight work', tone: 'bad' },
  },
]);

// Step 2: SIGTERM first, SIGKILL only after the grace period.
const termStats: Stat[] = [
  { label: 'Order', value: 'SIGTERM, wait' },
  { label: 'Then', value: 'SIGKILL' },
  { label: 'Grace', value: 'configurable' },
];
const termFrames = reveal(trio(), [
  { msgs: [{ from: 'k', to: 'a', label: 'SIGTERM' }], actors: trio('draining', 'accent'), hold: 1700, stats: termStats, note: { text: 'a signal the app can catch and act on', tone: 'accent' } },
  { msgs: [{ from: 'a', to: 'a', label: 'drain' }], actors: trio('draining', 'accent'), hold: 1700, stats: termStats },
  { msgs: [{ from: 'a', to: 'k', label: 'exit 0', dashed: true, tone: 'ok' }], actors: trio('exited cleanly', 'ok'), hold: 2800, stats: termStats, note: { text: 'terminationGracePeriodSeconds is the deadline, not the plan', tone: 'ok' } },
]);

// Step 3: endpoint removal is asynchronous, so the LB can still send a request to a closed listener.
const raceFrames = reveal(trio(), [
  {
    msgs: [{ from: 'k', to: 'a', label: 'SIGTERM' }, { from: 'k', to: 'l', label: 'remove pod (async)' }],
    actors: trio('listener closed', 'bad', 'not updated yet', 'bad'),
    hold: 2200,
    stats: [{ label: 'Both happen', value: 'in parallel' }, { label: 'LB update', value: 'lags', tone: 'bad' }, { label: 'App', value: 'already closed' }],
  },
  { msgs: [{ from: 'l', to: 'a', label: 'new request', lost: true, tone: 'bad' }], actors: trio('listener closed', 'bad', 'not updated yet', 'bad'), hold: 2400, stats: [{ label: 'Request', value: 'refused', tone: 'bad' }, { label: 'Cause', value: 'race' }, { label: 'Fix', value: 'preStop sleep' }], note: { text: 'the LB did not know yet and sent traffic to a closed port', tone: 'bad' } },
  {
    msgs: [{ from: 'k', to: 'a', label: 'preStop: sleep 5 s', tone: 'ok' }, { from: 'l', to: 'l', label: 'pod removed', tone: 'ok' }, { from: 'k', to: 'a', label: 'then SIGTERM', tone: 'ok' }],
    actors: trio('still listening', 'ok', 'updated', 'ok'),
    hold: 3000,
    stats: [{ label: 'Sleep first', value: 'LB catches up', tone: 'ok' }, { label: 'Then', value: 'SIGTERM' }, { label: 'Requests lost', value: 'none', tone: 'ok' }],
    note: { text: 'give the load balancer time to stop routing before you close', tone: 'ok' },
  },
]);

// Step 4: the drain sequence inside the app.
const drainStats = (n: string): Stat[] => [
  { label: 'Step', value: n },
  { label: 'Deadline', value: '< grace period' },
  { label: 'Safety', value: 'force exit' },
];
const APP: SeqActor[] = [
  { id: 'k', label: 'Orchestrator', kind: 'gateway' },
  { id: 'a', label: 'App', kind: 'service' },
  { id: 'd', label: 'Database', kind: 'db' },
];
const drainFrames = reveal(APP, [
  { msgs: [{ from: 'k', to: 'a', label: 'SIGTERM' }, { from: 'a', to: 'a', label: '/readyz returns 503', tone: 'accent' }], hold: 2000, stats: drainStats('1 not ready') },
  { msgs: [{ from: 'a', to: 'a', label: 'server.close()', tone: 'accent' }], hold: 1600, stats: drainStats('2 stop new') },
  { msgs: [{ from: 'a', to: 'a', label: 'finish in-flight', tone: 'accent' }], hold: 1700, stats: drainStats('3 finish work') },
  { msgs: [{ from: 'a', to: 'd', label: 'close pool, flush logs' }], hold: 1700, stats: drainStats('4 close pool') },
  { msgs: [{ from: 'a', to: 'k', label: 'exit 0', dashed: true, tone: 'ok' }], hold: 2800, stats: drainStats('5 exit'), note: { text: 'idle keep-alive sockets close, in-flight ones are allowed to finish', tone: 'ok' } },
]);

// Step 5: probes. A liveness check that calls the database turns a blip into an outage.
const KUBE: SeqActor[] = [
  { id: 'k', label: 'Kubelet', kind: 'gateway' },
  { id: 'a', label: 'App pods', kind: 'service' },
  { id: 'd', label: 'Database', kind: 'db', status: 'down', badge: { text: 'brief outage', tone: 'bad' } },
];
const probeFrames = reveal(KUBE, [
  {
    msgs: [{ from: 'k', to: 'a', label: 'liveness' }, { from: 'a', to: 'd', label: 'SELECT 1', lost: true, tone: 'bad' }],
    hold: 2200,
    stats: [{ label: 'Liveness checks', value: 'the database', tone: 'bad' }, { label: 'DB', value: 'blips' }, { label: 'Every pod', value: 'fails', tone: 'bad' }],
  },
  { msgs: [{ from: 'k', to: 'a', label: 'restart all pods', tone: 'bad' }], hold: 2600, stats: [{ label: 'Result', value: 'full outage', tone: 'bad' }, { label: 'Cause', value: 'deep liveness' }, { label: 'Fix', value: 'shallow probe' }], note: { text: 'a dependency blip became a restart loop', tone: 'bad' } },
]);
const shallowFrames = reveal(KUBE, [
  { msgs: [{ from: 'k', to: 'a', label: 'liveness: process ok', tone: 'ok' }], hold: 2000, stats: [{ label: 'Liveness', value: 'process only', tone: 'ok' }, { label: 'Fail means', value: 'restart' }, { label: 'Startup probe', value: 'slow boot' }] },
  { msgs: [{ from: 'k', to: 'a', label: 'readiness: no dependency', tone: 'bad' }], hold: 3000, stats: [{ label: 'Readiness', value: 'can serve now' }, { label: 'Fail means', value: 'no traffic' }, { label: 'Restart', value: 'no', tone: 'ok' }], note: { text: 'readiness removes pods from rotation without restarting them', tone: 'ok' } },
]);

// Step 6: workers finish the current job, and crashes still happen with no signal at all.
const WORK: SeqActor[] = [
  { id: 'w', label: 'Worker', kind: 'worker' },
  { id: 'b', label: 'Broker', kind: 'queue' },
];
const workerFrames = reveal(WORK, [
  { msgs: [{ from: 'w', to: 'w', label: 'SIGTERM: stop pulling', tone: 'accent' }], hold: 1800, stats: [{ label: 'New jobs', value: 'none taken' }, { label: 'Current job', value: 'finishes', tone: 'ok' }, { label: 'Then', value: 'ack and exit' }] },
  { msgs: [{ from: 'w', to: 'b', label: 'ack job 5', dashed: true, tone: 'ok' }], hold: 1800, stats: [{ label: 'Ack', value: 'after success', tone: 'ok' }, { label: 'Lost jobs', value: '0', tone: 'ok' }, { label: 'Exit', value: 'clean' }] },
  { msgs: [{ from: 'w', to: 'w', label: 'OOM kill, no signal', tone: 'bad' }, { from: 'b', to: 'w', label: 'redeliver job 6', tone: 'accent' }], hold: 3200, stats: [{ label: 'No SIGTERM', value: 'ever', tone: 'bad' }, { label: 'Safety net', value: 'redelivery' }, { label: 'So', value: 'idempotent', tone: 'ok' }], note: { text: 'graceful shutdown is an optimization, retry-safety is the guarantee', tone: 'ok' } },
]);

export default defineLesson('sequence', {
  slug: 'be-graceful-shutdown',
  objectives: [
    { text: 'Why a hard kill drops in-flight requests', step: 1 },
    { text: 'The SIGTERM then SIGKILL sequence and the grace period', step: 2 },
    { text: 'The race between pod removal and the closing listener', step: 3 },
    { text: 'The five steps of a clean drain', step: 4 },
    { text: 'Why liveness must stay shallow', step: 5 },
    { text: 'How workers shut down and why crashes still need retries', step: 6 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Deploys that drop requests',
      tag: 'problem',
      body: ['Every deploy, scale-down or node drain stops running instances. If the platform just kills the process, in-flight requests and jobs are lost.', '`SIGKILL` cannot be caught, so the app gets no chance to react.'],
      keyIdea: 'Zero-downtime deploys need the app and the platform to cooperate.',
      frames: killFrames,
    },
    {
      label: 'SIGTERM',
      title: 'Ask first, kill later',
      tag: 'concept',
      body: ['Kubernetes sends **`SIGTERM`**, waits up to `terminationGracePeriodSeconds`, then sends **`SIGKILL`**.', 'An app that handles `SIGTERM` can finish work and exit 0. One that ignores it drops everything at the deadline.'],
      keyIdea: 'Treat the grace period as a hard budget for the whole drain.',
      frames: termFrames,
    },
    {
      label: 'The race',
      title: 'The load balancer lags behind',
      tag: 'trade-off',
      body: ['The orchestrator signals the pod and updates the load balancer **in parallel**. Endpoint removal is asynchronous, so new requests can still arrive after the listener closes.', 'Add a short **`preStop` sleep** so the balancer stops routing before the app stops listening.'],
      keyIdea: 'Closing the listener first is the classic cause of 502s during a rollout.',
      frames: raceFrames,
    },
    {
      label: 'Drain',
      title: 'Five steps to a clean exit',
      tag: 'technique',
      body: ['Fail readiness, **stop accepting** connections, **finish in-flight work** within a deadline, close the database pool and flush telemetry, then exit.', 'Use a safety timer that forces exit if draining hangs.'],
      keyIdea: 'In Node use `server.close()`. In Spring Boot set `server.shutdown=graceful`.',
      frames: drainFrames,
    },
    {
      label: 'Probes',
      title: 'Liveness, readiness, startup',
      tag: 'concept',
      body: ['**Liveness** failing restarts the container, **readiness** failing only removes it from traffic, **startup** gives slow boots time.', 'A liveness probe that calls the database turns a brief outage into every pod restarting at once.'],
      keyIdea: 'Liveness asks "is this process stuck?". Readiness asks "can I serve right now?".',
      frames: [...probeFrames, ...shallowFrames],
    },
    {
      label: 'Workers',
      title: 'Jobs and crashes',
      tag: 'in practice',
      body: ['A queue worker stops pulling new messages on `SIGTERM`, finishes its current job, acks it and exits.', 'But a process can also die with no signal at all, such as an OOM kill. Jobs must be safe to retry.'],
      keyIdea: 'Graceful shutdown reduces retries. Idempotent handlers make retries safe.',
      frames: workerFrames,
    },
    {
      label: 'Recap',
      title: 'Zero-downtime checklist',
      tag: 'recap',
      body: [
        '- **Signals:** handle `SIGTERM`, expect `SIGKILL` after the grace period.',
        '- **Race:** `preStop` sleep so the load balancer catches up.',
        '- **Drain:** fail readiness, stop accepting, finish work, close resources, exit.',
        '- **Probes:** shallow liveness, dependency-aware readiness.',
        '- **Workers:** finish the current job, and keep handlers idempotent.',
      ],
      keyIdea: 'Test it: start a slow request, send `SIGTERM`, and confirm new connections are refused while the old one finishes.',
      frames: [drainFrames[drainFrames.length - 1]],
    },
  ],
});
