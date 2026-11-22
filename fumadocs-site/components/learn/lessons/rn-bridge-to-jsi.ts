import { defineLesson } from '../define';
import type { SeqMessage, SeqState } from '../engines/sequence';

/*
 * Follows the React Native notes on the legacy bridge, JSI and Turbo Modules. The payload size comes from JSON.stringify
 * on a real message batch, the JSI call is a real synchronous function call, and the lazy-versus-eager module counts come from
 * running a small module registry.
 */

type Msg = { m: string; a: unknown[] };
const batch = (scrollEvents: number): Msg[] => [
  { m: 'createView', a: [7, 'RCTView', { flex: 1 }] },
  { m: 'updateProps', a: [7, { opacity: 0.8 }] },
  ...Array.from({ length: scrollEvents }, (_, i) => ({ m: 'onScroll', a: [7, { contentOffset: { x: 0, y: i * 4 }, contentSize: { width: 390, height: 4000 } }] })),
];
const bytes = (n: number) => JSON.stringify(batch(n)).length;
const B1 = bytes(1);
const B60 = bytes(60);

// A JSI host function: JS calls it directly and gets a value back synchronously, no JSON.
const hostMultiply = (a: number, b: number) => a * b;
const syncResult = hostMultiply(6, 7);

// Eager initialisation of every native module versus lazy Turbo Modules.
const MODULES = ['Camera', 'Storage', 'Sensors', 'Contacts', 'Haptics', 'Share', 'Biometrics', 'DeviceInfo'];
class Registry {
  created = new Set<string>();
  constructor(private lazy: boolean) {
    if (!lazy) MODULES.forEach((m) => this.created.add(m));
  }
  get(name: string) {
    this.created.add(name);
  }
}
const eager = new Registry(false);
const lazy = new Registry(true);
lazy.get('Storage');
lazy.get('Haptics');

const m = (from: string, to: string, label: string, tone?: SeqMessage['tone'], dashed?: boolean): SeqMessage => ({ from, to, label, tone, dashed });
const BRIDGE: SeqState['actors'] = [
  { id: 'js', label: 'JS thread', kind: 'worker' },
  { id: 'bridge', label: 'Bridge', kind: 'queue' },
  { id: 'native', label: 'Native', kind: 'service' },
];

// Step 1: everything is serialised and queued.
const LEGACY: SeqMessage[] = [
  m('js', 'bridge', 'JSON batch', 'req'),
  m('bridge', 'native', 'deserialize, dispatch', 'data'),
  m('native', 'bridge', 'event as JSON', 'data', true),
  m('bridge', 'js', 'deserialize, call handler', 'res', true),
];
const legacy = (n: number): SeqState => ({
  actors: BRIDGE,
  messages: LEGACY.slice(0, n),
  stats: [
    { label: 'Format', value: 'JSON' },
    { label: 'Batch size', value: `${B1} bytes` },
    { label: 'Direction', value: 'async only', tone: 'bad' },
  ],
  note: { text: 'JS and native could only talk by serialising JSON over an asynchronous queue', tone: n >= 4 ? 'bad' : 'accent' },
});

// Step 2: the costs.
const costs = (): SeqState => ({
  actors: BRIDGE,
  messages: [m('js', 'bridge', 'measure(view)', 'req'), m('bridge', 'native', 'queued for later', 'data'), m('native', 'bridge', 'frame as JSON', 'data', true), m('bridge', 'js', 'callback, a frame late', 'bad', true)],
  stats: [
    { label: '1 scroll event', value: `${B1} bytes` },
    { label: '60 events', value: `${B60} bytes`, tone: 'bad' },
    { label: 'JS can read', value: 'never sync', tone: 'bad' },
  ],
  note: { text: `${B60} bytes for 60 scroll events, and JS can only read layout asynchronously`, tone: 'bad' },
});

// Step 3: JSI.
const JSI_ACTORS: SeqState['actors'] = [{ id: 'js', label: 'JS (Hermes)', kind: 'worker' }, { id: 'cpp', label: 'C++ host', kind: 'gateway' }, { id: 'native', label: 'Native', kind: 'service' }];
const jsi = (n: number): SeqState => ({
  actors: JSI_ACTORS,
  messages: [m('js', 'cpp', 'multiply(6, 7)', 'req'), m('cpp', 'js', `returns ${syncResult} at once`, 'ok', true), m('js', 'native', 'ArrayBuffer, no copy', 'violet')].slice(0, n),
  stats: [
    { label: 'multiply(6, 7)', value: String(syncResult), tone: 'ok' },
    { label: 'JSON', value: 'none', tone: 'ok' },
    { label: 'Call style', value: 'sync or async' },
  ],
  note: n >= 3 ? { text: 'shared memory: pass ArrayBuffers and object references, not copies', tone: 'ok' } : { text: 'JS holds a reference to a C++ function and calls it directly', tone: 'accent' },
});

// Step 4: lazy Turbo Modules.
const REG_ACTORS: SeqState['actors'] = [{ id: 'js', label: 'JS', kind: 'worker' }, { id: 'reg', label: 'Registry', kind: 'gateway' }, { id: 'mod', label: 'Module', kind: 'service' }];
const turbo = (kind: 'eager' | 'lazy'): SeqState => ({
  actors: REG_ACTORS,
  messages: kind === 'eager' ? [m('reg', 'mod', `init all ${eager.created.size} at start`, 'bad')] : [m('js', 'reg', 'first use: Storage', 'req'), m('reg', 'mod', 'create Storage', 'ok'), m('js', 'reg', 'first use: Haptics', 'req'), m('reg', 'mod', 'create Haptics', 'ok')],
  stats: [
    { label: 'Modules', value: String(MODULES.length) },
    { label: 'Created', value: String(kind === 'eager' ? eager.created.size : lazy.created.size), tone: kind === 'eager' ? 'bad' : 'ok' },
    { label: 'At startup', value: kind === 'eager' ? 'all of them' : 'none', tone: kind === 'eager' ? 'bad' : 'ok' },
  ],
  note: kind === 'eager' ? { text: 'the old module system initialised every module at startup, used or not', tone: 'bad' } : { text: 'Turbo Modules are created on first access, so startup only pays for what runs', tone: 'ok' },
});

export default defineLesson('sequence', {
  slug: 'rn-bridge-to-jsi',
  objectives: [
    { text: 'How the legacy bridge moved data', step: 1 },
    { text: 'What serialisation and async-only access cost', step: 2 },
    { text: 'How JSI calls native code directly', step: 3 },
    { text: 'Why Turbo Modules load lazily', step: 4 },
  ],
  steps: [
    {
      label: 'Bridge',
      title: 'JSON over a queue',
      tag: 'problem',
      body: ['Before the New Architecture, JS and native could only talk by **serialising messages to JSON** and sending them asynchronously over a queue.', 'Every message was deserialised on the other side.'],
      keyIdea: 'The bridge was the only door between JavaScript and native.',
      frames: [1, 2, 3, 4].map((n) => ({ state: legacy(n), hold: n === 4 ? 3400 : 1400 })),
    },
    {
      label: 'Costs',
      title: 'Traffic made it worse',
      tag: 'trade-off',
      body: ['Large and frequent payloads, like scroll events, cost real CPU to serialise. JS could never read a value synchronously, so layout measurements arrived late.', 'Heavy traffic congested the queue: blank cells and laggy gestures.'],
      keyIdea: 'Async-only plus JSON does not scale to scroll and gesture traffic.',
      frames: [{ state: costs(), hold: 4800 }],
    },
    {
      label: 'JSI',
      title: 'Call C++ directly',
      tag: 'technique',
      body: ['**JSI** lets C++ expose host functions and objects to JavaScript. JS holds a reference and calls it **directly**, with no JSON.', 'Synchronous calls and shared memory become possible, and any JSI engine works.'],
      keyIdea: 'Sync calls on the JS thread can block it, so long work must still be async.',
      frames: [1, 2, 3].map((n) => ({ state: jsi(n), hold: n === 3 ? 3600 : 1600 })),
    },
    {
      label: 'Turbo',
      title: 'Create modules on demand',
      tag: 'in practice',
      body: ['The old system initialised **every** native module at startup. **Turbo Modules** are created the first time JS touches them.', 'Codegen also types the contract, so a JS and native mismatch fails at compile time.'],
      keyIdea: 'Lazy modules are a startup improvement by themselves.',
      frames: [{ state: turbo('eager'), hold: 3200 }, { state: turbo('lazy'), hold: 4000 }],
    },
    {
      label: 'Recap',
      title: 'Bridge to JSI',
      tag: 'recap',
      body: [
        '- **Bridge:** async JSON queue, one door.',
        '- **Problems:** serialisation cost, no sync reads, congestion.',
        '- **JSI:** direct C++ calls, sync when needed, shared memory.',
        '- **Turbo Modules:** lazy, typed through Codegen.',
        '- **Status:** the New Architecture is the only option since 0.82.',
      ],
      keyIdea: 'JSI is the foundation that Fabric, Turbo Modules and Reanimated build on.',
      frames: [{ state: jsi(3) }],
    },
  ],
});
