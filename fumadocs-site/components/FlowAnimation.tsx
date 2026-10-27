'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Kind = 'client' | 'service' | 'cache' | 'db' | 'queue' | 'external' | 'decision';
type Tone = 'req' | 'res' | 'data' | 'miss' | 'ok';
type BadgeTone = 'ok' | 'bad' | 'info';

type UiSpec = {
  button?: string;
  blocks: number;
  blockLabel?: string;
  idleLabel?: string;
  skeleton?: boolean;
};

type NodeSpec = {
  id: string;
  label: string;
  sub?: string;
  kind?: Kind;
  col: number;
  row: number;
  ui?: UiSpec;
};

type FlyEv = { fly: string[]; label?: string; tone?: Tone; ms?: number; lift?: number };

type Ev =
  | { say: string }
  | { wait: number }
  | { tap: string }
  | FlyEv
  | { pulse: string }
  | { badge: { at: string; text: string; tone?: BadgeTone } | null }
  | { fill: string; n?: number }
  | { reset: string }
  | { count: number; unit?: string }
  | { par: Ev[] };

type Run = { label?: string; tone?: 'warn' | 'ok' | 'bad' | 'info'; steps: Ev[] };

type Scene = {
  title?: string;
  note?: string;
  dense?: boolean;
  nodes: NodeSpec[];
  links: [string, string][];
  runs: Run[];
};

const NODE_W = 164;
const UI_W = 124;
const COLW = 208;
const GAP_Y = 52;
const PAD_X = 20;
const PAD_TOP = 56;
const PAD_BOTTOM = 40;
const BLOCK_H = 44;
const BLOCK_GAP = 8;
const BTN_H = 26;
const LABEL_LH = 16;
const SUB_LH = 14;

const KIND = {
  client: { fill: '#1c1c1c', stroke: '#737373', text: '#e5e5e5', sub: '#a3a3a3' },
  service: { fill: '#1e1b3a', stroke: '#7f77dd', text: '#cecbf6', sub: '#afa9ec' },
  cache: { fill: '#0d2b24', stroke: '#1d9e75', text: '#9fe1cb', sub: '#5dcaa5' },
  db: { fill: '#33160d', stroke: '#d85a30', text: '#f5c4b3', sub: '#f0997b' },
  queue: { fill: '#35210a', stroke: '#ba7517', text: '#fac775', sub: '#ef9f27' },
  external: { fill: '#0c2238', stroke: '#378add', text: '#b5d4f4', sub: '#85b7eb' },
  decision: { fill: '#2b2410', stroke: '#8a7a2a', text: '#f3e7a6', sub: '#c9b95a' },
} satisfies Record<Kind, Record<string, string>>;

const TONE = {
  req: '#378add',
  res: '#1d9e75',
  data: '#ef9f27',
  miss: '#e24b4a',
  ok: '#1d9e75',
} satisfies Record<Tone, string>;

const BADGE = { ok: '#1d9e75', bad: '#e24b4a', info: '#facc15' } satisfies Record<BadgeTone, string>;

const CHIP = {
  warn: { bg: 'rgba(250,204,21,0.14)', fg: '#facc15' },
  ok: { bg: 'rgba(29,158,117,0.18)', fg: '#5dcaa5' },
  bad: { bg: 'rgba(226,75,74,0.18)', fg: '#f09595' },
  info: { bg: 'rgba(255,255,255,0.08)', fg: '#d4d4d4' },
} as const;

const DEAD = Symbol('dead');

type Geo = {
  spec: NodeSpec;
  cx: number;
  cy: number;
  w: number;
  h: number;
  top: number;
  left: number;
  labelLines: string[];
  subLines: string[];
  textTop: number;
};

function wrap(text: string | undefined, max: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    if (cur && (cur + ' ' + word).length > max) {
      lines.push(cur);
      cur = word;
    } else {
      cur = cur ? cur + ' ' + word : word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function layout(scene: Scene) {
  const nodeW = scene.dense ? 140 : NODE_W;
  const colW = scene.dense ? 176 : COLW;
  const labelMax = scene.dense ? 18 : 22;
  const subMax = scene.dense ? 22 : 26;
  const sized = scene.nodes.map((spec) => {
    const ui = spec.ui;
    if (ui) {
      const h = 20 + (ui.button ? BTN_H + BLOCK_GAP : 0) + ui.blocks * (BLOCK_H + BLOCK_GAP) - BLOCK_GAP;
      return { spec, w: UI_W, h, labelLines: [] as string[], subLines: [] as string[], contentH: 0 };
    }
    const labelLines = wrap(spec.label, labelMax);
    const subLines = wrap(spec.sub, subMax);
    const contentH = labelLines.length * LABEL_LH + (subLines.length ? 4 + subLines.length * SUB_LH : 0);
    return { spec, w: nodeW, h: Math.max(52, contentH + 20), labelLines, subLines, contentH };
  });

  const rows = [...new Set(sized.map((n) => n.spec.row))].sort((a, b) => a - b);
  const rowCenter = new Map<number, number>();
  let cursor = PAD_TOP;
  for (const r of rows) {
    const tallest = Math.max(...sized.filter((n) => n.spec.row === r).map((n) => n.h + (n.spec.ui ? 24 : 0)));
    rowCenter.set(r, cursor + tallest / 2);
    cursor += tallest + GAP_Y;
  }

  const geo = new Map<string, Geo>();
  let width = 0;
  for (const n of sized) {
    const cx = PAD_X + nodeW / 2 + n.spec.col * colW;
    const cy = rowCenter.get(n.spec.row)! - (n.spec.ui ? 12 : 0);
    const top = cy - n.h / 2;
    geo.set(n.spec.id, {
      spec: n.spec,
      cx,
      cy,
      w: n.w,
      h: n.h,
      top,
      left: cx - n.w / 2,
      labelLines: n.labelLines,
      subLines: n.subLines,
      textTop: top + (n.h - n.contentH) / 2,
    });
    width = Math.max(width, cx + nodeW / 2 + PAD_X);
  }
  return { geo, width, height: cursor - GAP_Y + PAD_BOTTOM };
}

function border(a: Geo, toward: Geo, gap = 3): [number, number] {
  const dx = toward.cx - a.cx;
  const dy = toward.cy - a.cy;
  if (dx === 0 && dy === 0) return [a.cx, a.cy];
  const sx = dx === 0 ? Infinity : a.w / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : a.h / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  const len = Math.hypot(dx, dy);
  return [a.cx + dx * s + (dx / len) * gap, a.cy + dy * s + (dy / len) * gap];
}

function parse(raw: string): { scene?: Scene; error?: string } {
  try {
    const scene = JSON.parse(raw) as Scene;
    if (!Array.isArray(scene.nodes) || !Array.isArray(scene.runs) || scene.runs.length === 0) {
      return { error: 'scene needs nodes and at least one run' };
    }
    scene.links ??= [];
    return { scene };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function FlowAnimation({ scene: raw }: { scene: string }) {
  const parsed = useMemo(() => parse(raw), [raw]);
  if (!parsed.scene) {
    return (
      <pre className="my-6 overflow-x-auto rounded-lg border border-fd-border p-4 text-sm">
        {parsed.error}
      </pre>
    );
  }
  return <Player scene={parsed.scene} />;
}

function Player({ scene }: { scene: Scene }) {
  const { geo, width, height } = useMemo(() => layout(scene), [scene]);
  const hasCount = useMemo(
    () => scene.runs.some((r) => r.steps.some((s) => 'count' in s)),
    [scene],
  );

  const rootRef = useRef<HTMLElement>(null);
  const packetsRef = useRef<SVGGElement>(null);
  const pausedRef = useRef(false);
  const visibleRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [runIdx, setRunIdx] = useState(0);
  const [caption, setCaption] = useState('');
  const [counter, setCounter] = useState<{ n: number; unit: string }>({ n: 0, unit: 'ms' });
  const [badges, setBadges] = useState<Record<string, { text: string; tone: BadgeTone }>>({});
  const [pulse, setPulse] = useState<Record<string, boolean>>({});
  const [filled, setFilled] = useState<Record<string, number>>({});
  const [tap, setTap] = useState<{ x: number; y: number; k: number } | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const speed = reduced ? 0 : 1;
    const gated = () => pausedRef.current || !visibleRef.current;
    const timers: number[] = [];
    let tapK = 0;

    const sleep = (ms: number) => new Promise<void>((res) => timers.push(window.setTimeout(res, ms)));

    async function wait(ms: number) {
      let left = ms * speed;
      while (left > 0) {
        if (!alive) throw DEAD;
        if (gated()) {
          await sleep(250);
          continue;
        }
        const step = Math.min(left, 50);
        await sleep(step);
        left -= step;
      }
      if (!alive) throw DEAD;
    }

    function point(id: string): Geo {
      const g = geo.get(id);
      if (!g) throw new Error(`flow: unknown node "${id}"`);
      return g;
    }

    function fly(ids: string[], color: string, label: string, ms: number, lift = 0) {
      return new Promise<void>((res, rej) => {
        const g = ids.map(point);
        if (g.length < 2 || speed === 0) return res();
        let pts: [number, number][];
        if (lift && g.length === 2) {
          // arc over whatever sits between two nodes on the same row
          const [a, b] = g;
          pts = [[a.cx, a.top], [a.cx, a.top - lift], [b.cx, b.top - lift], [b.cx, b.top]];
        } else {
          pts = g.map((n) => [n.cx, n.cy]);
          pts[0] = border(g[0], g[1]);
          pts[pts.length - 1] = border(g[g.length - 1], g[g.length - 2]);
        }
        const seg: number[] = [];
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
          const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          seg.push(d);
          total += d;
        }
        const ns = 'http://www.w3.org/2000/svg';
        const host = packetsRef.current;
        if (!host) return res();
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('r', '7');
        dot.setAttribute('fill', color);
        const txt = document.createElementNS(ns, 'text');
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('font-size', '12');
        txt.setAttribute('fill', '#e5e5e5');
        txt.setAttribute('paint-order', 'stroke');
        txt.setAttribute('stroke', '#0b0b0b');
        txt.setAttribute('stroke-width', '4');
        txt.textContent = label;
        host.append(dot, txt);

        let elapsed = 0;
        let last = performance.now();
        const frame = (now: number) => {
          if (!alive) {
            dot.remove();
            txt.remove();
            return rej(DEAD);
          }
          if (gated()) {
            timers.push(window.setTimeout(() => {
              last = performance.now();
              requestAnimationFrame(frame);
            }, 200));
            return;
          }
          elapsed += now - last;
          last = now;
          const p = Math.min(elapsed / ms, 1);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          let d = e * total;
          let i = 0;
          while (i < seg.length - 1 && d > seg[i]) {
            d -= seg[i];
            i++;
          }
          const k = seg[i] ? d / seg[i] : 1;
          const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k;
          const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
          dot.setAttribute('cx', String(x));
          dot.setAttribute('cy', String(y));
          txt.setAttribute('x', String(x));
          txt.setAttribute('y', String(y - 13));
          if (p < 1) requestAnimationFrame(frame);
          else {
            dot.remove();
            txt.remove();
            res();
          }
        };
        requestAnimationFrame(frame);
      });
    }

    async function exec(ev: Ev): Promise<void> {
      if ('say' in ev) return void setCaption(ev.say);
      if ('wait' in ev) return wait(ev.wait);
      if ('par' in ev) return void (await Promise.all(ev.par.map(exec)));
      if ('tap' in ev) {
        const g = point(ev.tap);
        const y = g.spec.ui ? g.top + (g.spec.ui.button ? 10 + BTN_H / 2 : 24) : g.cy;
        setTap({ x: g.cx, y, k: ++tapK });
        return wait(450);
      }
      if ('fly' in ev) return fly(ev.fly, TONE[ev.tone ?? 'req'], ev.label ?? '', ev.ms ?? 900, ev.lift);
      if ('pulse' in ev) {
        const id = ev.pulse;
        setPulse((p) => ({ ...p, [id]: true }));
        timers.push(window.setTimeout(() => alive && setPulse((p) => ({ ...p, [id]: false })), 400));
        return;
      }
      if ('badge' in ev) {
        const b = ev.badge;
        return void setBadges(b ? (p) => ({ ...p, [b.at]: { text: b.text, tone: b.tone ?? 'info' } }) : {});
      }
      if ('fill' in ev) {
        const g = point(ev.fill);
        const n = ev.n ?? g.spec.ui?.blocks ?? 0;
        for (let i = 0; i < n; i++) {
          setFilled((p) => ({ ...p, [ev.fill]: Math.min((p[ev.fill] ?? 0) + 1, n) }));
          await wait(170);
        }
        return;
      }
      if ('reset' in ev) return void setFilled((p) => ({ ...p, [ev.reset]: 0 }));
      if ('count' in ev) {
        const unit = ev.unit ?? 'ms';
        const steps = speed === 0 ? 1 : 20;
        for (let i = 1; i <= steps; i++) {
          setCounter({ n: Math.round((ev.count * i) / steps), unit });
          if (steps > 1) await wait(35);
        }
      }
    }

    (async () => {
      try {
        let i = 0;
        while (alive) {
          const idx = i % scene.runs.length;
          setRunIdx(idx);
          setBadges({});
          setPulse({});
          setFilled({});
          setCounter({ n: 0, unit: 'ms' });
          setCaption('');
          if (!reduced) await wait(500);
          for (const ev of scene.runs[idx].steps) await exec(ev);
          if (reduced) return;
          await wait(1800);
          i++;
        }
      } catch (e) {
        if (e !== DEAD) throw e;
      }
    })();

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      packetsRef.current?.replaceChildren();
    };
  }, [scene, geo]);

  const run = scene.runs[runIdx];
  const chip = CHIP[run.tone ?? 'info'];

  return (
    <figure
      ref={rootRef}
      aria-label={scene.title ?? 'Animated architecture diagram'}
      className="not-prose my-6 rounded-lg border border-fd-border bg-fd-card p-4"
    >
      <style>{`
        .fa-sk{animation:fa-pulse 1s ease-in-out infinite alternate}
        .fa-ripple{transform-box:fill-box;transform-origin:center;animation:fa-ripple .6s ease-out forwards}
        @keyframes fa-pulse{to{opacity:.45}}
        @keyframes fa-ripple{from{opacity:.7;transform:scale(.4)}to{opacity:0;transform:scale(2.4)}}
        @media (prefers-reduced-motion:reduce){.fa-sk,.fa-ripple{animation:none}}
      `}</style>
      <div className="mb-2 flex items-center gap-3">
        {run.label && (
          <span
            className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium"
            style={{ background: chip.bg, color: chip.fg }}
          >
            {run.label}
          </span>
        )}
        <span aria-live="polite" className="min-h-6 flex-1 text-sm font-medium text-fd-foreground">
          {caption}
        </span>
        {hasCount && (
          <span className="shrink-0 font-mono text-sm font-medium tabular-nums text-fd-foreground">
            {counter.n} {counter.unit}
          </span>
        )}
        <button
          type="button"
          aria-label={paused ? 'Play animation' : 'Pause animation'}
          aria-pressed={paused}
          onClick={() => {
            pausedRef.current = !paused;
            setPaused(!paused);
          }}
          className="shrink-0 rounded-md border border-fd-border px-2 py-1 text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          role="img"
          aria-hidden="true"
          className="mx-auto block h-auto"
          style={{ minWidth: Math.min(width, 820), maxWidth: width }}
        >
          <g stroke="#404040" strokeWidth="1.5" strokeDasharray="4 4" fill="none">
            {scene.links.map(([a, b]) => {
              const A = geo.get(a);
              const B = geo.get(b);
              return A && B ? <line key={a + b} x1={A.cx} y1={A.cy} x2={B.cx} y2={B.cy} /> : null;
            })}
          </g>

          {[...geo.values()].map((g) => {
            const { spec, cx, w, h, top, left, labelLines, subLines, textTop } = g;
            const c = KIND[spec.kind ?? (spec.ui ? 'client' : 'service')];
            const ui = spec.ui;
            const badge = badges[spec.id];
            const lit = pulse[spec.id];
            const f = filled[spec.id] ?? 0;
            return (
              <g key={spec.id}>
                <rect
                  x={left}
                  y={top}
                  width={w}
                  height={h}
                  rx={ui ? 16 : spec.kind === 'decision' ? 22 : 8}
                  fill={c.fill}
                  stroke={lit ? '#facc15' : c.stroke}
                  strokeWidth={lit ? 3 : 1.5}
                  style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                />
                {ui ? (
                  <>
                    {ui.button && (
                      <g>
                        <rect x={left + 10} y={top + 10} width={w - 20} height={BTN_H} rx={6} fill="#0c2238" stroke="#378add" />
                        <text x={cx} y={top + 10 + BTN_H / 2 + 4} textAnchor="middle" fontSize="12" fill="#b5d4f4">
                          {ui.button}
                        </text>
                      </g>
                    )}
                    {Array.from({ length: ui.blocks }, (_, i) => {
                      const y = top + 10 + (ui.button ? BTN_H + BLOCK_GAP : 0) + i * (BLOCK_H + BLOCK_GAP);
                      const on = i < f;
                      const text = on
                        ? (ui.blockLabel ?? 'Loaded').replace('{n}', String(i + 1))
                        : (ui.idleLabel ?? '').replace('{n}', String(i + 1));
                      return (
                        <g key={i}>
                          <rect
                            x={left + 10}
                            y={y}
                            width={w - 20}
                            height={BLOCK_H}
                            rx={6}
                            fill={on ? '#0d2b24' : '#262626'}
                            stroke={on ? '#1d9e75' : '#404040'}
                            className={!on && ui.skeleton ? 'fa-sk' : undefined}
                            style={{ transition: 'fill 0.3s, stroke 0.3s' }}
                          />
                          {text && (
                            <text x={cx} y={y + BLOCK_H / 2 + 4} textAnchor="middle" fontSize="12" fill={on ? '#9fe1cb' : '#a3a3a3'}>
                              {text}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    <text x={cx} y={top + h + 20} textAnchor="middle" fontSize="13" fontWeight="500" fill={c.sub}>
                      {spec.label}
                    </text>
                  </>
                ) : (
                  <>
                    {labelLines.map((line, i) => (
                      <text
                        key={`l${i}`}
                        x={cx}
                        y={textTop + 12 + i * LABEL_LH}
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight="500"
                        fill={c.text}
                      >
                        {line}
                      </text>
                    ))}
                    {subLines.map((line, i) => (
                      <text
                        key={`s${i}`}
                        x={cx}
                        y={textTop + labelLines.length * LABEL_LH + 4 + 10 + i * SUB_LH}
                        textAnchor="middle"
                        fontSize="11.5"
                        fill={c.sub}
                      >
                        {line}
                      </text>
                    ))}
                  </>
                )}
                {badge && (
                  <text
                    x={cx}
                    y={top - 9}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="600"
                    letterSpacing="0.06em"
                    fill={BADGE[badge.tone]}
                  >
                    {badge.text}
                  </text>
                )}
              </g>
            );
          })}

          {tap && <circle key={tap.k} cx={tap.x} cy={tap.y} r={9} fill="#facc15" className="fa-ripple" />}
          <g ref={packetsRef} />
        </svg>
      </div>

      {scene.note && <figcaption className="mt-1 text-xs text-fd-muted-foreground">{scene.note}</figcaption>}
    </figure>
  );
}
