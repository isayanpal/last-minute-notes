import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Python notes on the compact dict: a small sparse index table points into a dense entries array kept in insertion order.
 * A real model uses CPython's probe (i = (5 * i + perturb + 1) & mask, perturb >>= 5) with int keys, where hash(n) is n, resizes when the
 * table is two thirds full, and keeps the entries order, so every slot, probe path and the new table are computed.
 */

type Entry = { key: number };
class PyDict {
  size = 8;
  indices: number[] = Array(8).fill(-1);
  entries: Entry[] = [];
  usable() {
    return Math.floor((this.size * 2) / 3);
  }
  probe(key: number): { slot: number; path: number[]; found: boolean } {
    const mask = this.size - 1;
    let i = key & mask;
    let perturb = key;
    const path = [i];
    while (this.indices[i] !== -1) {
      if (this.entries[this.indices[i]].key === key) return { slot: i, path, found: true };
      i = (5 * i + perturb + 1) & mask;
      perturb >>>= 5;
      if (path[path.length - 1] !== i) path.push(i);
    }
    return { slot: i, path, found: false };
  }
  insert(key: number) {
    let resized = false;
    if (this.entries.length >= this.usable()) {
      this.size = 16; // the table grows (used x 3 rounded up to a power of two)
      this.indices = Array(this.size).fill(-1);
      this.entries.forEach((e, n) => (this.indices[this.probe(e.key).slot] = n)); // reinsert in entry order
      resized = true;
    }
    const p = this.probe(key);
    this.indices[p.slot] = this.entries.length;
    this.entries.push({ key });
    return { ...p, resized };
  }
  clone() {
    const d = new PyDict();
    d.size = this.size;
    d.indices = [...this.indices];
    d.entries = this.entries.map((e) => ({ ...e }));
    return d;
  }
}

const KEYS = [3, 5, 11, 8, 14, 22];
const d = new PyDict();
const trace = KEYS.map((k) => {
  const r = d.insert(k);
  return { key: k, ...r, snap: d.clone() };
});
const T = (key: number) => trace.find((t) => t.key === key)!;

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const view = (snap: PyDict, hi: { slot?: number; path?: number[] } = {}, note: ArrayState['note'], stats: ArrayState['stats']): ArrayState => ({
  rows: [
    { label: 'indices', cells: snap.indices.map((x) => (x === -1 ? '' : x)), states: paint(snap.size, (i) => (i === hi.slot ? 'active' : snap.indices[i] === -1 ? 'dim' : 'done')), pointers: (hi.path ?? []).map((p, k) => ({ i: p, label: k === 0 ? 'hash' : `p${k}`, tone: p === hi.slot ? ('ok' as const) : ('bad' as const), up: true })), showIndex: true },
    { label: 'entries', cells: snap.entries.map((e) => e.key), states: paint(snap.entries.length, (i) => (hi.slot !== undefined && snap.indices[hi.slot] === i ? 'found' : 'visited')), showIndex: false },
  ],
  stats,
  note,
});

const showFirst = (k: number): ArrayState => {
  const t = trace[k];
  return view(t.snap, { slot: t.slot, path: t.path }, { text: `key ${t.key}: slot ${t.key & 7} is free, so indices[${t.slot}] = ${t.snap.entries.length - 1}`, tone: 'accent' }, [
    { label: 'Key', value: String(t.key) },
    { label: 'Entry number', value: String(t.snap.entries.length - 1) },
    { label: 'Table size', value: String(t.snap.size) },
  ]);
};

export default defineLesson('array', {
  slug: 'py-dict-internals',
  objectives: [
    { text: 'How indices and entries split the work', step: 1 },
    { text: 'How a collision is probed', step: 2 },
    { text: 'When and how the table resizes', step: 3 },
    { text: 'How lookup and iteration order work', step: 4 },
  ],
  steps: [
    {
      label: 'Two arrays',
      title: 'Sparse index, dense entries',
      tag: 'problem',
      body: ['Since 3.6 a dict has a small, sparse **index table** and a dense **entries array** in insertion order.', 'The index table holds only small integers: the position of the entry. Here int keys hash to themselves.'],
      keyIdea: 'Insertion order is a language guarantee since 3.7.',
      frames: [0, 1].map((k) => ({ state: showFirst(k), hold: 2800 })),
    },
    {
      label: 'Collision',
      title: 'Probe for another slot',
      tag: 'concept',
      body: [`Key 11 also hashes to slot ${11 & 7}, which is taken by key 3. CPython probes with a perturbed sequence, so it moves on to slot ${T(11).slot}.`, 'Lookup compares the stored hash first, then `==`.'],
      keyIdea: 'Open addressing: the entries array never moves, only the index slot differs.',
      frames: [{ state: view(T(11).snap, { slot: T(11).slot, path: T(11).path }, { text: `probe path ${T(11).path.join(' then ')}: slot ${T(11).slot} is free, entry 2 lives there`, tone: 'ok' }, [{ label: 'Hash slot', value: String(11 & 7), tone: 'bad' }, { label: 'Probe path', value: T(11).path.join(', ') }, { label: 'Stored at', value: `indices[${T(11).slot}]`, tone: 'ok' }]), hold: 4400 }],
    },
    {
      label: 'Resize',
      title: 'Grow at two thirds full',
      tag: 'technique',
      body: [`A table of 8 can hold ${new PyDict().usable()} entries. The sixth insert finds it full, grows the table to 16 and rebuilds the indices.`, 'The entries array is **not** reordered, so insertion order survives.'],
      keyIdea: 'Inserts are amortized O(1) because resizes are rare.',
      frames: [{ state: view(T(14).snap, { slot: T(14).slot, path: T(14).path }, { text: `after 5 inserts the table is full: ${T(14).snap.entries.length} of ${T(14).snap.usable()} usable entries`, tone: 'accent' }, [{ label: 'Entries', value: `${T(14).snap.entries.length} of ${T(14).snap.usable()}` }, { label: 'Table size', value: String(T(14).snap.size) }, { label: 'Next insert', value: 'resizes', tone: 'bad' }]), hold: 3000 }, { state: view(T(22).snap, { slot: T(22).slot, path: T(22).path }, { text: 'the table doubled to 16, indices were rebuilt from the entries in order, then 22 was inserted', tone: 'ok' }, [{ label: 'Resized', value: String(T(22).resized), tone: 'ok' }, { label: 'Table size', value: String(T(22).snap.size) }, { label: 'Entries order', value: 'unchanged', tone: 'ok' }]), hold: 4400 }],
    },
    {
      label: 'Lookup',
      title: 'Hash, probe, compare',
      tag: 'in practice',
      body: ['A lookup hashes the key, probes the index table, and compares the stored hash and then `==` with the entry.', 'Iteration just walks the dense entries array, which is why order is insertion order.'],
      keyIdea: 'Worst case is O(n) if many keys collide, and string hashing is randomised per process to stop attacks.',
      frames: [(() => {
        const found = d.probe(11);
        return { state: view(d, { slot: found.slot, path: found.path }, { text: `get(11): hash slot ${found.path[0]}, found entry ${d.indices[found.slot]} at indices[${found.slot}]`, tone: 'ok' }, [{ label: 'Probe path', value: found.path.join(', ') }, { label: 'Found entry', value: String(d.indices[found.slot]), tone: 'ok' }, { label: 'Iteration', value: d.entries.map((e) => e.key).join(' ') }]), hold: 4600 };
      })()],
    },
    {
      label: 'Recap',
      title: 'The compact dict',
      tag: 'recap',
      body: [
        '- **Indices:** sparse table of small ints.',
        '- **Entries:** dense array in insertion order.',
        '- **Collisions:** perturbed open addressing.',
        '- **Resize:** at about two thirds full, order kept.',
        '- **Keys:** hashable, equal keys have equal hashes.',
      ],
      keyIdea: '`1`, `1.0` and `True` are the same key.',
      frames: [{ state: view(d, {}, { text: 'two arrays: lookups go through indices, iteration goes through entries', tone: 'accent' }, [{ label: 'Entries', value: String(d.entries.length) }, { label: 'Table size', value: String(d.size) }, { label: 'Order', value: 'insertion' }]) }],
    },
  ],
});
