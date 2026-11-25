'use client';

import { IsoCube, Pill, shade } from '../iso';
import { Machine, type MachineShape } from '../machines';
import type { BaseState, Note, SceneProps, Tone } from '../types';
import { ACCENT, MONO, NoteLayer, Stage, TEXT_HALO, TONE_COLOR, Traveler, pillTone, textW, type PaintTone } from './common';

/**
 * Architecture engine: isometric boxes on a floor, links between them, and packets that travel.
 * Layout units: x from 0 (left) to 6 (right), y from 0 (top) to 3.5 (bottom). Fractions are fine.
 */

export type FlowKind =
  | 'client'
  | 'dns'
  | 'cdn'
  | 'lb'
  | 'gateway'
  | 'service'
  | 'worker'
  | 'cache'
  | 'db'
  | 'queue'
  | 'storage'
  | 'search'
  | 'external'
  | 'monitor';

export type FlowNode = {
  id: string;
  label: string;
  sub?: string;
  kind: FlowKind;
  /** Optional machine replica drawn instead of the cube. Leave out for abstract things. */
  shape?: MachineShape;
  x: number;
  y: number;
  /** active = highlighted, hot = overloaded, down = failed, dim = not relevant now. */
  status?: 'normal' | 'active' | 'hot' | 'down' | 'dim';
  /** Pill above the box. */
  badge?: Note;
  /** Small chips above the box: cache entries, queued messages, rows. At most 4 show. */
  items?: string[];
  /** Small bar under the label, value from 0 to 1. */
  meter?: { value: number; label?: string; tone?: Tone };
  size?: 'sm' | 'md' | 'lg';
};

export type FlowLink = { from: string; to: string; tone?: PaintTone; dashed?: boolean; label?: string };

export type Packet = {
  from: string;
  to: string;
  label?: string;
  tone?: PaintTone;
  /** Seconds after the frame starts. */
  delay?: number;
  /** Travel time in seconds. Defaults to distance based. */
  dur?: number;
  /** Keep the dot at the destination instead of fading out. */
  stay?: boolean;
};

export type FlowGroup = { label: string; nodes: string[]; tone?: Tone };

export type FlowState = BaseState & {
  nodes: FlowNode[];
  links?: FlowLink[];
  packets?: Packet[];
  /** Dashed boxes around nodes, e.g. regions, availability zones, cells. */
  groups?: FlowGroup[];
};

export const KIND_COLOR: Record<FlowKind, string> = {
  client: '#9a9a9a',
  dns: '#5aa9e6',
  cdn: '#36c2d6',
  lb: '#e2b84a',
  gateway: '#e0679a',
  service: '#958df0',
  worker: '#7c83db',
  cache: '#2fb487',
  db: '#ef7f45',
  queue: '#ef9f27',
  storage: '#c27c4e',
  search: '#4fb0a5',
  external: '#6b8fb5',
  monitor: '#b28ce8',
};

const SIZE = { sm: 15, md: 20, lg: 26 } as const;
const sx = (x: number) => 70 + x * 83.3;
const sy = (y: number) => 96 + y * 72;

/** Arrowhead polygon sitting just outside the destination box, pointing along the link. */
function arrowAt(x1: number, y1: number, x2: number, y2: number, size: number): string | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  const rx = size * 1.8;
  const ry = size * 1.25;
  const edge = 1 / Math.sqrt((ux / rx) ** 2 + (uy / ry) ** 2) + 5;
  if (len < edge + 12) return null;
  const tx = x2 - ux * edge;
  const ty = y2 - uy * edge;
  const bx = tx - ux * 10;
  const by = ty - uy * 10;
  const px = -uy * 2.5;
  const py = ux * 2.5;
  return `${tx.toFixed(1)},${ty.toFixed(1)} ${(bx + px).toFixed(1)},${(by + py).toFixed(1)} ${(bx - px).toFixed(1)},${(by - py).toFixed(1)}`;
}

function NodeView({ n, frameKey }: { n: FlowNode; frameKey: string }) {
  const size = SIZE[n.size ?? 'md'];
  const color = KIND_COLOR[n.kind];
  const status = n.status ?? 'normal';
  const items = n.items ?? [];
  const shown = items.slice(0, 4);
  const chipW = shown.map((t) => textW(t, 9.5) + 10);
  const rowW = chipW.reduce((a, b) => a + b, 0) + Math.max(0, shown.length - 1) * 4 + (items.length > 4 ? 26 : 0);
  const topY = -size * 1.5;
  const chipY = topY - 20;
  const badgeY = shown.length ? chipY - 22 : topY - 18;
  const labelY = size * 0.58 + 16;
  const meterY = labelY + (n.sub ? 22 : 10);
  let cx = -rowW / 2;

  return (
    <g className="lx-slide" style={{ transform: `translate(${sx(n.x)}px, ${sy(n.y)}px)`, opacity: status === 'dim' ? 0.32 : 1 }}>
      <g className="lx-pop" style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
        {status === 'active' ? (
          <ellipse cx={0} cy={size * 0.35} rx={size * 1.6} ry={size * 0.6} fill={`${ACCENT}14`} stroke={ACCENT} strokeWidth="2" className="lx-glow-ring" />
        ) : null}
        {status === 'hot' ? (
          <ellipse
            key={`${frameKey}-hot`}
            cx={0}
            cy={size * 0.35}
            rx={size * 1.6}
            ry={size * 0.6}
            fill="rgba(226,75,74,0.18)"
            stroke="#e24b4a"
            strokeWidth="2"
            className="lx-hot"
          />
        ) : null}
        {n.shape ? (
          <Machine shape={n.shape} x={0} y={0} color={color} size={size} failing={status === 'down'} />
        ) : (
          <IsoCube x={0} y={0} color={color} size={size} failing={status === 'down'} />
        )}
        <text x={0} y={labelY} textAnchor="middle" fontSize="11" fontWeight={600} fill={status === 'down' ? '#f09595' : '#e5e5e5'} style={TEXT_HALO}>
          {n.label}
        </text>
        {n.sub ? (
          <text x={0} y={labelY + 13} textAnchor="middle" fontSize="9.5" fill="#8a8a8a" style={{ ...MONO, ...TEXT_HALO, strokeWidth: 3 }}>
            {n.sub}
          </text>
        ) : null}
        {n.meter ? (
          <g>
            <rect x={-30} y={meterY} width={60} height={5} rx={2.5} fill="rgba(255,255,255,0.1)" />
            <rect
              x={-30}
              y={meterY}
              width={60 * Math.max(0, Math.min(1, n.meter.value))}
              height={5}
              rx={2.5}
              fill={TONE_COLOR[n.meter.tone === 'neutral' || !n.meter.tone ? 'info' : n.meter.tone]}
              className="lx-meter"
            />
            {n.meter.label ? (
              <text x={0} y={meterY + 15} textAnchor="middle" fontSize="9" fill="#a3a3a3" style={MONO}>
                {n.meter.label}
              </text>
            ) : null}
          </g>
        ) : null}
      </g>
      {shown.map((t, i) => {
        const x = cx;
        cx += chipW[i] + 4;
        return (
          <g key={`${t}-${i}`} className="lx-fade">
            <rect x={x} y={chipY - 8} width={chipW[i]} height={16} rx={4} fill={shade(color, -0.75)} stroke={shade(color, -0.2)} />
            <text x={x + chipW[i] / 2} y={chipY + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fill={shade(color, 0.55)} style={MONO}>
              {t}
            </text>
          </g>
        );
      })}
      {items.length > 4 ? (
        <text x={cx + 2} y={chipY + 3.5} fontSize="9.5" fill="#8a8a8a" style={MONO}>
          +{items.length - 4}
        </text>
      ) : null}
      {n.badge ? <Pill key={`${frameKey}-b`} x={0} y={badgeY} text={n.badge.text} tone={pillTone(n.badge.tone)} className="lx-fade" /> : null}
    </g>
  );
}

export function FlowScene({ state, frameKey }: SceneProps<FlowState>) {
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  const nodes = [...state.nodes].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <Stage label="Architecture diagram">
      {(state.groups ?? []).map((g) => {
        const members = g.nodes.map((id) => byId.get(id)).filter((n): n is FlowNode => !!n);
        if (!members.length) return null;
        const x1 = Math.min(...members.map((n) => sx(n.x))) - 58;
        const x2 = Math.max(...members.map((n) => sx(n.x))) + 58;
        const y1 = Math.min(...members.map((n) => sy(n.y))) - 58;
        const y2 = Math.max(...members.map((n) => sy(n.y))) + 50;
        const color = g.tone === 'bad' ? '#e24b4a' : g.tone === 'accent' ? ACCENT : 'rgba(255,255,255,0.28)';
        return (
          <g key={g.label} className="lx-fade">
            <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} rx={14} fill="rgba(255,255,255,0.02)" stroke={color} strokeDasharray="5 5" />
            <text x={x1 + 12} y={y1 + 16} fontSize="9.5" fill={g.tone === 'bad' ? '#f09595' : '#a3a3a3'} style={{ ...MONO, letterSpacing: '0.08em' }}>
              {g.label.toUpperCase()}
            </text>
          </g>
        );
      })}

      {(state.links ?? []).map((l) => {
        const a = byId.get(l.from);
        const b = byId.get(l.to);
        if (!a || !b) return null;
        const color = l.tone ? TONE_COLOR[l.tone] : 'rgba(255,255,255,0.2)';
        const mx = (sx(a.x) + sx(b.x)) / 2;
        const my = (sy(a.y) + sy(b.y)) / 2;
        const arrow = arrowAt(sx(a.x), sy(a.y), sx(b.x), sy(b.y), SIZE[b.size ?? 'md']);
        return (
          <g key={`${l.from}-${l.to}`}>
            <line
              x1={sx(a.x)}
              y1={sy(a.y)}
              x2={sx(b.x)}
              y2={sy(b.y)}
              stroke={color}
              strokeWidth={l.tone ? 2 : 1.5}
              strokeDasharray={l.dashed ? '5 5' : undefined}
              strokeLinecap="round"
              className="lx-key"
            />
            {arrow ? <polygon points={arrow} fill={color} className="lx-key" /> : null}
            {l.label ? <Pill x={mx} y={my} text={l.label} /> : null}
          </g>
        );
      })}

      {nodes.map((n) => (
        <NodeView key={n.id} n={n} frameKey={frameKey} />
      ))}

      {(state.packets ?? []).map((p, i) => {
        const a = byId.get(p.from);
        const b = byId.get(p.to);
        if (!a || !b) return null;
        const x1 = sx(a.x);
        const y1 = sy(a.y);
        const x2 = sx(b.x);
        const y2 = sy(b.y);
        const dist = Math.hypot(x2 - x1, y2 - y1);
        return (
          <Traveler
            key={`${frameKey}-p${i}`}
            path={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`}
            dur={p.dur ?? 0.45 + dist / 420}
            delay={p.delay}
            color={TONE_COLOR[p.tone ?? 'req']}
            label={p.label}
            stay={p.stay}
          />
        );
      })}

      <NoteLayer note={state.note} frameKey={frameKey} />
    </Stage>
  );
}
