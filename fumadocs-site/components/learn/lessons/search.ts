import { defineLesson } from '../define';
import type { ItemState } from '../engines/common';
import type { GridState } from '../engines/grid';
import type { Frame } from '../types';

/*
 * Every grid is computed by running the real pipeline on four tiny documents:
 * tokenize, lowercase, drop stop words, stem, build the inverted index, score with TF-IDF.
 */

const DOCS = ['Running shoes for men', "Men's running jacket", 'Trail shoes', 'Shoe care for running shoes'];
const DOC_IDS = DOCS.map((_, i) => `D${i + 1}`);
const STOP = new Set(['for', 'the', 'a', 'and']);
const QUERY = 'running shoes';

// ---------- analysis pipeline ----------

const rawWords = (s: string) => s.split(' ');
const tokenize = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);
const dropped = (t: string) => STOP.has(t) || t.length < 2;
function stem(t: string): string {
  if (t.endsWith('ning')) return t.slice(0, -4);
  if (t.endsWith('s') && t.length > 3) return t.slice(0, -1);
  return t;
}
const analyze = (s: string) => tokenize(s).filter((t) => !dropped(t)).map(stem);

const RAW = DOCS.map(rawWords);
const TOKENS = DOCS.map(tokenize);
const TERMS_PER_DOC = DOCS.map(analyze);
const QUERY_TERMS = analyze(QUERY);

const widest = (rows: unknown[][]) => Math.max(...rows.map((r) => r.length));
const padRow = <T>(row: T[], n: number): (T | null)[] => [...row, ...Array(n - row.length).fill(null)];
const wordCols = (n: number) => Array.from({ length: n }, (_, i) => `w${i + 1}`);

// ---------- inverted index ----------

const VOCAB: string[] = [];
TERMS_PER_DOC.forEach((terms) => terms.forEach((t) => !VOCAB.includes(t) && VOCAB.push(t)));
const tf = (term: string, d: number) => TERMS_PER_DOC[d].filter((t) => t === term).length;
const df = (term: string) => TERMS_PER_DOC.filter((terms) => terms.includes(term)).length;
const idf = (term: string) => Math.log(DOCS.length / df(term));
const fmt = (x: number) => x.toFixed(2);

// ---------- Step 1: naive scan ----------

function scanFrames(): Frame<GridState>[] {
  const n = widest(RAW);
  const cells = RAW.map((r) => padRow(r, n));
  const frames: Frame<GridState>[] = [];
  const states: Record<string, ItemState> = {};
  let compared = 0;
  let matches = 0;
  RAW.forEach((words, d) => {
    words.forEach((w, c) => {
      compared++;
      const hit = w === 'shoe';
      if (hit) matches++;
      states[`${d},${c}`] = hit ? 'found' : w.toLowerCase().startsWith('shoe') ? 'bad' : 'visited';
    });
    frames.push({
      hold: 1100,
      state: {
        cells,
        rowHeaders: DOC_IDS,
        colHeaders: wordCols(n),
        states: { ...states },
        pointers: [{ r: d, c: 0, label: 'scan' }],
        title: `find docs with the word "shoe"`,
        stats: [
          { label: 'Docs read', value: `${d + 1} / ${DOCS.length}`, tone: 'bad' },
          { label: 'Words compared', value: String(compared), tone: 'bad' },
          { label: 'Matches', value: String(matches), tone: matches ? 'ok' : 'bad' },
        ],
      },
    });
  });
  frames[frames.length - 1].hold = 2400;
  frames[frames.length - 1].state.note = { text: `${compared} comparisons, ${matches} matches: "Shoes" is not "shoe"`, tone: 'bad' };
  return frames;
}

// ---------- Step 2: analysis ----------

function analysisFrames(): Frame<GridState>[] {
  const n = widest(TOKENS);
  const base = { rowHeaders: DOC_IDS, colHeaders: wordCols(n) };
  const nDropped = TOKENS.flat().filter(dropped).length;
  const stemmed = TOKENS.flat().filter((t) => !dropped(t) && stem(t) !== t).length;
  const dropStates: Record<string, ItemState> = {};
  TOKENS.forEach((row, r) => row.forEach((t, c) => (dropStates[`${r},${c}`] = dropped(t) ? 'bad' : 'normal')));
  const kept = TOKENS.map((row) => row.filter((t) => !dropped(t)));
  const stemStates: Record<string, ItemState> = {};
  kept.forEach((row, r) => row.forEach((t, c) => (stemStates[`${r},${c}`] = stem(t) !== t ? 'swap' : 'done')));
  return [
    {
      hold: 2000,
      state: {
        ...base,
        cells: TOKENS.map((r) => padRow(r, n)),
        title: '1. tokenize and lowercase',
        stats: [
          { label: 'Tokens', value: String(TOKENS.flat().length) },
          { label: 'Case', value: 'lower' },
          { label: "men's", value: 'men + s' },
        ],
      },
    },
    {
      hold: 2000,
      state: {
        ...base,
        cells: TOKENS.map((r) => padRow(r, n)),
        states: dropStates,
        title: '2. remove stop words',
        stats: [
          { label: 'Stop words', value: [...STOP].slice(0, 2).join(', ') },
          { label: 'Dropped', value: String(nDropped), tone: 'bad' },
          { label: 'Kept', value: String(TOKENS.flat().length - nDropped) },
        ],
      },
    },
    {
      hold: 2400,
      state: {
        ...base,
        cells: kept.map((r) => padRow(r.map(stem), n)),
        states: stemStates,
        title: '3. stem: running -> run, shoes -> shoe',
        stats: [
          { label: 'Stemmed', value: String(stemmed), tone: 'ok' },
          { label: 'Terms', value: String(TERMS_PER_DOC.flat().length) },
          { label: 'Applied at', value: 'index + query' },
        ],
        note: { text: '"Shoes" and "shoe" now become the same term', tone: 'ok' },
      },
    },
  ];
}

// ---------- Step 3: build the inverted index ----------

function indexCells(upTo: number): (number | null)[][] {
  return VOCAB.map((term) => DOC_IDS.map((_, d) => (d <= upTo && tf(term, d) ? tf(term, d) : null)));
}

function buildFrames(): Frame<GridState>[] {
  return DOC_IDS.map((_, d) => {
    const states: Record<string, ItemState> = {};
    VOCAB.forEach((term, r) =>
      DOC_IDS.forEach((__, c) => {
        if (c < d && tf(term, c)) states[`${r},${c}`] = 'done';
        if (c === d && tf(term, c)) states[`${r},${c}`] = 'active';
      }),
    );
    const last = d === DOC_IDS.length - 1;
    return {
      hold: last ? 2600 : 1400,
      state: {
        cells: indexCells(d),
        rowHeaders: VOCAB,
        colHeaders: DOC_IDS,
        states,
        title: 'term -> documents (cell = term count)',
        stats: [
          { label: 'Indexed', value: `${d + 1} / ${DOCS.length} docs` },
          { label: 'Terms', value: String(VOCAB.filter((t) => TERMS_PER_DOC.slice(0, d + 1).some((ts) => ts.includes(t))).length) },
          { label: 'Postings', value: String(indexCells(d).flat().filter((x) => x !== null).length) },
        ],
        note: last ? { text: 'new docs become searchable after a refresh, about 1 s in Elasticsearch', tone: 'accent' } : { text: `add ${DOC_IDS[d]}: "${DOCS[d]}"` },
      },
    };
  });
}

// ---------- Step 4: query ----------

function queryFrames(): Frame<GridState>[] {
  const rows = QUERY_TERMS.map((t) => VOCAB.indexOf(t));
  const cells = indexCells(DOCS.length - 1);
  const lookStates: Record<string, ItemState> = {};
  VOCAB.forEach((_, r) => DOC_IDS.forEach((__, c) => (lookStates[`${r},${c}`] = rows.includes(r) ? (cells[r][c] !== null ? 'active' : 'normal') : 'dim')));
  const all = DOC_IDS.map((_, c) => rows.every((r) => cells[r][c] !== null));
  const any = DOC_IDS.map((_, c) => rows.some((r) => cells[r][c] !== null));
  const andStates: Record<string, ItemState> = {};
  VOCAB.forEach((_, r) => DOC_IDS.forEach((__, c) => (andStates[`${r},${c}`] = !rows.includes(r) ? 'dim' : cells[r][c] === null ? 'normal' : all[c] ? 'found' : 'visited')));
  const both = DOC_IDS.filter((_, c) => all[c]);
  return [
    {
      hold: 2200,
      state: {
        cells,
        rowHeaders: VOCAB,
        colHeaders: DOC_IDS,
        states: lookStates,
        title: `query "${QUERY}" -> ${QUERY_TERMS.join(', ')}`,
        stats: [
          { label: 'Query terms', value: QUERY_TERMS.join(', ') },
          { label: 'Rows read', value: String(rows.length), tone: 'ok' },
          { label: 'Docs scanned', value: '0', tone: 'ok' },
        ],
        note: { text: 'analyze the query the same way, then read only those rows', tone: 'accent' },
      },
    },
    {
      state: {
        cells,
        rowHeaders: VOCAB,
        colHeaders: DOC_IDS,
        states: andStates,
        title: `query "${QUERY}" -> ${QUERY_TERMS.join(', ')}`,
        panels: [
          { title: 'both terms', kind: 'list', items: both },
          { title: 'either term', kind: 'list', items: DOC_IDS.filter((_, c) => any[c]) },
        ],
        stats: [
          { label: 'Match all', value: String(both.length), tone: 'ok' },
          { label: 'Match any', value: String(any.filter(Boolean).length) },
          { label: 'Docs scanned', value: '0', tone: 'ok' },
        ],
        note: { text: 'combine posting lists: intersect for AND, union for OR', tone: 'ok' },
      },
    },
  ];
}

// ---------- Step 5: ranking with TF-IDF ----------

function rankFrames(): Frame<GridState>[] {
  const rowHeaders = [...QUERY_TERMS, 'score'];
  const weight = (t: string, d: number) => tf(t, d) * idf(t);
  const scores = DOC_IDS.map((_, d) => QUERY_TERMS.reduce((s, t) => s + weight(t, d), 0));
  const order = [...DOC_IDS.keys()].sort((a, b) => scores[b] - scores[a] || a - b);
  const best = order[0];
  const tfCells = [...QUERY_TERMS.map((t) => DOC_IDS.map((_, d) => tf(t, d) || null)), DOC_IDS.map(() => null)];
  const wCells = [...QUERY_TERMS.map((t) => DOC_IDS.map((_, d) => (tf(t, d) ? fmt(weight(t, d)) : null))), DOC_IDS.map(() => null)];
  const sCells = [...wCells.slice(0, -1), scores.map(fmt)];
  const idfStats = QUERY_TERMS.map((t) => ({ label: `idf(${t})`, value: fmt(idf(t)), hint: `ln(${DOCS.length}/${df(t)})` }));
  const scoreStates: Record<string, ItemState> = {};
  DOC_IDS.forEach((_, c) => (scoreStates[`${QUERY_TERMS.length},${c}`] = c === best ? 'found' : 'done'));
  return [
    {
      hold: 2000,
      state: { cells: tfCells, rowHeaders, colHeaders: DOC_IDS, title: 'tf: how often the term appears', stats: [...idfStats, { label: 'Docs', value: String(DOCS.length) }] },
    },
    {
      hold: 2200,
      state: {
        cells: wCells,
        rowHeaders,
        colHeaders: DOC_IDS,
        title: 'tf x idf: rare terms count more',
        stats: [...idfStats, { label: 'Formula', value: 'tf x idf' }],
        note: { text: 'idf = ln(N / df): a term in every doc scores 0' },
      },
    },
    {
      state: {
        cells: sCells,
        rowHeaders,
        colHeaders: DOC_IDS,
        states: scoreStates,
        title: 'score = sum over query terms',
        panels: [{ title: 'ranked', kind: 'list', items: order.map((d) => `${DOC_IDS[d]}  ${fmt(scores[d])}`), highlight: 0 }],
        stats: [
          { label: 'Top', value: DOC_IDS[best], tone: 'ok' },
          { label: 'Score', value: fmt(scores[best]) },
          { label: 'Why', value: `"shoe" x ${tf('shoe', best)}` },
        ],
        note: { text: 'BM25 refines this, then mix in recency and popularity', tone: 'accent' },
      },
    },
  ];
}

// ---------- Step 6: shards, scatter-gather ----------

// Each shard returns its local top 3 as [doc, score]. The coordinator merges them.
const SHARDS: [string, number][][] = [
  [['d4', 0.91], ['d9', 0.62], ['d1', 0.4]],
  [['d12', 0.88], ['d5', 0.75], ['d7', 0.31]],
  [['d3', 0.95], ['d8', 0.5], ['d6', 0.22]],
];
const TOP = 3;
const MERGED = SHARDS.flatMap((s, si) => s.map(([doc, score], k) => ({ doc, score, si, k })))
  .sort((a, b) => b.score - a.score)
  .slice(0, TOP);
const shardRows = ['shard 1', 'shard 2', 'shard 3', 'merged'];
const topCols = Array.from({ length: TOP }, (_, i) => `#${i + 1}`);
const sc = (x: number) => x.toFixed(2).slice(1);

function shardFrames(): Frame<GridState>[] {
  const empty = shardRows.map(() => topCols.map(() => null));
  const local = [...SHARDS.map((s) => s.map(([, score]) => sc(score))), topCols.map(() => null)];
  const merged = [...local.slice(0, -1), MERGED.map((m) => sc(m.score))];
  const mergeStates: Record<string, ItemState> = {};
  SHARDS.forEach((s, si) => s.forEach((_, k) => (mergeStates[`${si},${k}`] = MERGED.some((m) => m.si === si && m.k === k) ? 'found' : 'dim')));
  topCols.forEach((_, k) => (mergeStates[`${SHARDS.length},${k}`] = 'done'));
  const localStates: Record<string, ItemState> = {};
  SHARDS.forEach((s, si) => s.forEach((_, k) => (localStates[`${si},${k}`] = 'active')));
  return [
    {
      hold: 1500,
      state: {
        cells: empty,
        rowHeaders: shardRows,
        colHeaders: topCols,
        title: 'the index is split into shards',
        stats: [
          { label: 'Shards', value: String(SHARDS.length) },
          { label: 'Query goes to', value: 'every shard' },
          { label: 'Each returns', value: `top ${TOP}` },
        ],
        note: { text: 'scatter: send the query to all shards', tone: 'accent' },
      },
    },
    {
      hold: 2000,
      state: {
        cells: local,
        rowHeaders: shardRows,
        colHeaders: topCols,
        states: localStates,
        title: 'each shard scores its own documents',
        stats: [
          { label: 'Shards', value: String(SHARDS.length) },
          { label: 'Candidates', value: String(SHARDS.length * TOP) },
          { label: 'Each returns', value: `top ${TOP}` },
        ],
      },
    },
    {
      state: {
        cells: merged,
        rowHeaders: shardRows,
        colHeaders: topCols,
        states: mergeStates,
        title: 'gather: merge into the global top 3',
        panels: [{ title: 'results', kind: 'list', items: MERGED.map((m) => `${m.doc} ${sc(m.score)} s${m.si + 1}`) }],
        stats: [
          { label: 'Candidates', value: String(SHARDS.length * TOP) },
          { label: 'Kept', value: String(TOP), tone: 'ok' },
          { label: 'From shards', value: [...new Set(MERGED.map((m) => m.si + 1))].join(', ') },
        ],
        note: { text: 'gather: keep the best across shards, replicas share the read load', tone: 'ok' },
      },
    },
  ];
}

const RECAP: GridState = {
  cells: indexCells(DOCS.length - 1),
  rowHeaders: VOCAB,
  colHeaders: DOC_IDS,
  states: Object.fromEntries(VOCAB.flatMap((t, r) => DOC_IDS.map((_, c) => [`${r},${c}`, tf(t, c) ? ('done' as ItemState) : ('normal' as ItemState)]))),
  title: 'inverted index: a derived store',
  stats: [
    { label: 'Lookup', value: 'by term', tone: 'ok' },
    { label: 'Ranking', value: 'BM25 + signals' },
    { label: 'Source of truth', value: 'the DB', tone: 'ok' },
  ],
};

export default defineLesson('grid', {
  slug: 'search',
  objectives: [
    { text: 'Why scanning raw text is slow and misses matches', step: 1 },
    { text: 'Normalize text with tokenizing, lowercasing, stop words and stemming', step: 2 },
    { text: 'Build and query an inverted index', step: 4 },
    { text: 'Rank results with TF-IDF and merge them across shards', step: 6 },
  ],
  steps: [
    {
      label: 'The problem',
      title: 'Scanning text does not work',
      tag: 'problem',
      body: [
        'Find documents about "shoe". A scan compares every word of every document, so the cost grows with all the text you store.',
        'Worse, raw words do not match: `Shoes` and `Shoe` are not `shoe`.',
      ],
      keyIdea: 'Full text search needs an inverted index: for each term, the list of documents containing it.',
      frames: scanFrames(),
    },
    {
      label: 'Analysis',
      title: 'Turn text into terms',
      tag: 'technique',
      body: [
        '**Analysis** normalizes text: tokenize, lowercase, remove stop words, and stem words to a common root.',
        'The same analysis runs at index time and at query time, so both sides speak the same terms.',
      ],
      keyIdea: 'Analysis is what makes "Running Shoes" match a search for "shoe run".',
      frames: analysisFrames(),
    },
    {
      label: 'Inverted index',
      title: 'Term to documents',
      tag: 'concept',
      body: [
        'Flip the data: one row per **term**, listing the documents that contain it. Each document adds its terms as it is indexed.',
        'Looking up a word is now a row read, not a scan of every document.',
      ],
      keyIdea: 'An inverted index maps each term to its posting list: the documents that contain it.',
      frames: buildFrames(),
    },
    {
      label: 'Query',
      title: 'Read only the rows you need',
      tag: 'technique',
      body: [
        'The query `running shoes` is analyzed into `run` and `shoe`. Read those two rows.',
        'Intersect the lists for documents with both terms, or union them for either. No document is scanned.',
      ],
      keyIdea: 'Query cost depends on the posting lists you read, not on the total amount of text.',
      frames: queryFrames(),
    },
    {
      label: 'Ranking',
      title: 'Order by relevance',
      tag: 'technique',
      body: [
        '**TF-IDF** scores a term higher when it appears often in a document (tf) and rarely across documents (idf).',
        'Sum the weights for each query term. BM25 is the standard refinement, plus signals like recency and popularity.',
      ],
      keyIdea: 'Relevance is term frequency weighted by rarity, then blended with business signals.',
      frames: rankFrames(),
    },
    {
      label: 'Shards',
      title: 'Scatter, then gather',
      tag: 'in practice',
      body: [
        'A big index is split into **shards**, each with replicas. A query scatters to every shard, each returns its local top results, and a coordinator gathers the global top.',
      ],
      keyIdea: 'Search engines (Elasticsearch, OpenSearch, Solr) scale by sharding the index and merging top results.',
      frames: shardFrames(),
    },
    {
      label: 'Recap',
      title: 'What to remember',
      tag: 'recap',
      body: [
        '- **Inverted index:** term to documents, built after analysis.',
        '- **Analysis:** tokenize, lowercase, stem, remove stop words, at index and query time.',
        '- **Ranking:** TF-IDF and BM25, plus recency and popularity.',
        '- **Scale:** shards and replicas, scatter-gather, near real time after a refresh.',
        '- **Sync:** a derived store fed by CDC or an outbox, rebuildable. Never the system of record.',
      ],
      keyIdea: 'Search is a derived index you can rebuild. The database stays the source of truth.',
      frames: [{ state: RECAP }],
    },
  ],
});
