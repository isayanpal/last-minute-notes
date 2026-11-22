import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the Next.js notes on revalidation: revalidateTag is stale-while-revalidate, updateTag expires immediately
 * (read-your-writes), and webhook endpoints must be authenticated. A small cache model produces what each reader sees.
 */

type Entry = { value: string; stale: boolean };
class Cache {
  entry: Entry = { value: 'v1', stale: false };
  constructor(private db: { value: string }) {}
  /** revalidateTag(tag, 'max'): mark stale, keep serving it. */
  revalidateTag() {
    this.entry.stale = true;
  }
  /** updateTag(tag): expire now, the next read must go to the database. */
  updateTag() {
    this.entry = { value: '', stale: true };
  }
  read(): { seen: string; refreshed: boolean } {
    if (this.entry.value === '') {
      this.entry = { value: this.db.value, stale: false };
      return { seen: this.entry.value, refreshed: true };
    }
    if (this.entry.stale) {
      const seen = this.entry.value;
      this.entry = { value: this.db.value, stale: false }; // refreshed in the background
      return { seen, refreshed: true };
    }
    return { seen: this.entry.value, refreshed: false };
  }
}

const authenticate = (secret: string, expected = 'whsec') => (secret === expected ? 200 : 401);

const db = { value: 'v2' }; // the author already saved v2

const cA = new Cache(db);
const plainRead = cA.read();

const cB = new Cache(db);
cB.revalidateTag();
const swr1 = cB.read();
const swr2 = cB.read();

const cC = new Cache(db);
cC.updateTag();
const authorRead = cC.read();

const cD = new Cache(db);
const badHook = authenticate('guess');
const goodHook = authenticate('whsec');
if (goodHook === 200) cD.revalidateTag();
const hookRead = cD.read();

const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });
const A4: SeqState['actors'] = [
  { id: 'author', label: 'Author', kind: 'client' },
  { id: 'cache', label: 'Cache', kind: 'cache' },
  { id: 'visitor', label: 'Visitor', kind: 'client' },
  { id: 'db', label: 'DB', kind: 'db' },
];

const stale = (): SeqState => ({
  actors: A4,
  messages: [m('author', 'db', 'save title v2', 'req'), m('visitor', 'cache', 'read page'), m('cache', 'visitor', `serves ${plainRead.seen}`, 'bad', true)],
  stats: [
    { label: 'Database', value: db.value, tone: 'ok' },
    { label: 'Cache', value: plainRead.seen, tone: 'bad' },
    { label: 'Visitor sees', value: plainRead.seen, tone: 'bad' },
  ],
  note: { text: 'the mutation reached the database but nothing told the cache: the page is stale', tone: 'bad' },
});

const swrMessages = [
  m('author', 'cache', 'revalidateTag', 'req'),
  m('visitor', 'cache', 'read page'),
  m('cache', 'visitor', `serves ${swr1.seen} (stale)`, 'data', true),
  m('cache', 'db', 'refresh in background', 'req'),
  m('db', 'cache', `new value ${db.value}`, 'ok', true),
  m('visitor', 'cache', 'read again'),
  m('cache', 'visitor', `serves ${swr2.seen}`, 'ok', true),
];
const swr = (n: number): SeqState => ({
  actors: A4,
  messages: swrMessages.slice(0, n),
  stats: [
    { label: 'First read', value: n >= 3 ? swr1.seen : '-', tone: n >= 3 ? 'bad' : 'neutral' },
    { label: 'Second read', value: n >= 7 ? swr2.seen : '-', tone: n >= 7 ? 'ok' : 'neutral' },
    { label: 'Visitor waited', value: n >= 3 ? 'no' : '-', tone: n >= 3 ? 'ok' : 'neutral' },
  ],
  note: n >= 7 ? { text: 'the next visitor gets the fresh value: stale-while-revalidate', tone: 'ok' } : n >= 3 ? { text: 'the first visitor still gets the old value instantly while fresh data loads', tone: 'accent' } : { text: 'revalidateTag marks the entry stale, it does not delete it', tone: 'accent' },
});

const updMessages = [
  m('author', 'cache', 'updateTag', 'req'),
  m('author', 'cache', 'read page'),
  m('cache', 'db', 'fetch fresh', 'req'),
  m('db', 'cache', `value ${db.value}`, 'ok', true),
  m('cache', 'author', `serves ${authorRead.seen} at once`, 'ok', true),
];
const upd = (n: number): SeqState => ({
  actors: A4,
  messages: updMessages.slice(0, n),
  stats: [
    { label: 'Entry', value: n >= 1 ? 'expired' : '-', tone: 'ok' },
    { label: 'Author reads', value: n >= 5 ? authorRead.seen : '-', tone: n >= 5 ? 'ok' : 'neutral' },
    { label: 'Waited', value: n >= 3 ? 'for fresh data' : '-' },
  ],
  note: n >= 5 ? { text: 'read-your-writes: the author who just mutated never sees the old value', tone: 'ok' } : { text: 'updateTag (Server Actions only) expires the entry immediately', tone: 'accent' },
});

const H4: SeqState['actors'] = [
  { id: 'cms', label: 'CMS', kind: 'external' },
  { id: 'hook', label: 'Webhook', kind: 'gateway' },
  { id: 'cache', label: 'Cache', kind: 'cache' },
  { id: 'visitor', label: 'Visitor', kind: 'client' },
];
const hookMessages = [
  m('cms', 'hook', 'POST, wrong secret', 'bad'),
  m('hook', 'cms', `${badHook} Unauthorized`, 'bad', true),
  m('cms', 'hook', 'POST, right secret', 'req'),
  m('hook', 'cache', 'revalidateTag', 'ok'),
  m('visitor', 'cache', 'read page'),
  m('cache', 'visitor', `serves ${hookRead.seen} (stale)`, 'data', true),
];
const hook = (n: number): SeqState => ({
  actors: H4,
  messages: hookMessages.slice(0, n),
  stats: [
    { label: 'Wrong secret', value: n >= 2 ? String(badHook) : '-', tone: n >= 2 ? 'ok' : 'neutral' },
    { label: 'Right secret', value: n >= 4 ? String(goodHook) : '-', tone: n >= 4 ? 'ok' : 'neutral' },
    { label: 'Cache', value: n >= 4 ? 'marked stale' : '-' },
  ],
  note: n >= 2 && n < 3 ? { text: 'revalidation endpoints are public URLs: always authenticate them', tone: 'bad' } : n >= 4 ? { text: 'an external system changed content, so a webhook revalidates the tag', tone: 'ok' } : { text: 'a CMS tells your app that content changed', tone: 'accent' },
});

export default defineLesson('sequence', {
  slug: 'next-revalidation',
  objectives: [
    { text: 'Why a mutation can leave the page stale', step: 1 },
    { text: 'How revalidateTag serves old data while refreshing', step: 2 },
    { text: 'How updateTag gives read-your-writes', step: 3 },
    { text: 'How a webhook revalidates safely', step: 4 },
  ],
  steps: [
    {
      label: 'Stale',
      title: 'Saved, but not visible',
      tag: 'problem',
      body: ['The author saves a new title, and the database has it. The cached page still shows the old one.', 'Nothing told the cache that the data changed.'],
      keyIdea: 'If the UI is stale after an action, the bug is almost always missing revalidation.',
      frames: [{ state: stale(), hold: 4200 }],
    },
    {
      label: 'revalidateTag',
      title: 'Stale-while-revalidate',
      tag: 'technique',
      body: ['`revalidateTag(tag, \'max\')` marks tagged entries stale. The next visitor still gets the old value while fresh data loads.', 'The visitor after that gets the new value.'],
      keyIdea: 'Use it when background propagation to everyone else is fine.',
      frames: [1, 3, 5, 7].map((n) => ({ state: swr(n), hold: n === 7 ? 3800 : 1700 })),
    },
    {
      label: 'updateTag',
      title: 'Expire now for the author',
      tag: 'technique',
      body: ['`updateTag(tag)` expires the entry immediately, and the next read waits for fresh data.', 'The user who just changed something sees it right away.'],
      keyIdea: 'updateTag works in Server Actions only, and gives read-your-writes.',
      frames: [1, 3, 5].map((n) => ({ state: upd(n), hold: n === 5 ? 3800 : 1700 })),
    },
    {
      label: 'Webhook',
      title: 'External changes, authenticated',
      tag: 'in practice',
      body: ['A CMS can call a Route Handler that runs `revalidateTag`.', 'Revalidation endpoints are public by default, so check a secret before doing anything.'],
      keyIdea: 'Tag broadly and specifically, like `articles` and `article:slug`.',
      frames: [2, 4, 6].map((n) => ({ state: hook(n), hold: n === 6 ? 3800 : 2000 })),
    },
    {
      label: 'Recap',
      title: 'Revalidation APIs',
      tag: 'recap',
      body: [
        '- **revalidateTag:** mark stale, serve old, refresh in background.',
        '- **updateTag:** expire now, read-your-writes, Actions only.',
        '- **revalidatePath:** invalidate a path.',
        '- **refresh():** refresh uncached data on the current route.',
        '- **Webhooks:** authenticate them.',
      ],
      keyIdea: 'Revalidate in the same Server Action as the mutation.',
      frames: [{ state: upd(5) }],
    },
  ],
});
