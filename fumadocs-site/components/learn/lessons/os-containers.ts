import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the OS notes on what a container is: an ordinary process with its own namespaces (what it sees), a cgroup (how much it can use),
 * and reduced privileges. The PID mapping, the OOM kill and the capability check are computed by small real models.
 * The 256 MB limit and the allocation sizes are EXAMPLE values.
 */

// Namespaces: the same processes, seen from the host and from the container.
type Proc = { host: number; name: string; ns: 'host' | 'ctr' };
const PROCS: Proc[] = [
  { host: 1, name: 'systemd', ns: 'host' },
  { host: 812, name: 'sshd', ns: 'host' },
  { host: 4821, name: 'app', ns: 'ctr' },
  { host: 4830, name: 'worker', ns: 'ctr' },
];
const hostView = PROCS.map((p) => p.host);
const ctrView = PROCS.filter((p) => p.ns === 'ctr').map((p, i) => ({ ...p, inside: i + 1 })); // PIDs restart at 1 in a new PID namespace

// cgroup memory limit.
class Cgroup {
  usage = 0;
  oomEvents = 0;
  constructor(public max: number) {}
  alloc(mb: number) {
    if (this.usage + mb > this.max) {
      this.oomEvents++;
      this.usage = 0; // the process is killed and its memory released
      return 'killed';
    }
    this.usage += mb;
    return 'ok';
  }
}
const LIMIT = 256;
const cg = new Cgroup(LIMIT);
const ALLOCS = [100, 100, 100];
const memLog = ALLOCS.map((a) => {
  const before = cg.usage;
  const r = cg.alloc(a);
  return { asked: a, result: r, usage: r === 'ok' ? cg.usage : before + a };
});

// Capabilities: a demo profile that keeps only NET_BIND_SERVICE.
const KEPT = new Set(['NET_BIND_SERVICE']);
const SYSCALLS = [
  { call: 'bind(80)', cap: 'NET_BIND_SERVICE' },
  { call: 'mount()', cap: 'SYS_ADMIN' },
  { call: 'reboot()', cap: 'SYS_BOOT' },
];
const allowed = (cap: string) => KEPT.has(cap);
const shortCap = (cap: string) => cap.replace('NET_BIND_SERVICE', 'NET_BIND_SVC');

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });

const what = (): FlowState => ({
  nodes: [
    { id: 'img', label: 'Image', sub: 'layered tarballs', kind: 'storage', x: 0.1, y: 1.7 },
    { id: 'fs', label: 'overlayfs', sub: 'its own root', kind: 'storage', x: 1.9, y: 1.7, status: 'active' },
    { id: 'p', label: 'Process', sub: 'started by clone()', kind: 'worker', x: 3.7, y: 1.7, status: 'active', items: ['ns', 'cgroup', 'caps'] },
    { id: 'k', label: 'Host kernel', sub: 'shared', kind: 'service', x: 5.5, y: 1.7, status: 'active' },
  ],
  links: [{ from: 'img', to: 'fs' }, { from: 'fs', to: 'p' }, { from: 'p', to: 'k' }],
  packets: [hop('img', 'fs', 'layers', 0, 'data'), hop('fs', 'p', 'root fs', 0.5, 'req'), hop('p', 'k', 'syscalls', 1.0, 'ok')],
  stats: [
    { label: 'Is it a VM', value: 'no', tone: 'ok' },
    { label: 'Kernel', value: 'shared' },
    { label: 'Host sees it', value: 'as a process' },
  ],
  note: { text: 'a container is an ordinary process with its own view, limits and a layered root file system', tone: 'accent' },
});

const namespaces = (view: 'host' | 'ctr'): FlowState => ({
  nodes: [
    { id: 'host', label: 'Host view', sub: `${hostView.length} processes`, kind: 'service', x: 0.1, y: 1.7, status: view === 'host' ? 'active' : 'normal', items: hostView.slice(0, 4).map(String) },
    { id: 'ns', label: 'PID namespace', sub: 'isolates PIDs', kind: 'gateway', x: 2.9, y: 1.7, status: 'active' },
    { id: 'ctr', label: 'Container view', sub: `${ctrView.length} processes`, kind: 'client', x: 5.6, y: 1.7, status: view === 'ctr' ? 'active' : 'normal', items: ctrView.map((p) => String(p.inside)) },
  ],
  links: [{ from: 'host', to: 'ns' }, { from: 'ns', to: 'ctr' }],
  packets: view === 'host' ? [hop('host', 'ns', 'ps aux', 0, 'req')] : [hop('ns', 'ctr', 'ps aux', 0, 'ok')],
  stats: [
    { label: 'app on host', value: `PID ${ctrView[0].host}` },
    { label: 'app inside', value: `PID ${ctrView[0].inside}`, tone: 'ok' },
    { label: view === 'host' ? 'Host sees' : 'Container sees', value: String(view === 'host' ? hostView.length : ctrView.length), tone: 'ok' },
  ],
  note: view === 'host' ? { text: 'the host sees every process, including the container\'s, so containers are not hidden', tone: 'accent' } : { text: 'inside the PID namespace the app is PID 1 and host processes are invisible', tone: 'ok' },
});

const memory = (k: number): FlowState => {
  const e = memLog[k];
  const killed = e.result === 'killed';
  return {
    nodes: [
      { id: 'p', label: 'Process', sub: killed ? 'killed' : `${e.usage} MB used`, kind: 'worker', x: 0.2, y: 1.7, status: killed ? 'down' : 'active', meter: { value: Math.min(1, e.usage / LIMIT), label: `${Math.min(e.usage, 999)} MB`, tone: killed ? 'bad' : e.usage > LIMIT * 0.7 ? 'bad' : 'info' } },
      { id: 'cg', label: 'cgroup', sub: `memory.max ${LIMIT} MB`, kind: 'gateway', x: 2.9, y: 1.7, status: 'active' },
      { id: 'oom', label: 'OOM kill', sub: killed ? 'triggered' : 'not yet', kind: 'external', x: 5.6, y: 1.7, status: killed ? 'hot' : 'dim' },
    ],
    links: [{ from: 'p', to: 'cg' }, { from: 'cg', to: 'oom', dashed: !killed }],
    packets: [hop('p', 'cg', `alloc ${e.asked} MB`, 0, killed ? 'bad' : 'req'), ...(killed ? [hop('cg', 'oom', 'over limit', 0.6, 'bad')] : [])],
    stats: [
      { label: 'Asked', value: `${e.asked} MB` },
      { label: 'Limit', value: `${LIMIT} MB` },
      { label: 'Result', value: killed ? 'OOM kill' : 'ok', tone: killed ? 'bad' : 'ok' },
    ],
    note: killed ? { text: `${e.usage} MB would exceed memory.max, so the kernel kills a process in the cgroup`, tone: 'bad' } : { text: `${e.usage} MB is within the ${LIMIT} MB limit`, tone: 'ok' },
  };
};

const caps = (i: number): FlowState => {
  const s = SYSCALLS[i];
  const ok = allowed(s.cap);
  const nodes: FlowNode[] = [
    { id: 'p', label: 'Process', sub: `calls ${s.call}`, kind: 'worker', x: 0.1, y: 1.7, status: 'active' },
    { id: 'c', label: 'Capabilities', sub: `needs ${shortCap(s.cap)}`, kind: 'gateway', x: 2.9, y: 1.7, status: ok ? 'active' : 'hot', items: [`${KEPT.size} kept`] },
    { id: 'k', label: ok ? 'Allowed' : 'EPERM', sub: ok ? 'kernel runs it' : 'denied', kind: ok ? 'service' : 'external', x: 5.6, y: 1.7, status: ok ? 'active' : 'down' },
  ];
  return {
    nodes,
    links: [{ from: 'p', to: 'c' }, { from: 'c', to: 'k' }],
    packets: [hop('p', 'c', s.call, 0, ok ? 'req' : 'bad'), hop('c', 'k', ok ? 'allow' : 'deny', 0.6, ok ? 'ok' : 'bad')],
    stats: [
      { label: 'Call', value: s.call },
      { label: 'Needs', value: shortCap(s.cap) },
      { label: 'Result', value: ok ? 'allowed' : 'denied', tone: ok ? 'ok' : 'bad' },
    ],
    note: ok ? { text: 'CAP_NET_BIND_SERVICE lets it bind port 80 without being full root', tone: 'ok' } : { text: 'the container runtime dropped that capability, so the call fails', tone: 'bad' },
  };
};

export default defineLesson('flow', {
  slug: 'os-containers',
  objectives: [
    { text: 'Why a container is a process, not a VM', step: 1 },
    { text: 'What namespaces isolate', step: 2 },
    { text: 'How cgroups enforce limits', step: 3 },
    { text: 'How capabilities cut a process down', step: 4 },
  ],
  steps: [
    {
      label: 'A process',
      title: 'No VM involved',
      tag: 'problem',
      body: ['A container is an **ordinary process** started with `clone()`, a root file system built from image layers with **overlayfs**, and extra isolation.', 'It shares the host kernel, so it starts fast and shows up in the host\'s `ps`.'],
      keyIdea: 'A kernel exploit in one container can reach the host.',
      frames: [{ state: what(), hold: 4400 }],
    },
    {
      label: 'Namespaces',
      title: 'What it can see',
      tag: 'concept',
      body: ['**Namespaces** give a process its own view of a global resource: PIDs, mounts, network, hostname, IPC, users.', 'In its PID namespace the app is PID 1 and cannot see host processes.'],
      keyIdea: 'Namespaces decide what a process can see.',
      frames: [{ state: namespaces('host'), hold: 3200 }, { state: namespaces('ctr'), hold: 3800 }],
    },
    {
      label: 'cgroups',
      title: 'How much it can use',
      tag: 'technique',
      body: ['**cgroups** limit and account for CPU, memory, I/O and process counts. A hard `memory.max` kills a process that goes over.', 'The limit and the sizes here are example values.'],
      keyIdea: 'cgroups decide how much a process can use.',
      frames: [0, 1, 2].map((k) => ({ state: memory(k), hold: k === 2 ? 3800 : 2200 })),
    },
    {
      label: 'Privileges',
      title: 'Less than root',
      tag: 'in practice',
      body: ['Runtimes drop most **capabilities** from root, add a **seccomp** syscall filter and an LSM profile.', 'In this demo profile only `NET_BIND_SERVICE` is kept, so `bind(80)` works and `mount` and `reboot` fail.'],
      keyIdea: 'Capabilities split root\'s power into about 40 pieces.',
      frames: [0, 1, 2].map((i) => ({ state: caps(i), hold: 2800 })),
    },
    {
      label: 'Recap',
      title: 'What a container really is',
      tag: 'recap',
      body: [
        '- **Process:** started with `clone()` on the host kernel.',
        '- **Namespaces:** what it sees.',
        '- **cgroups:** how much it can use.',
        '- **Layers:** overlayfs root from an image.',
        '- **Privileges:** capabilities, seccomp, LSM.',
      ],
      keyIdea: 'Multi-tenant platforms add gVisor, Kata or microVMs for stronger isolation.',
      frames: [{ state: what() }],
    },
  ],
});
