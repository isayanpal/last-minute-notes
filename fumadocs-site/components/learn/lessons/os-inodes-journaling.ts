import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the OS notes on inodes, links and crash consistency. A real inode model counts links and open files and frees data only when
 * both reach zero. A real crash simulator then stops an append (data block, inode, bitmap) after every write, with and without a journal,
 * and checks consistency, so every outcome is computed.
 */

// Part 1: link count and open file count decide when data is freed.
type Inode = { links: number; open: number; freed: boolean };
type Op = { label: string; apply: (i: Inode) => void };
const OPS: Op[] = [
  { label: 'new', apply: (i) => (i.links = 1) },
  { label: 'ln', apply: (i) => i.links++ },
  { label: 'rm a', apply: (i) => i.links-- },
  { label: 'open', apply: (i) => i.open++ },
  { label: 'rm b', apply: (i) => i.links-- },
  { label: 'close', apply: (i) => i.open-- },
];
const states: Inode[] = [];
{
  const ino: Inode = { links: 0, open: 0, freed: false };
  for (const op of OPS) {
    op.apply(ino);
    ino.freed = ino.links === 0 && ino.open === 0; // data is freed only when nothing names it and nothing has it open
    states.push({ ...ino });
  }
}

// Part 2: an append writes the data block, the inode and the bitmap.
type Writes = Set<'data' | 'inode' | 'bitmap'>;
const WRITE_ORDER: ('data' | 'inode' | 'bitmap')[] = ['data', 'inode', 'bitmap'];
const consistent = (w: Writes) => w.has('inode') === w.has('bitmap'); // inode and bitmap must agree about the new block
const noJournal = [0, 1, 2, 3].map((k) => ({ k, ok: consistent(new Set(WRITE_ORDER.slice(0, k))) }));
// Journal: crash points 0..5 = [log, commit, data, inode, bitmap]; a committed log is replayed, an uncommitted one is dropped.
const journal = [0, 1, 2, 3, 4, 5].map((k) => {
  const committed = k >= 2;
  const state = committed ? new Set(WRITE_ORDER) : new Set<'data' | 'inode' | 'bitmap'>(); // after recovery: all of it, or none of it
  return { k, ok: consistent(state) };
});

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const links = (k: number, note: ArrayState['note']): ArrayState => {
  const s = states[k - 1];
  return {
    rows: [
      { label: 'op', cells: OPS.map((o, i) => (i < k ? o.label : '')), states: paint(6, (i) => (i === k - 1 ? 'active' : i < k ? 'done' : 'dim')), showIndex: false },
      { label: 'link count', cells: states.map((x, i) => (i < k ? x.links : '')), states: paint(6, (i) => (i < k ? (states[i].links === 0 ? 'bad' : 'visited') : 'dim')), showIndex: false },
      { label: 'open fds', cells: states.map((x, i) => (i < k ? x.open : '')), states: paint(6, (i) => (i < k ? (states[i].open ? 'swap' : 'normal') : 'dim')), showIndex: false },
      { label: 'data', cells: states.map((x, i) => (i < k ? (x.freed ? 'freed' : 'kept') : '')), states: paint(6, (i) => (i < k ? (states[i].freed ? 'bad' : 'found') : 'dim')), showIndex: false },
    ],
    stats: [
      { label: 'Link count', value: String(s.links) },
      { label: 'Open fds', value: String(s.open) },
      { label: 'Data', value: s.freed ? 'freed' : 'kept', tone: s.freed ? 'bad' : 'ok' },
    ],
    note,
  };
};

const crash = (mode: 'none' | 'journal', note: ArrayState['note']): ArrayState => {
  const rows: ArrayState['rows'] =
    mode === 'none'
      ? [
          { label: 'crash at', cells: ['0', 'data', 'inode', 'bmap'], states: paint(4, () => 'normal'), showIndex: false },
          { label: 'no journal', cells: noJournal.map((x) => (x.ok ? 'ok' : 'bad')), states: paint(4, (i) => (noJournal[i].ok ? 'found' : 'bad')), showIndex: false },
        ]
      : [
          { label: 'crash at', cells: ['0', 'log', 'cmt', 'data', 'inode', 'bmap'], states: paint(6, () => 'normal'), showIndex: false },
          { label: 'journal', cells: journal.map((x) => (x.ok ? 'ok' : 'bad')), states: paint(6, (i) => (journal[i].ok ? 'found' : 'bad')), showIndex: false },
        ];
  const bad = (mode === 'none' ? noJournal : journal).filter((x) => !x.ok).length;
  return {
    rows,
    stats: [
      { label: 'Crash points', value: String(mode === 'none' ? noJournal.length : journal.length) },
      { label: 'Inconsistent', value: String(bad), tone: bad ? 'bad' : 'ok' },
      { label: 'Recovery', value: mode === 'none' ? 'fsck scan' : 'replay log', tone: mode === 'none' ? 'neutral' : 'ok' },
    ],
    note,
  };
};

export default defineLesson('array', {
  slug: 'os-inodes-journaling',
  objectives: [
    { text: 'What a link count measures', step: 1 },
    { text: 'Why deleting an open file does not free space', step: 2 },
    { text: 'What goes wrong when a crash splits an append', step: 3 },
    { text: 'How a journal makes updates all-or-nothing', step: 4 },
  ],
  steps: [
    {
      label: 'Links',
      title: 'Names point at an inode',
      tag: 'problem',
      body: ['An **inode** holds everything about a file except its name. Directory entries are names that point at it, and the **link count** counts them.', '`ln` adds a hard link, and `rm` removes one name.'],
      keyIdea: 'Removing a name only decrements the link count.',
      frames: [1, 2, 3].map((k) => ({ state: links(k, k === 1 ? { text: 'one name, link count 1', tone: 'accent' } : k === 2 ? { text: 'a second name for the same inode: link count 2', tone: 'accent' } : { text: 'removing one name leaves the data, because a name still points at it', tone: 'ok' }), hold: k === 3 ? 3400 : 1800 })),
    },
    {
      label: 'Open files',
      title: 'Deleted but still open',
      tag: 'trade-off',
      body: ['Data is freed only when the link count is zero **and** no process has the file open.', 'Deleting a huge log that a process still writes to frees nothing, and `lsof +L1` finds such files.'],
      keyIdea: 'A full disk after rm usually means a process still holds the file open.',
      frames: [4, 5, 6].map((k) => ({ state: links(k, k === 4 ? { text: 'a process opens the file', tone: 'accent' } : k === 5 ? { text: 'link count is 0, but one fd is open: the data is kept', tone: 'accent' } : { text: 'the last fd closed: now the data is freed', tone: 'ok' }), hold: k === 6 ? 3600 : 2000 })),
    },
    {
      label: 'Crash',
      title: 'An append is three writes',
      tag: 'concept',
      body: ['Appending a block updates the data block, the inode and the bitmap. A crash between them leaves the file system inconsistent.', 'Without a journal, stopping after the inode but before the bitmap (bmap) is a bad crash point.'],
      keyIdea: 'Old fix: fsck scans the whole disk after a crash, which is slow.',
      frames: [{ state: crash('none', { text: 'the inode points at a block the bitmap still calls free', tone: 'bad' }), hold: 4600 }],
    },
    {
      label: 'Journal',
      title: 'Log first, then apply',
      tag: 'technique',
      body: ['**Journaling** writes the intended changes to a log and commits it (cmt) before touching the real structures.', 'After a crash, a committed log is replayed and an uncommitted one is dropped, so the update is all or nothing.'],
      keyIdea: 'This is the same write-ahead logging idea databases use.',
      frames: [{ state: crash('journal', { text: 'every crash point recovers to a consistent state', tone: 'ok' }), hold: 4600 }],
    },
    {
      label: 'Recap',
      title: 'Inodes and journaling',
      tag: 'recap',
      body: [
        '- **Inode:** all metadata except the name.',
        '- **Link count:** names pointing at the inode.',
        '- **Free:** link count 0 and no open fds.',
        '- **Crash:** multi-write updates can leave a mess.',
        '- **Journal or copy-on-write:** all or nothing.',
      ],
      keyIdea: 'ext4 defaults to ordered mode: data first, then metadata commits.',
      frames: [{ state: crash('journal', { text: 'journaling turns three writes into one atomic update', tone: 'ok' }) }],
    },
  ],
});
