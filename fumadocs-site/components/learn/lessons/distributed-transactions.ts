import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';

const TPC: SeqActor[] = [
  { id: 'co', label: 'Coordinator', kind: 'gateway' },
  { id: 'a', label: 'Orders DB', kind: 'db' },
  { id: 'b', label: 'Payments DB', kind: 'db' },
];
const SAGA: SeqActor[] = [
  { id: 'o', label: 'Orchestrator', kind: 'gateway' },
  { id: 's1', label: 'Order', kind: 'service' },
  { id: 's2', label: 'Payment', kind: 'service' },
  { id: 's3', label: 'Stock', kind: 'service' },
];

const seq = (actors: SeqActor[], messages: SeqMessage[], stats: SeqState['stats'], note?: SeqState['note'], fresh = 1): SeqState => ({ actors, messages, stats, note, fresh });

const prepare: SeqMessage[] = [
  { from: 'co', to: 'a', label: 'prepare' },
  { from: 'co', to: 'b', label: 'prepare' },
  { from: 'a', to: 'co', label: 'yes, locked', dashed: true, tone: 'ok' },
  { from: 'b', to: 'co', label: 'yes, locked', dashed: true, tone: 'ok' },
];
const commit: SeqMessage[] = [...prepare, { from: 'co', to: 'a', label: 'commit', tone: 'accent' }, { from: 'co', to: 'b', label: 'commit', tone: 'accent' }];

const happy: SeqMessage[] = [
  { from: 'o', to: 's1', label: 'create order' },
  { from: 'o', to: 's2', label: 'charge card' },
  { from: 'o', to: 's3', label: 'reserve stock' },
  { from: 's3', to: 'o', label: 'done', dashed: true, tone: 'ok' },
];
const fail: SeqMessage[] = [
  { from: 'o', to: 's1', label: 'create order' },
  { from: 'o', to: 's2', label: 'charge card' },
  { from: 'o', to: 's3', label: 'reserve stock' },
  { from: 's3', to: 'o', label: 'out of stock', dashed: true, tone: 'bad' },
  { from: 'o', to: 's2', label: 'refund (compensate)', tone: 'accent' },
  { from: 'o', to: 's1', label: 'cancel order (compensate)', tone: 'accent' },
];

export default defineLesson('sequence', {
  slug: 'distributed-transactions',
  objectives: [
    { text: 'How two-phase commit works', step: 2 },
    { text: 'Why 2PC blocks when the coordinator dies', step: 3 },
    { text: 'Run a saga and compensate on failure', step: 5 },
    { text: 'Orchestration vs choreography', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'One action, several databases',
      tag: 'problem',
      body: ['Placing an order touches orders, payments and stock, owned by different services and databases.', 'A normal local transaction cannot span them, so a failure halfway leaves the data inconsistent.'],
      keyIdea: 'You need either one atomic commit across systems (2PC) or a way to undo (saga).',
      frames: [{ state: seq(SAGA, happy.slice(0, 3), [{ label: 'Databases', value: '3' }, { label: 'Local txn', value: 'cannot span', tone: 'bad' }, { label: 'Options', value: '2PC / saga' }], { text: 'what if step 3 fails?', tone: 'bad' }, 3) }],
    },
    {
      label: '2PC',
      title: 'Prepare, then commit',
      tag: 'technique',
      body: ['**Phase 1, prepare:** every participant durably promises it can commit and holds its locks.', '**Phase 2, commit:** if all said yes, the coordinator tells everyone to commit. One no means abort for all.'],
      keyIdea: 'Two-phase commit gives atomicity across databases, at the price of holding locks while waiting.',
      frames: [
        { state: seq(TPC, prepare, [{ label: 'Phase', value: '1 prepare' }, { label: 'Locks', value: 'held', tone: 'bad' }, { label: 'Votes', value: '2 / 2 yes', tone: 'ok' }], undefined, 4), hold: 3500 },
        { state: seq(TPC, commit, [{ label: 'Phase', value: '2 commit' }, { label: 'Locks', value: 'released', tone: 'ok' }, { label: 'Result', value: 'atomic', tone: 'ok' }], undefined, 2) },
      ],
    },
    {
      label: 'Blocking',
      title: 'If the coordinator dies',
      tag: 'trade-off',
      body: ['The coordinator crashes after prepare. Participants promised to commit, so they cannot decide alone.', 'They sit holding locks until it recovers. That is the **blocking problem**.'],
      keyIdea: 'Fine inside one database engine or with a replicated coordinator (Spanner). Rarely used across independent microservices.',
      frames: [{ state: seq([{ ...TPC[0], status: 'down', badge: { text: 'crashed', tone: 'bad' } }, { ...TPC[1], badge: { text: 'locks held', tone: 'bad' } }, { ...TPC[2], badge: { text: 'locks held', tone: 'bad' } }], prepare, [{ label: 'Participants', value: 'stuck', tone: 'bad' }, { label: 'Locks', value: 'held', tone: 'bad' }, { label: 'Fix', value: 'wait for recovery' }], { text: 'prepared and waiting: nobody can proceed', tone: 'bad' }, 1) }],
    },
    {
      label: 'Saga',
      title: 'A chain of local transactions',
      tag: 'technique',
      body: ['A **saga** runs one local transaction per service, in order. Each commits at once, so no long locks are held.', 'If every step succeeds, you are done.'],
      keyIdea: 'Sagas trade isolation for availability: intermediate states are visible to other readers.',
      frames: [1, 2, 3, 4].map((n) => ({ state: seq(SAGA, happy.slice(0, n), [{ label: 'Locks', value: 'none held', tone: 'ok' }, { label: 'Steps done', value: `${Math.min(n, 3)} / 3` }, { label: 'Outcome', value: n === 4 ? 'success' : 'running', tone: n === 4 ? 'ok' : 'neutral' }]), hold: 1400 })),
    },
    {
      label: 'Compensate',
      title: 'On failure, undo the earlier steps',
      tag: 'technique',
      body: ['Stock is gone. The saga runs **compensating transactions** in reverse: refund the card, cancel the order.', 'Every step needs a compensation, and both must be idempotent because they can be retried.'],
      keyIdea: 'Some steps cannot be undone, such as sending an email. Put them last, after the pivot point.',
      frames: [4, 5, 6].map((n) => ({ state: seq(SAGA, fail.slice(0, n), [{ label: 'Failed at', value: 'step 3', tone: 'bad' }, { label: 'Undo', value: n > 4 ? 'running' : 'pending' }, { label: 'End state', value: n === 6 ? 'consistent' : '-', tone: n === 6 ? 'ok' : 'neutral' }]), hold: 1800 })),
    },
    {
      label: 'Recap',
      title: 'Choose your style',
      tag: 'recap',
      body: [
        '- **2PC:** atomic, but blocks if the coordinator dies. Keep it inside one engine.',
        '- **Saga:** local transactions plus compensations, no long locks.',
        '- **Orchestration:** a central coordinator drives the flow. Clear and easy to monitor.',
        '- **Choreography:** services react to events. Loose, but the flow is hard to see.',
        '- **Also:** TCC (try, confirm, cancel), or keep related data in one service.',
      ],
      keyIdea: 'Track saga state durably. For complex flows use a workflow engine such as Temporal or Step Functions.',
      frames: [{ state: seq(SAGA, happy, [{ label: 'Default', value: 'saga' }, { label: 'Hide state', value: 'PENDING status' }, { label: 'Engine', value: 'Temporal' }], undefined, 4) }],
    },
  ],
});
