'use client';

import type { BaseState, SceneProps } from '../types';
import { H, MONO, NoteLayer, halo, Stage, TONE_COLOR, W, textW, type PaintTone } from './common';

/**
 * Timeline engine: horizontal lanes with bars over a shared axis.
 * Fits intervals, latency waterfalls, request timings, deploy phases, error budgets.
 */

export type TimelineBar = {
  from: number;
  to: number;
  label?: string;
  tone?: PaintTone;
  /** Keep the same id across frames so a bar glides instead of popping. */
  id?: string;
  state?: 'normal' | 'dim' | 'active' | 'bad';
};

export type TimelineState = BaseState & {
  from: number;
  to: number;
  unit?: string;
  /** Axis tick values. Defaults to 5 evenly spaced ticks. */
  ticks?: number[];
  lanes: { label: string; bars: TimelineBar[] }[];
  /** Vertical lines across all lanes, e.g. p99, a deadline, a deploy. */
  markers?: { at: number; label: string; tone?: PaintTone }[];
};

export function TimelineScene({ state, frameKey }: SceneProps<TimelineState>) {
  const labelW = Math.min(140, Math.max(60, ...state.lanes.map((l) => textW(l.label, 10.5) + 18)));
  const x0 = 28 + labelW;
  const x1 = W - 34;
  const top = 50;
  const axisY = H - 62;
  const laneH = Math.min(44, (axisY - top - 8) / Math.max(state.lanes.length, 1));
  const span = state.to - state.from || 1;
  const X = (v: number) => x0 + ((v - state.from) / span) * (x1 - x0);
  const ticks = state.ticks ?? Array.from({ length: 5 }, (_, i) => state.from + (span * i) / 4);
  const fmt = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}${state.unit ?? ''}`;
  const barH = Math.min(24, laneH - 10);

  return (
    <Stage label="Timeline diagram">
      {ticks.map((t) => (
        <g key={`t${t}`}>
          <line x1={X(t)} y1={top - 6} x2={X(t)} y2={axisY} stroke="rgba(255,255,255,0.06)" />
          <text x={X(t)} y={axisY + 16} textAnchor="middle" fontSize="9.5" fill="#737373" style={MONO}>
            {fmt(t)}
          </text>
        </g>
      ))}
      <line x1={x0} y1={axisY} x2={x1} y2={axisY} stroke="rgba(255,255,255,0.25)" />

      {state.lanes.map((lane, li) => {
        const y = top + li * laneH + laneH / 2;
        return (
          <g key={`${lane.label}-${li}`}>
            <text x={x0 - 12} y={y + 0.5} textAnchor="end" dominantBaseline="middle" fontSize="10.5" fill="#a3a3a3" style={MONO}>
              {lane.label}
            </text>
            <line x1={x0} y1={y} x2={x1} y2={y} stroke="rgba(255,255,255,0.05)" />
            {lane.bars.map((b, bi) => {
              const color = b.state === 'bad' ? TONE_COLOR.bad : TONE_COLOR[b.tone ?? 'info'];
              const bx = X(b.from);
              const bw = Math.max(3, X(b.to) - X(b.from));
              const inside = b.label && textW(b.label, 10) + 10 < bw;
              return (
                <g key={b.id ?? `${li}-${bi}`} style={{ opacity: b.state === 'dim' ? 0.3 : 1 }} className="lx-key">
                  <rect
                    className="lx-geom lx-grow lx-halo"
                    x={bx}
                    y={y - barH / 2}
                    width={bw}
                    height={barH}
                    rx={5}
                    fill={`${color}33`}
                    stroke={color}
                    strokeWidth={b.state === 'active' ? 2.2 : 1.4}
                    style={halo(b.state === 'active', color, 6)}
                  />
                  {b.label ? (
                    <text
                      key={`${frameKey}-${b.label}`}
                      x={inside ? bx + bw / 2 : bx + bw + 6}
                      y={y + 0.5}
                      textAnchor={inside ? 'middle' : 'start'}
                      dominantBaseline="middle"
                      fontSize="10"
                      fill={inside ? '#f5f5f5' : color}
                      style={MONO}
                      className="lx-fade"
                    >
                      {b.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}

      {(state.markers ?? []).map((m) => {
        const color = TONE_COLOR[m.tone ?? 'accent'];
        const w = textW(m.label, 10) + 12;
        return (
          <g key={`${frameKey}-${m.label}`} className="lx-fade">
            <line x1={X(m.at)} y1={top - 14} x2={X(m.at)} y2={axisY} stroke={color} strokeWidth="1.5" strokeDasharray="4 4" />
            <rect x={X(m.at) - w / 2} y={top - 30} width={w} height={16} rx={8} fill="#0b0b0b" stroke={color} />
            <text x={X(m.at)} y={top - 21.5} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={color} style={MONO}>
              {m.label}
            </text>
          </g>
        );
      })}

      <NoteLayer note={state.note} frameKey={frameKey} />
    </Stage>
  );
}
