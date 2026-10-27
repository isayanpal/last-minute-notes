// Build-time support for animated flow diagrams.
//  - ```flow fences hold a hand-written JSON scene.
//  - ```mermaid flowcharts inside FLOW_SECTIONS are converted to a generated scene.
// Both become <FlowAnimation scene="..." />. Everything else stays Mermaid.

const FLOW_SECTIONS = ['system-design', 'frontend-system-design', 'backend'];
const SECTION_RE = new RegExp(`(^|[\\\\/])content[\\\\/]docs[\\\\/](${FLOW_SECTIONS.join('|')})[\\\\/]`);

function walk(node, fn) {
  fn(node);
  if (Array.isArray(node.children)) for (const child of node.children) walk(child, fn);
}

/* ------------------------------------------------------------------ */
/* Scene validation                                                    */
/* ------------------------------------------------------------------ */

const REF_KEYS = ['tap', 'pulse', 'fill', 'reset'];
const EVENTS = new Set(['say', 'wait', 'tap', 'fly', 'pulse', 'badge', 'fill', 'reset', 'count', 'par']);

export function validate(scene) {
  const errors = [];
  if (!Array.isArray(scene.nodes) || scene.nodes.length === 0) errors.push('nodes missing');
  if (!Array.isArray(scene.runs) || scene.runs.length === 0) errors.push('runs missing');
  if (errors.length) return errors;

  const ids = new Set();
  for (const n of scene.nodes) {
    if (ids.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
    ids.add(n.id);
    if (typeof n.col !== 'number' || typeof n.row !== 'number') errors.push(`node "${n.id}" needs col and row`);
  }
  const check = (id, where) => {
    if (!ids.has(id)) errors.push(`${where}: unknown node "${id}"`);
  };
  for (const [a, b] of scene.links ?? []) {
    check(a, 'link');
    check(b, 'link');
  }
  const checkEvent = (ev, where) => {
    if (!Object.keys(ev).some((k) => EVENTS.has(k))) errors.push(`${where}: unknown event ${JSON.stringify(ev)}`);
    if (ev.par) ev.par.forEach((e) => checkEvent(e, where));
    if (ev.fly) {
      if (ev.fly.length < 2) errors.push(`${where}: fly needs at least two nodes`);
      ev.fly.forEach((id) => check(id, where));
    }
    for (const k of REF_KEYS) if (ev[k]) check(ev[k], where);
    if (ev.badge) check(ev.badge.at, where);
  };
  scene.runs.forEach((run, r) => run.steps?.forEach((ev, i) => checkEvent(ev, `run ${r + 1} step ${i + 1}`)));
  return errors;
}

/* ------------------------------------------------------------------ */
/* Mermaid flowchart parsing                                           */
/* ------------------------------------------------------------------ */

const OPENERS = [
  ['[(', ')]', 'cyl'],
  ['((', '))', 'circle'],
  ['([', '])', 'stadium'],
  ['[', ']', 'rect'],
  ['{', '}', 'rhombus'],
  ['(', ')', 'round'],
];
const EDGE_RE = /^(<)?(-\.+->|-{2,}>|-{2,}|={2,}>)(?:\|([^|]*)\|)?/;

function cleanLabel(raw) {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/#quot;/g, '"')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function readNode(s, i, graph) {
  const m = /^[A-Za-z_]\w*/.exec(s.slice(i));
  if (!m) return null;
  const id = m[0];
  i += id.length;
  let label = null;
  let shape = 'rect';
  for (const [open, close, name] of OPENERS) {
    if (!s.startsWith(open, i)) continue;
    let j = i + open.length;
    while (s[j] === ' ') j++;
    let text;
    if (s[j] === '"') {
      const end = s.indexOf('"', j + 1);
      if (end < 0) return null;
      text = s.slice(j + 1, end);
      j = end + 1;
      while (s[j] === ' ') j++;
      if (!s.startsWith(close, j)) return null;
      j += close.length;
    } else {
      const end = s.indexOf(close, j);
      if (end < 0) return null;
      text = s.slice(j, end);
      j = end + close.length;
    }
    label = text;
    shape = name;
    i = j;
    break;
  }
  const existing = graph.nodes.get(id);
  if (!existing) graph.nodes.set(id, { id, lines: label === null ? [id] : cleanLabel(label), shape });
  else if (label !== null && existing.lines.length === 1 && existing.lines[0] === id) {
    existing.lines = cleanLabel(label);
    existing.shape = shape;
  }
  return { id, next: i };
}

export function parseFlowchart(src) {
  const rawLines = src.trim().split('\n');
  const head = /^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/.exec(rawLines[0].trim());
  if (!head) return null;
  const graph = { dir: head[1] === 'LR' || head[1] === 'RL' ? 'LR' : 'TD', nodes: new Map(), edges: [] };
  const groups = new Map();

  for (const raw of rawLines.slice(1)) {
    const line = raw.trim().replace(/;$/, '');
    if (!line || line.startsWith('%%') || line === 'end' || /^direction\s/.test(line)) continue;
    if (/^(classDef|class|style|linkStyle|click)\s/.test(line)) continue;
    const sg = /^subgraph\s+(\w+)(?:\s*\[\s*"?(.*?)"?\s*\])?\s*$/.exec(line);
    if (sg) {
      groups.set(sg[1], sg[2] ?? sg[1]);
      continue;
    }

    let i = 0;
    let prev = null;
    let pending = null;
    while (i < line.length) {
      while (line[i] === ' ') i++;
      if (i >= line.length) break;
      if (pending === null && prev !== null) {
        const m = EDGE_RE.exec(line.slice(i));
        if (!m) return null;
        pending = { dotted: m[2].includes('.'), bidir: Boolean(m[1]), label: (m[3] ?? '').replace(/^"|"$/g, '').trim() };
        i += m[0].length;
        continue;
      }
      const node = readNode(line, i, graph);
      if (!node) return null;
      i = node.next;
      if (pending && prev) graph.edges.push({ from: prev, to: node.id, ...pending });
      pending = null;
      prev = node.id;
    }
    if (pending) return null;
  }

  for (const [id, title] of groups) {
    const n = graph.nodes.get(id);
    if (n && n.lines.length === 1 && n.lines[0] === id) n.lines = cleanLabel(title);
  }
  return graph.nodes.size ? graph : null;
}

/* ------------------------------------------------------------------ */
/* Graph to scene                                                      */
/* ------------------------------------------------------------------ */

function kindOf(node) {
  const text = node.lines.join(' ');
  if (node.shape === 'rhombus') return 'decision';
  if (node.shape === 'circle') return 'client';
  if (/redis|memcache|cache|memtable|buffer pool/i.test(text)) return 'cache';
  if (/kafka|queue|topic|dlq|pub\/?sub|sqs|stream(?!ing)/i.test(text)) return 'queue';
  if (node.shape === 'cyl' || /database|\bdb\b|store\b|storage|index(es)?\b|ledger|warehouse|olap|\bsql\b|sstable|snapshots?|log\b/i.test(text)) return 'db';
  if (/^(client|clients|user|users|browser|web|mobile|app|apps|driver|rider|editor|player|uploader|sender|producers?|ui|sync client|input|html|page|request)\b/i.test(node.lines[0])) return 'client';
  if (/provider|psp|apns|fcm|sms|email|third|external|llm|gpu|model|cdn|dns/i.test(text)) return 'external';
  return 'service';
}

const short = (s, n = 42) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '...' : s);
const name = (node) => short(node.lines[0]);

function toneOf(label, dotted) {
  if (/^(no|miss|fail|failure|failed|error|open|blocked|timeout|reject)/i.test(label)) return 'miss';
  if (/^(yes|hit|success|allowed|ok|closed|accept)/i.test(label)) return 'ok';
  return dotted ? 'data' : 'req';
}

export function graphToScene(graph) {
  const ids = [...graph.nodes.keys()];
  const out = new Map(ids.map((id) => [id, []]));
  const indeg = new Map(ids.map((id) => [id, 0]));
  const seenEdge = new Set();
  const edges = [];
  for (const e of graph.edges) {
    const key = `${e.from}>${e.to}>${e.label}`;
    if (e.from === e.to || seenEdge.has(key)) continue;
    seenEdge.add(key);
    edges.push(e);
    out.get(e.from).push(e);
    indeg.set(e.to, indeg.get(e.to) + 1);
  }

  const state = new Map();
  const back = new Set();
  const order = [];
  const dfs = (u) => {
    state.set(u, 1);
    for (const e of out.get(u)) {
      const s = state.get(e.to);
      if (s === 1) back.add(e);
      else if (!s) dfs(e.to);
    }
    state.set(u, 2);
    order.push(u);
  };
  for (const id of ids.filter((i) => indeg.get(i) === 0)) if (!state.get(id)) dfs(id);
  for (const id of ids) if (!state.get(id)) dfs(id);
  order.reverse();

  const fwd = edges.filter((e) => !back.has(e));
  const layer = new Map(ids.map((id) => [id, 0]));
  for (const u of order) for (const e of out.get(u)) if (!back.has(e)) layer.set(e.to, Math.max(layer.get(e.to), layer.get(u) + 1));

  const maxLayer = Math.max(...layer.values());
  const layers = Array.from({ length: maxLayer + 1 }, () => []);
  for (const id of ids) layers[layer.get(id)].push(id);

  const pos = new Map();
  const reindex = () => layers.forEach((l) => l.forEach((id, i) => pos.set(id, i)));
  reindex();
  const bary = (id, edgeList, pick) => {
    const ns = edgeList.filter((e) => e.to === id || e.from === id).map(pick).filter((n) => pos.has(n));
    return ns.length ? ns.reduce((a, n) => a + pos.get(n), 0) / ns.length : pos.get(id);
  };
  for (let pass = 0; pass < 3; pass++) {
    for (let l = 1; l <= maxLayer; l++) {
      const w = new Map(layers[l].map((id) => [id, bary(id, fwd.filter((e) => e.to === id), (e) => e.from)]));
      layers[l].sort((a, b) => w.get(a) - w.get(b));
      reindex();
    }
    for (let l = maxLayer - 1; l >= 0; l--) {
      const w = new Map(layers[l].map((id) => [id, bary(id, fwd.filter((e) => e.from === id), (e) => e.to)]));
      layers[l].sort((a, b) => w.get(a) - w.get(b));
      reindex();
    }
  }

  const widest = Math.max(...layers.map((l) => l.length));

  // Three layouts, picked so the diagram stays within about 5 columns:
  //  - snake: a long thin chain wraps into rows of 3-4 instead of one tall column
  //  - lr:    short left-to-right flows keep their authored direction
  //  - td:    everything else flows top-down, and layers wider than 5 wrap into lines
  const snake = layers.length >= 5 && widest <= 2;
  const perRow = layers.length <= 6 ? 3 : 4;
  const dir = !snake && graph.dir === 'LR' && layers.length <= 5 && widest <= 5 ? 'LR' : 'TD';

  const MAX_COLS = 5;
  const lineLen = [];
  const rowStart = [];
  let rowCursor = 0;
  layers.forEach((l, i) => {
    const lines = Math.ceil(l.length / MAX_COLS);
    lineLen[i] = Math.ceil(l.length / lines);
    rowStart[i] = rowCursor;
    rowCursor += lines;
  });
  const maxLine = Math.max(...lineLen);

  const nodes = ids.map((id) => {
    const n = graph.nodes.get(id);
    const l = layer.get(id);
    const [label, ...rest] = n.lines;
    const spec = { id, label, kind: kindOf(n) };
    if (rest.length) spec.sub = rest.join(' · ');
    if (snake) {
      const band = Math.floor(l / perRow);
      const c = l % perRow;
      spec.col = band % 2 ? perRow - 1 - c : c;
      spec.row = band * 2 + pos.get(id);
      return spec;
    }
    if (dir === 'LR') {
      Object.assign(spec, { col: l, row: pos.get(id) + (widest - layers[l].length) / 2 });
      return spec;
    }
    const idx = pos.get(id);
    const line = Math.floor(idx / lineLen[l]);
    const inLine = idx % lineLen[l];
    const count = Math.min(lineLen[l], layers[l].length - line * lineLen[l]);
    Object.assign(spec, { col: inLine + (maxLine - count) / 2, row: rowStart[l] + line });
    return spec;
  });

  const links = [];
  const seenLink = new Set();
  for (const e of edges) {
    const k = [e.from, e.to].sort().join('|');
    if (!seenLink.has(k)) {
      seenLink.add(k);
      links.push([e.from, e.to]);
    }
  }

  const steps = [];
  const sources = ids.filter((id) => layer.get(id) === 0);
  steps.push({ say: `Start: ${sources.slice(0, 2).map((s) => name(graph.nodes.get(s))).join(', ')}${sources.length > 2 ? ` and ${sources.length - 2} more` : ''}` });
  steps.push({ par: sources.map((s) => ({ pulse: s })) });
  steps.push({ wait: 500 });

  const flyOf = (e) => {
    const ev = { fly: [e.from, e.to], ms: 700, tone: toneOf(e.label, e.dotted) };
    if (e.label) ev.label = short(e.label, 22);
    return ev;
  };

  for (let w = 0; w < maxLayer; w++) {
    const wave = fwd.filter((e) => layer.get(e.from) === w);
    if (!wave.length) continue;
    const srcs = [...new Set(wave.map((e) => e.from))];
    const tgts = [...new Set(wave.map((e) => e.to))];
    const first = graph.nodes.get(srcs[0]);
    let say;
    if (wave.length === 1) say = `${name(first)} to ${name(graph.nodes.get(tgts[0]))}`;
    else if (srcs.length === 1) say = `${name(first)} feeds ${tgts.slice(0, 2).map((t) => name(graph.nodes.get(t))).join(', ')}${tgts.length > 2 ? ` and ${tgts.length - 2} more` : ''}`;
    else say = `${wave.length} paths advance in parallel`;
    steps.push({ say });
    steps.push({ par: wave.map(flyOf) });
    steps.push({ par: tgts.map((t) => ({ pulse: t })) });
    steps.push({ wait: 250 });
  }

  const loops = [...back];
  if (loops.length) {
    steps.push({ say: loops.length === 1 ? `${name(graph.nodes.get(loops[0].from))} loops back to ${name(graph.nodes.get(loops[0].to))}` : 'Feedback paths loop back' });
    steps.push({ par: loops.map(flyOf) });
    steps.push({ par: [...new Set(loops.map((e) => e.to))].map((t) => ({ pulse: t })) });
  }

  return {
    title: `Animated flow: ${name(graph.nodes.get(sources[0]))}`,
    nodes,
    links,
    runs: [{ steps }],
  };
}

/* ------------------------------------------------------------------ */
/* State diagrams: reuse the flowchart pipeline                        */
/* ------------------------------------------------------------------ */

const START = '__start';
const END = '__end';

function stateName(id) {
  if (id === START) return 'Start';
  if (id === END) return 'End';
  const words = id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
  const text = words.map((w, i) => (i === 0 ? w : w.toLowerCase())).join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function parseState(src) {
  const rawLines = src.trim().split('\n');
  if (!/^stateDiagram(-v2)?\s*$/.test(rawLines[0].trim())) return null;
  const graph = { dir: 'TD', nodes: new Map(), edges: [] };
  const add = (id, shape = 'rect') => {
    if (!graph.nodes.has(id)) graph.nodes.set(id, { id, lines: [stateName(id)], shape });
  };
  const loops = new Map();

  for (const raw of rawLines.slice(1)) {
    const line = raw.trim();
    if (!line || line.startsWith('%%') || line.startsWith('direction')) continue;
    const m = /^(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)(?:\s*:\s*(.*))?$/.exec(line);
    if (!m) return null;
    const from = m[1] === '[*]' ? START : m[1];
    const to = m[2] === '[*]' ? END : m[2];
    const label = (m[3] ?? '').trim();
    add(from, from === START ? 'circle' : 'rect');
    add(to, to === END ? 'circle' : 'rect');
    if (from === to) {
      if (!loops.has(from)) loops.set(from, []);
      loops.get(from).push(label || 'repeats');
    } else {
      graph.edges.push({ from, to, label, dotted: false, bidir: false });
    }
  }
  for (const [id, labels] of loops) graph.nodes.get(id).lines.push(...labels.map((l) => `loops: ${l}`));
  return graph.nodes.size ? graph : null;
}

/* ------------------------------------------------------------------ */
/* Sequence diagrams                                                   */
/* ------------------------------------------------------------------ */

const MSG_RE = /^(\w+)\s*(-->>|->>|--x|-x|--\)|-\))\s*[+-]?(\w+)\s*:\s*(.*)$/;
const BLOCK_OPEN = /^(par|alt|opt|loop|rect|critical|break)\b/;

function oneLine(text) {
  return cleanLabel(text).join(' - ');
}

function packetLabel(text) {
  const t = oneLine(text);
  if (t.length <= 24) return t;
  const cut = t.slice(0, 24);
  const at = cut.lastIndexOf(' ');
  return (at > 10 ? cut.slice(0, at) : cut).replace(/[,.;:(\s]+$/, '') + '...';
}

export function parseSequence(src) {
  const rawLines = src.trim().split('\n');
  if (rawLines[0].trim() !== 'sequenceDiagram') return null;
  const participants = new Map();
  const events = [];
  const stack = [];
  const ensure = (id) => {
    if (!participants.has(id)) participants.set(id, id);
  };

  for (const raw of rawLines.slice(1)) {
    const line = raw.trim();
    if (!line || line.startsWith('%%') || line === 'autonumber') continue;
    let m = /^(?:participant|actor)\s+(\w+)(?:\s+as\s+(.+))?$/.exec(line);
    if (m) {
      participants.set(m[1], (m[2] ?? m[1]).trim());
      continue;
    }
    m = /^Note\s+(?:over|left of|right of)\s+([\w,\s]+?)\s*:\s*(.*)$/i.exec(line);
    if (m) {
      const over = m[1].split(',').map((s) => s.trim());
      over.forEach(ensure);
      events.push({ t: 'note', over, text: m[2] });
      continue;
    }
    m = BLOCK_OPEN.exec(line);
    if (m) {
      stack.push(m[1]);
      if (m[1] === 'par') events.push({ t: 'par' });
      continue;
    }
    if (/^and\b/.test(line)) {
      if (stack.at(-1) === 'par') events.push({ t: 'and' });
      continue;
    }
    if (/^else\b/.test(line)) continue;
    if (line === 'end') {
      if (stack.pop() === 'par') events.push({ t: 'end' });
      continue;
    }
    m = MSG_RE.exec(line);
    if (!m) return null;
    ensure(m[1]);
    ensure(m[3]);
    events.push({ t: 'msg', from: m[1], to: m[3], dashed: m[2].startsWith('--'), text: m[4] });
  }
  return participants.size && events.length ? { participants, events } : null;
}

export function sequenceToScene(src) {
  const seq = parseSequence(src);
  if (!seq) return null;
  const ids = [...seq.participants.keys()];
  const idx = new Map(ids.map((id, i) => [id, i]));
  const nodes = ids.map((id, i) => {
    const label = oneLine(seq.participants.get(id));
    return { id, label, kind: kindOf({ lines: [label], shape: 'rect' }), col: i, row: 0 };
  });

  const toneFor = (m) => (/\b(4\d\d|5\d\d)\b|reject|fail|error|revoke|invalid/i.test(m.text) ? 'miss' : m.dashed ? 'res' : 'req');
  let n = 0;
  const flyOf = (m) => {
    const gap = Math.abs(idx.get(m.from) - idx.get(m.to));
    const ev = { fly: [m.from, m.to], label: packetLabel(m.text), tone: toneFor(m), ms: 750 + gap * 150 };
    if (gap > 1) ev.lift = 26;
    return ev;
  };
  const stepsFor = (m) => {
    n++;
    const say = { say: `${n}. ${oneLine(m.text)}` };
    if (m.from === m.to) return [say, { pulse: m.from }, { wait: 800 }];
    return [say, flyOf(m), { pulse: m.to }, { wait: 150 }];
  };

  const steps = [];
  for (let i = 0; i < seq.events.length; i++) {
    const ev = seq.events[i];
    if (ev.t === 'msg') steps.push(...stepsFor(ev));
    else if (ev.t === 'note') {
      steps.push({ say: `Note: ${oneLine(ev.text)}` }, { par: ev.over.map((id) => ({ pulse: id })) }, { wait: 900 });
    } else if (ev.t === 'par') {
      const branches = [[]];
      let j = i + 1;
      for (; j < seq.events.length && seq.events[j].t !== 'end'; j++) {
        if (seq.events[j].t === 'and') branches.push([]);
        else branches.at(-1).push(seq.events[j]);
      }
      i = j;
      const single = branches.length > 1 && branches.every((b) => b.length === 1 && b[0].t === 'msg' && b[0].from !== b[0].to);
      if (single) {
        const first = n + 1;
        n += branches.length;
        steps.push(
          { say: `${first}-${n}. In parallel: ${[...new Set(branches.map((b) => oneLine(b[0].text)))].join(' | ')}` },
          { par: branches.map((b) => flyOf(b[0])) },
          { par: branches.map((b) => ({ pulse: b[0].to })) },
          { wait: 150 },
        );
      } else {
        for (const b of branches) for (const e of b) if (e.t === 'msg') steps.push(...stepsFor(e));
      }
    }
  }

  const links = [];
  const seen = new Set();
  for (const e of seq.events) {
    if (e.t !== 'msg' || Math.abs(idx.get(e.from) - idx.get(e.to)) !== 1) continue;
    const k = [e.from, e.to].sort().join('|');
    if (!seen.has(k)) {
      seen.add(k);
      links.push([e.from, e.to]);
    }
  }

  const names = ids.slice(0, 3).map((id) => oneLine(seq.participants.get(id)));
  return { title: `Message flow: ${names.join(', ')}`, dense: ids.length > 4, nodes, links, runs: [{ steps }] };
}

export function mermaidToScene(src) {
  const head = src.trimStart();
  if (/^(flowchart|graph)\s/.test(head)) {
    const graph = parseFlowchart(src);
    return graph ? graphToScene(graph) : null;
  }
  if (head.startsWith('sequenceDiagram')) return sequenceToScene(src);
  if (head.startsWith('stateDiagram')) {
    const graph = parseState(src);
    if (!graph) return null;
    const scene = graphToScene(graph);
    scene.title = 'State machine: ' + scene.title.replace(/^Animated flow: /, '');
    return scene;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Remark plugin                                                       */
/* ------------------------------------------------------------------ */

function toElement(node, scene) {
  Object.assign(node, {
    type: 'mdxJsxFlowElement',
    name: 'FlowAnimation',
    attributes: [{ type: 'mdxJsxAttribute', name: 'scene', value: JSON.stringify(scene) }],
    children: [],
  });
  delete node.lang;
  delete node.value;
}

export function remarkFlow() {
  return (tree, file) => {
    const inSection = SECTION_RE.test(String(file.path ?? ''));
    walk(tree, (node) => {
      if (node.type !== 'code' || !node.value) return;

      if (node.lang === 'flow') {
        let scene;
        try {
          scene = JSON.parse(node.value);
        } catch (e) {
          throw new Error(`Invalid flow scene in ${file.path}: ${e.message}`);
        }
        const errors = validate(scene);
        if (errors.length) throw new Error(`Invalid flow scene "${scene.title ?? ''}" in ${file.path}:\n- ${errors.join('\n- ')}`);
        toElement(node, scene);
        return;
      }

      if (inSection && node.lang === 'mermaid' && /^\s*(flowchart\s|graph\s|sequenceDiagram|stateDiagram)/.test(node.value)) {
        let scene = null;
        try {
          scene = mermaidToScene(node.value);
        } catch {
          scene = null;
        }
        if (scene && validate(scene).length === 0) toElement(node, scene);
      }
    });
  };
}
