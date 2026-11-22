import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';
import { indexFor, objectsHash2 } from './shared/javaHash';

/*
 * Follows the Java notes on the equals and hashCode contract and on mutable keys.
 * Bucket numbers come from Java's real Objects.hash(x, y) = 31 * (31 + x) + y and the HashMap index formula.
 * The default Object.hashCode is an identity hash that differs per instance, so two illustrative values stand in for it.
 */

const CAP = 16;
const IDENTITY_A = 460141958;
const IDENTITY_B = 1163157884;

const stored = { x: 1, y: 2 };
const hashStored = objectsHash2(stored.x, stored.y);
const idxStored = indexFor(hashStored, CAP);
const idxIdentityA = indexFor(IDENTITY_A, CAP);
const idxIdentityB = indexFor(IDENTITY_B, CAP);
const mutatedHash = objectsHash2(99, 2);
const idxMutated = indexFor(mutatedHash, CAP);
// Another point with the same Objects.hash as (1, 2): 31 * (31 + 0) + y = hashStored.
const sibling = { x: 0, y: hashStored - 31 * 31 };

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

type Mark = { at: number; text: string };
const table = (marks: Mark[], pointers: { i: number; label: string; tone: 'ok' | 'bad' | 'accent'; up: boolean }[], found?: number): ArrayState['rows'] => [
  {
    label: 'bucket',
    cells: Array.from({ length: CAP }, (_, i) => marks.filter((m) => m.at === i).map((m) => m.text).join('')),
    states: paint(CAP, (i) => (found === i ? 'found' : marks.some((m) => m.at === i) ? 'done' : 'normal')),
    pointers,
    showIndex: true,
  },
];

// Step 1: equals only, so the lookup hashes elsewhere.
const brokenState = (phase: 1 | 2): ArrayState => ({
  rows: table([{ at: idxIdentityA, text: 'P' }], phase === 1 ? [{ i: idxIdentityA, label: 'add', tone: 'ok', up: false }] : [{ i: idxIdentityA, label: 'add', tone: 'ok', up: false }, { i: idxIdentityB, label: 'contains', tone: 'bad', up: true }]),
  stats: [
    { label: 'equals()', value: 'overridden' },
    { label: 'hashCode()', value: 'default', tone: 'bad' },
    { label: 'contains', value: phase === 2 ? 'false' : '-', tone: phase === 2 ? 'bad' : 'neutral' },
  ],
  note: phase === 1 ? { text: 'add(new Point(1, 2)) stores P in the bucket chosen by its identity hash', tone: 'accent' } : { text: `new Point(1, 2) hashes to bucket ${idxIdentityB}, not ${idxIdentityA}: equals is never even called`, tone: 'bad' },
});

// Step 2: with hashCode overridden, equal objects share a bucket.
const contractState = (phase: 1 | 2): ArrayState => ({
  rows: table([{ at: idxStored, text: 'P' }], phase === 1 ? [{ i: idxStored, label: 'add', tone: 'ok', up: false }] : [{ i: idxStored, label: 'add', tone: 'ok', up: false }, { i: idxStored, label: 'contains', tone: 'ok', up: true }], phase === 2 ? idxStored : undefined),
  stats: [
    { label: 'Objects.hash', value: String(hashStored) },
    { label: 'Bucket', value: String(idxStored), tone: 'ok' },
    { label: 'contains', value: phase === 2 ? 'true' : '-', tone: phase === 2 ? 'ok' : 'neutral' },
  ],
  note: phase === 1 ? { text: `hashCode = 31 * (31 + 1) + 2 = ${hashStored}, so P goes to bucket ${idxStored}`, tone: 'accent' } : { text: 'an equal Point hashes to the same bucket, then equals() confirms the match', tone: 'ok' },
});

// Step 3: mutating a key changes its hash, so it is no longer found.
const mutateState = (phase: 1 | 2 | 3): ArrayState => ({
  rows: table(
    [{ at: idxStored, text: 'P' }],
    phase === 1 ? [{ i: idxStored, label: 'put', tone: 'ok', up: false }] : phase === 2 ? [{ i: idxStored, label: 'stored here', tone: 'ok', up: false }, { i: idxMutated, label: 'x = 99', tone: 'accent', up: true }] : [{ i: idxStored, label: 'stored here', tone: 'ok', up: false }, { i: idxMutated, label: 'get looks here', tone: 'bad', up: true }],
  ),
  stats: [
    { label: 'Hash now', value: phase === 1 ? String(hashStored) : String(mutatedHash), tone: phase === 1 ? 'neutral' : 'bad' },
    { label: 'Bucket now', value: String(phase === 1 ? idxStored : idxMutated), tone: phase === 1 ? 'neutral' : 'bad' },
    { label: 'get(key)', value: phase === 3 ? 'null' : '-', tone: phase === 3 ? 'bad' : 'neutral' },
  ],
  note: phase === 1 ? { text: 'the entry is stored by the hash of the key as it was', tone: 'accent' } : phase === 2 ? { text: 'key.setX(99) changes the fields hashCode reads, so the hash changes', tone: 'bad' } : { text: `get hashes to bucket ${idxMutated}, the entry is still in ${idxStored}: it is lost`, tone: 'bad' },
});

// Step 4: equal hashes do not mean equal objects.
const collideState = (phase: 1 | 2): ArrayState => ({
  rows: table(phase === 1 ? [{ at: idxStored, text: 'P' }] : [{ at: idxStored, text: 'PQ' }], [{ i: idxStored, label: phase === 1 ? 'Point(1, 2)' : `Point(${sibling.x}, ${sibling.y})`, tone: phase === 1 ? 'ok' : 'accent', up: false }]),
  stats: [
    { label: 'Same hash', value: String(hashStored) },
    { label: 'equals()', value: phase === 2 ? 'false' : '-', tone: phase === 2 ? 'ok' : 'neutral' },
    { label: 'Distinct keys', value: phase === 2 ? '2' : '1', tone: 'ok' },
  ],
  note: phase === 1 ? { text: 'P is stored in its bucket', tone: 'accent' } : { text: `Point(${sibling.x}, ${sibling.y}) has the same hash but is not equal, so it chains next to P`, tone: 'ok' },
});

export default defineLesson('array', {
  slug: 'java-equals-hashcode',
  objectives: [
    { text: 'Why overriding only equals loses entries', step: 1 },
    { text: 'The contract: equal objects, equal hash codes', step: 2 },
    { text: 'Why mutable keys disappear from a map', step: 3 },
    { text: 'Why equal hash codes do not imply equal objects', step: 4 },
  ],
  steps: [
    {
      label: 'Only equals',
      title: 'The set that cannot find its own value',
      tag: 'problem',
      body: ['`set.add(new Point(1, 2))`, then `set.contains(new Point(1, 2))` returns `false` if `hashCode` was not overridden.', 'The two equal objects have different identity hashes, so they point at different buckets.'],
      keyIdea: 'A hash lookup picks the bucket first. If the bucket is wrong, `equals` never runs.',
      frames: [{ state: brokenState(1), hold: 2400 }, { state: brokenState(2), hold: 3600 }],
    },
    {
      label: 'The contract',
      title: 'Equal means same hash',
      tag: 'concept',
      body: ['If `a.equals(b)` then `a.hashCode() == b.hashCode()`. Overriding `equals` means you **must** override `hashCode` too.', '`Objects.hash(x, y)` derives both from the same fields.'],
      keyIdea: 'Compute `hashCode` from exactly the fields `equals` compares.',
      frames: [{ state: contractState(1), hold: 2600 }, { state: contractState(2), hold: 3400 }],
    },
    {
      label: 'Mutation',
      title: 'Never mutate a key',
      tag: 'trade-off',
      body: ['If a key field used in `hashCode` changes after insertion, the entry stays in its old bucket while lookups go to the new one.', 'The entry is still in the map, but unreachable.'],
      keyIdea: 'Use immutable keys: `String`, `Integer`, records.',
      frames: [{ state: mutateState(1), hold: 2000 }, { state: mutateState(2), hold: 2600 }, { state: mutateState(3), hold: 3600 }],
    },
    {
      label: 'Collisions',
      title: 'Same hash is not same key',
      tag: 'concept',
      body: ['The reverse of the contract is not required. Different objects may share a hash, which is a **collision**.', 'They sit in one bucket and `equals` separates them.'],
      keyIdea: 'hashCode narrows the search, equals decides it.',
      frames: [{ state: collideState(1), hold: 2200 }, { state: collideState(2), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'equals and hashCode',
      tag: 'recap',
      body: [
        '- **Contract:** equal objects must have equal hash codes.',
        '- **Override both:** or none, never only `equals`.',
        '- **Same fields:** compute `hashCode` from what `equals` compares.',
        '- **Collisions:** allowed, `equals` resolves them.',
        '- **Keys:** keep them immutable.',
      ],
      keyIdea: 'Lookup goes hash to bucket, then `equals` inside the bucket.',
      frames: [{ state: contractState(2) }],
    },
  ],
});
