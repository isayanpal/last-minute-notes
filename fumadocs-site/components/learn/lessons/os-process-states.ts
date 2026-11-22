import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the OS notes on process states and context switching. The state after each event is computed by folding the events
 * through a real transition table, so an event that does not start from the current state throws. The ps codes and the context switch
 * steps come from the notes.
 */

type St = 'New' | 'Ready' | 'Running' | 'Waiting' | 'Terminated';
type Ev = { name: string; from: St; to: St };
const EVENTS: Ev[] = [
  { name: 'admitted', from: 'New', to: 'Ready' },
  { name: 'dispatch', from: 'Ready', to: 'Running' },
  { name: 'preempted', from: 'Running', to: 'Ready' },
  { name: 'dispatch', from: 'Ready', to: 'Running' },
  { name: 'read() blocks', from: 'Running', to: 'Waiting' },
  { name: 'I/O done', from: 'Waiting', to: 'Ready' },
  { name: 'dispatch', from: 'Ready', to: 'Running' },
  { name: 'exit', from: 'Running', to: 'Terminated' },
];
const stateAt = (k: number) => {
  let cur: St = 'New';
  let prev: St | null = null;
  let ev: Ev | null = null;
  for (let i = 0; i < k; i++) {
    if (EVENTS[i].from !== cur) throw new Error(`${EVENTS[i].name} does not start from ${cur}`);
    prev = cur;
    cur = EVENTS[i].to;
    ev = EVENTS[i];
  }
  return { cur, prev, ev };
};

const POS: Record<St, { x: number; y: number }> = {
  New: { x: 0.1, y: 1.7 },
  Ready: { x: 2.0, y: 0.5 },
  Running: { x: 3.9, y: 1.7 },
  Waiting: { x: 2.0, y: 3.0 },
  Terminated: { x: 5.8, y: 1.7 },
};
const SUB: Record<St, string> = { New: 'being created', Ready: 'waits for a CPU', Running: 'on a CPU', Waiting: 'blocked on I/O', Terminated: 'finished' };
const PS: Record<St, string> = { New: '-', Ready: 'R', Running: 'R', Waiting: 'S', Terminated: 'Z until reaped' };
const ORDER: St[] = ['New', 'Ready', 'Running', 'Waiting', 'Terminated'];
const SWITCH = ['save PCB', 'pick next', 'load CR3', 'restore'];

const view = (k: number, chips = 0): FlowState => {
  const { cur, prev, ev } = stateAt(k);
  const packets: Packet[] = prev && ev ? [{ from: prev, to: cur, label: ev.name, tone: cur === 'Waiting' ? 'bad' : cur === 'Running' ? 'ok' : 'data', dur: 0.7 }] : [];
  return {
    nodes: ORDER.map((s) => ({ id: s, label: s, sub: SUB[s], kind: s === 'Running' ? 'worker' : s === 'New' ? 'client' : s === 'Terminated' ? 'storage' : 'queue', x: POS[s].x, y: POS[s].y, status: s === cur ? 'active' : 'dim', items: s === 'Running' && chips ? SWITCH.slice(0, chips) : undefined })),
    links: [
      { from: 'New', to: 'Ready' },
      { from: 'Ready', to: 'Running' },
      { from: 'Running', to: 'Ready', dashed: true },
      { from: 'Running', to: 'Waiting' },
      { from: 'Waiting', to: 'Ready', dashed: true },
      { from: 'Running', to: 'Terminated' },
    ],
    packets,
    stats: [
      { label: 'State', value: cur, tone: cur === 'Waiting' ? 'bad' : 'ok' },
      { label: 'Event', value: ev ? ev.name : '-' },
      { label: 'ps code', value: PS[cur] },
    ],
    note:
      chips > 0
        ? { text: `context switch: ${SWITCH.slice(0, chips).join(', ')}`, tone: 'accent' }
        : cur === 'New'
          ? { text: 'the process is being created', tone: 'accent' }
          : ev?.name === 'preempted'
            ? { text: 'the time slice ended or a higher priority task arrived: back to the ready queue', tone: 'accent' }
            : cur === 'Waiting'
              ? { text: 'a blocking call puts the process to sleep until the event happens', tone: 'bad' }
              : cur === 'Running'
                ? { text: 'the scheduler dispatched it: one process per CPU runs', tone: 'ok' }
                : cur === 'Ready'
                  ? { text: 'ready to run, waiting for the scheduler to pick it', tone: 'accent' }
                  : { text: 'the process exited and waits to be reaped by its parent', tone: 'neutral' },
  };
};

export default defineLesson('flow', {
  slug: 'os-process-states',
  objectives: [
    { text: 'What New, Ready and Running mean', step: 1 },
    { text: 'What a context switch saves and restores', step: 2 },
    { text: 'How a process moves between Running and Waiting', step: 3 },
    { text: 'Why a high load average can mean stuck I/O', step: 4 },
  ],
  steps: [
    {
      label: 'Ready, Running',
      title: 'Waiting for a CPU',
      tag: 'problem',
      body: ['A new process is **admitted** to the ready queue. Only the scheduler\'s **dispatch** moves it to Running.', 'On Linux both Ready and Running show as `R` in `ps`.'],
      keyIdea: 'Ready means able to run, Running means actually on a CPU.',
      frames: [0, 1, 2].map((k) => ({ state: view(k), hold: k === 2 ? 3400 : 1800 })),
    },
    {
      label: 'Switch',
      title: 'Preempt and context switch',
      tag: 'concept',
      body: ['When the time slice ends, the kernel **preempts** the process. A context switch saves its registers in the PCB, picks the next task, switches the page table and restores the next one.', 'The direct cost is a few microseconds, and cold caches and the TLB add more.'],
      keyIdea: 'A system call changes mode in the same task, a context switch changes which task runs.',
      frames: [{ state: view(3), hold: 2600 }, ...[1, 2, 3, 4].map((c) => ({ state: view(4, c), hold: c === 4 ? 3200 : 1200 }))],
    },
    {
      label: 'Waiting',
      title: 'Blocked on I/O',
      tag: 'technique',
      body: ['A blocking `read()` moves the process to **Waiting**. When the data arrives it goes back to Ready, not straight to Running.', 'Waiting on I/O costs no CPU, so another process runs meanwhile.'],
      keyIdea: 'Every wait ends by returning to Ready.',
      frames: [5, 6].map((k) => ({ state: view(k), hold: 2800 })),
    },
    {
      label: 'ps codes',
      title: 'Reading S, D and Z',
      tag: 'in practice',
      body: ['`R` is runnable, `S` is an interruptible sleep, `D` is an uninterruptible sleep (usually disk or NFS I/O) and `Z` is a zombie.', 'Linux load average counts `R` **and** `D`, so high load with idle CPUs often means processes stuck on I/O.'],
      keyIdea: 'A `D` process cannot be killed until its I/O returns.',
      frames: [{ state: view(7), hold: 3000 }, { state: view(8), hold: 3600 }],
    },
    {
      label: 'Recap',
      title: 'Process lifecycle',
      tag: 'recap',
      body: [
        '- **New to Ready:** admitted.',
        '- **Ready to Running:** dispatched by the scheduler.',
        '- **Running to Ready:** preempted.',
        '- **Running to Waiting:** blocked on I/O or an event.',
        '- **Terminated:** exited, waiting to be reaped.',
      ],
      keyIdea: 'The scheduler only chooses among Ready processes.',
      frames: [{ state: view(8) }],
    },
  ],
});
