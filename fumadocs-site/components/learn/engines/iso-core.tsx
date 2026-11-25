'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Pill, shade } from '../iso';
import type { Note } from '../types';
import { ACCENT, MONO, Panels, Tag, halo, pillTone, type ItemState, type Panel } from './common';

/**
 * Shared isometric toolkit for the DSA lessons.
 * Grid units: one unit moves 30 px right and 15 px down on screen for +x, 30 px left and 15 px down for +y.
 * Blocks are drawn around their own base centre, so a CSS transition on translate() makes them glide.
 */

export const IW = 760;
export const IH = 456;
export const U = 30;

export const r2 = (n: number) => Math.round(n * 100) / 100;

export function proj(gx: number, gy: number, z = 0): [number, number] {
  return [(gx - gy) * U, ((gx + gy) * U) / 2 - z * U];
}

/** Block colours per visual state. The top face is the lightest, the right face the darkest. */
export const BLOCK_COLOR: Record<ItemState, string> = {
  normal: '#cfc9bb',
  active: ACCENT,
  visited: '#4f9be8',
  done: '#2fb487',
  found: '#3fd6a0',
  bad: '#e24b4a',
  dim: '#3d3d3d',
  swap: '#958df0',
  path: '#ef9f27',
};

const INK: Record<ItemState, string> = {
  normal: '#2b2a26',
  active: '#3a3000',
  visited: '#07223d',
  done: '#04271d',
  found: '#04271d',
  bad: '#3d0c0c',
  dim: '#8f8f8f',
  swap: '#1a1640',
  path: '#3a2000',
};

const GLOW: ItemState[] = ['active', 'found', 'swap'];


export type Cam = { s: number; tx: number; ty: number };
export type Box = { x0: number; x1: number; y0: number; y1: number };

/** Scale and centre `ext` (unscaled screen px) inside `reg`. */
export function fitCam(ext: Box, reg: Box, max = 2.2): Cam {
  const s = Math.min(max, (reg.x1 - reg.x0) / Math.max(1, ext.x1 - ext.x0), (reg.y1 - reg.y0) / Math.max(1, ext.y1 - ext.y0));
  return { s, tx: (reg.x0 + reg.x1) / 2 - (s * (ext.x0 + ext.x1)) / 2, ty: (reg.y0 + reg.y1) / 2 - (s * (ext.y0 + ext.y1)) / 2 };
}

export const toScreen = (c: Cam, p: [number, number]): [number, number] => [c.tx + c.s * p[0], c.ty + c.s * p[1]];

/** Bounding box of projected corners. */
export function extent(points: [number, number][]): Box {
  return {
    x0: Math.min(...points.map((p) => p[0])),
    x1: Math.max(...points.map((p) => p[0])),
    y0: Math.min(...points.map((p) => p[1])),
    y1: Math.max(...points.map((p) => p[1])),
  };
}

/** Region of the stage left free for the scene, leaving room for HUD panels and the note pill. */
export function region(hasPanels: boolean, top = 52, bottom = 56): Box {
  return { x0: 36, x1: IW - 36 - (hasPanels ? 178 : 0), y0: top, y1: IH - bottom };
}

const pos = (x: number, y: number): CSSProperties => ({ transform: `translate(${r2(x)}px, ${r2(y)}px)` });

/** A group that glides to (x, y). Falls back to the transform attribute where CSS transforms are not applied. */
export function At({ x, y, children, className = 'lx-slide' }: { x: number; y: number; children: ReactNode; className?: string }) {
  return (
    <g className={className} transform={`translate(${r2(x)} ${r2(y)})`} style={pos(x, y)}>
      {children}
    </g>
  );
}

export function World({ cam, children }: { cam: Cam; children: ReactNode }) {
  return (
    <g
      className="lx-cam"
      transform={`translate(${r2(cam.tx)} ${r2(cam.ty)}) scale(${r2(cam.s * 1000) / 1000})`}
      style={{ transform: `translate(${r2(cam.tx)}px, ${r2(cam.ty)}px) scale(${cam.s})` }}
    >
      {children}
    </g>
  );
}

const poly = (pts: [number, number][]) => `M${pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join(' L')} Z`;

type Pt = [number, number];

/** Corner radius for the top surface of blocks, in scene px at camera scale 1. */
const CORNER = 2.6;

/**
 * Round a convex polygon: pull every edge inward by r, so that stroking the result with width 2r and a round join
 * gives back the original outline with rounded corners. r is clamped so thin faces (slabs) do not collapse.
 */
function insetPoly(pts: Pt[], r: number): { pts: Pt[]; r: number } {
  const n = pts.length;
  const area = Math.abs(pts.reduce((acc, p, i) => acc + (p[0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * p[1]), 0)) / 2;
  const longest = Math.max(...pts.map((p, i) => Math.hypot(pts[(i + 1) % n][0] - p[0], pts[(i + 1) % n][1] - p[1])));
  const rr = Math.max(0, Math.min(r, (0.3 * area) / Math.max(longest, 1)));
  const cx = pts.reduce((acc, p) => acc + p[0], 0) / n;
  const cy = pts.reduce((acc, p) => acc + p[1], 0) / n;
  // Each edge as a point on its inward-shifted line plus a direction.
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const dx = (q[0] - p[0]) / len;
    const dy = (q[1] - p[1]) / len;
    let nx = -dy;
    let ny = dx;
    if (nx * (cx - p[0]) + ny * (cy - p[1]) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: p[0] + nx * rr, y: p[1] + ny * rr, dx, dy };
  });
  const out = pts.map((_, i) => {
    const l1 = lines[(i + n - 1) % n];
    const l2 = lines[i];
    const det = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(det) < 1e-6) return [l2.x, l2.y] as Pt;
    const t = ((l2.x - l1.x) * l2.dy - (l2.y - l1.y) * l2.dx) / det;
    return [l1.x + l1.dx * t, l1.y + l1.dy * t] as Pt;
  });
  return { pts: out, r: rr };
}

function Face({ d, fill, stroke }: { d: string; fill: string; stroke: string }) {
  return (
    <path
      className="lx-face"
      d={d}
      style={{ d: `path("${d}")`, fill, stroke }}
      strokeWidth={1}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

type FaceSpec = { pts: Pt[]; fill: string };

/**
 * Side faces of a block whose top surface has rounded corners. They are the rounded top outline swept straight down,
 * so the sides wrap around the top instead of ending in sharp corners that poke out beside it.
 * Left and right faces split at the front corner. `dy` is the block height in px.
 */
function wrapSides(topPts: Pt[], r: number, dy: number): { left: string; right: string } {
  const { pts, r: rr } = insetPoly(topPts, r);
  const [, R, B, L] = pts;
  const cx = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
  const cy = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;
  const outward = (p: Pt, q: Pt): Pt => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    let nx = -(q[1] - p[1]) / len;
    let ny = (q[0] - p[0]) / len;
    if (nx * (cx - p[0]) + ny * (cy - p[1]) > 0) {
      nx = -nx;
      ny = -ny;
    }
    return [nx, ny];
  };
  const nLB = outward(L, B);
  const nBR = outward(B, R);
  const at = (p: Pt, n: Pt): Pt => [p[0] + n[0] * rr, p[1] + n[1] * rr];
  const Lm: Pt = [L[0] - rr, L[1]];
  const a1 = at(L, nLB);
  const a2 = at(B, nLB);
  const Bm: Pt = [B[0], B[1] + rr];
  const b1 = at(B, nBR);
  const b2 = at(R, nBR);
  const Rm: Pt = [R[0] + rr, R[1]];
  const f = (p: Pt, down = 0) => `${r2(p[0])} ${r2(p[1] + down)}`;
  const arc = (to: Pt, sweep: 0 | 1, down = 0) => `A${r2(rr)} ${r2(rr)} 0 0 ${sweep} ${f(to, down)}`;
  return {
    left: `M${f(Lm)} ${arc(a1, 0)} L${f(a2)} ${arc(Bm, 0)} L${f(Bm, dy)} ${arc(a2, 1, dy)} L${f(a1, dy)} ${arc(Lm, 1, dy)} Z`,
    right: `M${f(Bm)} ${arc(b1, 0)} L${f(b2)} ${arc(Rm, 0)} L${f(Rm, dy)} ${arc(b2, 1, dy)} L${f(b1, dy)} ${arc(Bm, 1, dy)} Z`,
  };
}


/**
 * Faces with rounded corners, used for the top surface of a block. All outlines go down first in the edge colour, then the fills sit on top,
 * 0.5 px smaller on each side, so a thin dark seam stays between faces and around the silhouette.
 */
function RoundFaces({ faces, edge }: { faces: FaceSpec[]; edge: string }) {
  const shapes = faces.map((f) => {
    const { pts, r } = insetPoly(f.pts, CORNER);
    return { d: poly(pts), r, fill: f.fill, pts };
  });
  return (
    <>
      {shapes.map((f, i) => (
        <path key={`o${i}`} className="lx-face" d={f.d} style={{ d: `path("${f.d}")`, fill: edge, stroke: edge }} strokeWidth={2 * f.r} strokeLinejoin="round" />
      ))}
      {shapes.map((f, i) => (
        <path key={`f${i}`} className="lx-face" d={f.d} style={{ d: `path("${f.d}")`, fill: f.fill, stroke: f.fill }} strokeWidth={Math.max(0.1, 2 * f.r - 1)} strokeLinejoin="round" />
      ))}
    </>
  );
}

const labelSize = (s: string) => (s.length <= 1 ? 17 : s.length === 2 ? 15 : s.length === 3 ? 12.5 : s.length === 4 ? 10.5 : 8.5);

/**
 * An isometric box centred on a base point (grid units w x d, height h). `lift` raises it off the floor.
 * Label is drawn upright on the middle of the top face.
 */
export function Prism({
  w,
  d,
  h,
  lift = 0,
  state = 'normal',
  color,
  label,
  fontSize,
  shadow = true,
  shadowZ = 0,
  enter = true,
}: {
  w: number;
  d: number;
  h: number;
  lift?: number;
  state?: ItemState;
  color?: string;
  label?: string | number;
  fontSize?: number;
  shadow?: boolean;
  /** Height of the surface the soft shadow lands on. A block that rises above it leaves its shadow behind. */
  shadowZ?: number;
  /** New blocks rise into place. Turn off when a parent already animates the entrance. */
  enter?: boolean;
}) {
  const base = color ?? BLOCK_COLOR[state];
  const hw = w / 2;
  const hd = d / 2;
  const P = (gx: number, gy: number, z: number) => proj(gx, gy, z + lift);
  const topPts: Pt[] = [P(-hw, -hd, h), P(hw, -hd, h), P(hw, hd, h), P(-hw, hd, h)];
  const sides = wrapSides(topPts, CORNER, h * U);
  // Bevel: a light line along the two front edges of the (rounded) top face.
  const tr = insetPoly(topPts, CORNER).pts;
  const rim = `M${tr[3].map(r2).join(' ')} L${tr[2].map(r2).join(' ')} L${tr[1].map(r2).join(' ')}`;
  const edge = shade(base, -0.55);
  const text = label === undefined ? undefined : String(label);
  const [, ty] = proj(0, 0, h + lift);
  const glow = GLOW.includes(state);
  const pad = 0.2;
  const sz = shadowZ;
  const shade0 = poly([proj(-hw - pad, -hd - pad, sz), proj(hw + pad, -hd - pad, sz), proj(hw + pad, hd + pad, sz), proj(-hw - pad, hd + pad, sz)]);
  const lifted = Math.max(0, lift - sz);
  return (
    <g className={enter ? 'lx-rise lx-halo' : 'lx-halo'} style={halo(glow, base)}>
      {shadow ? (
        <path d={shade0} style={{ d: `path("${shade0}")`, opacity: Math.max(0.45, 1 - lifted * 1.6) }} className="lx-face" fill="url(#lx-iso-shadow)" />
      ) : null}
      <Face d={sides.left} fill={shade(base, -0.28)} stroke={edge} />
      <Face d={sides.right} fill={shade(base, -0.48)} stroke={edge} />
      <RoundFaces edge={edge} faces={[{ pts: topPts, fill: shade(base, 0.2) }]} />
      <path
        className="lx-face"
        d={rim}
        style={{ d: `path("${rim}")`, stroke: shade(base, 0.55) }}
        fill="none"
        strokeWidth={1}
        strokeOpacity={0.55}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {text ? (
        <text
          x={0}
          y={0}
          transform={`translate(0 ${r2(ty + 0.5)})`}
          className="lx-lift"
          style={{ ...MONO, transform: `translateY(${r2(ty + 0.5)}px)` }}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize ?? labelSize(text)}
          fontWeight={700}
          fill={INK[state]}
        >
          {text}
        </text>
      ) : null}
    </g>
  );
}

/** A short round pad: used for graph nodes. `r` is the screen radius at scale 1, `hgt` its height in px. */
export function Cylinder({ r, hgt, state = 'normal', label, fontSize }: { r: number; hgt: number; state?: ItemState; label?: string | number; fontSize?: number }) {
  const base = BLOCK_COLOR[state];
  const ry = r / 2;
  const edge = shade(base, -0.55);
  const side = `M${-r} ${-hgt} L${-r} 0 A${r} ${ry} 0 0 0 ${r} 0 L${r} ${-hgt} Z`;
  const text = label === undefined ? undefined : String(label);
  const glow = GLOW.includes(state);
  return (
    <g className="lx-halo" style={halo(glow, base)}>
      <ellipse cx={0} cy={2} rx={r + 6} ry={ry + 4} fill="url(#lx-iso-shadow)" />
      <path d={side} className="lx-face" style={{ fill: shade(base, -0.38), stroke: edge }} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <ellipse cx={0} cy={-hgt} rx={r} ry={ry} className="lx-face" style={{ fill: shade(base, 0.2), stroke: edge }} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path
        className="lx-face"
        d={`M${-r + 1} ${-hgt + 1.5} A${r - 1} ${ry - 1} 0 0 0 ${r - 1} ${-hgt + 1.5}`}
        style={{ stroke: shade(base, 0.55) }}
        fill="none"
        strokeWidth={1}
        strokeOpacity={0.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {text ? (
        <text
          x={0}
          y={-hgt + 0.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize ?? (text.length > 3 ? 9.5 : text.length > 2 ? 11 : 13)}
          fontWeight={700}
          fill={INK[state]}
          style={MONO}
        >
          {text}
        </text>
      ) : null}
    </g>
  );
}

/** Flat diamond on the floor spanning grid rectangle [gx0, gx1] x [gy0, gy1] at height z. */
export function Pad({
  gx0,
  gx1,
  gy0,
  gy1,
  z = 0,
  fill,
  stroke,
  dash,
  className = 'lx-face',
}: {
  gx0: number;
  gx1: number;
  gy0: number;
  gy1: number;
  z?: number;
  fill: string;
  stroke: string;
  dash?: string;
  className?: string;
}) {
  const d = poly([proj(gx0, gy0, z), proj(gx1, gy0, z), proj(gx1, gy1, z), proj(gx0, gy1, z)]);
  return (
    <path
      className={className}
      d={d}
      style={{ d: `path("${d}")`, fill, stroke }}
      strokeWidth={1.2}
      strokeDasharray={dash}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** A slab: a low, wide dark box with the same faces as a block. */
export function Slab({ gx0, gx1, gy0, gy1, z = 0.16 }: { gx0: number; gx1: number; gy0: number; gy1: number; z?: number }) {
  const cx = (gx0 + gx1) / 2;
  const cy = (gy0 + gy1) / 2;
  const [x, y] = proj(cx, cy, 0);
  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`}>
      <Prism w={gx1 - gx0} d={gy1 - gy0} h={z} color="#2c2c2c" shadow={false} />
    </g>
  );
}

/** Pointer or name tag in screen space: stays the same size whatever the camera scale. */
export function Pin({ at, text, color = ACCENT, up = false }: { at: [number, number]; text: string; color?: string; up?: boolean }) {
  return (
    <At x={at[0]} y={at[1]}>
      <Tag x={0} y={0} text={text} color={color} up={up} />
    </At>
  );
}

export function Note({ note, frameKey }: { note?: Note; frameKey: string }) {
  if (!note) return null;
  return <Pill key={`${frameKey}-note`} x={IW / 2} y={IH - 16} text={note.text} tone={pillTone(note.tone)} className="lx-fade" />;
}

/** Stage chrome: iso lattice floor, optional HUD panels and the note pill. */
export function IsoStage({
  label,
  panels,
  note,
  frameKey,
  children,
}: {
  label: string;
  panels?: Panel[];
  note?: Note;
  frameKey: string;
  children: ReactNode;
}) {
  const list = panels ?? [];
  return (
    <svg viewBox={`0 0 ${IW} ${IH}`} className="block size-full" role="img" aria-label={label}>
      <defs>
        <pattern id="lx-iso-lattice" width="60" height="30" patternUnits="userSpaceOnUse">
          <path d="M0 0 L60 30 M0 30 L60 0" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
        </pattern>
        <radialGradient id="lx-iso-fade" cx="50%" cy="48%" r="62%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="65%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="lx-iso-mask">
          <rect width={IW} height={IH} fill="url(#lx-iso-fade)" />
        </mask>
        <radialGradient id="lx-iso-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#000" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lx-iso-glow" cx="50%" cy="46%" r="55%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.07" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={IW} height={IH} fill="url(#lx-iso-glow)" />
      <rect width={IW} height={IH} fill="url(#lx-iso-lattice)" mask="url(#lx-iso-mask)" />
      {children}
      <Panels panels={list} x={IW - 24 - 156} y={26} w={156} h={IH - 84} />
      <Note note={note} frameKey={frameKey} />
    </svg>
  );
}
