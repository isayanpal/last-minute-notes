'use client';

import type { SceneProps } from '../types';
import { ArrowHead, ITEM_STYLE, MONO, TONE_COLOR } from './common';
import type { GraphNode, GraphState } from './graph';
import { At, Cylinder, IH, IW, IsoStage, Pin, Prism, U, r2 } from './iso-core';

/**
 * Isometric graph engine. Same state as the 2D graph engine: nodes keep their 0..10 x 0..6 layout,
 * but stand on the floor as short pillars (circle) or blocks (box), joined by lines drawn on the floor.
 */

const R = 22;
const RY = R / 2;
const HGT = 16;

export function IsoGraphScene({ state, frameKey }: SceneProps<GraphState>) {
  const panels = state.panels ?? [];
  const left = 52;
  const right = IW - 48 - (panels.length ? 178 : 0);
  const top = 78;
  const bottom = IH - 86;
  const px = (x: number) => left + (x / 10) * (right - left);
  const py = (y: number) => top + (y / 6) * (bottom - top);
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  const ordered = [...state.nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  const boxHalf = (n: GraphNode) => (n.shape === 'box' ? { rx: 0.8 * U + 1, ry: 0.4 * U + 0.5 } : { rx: R, ry: RY });

  return (
    <IsoStage label="Graph diagram" panels={panels} note={state.note} frameKey={frameKey}>
      {(state.edges ?? []).map((e) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        const x1 = px(a.x);
        const y1 = py(a.y);
        const x2 = px(b.x);
        const y2 = py(b.y);
        const bend = (e.curve ?? 0) * ((right - left) / 10);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const ux = (x2 - x1) / len;
        const uy = (y2 - y1) / len;
        const mx = (x1 + x2) / 2 - uy * bend;
        const my = (y1 + y2) / 2 + ux * bend;
        const trim = (n: GraphNode, fx: number, fy: number, tx: number, ty: number) => {
          const d = Math.hypot(tx - fx, ty - fy) || 1;
          const dx = (tx - fx) / d;
          const dy = (ty - fy) / d;
          const { rx, ry } = boxHalf(n);
          const t = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
          return [fx + dx * (t + 3), fy + dy * (t + 3)];
        };
        const [sx1, sy1] = trim(a, x1, y1, mx, my);
        const [sx2, sy2] = trim(b, x2, y2, mx, my);
        const st = e.state ?? 'normal';
        const color = st === 'normal' ? 'rgba(255,255,255,0.32)' : ITEM_STYLE[st].stroke;
        const d = bend ? `M${r2(sx1)} ${r2(sy1)} Q${r2(mx)} ${r2(my)} ${r2(sx2)} ${r2(sy2)}` : `M${r2(sx1)} ${r2(sy1)} L${r2(sx2)} ${r2(sy2)}`;
        return (
          <g key={`${e.from}-${e.to}`} className="lx-key" style={{ opacity: st === 'dim' ? 0.35 : 1 }}>
            <path d={d} fill="none" stroke={color} strokeWidth={st === 'normal' ? 2 : 3} className="lx-key" strokeLinecap="round" />
            {e.directed ? <ArrowHead x1={bend ? mx : sx1} y1={bend ? my : sy1} x2={sx2} y2={sy2} color={color} /> : null}
            {e.label ? (
              <g>
                <rect x={(bend ? mx : (x1 + x2) / 2) - e.label.length * 3.4 - 5} y={(bend ? my : (y1 + y2) / 2) - 8} width={e.label.length * 6.8 + 10} height={16} rx={5} fill="#0b0b0b" stroke={color} />
                <text x={bend ? mx : (x1 + x2) / 2} y={(bend ? my : (y1 + y2) / 2) + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#d4d4d4" style={MONO}>
                  {e.label}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {ordered.map((n) => (
        <At key={n.id} x={px(n.x)} y={py(n.y)}>
          <g className="lx-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
            {n.shape === 'box' ? (
              <Prism w={0.8} d={0.8} h={HGT / U} state={n.state ?? 'normal'} label={n.label} enter={false} />
            ) : (
              <Cylinder r={R} hgt={HGT} state={n.state ?? 'normal'} label={n.label} />
            )}
          </g>
          {n.tag ? (
            <text key={`${frameKey}-t-${n.tag}`} y={RY + 18} textAnchor="middle" fontSize="10" fill="#a3a3a3" style={MONO} className="lx-fade">
              {n.tag}
            </text>
          ) : null}
        </At>
      ))}

      {(() => {
        const seen = new Map<string, number>();
        return (state.pointers ?? []).map((p) => {
          const n = byId.get(p.node);
          if (!n) return null;
          const slot = `${p.node}-${p.up ? 'u' : 'd'}`;
          const k = seen.get(slot) ?? 0;
          seen.set(slot, k + 1);
          const color = TONE_COLOR[p.tone ?? 'accent'];
          const y = p.up ? py(n.y) - HGT - RY - 20 - k * 22 : py(n.y) + RY + (n.tag ? 34 : 20) + k * 22;
          return <Pin key={p.label} at={[px(n.x), y]} text={p.label} color={color} up={p.up} />;
        });
      })()}
    </IsoStage>
  );
}
