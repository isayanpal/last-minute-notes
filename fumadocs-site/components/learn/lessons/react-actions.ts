import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the React 19 notes on Actions: useActionState tracks pending, result and error, useFormStatus lets a nested button read
 * pending, and useOptimistic shows the guess at once and reconciles. The optimistic outcome is produced by a small state machine.
 */

type Outcome = { shown: string[]; final: string };
/** Run the optimistic flow: the UI value, then the real value after the server answers. */
function optimistic(initial: string, next: string, ok: boolean): Outcome {
  let name = initial;
  let shown = name;
  const trace: string[] = [];
  shown = next; // setOptimisticName(next)
  trace.push(shown);
  if (ok) name = next; // setName(updated)
  shown = name; // the action ended: the optimistic value is replaced by real state
  trace.push(shown);
  return { shown: trace, final: name };
}
const SUCCESS = optimistic('Ann', 'Sam', true);
const FAILURE = optimistic('Ann', 'Sam', false);

const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });

// Step 1: the hand-written version needs three pieces of state.
const MANUAL = [
  m('form', 'state', 'setPending(true)', 'req'),
  m('form', 'server', 'await updateName()', 'req'),
  m('server', 'form', 'returns an error', 'bad', true),
  m('form', 'state', 'setError(message)', 'req'),
  m('form', 'state', 'setPending(false)', 'req'),
];
const manual = (n: number): SeqState => ({
  actors: [{ id: 'form', label: 'Form', kind: 'client' }, { id: 'state', label: 'useState x3', kind: 'cache' }, { id: 'server', label: 'Server', kind: 'external' }],
  messages: MANUAL.slice(0, n),
  stats: [
    { label: 'useState calls', value: '3' },
    { label: 'setState calls', value: String(MANUAL.slice(0, n).filter((x) => x.to === 'state').length) },
    { label: 'You wrote', value: 'all of it', tone: 'bad' },
  ],
  note: n >= 5 ? { text: 'pending, data and error are all hand-managed, in the right order', tone: 'bad' } : { text: 'every submit needs the same pending and error bookkeeping', tone: 'accent' },
});

// Step 2: useActionState.
const ACTION = [
  m('user', 'form', 'submit the form'),
  m('form', 'action', 'submitAction(prev, data)', 'req'),
  m('action', 'form', 'returns error, or null', 'ok', true),
];
const action = (n: number): SeqState => ({
  actors: [{ id: 'user', label: 'User', kind: 'client' }, { id: 'form', label: 'form action', kind: 'gateway' }, { id: 'action', label: 'Action fn', kind: 'worker' }],
  messages: ACTION.slice(0, n),
  stats: [
    { label: 'isPending', value: n === 1 || n === 2 ? 'true' : n === 3 ? 'false' : '-', tone: n === 2 ? 'ok' : 'neutral' },
    { label: 'Result', value: n >= 3 ? 'error or null' : '-' },
    { label: 'Hand-written', value: 'nothing', tone: 'ok' },
  ],
  note: n >= 3 ? { text: 'React set pending back to false and stored the returned value as state', tone: 'ok' } : { text: 'useActionState returns [state, formAction, isPending] for you', tone: 'accent' },
});

// Step 3: useFormStatus reads the parent form from a nested component.
const STATUS = [
  m('form', 'button', 'pending is true', 'data', true),
  m('form', 'button', 'pending is false', 'ok', true),
];
const status = (n: number): SeqState => ({
  actors: [{ id: 'form', label: 'form', kind: 'gateway' }, { id: 'button', label: 'SubmitButton', kind: 'client' }],
  messages: STATUS.slice(0, n),
  stats: [
    { label: 'Props passed', value: 'none', tone: 'ok' },
    { label: 'Button', value: n === 1 ? 'disabled' : n === 2 ? 'enabled' : '-', tone: n === 1 ? 'bad' : n === 2 ? 'ok' : 'neutral' },
    { label: 'Must be', value: 'inside form' },
  ],
  note: { text: 'useFormStatus must run in a component rendered inside the form', tone: n === 2 ? 'ok' : 'accent' },
});

// Step 4: optimistic updates, success and failure.
const optimisticMessages = (out: Outcome, ok: boolean): SeqMessage[] => [
  m('user', 'form', 'submit "Sam"'),
  m('form', 'user', `UI shows ${out.shown[0]} at once`, 'violet', true),
  m('form', 'server', 'updateName("Sam")', 'req'),
  m('server', 'form', ok ? 'ok: name is Sam' : 'error: update failed', ok ? 'ok' : 'bad', true),
  m('form', 'user', ok ? `real state: ${out.final}` : `reverts to ${out.final}`, ok ? 'ok' : 'bad', true),
];
const SUCCESS_MSGS = optimisticMessages(SUCCESS, true);
const FAILURE_MSGS = optimisticMessages(FAILURE, false);
const optimisticState = (ok: boolean, n: number): SeqState => {
  const out = ok ? SUCCESS : FAILURE;
  return {
    actors: [{ id: 'user', label: 'User', kind: 'client' }, { id: 'form', label: 'Form', kind: 'gateway' }, { id: 'server', label: 'Server', kind: 'external' }],
    messages: (ok ? SUCCESS_MSGS : FAILURE_MSGS).slice(0, n),
    stats: [
      { label: 'Shown at once', value: n >= 2 ? out.shown[0] : '-' },
      { label: 'Server says', value: n >= 4 ? (ok ? 'ok' : 'error') : '-', tone: n >= 4 ? (ok ? 'ok' : 'bad') : 'neutral' },
      { label: 'Final name', value: n >= 5 ? out.final : '-', tone: n >= 5 ? (ok ? 'ok' : 'bad') : 'neutral' },
    ],
    note: n >= 5 ? (ok ? { text: 'the guess was right, and real state now matches it', tone: 'ok' } : { text: 'the action failed: the optimistic value is dropped and the old name shows again', tone: 'bad' }) : { text: 'useOptimistic shows the expected result while the request is in flight', tone: 'accent' },
  };
};

export default defineLesson('sequence', {
  slug: 'react-actions',
  objectives: [
    { text: 'What boilerplate an async form submit needs by hand', step: 1 },
    { text: 'How useActionState tracks pending and result', step: 2 },
    { text: 'How useFormStatus reaches a nested button', step: 3 },
    { text: 'How useOptimistic shows a guess and reconciles', step: 4 },
  ],
  steps: [
    {
      label: 'By hand',
      title: 'Pending, data, error',
      tag: 'problem',
      body: ['A form submit usually needs a `pending` flag, the result and an error, each its own `useState`.', 'You set them in the right order on every path.'],
      keyIdea: 'This is the boilerplate Actions are designed to remove.',
      frames: [1, 2, 3, 4, 5].map((n) => ({ state: manual(n), hold: n === 5 ? 3400 : 1200 })),
    },
    {
      label: 'useActionState',
      title: 'The whole lifecycle in one hook',
      tag: 'concept',
      body: ['`useActionState(fn, initial)` returns `[state, submitAction, isPending]`. Pass `submitAction` to `<form action>`.', 'React tracks pending, the returned value and errors.'],
      keyIdea: 'Actions collapse pending, error and result handling into one hook.',
      frames: [1, 2, 3].map((n) => ({ state: action(n), hold: n === 3 ? 3400 : 1500 })),
    },
    {
      label: 'useFormStatus',
      title: 'A nested button knows',
      tag: 'technique',
      body: ['`useFormStatus()` gives a child its parent form\'s `pending`, with no prop drilling.', 'It must be called in a component rendered inside the form.'],
      keyIdea: 'Put the status-aware button in its own component under the form.',
      frames: [1, 2].map((n) => ({ state: status(n), hold: 2600 })),
    },
    {
      label: 'useOptimistic',
      title: 'Show the guess, then reconcile',
      tag: 'in practice',
      body: ['`useOptimistic` shows the expected value immediately while the request runs.', 'If the action succeeds the real state matches. If it fails, the guess is dropped and the old state shows again.'],
      keyIdea: 'The UI updates immediately, the real result replaces the guess.',
      frames: [...[1, 2, 3, 4, 5].map((n) => ({ state: optimisticState(true, n), hold: n === 5 ? 2600 : 1100 })), { state: optimisticState(false, 4), hold: 1400 }, { state: optimisticState(false, 5), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Actions in React 19',
      tag: 'recap',
      body: [
        '- **Actions:** async functions React manages as a transition.',
        '- **useActionState:** state, action and pending in one hook.',
        '- **useFormStatus:** pending for nested components.',
        '- **useOptimistic:** instant guess, reconciled with the result.',
        '- **Form action:** `<form action={fn}>` wires it together.',
      ],
      keyIdea: 'Prefer Actions over useEffect plus useState for form submissions.',
      frames: [{ state: optimisticState(true, 5) }],
    },
  ],
});
