import { defineLesson } from '../define';
import type { FlowState, Packet } from '../engines/flow';

/*
 * Follows the React Native notes on over-the-air updates: the JS bundle and assets load at runtime so they can be replaced,
 * but only for binaries with a matching runtime version, which is a fingerprint of the native layer. A real fingerprint
 * hash and a real eligibility check decide who receives an update and which changes need a store build.
 */

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 5);
};
/** The runtime version is derived from native dependencies and config, never from JS code. */
const fingerprint = (native: string[]) => hash([...native].sort().join('|'));

const NATIVE_V1 = ['react-native@0.76', 'expo-camera'];
const NATIVE_V2 = [...NATIVE_V1, 'expo-haptics']; // a new native module
const RT1 = fingerprint(NATIVE_V1);
const RT2 = fingerprint(NATIVE_V2);
const jsOnly = fingerprint(NATIVE_V1); // a JS-only change leaves the native list alone

type Binary = { name: string; runtime: string };
const BINARIES: Binary[] = [{ name: 'App 1.0', runtime: RT1 }, { name: 'App 1.1', runtime: RT2 }];
const eligible = (b: Binary, updateRuntime: string) => b.runtime === updateRuntime;

type Change = { what: string; native: boolean; needs: string };
const CHANGES: Change[] = [
  { what: 'fix a JS bug', native: false, needs: 'OTA update' },
  { what: 'change copy', native: false, needs: 'OTA update' },
  { what: 'new native mod', native: true, needs: 'store build' },
  { what: 'Info.plist', native: true, needs: 'store build' },
];

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.55 });

// Step 1: JS loads at runtime, so it can be replaced.
const pipeline = (phase: 0 | 1 | 2): FlowState => ({
  nodes: [
    { id: 'dev', label: 'Merge', sub: 'to main', kind: 'client', x: 0.1, y: 1.7, status: phase === 0 ? 'active' : 'normal' },
    { id: 'pub', label: 'eas update', sub: 'publish JS bundle', kind: 'worker', x: 1.9, y: 1.7, status: phase === 0 ? 'active' : 'normal' },
    { id: 'cdn', label: 'Update CDN', sub: 'serves bundles', kind: 'cdn', x: 3.7, y: 1.7, status: phase >= 1 ? 'active' : 'normal' },
    { id: 'app', label: 'App launch', sub: phase === 2 ? 'new JS next launch' : 'checks for update', kind: 'service', x: 5.5, y: 1.7, status: phase >= 1 ? 'active' : 'normal' },
  ],
  links: [{ from: 'dev', to: 'pub' }, { from: 'pub', to: 'cdn' }, { from: 'app', to: 'cdn', dashed: true }],
  packets: phase === 0 ? [hop('dev', 'pub', 'JS + assets', 0, 'req'), hop('pub', 'cdn', 'bundle', 0.6, 'data')] : phase === 1 ? [hop('app', 'cdn', 'any update?', 0, 'req'), hop('cdn', 'app', 'download', 0.6, 'ok')] : [],
  stats: [
    { label: 'What ships', value: 'JS + assets' },
    { label: 'Store review', value: 'not needed' },
    { label: 'Applied', value: phase === 2 ? 'next launch' : '-', tone: phase === 2 ? 'ok' : 'neutral' },
  ],
  note: phase === 0 ? { text: 'the JS bundle and assets are loaded at runtime, so they can be replaced', tone: 'accent' } : phase === 1 ? { text: 'the app checks on launch and downloads in the background', tone: 'accent' } : { text: 'applied on the next launch, or immediately with reloadAsync()', tone: 'ok' },
});

// Step 2: runtime version gating.
const gating = (i: number): FlowState => {
  const b = BINARIES[i];
  const ok = eligible(b, RT2);
  return {
    nodes: [
      { id: 'up', label: 'Update', sub: `runtime ${RT2}`, kind: 'cdn', x: 0.1, y: 1.7, status: 'active' },
      { id: 'chk', label: 'Runtime match?', sub: `binary ${b.runtime}`, kind: 'gateway', x: 2.9, y: 1.7, status: 'active' },
      { id: 'b', label: b.name, sub: ok ? 'receives update' : 'keeps its JS', kind: 'service', x: 5.6, y: 1.7, status: ok ? 'active' : 'down' },
    ],
    links: [{ from: 'up', to: 'chk' }, { from: 'chk', to: 'b', dashed: !ok }],
    packets: [hop('up', 'chk', 'runtime', 0, 'req'), hop('chk', 'b', ok ? 'deliver' : 'skip', 0.6, ok ? 'ok' : 'bad')],
    stats: [
      { label: 'Update runtime', value: RT2 },
      { label: 'Binary runtime', value: b.runtime },
      { label: 'Delivered', value: ok ? 'yes' : 'no', tone: ok ? 'ok' : 'bad' },
    ],
    note: ok ? { text: 'matching runtime version: the update is safe for this native layer', tone: 'ok' } : { text: 'older native layer: delivering newer JS could crash it, so it is skipped', tone: 'bad' },
  };
};

// Step 3: the fingerprint follows native dependencies, not JS.
const fp = (native: boolean): FlowState => {
  const now = native ? fingerprint(NATIVE_V2) : jsOnly;
  const changed = now !== RT1;
  return {
    nodes: [
      { id: 'ch', label: native ? 'Add haptics' : 'Fix JS bug', sub: native ? 'native module' : 'JS only', kind: 'client', x: 0.1, y: 1.7, status: 'active' },
      { id: 'fp', label: 'Fingerprint', sub: 'native deps + config', kind: 'gateway', x: 2.9, y: 1.7, status: 'active', items: [now] },
      { id: 'rt', label: changed ? 'New runtime' : 'Same runtime', sub: changed ? 'needs a new binary' : 'OTA is safe', kind: changed ? 'external' : 'service', x: 5.6, y: 1.7, status: changed ? 'hot' : 'active' },
    ],
    links: [{ from: 'ch', to: 'fp' }, { from: 'fp', to: 'rt' }],
    packets: [hop('ch', 'fp', 'hash', 0, 'req'), hop('fp', 'rt', changed ? 'differs' : 'equal', 0.6, changed ? 'bad' : 'ok')],
    stats: [
      { label: 'Before', value: RT1 },
      { label: 'After', value: now, tone: changed ? 'bad' : 'ok' },
      { label: 'Ship via', value: changed ? 'store build' : 'OTA', tone: changed ? 'bad' : 'ok' },
    ],
    note: changed ? { text: 'a new native module changes the fingerprint, so old binaries must not receive this JS', tone: 'bad' } : { text: 'a JS-only change leaves the fingerprint alone, so existing binaries accept it', tone: 'ok' },
  };
};

// Step 4: what can go over the air.
const classify = (i: number): FlowState => {
  const c = CHANGES[i];
  return {
    nodes: [
      { id: 'c', label: c.what, sub: c.native ? 'native layer' : 'JS or assets', kind: 'client', x: 0.1, y: 1.7, status: 'active' },
      { id: 'g', label: 'Native change?', sub: c.native ? 'yes' : 'no', kind: 'gateway', x: 2.9, y: 1.7, status: 'active' },
      { id: 'r', label: c.needs, sub: c.native ? 'new binary' : 'no review wait', kind: c.native ? 'external' : 'cdn', x: 5.5, y: 1.7, status: c.native ? 'hot' : 'active' },
    ],
    links: [{ from: 'c', to: 'g' }, { from: 'g', to: 'r' }],
    packets: [hop('c', 'g', c.what, 0, 'req'), hop('g', 'r', c.needs, 0.6, c.native ? 'bad' : 'ok')],
    stats: [
      { label: 'Change', value: c.what },
      { label: 'Needs', value: c.needs, tone: c.native ? 'bad' : 'ok' },
      { label: 'Touches native', value: c.native ? 'yes' : 'no' },
    ],
    note: c.native ? { text: 'native code, permissions and entitlements are baked into the binary', tone: 'bad' } : { text: 'JS, styles, copy and bundled assets can be replaced over the air', tone: 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'rn-ota-updates',
  objectives: [
    { text: 'Why a JS bundle can be updated without a store release', step: 1 },
    { text: 'How runtime version gates delivery', step: 2 },
    { text: 'How the fingerprint tracks native changes', step: 3 },
    { text: 'Which changes still need a store build', step: 4 },
  ],
  steps: [
    {
      label: 'Runtime JS',
      title: 'The bundle loads at runtime',
      tag: 'problem',
      body: ['A React Native app loads its JS bundle and assets when it launches, so they can be replaced without a new store binary.', '`eas update` publishes them, and the app checks for an update on launch.'],
      keyIdea: 'OTA updates the JS layer only.',
      frames: [0, 1, 2].map((p) => ({ state: pipeline(p as 0 | 1 | 2), hold: p === 2 ? 3400 : 2400 })),
    },
    {
      label: 'Runtime',
      title: 'Only matching binaries',
      tag: 'concept',
      body: ['An update is delivered only to binaries with the **same runtime version**.', 'This stops JS that expects a new native module from crashing an older binary.'],
      keyIdea: 'Runtime version is a fingerprint of the native layer.',
      frames: [0, 1].map((i) => ({ state: gating(i), hold: 3600 })),
    },
    {
      label: 'Fingerprint',
      title: 'JS changes do not move it',
      tag: 'technique',
      body: ['The `fingerprint` policy hashes native dependencies and config. A JS fix keeps it, and adding a native module changes it.', 'A changed fingerprint means a new binary is required.'],
      keyIdea: 'The fingerprint is computed from native dependencies, never from JS code.',
      frames: [{ state: fp(false), hold: 3600 }, { state: fp(true), hold: 4000 }],
    },
    {
      label: 'Limits',
      title: 'What cannot go over the air',
      tag: 'trade-off',
      body: ['JS code, styles, copy and bundled assets can ship over the air.', 'New native modules, permission changes, icons and splash screens, and an RN or Expo SDK upgrade need a store build.'],
      keyIdea: 'OTA is for fixes and incremental changes, not for shipping a different app.',
      frames: [0, 1, 2, 3].map((i) => ({ state: classify(i), hold: 2600 })),
    },
    {
      label: 'Recap',
      title: 'Over-the-air updates',
      tag: 'recap',
      body: [
        '- **OTA:** replaces JS and assets at runtime.',
        '- **Runtime version:** gates delivery to compatible binaries.',
        '- **Fingerprint:** hash of the native layer.',
        '- **Store build:** any native, permission or SDK change.',
        '- **Rollouts:** release gradually, monitor crashes, roll back by republishing.',
      ],
      keyIdea: 'JS-only changes, compatible with the installed native runtime, rolled out gradually with monitoring.',
      frames: [{ state: fp(true) }],
    },
  ],
});
