import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the OS notes on fork: three forks make 2^3 processes, the child gets 0 and the parent the child's pid,
 * copy-on-write copies a page only when someone writes, and a child that is not waited for stays a zombie.
 * A real process table, page table and reference count run each scenario.
 */

type Proc = { pid: number; ppid: number; state: 'R' | 'Z' | 'gone' };
let nextPid = 100;
const fork = (table: Proc[], parent: Proc): [number, number] => {
  const child: Proc = { pid: ++nextPid, ppid: parent.pid, state: 'R' };
  table.push(child);
  return [child.pid, 0]; // [value in the parent, value in the child]
};

// fork(); fork(); fork();  then print
const counts: number[] = [1];
{
  nextPid = 100;
  let procs: Proc[] = [{ pid: 100, ppid: 1, state: 'R' }];
  for (let i = 0; i < 3; i++) {
    const all: Proc[] = [];
    procs.forEach((p) => {
      all.push(p);
      fork(all, p);
    });
    procs = all;
    counts.push(procs.length);
  }
}
const PRINTS = counts[3];

// Return values of one fork.
nextPid = 100;
const demoTable: Proc[] = [{ pid: 100, ppid: 1, state: 'R' }];
const [inParent, inChild] = fork(demoTable, demoTable[0]);

// Copy-on-write: frames are shared with a reference count until a write.
class Space {
  constructor(public frames: number[]) {}
}
const refs = new Map<number, number>();
let nextFrame = 5;
const parentSpace = new Space([1, 2, 3, 4]);
parentSpace.frames.forEach((f) => refs.set(f, 1));
const childSpace = new Space([...parentSpace.frames]); // fork copies the page table, not the memory
childSpace.frames.forEach((f) => refs.set(f, (refs.get(f) ?? 0) + 1));
const framesBefore = new Set([...parentSpace.frames, ...childSpace.frames]).size;
const write = (space: Space, page: number) => {
  const f = space.frames[page];
  if ((refs.get(f) ?? 0) > 1) {
    refs.set(f, refs.get(f)! - 1);
    const copy = nextFrame++;
    refs.set(copy, 1);
    space.frames[page] = copy;
    return true;
  }
  return false;
};
const copied = write(childSpace, 1);
const framesAfter = new Set([...parentSpace.frames, ...childSpace.frames]).size;

// Zombie and orphan.
const child: Proc = { pid: 101, ppid: 100, state: 'R' };
const exited: Proc = { ...child, state: 'Z' }; // exit() without a wait() from the parent
const reaped: Proc = { ...exited, state: 'gone' }; // waitpid() collects it
const orphan: Proc = { ...child, ppid: 1 }; // parent exited first: re-parented to PID 1

const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const doubling = (k: number): ArrayState => ({
  rows: [{ label: 'processes', cells: counts.map((c, i) => (i <= k ? c : '')), states: paint(4, (i) => (i === k ? 'active' : i < k ? 'done' : 'dim')), showIndex: false }],
  stats: [
    { label: 'forks run', value: String(k) },
    { label: 'Processes', value: String(counts[k]), tone: 'ok' },
    { label: 'hi printed', value: k === 3 ? String(PRINTS) : '-', tone: k === 3 ? 'ok' : 'neutral' },
  ],
  note: k === 3 ? { text: `fork(); fork(); fork(); doubles three times: 2^3 = ${PRINTS} processes, so "hi" prints ${PRINTS} times`, tone: 'ok' } : { text: 'every process alive calls the next fork, so each fork doubles the count', tone: 'accent' },
});

const returns = (): ArrayState => ({
  rows: [
    { label: 'parent', cells: [inParent], states: { 0: 'found' }, showIndex: false },
    { label: 'child', cells: [inChild], states: { 0: 'swap' }, showIndex: false },
  ],
  stats: [
    { label: 'Parent gets', value: `pid ${inParent}`, tone: 'ok' },
    { label: 'Child gets', value: String(inChild), tone: 'ok' },
    { label: 'On failure', value: '-1' },
  ],
  note: { text: 'fork returns the child pid in the parent and 0 in the child, so the code can branch', tone: 'accent' },
});

const cow = (after: boolean): ArrayState => {
  const p = parentSpace.frames;
  const c = after ? childSpace.frames : [1, 2, 3, 4];
  return {
    rows: [
      { label: 'parent', cells: p.map((f) => `f${f}`), states: paint(4, () => 'done'), showIndex: false },
      { label: 'child', cells: c.map((f) => `f${f}`), states: paint(4, (i) => (after && i === 1 ? 'swap' : 'visited')), showIndex: false },
    ],
    stats: [
      { label: 'Frames in use', value: String(after ? framesAfter : framesBefore), tone: 'ok' },
      { label: 'Pages copied', value: after ? (copied ? '1' : '0') : '0', tone: 'ok' },
      { label: 'Fork cost', value: 'page table' },
    ],
    note: after ? { text: 'the child wrote page 2: only that page was copied into a new frame', tone: 'ok' } : { text: 'after fork both processes map the same four frames, marked read-only', tone: 'accent' },
  };
};

const lifecycle = (phase: 0 | 1 | 2): ArrayState => {
  const c = phase === 0 ? exited : phase === 1 ? reaped : orphan;
  return {
    rows: [
      { label: 'child', cells: [c.state === 'gone' ? '-' : c.state], states: { 0: c.state === 'Z' ? 'bad' : c.state === 'gone' ? 'dim' : 'found' }, showIndex: false },
      { label: 'parent pid', cells: [c.state === 'gone' ? '-' : c.ppid], states: { 0: c.ppid === 1 ? 'swap' : 'visited' }, showIndex: false },
    ],
    stats: [
      { label: 'Child state', value: c.state === 'Z' ? 'zombie' : c.state === 'gone' ? 'reaped' : 'running', tone: c.state === 'Z' ? 'bad' : 'ok' },
      { label: 'Holds a PID', value: c.state === 'gone' ? 'no' : 'yes', tone: c.state === 'Z' ? 'bad' : 'neutral' },
      { label: 'Parent', value: phase === 2 ? 'exited' : 'alive' },
    ],
    note: phase === 0 ? { text: 'the child exited but the parent never called wait: only its PCB entry and exit status remain', tone: 'bad' } : phase === 1 ? { text: 'waitpid collected the exit status and released the PID', tone: 'ok' } : { text: 'the parent exited first: the child is re-parented to PID 1, which reaps it later', tone: 'accent' },
  };
};

export default defineLesson('array', {
  slug: 'os-fork-cow',
  objectives: [
    { text: 'Why three forks make eight processes', step: 1 },
    { text: 'What fork returns in each process', step: 2 },
    { text: 'How copy-on-write avoids copying memory', step: 3 },
    { text: 'What zombies and orphans are', step: 4 },
  ],
  steps: [
    {
      label: 'Doubling',
      title: 'Three forks, eight processes',
      tag: 'problem',
      body: ['`fork()` duplicates the calling process. After `fork(); fork(); fork();` every process alive calls the next fork.', 'Each call doubles the number of processes.'],
      keyIdea: 'n forks in a row give 2^n processes.',
      frames: [0, 1, 2, 3].map((k) => ({ state: doubling(k), hold: k === 3 ? 3800 : 1400 })),
    },
    {
      label: 'Return value',
      title: 'Different answers',
      tag: 'concept',
      body: ['`fork()` returns **0 in the child** and the **child\'s pid in the parent**.', 'That is how the same code can branch, with the child calling `exec` to run a new program.'],
      keyIdea: 'Splitting fork and exec lets the child redirect files before running the program.',
      frames: [{ state: returns(), hold: 4000 }],
    },
    {
      label: 'Copy-on-write',
      title: 'Copy only on write',
      tag: 'technique',
      body: ['`fork` does not copy memory. Parent and child share the same frames, marked read-only.', 'A frame is copied only when one of them writes to it, which is why Redis can snapshot a big dataset with `fork`.'],
      keyIdea: 'Only pages modified after the fork cost memory.',
      frames: [{ state: cow(false), hold: 2800 }, { state: cow(true), hold: 4000 }],
    },
    {
      label: 'Zombies',
      title: 'Exited, not reaped',
      tag: 'trade-off',
      body: ['A **zombie** is a child that exited while the parent has not called `wait`. It uses no memory or CPU, but it holds a PID.', 'An **orphan** is a child whose parent exited, and PID 1 adopts it.'],
      keyIdea: 'Handle SIGCHLD or call wait, and enough zombies can exhaust the PID limit.',
      frames: [0, 1, 2].map((p) => ({ state: lifecycle(p as 0 | 1 | 2), hold: 3600 })),
    },
    {
      label: 'Recap',
      title: 'Processes in Unix',
      tag: 'recap',
      body: [
        '- **fork:** duplicates the process, 2^n after n forks.',
        '- **Return value:** 0 in the child, child pid in the parent.',
        '- **Copy-on-write:** share frames, copy on first write.',
        '- **Zombie:** exited, not waited for.',
        '- **Orphan:** re-parented to PID 1.',
      ],
      keyIdea: 'PID 1 in a container must reap zombies too.',
      frames: [{ state: cow(true) }],
    },
  ],
});
