'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Pill } from '../iso';
import type { Note, Tone } from '../types';

/** All engines draw into the same viewBox so stages line up across lessons. */
export const W = 640;
export const H = 420;
export const ACCENT = '#f5d547';
export const MONO: CSSProperties = { fontFamily: 'var(--font-mono, ui-monospace, monospace)' };

export const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** Colours for packets, arrows, bars and highlights. */
export const TONE_COLOR = {
  neutral: '#a3a3a3',
  accent: ACCENT,
  ok: '#2fb487',
  bad: '#e24b4a',
  info: '#4f9be8',
  req: '#4f9be8',
  res: '#2fb487',
  data: '#ef9f27',
  violet: '#958df0',
  pink: '#e0679a',
} as const;

export type PaintTone = keyof typeof TONE_COLOR;

/** Visual states shared by cells, graph nodes and grid cells. */
export type ItemState = 'normal' | 'active' | 'visited' | 'done' | 'found' | 'bad' | 'dim' | 'swap' | 'path';

export const ITEM_STYLE: Record<ItemState, { fill: string; stroke: string; text: string; glow?: boolean }> = {
  normal: { fill: '#161616', stroke: 'rgba(255,255,255,0.22)', text: '#e5e5e5' },
  active: { fill: '#2a2610', stroke: ACCENT, text: '#fff4b0', glow: true },
  visited: { fill: '#0f2236', stroke: '#4f9be8', text: '#b5d4f4' },
  done: { fill: '#0d2b24', stroke: '#2fb487', text: '#9fe1cb' },
  found: { fill: '#13402f', stroke: '#3fd6a0', text: '#d5fbe9', glow: true },
  bad: { fill: '#2b1414', stroke: '#e24b4a', text: '#f5b5b5' },
  dim: { fill: '#121212', stroke: 'rgba(255,255,255,0.08)', text: '#5c5c5c' },
  swap: { fill: '#1e1b3a', stroke: '#958df0', text: '#d9d6fb', glow: true },
  path: { fill: '#33210a', stroke: '#ef9f27', text: '#fac775' },
};

export function pillTone(t?: Tone): 'neutral' | 'accent' | 'bad' {
  if (t === 'accent' || t === 'ok' || t === 'info') return 'accent';
  if (t === 'bad') return 'bad';
  return 'neutral';
}

/** Rough text width for 11px mono labels. */
export const textW = (s: string, size = 11) => s.length * size * 0.61;

export function NoteLayer({ note, frameKey }: { note?: Note; frameKey: string }) {
  if (!note) return null;
  return <Pill key={`${frameKey}-note`} x={W / 2} y={H - 14} text={note.text} tone={pillTone(note.tone)} className="lx-fade" />;
}

export function Stage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
      <defs>
        <pattern id="lx-dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.07)" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#lx-dots)" />
      {children}
    </svg>
  );
}

/**
 * A dot (with optional label) that travels along `path` once.
 * SMIL begin times are document relative, so motion is started on mount with beginElementAt(delay),
 * which also keeps it in step with svg.pauseAnimations().
 */
export function Traveler({
  path,
  dur,
  delay = 0,
  color = ACCENT,
  label,
  stay = false,
  r = 5.5,
}: {
  path: string;
  dur: number;
  delay?: number;
  color?: string;
  label?: string;
  stay?: boolean;
  r?: number;
}) {
  const motion = useRef<SVGAnimateMotionElement>(null);
  const show = useRef<SVGSetElement>(null);
  const fade = useRef<SVGAnimateElement>(null);
  useEffect(() => {
    motion.current?.beginElementAt(delay);
    show.current?.beginElementAt(delay);
    fade.current?.beginElementAt(delay);
  }, [delay]);
  const w = label ? textW(label, 10) + 12 : 0;
  return (
    <g visibility="hidden">
      <set ref={show} attributeName="visibility" to="visible" begin="indefinite" fill="freeze" />
      {stay ? null : (
        <animate
          ref={fade}
          attributeName="opacity"
          values="1;1;0"
          keyTimes="0;0.9;1"
          dur={`${dur + 0.35}s`}
          begin="indefinite"
          fill="freeze"
        />
      )}
      <animateMotion ref={motion} dur={`${dur}s`} begin="indefinite" fill="freeze" path={path} />
      <circle r={r} fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      {label ? (
        <g transform="translate(0,-15)">
          <rect x={-w / 2} y={-8} width={w} height={16} rx={8} fill="#0b0b0b" stroke={color} strokeWidth="1" />
          <text textAnchor="middle" dominantBaseline="middle" y={0.5} fontSize="10" fill={color} style={MONO}>
            {label}
          </text>
        </g>
      ) : null}
    </g>
  );
}

export type Panel = {
  title: string;
  /** stack draws top-first, queue left-to-right, list and map as rows. */
  kind?: 'stack' | 'queue' | 'list' | 'map';
  items: string[];
  /** Index of an item to highlight. */
  highlight?: number;
};

/** Side panels for auxiliary structures: stacks, queues, hash maps, result lists. */
export function Panels({ panels, x, y, w, h }: { panels: Panel[]; x: number; y: number; w: number; h: number }) {
  if (!panels.length) return null;
  const gap = 12;
  const ph = (h - gap * (panels.length - 1)) / panels.length;
  return (
    <g>
      {panels.map((p, pi) => {
        const top = y + pi * (ph + gap);
        const kind = p.kind ?? 'list';
        const rowH = 22;
        const max = Math.max(1, Math.floor((ph - 34) / (rowH + 4)));
        const items = kind === 'stack' ? [...p.items].reverse() : p.items;
        const shown = items.slice(0, max);
        const hidden = items.length - shown.length;
        return (
          <g key={p.title}>
            <rect x={x} y={top} width={w} height={ph} rx={10} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.12)" />
            <text x={x + 10} y={top + 17} fontSize="9.5" fill="#8a8a8a" style={{ ...MONO, letterSpacing: '0.08em' }}>
              {p.title.toUpperCase()}
              {kind === 'stack' ? ' ↓ top' : kind === 'queue' ? ' → front' : ''}
            </text>
            {shown.length === 0 ? (
              <text x={x + 10} y={top + 42} fontSize="10.5" fill="#5c5c5c" style={MONO}>
                empty
              </text>
            ) : null}
            {shown.map((it, i) => {
              const realIdx = kind === 'stack' ? p.items.length - 1 - i : i;
              const hl = p.highlight === realIdx;
              const iy = top + 28 + i * (rowH + 4);
              return (
                <g key={`${it}-${realIdx}`} className="lx-fade">
                  <rect
                    x={x + 8}
                    y={iy}
                    width={w - 16}
                    height={rowH}
                    rx={6}
                    fill={hl ? '#2a2610' : '#161616'}
                    stroke={hl ? ACCENT : 'rgba(255,255,255,0.14)'}
                  />
                  <text x={x + 16} y={iy + rowH / 2 + 0.5} dominantBaseline="middle" fontSize="10.5" fill={hl ? '#fff4b0' : '#d4d4d4'} style={MONO}>
                    {it}
                  </text>
                </g>
              );
            })}
            {hidden > 0 ? (
              <text x={x + w - 10} y={top + 17} textAnchor="end" fontSize="9.5" fill="#8a8a8a" style={MONO}>
                +{hidden} more
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/** Small pill tag drawn under or above an item, e.g. a pointer name. */
export function Tag({ x, y, text, color = ACCENT, up = false }: { x: number; y: number; text: string; color?: string; up?: boolean }) {
  const w = textW(text, 10) + 12;
  const tip = up ? `M${x - 4} ${y + 8} L${x} ${y + 13} L${x + 4} ${y + 8} z` : `M${x - 4} ${y - 8} L${x} ${y - 13} L${x + 4} ${y - 8} z`;
  return (
    <g>
      <path d={tip} fill={color} />
      <rect x={x - w / 2} y={y - 8} width={w} height={16} rx={8} fill="#0b0b0b" stroke={color} />
      <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={color} style={MONO}>
        {text}
      </text>
    </g>
  );
}

/** Filled triangle pointing from (x1, y1) toward its tip at (x2, y2). */
export function ArrowHead({ x1, y1, x2, y2, color, size = 7 }: { x1: number; y1: number; x2: number; y2: number; color: string; size?: number }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (ang: number) => `${(x2 - size * Math.cos(ang)).toFixed(1)},${(y2 - size * Math.sin(ang)).toFixed(1)}`;
  return <polygon points={`${x2},${y2} ${p(a - 0.45)} ${p(a + 0.45)}`} fill={color} />;
}

export const statsOf =(s: { stats?: import('../types').Stat[] }) => s.stats ?? [];
