import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';

const seq = (actors: SeqActor[], messages: SeqMessage[], stats: SeqState['stats'], note?: SeqState['note'], fresh = 1): SeqState => ({ actors, messages, stats, note, fresh });

// Step 1: read then write races.
const A_RACE: SeqActor[] = [
  { id: 'u1', label: 'User 1', kind: 'client' },
  { id: 'u2', label: 'User 2', kind: 'client' },
  { id: 'bk', label: 'Booking svc', kind: 'service' },
  { id: 'db', label: 'Database', kind: 'db' },
];
const race: SeqMessage[] = [
  { from: 'u1', to: 'bk', label: 'hold seat A1' },
  { from: 'bk', to: 'db', label: 'read A1: AVAILABLE' },
  { from: 'u2', to: 'bk', label: 'hold seat A1' },
  { from: 'bk', to: 'db', label: 'read A1: AVAILABLE', tone: 'bad' },
  { from: 'bk', to: 'db', label: 'write A1 = User 1' },
  { from: 'bk', to: 'db', label: 'write A1 = User 2', tone: 'bad' },
];

// Step 2: compare-and-set.
const cas: SeqMessage[] = [
  { from: 'u1', to: 'bk', label: 'hold seat A1' },
  { from: 'bk', to: 'db', label: 'UPDATE .. WHERE AVAILABLE', tone: 'accent' },
  { from: 'db', to: 'bk', label: '1 row: User 1 holds A1', dashed: true, tone: 'ok' },
  { from: 'u2', to: 'bk', label: 'hold seat A1' },
  { from: 'bk', to: 'db', label: 'UPDATE .. WHERE AVAILABLE', tone: 'accent' },
  { from: 'db', to: 'bk', label: '0 rows: someone won', dashed: true, tone: 'bad' },
  { from: 'bk', to: 'u2', label: 'taken, pick another', dashed: true, tone: 'accent' },
];

// Step 3: hold with a TTL, then confirm or release.
const A_FLOW: SeqActor[] = [
  { id: 'u', label: 'User', kind: 'client' },
  { id: 'bk', label: 'Booking svc', kind: 'service' },
  { id: 'pay', label: 'Payment', kind: 'external' },
  { id: 'db', label: 'Database', kind: 'db' },
];
const paid: SeqMessage[] = [
  { from: 'u', to: 'bk', label: 'select seat A1' },
  { from: 'bk', to: 'db', label: 'HOLD A1, expires 10 min', tone: 'accent' },
  { from: 'u', to: 'pay', label: 'pay (key=K1)' },
  { from: 'pay', to: 'bk', label: 'success K1', dashed: true, tone: 'ok' },
  { from: 'bk', to: 'db', label: 'SOLD A1 (unique key)', tone: 'ok' },
  { from: 'bk', to: 'u', label: 'ticket issued', dashed: true, tone: 'ok' },
];
const abandoned: SeqMessage[] = [
  { from: 'u', to: 'bk', label: 'select seat A1' },
  { from: 'bk', to: 'db', label: 'HOLD A1, expires 10 min', tone: 'accent' },
  { from: 'u', to: 'pay', label: 'closes the tab', dashed: true, lost: true, tone: 'bad' },
  { from: 'db', to: 'bk', label: '10 min passed', dashed: true },
  { from: 'bk', to: 'db', label: 'A1 back to AVAILABLE', tone: 'accent' },
];

// Step 4: paid but not confirmed, reconciliation.
const A_RECON: SeqActor[] = [
  { id: 'pay', label: 'Payment', kind: 'external' },
  { id: 'bk', label: 'Booking svc', kind: 'service' },
  { id: 'db', label: 'Database', kind: 'db' },
  { id: 'rc', label: 'Reconciler', kind: 'worker' },
];
const recon: SeqMessage[] = [
  { from: 'pay', to: 'bk', label: 'paid K1', dashed: true },
  { from: 'bk', to: 'db', label: 'confirm A1', tone: 'bad' },
  { from: 'db', to: 'bk', label: 'error: timeout', dashed: true, lost: true, tone: 'bad' },
  { from: 'rc', to: 'pay', label: 'status of K1?', tone: 'accent' },
  { from: 'pay', to: 'rc', label: 'paid', dashed: true, tone: 'ok' },
  { from: 'rc', to: 'db', label: 'confirm A1 (or refund)', tone: 'ok' },
];

// Step 5: the flash sale.
const A_SALE: SeqActor[] = [
  { id: 'us', label: '1M users', kind: 'client' },
  { id: 'wr', label: 'Waiting room', kind: 'gateway' },
  { id: 'cdn', label: 'Cache / CDN', kind: 'cdn' },
  { id: 'bk', label: 'Booking svc', kind: 'service' },
  { id: 'db', label: 'Database', kind: 'db' },
];
const sale: SeqMessage[] = [
  { from: 'us', to: 'wr', label: 'all arrive at 10:00' },
  { from: 'wr', to: 'us', label: 'queue position #48,213', dashed: true, tone: 'accent' },
  { from: 'wr', to: 'bk', label: 'admit 500 / s', tone: 'accent' },
  { from: 'us', to: 'cdn', label: 'seat map (stale ok)' },
  { from: 'us', to: 'bk', label: 'hold seats' },
  { from: 'bk', to: 'db', label: 'CAS hold (truth)', tone: 'ok' },
];

export default defineLesson('sequence', {
  slug: 'ticket-booking',
  objectives: [
    { text: 'Why read-then-write double books a seat', step: 1 },
    { text: 'Compare-and-set holds with an expiry', step: 2 },
    { text: 'What to do when payment succeeds but the confirm call fails', step: 4 },
    { text: 'How a waiting room protects a flash sale', step: 5 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Two people, one seat',
      tag: 'problem',
      body: [
        'The hard part is not average load. It is **contention on a few rows** during a spike: 1M users chasing 50,000 seats.',
        'A naive "read the seat, then write it" lets two requests both see it as available and both win.',
      ],
      keyIdea: 'Inventory needs one strongly consistent source of truth and an atomic way to claim it.',
      frames: [2, 4, 6].map((n) => ({ state: seq(A_RACE, race.slice(0, n), [{ label: 'Approach', value: 'read, write' }, { label: 'A1 owners', value: n >= 6 ? '2 users' : '?', tone: n >= 6 ? 'bad' : 'neutral' }, { label: 'Result', value: n >= 6 ? 'double booked' : 'racing', tone: n >= 6 ? 'bad' : 'neutral' }], n >= 6 ? { text: 'the second write silently overwrote the first', tone: 'bad' } : undefined, 2), hold: 2300 })),
    },
    {
      label: 'Compare-and-set',
      title: 'Claim the seat atomically',
      tag: 'technique',
      body: [
        'Make the check and the claim one statement: `UPDATE seats SET status = HELD, held_by = ? WHERE seat_id = ? AND (status = AVAILABLE OR hold_expires_at < now())`.',
        'If it updated 1 row you won. If it updated 0, someone else did. No locks held across the user\'s thinking time.',
      ],
      keyIdea: 'Add a unique constraint on `(event_id, seat_id)` in the confirmed bookings table as the last line of defence.',
      frames: [3, 7].map((n) => ({ state: seq(A_RACE, cas.slice(0, n), [{ label: 'Primitive', value: 'CAS update' }, { label: 'Winner', value: 'User 1', tone: 'ok' }, { label: 'Loser told', value: n >= 7 ? 'pick another' : '-', tone: n >= 7 ? 'ok' : 'neutral' }], undefined, n === 3 ? 3 : 4), hold: 2800 })),
    },
    {
      label: 'Holds',
      title: 'A hold that expires on its own',
      tag: 'technique',
      body: [
        'Between picking a seat and paying, the seat is **held** for 5 to 10 minutes. Store `hold_expires_at` and treat expired holds as available when reading, with a background sweep.',
        'Payment succeeds: confirm and issue tickets. Payment fails or the user wanders off: the hold simply expires.',
      ],
      keyIdea: 'A Redis key with a TTL can speed up hold checks, but the database stays the truth. Hold time balances convenience against inventory locked by abandoners.',
      frames: [{ state: seq(A_FLOW, paid, [{ label: 'Hold', value: '10 min' }, { label: 'Payment key', value: 'K1' }, { label: 'End state', value: 'SOLD', tone: 'ok' }], undefined, 3), hold: 3200 }, { state: seq(A_FLOW, abandoned, [{ label: 'Hold', value: 'expired', tone: 'bad' }, { label: 'Seat', value: 'AVAILABLE', tone: 'ok' }, { label: 'Cleanup', value: 'automatic' }], undefined, 3) }],
    },
    {
      label: 'Payment edge',
      title: 'Paid, but the confirm failed',
      tag: 'trade-off',
      body: [
        'The customer paid, then the confirm call timed out. Without care they are charged and have no ticket.',
        'Payments use an **idempotency key**. A **reconciliation** job reads the payment state and either confirms the booking or refunds.',
      ],
      keyIdea: 'Any step that talks to an external system needs a way to find out what really happened later.',
      frames: [3, 6].map((n) => ({ state: seq(A_RECON, recon.slice(0, n), [{ label: 'Payment', value: 'succeeded', tone: 'ok' }, { label: 'Booking', value: n >= 6 ? 'confirmed' : 'unknown', tone: n >= 6 ? 'ok' : 'bad' }, { label: 'Fixed by', value: n >= 6 ? 'reconciler' : '-' }], undefined, 3), hold: 2800 })),
    },
    {
      label: 'Flash sale',
      title: 'A waiting room in front',
      tag: 'in practice',
      body: [
        'A **virtual waiting room** queues users and admits them at a rate the backend can handle. Rate limit per user, pre-scale, and keep bots out with CAPTCHA and purchase caps.',
        'Serve the seat map from a cache, slightly stale is fine. Only the hold and confirm calls take the strongly consistent path.',
      ],
      keyIdea: 'Cache the reads, queue the spike, and keep the strict path narrow.',
      frames: [3, 6].map((n) => ({ state: seq(A_SALE, sale.slice(0, n), [{ label: 'Admit rate', value: '500 / s' }, { label: 'Seat map', value: 'cached', tone: 'ok' }, { label: 'Hold call', value: n >= 6 ? 'authoritative' : '-', tone: n >= 6 ? 'ok' : 'neutral' }], undefined, 3), hold: 2800 })),
    },
    {
      label: 'Recap',
      title: 'Correctness first, then the spike',
      tag: 'recap',
      body: [
        '- **No double booking:** atomic compare-and-set on the seat row, plus a unique constraint on confirmed bookings.',
        '- **Holds:** 5 to 10 minutes with `hold_expires_at`, released on failure or expiry.',
        '- **Payments:** idempotency key and a reconciliation job.',
        '- **Flash sale:** virtual waiting room, per-user limits, cached seat map, bot defences.',
        '- **Locking trade-off:** pessimistic locks are simple but queue up, optimistic CAS scales with retries.',
        '- **UX:** tell people quickly that a seat is gone and offer alternatives.',
      ],
      keyIdea: 'Average load is easy. Design for the one row everyone wants.',
      frames: [{ state: seq(A_RACE, cas, [], undefined, 4) }],
    },
  ],
});
