import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Note, Stat } from '../types';

/*
 * Each step is a list of messages. `play` reveals them in chunks: every frame shows
 * all messages so far, and the newest `fresh` ones animate in.
 */

type Show = { n: number; fresh?: number; note?: Note; stats?: Stat[]; hold?: number; actors?: SeqActor[] };

function play(actors: SeqActor[], msgs: SeqMessage[], shows: Show[]): Frame<SeqState>[] {
  return shows.map((s) => {
    const fresh = s.fresh ?? 1;
    return {
      hold: s.hold ?? 900 + fresh * 750,
      state: { actors: s.actors ?? actors, messages: msgs.slice(0, s.n), fresh, note: s.note, stats: s.stats },
    };
  });
}

const CLIENT: SeqActor = { id: 'c', label: 'Client', kind: 'client' };
const API: SeqActor = { id: 'api', label: 'API', kind: 'service' };
const STORE: SeqActor = { id: 's3', label: 'Object store', kind: 'storage' };

// ---------- Step 1: blobs through the app and into the OLTP database ----------

const BAD_ACTORS: SeqActor[] = [CLIENT, { ...API, status: 'active' }, { id: 'db', label: 'OLTP DB', kind: 'db' }];
const BAD_MSGS: SeqMessage[] = [
  { from: 'c', to: 'api', label: 'POST large video' },
  { from: 'api', to: 'api', label: 'buffers every byte', tone: 'bad' },
  { from: 'api', to: 'db', label: 'INSERT blob', tone: 'bad' },
  { from: 'db', to: 'api', label: 'ok, huge row', dashed: true },
];
const BAD_STATS: Stat[] = [
  { label: 'Bytes via API', value: 'all', tone: 'bad' },
  { label: 'Blob lives in', value: 'OLTP DB', tone: 'bad' },
  { label: 'Cost', value: 'high' },
];

// ---------- Step 2: buckets, keys, durability ----------

const MODEL_ACTORS: SeqActor[] = [
  API,
  STORE,
  { id: 'za', label: 'Zone A', kind: 'storage' },
  { id: 'zb', label: 'Zone B', kind: 'storage' },
  { id: 'zc', label: 'Zone C', kind: 'storage' },
];
const KEY = 'photos/2024/a.jpg';
const MODEL_MSGS: SeqMessage[] = [
  { from: 'api', to: 's3', label: `PUT ${KEY}` },
  { from: 's3', to: 'za', label: 'copy or code', tone: 'data' },
  { from: 's3', to: 'zb', label: 'copy or code', tone: 'data' },
  { from: 's3', to: 'zc', label: 'copy or code', tone: 'data' },
  { from: 's3', to: 'api', label: '200 OK', dashed: true },
  { from: 'api', to: 's3', label: `GET ${KEY}` },
  { from: 's3', to: 'api', label: 'the bytes just written', dashed: true },
];
const MODEL_STATS: Stat[] = [
  { label: 'Namespace', value: 'flat' },
  { label: 'Durability', value: '~11 nines', tone: 'ok' },
  { label: 'Zones', value: '3' },
];

// ---------- Step 3: pre-signed URL ----------

const SIGN_MSGS: SeqMessage[] = [
  { from: 'c', to: 'api', label: '1 ask for upload URL' },
  { from: 'api', to: 'api', label: 'sign URL for one key' },
  { from: 'api', to: 'c', label: '2 pre-signed URL', dashed: true },
  { from: 'c', to: 's3', label: '3 PUT bytes directly', tone: 'data' },
  { from: 's3', to: 'c', label: '200 OK', dashed: true },
];
const signStats = (bytes: string): Stat[] => [
  { label: 'Bytes via API', value: bytes, tone: 'ok' },
  { label: 'API handles', value: 'a URL' },
  { label: 'Upload goes', value: 'to the store' },
];

// ---------- Step 4: multipart ----------

const PARTS = 3;
const LOST_PART = 2;
const MULTI_MSGS: SeqMessage[] = [
  { from: 'c', to: 'api', label: 'start multipart' },
  { from: 'api', to: 'c', label: 'upload id + part URLs', dashed: true },
  ...Array.from({ length: PARTS }, (_, i): SeqMessage => ({ from: 'c', to: 's3', label: `PUT part ${i + 1}`, tone: i + 1 === LOST_PART ? 'bad' : 'data', lost: i + 1 === LOST_PART })),
  { from: 'c', to: 's3', label: `retry part ${LOST_PART} only`, tone: 'data' },
  { from: 'c', to: 's3', label: `complete, parts 1-${PARTS}` },
  { from: 's3', to: 'c', label: 'one object', dashed: true },
];
const partStats = (done: number, retried: number): Stat[] => [
  { label: 'Parts stored', value: `${done} / ${PARTS}`, tone: done === PARTS ? 'ok' : 'neutral' },
  { label: 'Re-sent', value: retried ? `part ${LOST_PART}` : '-' },
  { label: 'Restart cost', value: 'one part', tone: 'ok' },
];

// ---------- Step 5: event-driven processing ----------

const EVT_ACTORS: SeqActor[] = [
  CLIENT,
  STORE,
  { id: 'q', label: 'Queue', kind: 'queue' },
  { id: 'w', label: 'Worker', kind: 'worker' },
  { id: 'meta', label: 'Metadata DB', kind: 'db' },
];
const EVT_MSGS: SeqMessage[] = [
  { from: 'c', to: 's3', label: 'upload directly', tone: 'data' },
  { from: 's3', to: 'q', label: 'event: object created' },
  { from: 'q', to: 'w', label: 'deliver event' },
  { from: 'w', to: 'w', label: 'virus scan, thumbnails' },
  { from: 'w', to: 'meta', label: 'key, size, checksum' },
  { from: 'meta', to: 'w', label: 'saved', dashed: true },
];
const EVT_STATS: Stat[] = [
  { label: 'Blob in', value: 'object store' },
  { label: 'Metadata in', value: 'database' },
  { label: 'Processing', value: 'async', tone: 'ok' },
];

// ---------- Step 6: serving through a CDN with signed URLs ----------

const SERVE_ACTORS: SeqActor[] = [CLIENT, API, { id: 'cdn', label: 'CDN', kind: 'cdn' }, STORE];
const SERVE_MSGS: SeqMessage[] = [
  { from: 'c', to: 'api', label: 'view private photo' },
  { from: 'api', to: 'c', label: 'signed URL', dashed: true },
  { from: 'c', to: 'cdn', label: 'GET signed URL' },
  { from: 'cdn', to: 's3', label: 'miss: fetch object' },
  { from: 's3', to: 'cdn', label: 'bytes', dashed: true },
  { from: 'cdn', to: 'c', label: 'bytes, now cached', dashed: true },
  { from: 'c', to: 'cdn', label: 'GET again' },
  { from: 'cdn', to: 'c', label: 'hit from the edge', dashed: true },
];

// ---------- Step 7: the whole pattern ----------

const RECAP_ACTORS: SeqActor[] = [CLIENT, API, STORE, { id: 'q', label: 'Queue', kind: 'queue' }, { id: 'w', label: 'Worker', kind: 'worker' }];
const RECAP_MSGS: SeqMessage[] = [
  { from: 'c', to: 'api', label: '1 ask for upload URL' },
  { from: 'api', to: 'c', label: '2 pre-signed URL', dashed: true },
  { from: 'c', to: 's3', label: '3 upload directly', tone: 'data' },
  { from: 's3', to: 'q', label: '4 event on upload' },
  { from: 'q', to: 'w', label: 'scan, thumbnails' },
];

export default defineLesson('sequence', {
  slug: 'object-storage',
  objectives: [
    { text: 'Keep blobs out of the OLTP database and app servers', step: 1 },
    { text: 'Describe the bucket and key model, durability and consistency', step: 2 },
    { text: 'Upload directly with pre-signed URLs and multipart', step: 4 },
    { text: 'Process uploads with events and serve them through a CDN', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Blobs in the wrong place',
      tag: 'problem',
      body: [
        'A user uploads a large video. The API buffers every byte, then writes it into a database row.',
        'Your app servers burn bandwidth and memory, and the OLTP database fills with data it was never built to hold.',
      ],
      keyIdea: 'Never store large blobs in the OLTP database. Put them in object storage and keep only metadata in the DB.',
      frames: play(BAD_ACTORS, BAD_MSGS, [
        { n: 1, stats: BAD_STATS },
        { n: 3, fresh: 2, stats: BAD_STATS },
        { n: 4, stats: BAD_STATS, note: { text: 'app servers and the OLTP DB carry every byte', tone: 'bad' } },
      ]),
    },
    {
      label: 'The model',
      title: 'Buckets, keys, many copies',
      tag: 'concept',
      body: [
        'Object stores (S3, GCS, Azure Blob) hold large immutable blobs by key in a **flat namespace**. "Folders" are just key prefixes.',
        'Data is replicated or erasure coded across zones for about **11 nines** of durability. S3 has given strong read-after-write consistency since December 2020.',
      ],
      keyIdea: 'Cheap, durable blobs by key. A read right after a write returns the new object.',
      frames: play(MODEL_ACTORS, MODEL_MSGS, [
        { n: 1, stats: MODEL_STATS, note: { text: "'photos/2024/' is a key prefix, not a folder" } },
        { n: 4, fresh: 3, stats: MODEL_STATS, note: { text: 'replicated or erasure coded across zones', tone: 'accent' } },
        { n: 5, stats: MODEL_STATS },
        { n: 7, fresh: 2, stats: [...MODEL_STATS.slice(0, 2), { label: 'Read after write', value: 'strong', tone: 'ok' }], note: { text: 'read-after-write: the GET sees the new object', tone: 'ok' } },
      ]),
    },
    {
      label: 'Pre-signed',
      title: 'Upload straight to storage',
      tag: 'technique',
      body: [
        'The client asks your API for a **pre-signed URL**. The API signs permission for one key and returns it.',
        'The client then sends the bytes **directly** to the object store. Your servers never touch them.',
      ],
      keyIdea: 'Your API hands out permission, not bandwidth.',
      frames: play([CLIENT, API, STORE], SIGN_MSGS, [
        { n: 1, stats: signStats('0') },
        { n: 3, fresh: 2, stats: signStats('0') },
        { n: 4, stats: signStats('0'), note: { text: 'bytes skip your servers entirely', tone: 'ok' } },
        { n: 5, stats: signStats('0') },
      ]),
    },
    {
      label: 'Multipart',
      title: 'Large files in resumable parts',
      tag: 'technique',
      body: [
        'Large uploads use **multipart upload**: split the file, send parts independently, then complete.',
        'If one part fails, only that part is re-sent. The store assembles the parts into one object.',
      ],
      keyIdea: 'Multipart makes big uploads resumable: a failure costs one part, not the whole file.',
      frames: play([CLIENT, API, STORE], MULTI_MSGS, [
        { n: 2, fresh: 2, stats: partStats(0, 0) },
        { n: 2 + PARTS, fresh: PARTS, stats: partStats(PARTS - 1, 0), note: { text: `part ${LOST_PART} was lost on a flaky network`, tone: 'bad' } },
        { n: 3 + PARTS, stats: partStats(PARTS, 1) },
        { n: 5 + PARTS, fresh: 2, stats: partStats(PARTS, 1), note: { text: 'complete: parts become one object', tone: 'ok' } },
      ]),
    },
    {
      label: 'Events',
      title: 'Process after the upload',
      tag: 'in practice',
      body: [
        'The store emits an **event on upload**. A queue hands it to a worker that scans for viruses, makes thumbnails, and records metadata.',
        'Metadata (owner, key, size, checksum, permissions) lives in a database. The blob stays in the object store.',
      ],
      keyIdea: 'Blobs in object storage, metadata in a database, processing driven by upload events.',
      frames: play(EVT_ACTORS, EVT_MSGS, [
        { n: 1, stats: EVT_STATS },
        { n: 2, stats: EVT_STATS },
        { n: 3, stats: EVT_STATS },
        { n: 4, stats: EVT_STATS },
        { n: 6, fresh: 2, stats: EVT_STATS, note: { text: 'the user never waited for any of this', tone: 'ok' } },
      ]),
    },
    {
      label: 'Serving',
      title: 'CDN in front, signed URLs',
      tag: 'technique',
      body: [
        'Put a **CDN** in front of the bucket. The first request fetches from the store, later ones are served from the edge.',
        'For private content, the API issues a **signed URL** that grants access to one object.',
      ],
      keyIdea: 'Serve blobs through a CDN, and use signed URLs instead of making private objects public.',
      frames: play(SERVE_ACTORS, SERVE_MSGS, [
        { n: 2, fresh: 2, stats: [{ label: 'Access', value: 'signed URL' }, { label: 'CDN', value: 'cold' }, { label: 'Store reads', value: '0' }] },
        { n: 6, fresh: 4, stats: [{ label: 'Access', value: 'signed URL' }, { label: 'CDN', value: 'miss', tone: 'bad' }, { label: 'Store reads', value: '1' }] },
        { n: 8, fresh: 2, stats: [{ label: 'Access', value: 'signed URL' }, { label: 'CDN', value: 'hit', tone: 'ok' }, { label: 'Store reads', value: '1', tone: 'ok' }], note: { text: 'second request never reaches the store', tone: 'ok' } },
      ]),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Model:** buckets and keys in a flat namespace, folders are prefixes.',
        '- **Durability:** about 11 nines across zones. S3 is strongly read-after-write consistent, and supports conditional writes since 2024.',
        '- **Uploads:** pre-signed URLs, multipart for large files, bytes never pass through your servers.',
        '- **Cost:** hot, infrequent access and archive tiers, moved down by lifecycle rules.',
        '- **Pattern:** blobs in object storage, metadata in a database, a CDN and signed URLs for serving.',
      ],
      keyIdea: 'Object storage for bytes, a database for facts about the bytes.',
      frames: [
        {
          state: {
            actors: RECAP_ACTORS,
            messages: RECAP_MSGS,
            fresh: 0,
            stats: [
              { label: 'Bytes via API', value: '0', tone: 'ok' },
              { label: 'Metadata', value: 'in a DB' },
              { label: 'Tiers', value: 'hot to archive' },
            ],
          },
        },
      ],
    },
  ],
});
