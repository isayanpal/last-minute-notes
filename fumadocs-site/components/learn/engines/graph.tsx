'use client';

import type { BaseState, SceneProps } from '../types';
import { ArrowHead, H, ITEM_STYLE, MONO, NoteLayer, Panels, Stage, TONE_COLOR, Tag, W, type ItemState, type Panel, type PaintTone } from './common';

/**
 * Graph engine for trees, linked lists, graphs, tries and decision trees.
 * Coordinates: x from 0 to 10, y from 0 to 6. Use the helpers in ./layouts for trees and lists.
 */

export type GraphNode = {
  id: string;
  label: string | number;
  x: number;
  y: number;
  state?: ItemState;
  /** Small text under the node, e.g. a distance, depth or count. */
  tag?: string;
  shape?: 'circle' | 'box';
};

export type GraphEdge = {
  from: string;
  to: string;
  directed?: boolean;
  label?: string;
  state?: ItemState;
  /** Bend the edge sideways, in graph units. Useful for back edges and cycles. */
  curve?: number;
};

export type GraphState = BaseState & {
  nodes: GraphNode[];
  edges?: GraphEdge[];
  /** Named markers attached to nodes: curr, prev, slow, fast, root. */
  pointers?: { node: string; label: string; tone?: PaintTone; up?: boolean }[];
  panels?: Panel[];
};

const R = 17;

export function GraphScene({ state, frameKey }: SceneProps<GraphState>) {
  const panels = state.panels ?? [];
  const panelW = panels.length ? 150 : 0;
  const left = 46;
  const right = W - 40 - (panelW ? panelW + 18 : 0);
  const top = 56;
  const bottom = H - 76;
  const px = (x: number) => left + (x / 10) * (right - left);
  const py = (y: number) => top + (y / 6) * (bottom - top);
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  const half = (n: GraphNode) => (n.shape === 'box' ? { w: 22, h: 15 } : { w: R, h: R });

  return (
    <Stage label="Graph diagram">
      {(state.edges ?? []).map((e) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        const x1 = px(a.x);
        const y1 = py(a.y);
        const x2 = px(b.x);
        const y2 = py(b.y);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const ux = (x2 - x1) / len;
        const uy = (y2 - y1) / len;
        const bend = (e.curve ?? 0) * ((right - left) / 10);
        const mx = (x1 + x2) / 2 - uy * bend;
        const my = (y1 + y2) / 2 + ux * bend;
        // Trim both ends to the node outline, along the direction toward the control point.
        const trim = (n: GraphNode, fx: number, fy: number, tx: number, ty: number) => {
          const d = Math.hypot(tx - fx, ty - fy) || 1;
          const h = half(n);
          const t = n.shape === 'box' ? Math.min(h.w / Math.abs((tx - fx) / d || 1e-6), h.h / Math.abs((ty - fy) / d || 1e-6)) : R;
          return [fx + ((tx - fx) / d) * (t + 2), fy + ((ty - fy) / d) * (t + 2)];
        };
        const [sx1, sy1] = trim(a, x1, y1, mx, my);
        const [sx2, sy2] = trim(b, x2, y2, mx, my);
        const st = e.state ?? 'normal';
        const color = st === 'normal' ? 'rgba(255,255,255,0.3)' : ITEM_STYLE[st].stroke;
        const d = bend ? `M${sx1} ${sy1} Q${mx} ${my} ${sx2} ${sy2}` : `M${sx1} ${sy1} L${sx2} ${sy2}`;
        const tipFromX = bend ? mx : sx1;
        const tipFromY = bend ? my : sy1;
        return (
          <g key={`${e.from}-${e.to}`} style={{ opacity: st === 'dim' ? 0.35 : 1 }}>
            <path d={d} fill="none" stroke={color} strokeWidth={st === 'normal' ? 1.6 : 2.4} className="lx-key" />
            {e.directed ? <ArrowHead x1={tipFromX} y1={tipFromY} x2={sx2} y2={sy2} color={color} /> : null}
            {e.label ? (
              <g>
                <rect x={(bend ? mx : (x1 + x2) / 2) - e.label.length * 3.4 - 5} y={(bend ? my : (y1 + y2) / 2) - 8} width={e.label.length * 6.8 + 10} height={16} rx={5} fill="#0b0b0b" stroke={color} strokeWidth="1" />
                <text x={bend ? mx : (x1 + x2) / 2} y={(bend ? my : (y1 + y2) / 2) + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#d4d4d4" style={MONO}>
                  {e.label}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {state.nodes.map((n) => {
        const st = ITEM_STYLE[n.state ?? 'normal'];
        const label = String(n.label);
        const font = label.length > 3 ? 10 : 12.5;
        return (
          <g key={n.id} className="lx-slide" style={{ transform: `translate(${px(n.x)}px, ${py(n.y)}px)` }}>
            <g className="lx-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              {n.shape === 'box' ? (
                <rect x={-22} y={-15} width={44} height={30} rx={7} fill={st.fill} stroke={st.stroke} strokeWidth="1.6" className="lx-key" style={st.glow ? { filter: `drop-shadow(0 0 6px ${st.stroke}88)` } : undefined} />
              ) : (
                <circle r={R} fill={st.fill} stroke={st.stroke} strokeWidth="1.6" className="lx-key" style={st.glow ? { filter: `drop-shadow(0 0 6px ${st.stroke}88)` } : undefined} />
              )}
              <text y={0.5} textAnchor="middle" dominantBaseline="middle" fontSize={font} fontWeight={600} fill={st.text} style={MONO}>
                {label}
              </text>
            </g>
            {n.tag ? (
              <text y={n.shape === 'box' ? 27 : 30} textAnchor="middle" fontSize="9.5" fill="#a3a3a3" style={MONO} className="lx-fade" key={`${frameKey}-t-${n.tag}`}>
                {n.tag}
              </text>
            ) : null}
          </g>
        );
      })}

      {(() => {
        const seen = new Map<string, number>();
        return (state.pointers ?? []).map((p) => {
          const n = byId.get(p.node);
          if (!n) return null;
          const slot = `${p.node}-${p.up ? 'u' : 'd'}`;
          const k = seen.get(slot) ?? 0;
          seen.set(slot, k + 1);
          const off = (n.shape === 'box' ? 15 : R) + (n.tag && !p.up ? 30 : 16) + k * 22;
          const y = p.up ? py(n.y) - off : py(n.y) + off;
          return (
            <g key={p.label} className="lx-slide" style={{ transform: `translate(${px(n.x)}px, ${y}px)` }}>
              <Tag x={0} y={0} text={p.label} color={TONE_COLOR[p.tone ?? 'accent']} up={p.up} />
            </g>
          );
        });
      })()}

      <Panels panels={panels} x={W - 24 - panelW} y={30} w={panelW} h={H - 76} />
      <NoteLayer note={state.note} frameKey={frameKey} />
    </Stage>
  );
}
