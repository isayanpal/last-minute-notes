import { defineLesson } from '../define';
import { TONE_COLOR, type ItemState } from '../engines/common';
import type { GraphEdge, GraphNode, GraphState } from '../engines/graph';
import type { Frame } from '../types';

/*
 * A real trie (Map children plus an end flag, as in the notes) drives every frame.
 * Each trie node is identified by the prefix that reaches it, so positions are fixed per prefix.
 * Words: "apple" from the notes, plus "app", "apt" and "bat" to show shared and separate prefixes.
 */

type TNode = { children: Map<string, TNode>; end: boolean; prefix: string };

class Trie {
  root: TNode = { children: new Map(), end: false, prefix: '' };
  /** Inserts and returns the prefixes walked, plus how many nodes were created. */
  insert(word: string): { walked: string[]; created: string[] } {
    let node = this.root;
    const walked: string[] = [];
    const created: string[] = [];
    for (const ch of word) {
      if (!node.children.has(ch)) {
        node.children.set(ch, { children: new Map(), end: false, prefix: node.prefix + ch });
        created.push(node.prefix + ch);
      }
      node = node.children.get(ch)!;
      walked.push(node.prefix);
    }
    node.end = true;
    return { walked, created };
  }
  walk(text: string): { walked: string[]; node: TNode | null } {
    let node: TNode | undefined = this.root;
    const walked: string[] = [];
    for (const ch of text) {
      node = node.children.get(ch);
      if (!node) return { walked, node: null };
      walked.push(node.prefix);
    }
    return { walked, node };
  }
  all(): TNode[] {
    const out: TNode[] = [];
    const visit = (n: TNode) => {
      out.push(n);
      n.children.forEach(visit);
    };
    visit(this.root);
    return out;
  }
  wordsUnder(n: TNode): string[] {
    const out: string[] = [];
    const visit = (x: TNode) => {
      if (x.end) out.push(x.prefix);
      x.children.forEach(visit);
    };
    visit(n);
    return out;
  }
}

const POS: Record<string, { x: number; y: number }> = {
  '': { x: 4.6, y: 0 },
  a: { x: 2.4, y: 1.2 },
  ap: { x: 2.4, y: 2.4 },
  app: { x: 1.3, y: 3.6 },
  appl: { x: 0.6, y: 4.8 },
  apple: { x: 0.6, y: 6 },
  apt: { x: 3.6, y: 3.6 },
  b: { x: 7, y: 1.2 },
  ba: { x: 7, y: 2.4 },
  bat: { x: 7, y: 3.6 },
};

const id = (prefix: string) => `n_${prefix}`;

type Look = { active?: string; path?: string[]; found?: string[]; bad?: string; dim?: boolean };

function draw(trie: Trie, look: Look = {}): Pick<GraphState, 'nodes' | 'edges'> {
  const nodes: GraphNode[] = trie.all().map((n) => {
    let state: ItemState = n.end ? 'done' : look.dim ? 'dim' : 'normal';
    if (look.path?.includes(n.prefix)) state = 'path';
    if (look.found?.includes(n.prefix)) state = 'found';
    if (look.bad === n.prefix) state = 'bad';
    if (look.active === n.prefix) state = 'active';
    return {
      id: id(n.prefix),
      label: n.prefix === '' ? 'root' : n.prefix[n.prefix.length - 1],
      ...POS[n.prefix],
      state,
      tag: n.end ? 'end' : undefined,
    };
  });
  const edges: GraphEdge[] = trie
    .all()
    .filter((n) => n.prefix !== '')
    .map((n) => {
      const lit = look.path?.includes(n.prefix) || look.active === n.prefix || look.found?.includes(n.prefix);
      return { from: id(n.prefix.slice(0, -1)), to: id(n.prefix), directed: true, state: lit ? ('path' as const) : undefined };
    });
  return { nodes, edges };
}

const WORDS = ['apple', 'app', 'apt', 'bat'];
const FULL = new Trie();
WORDS.forEach((w) => FULL.insert(w));

// Step 1: scanning a word list for the prefix "ap".
function scanFrames(): Frame<GraphState>[] {
  const box = (w: string, i: number, st: ItemState): GraphNode => ({ id: `w_${w}`, label: w, x: 3, y: 0.6 + i * 1.4, shape: 'box', state: st });
  const frames: Frame<GraphState>[] = [];
  const states: ItemState[] = WORDS.map(() => 'normal');
  frames.push({
    hold: 1300,
    state: {
      nodes: [...WORDS.map((w, i) => box(w, i, 'normal')), { id: 'q', label: 'ap', x: 7, y: 2.7, shape: 'box', state: 'active', tag: 'prefix' }],
      stats: [
        { label: 'Words', value: String(WORDS.length) },
        { label: 'Checked', value: '0' },
        { label: 'Matches', value: '0' },
      ],
      note: { text: 'which words start with "ap"?', tone: 'accent' },
    },
  });
  let matches = 0;
  WORDS.forEach((w, i) => {
    const ok = w.startsWith('ap');
    if (ok) matches++;
    states[i] = ok ? 'found' : 'bad';
    frames.push({
      hold: 900,
      state: {
        nodes: [...WORDS.map((x, j) => box(x, j, j === i ? 'active' : states[j])), { id: 'q', label: 'ap', x: 7, y: 2.7, shape: 'box', state: 'active', tag: 'prefix' }],
        edges: [{ from: 'q', to: `w_${w}`, state: ok ? 'found' : 'bad' }],
        stats: [
          { label: 'Words', value: String(WORDS.length) },
          { label: 'Checked', value: `${i + 1} / ${WORDS.length}` },
          { label: 'Matches', value: String(matches), tone: 'ok' },
        ],
      },
    });
  });
  frames[frames.length - 1].state.note = { text: 'every query touches every word: cost grows with the list', tone: 'bad' };
  return frames;
}

// Step 3: insert "apple" one character at a time.
function insertAppleFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  const t = new Trie();
  frames.push({
    hold: 1000,
    state: {
      ...draw(t),
      panels: [{ title: 'insert', kind: 'list', items: ['"apple"'] }],
      stats: [
        { label: 'char', value: '-' },
        { label: 'New nodes', value: '0' },
        { label: 'end flag', value: '-' },
      ],
      note: { text: 'start at the root' },
    },
  });
  // Insert char by char by inserting growing prefixes into a scratch trie, then marking only the full word.
  const word = 'apple';
  for (let i = 1; i <= word.length; i++) {
    const partial = new Trie();
    const res = partial.insert(word.slice(0, i));
    if (i < word.length) partial.all().forEach((n) => (n.end = false));
    frames.push({
      hold: i === word.length ? 1800 : 900,
      state: {
        ...draw(partial, { active: word.slice(0, i), path: res.walked.slice(0, -1) }),
        panels: [{ title: 'insert', kind: 'list', items: ['"apple"', `at "${word.slice(0, i)}"`], highlight: 1 }],
        stats: [
          { label: 'char', value: `'${word[i - 1]}'` },
          { label: 'New nodes', value: String(i) },
          { label: 'end flag', value: i === word.length ? 'true' : '-', tone: i === word.length ? 'ok' : 'neutral' },
        ],
        note: i === word.length ? { text: 'last character: set end = true', tone: 'ok' } : { text: `no child '${word[i - 1]}': create it, step down` },
      },
    });
  }
  return frames;
}

// Step 4: search vs startsWith on the trie that only holds "apple".
const APPLE = new Trie();
APPLE.insert('apple');

function queryFrames(): Frame<GraphState>[] {
  const frames: Frame<GraphState>[] = [];
  const res = APPLE.walk('app');
  res.walked.forEach((p, i) => {
    frames.push({
      hold: 900,
      state: {
        ...draw(APPLE, { active: p, path: res.walked.slice(0, i) }),
        panels: [{ title: 'query', kind: 'list', items: ['"app"', `matched "${p}"`], highlight: 1 }],
        stats: [
          { label: 'char', value: `'${p[p.length - 1]}'` },
          { label: 'Steps', value: `${i + 1} / 3` },
          { label: 'Node', value: 'exists', tone: 'ok' },
        ],
      },
    });
  });
  frames.push({
    hold: 2000,
    state: {
      ...draw(APPLE, { bad: 'app', path: ['a', 'ap'] }),
      panels: [{ title: 'query', kind: 'list', items: ['search -> false', 'startsWith -> true'] }],
      stats: [
        { label: 'search', value: 'false', tone: 'bad', hint: 'end flag is false' },
        { label: 'startsWith', value: 'true', tone: 'ok', hint: 'node exists' },
        { label: 'Steps', value: '3 = L' },
      ],
      note: { text: 'same walk: search also needs end === true', tone: 'accent' },
    },
  });
  return frames;
}

// Step 5: more words share the existing path.
function shareFrames(): Frame<GraphState>[] {
  const t = new Trie();
  t.insert('apple');
  const frames: Frame<GraphState>[] = [];
  const done: string[] = ['"apple"'];
  ['app', 'apt', 'bat'].forEach((w) => {
    const res = t.insert(w);
    done.push(`"${w}"`);
    frames.push({
      hold: 1700,
      state: {
        ...draw(t, { path: res.walked.filter((p) => !res.created.includes(p)), found: res.created }),
        panels: [{ title: 'words', kind: 'list', items: [...done], highlight: done.length - 1 }],
        stats: [
          { label: 'insert', value: `"${w}"` },
          { label: 'Reused', value: String(res.walked.length - res.created.length), tone: 'ok' },
          { label: 'New nodes', value: String(res.created.length) },
        ],
        note:
          res.created.length === 0
            ? { text: '"app" adds no nodes: it only sets end on the second p', tone: 'ok' }
            : res.created.length === w.length
              ? { text: 'no shared prefix: a new branch from the root' }
              : { text: `shares "${w.slice(0, w.length - res.created.length)}", adds ${res.created.length} node` },
      },
    });
  });
  return frames;
}

// Step 6: autocomplete "ap" in O(L), then collect the subtree.
function autoFrames(): Frame<GraphState>[] {
  const res = FULL.walk('ap');
  const frames: Frame<GraphState>[] = res.walked.map((p, i) => ({
    hold: 1000,
    state: {
      ...draw(FULL, { active: p, path: res.walked.slice(0, i) }),
      panels: [{ title: 'suggest', kind: 'list', items: [] }],
      stats: [
        { label: 'Prefix steps', value: `${i + 1} / 2` },
        { label: 'Words stored', value: String(WORDS.length) },
        { label: 'Cost', value: 'O(L)', hint: 'L = prefix length' },
      ],
    },
  }));
  const under = FULL.wordsUnder(res.node!);
  const subtree = FULL.all()
    .filter((n) => n.prefix.startsWith('ap') && n.prefix !== 'ap')
    .map((n) => n.prefix);
  frames.push({
    state: {
      ...draw(FULL, { path: ['a', 'ap', ...subtree], found: under }),
      panels: [{ title: 'suggest', kind: 'list', items: under.map((w) => `"${w}"`) }],
      stats: [
        { label: 'Prefix steps', value: '2', tone: 'ok' },
        { label: 'Suggestions', value: String(under.length), tone: 'ok' },
        { label: 'Not touched', value: 'b-a-t' },
      ],
      note: { text: 'walk the prefix once, then everything below it matches', tone: 'ok' },
    },
  });
  return frames;
}

export default defineLesson('isoGraph', {
  slug: 'trie',
  pseudocode: [
    'insert(word):',
    '    node = root',
    '    for ch in word:',
    '        if ch not in node.children:',
    '            node.children[ch] = new node',
    '        node = node.children[ch]',
    '    node.isWord = true',
    '',
    'walk(prefix):',
    '    follow one child per character',
    '    return the node, or null if missing',
    'search(w): walk(w) exists and isWord',
    'startsWith(p): walk(p) exists',
  ],
  legend: [
    { label: 'current', color: TONE_COLOR.accent, shape: 'ring' },
    { label: 'end of word', color: TONE_COLOR.ok, shape: 'ring' },
    { label: 'walked path', color: TONE_COLOR.data, shape: 'ring' },
  ],
  objectives: [
    { text: 'See why scanning a word list for prefixes does not scale', step: 1 },
    { text: 'Insert a word one character edge at a time', step: 3 },
    { text: 'Tell search apart from startsWith', step: 4 },
    { text: 'Answer prefix queries in O(L), independent of word count', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Prefix queries over a word list',
      tag: 'problem',
      body: ['Which words start with `"ap"`? With a plain list, every query compares against every word.', 'Autocomplete runs that query on every keystroke.'],
      keyIdea: 'Prefix search, autocomplete, word dictionary: think trie.',
      frames: scanFrames(),
    },
    {
      label: 'Shared paths',
      title: 'A tree where each edge is a character',
      tag: 'concept',
      code: [3, 6],
      body: [
        'Each node has a map of children, one per next character, and an **end** flag that marks a complete word.',
        'Words that share a prefix share a path. `apple`, `app` and `apt` all go through `a` then `p`.',
      ],
      keyIdea: 'Shared prefixes are stored once, so a prefix query walks one path.',
      frames: [
        { hold: 1800, state: { ...draw(FULL), panels: [{ title: 'words', kind: 'list', items: WORDS.map((w) => `"${w}"`) }], stats: [{ label: 'Words', value: '4' }, { label: 'Nodes', value: '10', hint: 'including root' }, { label: 'Ends', value: '4', tone: 'ok' }] } },
        {
          state: {
            ...draw(FULL, { path: ['a', 'ap'] }),
            panels: [{ title: 'words', kind: 'list', items: WORDS.map((w) => `"${w}"`), highlight: 0 }],
            stats: [{ label: 'Words', value: '4' }, { label: 'Shared "ap"', value: '3 words', tone: 'ok' }, { label: 'Stored once', value: 'a, p' }],
            note: { text: 'apple, app and apt share the path a -> p', tone: 'accent' },
          },
        },
      ],
    },
    {
      label: 'Insert',
      title: 'Insert "apple"',
      tag: 'technique',
      code: [1, 2, 3, 4, 5, 6, 7],
      body: [
        'Walk from the root. For each character, create the child if it is missing, then step into it.',
        'After the last character, set `end = true`.',
      ],
      keyIdea: 'Insert is O(L) for a word of length L.',
      frames: insertAppleFrames(),
    },
    {
      label: 'Search',
      title: 'search("app") vs startsWith("app")',
      tag: 'technique',
      code: [9, 10, 11, 12, 13],
      body: [
        'With only `apple` stored, both walk `a`, `p`, `p` and find a node.',
        '`startsWith` only needs the node to exist, so it is **true**. `search` also needs `end` to be true, so it is **false**.',
      ],
      keyIdea: 'One shared walk. The end flag is the only difference between a word and a prefix.',
      frames: queryFrames(),
    },
    {
      label: 'More words',
      title: 'New words reuse the path',
      tag: 'technique',
      code: [3, 4, 5, 6],
      body: [
        '`app` creates nothing: it just sets `end` on the second `p`. `apt` adds a single node. `bat` shares nothing, so it starts a new branch.',
      ],
      keyIdea: 'The more prefixes words share, the fewer nodes the trie needs.',
      frames: shareFrames(),
    },
    {
      label: 'Cost',
      title: 'Autocomplete in O(L)',
      tag: 'trade-off',
      code: [10],
      body: [
        'Walking the prefix costs O(length of the query) **regardless of how many words are stored**. Insert, search and startsWith are all O(L).',
        'Every word below the prefix node is a suggestion. The `b` branch is never touched.',
      ],
      keyIdea: 'A list pays per word, a trie pays per character of the query.',
      frames: autoFrames(),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Signal:** prefix search, autocomplete, word dictionary.',
        '- **Shape:** children map per node, plus an end flag.',
        '- **Ops:** insert, search and startsWith walk one character at a time, O(L).',
        '- **search vs startsWith:** same walk, search also checks the end flag.',
        '- **Uses:** autocomplete, word search on a board (prune with the trie), longest common prefix.',
      ],
      keyIdea: 'Shared prefixes become shared paths, so queries cost the length of the query, not the size of the dictionary.',
      frames: [{ state: { ...draw(FULL), stats: [{ label: 'Insert', value: 'O(L)' }, { label: 'Search', value: 'O(L)' }, { label: 'startsWith', value: 'O(L)', tone: 'ok' }] } }],
    },
  ],
});
