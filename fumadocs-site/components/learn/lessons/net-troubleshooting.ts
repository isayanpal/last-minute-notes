import { defineLesson } from '../define';
import type { FlowNode, FlowState } from '../engines/flow';

/*
 * Follows the notes: work up the stack from the bottom, change one thing at a time.
 * The checks, symptom table and the NAT port-exhaustion incident all come from the Troubleshooting page.
 * Ladder layout: six checks on one row, 1.2 units apart.
 */

const STEPS: { id: string; label: string; sub: string; tool: string; ask: string }[] = [
  { id: 'if', label: 'Interface', sub: 'ip addr, route', tool: 'ip addr', ask: 'interface up with an IP?' },
  { id: 'reach', label: 'Reach', sub: 'ping, mtr', tool: 'ping, mtr', ask: 'gateway and target reachable?' },
  { id: 'dns', label: 'DNS', sub: 'dig', tool: 'dig', ask: 'does the name resolve right?' },
  { id: 'port', label: 'Port', sub: 'nc, ss', tool: 'nc -vz, ss', ask: 'port open and listening?' },
  { id: 'tls', label: 'TLS', sub: 's_client', tool: 's_client', ask: 'does the handshake succeed?' },
  { id: 'app', label: 'App', sub: 'curl timing', tool: 'curl -w, logs', ask: 'response right and fast?' },
];
const ladder = (at = -1, bad = -1): FlowNode[] =>
  STEPS.map((s, i) => ({
    id: s.id,
    label: s.label,
    sub: s.sub,
    kind: (['worker', 'gateway', 'dns', 'lb', 'cache', 'service'] as const)[i],
    x: i * 1.2,
    y: 1.7,
    size: 'sm' as const,
    status: i === bad ? 'down' : i === at ? 'active' : at >= 0 && i > at ? 'dim' : 'normal',
  }));
const LADDER_LINKS = STEPS.slice(1).map((s, i) => ({ from: STEPS[i].id, to: s.id }));

// Step 1: "the network is broken" is a layer, not a feeling.
const vague: FlowState = {
  nodes: ladder(),
  links: LADDER_LINKS,
  stats: [
    { label: 'Report', value: '"it is broken"' },
    { label: 'Layers to check', value: '6' },
    { label: 'Order', value: 'bottom up', tone: 'ok' },
  ],
  note: { text: 'every layer depends on the ones below it', tone: 'accent' },
};

// Step 2: walk the ladder. Each stop names the tool and the question.
const walk = (i: number): FlowState => ({
  nodes: ladder(i),
  links: LADDER_LINKS,
  stats: [
    { label: 'Check', value: STEPS[i].label },
    { label: 'Tool', value: STEPS[i].tool },
    { label: 'Change', value: 'one at a time' },
  ],
  note: { text: STEPS[i].ask, tone: 'accent' },
});

// Step 3: refused is a fast answer, a timeout is silence.
const failure = (kind: 'refused' | 'timeout'): FlowState =>
  kind === 'refused'
    ? {
        nodes: [
          { id: 'c', label: 'Client', kind: 'client', x: 0.4, y: 1.7 },
          { id: 'fw', label: 'Firewall', sub: 'allows the port', kind: 'gateway', x: 2.9, y: 1.7, status: 'dim' },
          { id: 's', label: 'Server', sub: 'nothing listening', kind: 'service', x: 5.4, y: 1.7, status: 'down' },
        ],
        links: [{ from: 'c', to: 'fw' }, { from: 'fw', to: 's' }],
        packets: [
          { from: 'c', to: 's', label: 'SYN', delay: 0, dur: 1.1 },
          { from: 's', to: 'c', label: 'RST', delay: 1.1, dur: 1.1, tone: 'bad' },
        ],
        stats: [
          { label: 'Result', value: 'refused', tone: 'bad' },
          { label: 'Speed', value: 'instant' },
          { label: 'Check', value: 'ss -ltnp' },
        ],
        note: { text: 'a clean failure: wrong port, or bound to localhost only', tone: 'bad' },
      }
    : {
        nodes: [
          { id: 'c', label: 'Client', kind: 'client', x: 0.4, y: 1.7 },
          { id: 'fw', label: 'Firewall', sub: 'drops silently', kind: 'gateway', x: 2.9, y: 1.7, status: 'down' },
          { id: 's', label: 'Server', kind: 'service', x: 5.4, y: 1.7, status: 'dim' },
        ],
        links: [{ from: 'c', to: 'fw' }, { from: 'fw', to: 's', dashed: true }],
        packets: [{ from: 'c', to: 'fw', label: 'SYN', tone: 'bad', dur: 1.1 }],
        stats: [
          { label: 'Result', value: 'timeout', tone: 'bad' },
          { label: 'Suspect', value: 'FW, SG, route' },
          { label: 'Check', value: 'nc, tcpdump' },
        ],
        note: { text: 'a hang means something silently drops packets', tone: 'bad' },
      };

// Step 4: gateway errors, three codes, three causes.
const gateway = (code: 502 | 503 | 504): FlowState => {
  const base: FlowNode[] = [
    { id: 'c', label: 'Client', kind: 'client', x: 0.2, y: 1.7 },
    { id: 'lb', label: 'Proxy', sub: 'load balancer', kind: 'lb', x: 2.7, y: 1.7 },
  ];
  if (code === 502) {
    return {
      nodes: [...base, { id: 'b', label: 'Backend', sub: 'closed keep-alive', kind: 'service', x: 5.4, y: 1.7, status: 'down' }],
      links: [{ from: 'c', to: 'lb' }, { from: 'lb', to: 'b' }],
      packets: [{ from: 'c', to: 'lb', label: 'GET', dur: 0.6 }, { from: 'lb', to: 'b', label: 'GET', delay: 0.6, dur: 0.6 }, { from: 'lb', to: 'c', label: '502', delay: 1.4, dur: 0.6, tone: 'bad' }],
      stats: [{ label: '502', value: 'bad response', tone: 'bad' }, { label: 'Cause', value: 'crash, reset' }, { label: 'Check', value: 'idle timeouts' }],
      note: { text: 'the proxy could not get a valid response from the backend', tone: 'bad' },
    };
  }
  if (code === 503) {
    return {
      nodes: [
        ...base,
        { id: 'b1', label: 'Backend 1', kind: 'service', x: 5.4, y: 0.7, status: 'down' },
        { id: 'b2', label: 'Backend 2', kind: 'service', x: 5.4, y: 2.8, status: 'down' },
      ],
      links: [{ from: 'c', to: 'lb' }, { from: 'lb', to: 'b1', dashed: true }, { from: 'lb', to: 'b2', dashed: true }],
      packets: [{ from: 'c', to: 'lb', label: 'GET', dur: 0.6 }, { from: 'lb', to: 'c', label: '503', delay: 0.8, dur: 0.6, tone: 'bad' }],
      stats: [{ label: '503', value: 'unavailable', tone: 'bad' }, { label: 'Cause', value: 'none healthy' }, { label: 'Check', value: 'target health' }],
      note: { text: 'overload, rate limiting or every target failing health checks', tone: 'bad' },
    };
  }
  return {
    nodes: [...base, { id: 'b', label: 'Backend', sub: 'too slow', kind: 'service', x: 5.4, y: 1.7, status: 'hot', meter: { value: 0.97, label: 'latency 30 s', tone: 'bad' } }],
    links: [{ from: 'c', to: 'lb' }, { from: 'lb', to: 'b' }],
    packets: [{ from: 'c', to: 'lb', label: 'GET', dur: 0.6 }, { from: 'lb', to: 'b', label: 'GET', delay: 0.6, dur: 0.6 }, { from: 'lb', to: 'c', label: '504', delay: 2.2, dur: 0.6, tone: 'bad' }],
    stats: [{ label: '504', value: 'timeout', tone: 'bad' }, { label: 'Cause', value: 'slow backend' }, { label: 'Check', value: 'proxy timeout' }],
    note: { text: 'the backend answered slower than the proxy was willing to wait', tone: 'bad' },
  };
};

// Step 5: the worked incident. Timeouts for 5 percent of calls after a spike.
const incident = (fixed: boolean): FlowState => ({
  nodes: [
    { id: 'w', label: 'App servers', sub: fixed ? 'pool + keep-alive' : 'conn per request', kind: 'worker', x: 0.2, y: 1.7, items: fixed ? ['300 conns'] : ['TIME_WAIT'] },
    {
      id: 'n',
      label: 'NAT gateway',
      sub: fixed ? '2 public IPs' : '1 public IP',
      kind: 'gateway',
      x: 2.9,
      y: 1.7,
      status: fixed ? 'normal' : 'hot',
      meter: fixed ? { value: 0.2, label: 'ports 20%', tone: 'ok' } : { value: 0.96, label: 'ports 96%', tone: 'bad' },
    },
    { id: 'p', label: 'Payment API', kind: 'external', x: 5.6, y: 1.7 },
  ],
  links: [{ from: 'w', to: 'n' }, { from: 'n', to: 'p' }],
  packets: fixed
    ? [{ from: 'w', to: 'n', label: 'reused', tone: 'ok', dur: 0.6 }, { from: 'n', to: 'p', label: 'reused', tone: 'ok', delay: 0.6, dur: 0.6 }]
    : [{ from: 'w', to: 'n', label: 'SYN', dur: 0.6 }, { from: 'n', to: 'p', label: 'no port', tone: 'bad', delay: 0.6, dur: 0.6 }],
  stats: fixed
    ? [{ label: 'Timeouts', value: 'gone', tone: 'ok' }, { label: 'Fix', value: 'pool + 2nd IP' }, { label: 'Alert on', value: 'port errors' }]
    : [{ label: 'Failed calls', value: '~5%', tone: 'bad' }, { label: 'Connect time', value: '1 s or 3 s', hint: 'SYN retransmit' }, { label: 'Clue', value: 'under load' }],
  note: fixed ? { text: 'most network incidents are connection management incidents', tone: 'ok' } : { text: 'new connection per request ran the NAT out of ports', tone: 'bad' },
});

export default defineLesson('flow', {
  slug: 'net-troubleshooting',
  objectives: [
    { text: 'Why troubleshooting works bottom up, one change at a time', step: 1 },
    { text: 'The six checks and the tool for each', step: 2 },
    { text: 'The difference between refused and timeout', step: 3 },
    { text: 'What 502, 503 and 504 each point to', step: 4 },
    { text: 'How a real incident was traced to NAT ports', step: 5 },
  ],
  steps: [
    {
      label: 'Method',
      title: 'Work up the stack',
      tag: 'problem',
      body: ['"The network is broken" is vague. Start at the bottom and move up: interface, reachability, DNS, port, TLS, application.', 'Change one thing at a time, and ask who is affected, what changed, and whether it fails fast or hangs.'],
      keyIdea: 'Each layer depends on the ones below, so a failure low down explains every symptom above it.',
      frames: [{ state: vague, hold: 2800 }],
    },
    {
      label: 'The ladder',
      title: 'One check, one tool',
      tag: 'technique',
      body: ['`ip addr` and `ip route` for the interface, `ping` and `mtr` for reachability, `dig` for names, `nc` and `ss` for ports, `openssl s_client` for TLS, `curl` timings for the app.', 'When all else is unclear, `tcpdump` on both ends shows what really crossed the wire.'],
      keyIdea: 'Stop at the first layer that fails. Everything above it is noise until it is fixed.',
      frames: STEPS.map((_, i) => ({ state: walk(i), hold: 1500 })),
    },
    {
      label: 'Refused vs hang',
      title: 'Fast no, or silence',
      tag: 'concept',
      body: ['**Connection refused** is a clean answer: a RST because nothing listens on that port. **Timeout** means packets vanish.', 'Silent drops usually come from a firewall, a security group, a bad route or an MTU problem.'],
      keyIdea: 'Refused: look at the server socket. Timeout: look at what sits between the two.',
      frames: [{ state: failure('refused'), hold: 3000 }, { state: failure('timeout'), hold: 3000 }],
    },
    {
      label: '5xx codes',
      title: '502, 503, 504',
      tag: 'concept',
      body: ['**502** means the proxy could not get a valid response, often a backend that crashed or closed a keep-alive connection. **503** means no healthy backend, overload or rate limiting.', '**504** means the backend was slower than the proxy timeout.'],
      keyIdea: 'Keep the idle timeout of each hop longer than the hop before it, or 502s appear on reused connections.',
      frames: [{ state: gateway(502), hold: 3000 }, { state: gateway(503), hold: 2800 }, { state: gateway(504), hold: 3200 }],
    },
    {
      label: 'Incident',
      title: 'Timeouts only under load',
      tag: 'in practice',
      body: ['About 5% of payment calls timed out after a spike. `curl -w` showed connects taking 1 or 3 seconds: **SYN retransmission**.', '`ss` counted about 28,000 sockets in `TIME-WAIT`. A new connection per request, all behind one NAT IP, ran out of ports.'],
      keyIdea: 'Fix: a shared connection pool with keep-alive plus a second NAT IP. Then alert on NAT port errors and TIME-WAIT counts.',
      frames: [{ state: incident(false), hold: 3000 }, { state: incident(true), hold: 3000 }],
    },
    {
      label: 'Recap',
      title: 'Symptom to first check',
      tag: 'recap',
      body: [
        '- **Method:** bottom up, one change at a time.',
        '- **Works by IP, fails by name:** `dig`, resolver config.',
        '- **Refused:** `ss -ltnp`. **Timeout:** firewall, security group, route.',
        '- **502, 503, 504:** crashed or reset backend, no healthy targets, slow backend.',
        '- **Small ok, large hangs:** MTU, test with `ping -M do -s 1472`.',
      ],
      keyIdea: 'Most "network" incidents are really connection management incidents: reuse, pool, and watch the counters.',
      frames: [{ state: walk(5), hold: 2000 }],
    },
  ],
});
