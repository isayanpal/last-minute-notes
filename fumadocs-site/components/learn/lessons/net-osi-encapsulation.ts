import { defineLesson } from '../define';
import type { FlowNode, FlowState } from '../engines/flow';
import { patch } from '../engines/layouts';

/*
 * Numbers come from the notes: Ethernet MTU 1500, IPv4 header 20 B, TCP header 20 B, MSS 1460.
 * Hop layout: Host A (x 0), switch (x 1.9), router (x 3.8), Host B (x 5.7), all on y 1.6.
 */

const A: FlowNode = { id: 'a', label: 'Host A', kind: 'client', x: 0, y: 1.6 };
const SW: FlowNode = { id: 'sw', label: 'Switch', sub: 'layer 2', kind: 'lb', x: 1.9, y: 1.6, size: 'sm' };
const RT: FlowNode = { id: 'rt', label: 'Router', sub: 'layer 3', kind: 'gateway', x: 3.8, y: 1.6, size: 'sm' };
const B: FlowNode = { id: 'b', label: 'Host B', kind: 'service', x: 5.7, y: 1.6 };
const PATH = [A, SW, RT, B];
const LINKS = [
  { from: 'a', to: 'sw' },
  { from: 'sw', to: 'rt' },
  { from: 'rt', to: 'b' },
];

// Step 1: a packet-switched network shares links, so delivery is not guaranteed.
const problem: FlowState = {
  nodes: PATH,
  links: LINKS,
  packets: [
    { from: 'a', to: 'sw', label: 'pkt 1', delay: 0, dur: 0.6 },
    { from: 'sw', to: 'rt', label: 'pkt 1', delay: 0.6, dur: 0.6 },
    { from: 'a', to: 'sw', label: 'pkt 2', delay: 0.4, dur: 0.6, tone: 'bad' },
  ],
  stats: [
    { label: 'Switching', value: 'packets' },
    { label: 'Links', value: 'shared' },
    { label: 'Packets can be', value: 'lost, late', tone: 'bad' },
  ],
  note: { text: 'the Internet is packet switched: higher layers add reliability', tone: 'accent' },
};

// Step 2: the TCP/IP model, four layers, IP is the narrow waist.
const LAYER_X = 3;
const layers = (focus?: string): FlowState => {
  const base: FlowNode[] = [
    { id: 'l7', label: 'Application', sub: 'HTTP DNS TLS', kind: 'service', x: LAYER_X, y: 0.2, items: ['HTTP', 'gRPC', 'SSH'] },
    { id: 'l4', label: 'Transport', sub: 'ports, reliability', kind: 'lb', x: LAYER_X, y: 1.2, items: ['TCP', 'UDP', 'QUIC'] },
    { id: 'l3', label: 'Internet', sub: 'host to host', kind: 'gateway', x: LAYER_X, y: 2.2, items: ['IPv4', 'IPv6', 'ICMP'] },
    { id: 'l2', label: 'Link', sub: 'one hop', kind: 'worker', x: LAYER_X, y: 3.2, items: ['Ethernet', 'Wi-Fi', 'ARP'] },
  ];
  return {
    nodes: patch(base, focus ? Object.fromEntries(base.filter((n) => n.id !== focus).map((n) => [n.id, { status: 'dim' as const }])) : {}),
    links: [
      { from: 'l7', to: 'l4' },
      { from: 'l4', to: 'l3' },
      { from: 'l3', to: 'l2' },
    ],
    stats: [
      { label: 'OSI layers', value: '7' },
      { label: 'TCP/IP layers', value: '4' },
      { label: 'Narrow waist', value: 'IP', tone: 'ok' },
    ],
    note: focus === 'l3' ? { text: 'one internetworking protocol: any link below, any app above', tone: 'ok' } : { text: 'OSI is vocabulary (L4 LB, L7 firewall), TCP/IP is what runs', tone: 'accent' },
  };
};

// Step 3: encapsulation. Each layer wraps what the layer above produced.
const enc = (upTo: number): FlowState => {
  const stages: { id: string; label: string; sub: string; items: string[] }[] = [
    { id: 'd', label: 'Data', sub: 'application', items: ['GET /'] },
    { id: 's', label: 'Segment', sub: 'L4', items: ['TCP hdr', 'GET /'] },
    { id: 'p', label: 'Packet', sub: 'L3', items: ['IP hdr', 'TCP hdr', 'GET /'] },
    { id: 'f', label: 'Frame', sub: 'L2', items: ['Eth hdr', 'IP hdr', 'TCP hdr', 'GET /'] },
  ];
  const nodes: FlowNode[] = stages.map((s, i) => ({
    id: s.id,
    label: s.label,
    sub: s.sub,
    kind: (['service', 'lb', 'gateway', 'worker'] as const)[i],
    x: i * 1.9,
    y: 1.6,
    status: i === upTo ? 'active' : i < upTo ? 'normal' : 'dim',
    items: i <= upTo ? s.items : undefined,
  }));
  return {
    nodes,
    links: [
      { from: 'd', to: 's' },
      { from: 's', to: 'p' },
      { from: 'p', to: 'f' },
    ],
    packets: upTo > 0 ? [{ from: stages[upTo - 1].id, to: stages[upTo].id, label: '+ header', tone: 'accent', dur: 0.6 }] : [],
    stats: [
      { label: 'Ethernet', value: '14 B + FCS' },
      { label: 'IPv4', value: '20 B min' },
      { label: 'TCP', value: '20 B min' },
    ],
    note: upTo === 3 ? { text: 'the receiver unwraps in reverse order', tone: 'ok' } : { text: 'each layer adds its own header around the one above', tone: 'accent' },
  };
};

// Step 4: three addresses. IP end to end, MAC rewritten at every hop.
const hop = (n: number): FlowState => {
  const mac = ['A to R', 'R to B'];
  const fromTo = n === 0 ? ['a', 'rt'] : ['rt', 'b'];
  return {
    nodes: [
      { id: 'a', label: 'Host A', sub: 'IP .10', kind: 'client', x: 0.4, y: 1.6, status: n === 0 ? 'active' : 'normal' },
      { id: 'rt', label: 'Router', sub: 'rewrites L2', kind: 'gateway', x: 3, y: 1.6, status: 'active' },
      { id: 'b', label: 'Host B', sub: 'IP .99', kind: 'service', x: 5.6, y: 1.6, status: n === 1 ? 'active' : 'normal' },
    ],
    links: [
      { from: 'a', to: 'rt' },
      { from: 'rt', to: 'b' },
    ],
    packets: [{ from: fromTo[0], to: fromTo[1], label: `MAC ${mac[n]}`, tone: 'data', dur: 1 }],
    stats: [
      { label: 'IP .10 to .99', value: 'unchanged', tone: 'ok' },
      { label: 'MAC', value: 'new each hop', tone: 'bad' },
      { label: 'Port', value: 'picks process' },
    ],
    note: { text: n === 0 ? 'hop 1: next hop MAC is the router' : 'hop 2: router rewrites the MAC pair', tone: 'accent' },
  };
};

// Step 5: who looks at which header.
const devices = (focus: 'sw' | 'rt' | 'b'): FlowState => ({
  nodes: [
    { id: 'a', label: 'Host A', kind: 'client', x: 0, y: 1.6, size: 'sm', status: 'dim' },
    { ...SW, items: focus === 'sw' ? ['dst MAC'] : undefined, status: focus === 'sw' ? 'active' : 'dim' },
    { ...RT, items: focus === 'rt' ? ['dst IP'] : undefined, status: focus === 'rt' ? 'active' : 'dim' },
    { ...B, items: focus === 'b' ? ['port', 'TCP', 'HTTP'] : undefined, status: focus === 'b' ? 'active' : 'dim' },
  ],
  links: LINKS,
  stats:
    focus === 'sw'
      ? [{ label: 'Switch', value: 'L2' }, { label: 'Looks at', value: 'MAC' }, { label: 'Learns', value: 'MAC table' }]
      : focus === 'rt'
        ? [{ label: 'Router', value: 'L3' }, { label: 'Looks at', value: 'dst IP' }, { label: 'Decides', value: 'next hop' }]
        : [{ label: 'End host', value: 'L4 to L7' }, { label: 'Looks at', value: 'port' }, { label: 'Runs', value: 'TCP, app' }],
  note: { text: 'end-to-end principle: simple core, smart edges', tone: 'accent' },
});

// Step 6: MTU, MSS and the silent drop after a tunnel adds headers.
const mtu = (tunnel: boolean): FlowState => ({
  nodes: [
    { id: 'c', label: 'Client', sub: 'MTU 1500', kind: 'client', x: 0, y: 1.6 },
    { id: 'v', label: 'VPN tunnel', sub: tunnel ? 'adds headers' : 'plain link', kind: 'gateway', x: 2.9, y: 1.6, status: tunnel ? 'hot' : 'normal' },
    { id: 's', label: 'Server', kind: 'service', x: 5.7, y: 1.6 },
  ],
  links: [
    { from: 'c', to: 'v' },
    { from: 'v', to: 's' },
  ],
  packets: tunnel
    ? [
        { from: 'c', to: 'v', label: '1500 B', delay: 0, dur: 0.7 },
        { from: 'v', to: 's', label: 'too big', delay: 0.7, dur: 0.7, tone: 'bad' },
      ]
    : [
        { from: 'c', to: 'v', label: '1500 B', delay: 0, dur: 0.7 },
        { from: 'v', to: 's', label: '1500 B', delay: 0.7, dur: 0.7, tone: 'ok' },
      ],
  stats: [
    { label: 'MTU', value: '1500 B' },
    { label: 'MSS', value: '1460 B', hint: '1500 - 20 IP - 20 TCP' },
    { label: 'Large packets', value: tunnel ? 'dropped' : 'fine', tone: tunnel ? 'bad' : 'ok' },
  ],
  note: tunnel ? { text: 'small requests work, big ones hang: classic MTU symptom', tone: 'bad' } : { text: 'MSS = MTU minus IP and TCP headers', tone: 'accent' },
});

export default defineLesson('flow', {
  slug: 'net-osi-encapsulation',
  objectives: [
    { text: 'Why packet switching needs layers above it', step: 1 },
    { text: 'The four TCP/IP layers and the OSI numbers people quote', step: 2 },
    { text: 'How data becomes a segment, a packet and a frame', step: 3 },
    { text: 'Which addresses change per hop and which do not', step: 4 },
    { text: 'What a switch, a router and an end host each inspect', step: 5 },
    { text: 'How MTU and MSS cause silent drops behind tunnels', step: 6 },
  ],
  steps: [
    {
      label: 'Problem',
      title: 'Shared links lose packets',
      tag: 'problem',
      body: ['The Internet is **packet switched**: data is cut into packets that share links and may be delayed, reordered, duplicated or dropped.', 'Someone has to turn that into something an app can rely on.'],
      keyIdea: 'Layering splits the job: links move bits, IP routes packets, TCP adds reliability, apps add meaning.',
      frames: [{ state: problem, hold: 2600 }],
    },
    {
      label: 'Layers',
      title: 'Four layers, one narrow waist',
      tag: 'concept',
      body: ['TCP/IP has four layers: application, transport, internet, link. OSI has seven, and its numbers are the common vocabulary: an **L4** load balancer, an **L7** firewall.', 'IP is the **narrow waist**: many link types below, many protocols above, one protocol in the middle.'],
      keyIdea: 'That narrow waist is why the Internet moved from dial-up to fiber to 5G without rewriting applications.',
      frames: [{ state: layers(), hold: 1800 }, { state: layers('l4'), hold: 1800 }, { state: layers('l3'), hold: 2200 }],
    },
    {
      label: 'Encapsulation',
      title: 'Each layer wraps the one above',
      tag: 'concept',
      body: ['App data gets a TCP header (a **segment**), then an IP header (a **packet**), then an Ethernet header and trailer (a **frame**).', 'The receiver unwraps in reverse order.'],
      keyIdea: 'Headers cost bytes: 14 Ethernet, 20 IPv4 and 20 TCP at minimum.',
      frames: [{ state: enc(0), hold: 1300 }, { state: enc(1), hold: 1500 }, { state: enc(2), hold: 1500 }, { state: enc(3), hold: 2400 }],
    },
    {
      label: 'Addresses',
      title: 'IP stays, MAC changes',
      tag: 'concept',
      body: ['A **MAC** address names the next hop on one link, an **IP** address names the destination end to end, a **port** names the process.', 'Ignoring NAT, the IPs stay the same across routers and the MACs are rewritten at every hop.'],
      keyIdea: 'Think of IP as the building address, the port as the apartment, the MAC as the door of the next hop.',
      frames: [{ state: hop(0), hold: 2200 }, { state: hop(1), hold: 2400 }],
    },
    {
      label: 'Devices',
      title: 'Who reads which header',
      tag: 'technique',
      body: ['A **switch** forwards by destination MAC, a **router** by destination IP, and only end hosts run layers 4 to 7.', 'This is what "L4 load balancer" or "L7 firewall" means: how deep into the packet the device looks.'],
      keyIdea: 'The deeper a device looks, the more it can do and the slower and costlier it gets.',
      frames: [{ state: devices('sw'), hold: 1900 }, { state: devices('rt'), hold: 1900 }, { state: devices('b'), hold: 2200 }],
    },
    {
      label: 'MTU',
      title: 'When headers eat the budget',
      tag: 'in practice',
      body: ['Ethernet carries 1500 bytes of IP packet. Minus 20 for IPv4 and 20 for TCP leaves an **MSS** of 1460 bytes of payload.', 'VPNs and VXLAN add headers, so full-size packets no longer fit and may be silently dropped.'],
      keyIdea: 'Symptom: small requests work, large responses hang. Suspect MTU before blaming the app.',
      frames: [{ state: mtu(false), hold: 2200 }, { state: mtu(true), hold: 2600 }],
    },
    {
      label: 'Recap',
      title: 'The stack in one page',
      tag: 'recap',
      body: [
        '- **Layers:** link, internet, transport, application, with IP as the narrow waist.',
        '- **Encapsulation:** data, segment, packet, frame, each with its own header.',
        '- **Addresses:** MAC per hop, IP end to end, port per process.',
        '- **Devices:** switch reads MAC, router reads IP, hosts read ports.',
        '- **MTU:** 1500 B packet, 1460 B MSS, tunnels shrink it.',
      ],
      keyIdea: 'When something breaks, name the layer first: it tells you which tool and which header to inspect.',
      frames: [{ state: layers('l3') }],
    },
  ],
});
