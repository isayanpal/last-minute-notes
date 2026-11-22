import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Next.js notes on the 'use client' boundary: it is a module boundary, everything a client file imports becomes
 * client code, and children passed into a Client Component stay Server Components. The component sizes are EXAMPLE values;
 * the client JavaScript totals are computed by walking the real import graph from each 'use client' entry.
 */

type Mod = { id: string; label: string; kb: number; imports: string[] };

const mods = (over: Partial<Record<string, string[]>> = {}): Mod[] => [
  { id: 'page', label: 'Page', kb: 2, imports: over.page ?? ['header', 'md', 'like'] },
  { id: 'header', label: 'Header', kb: 3, imports: [] },
  { id: 'md', label: 'Markdown', kb: 80, imports: over.md ?? [] },
  { id: 'like', label: 'LikeButton', kb: 4, imports: over.like ?? ['icon'] },
  { id: 'icon', label: 'Icon', kb: 1, imports: [] },
];

/** A module is client code if it is a 'use client' entry or imported (directly or not) by one. */
const clientSet = (all: Mod[], entries: string[]): Set<string> => {
  const byId = new Map(all.map((m) => [m.id, m]));
  const out = new Set<string>();
  const visit = (id: string) => {
    if (out.has(id)) return;
    out.add(id);
    byId.get(id)!.imports.forEach(visit);
  };
  entries.forEach(visit);
  return out;
};
const kbOf = (all: Mod[], set: Set<string>) => all.filter((m) => set.has(m.id)).reduce((n, m) => n + m.kb, 0);

const POS: Record<string, { x: number; y: number }> = {
  page: { x: 0.1, y: 1.7 },
  header: { x: 2.8, y: 0.3 },
  md: { x: 2.8, y: 1.7 },
  like: { x: 2.8, y: 3.1 },
  icon: { x: 5.5, y: 3.1 },
};

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.5 });

const view = (all: Mod[], entries: string[], note: FlowState['note'], extra?: { children?: boolean }): FlowState => {
  const set = clientSet(all, entries);
  const nodes: FlowNode[] = all.map((m) => ({
    id: m.id,
    label: m.label,
    sub: set.has(m.id) ? 'client' : 'server',
    kind: set.has(m.id) ? 'client' : 'service',
    x: POS[m.id].x,
    y: POS[m.id].y,
    status: entries.includes(m.id) ? 'active' : set.has(m.id) ? 'hot' : 'normal',
    items: [`${m.kb} KB`],
  }));
  const links = [...all.flatMap((m) => m.imports.map((to) => ({ from: m.id, to, dashed: false }))), ...(extra?.children ? [{ from: 'md', to: 'like', dashed: true, label: 'children' }] : [])];
  const total = kbOf(all, new Set(all.map((m) => m.id)));
  const client = kbOf(all, set);
  return {
    nodes,
    links,
    packets: entries.length ? [hop(entries[0], entries[0] === 'page' ? 'like' : (all.find((m) => m.id === entries[0])?.imports[0] ?? entries[0]), "'use client'", 0, 'bad')].filter((p) => p.from !== p.to) : [],
    stats: [
      { label: 'Client JS', value: `${client} KB`, tone: client > total / 2 ? 'bad' : 'ok' },
      { label: 'Server only', value: `${total - client} KB`, tone: total - client > client ? 'ok' : 'bad' },
      { label: 'Client files', value: String(set.size) },
    ],
    note,
  };
};

const WHOLE = mods();
const ISLAND = mods();
// A client wrapper receives Markdown as children: Markdown is not imported by the client file, so it stays on the server.
const WRAPPED: Mod[] = [
  { id: 'page', label: 'Page', kb: 2, imports: ['header', 'md', 'like'] },
  { id: 'header', label: 'Header', kb: 3, imports: [] },
  { id: 'md', label: 'Markdown', kb: 80, imports: [] },
  { id: 'like', label: 'ClientShell', kb: 4, imports: ['icon'] },
  { id: 'icon', label: 'Icon', kb: 1, imports: [] },
];
const IMPORTED = mods({ like: ['icon', 'md'] });

export default defineLesson('flow', {
  slug: 'next-server-client-boundary',
  objectives: [
    { text: 'What a whole-page use client costs', step: 1 },
    { text: 'How a low boundary keeps most code on the server', step: 2 },
    { text: 'Why children passed in stay Server Components', step: 3 },
    { text: 'Why a client file importing a library drags it along', step: 4 },
  ],
  steps: [
    {
      label: 'Whole page',
      title: 'One button, everything client',
      tag: 'problem',
      body: ['Putting `\'use client\'` on the page because of one `onClick` turns the whole tree into client code.', 'The heavy markdown library ships to the browser too. Sizes here are example values.'],
      keyIdea: '`\'use client\'` is the entry to the client bundle: everything the file imports follows it.',
      frames: [{ state: view(WHOLE, ['page'], { text: 'the page is the entry, so every imported module becomes client code', tone: 'bad' }), hold: 4400 }],
    },
    {
      label: 'Island',
      title: 'Keep the boundary low',
      tag: 'technique',
      body: ['Put `\'use client\'` only in `LikeButton`. The page and the markdown stay Server Components.', 'Only the button and its icon ship to the browser.'],
      keyIdea: 'Keep the boundary as close to the leaves as possible.',
      frames: [{ state: view(ISLAND, ['like'], { text: 'a client island: only LikeButton and the Icon it imports are client code', tone: 'ok' }), hold: 4400 }],
    },
    {
      label: 'Children',
      title: 'Passed in, stays on the server',
      tag: 'concept',
      body: ['The directive marks a **module boundary**, not a component type.', 'A Server Component passed into a Client Component as `children` stays a Server Component, because the client file never imports it.'],
      keyIdea: 'Pass server content through `children` to nest it inside client wrappers.',
      frames: [{ state: view(WRAPPED, ['like'], { text: 'Markdown is handed to ClientShell as children and is not imported by it', tone: 'ok' }, { children: true }), hold: 4400 }],
    },
    {
      label: 'Imports',
      title: 'An import pulls code in',
      tag: 'trade-off',
      body: ['If `LikeButton` **imports** the markdown library itself, that library becomes client code.', 'Third-party components that use hooks need your own `\'use client\'` wrapper file.'],
      keyIdea: 'Watch what a client file imports, not just where the directive sits.',
      frames: [{ state: view(IMPORTED, ['like'], { text: 'the client file now imports Markdown, so 80 KB joins the bundle', tone: 'bad' }), hold: 4400 }],
    },
    {
      label: 'Recap',
      title: 'The use client boundary',
      tag: 'recap',
      body: [
        '- **Directive:** marks a file as the client entry.',
        '- **Imports:** everything the file imports becomes client code.',
        '- **Children:** passed-in Server Components stay on the server.',
        '- **Placement:** as low as possible.',
        '- **Not browser only:** Client Components still pre-render to HTML first.',
      ],
      keyIdea: 'Less client JavaScript means less hydration work.',
      frames: [{ state: view(ISLAND, ['like'], { text: 'a small client island inside a server tree', tone: 'ok' }) }],
    },
  ],
});
