import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';

const seq = (actors: SeqActor[], messages: SeqMessage[], stats: SeqState['stats'], note?: SeqState['note'], fresh = 1): SeqState => ({ actors, messages, stats, note, fresh });

// Step 2: online delivery through two gateways.
const A_ONLINE: SeqActor[] = [
  { id: 's', label: 'Sender', kind: 'client' },
  { id: 'g1', label: 'Gateway A', kind: 'gateway' },
  { id: 'cs', label: 'Chat service', kind: 'service' },
  { id: 'g2', label: 'Gateway B', kind: 'gateway' },
  { id: 'r', label: 'Recipient', kind: 'client' },
];
const online: SeqMessage[] = [
  { from: 's', to: 'g1', label: 'send "hi" cid=c1' },
  { from: 'g1', to: 'cs', label: 'forward' },
  { from: 'cs', to: 'g1', label: 'saved as #41', dashed: true, tone: 'ok' },
  { from: 'g1', to: 's', label: 'sent ✓', dashed: true, tone: 'ok' },
  { from: 'cs', to: 'g2', label: 'B is on gateway B', tone: 'accent' },
  { from: 'g2', to: 'r', label: 'push #41' },
  { from: 'r', to: 'g2', label: 'delivered ✓✓', dashed: true, tone: 'ok' },
  { from: 'g2', to: 'cs', label: 'ack #41', dashed: true },
];

// Step 3: offline delivery.
const A_OFFLINE: SeqActor[] = [
  { id: 's', label: 'Sender', kind: 'client' },
  { id: 'cs', label: 'Chat service', kind: 'service' },
  { id: 'pn', label: 'Push service', kind: 'external' },
  { id: 'r', label: 'Recipient', kind: 'client', status: 'dim', badge: { text: 'offline', tone: 'bad' } },
];
const offline: SeqMessage[] = [
  { from: 's', to: 'cs', label: 'send "hi" cid=c2' },
  { from: 'cs', to: 's', label: 'saved as #42', dashed: true, tone: 'ok' },
  { from: 'cs', to: 'pn', label: 'recipient offline', tone: 'accent' },
  { from: 'pn', to: 'r', label: 'APNs / FCM push', dashed: true },
  { from: 'r', to: 'cs', label: 'reconnect, last=#41', tone: 'accent' },
  { from: 'cs', to: 'r', label: 'sync #42', dashed: true, tone: 'ok' },
];

// Step 4: retries and dedupe.
const A_RETRY: SeqActor[] = [
  { id: 's', label: 'Sender', kind: 'client' },
  { id: 'g1', label: 'Gateway', kind: 'gateway' },
  { id: 'cs', label: 'Chat service', kind: 'service' },
];
const retry: SeqMessage[] = [
  { from: 's', to: 'g1', label: 'send "yo" cid=c3' },
  { from: 'g1', to: 'cs', label: 'forward' },
  { from: 'cs', to: 'g1', label: 'saved as #43', dashed: true },
  { from: 'g1', to: 's', label: 'ack lost', dashed: true, lost: true, tone: 'bad' },
  { from: 's', to: 'g1', label: 'retry cid=c3', tone: 'accent' },
  { from: 'g1', to: 'cs', label: 'forward cid=c3' },
  { from: 'cs', to: 'g1', label: 'seen c3: return #43', dashed: true, tone: 'ok' },
  { from: 'g1', to: 's', label: 'sent ✓', dashed: true, tone: 'ok' },
];

// Step 5: ordering per conversation.
const A_ORDER: SeqActor[] = [
  { id: 'a', label: 'Alice', kind: 'client' },
  { id: 'cs', label: 'Chat owner', kind: 'service', badge: { text: 'chat 9 lives here', tone: 'accent' } },
  { id: 'b', label: 'Bob', kind: 'client' },
];
const order: SeqMessage[] = [
  { from: 'a', to: 'cs', label: 'msg "on my way"' },
  { from: 'b', to: 'cs', label: 'msg "where are you?"' },
  { from: 'cs', to: 'a', label: 'yours is #10', dashed: true, tone: 'ok' },
  { from: 'cs', to: 'b', label: 'yours is #11', dashed: true, tone: 'ok' },
  { from: 'cs', to: 'a', label: 'chat 9: #10, #11', dashed: true, tone: 'accent' },
  { from: 'cs', to: 'b', label: 'chat 9: #10, #11', dashed: true, tone: 'accent' },
];

// Step 6: groups.
const A_GROUP: SeqActor[] = [
  { id: 's', label: 'Sender', kind: 'client' },
  { id: 'cs', label: 'Chat service', kind: 'service' },
  { id: 'm1', label: 'Member 1', kind: 'client' },
  { id: 'm2', label: 'Member 2', kind: 'client' },
  { id: 'm3', label: 'Member 3', kind: 'client' },
];
const small: SeqMessage[] = [
  { from: 's', to: 'cs', label: 'group msg' },
  { from: 'cs', to: 'm1', label: 'inbox + push', tone: 'accent' },
  { from: 'cs', to: 'm2', label: 'inbox + push', tone: 'accent' },
  { from: 'cs', to: 'm3', label: 'inbox + push', tone: 'accent' },
];
const A_CHANNEL: SeqActor[] = [
  { id: 's', label: 'Publisher', kind: 'client' },
  { id: 'cs', label: 'Pub/sub topic', kind: 'queue' },
  { id: 'm1', label: 'Member 1', kind: 'client' },
  { id: 'm2', label: 'Member 2', kind: 'client' },
  { id: 'm3', label: 'Member 3', kind: 'client' },
];
const channel: SeqMessage[] = [
  { from: 's', to: 'cs', label: 'publish once' },
  { from: 'm1', to: 'cs', label: 'pull when open', tone: 'accent' },
  { from: 'cs', to: 'm1', label: 'latest', dashed: true, tone: 'ok' },
  { from: 'm3', to: 'cs', label: 'pull when open', tone: 'accent' },
  { from: 'cs', to: 'm3', label: 'latest', dashed: true, tone: 'ok' },
];

export default defineLesson('sequence', {
  slug: 'chat-system',
  objectives: [
    { text: 'How a message travels between two gateways', step: 2 },
    { text: 'What happens when the recipient is offline', step: 3 },
    { text: 'How retries and dedupe give at-least-once delivery safely', step: 4 },
    { text: 'Why ordering is per conversation, not global', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Real time, never lost, in order',
      tag: 'problem',
      body: [
        'Design WhatsApp style chat: 1:1 and groups, online and offline delivery, receipts and multi-device. 500M daily users sending 40 messages each is about **230,000 messages per second**.',
        'Hundreds of millions of connections stay open, so the gateway tier is large and stateful.',
      ],
      keyIdea: 'Persistent WebSocket connections give low latency. The hard parts are routing, offline delivery and ordering.',
      frames: [
        {
          state: seq(
            [{ id: 'c', label: 'Clients', kind: 'client' }, { id: 'g', label: 'Gateways', kind: 'gateway' }, { id: 'cs', label: 'Chat service', kind: 'service' }],
            [{ from: 'c', to: 'g', label: 'WebSocket (always open)', tone: 'accent' }, { from: 'g', to: 'cs', label: '230k msgs / s' }, { from: 'cs', to: 'g', label: 'route to recipient', dashed: true }],
            [{ label: 'Messages', value: '20B / day' }, { label: 'Text', value: '~2 TB / day' }, { label: 'Connections', value: '100s of M' }],
            undefined,
            3,
          ),
          hold: 3000,
        },
      ],
    },
    {
      label: 'Online path',
      title: 'Save first, then route',
      tag: 'technique',
      body: [
        'The sender\'s gateway forwards the message to the **chat service**. It assigns an id, persists the message, and acks "sent" to the sender.',
        'It then looks up the recipient\'s gateway in the **connection registry** (Redis, user to gateway, refreshed by heartbeats), pushes over that socket and waits for a delivery ack.',
      ],
      keyIdea: 'Persist before acking. A "sent" tick means the server owns the message.',
      frames: [4, 5, 8].map((n) => ({ state: seq(A_ONLINE, online.slice(0, n), [{ label: 'Stored', value: n >= 3 ? 'yes #41' : '-', tone: n >= 3 ? 'ok' : 'neutral' }, { label: 'Route', value: n >= 5 ? 'via registry' : '-' }, { label: 'Receipt', value: n >= 7 ? 'delivered' : 'pending', tone: n >= 7 ? 'ok' : 'neutral' }], undefined, n === 4 ? 4 : n === 5 ? 1 : 3), hold: 2300 })),
    },
    {
      label: 'Offline',
      title: 'Store, push, sync',
      tag: 'technique',
      body: [
        'If the recipient has no connection, the message waits in their **offline inbox** and a push notification goes out through APNs or FCM.',
        'On reconnect the client sends the last message id it has, and the server syncs everything after it. Every device keeps its own cursor.',
      ],
      keyIdea: 'Sync by cursor, not by event stream. A device that was off for a week catches up in one pass.',
      frames: [3, 4, 6].map((n) => ({ state: seq(A_OFFLINE, offline.slice(0, n), [{ label: 'Recipient', value: 'offline', tone: 'bad' }, { label: 'Inbox', value: n >= 2 ? '#42 waiting' : '-' }, { label: 'On reconnect', value: n >= 6 ? 'sync after #41' : '-', tone: n >= 6 ? 'ok' : 'neutral' }], undefined, n === 3 ? 3 : n === 4 ? 1 : 2), hold: 2300 })),
    },
    {
      label: 'Retries',
      title: 'At-least-once plus dedupe',
      tag: 'technique',
      body: [
        'The ack can be lost, so the client resends until it gets one. The message carries a **client-generated id**, and the server dedupes on it.',
        'The retry returns the original server id and creates nothing new. Delivery is at least once, the effect is exactly once.',
      ],
      keyIdea: 'Reliability comes from acks and client retries, not from the network.',
      frames: [4, 8].map((n) => ({ state: seq(A_RETRY, retry.slice(0, n), [{ label: 'Client id', value: 'c3' }, { label: 'Stored', value: n >= 8 ? 'once (#43)' : '#43', tone: 'ok' }, { label: 'Duplicate', value: n >= 8 ? 'ignored' : '-', tone: n >= 8 ? 'ok' : 'neutral' }], undefined, 4), hold: 2800 })),
    },
    {
      label: 'Ordering',
      title: 'Order within a chat, not globally',
      tag: 'concept',
      body: [
        'Global order is unnecessary and expensive. Guarantee order **within a conversation** by giving each chat a single ordering point, a partition owner or a per-chat sequence.',
        'Both people then see the same sequence of ids, even if their messages raced.',
      ],
      keyIdea: 'Storage fits a wide-column store keyed by `(chat_id, message_id)`: append heavy, read by conversation and recency.',
      frames: [{ state: seq(A_ORDER, order.slice(0, 4), [{ label: 'Race', value: 'two at once' }, { label: 'Order set by', value: 'chat owner', tone: 'ok' }, { label: 'Scope', value: 'per chat' }], undefined, 2), hold: 2600 }, { state: seq(A_ORDER, order, [{ label: 'Both see', value: '#10, #11', tone: 'ok' }, { label: 'Global order', value: 'not needed' }, { label: 'Key', value: 'chat, msg id' }], undefined, 2) }],
    },
    {
      label: 'Groups',
      title: 'Small groups push, big channels pull',
      tag: 'trade-off',
      body: [
        'For small groups, **fan out on write** into each member\'s inbox. For very large groups or channels, publish once to a topic and let members pull, the same celebrity trick as a news feed.',
        'Presence is a heartbeat refreshing a key with a short TTL. Fetch it lazily when a chat is open rather than broadcasting every change.',
      ],
      keyIdea: 'Match the fan-out strategy to the group size.',
      frames: [{ state: seq(A_GROUP, small, [{ label: 'Group size', value: 'small' }, { label: 'Strategy', value: 'push to inbox', tone: 'ok' }, { label: 'Cost', value: 'N writes' }], undefined, 4), hold: 2800 }, { state: seq(A_CHANNEL, channel, [{ label: 'Group size', value: 'huge' }, { label: 'Strategy', value: 'publish + pull', tone: 'ok' }, { label: 'Cost', value: '1 write' }], undefined, 4) }],
    },
    {
      label: 'Recap',
      title: 'The whole design',
      tag: 'recap',
      body: [
        '- **Transport:** WebSocket to a large, stateful gateway tier. Reconnect with backoff and jitter after a crash to avoid a reconnect storm.',
        '- **Message path:** persist, ack "sent", look up the gateway in the registry, push, wait for a delivery ack.',
        '- **Offline:** inbox plus push notification, cursor-based sync.',
        '- **Reliability:** client ids, retries, server dedupe.',
        '- **Ordering:** per conversation. **Storage:** wide-column keyed by chat and message id.',
        '- **Extras:** media in object storage, multi-device cursors, optional end-to-end encryption.',
      ],
      keyIdea: 'With end-to-end encryption the server routes ciphertext only, which limits server-side search and moderation.',
      frames: [{ state: seq(A_ONLINE, online, [], undefined, 3) }],
    },
  ],
});
