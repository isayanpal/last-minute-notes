import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the OS notes on demand paging and page faults: a page is loaded on first access, a valid fault reads it from disk
 * and retries, an invalid one ends in SIGSEGV, and faults must be rare. The effective access time is computed with the notes' numbers:
 * 100 ns per memory access and a 10 ms fault on an HDD.
 */

const MEM_NS = 100;
const FAULT_NS = 10_000_000; // 10 ms
const eat = (faultsPer: number) => MEM_NS + FAULT_NS / faultsPer;
const ONE_IN_100K = eat(100_000);
const ONE_IN_1M = eat(1_000_000);

const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });
const ACTORS: SeqState['actors'] = [
  { id: 'p', label: 'Process', kind: 'client' },
  { id: 'mmu', label: 'MMU', kind: 'gateway' },
  { id: 'k', label: 'Kernel', kind: 'service' },
  { id: 'd', label: 'Disk', kind: 'db' },
];

const VALID: SeqMessage[] = [
  m('p', 'mmu', 'load from X'),
  m('mmu', 'k', 'page fault, P = 0', 'bad'),
  m('k', 'd', 'read the page', 'req'),
  m('d', 'k', 'page loaded', 'res', true),
  m('k', 'p', 'present = 1, retry', 'ok', true),
];
const INVALID: SeqMessage[] = [m('p', 'mmu', 'load from bad X'), m('mmu', 'k', 'page fault, P = 0', 'bad'), m('k', 'p', 'SIGSEGV', 'bad', true)];

const demand = (n: number): SeqState => ({
  actors: ACTORS,
  messages: VALID.slice(0, n),
  stats: [
    { label: 'Loaded', value: 'on first use' },
    { label: 'Present bit', value: n >= 2 ? '0' : '-', tone: n >= 2 ? 'bad' : 'neutral' },
    { label: 'In RAM now', value: 'not yet' },
  ],
  note: n >= 2 ? { text: 'the page is not in RAM, so the MMU raises a page fault', tone: 'bad' } : { text: 'with demand paging a page is loaded only when it is first accessed', tone: 'accent' },
});

const valid = (n: number): SeqState => ({
  actors: ACTORS,
  messages: VALID.slice(0, n),
  stats: [
    { label: 'Fault type', value: n >= 3 ? 'major' : n >= 2 ? '?' : '-', tone: n >= 3 ? 'bad' : 'neutral' },
    { label: 'Present bit', value: n >= 5 ? '1' : n >= 2 ? '0' : '-', tone: n >= 5 ? 'ok' : 'neutral' },
    { label: 'Instruction', value: n >= 5 ? 'restarted' : '-', tone: n >= 5 ? 'ok' : 'neutral' },
  ],
  note: n >= 5 ? { text: 'the kernel updated the page table and the faulting instruction runs again', tone: 'ok' } : n >= 3 ? { text: 'the address is valid: the kernel finds a free frame and reads the page from disk or swap', tone: 'accent' } : { text: 'the kernel first checks whether the address is valid for this process', tone: 'accent' },
});

const invalid = (n: number): SeqState => ({
  actors: ACTORS,
  messages: INVALID.slice(0, n),
  stats: [
    { label: 'Address', value: 'not mapped', tone: 'bad' },
    { label: 'Disk read', value: 'none', tone: 'ok' },
    { label: 'Result', value: n >= 3 ? 'SIGSEGV' : '-', tone: n >= 3 ? 'bad' : 'neutral' },
  ],
  note: n >= 3 ? { text: 'an unmapped address or a permission violation ends in a segmentation fault', tone: 'bad' } : { text: 'the kernel finds no mapping for this address', tone: 'accent' },
});

const cost = (rate: 'a' | 'b'): SeqState => {
  const v = rate === 'a' ? ONE_IN_100K : ONE_IN_1M;
  return {
    actors: ACTORS,
    messages: VALID,
    stats: [
      { label: 'Faults', value: rate === 'a' ? '1 per 100,000' : '1 per million' },
      { label: 'Average access', value: `${Math.round(v)} ns`, tone: v > 150 ? 'bad' : 'ok' },
      { label: 'Memory alone', value: `${MEM_NS} ns` },
    ],
    note: rate === 'a' ? { text: `one 10 ms fault per 100,000 accesses doubles the average to ${Math.round(v)} ns`, tone: 'bad' } : { text: `ten times rarer faults cost only ${Math.round(v - MEM_NS)} ns extra`, tone: 'ok' },
  };
};

export default defineLesson('sequence', {
  slug: 'os-page-faults',
  objectives: [
    { text: 'What demand paging is', step: 1 },
    { text: 'How a valid page fault is handled', step: 2 },
    { text: 'What makes a fault invalid', step: 3 },
    { text: 'Why page faults must be rare', step: 4 },
  ],
  steps: [
    {
      label: 'Demand',
      title: 'Load on first touch',
      tag: 'problem',
      body: ['With **demand paging** a page is brought into RAM only when it is first accessed.', 'Touching a page that is not present sets off a **page fault**.'],
      keyIdea: 'The present bit in the page table entry says whether a page is in RAM.',
      frames: [1, 2].map((n) => ({ state: demand(n), hold: n === 2 ? 3400 : 1600 })),
    },
    {
      label: 'Valid fault',
      title: 'The kernel loads the page',
      tag: 'concept',
      body: ['For a valid address the kernel finds a free frame (evicting one if needed), reads the page, sets the present bit, and **restarts the faulting instruction**.', 'The process never notices anything but a delay.'],
      keyIdea: 'A major fault reads from disk, a minor fault only maps a page already in RAM.',
      frames: [1, 2, 3, 4, 5].map((n) => ({ state: valid(n), hold: n === 5 ? 3600 : 1300 })),
    },
    {
      label: 'Invalid',
      title: 'SIGSEGV',
      tag: 'trade-off',
      body: ['If the address is not mapped, or the access breaks the page permissions, the fault is **invalid**.', 'The kernel does not read anything, it sends `SIGSEGV`.'],
      keyIdea: 'A segmentation fault is a page fault the kernel refused to fix.',
      frames: [1, 2, 3].map((n) => ({ state: invalid(n), hold: n === 3 ? 3600 : 1500 })),
    },
    {
      label: 'Cost',
      title: 'Why faults must be rare',
      tag: 'in practice',
      body: ['A major fault on an HDD takes about 10 ms, while a memory access takes 100 ns.', 'Even one fault per 100,000 accesses doubles the average access time.'],
      keyIdea: 'Check fault counts with `ps -o min_flt,maj_flt` or `/usr/bin/time -v`.',
      frames: [{ state: cost('a'), hold: 4200 }, { state: cost('b'), hold: 3800 }],
    },
    {
      label: 'Recap',
      title: 'Page faults',
      tag: 'recap',
      body: [
        '- **Demand paging:** load on first access.',
        '- **Valid fault:** read the page, set present, retry.',
        '- **Invalid fault:** SIGSEGV.',
        '- **Minor versus major:** mapping versus reading disk.',
        '- **Cost:** faults must be very rare.',
      ],
      keyIdea: 'Locality of reference is what keeps the fault rate low.',
      frames: [{ state: valid(5) }],
    },
  ],
});
