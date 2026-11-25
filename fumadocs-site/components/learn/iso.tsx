/** Shared isometric SVG primitives for lesson scenes. */
import type { CSSProperties } from 'react';

export const SERVER_COLORS: Record<string, string> = {
  A: '#4f9be8',
  B: '#ef9f27',
  C: '#2fb487',
  D: '#958df0',
  E: '#e0679a',
};

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Mix a hex colour toward white (amt > 0) or black (amt < 0). */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amt > 0 ? 255 : 0;
  const t = Math.abs(amt);
  const mix = (c: number) => clamp(c + (target - c) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Isometric floor with a fading grid, centred on (cx, cy). */
export function IsoFloor({ id, cx, cy, w, h }: { id: string; cx: number; cy: number; w: number; h: number }) {
  return (
    <g aria-hidden="true">
      <defs>
        <pattern id={`${id}-grid`} width="40" height="23.094" patternUnits="userSpaceOnUse">
          <path d="M0 0 L40 23.094 M0 23.094 L40 0" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
        </pattern>
        <radialGradient id={`${id}-fade`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="70%" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={`url(#${id}-grid)`} mask={`url(#${id}-mask)`} />
    </g>
  );
}

type CubeProps = {
  x: number;
  y: number;
  color: string;
  label?: string;
  /** Half width of the top face. */
  size?: number;
  failing?: boolean;
  className?: string;
};

/** Isometric box whose base centre sits on (x, y). */
export function IsoCube({ x, y, color, label, size = 26, failing, className }: CubeProps) {
  const w = size;
  const t = size * 0.58;
  const d = size * 0.92;
  const top = `${x},${y - d - t} ${x + w},${y - d} ${x},${y - d + t} ${x - w},${y - d}`;
  const left = `${x - w},${y - d} ${x},${y - d + t} ${x},${y + t} ${x - w},${y}`;
  const right = `${x},${y - d + t} ${x + w},${y - d} ${x + w},${y} ${x},${y + t}`;
  const base = failing ? '#5a2424' : color;
  const edge = failing ? '#e24b4a' : shade(color, -0.55);
  return (
    <g className={className} style={{ transformOrigin: `${x}px ${y}px` }}>
      <ellipse cx={x} cy={y + t * 0.7} rx={w * 1.15} ry={t * 0.9} fill="rgba(0,0,0,0.45)" />
      <polygon points={left} fill={shade(base, -0.25)} stroke={edge} strokeWidth="1.2" strokeLinejoin="round" />
      <polygon points={right} fill={shade(base, -0.45)} stroke={edge} strokeWidth="1.2" strokeLinejoin="round" />
      <polygon points={top} fill={shade(base, 0.18)} stroke={edge} strokeWidth="1.2" strokeLinejoin="round" />
      {label ? (
        <text
          x={x}
          y={y - d + 0.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.max(9, size * 0.5)}
          fontWeight={700}
          fill={failing ? '#f09595' : shade(color, -0.75)}
          style={{ fontFamily: 'var(--lx-font, var(--font-mono, ui-monospace, monospace))' }}
        >
          {label}
        </text>
      ) : null}
      {failing ? (
        <text x={x} y={y - d - t - 10} textAnchor="middle" fontSize="16" fontWeight={700} fill="#e24b4a">
          ×
        </text>
      ) : null}
    </g>
  );
}

/** Small rounded label pill drawn in SVG. */
export function Pill({
  x,
  y,
  text,
  tone = 'neutral',
  className,
  style,
}: {
  x: number;
  y: number;
  text: string;
  tone?: 'neutral' | 'accent' | 'bad';
  className?: string;
  style?: CSSProperties;
}) {
  const w = text.length * 6.6 + 18;
  const fill = tone === 'accent' ? '#2a2610' : tone === 'bad' ? '#2b1414' : '#161616';
  const stroke = tone === 'accent' ? '#f5d547' : tone === 'bad' ? '#e24b4a' : 'rgba(255,255,255,0.22)';
  const color = tone === 'accent' ? '#f5d547' : tone === 'bad' ? '#f09595' : '#d4d4d4';
  return (
    <g className={className} style={style}>
      <rect x={x - w / 2} y={y - 11} width={w} height={22} rx={11} fill={fill} stroke={stroke} />
      <text
        x={x}
        y={y + 0.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fill={color}
        style={{ fontFamily: 'var(--lx-font, var(--font-mono, ui-monospace, monospace))' }}
      >
        {text}
      </text>
    </g>
  );
}
