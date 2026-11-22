import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the Next.js notes on the Server Action security model: every action is a public POST endpoint, so authenticate and
 * authorise inside the action. The same deletePost runs three ways and the outcome of each call is computed.
 */

type Session = { userId: string } | null;
type Post = { id: string; authorId: string };
const POSTS: Post[] = [{ id: '42', authorId: 'ana' }];

type Trace = { steps: SeqMessage[]; status: number; deleted: boolean };
const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });

/** The unsafe action: trusts that only the owner can ever press the button. */
function unsafe(postId: string): Trace {
  const post = POSTS.find((p) => p.id === postId);
  return { steps: [m('caller', 'action', `POST deletePost(${postId})`), m('action', 'db', `delete post ${postId}`, 'bad'), m('db', 'caller', 'deleted', 'bad', true)], status: 200, deleted: !!post };
}

/** The safe action: authenticate, then authorise on the resource. */
function safe(session: Session, postId: string): Trace {
  const steps: SeqMessage[] = [m('caller', 'action', `POST deletePost(${postId})`)];
  if (!session) {
    steps.push(m('action', 'caller', '401 no session', 'bad', true));
    return { steps, status: 401, deleted: false };
  }
  const post = POSTS.find((p) => p.id === postId);
  if (!post || post.authorId !== session.userId) {
    steps.push(m('action', 'db', 'load post, check owner', 'req'), m('action', 'caller', '403 not your post', 'bad', true));
    return { steps, status: 403, deleted: false };
  }
  steps.push(m('action', 'db', 'load post, check owner', 'req'), m('action', 'db', `delete post ${postId}`, 'ok'), m('action', 'caller', '200 deleted', 'ok', true));
  return { steps, status: 200, deleted: true };
}

const ANON = unsafe('42');
const NO_SESSION = safe(null, '42');
const STRANGER = safe({ userId: 'bo' }, '42');
const OWNER = safe({ userId: 'ana' }, '42');

const ACTORS: SeqState['actors'] = [
  { id: 'caller', label: 'Caller', kind: 'client' },
  { id: 'action', label: 'Action', kind: 'service' },
  { id: 'db', label: 'Database', kind: 'db' },
];

const view = (t: Trace, n: number, caller: string, check: string, note: SeqState['note'], doneNote: SeqState['note']): SeqState => ({
  actors: ACTORS,
  messages: t.steps.slice(0, n),
  stats: [
    { label: 'Caller', value: caller },
    { label: 'Check', value: check },
    { label: 'Result', value: n >= t.steps.length ? `${t.status}${t.deleted ? ' deleted' : ''}` : '-', tone: n >= t.steps.length ? (t.status === 200 && caller !== 'owner' ? 'bad' : t.status === 200 ? 'ok' : 'ok') : 'neutral' },
  ],
  note: n >= t.steps.length ? doneNote : note,
});

const steps = (t: Trace) => Array.from({ length: t.steps.length }, (_, i) => i + 1);

export default defineLesson('sequence', {
  slug: 'next-server-actions-security',
  objectives: [
    { text: 'Why an action is a public endpoint', step: 1 },
    { text: 'Why the session check belongs inside the action', step: 2 },
    { text: 'Why ownership must be checked on the resource', step: 3 },
    { text: 'What a correct action does', step: 4 },
  ],
  steps: [
    {
      label: 'Public',
      title: 'Hidden button, open endpoint',
      tag: 'problem',
      body: ['A Server Action is an HTTP `POST`. Anyone who learns the action id can call it, whether or not your UI shows a button.', 'This action trusts the UI, so a direct call deletes the post.'],
      keyIdea: 'Hiding a button in the UI is not security.',
      frames: steps(ANON).map((n) => ({ state: view(ANON, n, 'anyone', 'none', { text: 'a direct POST skips the page entirely', tone: 'accent' }, { text: 'no check ran: the post was deleted for an anonymous caller', tone: 'bad' }), hold: n === 3 ? 3800 : 1500 })),
    },
    {
      label: 'Session',
      title: 'Authenticate inside',
      tag: 'technique',
      body: ['Check the session **inside the action**, not only in the page that renders the button.', 'No session means `401`, and nothing reaches the database.'],
      keyIdea: 'Authentication answers who you are, and fails with 401.',
      frames: steps(NO_SESSION).map((n) => ({ state: view(NO_SESSION, n, 'anonymous', 'session', { text: 'the action looks for a session first', tone: 'accent' }, { text: 'no session: rejected before any data access', tone: 'ok' }), hold: 3000 })),
    },
    {
      label: 'Ownership',
      title: 'Authorise on the resource',
      tag: 'trade-off',
      body: ['A signed-in user is not allowed to delete **every** post. Load the post and compare its owner.', 'Skipping this check is the classic IDOR bug, and the answer is `403`.'],
      keyIdea: 'Verify the user may act on this specific resource id, every time.',
      frames: steps(STRANGER).map((n) => ({ state: view(STRANGER, n, 'other user', 'session,owner', { text: 'a valid session is not enough', tone: 'accent' }, { text: 'bo is signed in but does not own post 42: forbidden', tone: 'ok' }), hold: n === 3 ? 3600 : 1500 })),
    },
    {
      label: 'Correct',
      title: 'The owner succeeds',
      tag: 'in practice',
      body: ['With a session and ownership confirmed, the delete runs.', 'Then call `updateTag` or `revalidatePath` so the UI shows the change.'],
      keyIdea: 'Validate input with a schema, and return only what the client needs.',
      frames: steps(OWNER).map((n) => ({ state: view(OWNER, n, 'owner', 'session,owner', { text: 'the owner calls the same action', tone: 'accent' }, { text: 'both checks passed, so the delete is allowed', tone: 'ok' }), hold: n === 4 ? 3800 : 1400 })),
    },
    {
      label: 'Recap',
      title: 'Server Action security',
      tag: 'recap',
      body: [
        '- **Public:** every action is a POST endpoint.',
        '- **Authenticate:** check the session inside the action.',
        '- **Authorise:** check ownership of the specific resource.',
        '- **Validate:** parse input with a schema on the server.',
        '- **Same for Route Handlers:** they are even more exposed.',
      ],
      keyIdea: 'Authentication, authorisation, validation, then the work.',
      frames: [{ state: view(OWNER, 4, 'owner', 'session,owner', { text: '', tone: 'ok' }, { text: 'the order that keeps an action safe: session, owner, then act', tone: 'ok' }) }],
    },
  ],
});
