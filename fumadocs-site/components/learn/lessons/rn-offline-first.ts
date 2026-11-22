import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the React Native notes on offline-first: the local database is the source of truth, writes go through an outbox,
 * and client-generated ids make retries idempotent. A real outbox and server run the retry both ways, so the record counts are computed.
 */

type Op = { id: string; title: string };
const OPS: Op[] = [{ id: 'a1', title: 'Buy milk' }];

/** A flaky network: the server stores the write, but the reply is lost, so the client retries. */
function server(idempotent: boolean) {
  const rows = new Map<string, Op>();
  let counter = 0;
  return {
    rows,
    create(op: Op) {
      const key = idempotent ? op.id : `srv-${++counter}`; // without a client id the server invents a new one each time
      if (!rows.has(key)) rows.set(key, { ...op, id: key });
    },
  };
}
const naive = server(false);
const safe = server(true);
for (const op of OPS) {
  naive.create(op);
  naive.create(op); // retry after a lost reply
  safe.create(op);
  safe.create(op);
}

const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });
const lostMsg = (from: string, to: string, label: string): SeqMessage => ({ from, to, label, tone: 'bad', lost: true });
const A4: SeqState['actors'] = [
  { id: 'ui', label: 'UI', kind: 'client' },
  { id: 'db', label: 'Local DB', kind: 'db' },
  { id: 'out', label: 'Outbox', kind: 'queue' },
  { id: 'srv', label: 'Server', kind: 'external' },
];

const networkFirst = (n: number): SeqState => ({
  actors: [A4[0], { id: 'srv', label: 'Server', kind: 'external' }],
  messages: [m('ui', 'srv', 'POST new todo', 'req'), lostMsg('srv', 'ui', 'offline: no reply')].slice(0, n),
  stats: [
    { label: 'Network', value: 'offline', tone: 'bad' },
    { label: 'User sees', value: n >= 2 ? 'a spinner' : '-', tone: n >= 2 ? 'bad' : 'neutral' },
    { label: 'Work saved', value: n >= 2 ? 'none' : '-', tone: n >= 2 ? 'bad' : 'neutral' },
  ],
  note: n >= 2 ? { text: 'a network-first app is unusable the moment the connection drops', tone: 'bad' } : { text: 'a user adds a todo on the subway', tone: 'accent' },
});

const LOCAL: SeqMessage[] = [m('ui', 'db', 'write todo a1', 'ok'), m('db', 'ui', 'shown instantly', 'ok', true)];
const local = (n: number): SeqState => ({
  actors: A4,
  messages: LOCAL.slice(0, n),
  stats: [
    { label: 'UI reads', value: 'local DB', tone: 'ok' },
    { label: 'Latency', value: 'instant', tone: 'ok' },
    { label: 'Needs network', value: 'no', tone: 'ok' },
  ],
  note: { text: 'the local database is the source of truth for the UI, the network syncs in the background', tone: 'ok' },
});

const SYNC: SeqMessage[] = [
  m('ui', 'db', 'write todo a1', 'ok'),
  m('ui', 'out', 'queue create a1', 'data'),
  m('out', 'srv', 'send when online', 'req'),
  m('srv', 'out', 'ok, synced', 'ok', true),
  m('out', 'db', 'mark a1 synced', 'ok'),
];
const sync = (n: number): SeqState => ({
  actors: A4,
  messages: SYNC.slice(0, n),
  stats: [
    { label: 'Pending', value: n >= 2 && n < 4 ? '1' : n >= 4 ? '0' : '-', tone: n >= 4 ? 'ok' : 'neutral' },
    { label: 'Network', value: n >= 3 ? 'online' : 'offline' },
    { label: 'Synced', value: n >= 5 ? 'yes' : 'no', tone: n >= 5 ? 'ok' : 'neutral' },
  ],
  note: n >= 5 ? { text: 'the outbox delivered the write and the local row is marked synced', tone: 'ok' } : { text: 'writes wait in an outbox of pending mutations until the network returns', tone: 'accent' },
});

const retryMsgs = (idem: boolean): SeqMessage[] => [
  m('out', 'srv', idem ? 'create a1' : 'create (no id)', 'req'),
  lostMsg('srv', 'out', 'reply lost'),
  m('out', 'srv', idem ? 'retry create a1' : 'retry (no id)', 'req'),
  m('srv', 'out', idem ? 'already have a1: ok' : 'created again', idem ? 'ok' : 'bad', true),
];
const retry = (idem: boolean, n: number): SeqState => {
  const rows = (idem ? safe : naive).rows.size;
  return {
    actors: [A4[2], A4[3]],
    messages: retryMsgs(idem).slice(0, n),
    stats: [
      { label: 'Client id', value: idem ? 'a1 (uuid)' : 'none', tone: idem ? 'ok' : 'bad' },
      { label: 'Sends', value: n >= 3 ? '2' : n >= 1 ? '1' : '-' },
      { label: 'Server rows', value: n >= 4 ? String(rows) : '-', tone: n >= 4 ? (rows === 1 ? 'ok' : 'bad') : 'neutral' },
    ],
    note: n >= 4 ? (idem ? { text: 'the stable client id makes the retry idempotent: still one todo', tone: 'ok' } : { text: `the retry created a duplicate: ${rows} rows for one tap`, tone: 'bad' }) : { text: 'the server saved the write but the reply never arrived, so the client retries', tone: 'accent' },
  };
};

export default defineLesson('sequence', {
  slug: 'rn-offline-first',
  objectives: [
    { text: 'Why network-first apps break offline', step: 1 },
    { text: 'Why the UI should read a local database', step: 2 },
    { text: 'How an outbox syncs writes later', step: 3 },
    { text: 'Why client ids make retries safe', step: 4 },
  ],
  steps: [
    {
      label: 'Network first',
      title: 'Nothing works offline',
      tag: 'problem',
      body: ['If every action waits for the server, a dropped connection stops the app.', 'Mobile networks drop constantly: tunnels, lifts, weak signal.'],
      keyIdea: 'Do not make the user wait on the network for their own data.',
      frames: [1, 2].map((n) => ({ state: networkFirst(n), hold: n === 2 ? 3400 : 1600 })),
    },
    {
      label: 'Local first',
      title: 'The local DB is the truth',
      tag: 'concept',
      body: ['The UI reads and writes a **local database**, such as SQLite. Changes show instantly.', 'The network is a background concern.'],
      keyIdea: 'Local database for the UI, network syncs behind it.',
      frames: [1, 2].map((n) => ({ state: local(n), hold: n === 2 ? 3400 : 1500 })),
    },
    {
      label: 'Outbox',
      title: 'Queue writes, send later',
      tag: 'technique',
      body: ['Every write also goes to an **outbox** of pending mutations. When the network returns, the outbox sends them and the rows are marked synced.', 'Pull changes back with a server cursor.'],
      keyIdea: 'Never silently drop a failed write, and show pending state.',
      frames: [1, 2, 3, 4, 5].map((n) => ({ state: sync(n), hold: n === 5 ? 3400 : 1300 })),
    },
    {
      label: 'Idempotent',
      title: 'Retries must be safe',
      tag: 'trade-off',
      body: ['A reply can be lost after the server already saved the write. The client retries.', 'Without a client-generated id the server creates a duplicate. With a UUID it recognises the retry.'],
      keyIdea: 'Stable client-generated ids make retries idempotent.',
      frames: [...[1, 2, 3, 4].map((n) => ({ state: retry(false, n), hold: n === 4 ? 3000 : 1200 })), ...[3, 4].map((n) => ({ state: retry(true, n), hold: n === 4 ? 3600 : 1400 }))],
    },
    {
      label: 'Recap',
      title: 'Offline-first',
      tag: 'recap',
      body: [
        '- **Local database:** source of truth for the UI.',
        '- **Outbox:** pending mutations, sent when online.',
        '- **Client ids:** UUIDs make retries idempotent.',
        '- **Pull:** incremental changes with a cursor or timestamp.',
        '- **Conflicts:** pick a strategy, such as last write wins or a field-level merge.',
      ],
      keyIdea: 'Show sync status and pending changes to the user.',
      frames: [{ state: sync(5) }],
    },
  ],
});
