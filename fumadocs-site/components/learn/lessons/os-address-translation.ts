import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the OS notes on paging and the TLB: split a 32-bit virtual address into page number and offset, look the page up,
 * and build the physical address. The notes' own example runs for real (0x00403ABC, page 0x403 in frame 0x2F),
 * and the effective access times use 20 ns for the TLB and 100 ns for memory.
 */

const PAGE_BITS = 12;
const VA = 0x00403abc;
const PAGE_TABLE = new Map<number, number>([[0x403, 0x2f]]);

const offset = VA & ((1 << PAGE_BITS) - 1);
const page = VA >>> PAGE_BITS;
const frame = PAGE_TABLE.get(page)!;
const PA = ((frame << PAGE_BITS) | offset) >>> 0;
const hex8 = (n: number) => n.toString(16).toUpperCase().padStart(8, '0');
const VA_DIGITS = hex8(VA).split('');
const PA_DIGITS = hex8(PA).split('');

// Flat page table: 2^20 pages x 4 bytes.
const FLAT_ENTRIES = 2 ** (32 - PAGE_BITS);
const FLAT_MB = (FLAT_ENTRIES * 4) / 2 ** 20;

// Effective access time with a TLB.
const TLB = 20;
const MEM = 100;
const eat = (hit: number) => hit * (TLB + MEM) + (1 - hit) * (TLB + MEM + MEM);

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const flat = (): ArrayState => ({
  rows: [{ label: 'virtual', cells: VA_DIGITS, states: paint(8, () => 'normal'), showIndex: false }],
  stats: [
    { label: 'Address bits', value: '32' },
    { label: 'Pages (2^20)', value: FLAT_ENTRIES.toLocaleString('en-US') },
    { label: 'Flat table', value: `${FLAT_MB} MB`, tone: 'bad' },
  ],
  note: { text: `one flat page table needs ${FLAT_MB} MB per process, mostly describing memory the process never uses`, tone: 'bad' },
});

const split = (): ArrayState => ({
  rows: [{ label: 'virtual', cells: VA_DIGITS, states: paint(8, (i) => (i < 5 ? 'visited' : 'swap')), window: { from: 0, to: 4, label: 'page number, 20 bits', tone: 'info' }, showIndex: false }],
  stats: [
    { label: 'Offset', value: `0x${offset.toString(16).toUpperCase()}`, tone: 'ok' },
    { label: 'Page number', value: `0x${page.toString(16).toUpperCase()} = ${page}`, tone: 'ok' },
    { label: 'Page size', value: '4 KB' },
  ],
  note: { text: 'the low 12 bits are the offset inside a 4 KB page, the rest is the page number', tone: 'accent' },
});

const lookup = (done: boolean): ArrayState => ({
  rows: [
    { label: 'virtual', cells: VA_DIGITS, states: paint(8, (i) => (i < 5 ? 'visited' : 'swap')), showIndex: false },
    { label: 'physical', cells: done ? PA_DIGITS : ['', '', '', '', '', '', '', ''], states: paint(8, (i) => (!done ? 'dim' : i < 5 ? 'found' : 'swap')), showIndex: false },
  ],
  panels: [{ title: 'page table', kind: 'list', items: [`0x${page.toString(16).toUpperCase()} -> 0x${frame.toString(16).toUpperCase()}`], highlight: 0 }],
  stats: [
    { label: 'Frame', value: `0x${frame.toString(16).toUpperCase()}`, tone: 'ok' },
    { label: 'Offset', value: `0x${offset.toString(16).toUpperCase()}` },
    { label: 'Physical', value: done ? `0x${hex8(PA)}` : '-', tone: done ? 'ok' : 'neutral' },
  ],
  note: done ? { text: 'frame number followed by the unchanged offset gives the physical address', tone: 'ok' } : { text: 'the page table maps page 0x403 to frame 0x2F', tone: 'accent' },
});

const tlb = (hit: number): ArrayState => ({
  rows: [
    { label: 'TLB hit', cells: [TLB, MEM], states: paint(2, () => 'found'), showIndex: false },
    { label: 'TLB miss', cells: [TLB, MEM, MEM], states: paint(3, (i) => (i === 1 ? 'bad' : 'visited')), showIndex: false },
  ],
  stats: [
    { label: 'Hit ratio', value: `${Math.round(hit * 100)}%` },
    { label: 'Hit costs', value: `${TLB + MEM} ns`, tone: 'ok' },
    { label: 'Average', value: `${Math.round(eat(hit) * 10) / 10} ns`, tone: hit > 0.9 ? 'ok' : 'bad' },
  ],
  note: { text: `miss adds a page table read: ${TLB + MEM + MEM} ns. At ${Math.round(hit * 100)}% hits the average is ${Math.round(eat(hit) * 10) / 10} ns`, tone: hit > 0.9 ? 'ok' : 'accent' },
});

export default defineLesson('array', {
  slug: 'os-address-translation',
  objectives: [
    { text: 'Why a flat page table is too big', step: 1 },
    { text: 'How an address splits into page number and offset', step: 2 },
    { text: 'How the page table builds the physical address', step: 3 },
    { text: 'Why the TLB hit ratio matters', step: 4 },
  ],
  steps: [
    {
      label: 'Table size',
      title: 'A flat table is huge',
      tag: 'problem',
      body: ['With 32-bit addresses and 4 KB pages there are 2^20 pages. At 4 bytes per entry a flat table is **4 MB per process**.', 'On 64-bit systems a flat table is impossible, so page tables are hierarchical.'],
      keyIdea: 'Virtual memory needs a compact map from pages to frames.',
      frames: [{ state: flat(), hold: 4000 }],
    },
    {
      label: 'Split',
      title: 'Page number and offset',
      tag: 'concept',
      body: ['Virtual memory is cut into fixed-size **pages** and physical memory into **frames** of the same size.', 'The low 12 bits are the offset, and the high 20 bits are the page number.'],
      keyIdea: 'The offset is never translated, only the page number is.',
      frames: [{ state: split(), hold: 4000 }],
    },
    {
      label: 'Lookup',
      title: 'Page to frame',
      tag: 'technique',
      body: ['The page table says page `0x403` lives in frame `0x2F`.', 'The physical address is the frame number followed by the same offset: `0x0002FABC`.'],
      keyIdea: 'Translation replaces the high bits and keeps the low bits.',
      frames: [{ state: lookup(false), hold: 2600 }, { state: lookup(true), hold: 3800 }],
    },
    {
      label: 'TLB',
      title: 'Cache the translations',
      tag: 'in practice',
      body: ['A page walk costs extra memory reads on every access, so the CPU caches recent translations in the **TLB**.', 'With a 20 ns TLB and 100 ns memory, a hit costs 120 ns and a miss 220 ns.'],
      keyIdea: 'TLB hit rates near 99 percent are essential.',
      frames: [{ state: tlb(0.8), hold: 3600 }, { state: tlb(0.99), hold: 3800 }],
    },
    {
      label: 'Recap',
      title: 'Address translation',
      tag: 'recap',
      body: [
        '- **Pages and frames:** fixed-size blocks, 4 KB on x86-64.',
        '- **Address:** page number plus offset.',
        '- **Page table:** page number to frame number.',
        '- **Multi-level tables:** only allocate what is used.',
        '- **TLB:** caches translations, hit ratio drives speed.',
      ],
      keyIdea: 'Huge pages cover more memory per TLB entry.',
      frames: [{ state: lookup(true) }],
    },
  ],
});
