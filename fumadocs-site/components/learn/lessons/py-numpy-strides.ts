import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Python notes on the ndarray memory model. A small ndarray model (a shared buffer plus shape, strides in bytes and an offset)
 * reproduces the notes: arange(12).reshape(3, 4) has strides (32, 8), a.T swaps them to (8, 32), a[:, ::2] doubles the column stride,
 * a slice is a view that writes through, and fancy indexing copies. Element addresses and the memory sizes are computed.
 */

const ITEM = 8;
class Nd {
  constructor(public buf: number[], public shape: number[], public strides: number[], public offset = 0) {}
  index(i: number, j: number) {
    return (this.offset + i * this.strides[0] + j * this.strides[1]) / ITEM;
  }
  at(i: number, j: number) {
    return this.buf[this.index(i, j)];
  }
  set(i: number, j: number, v: number) {
    this.buf[this.index(i, j)] = v;
  }
  get T() {
    return new Nd(this.buf, [this.shape[1], this.shape[0]], [this.strides[1], this.strides[0]], this.offset);
  }
  readOrder() {
    const out: number[] = [];
    for (let i = 0; i < this.shape[0]; i++) for (let j = 0; j < this.shape[1]; j++) out.push(this.index(i, j));
    return out;
  }
  sharesMemory(o: Nd) {
    return this.buf === o.buf;
  }
}
const arange = (n: number) => Array.from({ length: n }, (_, i) => i);
const a = new Nd(arange(12), [3, 4], [4 * ITEM, ITEM]);
const aT = a.T;
const every2 = new Nd(a.buf, [3, 2], [a.strides[0], a.strides[1] * 2]);
const reshaped = new Nd(a.buf, [4, 3], [3 * ITEM, ITEM]);
const ADDR = a.index(1, 2);

// a list of a million ints versus an ndarray
const N = 1_000_000;
const LIST_MB = (N * (8 + 28)) / 1e6; // pointers plus 28 bytes per int object
const ARR_MB = (N * ITEM) / 1e6;

// views and copies
const b = new Nd(a.buf, [3, 2], [a.strides[0], ITEM], ITEM); // a[:, 1:3]
b.set(0, 0, 99);
const A_AFTER_VIEW = a.buf.slice(0, 4);
const fancy = new Nd([...a.buf.slice(0, 4), ...a.buf.slice(8, 12)], [2, 4], [a.strides[0], ITEM]); // a[[0, 2]] copies
fancy.set(0, 0, -1);
const A00_AFTER_COPY = a.at(0, 0);

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;
const buffer = (vals: number[], hi: number[], label = 'buffer', tone: ItemState = 'active'): ArrayState['rows'][number] => ({ label, cells: vals, states: paint(vals.length, (i) => (hi.includes(i) ? tone : 'normal')), showIndex: true });

const memory = (): ArrayState => ({
  rows: [buffer(a.buf, [])],
  stats: [
    { label: 'a.nbytes', value: `${a.buf.length * ITEM} B` },
    { label: '1M list', value: `${LIST_MB} MB`, tone: 'bad' },
    { label: '1M ndarray', value: `${ARR_MB} MB`, tone: 'ok' },
  ],
  note: { text: 'one contiguous buffer of raw int64 values, 8 bytes each, plus a small header describing it', tone: 'accent' },
});

const address = (): ArrayState => ({
  rows: [buffer(a.buf, [ADDR])],
  stats: [
    { label: 'shape', value: `(${a.shape.join(', ')})` },
    { label: 'strides', value: `(${a.strides.join(', ')})`, tone: 'ok' },
    { label: 'a[1, 2] at', value: `byte ${ADDR * ITEM}` },
  ],
  note: { text: `a[1, 2] lives at data + 1 x ${a.strides[0]} + 2 x ${a.strides[1]} = byte ${ADDR * ITEM}, which is element ${ADDR}`, tone: 'ok' },
});

const transpose = (view: 'a' | 'T' | 'step'): ArrayState => {
  const v = view === 'a' ? a : view === 'T' ? aT : every2;
  const order = v.readOrder();
  return {
    rows: [buffer(a.buf, view === 'a' ? [] : order.slice(0, 12), 'buffer', 'found'), { label: 'read order', cells: order, states: paint(order.length, () => 'visited'), showIndex: false }],
    stats: [
      { label: 'View', value: view === 'a' ? 'a' : view === 'T' ? 'a.T' : 'a[:, ::2]' },
      { label: 'shape', value: `(${v.shape.join(', ')})` },
      { label: 'strides', value: `(${v.strides.join(', ')})`, tone: 'ok' },
    ],
    note: view === 'T' ? { text: 'a.T just swaps the strides to (8, 32): the buffer is untouched, only the read order changes', tone: 'ok' } : view === 'step' ? { text: 'a[:, ::2] doubles the column stride to 16 and reads every other element, with no copy', tone: 'ok' } : { text: 'row-major order: the last index changes fastest', tone: 'accent' },
  };
};

const views = (copy: boolean): ArrayState => ({
  rows: [buffer(copy ? a.buf.slice(0, 4) : A_AFTER_VIEW, copy ? [0] : [1], 'a[0]', copy ? 'found' : 'bad')],
  stats: [
    { label: 'Operation', value: copy ? 'a[[0, 2]]' : 'a[:, 1:3]' },
    { label: 'Shares memory', value: copy ? String(fancy.sharesMemory(a)) : String(b.sharesMemory(a)), tone: copy ? 'ok' : 'bad' },
    { label: 'a[0] after write', value: copy ? `a[0,0] = ${A00_AFTER_COPY}` : `[${A_AFTER_VIEW.join(', ')}]`, tone: copy ? 'ok' : 'bad' },
  ],
  note: copy ? { text: 'fancy indexing returns a copy: writing -1 into it leaves a[0, 0] at 0', tone: 'ok' } : { text: 'b = a[:, 1:3] is a view: writing 99 through b changed the original a', tone: 'bad' },
});

export default defineLesson('array', {
  slug: 'py-numpy-strides',
  objectives: [
    { text: 'Why an ndarray is smaller and faster than a list', step: 1 },
    { text: 'How strides locate an element', step: 2 },
    { text: 'Why transpose and slicing do not copy', step: 3 },
    { text: 'When you get a view and when a copy', step: 4 },
  ],
  steps: [
    {
      label: 'Buffer',
      title: 'One block of raw numbers',
      tag: 'problem',
      body: ['A list of a million ints is a million pointers to a million int objects. An `ndarray` is **one contiguous buffer** of raw 8-byte values plus a small header.', 'That is about 36 MB against 8 MB, and the loop runs in compiled C.'],
      keyIdea: 'No per-element type dispatch, no per-element objects, cache-friendly memory.',
      frames: [{ state: memory(), hold: 4400 }],
    },
    {
      label: 'Strides',
      title: 'Bytes to the next row, next column',
      tag: 'concept',
      body: ['The header stores `shape`, `dtype` and **strides**. For `arange(12).reshape(3, 4)` the strides are `(32, 8)`.', '`a[i, j]` lives at `data + i * 32 + j * 8`.'],
      keyIdea: 'C order is row-major: the last index changes fastest.',
      frames: [{ state: address(), hold: 4400 }],
    },
    {
      label: 'No copy',
      title: 'Change the header, not the data',
      tag: 'technique',
      body: ['`a.T` swaps the strides to `(8, 32)`. `a[:, ::2]` doubles the column stride. `reshape` recomputes strides.', 'No data moves, so these are O(1).'],
      keyIdea: 'They return views that share the same buffer.',
      frames: [{ state: transpose('a'), hold: 2400 }, { state: transpose('T'), hold: 3800 }, { state: transpose('step'), hold: 3800 }],
    },
    {
      label: 'Views, copies',
      title: 'A write may change the original',
      tag: 'trade-off',
      body: ['Basic slicing is a **view**, so writing through it changes the original array. Boolean masks and fancy indexing **copy**.', 'If the selection is not a regular stride pattern, NumPy has to copy.'],
      keyIdea: '`np.shares_memory` answers the question. A small view of a huge array keeps the whole buffer alive.',
      frames: [{ state: views(false), hold: 4200 }, { state: views(true), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'The ndarray model',
      tag: 'recap',
      body: [
        '- **Header:** dtype, shape, strides, data pointer.',
        '- **Buffer:** one contiguous block.',
        '- **Strides:** bytes to step along each axis.',
        '- **Views:** slicing, `.T`, reshape when possible.',
        '- **Copies:** masks, fancy indexing, `.copy()`.',
      ],
      keyIdea: 'Iterate along the contiguous axis to use whole cache lines.',
      frames: [{ state: address() }],
    },
  ],
});
