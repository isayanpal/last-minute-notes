import { defineLesson } from '../define';
import type { FlowLink, FlowNode, FlowState, Packet } from '../engines/flow';
import { patch } from '../engines/layouts';
import type { Stat } from '../types';

/*
 * The estimation template as a diagram: users feed QPS, QPS feeds storage, bandwidth, cache and servers.
 * Numbers are computed from the worked example's assumptions below, rounded the way the notes round them.
 */

const DAU = 100e6;
const UPLOADS_PER_USER = 0.1;
const VIEWS_PER_USER = 50;
const PHOTO_MB = 2;
const THUMB_KB = 200;
const REPLICAS = 3;
const PEAK = 3;
const DAY_S = 86_400;
const SERVER_QPS = 5_000;

const uploadsPerDay = DAU * UPLOADS_PER_USER; // 10M
const uploadAvg = Math.round(uploadsPerDay / DAY_S); // ~116
const uploadPeak = Math.round((uploadAvg * PEAK) / 50) * 50; // ~350
const viewsPerDay = DAU * VIEWS_PER_USER; // 5B
const viewAvgK = Math.round(viewsPerDay / DAY_S / 1000); // ~58k
const viewPeakK = Math.round((viewAvgK * PEAK) / 5) * 5; // ~175k
const ratio = viewsPerDay / uploadsPerDay; // 500
const tbPerDay = (uploadsPerDay * PHOTO_MB) / 1e6; // 20 TB
const pbPerYear = (tbPerDay * 365) / 1000; // 7.3 PB
const pbReplicated = Math.round(pbPerYear * REPLICAS); // ~22 PB
const pbEgressPerDay = (viewsPerDay * THUMB_KB) / 1e12; // 1 PB
const gbPerSec = (pbEgressPerDay * 1e6) / DAY_S; // ~11.6 GB/s
const gbps = Math.round(gbPerSec * 8); // ~93 Gbps
const servers = (viewPeakK * 1000) / SERVER_QPS; // 35

const fmt = (n: number) => n.toLocaleString('en-US');

const USERS: FlowNode = { id: 'users', label: 'Users', sub: '100M daily', kind: 'client', x: 0, y: 1.8 };
const QPS: FlowNode = { id: 'qps', label: 'QPS', sub: 'avg and peak', kind: 'lb', x: 1.7, y: 1.8 };
const STORAGE: FlowNode = { id: 'storage', label: 'Storage', sub: 'day, year, copies', kind: 'storage', x: 3.6, y: 0.3 };
const BANDWIDTH: FlowNode = { id: 'bw', label: 'Bandwidth', sub: 'bits per second', kind: 'cdn', x: 4.9, y: 1.3 };
const CACHE: FlowNode = { id: 'cache', label: 'Cache size', sub: 'hot 20% of reads', kind: 'cache', x: 4.9, y: 2.5 };
const SERVERS: FlowNode = { id: 'servers', label: 'Servers', sub: 'with headroom', kind: 'service', x: 3.6, y: 3.3 };

const NODES = [USERS, QPS, STORAGE, BANDWIDTH, CACHE, SERVERS];
const OUTPUTS = ['storage', 'bw', 'cache', 'servers'];

const LINKS: FlowLink[] = [{ from: 'users', to: 'qps' }, ...OUTPUTS.map((id) => ({ from: 'qps', to: id }))];

/** Template scene: focus some nodes, dim the rest, override per node. */
const tpl = (focus: string[] | 'all', changes: Record<string, Partial<FlowNode>>, over: Partial<FlowState> = {}): FlowState => {
  const dim: Record<string, Partial<FlowNode>> = {};
  if (focus !== 'all') for (const n of NODES) if (!focus.includes(n.id)) dim[n.id] = { status: 'dim' };
  return {
    nodes: patch(patch(NODES, dim), changes),
    links: LINKS.map((l) => (focus !== 'all' && focus.includes(l.from) && focus.includes(l.to) ? { ...l, tone: 'accent' as const } : l)),
    ...over,
  };
};

const flowTo = (to: string, label: string, delay = 0, tone: Packet['tone'] = 'data'): Packet => ({ from: 'qps', to, label, delay, tone, dur: 0.7 });

// Step 1: the question the numbers answer.
const QUESTION: FlowState = tpl(
  'all',
  Object.fromEntries(OUTPUTS.map((id) => [id, { badge: { text: '?', tone: 'neutral' as const } }])),
  {
    stats: [
      { label: 'Goal', value: 'right order' },
      { label: 'One box', value: 'or 1,000?' },
      { label: 'Bottleneck', value: 'CPU, disk, net' },
    ],
    note: { text: 'not accuracy: which decision do the numbers force?' },
  },
);

// Step 2: per day to per second.
const SHORTCUTS: [string, string][] = [
  ['1M / day', '~12 / s'],
  ['100M / day', '~1,200 / s'],
  ['1B / day', '~12,000 / s'],
];
const shortcut = (i: number): FlowState =>
  tpl(
    ['users', 'qps'],
    { users: { sub: SHORTCUTS[i][0] }, qps: { badge: { text: SHORTCUTS[i][1], tone: 'accent' } } },
    {
      packets: [{ from: 'users', to: 'qps', label: SHORTCUTS[i][0], dur: 0.8 }],
      stats: [
        { label: '1 day', value: '86,400 s', hint: 'round to 100,000' },
        { label: 'Per day', value: SHORTCUTS[i][0] },
        { label: 'Per second', value: SHORTCUTS[i][1], tone: 'ok' },
      ],
      note: i === 2 ? { text: 'peak is 2x to 5x the average: use 3x', tone: 'accent' } : undefined,
    },
  );

// Step 3: write and read QPS for the photo app.
const qpsFrame = (phase: 'write' | 'read' | 'ratio'): FlowState => {
  const stats: Stat[] =
    phase === 'write'
      ? [
          { label: 'Uploads/day', value: '10M', hint: '100M x 0.1' },
          { label: 'Avg QPS', value: `~${uploadAvg}` },
          { label: 'Peak QPS', value: `~${uploadPeak}`, hint: 'x3' },
        ]
      : phase === 'read'
        ? [
            { label: 'Views/day', value: '5B', hint: '100M x 50' },
            { label: 'Avg QPS', value: `~${viewAvgK}k` },
            { label: 'Peak QPS', value: `~${viewPeakK}k`, tone: 'bad', hint: 'x3' },
          ]
        : [
            { label: 'Read QPS', value: `~${viewPeakK}k` },
            { label: 'Write QPS', value: `~${uploadPeak}` },
            { label: 'Read:write', value: `${ratio} : 1`, tone: 'bad' },
          ];
  return tpl(
    ['users', 'qps'],
    {
      qps:
        phase === 'write'
          ? { badge: { text: `writes ~${uploadPeak}/s`, tone: 'accent' }, meter: { value: 0.05, label: 'writes' } }
          : phase === 'read'
            ? { badge: { text: `reads ~${viewPeakK}k/s`, tone: 'bad' }, meter: { value: 0.95, label: 'reads', tone: 'bad' } }
            : { badge: { text: `${ratio} : 1`, tone: 'bad' }, meter: { value: 0.95, label: 'read heavy', tone: 'bad' } },
      users: { sub: phase === 'write' ? '0.1 upload each' : '50 views each' },
    },
    {
      packets:
        phase === 'ratio'
          ? Array.from({ length: 5 }, (_, i) => ({ from: 'users', to: 'qps', delay: i * 0.18, dur: 0.6, tone: (i === 2 ? 'data' : 'req') as Packet['tone'], label: i === 2 ? 'upload' : undefined }))
          : [{ from: 'users', to: 'qps', label: phase === 'write' ? '10M/day' : '5B/day', dur: 0.8, tone: phase === 'write' ? 'data' : 'req' }],
      stats,
      note: phase === 'ratio' ? { text: 'reads dwarf writes: this is a read problem' } : undefined,
    },
  );
};

// Step 4: storage per day, per year, replicated.
const storageFrame = (phase: 0 | 1 | 2): FlowState =>
  tpl(
    ['qps', 'storage'],
    {
      storage: {
        badge: { text: phase === 0 ? `${tbPerDay} TB / day` : phase === 1 ? `${pbPerYear.toFixed(1)} PB / year` : `~${pbReplicated} PB / year`, tone: phase === 2 ? 'bad' : 'accent' },
        items: phase === 2 ? ['copy 1', 'copy 2', 'copy 3'] : phase === 1 ? ['year 1'] : undefined,
        status: 'active',
      },
    },
    {
      packets: [flowTo('storage', phase === 0 ? '10M x 2 MB' : phase === 1 ? 'x 365' : 'x 3 copies')],
      stats: [
        { label: 'Per day', value: `${tbPerDay} TB` },
        { label: 'Per year', value: `${pbPerYear.toFixed(1)} PB` },
        { label: 'Replicated', value: phase === 2 ? `~${pbReplicated} PB/yr` : '-', tone: phase === 2 ? 'bad' : 'neutral' },
      ],
      note: phase === 2 ? { text: 'forgetting replication is a classic mistake', tone: 'bad' } : undefined,
    },
  );

// Step 5: egress bandwidth, bytes to bits.
const bwFrame = (phase: 0 | 1 | 2): FlowState =>
  tpl(
    ['qps', 'bw'],
    {
      bw: {
        badge: { text: phase === 0 ? `${pbEgressPerDay} PB / day` : phase === 1 ? `~${gbPerSec.toFixed(1)} GB/s` : `~${gbps} Gbps`, tone: phase === 2 ? 'bad' : 'accent' },
        status: 'active',
      },
    },
    {
      packets: [flowTo('bw', phase === 0 ? '5B x 200 KB' : phase === 1 ? '/ 86,400 s' : 'x 8 bits')],
      stats: [
        { label: 'Egress/day', value: `${pbEgressPerDay} PB` },
        { label: 'Bytes/s', value: `~${gbPerSec.toFixed(1)} GB/s` },
        { label: 'Bits/s', value: phase === 2 ? `~${gbps} Gbps` : '-', tone: phase === 2 ? 'bad' : 'neutral' },
      ],
      note: phase === 2 ? { text: 'network is quoted in bits, storage in bytes' } : undefined,
    },
  );

// Step 6: server count.
const serverFrame = (phase: 0 | 1): FlowState =>
  tpl(
    ['qps', 'servers'],
    {
      servers: {
        badge: { text: phase === 0 ? `${servers} servers` : '~40 to 50', tone: phase === 0 ? 'accent' : 'ok' },
        items: phase === 0 ? ['5k QPS'] : ['N', '+1', '+2'],
        status: 'active',
      },
    },
    {
      packets: [flowTo('servers', phase === 0 ? `${viewPeakK}k / 5k` : 'N + 2')],
      stats: [
        { label: 'Peak QPS', value: `${fmt(viewPeakK * 1000)}` },
        { label: 'Per server', value: '5,000 QPS', hint: 'assumed' },
        { label: 'Servers', value: phase === 0 ? String(servers) : '40 to 50', tone: 'ok' },
      ],
      note: phase === 1 ? { text: 'spares so a lost node does not overload the rest', tone: 'accent' } : undefined,
    },
  );

// Step 7: what the numbers force.
const decisions = (phase: 0 | 1): FlowState =>
  tpl(
    'all',
    phase === 0
      ? {
          cache: { badge: { text: 'cache hard', tone: 'ok' }, status: 'active' },
          bw: { badge: { text: 'serve via CDN', tone: 'ok' }, status: 'active' },
        }
      : {
          storage: { badge: { text: 'object storage', tone: 'ok' }, status: 'active', items: ['blobs'] },
          servers: { badge: { text: 'writes are easy', tone: 'ok' } },
          qps: { badge: { text: 'metadata in DB', tone: 'accent' } },
        },
    {
      stats:
        phase === 0
          ? [
              { label: 'Read:write', value: '500 : 1' },
              { label: 'Egress', value: `~${gbps} Gbps`, tone: 'bad' },
              { label: 'So', value: 'cache + CDN', tone: 'ok' },
            ]
          : [
              { label: 'Data', value: 'PB per year' },
              { label: 'Write QPS', value: `~${uploadPeak}`, tone: 'ok' },
              { label: 'Hard part', value: 'metadata, feed' },
            ],
      note: phase === 0 ? { text: 'the origin cannot carry 93 Gbps cheaply' } : { text: 'blobs in object storage, tiny metadata in a database' },
    },
  );

const RECAP: FlowState = tpl(
  'all',
  {
    users: { sub: '100M daily' },
    qps: { badge: { text: `~${viewPeakK}k peak`, tone: 'accent' } },
    storage: { badge: { text: `~${pbReplicated} PB/yr`, tone: 'accent' } },
    bw: { badge: { text: `~${gbps} Gbps`, tone: 'accent' } },
    servers: { badge: { text: '40 to 50', tone: 'accent' } },
  },
  {
    links: LINKS.map((l) => ({ ...l, tone: 'accent' as const })),
    packets: [{ from: 'users', to: 'qps', dur: 0.6 }, ...OUTPUTS.map((id, i) => flowTo(id, '', 0.7 + i * 0.15))],
    stats: [
      { label: 'Day', value: '~100,000 s' },
      { label: 'Peak', value: '3x average' },
      { label: 'Storage', value: 'x replicas' },
    ],
  },
);

export default defineLesson('flow', {
  slug: 'estimation',
  objectives: [
    { text: 'Convert per day numbers to QPS in your head', step: 2 },
    { text: 'Derive average and peak QPS and the read:write ratio', step: 3 },
    { text: 'Estimate storage with replication, and bandwidth in bits', step: 5 },
    { text: 'Turn peak QPS into a server count with headroom', step: 6 },
    { text: 'Let the numbers drive design decisions', step: 7 },
  ],
  steps: [
    {
      label: 'The question',
      title: 'One machine or a thousand?',
      tag: 'problem',
      body: [
        'Before you draw boxes, you need a rough size. The goal is **not accuracy**.',
        'It is to know whether you need one machine or one thousand, and whether the bottleneck is CPU, memory, disk or network.',
      ],
      keyIdea: 'Estimate only what changes a decision. Ten minutes of arithmetic that changes nothing is wasted.',
      frames: [{ state: QUESTION }],
    },
    {
      label: 'Shortcuts',
      title: 'Per day to per second',
      tag: 'concept',
      body: [
        'A day is 86,400 seconds. Round it to **100,000** and the conversions become mental math.',
        'Then multiply by a **peak factor**. Peak is commonly 2x to 5x the average, so use 3x unless told otherwise.',
      ],
      keyIdea: '1M a day is about 12 a second. Scale from there by powers of ten.',
      frames: [0, 1, 2].map((i) => ({ state: shortcut(i), hold: 1600 })),
    },
    {
      label: 'QPS',
      title: 'Photo app: writes and reads',
      tag: 'technique',
      body: [
        '100M daily users each upload **0.1** photos and view **50** a day.',
        'Uploads: 10M a day, about 116 per second, about 350 at peak. Views: 5B a day, about 58k per second, about 175k at peak.',
      ],
      keyIdea: 'Always compute reads and writes separately. Their ratio tells you where the design effort goes.',
      frames: [
        { state: qpsFrame('write'), hold: 2000 },
        { state: qpsFrame('read'), hold: 2000 },
        { state: qpsFrame('ratio') },
      ],
    },
    {
      label: 'Storage',
      title: 'Storage per day, per year, per copy',
      tag: 'technique',
      body: [
        '10M uploads at 2 MB each is **20 TB a day**. Kept forever, that is 7.3 PB a year.',
        'With a replication factor of 3, plan for about **22 PB a year**.',
      ],
      keyIdea: 'Storage = writes x size x retention x replicas. Leaving out replicas undercounts by 3x.',
      frames: [
        { state: storageFrame(0), hold: 1600 },
        { state: storageFrame(1), hold: 1600 },
        { state: storageFrame(2) },
      ],
    },
    {
      label: 'Bandwidth',
      title: 'Egress, in bits',
      tag: 'technique',
      body: [
        '5B views of a 200 KB thumbnail is **1 PB a day** leaving your system.',
        'Divide by 86,400 seconds: about 11.6 GB/s. Networks are quoted in bits, so multiply by 8: about **93 Gbps** on average.',
      ],
      keyIdea: 'Mixing bits and bytes is an 8x error. Storage is bytes, network is bits per second.',
      frames: [
        { state: bwFrame(0), hold: 1600 },
        { state: bwFrame(1), hold: 1600 },
        { state: bwFrame(2) },
      ],
    },
    {
      label: 'Servers',
      title: 'How many servers?',
      tag: 'technique',
      body: [
        'Assume one app server handles about 5,000 simple requests per second. 175,000 / 5,000 = **35** servers.',
        'Add N+2 redundancy and you land at about **40 to 50**.',
      ],
      keyIdea: 'If the estimate says 3 servers, do not draw a 200 node cluster. If it says 3,000, sharding and a cache tier are unavoidable.',
      frames: [
        { state: serverFrame(0), hold: 1800 },
        { state: serverFrame(1) },
      ],
    },
    {
      label: 'Decisions',
      title: 'What the numbers force',
      tag: 'trade-off',
      body: [
        'Reads outnumber writes 500 to 1, so **cache aggressively** and serve images from a **CDN**.',
        'Petabytes a year belong in **object storage** with tiering, not a database. 350 write QPS is small: metadata and feed generation are the hard part.',
      ],
      keyIdea: 'Every number should end in a decision. If it does not change the design, stop computing it.',
      frames: [
        { state: decisions(0), hold: 2400 },
        { state: decisions(1) },
      ],
    },
    {
      label: 'Recap',
      title: 'The estimation template',
      tag: 'recap',
      body: [
        '- **Start:** users and actions per user.',
        '- **QPS:** per day / 100,000, then x3 for peak.',
        '- **Storage:** per day, per year, times replicas.',
        '- **Bandwidth:** in and out, in bits per second.',
        '- **Servers:** peak QPS / per-server QPS, plus N+2.',
        '- **Mistakes:** no peak factor, no replicas, bits vs bytes, math that changes nothing.',
      ],
      keyIdea: 'Users -> QPS -> storage, bandwidth, cache and servers. Then let the numbers pick the architecture.',
      frames: [{ state: RECAP }],
    },
  ],
});
