import { defineLesson } from '../define';
import type { SeqActor, SeqMessage, SeqState } from '../engines/sequence';
import type { Frame, Stat } from '../types';

/*
 * Examples follow the notes: DHCP DORA on UDP 67/68, ARP for the default gateway,
 * the 0/0, 10/8, 10.1/16, 10.1.2/24 route table, traceroute with TTL 1, 2, 3, and PAT on 203.0.113.5.
 * The longest prefix match is computed on real integers.
 */

type Beat = { msgs: SeqMessage[]; hold?: number; actors?: SeqActor[]; stats?: Stat[]; note?: SeqState['note'] };

function reveal(actors: SeqActor[], beats: Beat[]): Frame<SeqState>[] {
  const so: SeqMessage[] = [];
  return beats.map((b) => {
    so.push(...b.msgs);
    return { hold: b.hold ?? 1700, state: { actors: b.actors ?? actors, messages: [...so], fresh: b.msgs.length, stats: b.stats, note: b.note } };
  });
}

// Step 1: DHCP, a host with no address asks for one.
const DHCP: SeqActor[] = [
  { id: 'c', label: 'Laptop', kind: 'client', badge: { text: 'no IP yet', tone: 'bad' } },
  { id: 's', label: 'DHCP server', kind: 'service' },
];
const dhcpDone: SeqActor[] = [{ ...DHCP[0], badge: { text: '192.168.1.20', tone: 'ok' } }, DHCP[1]];
const dhcpStats: Stat[] = [
  { label: 'Ports', value: 'UDP 67, 68' },
  { label: 'Steps', value: 'DORA' },
  { label: 'Lease', value: '24 h' },
];
const dhcpFrames = reveal(DHCP, [
  { msgs: [{ from: 'c', to: 's', label: 'DISCOVER (broadcast)' }], hold: 1400, stats: dhcpStats },
  { msgs: [{ from: 's', to: 'c', label: 'OFFER .20, lease 24h', dashed: true }], hold: 1400, stats: dhcpStats },
  { msgs: [{ from: 'c', to: 's', label: 'REQUEST .20 (broadcast)' }], hold: 1400, stats: dhcpStats },
  {
    msgs: [{ from: 's', to: 'c', label: 'ACK', dashed: true, tone: 'ok' }],
    actors: dhcpDone,
    hold: 2600,
    stats: [
      { label: 'Lease has', value: 'IP, mask' },
      { label: 'Also', value: 'gateway, DNS' },
      { label: 'Renews at', value: '50%' },
    ],
    note: { text: 'the REQUEST is broadcast so other servers see which offer won', tone: 'accent' },
  },
]);

// Step 2: ARP finds the MAC of the next hop, which is the gateway for remote destinations.
const ARP: SeqActor[] = [
  { id: 'h', label: 'Laptop', kind: 'client' },
  { id: 'g', label: 'Gateway', kind: 'gateway' },
  { id: 'r', label: 'Remote host', kind: 'service', status: 'dim' },
];
const arpStats: Stat[] = [
  { label: 'ARP asks for', value: 'gateway MAC' },
  { label: 'Never', value: 'remote MAC', tone: 'bad' },
  { label: 'Cache', value: 'ip neigh' },
];
const arpFrames = reveal(ARP, [
  { msgs: [{ from: 'h', to: 'h', label: 'dst is off-subnet', tone: 'data' }], hold: 1600, stats: arpStats },
  { msgs: [{ from: 'h', to: 'g', label: 'who has 192.168.1.1?' }], hold: 1500, stats: arpStats, note: { text: 'broadcast on the LAN', tone: 'accent' } },
  { msgs: [{ from: 'g', to: 'h', label: '192.168.1.1 is at aa:01', dashed: true }], hold: 1500, stats: arpStats },
  {
    msgs: [{ from: 'h', to: 'g', label: 'IP to remote, MAC gw', tone: 'ok' }],
    hold: 2600,
    stats: arpStats,
    note: { text: 'IP names the remote host, the MAC names the next hop', tone: 'ok' },
  },
]);

// Step 3: longest prefix match, computed on real integers.
const ip = (s: string) => s.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
const ROUTES = [
  { net: '0.0.0.0', len: 0, hop: 'ISP' },
  { net: '10.0.0.0', len: 8, hop: 'A' },
  { net: '10.1.0.0', len: 16, hop: 'B' },
  { net: '10.1.2.0', len: 24, hop: 'C' },
];
const matches = (dest: string, r: { net: string; len: number }) => {
  const mask = r.len === 0 ? 0 : (0xffffffff << (32 - r.len)) >>> 0;
  return ((ip(dest) & mask) >>> 0) === ip(r.net);
};
const lpmFrames = (dest: string): Frame<SeqState>[] => {
  const hit = ROUTES.filter((r) => matches(dest, r));
  const win = hit[hit.length - 1];
  const actors: SeqActor[] = [
    { id: 'h', label: 'Host', kind: 'client' },
    { id: 'r', label: 'Router', kind: 'gateway', badge: { text: 'routes: /0 /8 /16 /24', tone: 'accent' } },
    { id: 'n', label: `Next hop ${win.hop}`, kind: 'service' },
  ];
  const stats = (done: boolean): Stat[] => [
    { label: 'Matches', value: `${hit.length} of 4 routes` },
    { label: 'Longest', value: done ? `/${win.len}` : '?', tone: done ? 'ok' : 'neutral' },
    { label: 'Next hop', value: done ? win.hop : '?', tone: done ? 'ok' : 'neutral' },
  ];
  return reveal(actors, [
    { msgs: [{ from: 'h', to: 'r', label: `dst ${dest}` }, { from: 'r', to: 'r', label: `${hit.length} routes match`, tone: 'data' }], hold: 1800, stats: stats(false) },
    {
      msgs: [{ from: 'r', to: 'r', label: `longest is /${win.len}`, tone: 'ok' }, { from: 'r', to: 'n', label: `forward to ${win.hop}`, tone: 'ok' }],
      hold: 2300,
      stats: stats(true),
      note: { text: `most specific match wins: ${win.net}/${win.len}`, tone: 'ok' },
    },
  ]);
};
const lpmAll = [...lpmFrames('10.1.2.7'), ...lpmFrames('10.1.9.9'), ...lpmFrames('8.8.8.8')];

// Step 4: TTL stops loops, and traceroute uses its expiry to map the path.
const TR: SeqActor[] = [
  { id: 'h', label: 'Host', kind: 'client' },
  { id: 'r1', label: 'Router 1', kind: 'gateway' },
  { id: 'r2', label: 'Router 2', kind: 'gateway' },
  { id: 's', label: 'Server', kind: 'service' },
];
const trStats = (n: number): Stat[] => [
  { label: 'TTL sent', value: String(n) },
  { label: 'Each hop', value: 'TTL - 1' },
  { label: 'At 0', value: 'drop + ICMP', tone: 'bad' },
];
const trFrames = reveal(TR, [
  { msgs: [{ from: 'h', to: 'r1', label: 'probe TTL 1' }, { from: 'r1', to: 'h', label: 'time exceeded', dashed: true, tone: 'bad' }], hold: 1900, stats: trStats(1), note: { text: 'hop 1 found: Router 1', tone: 'accent' } },
  { msgs: [{ from: 'h', to: 'r2', label: 'probe TTL 2' }, { from: 'r2', to: 'h', label: 'time exceeded', dashed: true, tone: 'bad' }], hold: 1900, stats: trStats(2), note: { text: 'hop 2 found: Router 2', tone: 'accent' } },
  { msgs: [{ from: 'h', to: 's', label: 'probe TTL 3' }, { from: 's', to: 'h', label: 'reply', dashed: true, tone: 'ok' }], hold: 2600, stats: trStats(3), note: { text: 'the path is mapped one TTL at a time', tone: 'ok' } },
]);

// Step 5: PAT. Many private hosts share one public IP, told apart by port.
const NAT: SeqActor[] = [
  { id: 'l', label: 'Laptop', kind: 'client' },
  { id: 'n', label: 'NAT router', kind: 'gateway' },
  { id: 's', label: 'Server', kind: 'service' },
];
const natStats: Stat[] = [
  { label: 'Type', value: 'PAT' },
  { label: 'Public IP', value: '203.0.113.5' },
  { label: 'Key', value: 'port' },
];
const natFrames = reveal(NAT, [
  { msgs: [{ from: 'l', to: 'n', label: 'src 192.168.1.20:51000' }], hold: 1500, stats: natStats },
  { msgs: [{ from: 'n', to: 'n', label: 'map to :40001', tone: 'data' }], hold: 1400, stats: natStats, note: { text: 'mapping saved: private ip:port to public ip:port', tone: 'accent' } },
  { msgs: [{ from: 'n', to: 's', label: 'src 203.0.113.5:40001' }], hold: 1500, stats: natStats },
  { msgs: [{ from: 's', to: 'n', label: 'dst 203.0.113.5:40001', dashed: true }], hold: 1500, stats: natStats },
  { msgs: [{ from: 'n', to: 'l', label: 'dst 192.168.1.20:51000', dashed: true, tone: 'ok' }], hold: 2600, stats: natStats, note: { text: 'reply found its mapping and goes back to the laptop', tone: 'ok' } },
]);

// Step 6: what NAT costs. No mapping for unsolicited inbound, and a finite port pool.
const INBOUND: SeqActor[] = [
  { id: 'p', label: 'Peer', kind: 'external' },
  { id: 'n', label: 'NAT router', kind: 'gateway' },
  { id: 'l', label: 'Laptop', kind: 'client', status: 'dim' },
];
const inboundFrames = reveal(INBOUND, [
  {
    msgs: [{ from: 'p', to: 'n', label: 'unsolicited packet' }, { from: 'n', to: 'n', label: 'no mapping: drop', tone: 'bad' }],
    hold: 2400,
    stats: [
      { label: 'Inbound', value: 'no mapping', tone: 'bad' },
      { label: 'Fix', value: 'STUN/TURN/ICE' },
      { label: 'NAT is', value: 'not a firewall' },
    ],
    note: { text: 'peer-to-peer needs NAT traversal, as WebRTC does', tone: 'bad' },
  },
]);
const PORTS: SeqActor[] = [
  { id: 'w', label: 'Workers', kind: 'worker' },
  { id: 'n', label: 'NAT gateway', kind: 'gateway', badge: { text: 'ports 96% used', tone: 'bad' } },
  { id: 'x', label: 'One endpoint', kind: 'external' },
];
const portFrames = reveal(PORTS, [
  {
    msgs: [{ from: 'w', to: 'n', label: 'new connection' }, { from: 'n', to: 'x', label: 'src public:port' }],
    hold: 1800,
    stats: [
      { label: 'Ports', value: '~64K per dest' },
      { label: 'Idle maps', value: 'expire' },
      { label: 'Needs', value: 'keepalives' },
    ],
  },
  {
    msgs: [{ from: 'w', to: 'n', label: 'new connection' }, { from: 'n', to: 'n', label: 'no free port', tone: 'bad' }],
    hold: 2600,
    stats: [
      { label: 'Ports', value: 'exhausted', tone: 'bad' },
      { label: 'Symptom', value: 'connect errors', tone: 'bad' },
      { label: 'Fix', value: 'more IPs' },
    ],
    note: { text: 'heavy outbound traffic to one endpoint exhausts ports', tone: 'bad' },
  },
]);

export default defineLesson('sequence', {
  slug: 'net-routing-nat',
  objectives: [
    { text: 'How a new host gets an IP with DHCP', step: 1 },
    { text: 'Why a host ARPs for the gateway, not the remote host', step: 2 },
    { text: 'How routers pick a route by longest prefix match', step: 3 },
    { text: 'What TTL does and how traceroute uses it', step: 4 },
    { text: 'How NAT shares one public IP with ports', step: 5 },
    { text: 'The costs of NAT: inbound, state and port exhaustion', step: 6 },
  ],
  steps: [
    {
      label: 'DHCP',
      title: 'Getting an address',
      tag: 'problem',
      body: ['A new host has no IP, so it broadcasts a request. **DORA**: Discover, Offer, Request, Acknowledge, over UDP ports 67 and 68.', 'The lease carries the IP, mask, default gateway, DNS servers and lease time.'],
      keyIdea: 'A rogue DHCP server can hand out a malicious gateway, so switches offer DHCP snooping.',
      frames: dhcpFrames,
    },
    {
      label: 'ARP',
      title: 'Finding the next hop',
      tag: 'concept',
      body: ['To send on the LAN a host needs the target MAC. It broadcasts "who has this IP?" and the owner answers by unicast.', 'If the destination is on another subnet, the host ARPs for the **default gateway**, never the remote host.'],
      keyIdea: 'ARP replies are unauthenticated, so any host can spoof one. Encryption (TLS) makes interception worthless.',
      frames: arpFrames,
    },
    {
      label: 'Routing',
      title: 'Longest prefix wins',
      tag: 'technique',
      body: ['A router checks TTL, finds the matching route with the **longest prefix match**, rewrites the layer 2 header and forwards.', 'Destination `10.1.2.7` matches all four routes, and the `/24` is the most specific.'],
      keyIdea: 'The default route `0.0.0.0/0` matches everything, so it only wins when nothing more specific does.',
      frames: lpmAll,
    },
    {
      label: 'TTL',
      title: 'TTL, loops and traceroute',
      tag: 'technique',
      body: ['Every router decrements the **TTL**. At zero it drops the packet and sends ICMP "time exceeded", so loops cannot circulate forever.', '`traceroute` sends probes with TTL 1, 2, 3 and each router that drops one reveals itself.'],
      keyIdea: 'Do not block all ICMP. Time exceeded and "fragmentation needed" keep traceroute and path MTU discovery working.',
      frames: trFrames,
    },
    {
      label: 'NAT',
      title: 'One public IP for many hosts',
      tag: 'concept',
      body: ['**PAT** rewrites the source IP and port of outgoing packets and remembers the mapping, so replies find their way back.', 'IPv4 ran out of addresses in 2011, and NAT is what kept it alive. Every home router does this.'],
      keyIdea: 'Mapping key is the private ip:port. That is why many laptops can share one public IP.',
      frames: natFrames,
    },
    {
      label: 'NAT costs',
      title: 'What NAT breaks',
      tag: 'trade-off',
      body: ['Unsolicited inbound traffic has no mapping, so peer-to-peer needs **NAT traversal** (STUN, TURN, ICE). Mappings are state and expire, so idle connections need keepalives.', 'One public IP has about 64K ports per destination, and busy cloud NAT gateways can run out.'],
      keyIdea: 'NAT is not a firewall. It blocks unsolicited inbound as a side effect, not as a policy.',
      frames: [...inboundFrames, ...portFrames],
    },
    {
      label: 'Recap',
      title: 'From plug-in to Internet',
      tag: 'recap',
      body: [
        '- **DHCP:** DORA gives IP, mask, gateway and DNS.',
        '- **ARP:** find the MAC of the next hop, which is the gateway off-subnet.',
        '- **Routing:** longest prefix match, TTL guards loops.',
        '- **NAT:** PAT shares one public IP by rewriting ports.',
        '- **Costs:** no unsolicited inbound, state, port limits.',
      ],
      keyIdea: 'Every hop rewrites layer 2, routers pick by prefix, and NAT rewrites layer 3 and 4 at the edge.',
      frames: [trFrames[trFrames.length - 1]],
    },
  ],
});
