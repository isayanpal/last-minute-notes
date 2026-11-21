import { defineLesson } from '../define';
import type { ArrayRow, ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Every number below is computed from the real prefix and octets, so the bits, block sizes and ranges on screen are correct.
 * Worked examples follow the notes: 192.168.1.10/24, 172.16.45.200/20, 10.0.0.0/24 into four /26, VLSM on 192.168.10.0/24.
 */

const bits8 = (n: number): string[] => n.toString(2).padStart(8, '0').split('');
const paint = (b: string[], on: ItemState, off: ItemState): Record<number, ItemState> => Object.fromEntries(b.map((v, i) => [i, v === '1' ? on : off])) as Record<number, ItemState>;
const mask8 = (ones: number) => (256 - 2 ** (8 - ones)) & 255;

// Step 1: the prefix splits an address into network and host.
const split = (withWindow: boolean): ArrayState => ({
  rows: [
    {
      label: 'IP',
      cells: ['192', '168', '1', '10'],
      states: { 0: 'done', 1: 'done', 2: 'done', 3: 'active' },
      window: withWindow ? { from: 0, to: 2, label: 'network: 24 bits', tone: 'ok' } : undefined,
      showIndex: false,
    },
    { label: 'Mask', cells: ['255', '255', '255', '0'], states: { 0: 'done', 1: 'done', 2: 'done', 3: 'dim' }, showIndex: false },
  ],
  panels: [{ title: '192.168.1.10/24', kind: 'list', items: ['network 192.168.1.0', 'host part .10', 'mask /24', 'same net? AND mask'], highlight: withWindow ? 0 : undefined }],
  stats: [
    { label: 'Prefix', value: '/24' },
    { label: 'Network', value: '192.168.1.0' },
    { label: 'Rule', value: 'IP AND mask' },
  ],
  note: { text: 'same network: deliver directly. otherwise: default gateway', tone: 'accent' },
});

// Step 2: a longer prefix means fewer addresses. 2^(32 - n), minus 2 usable.
const PREFIXES = [24, 25, 26, 27, 28, 29, 30];
const sizes = (focus?: number): ArrayState => {
  const states = focus === undefined ? undefined : (Object.fromEntries(PREFIXES.map((p, i) => [i, p === focus ? 'active' : 'dim'])) as Record<number, ItemState>);
  const addr = focus === undefined ? undefined : 2 ** (32 - focus);
  return {
    rows: [
      { label: 'Prefix', cells: PREFIXES.map((p) => `/${p}`), states, showIndex: false },
      { label: 'Addresses', cells: PREFIXES.map((p) => 2 ** (32 - p)), states, bars: true },
    ],
    stats: [
      { label: 'Addresses', value: addr ? String(addr) : '2^(32 - n)' },
      { label: 'Usable', value: addr ? String(addr - 2) : 'minus 2', tone: 'ok' },
      { label: 'Cloud reserves', value: 'AWS 5, GCP 4' },
    ],
    note: focus === undefined ? { text: 'first address is the network, last is the broadcast', tone: 'accent' } : { text: `/${focus}: ${addr} addresses, ${addr! - 2} usable`, tone: 'ok' },
  };
};

// Step 3: worked example 1, 172.16.45.200/20. The third octet is the interesting one.
const IP3 = 45;
const PREFIX = 20;
const ones = PREFIX - 16;
const M3 = mask8(ones);
const block = 256 - M3;
const NET3 = IP3 & M3;
const stage1 = (n: number): ArrayState => {
  const rows: ArrayRow[] = [{ label: '3rd octet', cells: bits8(IP3), states: paint(bits8(IP3), 'active', 'dim'), showIndex: false }];
  if (n >= 1) rows.push({ label: `mask ${M3}`, cells: bits8(M3), states: paint(bits8(M3), 'visited', 'dim'), showIndex: false });
  if (n >= 2) rows.push({ label: 'AND', cells: bits8(NET3), states: paint(bits8(NET3), 'found', 'dim'), showIndex: false });
  return {
    rows,
    panels: [{ title: '172.16.45.200/20', kind: 'list', items: ['/20: 3rd octet', `mask ${M3}`, `block ${block}`, `net ${NET3}`], highlight: n === 0 ? 0 : n === 1 ? 2 : 3 }],
    stats: [
      { label: 'Mask octet', value: n >= 1 ? String(M3) : '?' },
      { label: 'Block size', value: n >= 1 ? `256 - ${M3} = ${block}` : '?' },
      { label: 'Network', value: n >= 2 ? `172.16.${NET3}.0/20` : '?', tone: n >= 2 ? 'ok' : 'neutral' },
    ],
    note: n === 2 ? { text: `broadcast 172.16.${NET3 + block - 1}.255, ${2 ** 12 - 2} usable hosts`, tone: 'ok' } : { text: 'AND the host octet with the mask to find the network', tone: 'accent' },
  };
};

// Step 4: borrow bits to split. 10.0.0.0/24 into 1, 2, then 4 subnets.
const splitNet = (borrow: number): ArrayState => {
  const count = 2 ** borrow;
  const size = 256 / count;
  const starts = Array.from({ length: count }, (_, i) => i * size);
  const states = Object.fromEntries(starts.map((_, i) => [i, i === count - 1 ? 'found' : 'active'])) as Record<number, ItemState>;
  return {
    rows: [
      { label: 'Network', cells: starts.map((s) => `.${s}`), states, showIndex: false },
      { label: 'Broadcast', cells: starts.map((s) => `.${s + size - 1}`), states: Object.fromEntries(starts.map((_, i) => [i, 'dim'])) as Record<number, ItemState>, showIndex: false },
    ],
    stats: [
      { label: 'Bits borrowed', value: String(borrow) },
      { label: 'Prefix', value: `/${24 + borrow}`, tone: 'ok' },
      { label: 'Usable each', value: String(size - 2) },
    ],
    note: { text: `10.0.0.0/24 into ${count} subnet${count > 1 ? 's' : ''}: ${size} addresses each`, tone: borrow === 2 ? 'ok' : 'accent' },
  };
};

// Step 5: VLSM, largest first so blocks stay aligned. 192.168.10.0/24.
const NEEDS = [100, 50, 20, 2];
const blockFor = (hosts: number) => {
  let size = 4;
  while (size - 2 < hosts) size *= 2;
  return size;
};
const vlsm = (upTo: number): ArrayState => {
  const blocks = NEEDS.map(blockFor);
  const starts: number[] = [];
  let at = 0;
  blocks.forEach((b) => {
    starts.push(at);
    at += b;
  });
  const states = Object.fromEntries(NEEDS.map((_, i) => [i, i < upTo ? 'done' : i === upTo ? 'active' : 'dim'])) as Record<number, ItemState>;
  return {
    rows: [
      { label: 'Hosts needed', cells: NEEDS, states, showIndex: false },
      { label: 'Block size', cells: blocks, states, bars: true },
    ],
    panels: [
      {
        title: '192.168.10.0/24',
        kind: 'list',
        items: NEEDS.slice(0, upTo + 1).map((_, i) => `.${starts[i]}/${32 - Math.log2(blocks[i])}`),
        highlight: upTo,
      },
    ],
    stats: [
      { label: 'Order', value: 'largest first', tone: 'ok' },
      { label: 'This block', value: `/${32 - Math.log2(blocks[upTo])}` },
      { label: 'Free from', value: `.${starts[upTo] + blocks[upTo]}` },
    ],
    note: { text: `${NEEDS[upTo]} hosts need ${blocks[upTo]} addresses (${blocks[upTo] - 2} usable)`, tone: 'accent' },
  };
};

// Step 6: route aggregation. Four /24s share their first 22 bits.
const agg = (merged: boolean): ArrayState => {
  const third = [0, 1, 2, 3];
  return {
    rows: [
      { label: '192.168.0.x', cells: bits8(0), states: paint(bits8(0), 'active', 'dim'), window: { from: 0, to: 5, label: 'shared 22 bits', tone: 'ok' }, showIndex: false },
      { label: '192.168.3.x', cells: bits8(third[3]), states: paint(bits8(third[3]), 'active', 'dim'), window: { from: 0, to: 5, tone: 'ok' }, showIndex: false },
    ],
    stats: [
      { label: 'Routes before', value: '4 x /24' },
      { label: 'Routes after', value: merged ? '1 x /22' : '4 x /24', tone: merged ? 'ok' : 'neutral' },
      { label: 'Needs', value: 'aligned blocks' },
    ],
    note: merged ? { text: '192.168.0.0/22 covers 0.0 to 3.255', tone: 'ok' } : { text: 'third octet bits (0 and 3): only the last 2 bits differ', tone: 'accent' },
  };
};

export default defineLesson('array', {
  slug: 'net-subnetting',
  objectives: [
    { text: 'How a prefix splits an address into network and host', step: 1 },
    { text: 'Addresses and usable hosts for any prefix', step: 2 },
    { text: 'Find the network of a host with the block-size trick', step: 3 },
    { text: 'Split a network by borrowing bits', step: 4 },
    { text: 'Allocate subnets of different sizes with VLSM', step: 5 },
    { text: 'Aggregate routes into one supernet', step: 6 },
  ],
  steps: [
    {
      label: 'Prefix',
      title: 'Network part and host part',
      tag: 'problem',
      body: ['An IPv4 address is 32 bits. The **prefix length** (the `/24`) says how many leading bits name the network.', 'Two hosts are on the same subnet when `IP AND mask` gives the same network address. If not, traffic goes to the **default gateway**.'],
      keyIdea: 'CIDR replaced fixed classes A, B and C in 1993 because fixed sizes wasted addresses.',
      frames: [{ state: split(false), hold: 1600 }, { state: split(true), hold: 2600 }],
    },
    {
      label: 'Sizes',
      title: 'Each extra bit halves the block',
      tag: 'concept',
      body: ['A `/n` block has 2^(32 - n) addresses. Usable hosts are two fewer: the first is the **network address**, the last is the **broadcast**.', '`/31` (point-to-point) and `/32` (one host) are the exceptions. Clouds reserve more: AWS 5, GCP 4.'],
      keyIdea: 'Memorize the mask octets 128, 192, 224, 240, 248, 252, 254, 255. Block size is 256 minus the mask value.',
      frames: [{ state: sizes(), hold: 1600 }, { state: sizes(24), hold: 1500 }, { state: sizes(26), hold: 1500 }, { state: sizes(30), hold: 2200 }],
    },
    {
      label: 'Find network',
      title: 'Which subnet is this host in?',
      tag: 'technique',
      body: ['Take `172.16.45.200/20`. The prefix ends in the third octet, so AND that octet with the mask (240). Block size is 256 - 240 = 16.', '45 sits in the block starting at 32, so the network is `172.16.32.0/20`.'],
      keyIdea: 'Find the interesting octet, compute the block size, round the octet down to a multiple of it.',
      frames: [{ state: stage1(0), hold: 1700 }, { state: stage1(1), hold: 1700 }, { state: stage1(2), hold: 2600 }],
    },
    {
      label: 'Split',
      title: 'Borrow bits to make subnets',
      tag: 'technique',
      body: ['To split `10.0.0.0/24` into 4 equal subnets, borrow 2 bits (4 = 2^2). The prefix becomes `/26`: 64 addresses, 62 usable each.', 'Each borrowed bit doubles the number of subnets and halves each one.'],
      keyIdea: 'Subnets need n = log2(count) borrowed bits, and the new prefix is the old one plus n.',
      frames: [{ state: splitNet(0), hold: 1500 }, { state: splitNet(1), hold: 1700 }, { state: splitNet(2), hold: 2600 }],
    },
    {
      label: 'VLSM',
      title: 'Different sizes, largest first',
      tag: 'technique',
      body: ['Variable-length masks let each subnet fit its need. For 100, 50, 20 and 2 hosts in `192.168.10.0/24` use a `/25`, `/26`, `/27` and `/30`.', 'Allocate the biggest first so every block starts on its natural boundary.'],
      keyIdea: 'Round each need up to a power of two plus 2, then place blocks largest to smallest.',
      frames: [{ state: vlsm(0), hold: 1800 }, { state: vlsm(1), hold: 1500 }, { state: vlsm(2), hold: 1500 }, { state: vlsm(3), hold: 2600 }],
    },
    {
      label: 'Aggregate',
      title: 'Many routes become one',
      tag: 'in practice',
      body: ['`192.168.0.0/24` to `192.168.3.0/24` share their first 22 bits, so they can be advertised as `192.168.0.0/22`.', 'Providers hand out aligned blocks so the Internet routing table stays small.'],
      keyIdea: 'Supernetting only works on aligned, contiguous blocks, which is why allocation order matters.',
      frames: [{ state: agg(false), hold: 2200 }, { state: agg(true), hold: 2600 }],
    },
    {
      label: 'Recap',
      title: 'Subnetting cheat sheet',
      tag: 'recap',
      body: [
        '- **Network:** IP AND mask, compare to decide local or gateway.',
        '- **Size:** 2^(32 - n) addresses, 2 fewer usable.',
        '- **Find the subnet:** block size = 256 - mask octet, round down.',
        '- **Split:** borrow log2(count) bits.',
        '- **VLSM:** largest first, then aggregate aligned blocks.',
      ],
      keyIdea: 'Verify by hand, then with `ipaddress` in Python: it answers every question in this lesson.',
      frames: [{ state: sizes(26) }],
    },
  ],
});
