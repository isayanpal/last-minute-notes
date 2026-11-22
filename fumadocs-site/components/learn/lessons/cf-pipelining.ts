import { defineLesson } from '../define';
import type { GridState } from '../engines/grid';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on pipelining: five stages overlap, n instructions take k + (n - 1) cycles, a RAW hazard stalls
 * without forwarding, and forwarding removes the stall except for a load-use hazard. A real in-order schedule builder produces every cell.
 * Model: register writes land in the first half of WB and reads in the second half of ID, so without forwarding the consumer's ID waits for the producer's WB.
 */

type Instr = { name: string; dest?: string; srcs?: string[]; load?: boolean };

/** Stall cycles an instruction needs because of the producer `d` instructions earlier. */
const stallFor = (consumer: Instr, producer: Instr | undefined, d: number, forwarding: boolean): number => {
  if (!producer?.dest || !consumer.srcs?.includes(producer.dest)) return 0;
  if (!forwarding) return Math.max(0, 3 - d);
  return producer.load ? Math.max(0, 2 - d) : 0;
};

function build(instrs: Instr[], forwarding: boolean) {
  const stalls = instrs.map((ins, i) => Math.max(0, ...[1, 2, 3].map((d) => stallFor(ins, instrs[i - d], d, forwarding))));
  let start = 1;
  const rows: { start: number; stall: number }[] = [];
  instrs.forEach((_, i) => {
    rows.push({ start, stall: stalls[i] });
    start += 1 + stalls[i]; // a stall delays everything behind it
  });
  const last = rows[rows.length - 1];
  const cycles = last.start + 4 + last.stall;
  const cells: string[][] = instrs.map((_, i) => {
    const r = rows[i];
    const line = Array(cycles).fill('');
    line[r.start - 1] = 'IF';
    line[r.start] = 'ID';
    for (let s = 0; s < r.stall; s++) line[r.start + 1 + s] = 'st';
    ['EX', 'MEM', 'WB'].forEach((st, k) => (line[r.start + 1 + r.stall + k] = st));
    return line;
  });
  return { cells, cycles, stalls: stalls.reduce((a, b) => a + b, 0) };
}

const view = (instrs: Instr[], forwarding: boolean, note: GridState['note'], extra: GridState['stats']): GridState => {
  const b = build(instrs, forwarding);
  const states: Record<string, ItemState> = {};
  b.cells.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v) states[`${r},${c}`] = v === 'st' ? 'bad' : v === 'WB' ? 'found' : v === 'IF' ? 'active' : 'done';
    }),
  );
  return {
    title: forwarding ? 'with forwarding' : 'five stages, one per cycle',
    colHeaders: Array.from({ length: b.cycles }, (_, i) => String(i + 1)),
    rowHeaders: instrs.map((i) => i.name),
    cells: b.cells.map((r) => r.map((v) => (v === '' ? null : v))),
    states,
    stats: extra,
    note,
  };
};

const INDEP: Instr[] = ['I1', 'I2', 'I3', 'I4'].map((name) => ({ name }));
const RAW: Instr[] = [{ name: 'ADD R1', dest: 'R1' }, { name: 'SUB R4', dest: 'R4', srcs: ['R1'] }, { name: 'I3' }];
const LOAD_USE: Instr[] = [{ name: 'LW R1', dest: 'R1', load: true }, { name: 'ADD R4', dest: 'R4', srcs: ['R1'] }, { name: 'I3' }];
const ALU_USE: Instr[] = [{ name: 'ADD R1', dest: 'R1' }, { name: 'SUB R4', dest: 'R4', srcs: ['R1'] }, { name: 'I3' }];

const K = 5;
const total = (n: number, stalls = 0) => K + (n - 1) + stalls;
const IDEAL = build(INDEP, true);
const SEQ4 = K * 4;
const RAW_NF = build(RAW, false);
const RAW_F = build(ALU_USE, true);
const LU = build(LOAD_USE, true);
const speedup = (n: number) => (K * n) / total(n);

export default defineLesson('grid', {
  slug: 'cf-pipelining',
  objectives: [
    { text: 'How overlapping stages raises throughput', step: 1 },
    { text: 'How many cycles n instructions take', step: 2 },
    { text: 'What a data hazard costs without forwarding', step: 3 },
    { text: 'How forwarding fixes it, and the load-use exception', step: 4 },
  ],
  steps: [
    {
      label: 'Overlap',
      title: 'A laundry line for instructions',
      tag: 'problem',
      body: ['Each instruction goes through fetch, decode, execute, memory and write back. Without a pipeline, four instructions take 4 x 5 = 20 cycles.', 'A **pipeline** starts the next instruction as soon as the first stage is free.'],
      keyIdea: 'Pipelining improves throughput, not the latency of one instruction.',
      frames: [{ state: view(INDEP, true, { text: `once full, one instruction finishes every cycle: ${IDEAL.cycles} cycles instead of ${SEQ4}`, tone: 'ok' }, [{ label: 'No pipeline', value: `${SEQ4} cycles`, tone: 'bad' }, { label: 'Pipelined', value: `${IDEAL.cycles} cycles`, tone: 'ok' }, { label: 'Stages', value: String(K) }]), hold: 4600 }],
    },
    {
      label: 'k + (n-1)',
      title: 'Fill, then one per cycle',
      tag: 'concept',
      body: ['With k stages, n instructions take **k + (n - 1)** cycles: k to fill the pipe, then one more per instruction.', 'For 100 instructions that is 104 cycles against 500, a speedup near 5.'],
      keyIdea: 'The speedup approaches k for a large n.',
      frames: [{ state: view(INDEP, true, { text: `4 instructions: ${K} + 3 = ${total(4)} cycles. 100 instructions: ${total(100)} cycles, a ${Math.round(speedup(100) * 100) / 100}x speedup`, tone: 'accent' }, [{ label: 'n = 4', value: `${total(4)} cycles` }, { label: 'n = 100', value: `${total(100)} cycles` }, { label: 'Speedup (n=100)', value: `${Math.round(speedup(100) * 100) / 100}x`, tone: 'ok' }]), hold: 4600 }],
    },
    {
      label: 'Data hazard',
      title: 'The result is not ready',
      tag: 'trade-off',
      body: ['`SUB R4, R1, ...` right after `ADD R1, ...` needs `R1` before the add has written it back.', 'Without forwarding the pipeline must **stall** until the write back happens.'],
      keyIdea: 'RAW is the true dependency: read after write.',
      frames: [{ state: view(RAW, false, { text: `SUB waits ${RAW_NF.stalls} cycles in decode until ADD writes R1 back`, tone: 'bad' }, [{ label: 'Stall cycles', value: String(RAW_NF.stalls), tone: 'bad' }, { label: 'Total', value: `${RAW_NF.cycles} cycles` }, { label: 'Hazard', value: 'RAW' }]), hold: 4600 }],
    },
    {
      label: 'Forwarding',
      title: 'Bypass the register file',
      tag: 'technique',
      body: ['**Forwarding** sends the ALU result straight to the next instruction\'s input, so the dependent `SUB` does not stall.', 'A **load-use** hazard still costs one cycle, because the loaded value only exists after the memory stage.'],
      keyIdea: 'Compilers can schedule an independent instruction into the load-use gap.',
      frames: [{ state: view(ALU_USE, true, { text: `ADD then SUB with forwarding: ${RAW_F.stalls} stalls`, tone: 'ok' }, [{ label: 'Stall cycles', value: String(RAW_F.stalls), tone: 'ok' }, { label: 'Total', value: `${RAW_F.cycles} cycles` }, { label: 'Forwarding', value: 'on', tone: 'ok' }]), hold: 3800 }, { state: view(LOAD_USE, true, { text: `LW then ADD: even with forwarding the load-use hazard costs ${LU.stalls} cycle`, tone: 'accent' }, [{ label: 'Stall cycles', value: String(LU.stalls), tone: 'bad' }, { label: 'Total', value: `${LU.cycles} cycles` }, { label: 'Forwarding', value: 'on', tone: 'ok' }]), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'Pipelining',
      tag: 'recap',
      body: [
        '- **Throughput:** one instruction per cycle once full.',
        '- **Cycles:** k + (n - 1).',
        '- **Hazards:** structural, data and control.',
        '- **Forwarding:** removes most data stalls.',
        '- **Control hazards:** branch prediction.',
      ],
      keyIdea: 'Deeper pipelines make branch mispredictions more expensive.',
      frames: [{ state: view(LOAD_USE, true, { text: 'a bubble marks a stall: nothing useful in that stage that cycle', tone: 'accent' }, [{ label: 'Stall cycles', value: String(LU.stalls) }, { label: 'Total', value: `${LU.cycles} cycles` }, { label: 'Stages', value: String(K) }]) }],
    },
  ],
});
