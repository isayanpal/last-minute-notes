'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { IsoCube, IsoFloor, Pill, SERVER_COLORS } from '../../iso';
import type { SceneProps } from '../../types';
import {
  KEYS,
  MOD_SERVERS,
  arcs,
  modOwner,
  ownerOf,
  sortMarkers,
  walk,
  type HashState,
  type Lookup,
  type ModState,
  type RingState,
} from './model';

const W = 640;
const H = 410;
const CX = 320;
const CY = 218;
const RX = 232;
const RY = 128;
const ACCENT = '#f5d547';

const vars = (v: Record<string, string | number>) => v as CSSProperties;

function pt(angle: number, rx = RX, ry = RY): [number, number] {
  const r = (angle * Math.PI) / 180;
  return [CX + rx * Math.sin(r), CY - ry * Math.cos(r)];
}

function arcPath(from: number, to: number): string {
  const steps = Math.max(2, Math.ceil((to - from) / 2));
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const [x, y] = pt(from + ((to - from) * i) / steps);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d.trim();
}

const cubeSize = (small?: boolean) => (small ? 14 : 24);
const cubeTop = (y: number, small?: boolean) => y - cubeSize(small) * 0.92 - cubeSize(small) * 0.58;

function RingLookup({ lookup, state, frameKey }: { lookup: Lookup; state: RingState; frameKey: string }) {
  const hops = walk(state.markers, lookup.angle, lookup.replicas ?? 1);
  if (!hops.length) return null;
  const total = Math.max(hops[hops.length - 1].distance, 4);
  const dur = 0.6 + (total / 360) * 1.8;
  const [kx, ky] = pt(lookup.angle);
  const [lx, ly] = pt(lookup.angle, RX + 52, RY + 40);
  const label = `key @ ${Math.round(lookup.angle)}°`;

  if (state.client) {
    const owner = hops[0].marker;
    const [sx, sy] = pt(owner.angle);
    const ty = cubeTop(sy, state.small) - 4;
    const path = `M${CX} ${CY - 26} L${sx.toFixed(1)} ${ty.toFixed(1)}`;
    return (
      <g key={frameKey}>
        <circle cx={kx} cy={ky} r="6" fill="#0b0b0b" stroke={ACCENT} strokeWidth="2" className="lx-pop" style={{ transformOrigin: `${kx}px ${ky}px` }} />
        <Pill x={lx} y={ly} text={label} tone="accent" className="lx-fade" />
        <path d={path} pathLength={1} className="lx-draw" stroke={ACCENT} strokeWidth="2" strokeDasharray="1" fill="none" style={vars({ '--dur': '0.7s' })} />
        <MoverDot path={path} dur={0.7} />
      </g>
    );
  }

  const path = arcPath(lookup.angle, lookup.angle + total);
  return (
    <g key={frameKey}>
      <path
        d={path}
        pathLength={1}
        className="lx-draw"
        stroke={ACCENT}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        style={vars({ '--dur': `${dur}s` })}
      />
      <circle cx={kx} cy={ky} r="6.5" fill="#0b0b0b" stroke={ACCENT} strokeWidth="2.5" className="lx-pop" style={{ transformOrigin: `${kx}px ${ky}px` }} />
      <Pill x={lx} y={ly} text={label} tone="accent" className="lx-fade" />
      <MoverDot path={path} dur={dur} />
      {(lookup.replicas ?? 1) > 1
        ? (() => {
            let n = 0;
            return hops.map((h) => {
              const [x, y] = pt(h.marker.angle);
              const delay = (h.distance / total) * dur;
              const text = h.skipped ? 'skip, same server' : `copy ${++n}`;
              return (
                <Pill
                  key={h.marker.id}
                  x={x}
                  y={cubeTop(y, state.small) - 16}
                  text={text}
                  tone={h.skipped ? 'neutral' : 'accent'}
                  className="lx-fade"
                  style={vars({ animationDelay: `${delay}s` })}
                />
              );
            });
          })()
        : null}
    </g>
  );
}

/**
 * Dot that rides along `path` once. SMIL begin times are document relative, so the motion is started
 * explicitly on mount. SMIL also pauses with svg.pauseAnimations(), which the player uses.
 */
function MoverDot({ path, dur }: { path: string; dur: number }) {
  const ref = useRef<SVGAnimateMotionElement>(null);
  useEffect(() => {
    ref.current?.beginElement();
  }, []);
  return (
    <circle r="5.5" fill={ACCENT} className="lx-glow">
      <animateMotion ref={ref} dur={`${dur}s`} begin="indefinite" fill="freeze" path={path} />
    </circle>
  );
}

function RingScene({ state, frameKey }: { state: RingState; frameKey: string }) {
  const markers = sortMarkers(state.markers);
  const moved = new Set<number>();
  if (state.baseline && state.showKeys) {
    for (const k of KEYS) {
      if (ownerOf(state.baseline, k.angle) !== ownerOf(markers, k.angle)) moved.add(k.id);
    }
  }
  const cubes = markers
    .map((m) => ({ m, p: pt(m.angle) }))
    .sort((a, b) => a.p[1] - b.p[1]);
  const [topX, topY] = pt(0);

  return (
    <>
      {/* Ring slab */}
      <ellipse cx={CX} cy={CY + 8} rx={RX} ry={RY} fill="none" stroke="#151515" strokeWidth="16" />
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
      <line x1={topX} y1={topY - 9} x2={topX} y2={topY + 9} stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <Pill x={topX} y={topY - 30} text="hash ring · 0 → 2³²" />

      {state.showArcs
        ? arcs(markers).map((a) => (
            <path
              key={`${a.marker.id}-${a.from.toFixed(1)}`}
              d={arcPath(a.from + 1.2, a.to)}
              stroke={SERVER_COLORS[a.marker.server]}
              strokeWidth="7"
              strokeOpacity="0.55"
              fill="none"
              className="lx-fade"
            />
          ))
        : null}

      {state.showKeys
        ? KEYS.map((k) => {
            const [x, y] = pt(k.angle);
            const owner = ownerOf(markers, k.angle);
            const color = owner ? SERVER_COLORS[owner] : '#737373';
            return (
              <g key={k.id}>
                {moved.has(k.id) ? (
                  <circle
                    key={`${frameKey}-m`}
                    cx={x}
                    cy={y}
                    r="9"
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth="2"
                    className="lx-moved"
                  />
                ) : null}
                <circle cx={x} cy={y} r="4.5" fill={color} stroke="#0b0b0b" strokeWidth="1.5" className="lx-key lx-fade" />
              </g>
            );
          })
        : null}

      {state.client ? (
        <g className="lx-pop" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          <IsoCube x={CX} y={CY + 6} color="#8a8a8a" size={20} label="app" />
          <Pill x={CX} y={CY + 42} text="client hashes the key itself" />
        </g>
      ) : null}

      {cubes.map(({ m, p }) => (
        <IsoCube
          key={m.id}
          x={p[0]}
          y={p[1]}
          color={SERVER_COLORS[m.server]}
          label={m.server}
          size={cubeSize(state.small)}
          failing={m.failing}
          className="lx-pop"
        />
      ))}

      {(state.lookups ?? []).map((l, i) => (
        <RingLookup key={`${frameKey}-${i}`} lookup={l} state={state} frameKey={`${frameKey}-${i}`} />
      ))}
    </>
  );
}

function ModScene({ state, frameKey }: { state: ModState; frameKey: string }) {
  const n = state.n;
  const y = 316;
  const sx = (i: number) => CX + (i - (n - 1) / 2) * 112;
  const buckets: number[][] = Array.from({ length: n }, () => []);
  for (const k of KEYS) buckets[modOwner(k.hash, n)].push(k.id);
  const slot = new Map<number, { x: number; y: number; server: number }>();
  buckets.forEach((ids, s) => {
    ids.forEach((id, j) => {
      slot.set(id, { x: sx(s) + ((j % 3) - 1) * 16, y: y - 74 - Math.floor(j / 3) * 16, server: s });
    });
  });

  return (
    <>
      <Pill x={CX} y={70} text={`server = hash(key) % ${n}`} tone="accent" />
      {MOD_SERVERS.slice(0, n).map((s, i) => (
        <g key={s}>
          <IsoCube x={sx(i)} y={y} color={SERVER_COLORS[s]} label={s} size={26} className="lx-pop" />
          <text x={sx(i)} y={y + 36} textAnchor="middle" fontSize="10" fill="#8a8a8a" style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}>
            % {n} = {i}
          </text>
        </g>
      ))}
      {KEYS.map((k) => {
        const p = slot.get(k.id)!;
        const moved = state.baselineN !== undefined && modOwner(k.hash, state.baselineN) !== p.server;
        return (
          <g key={k.id} className="lx-slide" style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
            {moved ? <circle key={`${frameKey}-m`} r="8.5" fill="none" stroke={ACCENT} strokeWidth="2" className="lx-moved" /> : null}
            <circle r="5" fill={SERVER_COLORS[MOD_SERVERS[p.server]]} stroke="#0b0b0b" strokeWidth="1.5" className="lx-key" />
          </g>
        );
      })}
    </>
  );
}

export function HashScene({ state, frameKey }: SceneProps<HashState>) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Consistent hashing diagram">
      <IsoFloor id="ch" cx={CX} cy={CY + 20} w={W} h={H + 40} />
      {state.mode === 'mod' ? <ModScene state={state} frameKey={frameKey} /> : <RingScene state={state} frameKey={frameKey} />}
      {state.note ? <Pill key={`${frameKey}-note`} x={CX} y={H - 14} text={state.note.text} tone={state.note.tone} className="lx-fade" /> : null}
    </svg>
  );
}
