'use client';

import type { BaseState, SceneProps } from '../types';
import { ArrowHead, H, ITEM_STYLE, MONO, NoteLayer, Panels, Stage, TONE_COLOR, Tag, W, type ItemState, type Panel, type PaintTone } from './common';

/**
 * Grid engine for DP tables, matrices, boards and 2D BFS.
 * Cell states are keyed "row,col". null cells render as empty, not yet computed.
 */

export type GridState = BaseState & {
  cells: (string | number | null)[][];
  rowHeaders?: string[];
  colHeaders?: string[];
  states?: Record<string, ItemState>;
  /** Dependency arrows between cell centres, e.g. dp[i][j] reads dp[i-1][j]. */
  arrows?: { from: [number, number]; to: [number, number]; tone?: PaintTone }[];
  pointers?: { r: number; c: number; label: string; tone?: PaintTone }[];
  panels?: Panel[];
  /** Caption above the grid, e.g. "dp[i][j] = longest common subsequence". */
  title?: string;
};

export function GridScene({ state, frameKey }: SceneProps<GridState>) {
  const panels = state.panels ?? [];
  const panelW = panels.length ? 150 : 0;
  const rows = state.cells.length;
  const cols = Math.max(1, ...state.cells.map((r) => r.length));
  const headL = state.rowHeaders ? 44 : 0;
  const headT = state.colHeaders ? 24 : 0;
  const areaL = 36 + headL;
  const areaR = W - 32 - (panelW ? panelW + 18 : 0);
  const areaT = 40 + (state.title ? 22 : 0) + headT;
  const areaB = H - 64;
  const size = Math.min(46, (areaR - areaL) / cols, (areaB - areaT) / rows);
  const gx = areaL + (areaR - areaL - size * cols) / 2;
  const gy = areaT + (areaB - areaT - size * rows) / 2;
  const cx = (c: number) => gx + c * size + size / 2;
  const cy = (r: number) => gy + r * size + size / 2;
  const font = size < 26 ? 9.5 : size < 36 ? 11 : 13;

  return (
    <Stage label="Grid diagram">
      {state.title ? (
        <text x={(areaL + areaR) / 2} y={gy - headT - 14} textAnchor="middle" fontSize="11" fill="#a3a3a3" style={MONO}>
          {state.title}
        </text>
      ) : null}
      {(state.colHeaders ?? []).map((h, c) => (
        <text key={`ch${c}`} x={cx(c)} y={gy - 9} textAnchor="middle" fontSize="10" fill="#8a8a8a" style={MONO}>
          {h}
        </text>
      ))}
      {(state.rowHeaders ?? []).map((h, r) => (
        <text key={`rh${r}`} x={gx - 10} y={cy(r) + 0.5} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#8a8a8a" style={MONO}>
          {h}
        </text>
      ))}
      {state.cells.map((row, r) =>
        row.map((v, c) => {
          const st = ITEM_STYLE[state.states?.[`${r},${c}`] ?? 'normal'];
          const empty = v === null;
          return (
            <g key={`${r},${c}`}>
              <rect
                x={gx + c * size + 2}
                y={gy + r * size + 2}
                width={size - 4}
                height={size - 4}
                rx={Math.min(7, size / 6)}
                fill={empty ? 'transparent' : st.fill}
                stroke={empty ? 'rgba(255,255,255,0.1)' : st.stroke}
                strokeDasharray={empty ? '3 3' : undefined}
                strokeWidth="1.4"
                className="lx-key"
                style={st.glow ? { filter: `drop-shadow(0 0 6px ${st.stroke}88)` } : undefined}
              />
              {empty ? null : (
                <text
                  key={`${frameKey}-${String(v)}`}
                  x={cx(c)}
                  y={cy(r) + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={font}
                  fontWeight={600}
                  fill={st.text}
                  style={MONO}
                  className="lx-fade"
                >
                  {v}
                </text>
              )}
            </g>
          );
        }),
      )}
      {(state.arrows ?? []).map((a, i) => {
        const [r1, c1] = a.from;
        const [r2, c2] = a.to;
        const x1 = cx(c1);
        const y1 = cy(r1);
        const x2 = cx(c2);
        const y2 = cy(r2);
        const d = Math.hypot(x2 - x1, y2 - y1) || 1;
        const pad = size * 0.32;
        const sx1 = x1 + ((x2 - x1) / d) * pad;
        const sy1 = y1 + ((y2 - y1) / d) * pad;
        const sx2 = x2 - ((x2 - x1) / d) * pad;
        const sy2 = y2 - ((y2 - y1) / d) * pad;
        const color = TONE_COLOR[a.tone ?? 'accent'];
        return (
          <g key={`${frameKey}-a${i}`} className="lx-fade">
            <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={color} strokeWidth="2" />
            <ArrowHead x1={sx1} y1={sy1} x2={sx2} y2={sy2} color={color} size={6} />
          </g>
        );
      })}
      {(state.pointers ?? []).map((p) => (
        <g key={p.label} className="lx-slide" style={{ transform: `translate(${cx(p.c)}px, ${gy + (p.r + 1) * size + 12}px)` }}>
          <Tag x={0} y={0} text={p.label} color={TONE_COLOR[p.tone ?? 'accent']} />
        </g>
      ))}
      <Panels panels={panels} x={W - 24 - panelW} y={30} w={panelW} h={H - 76} />
      <NoteLayer note={state.note} frameKey={frameKey} />
    </Stage>
  );
}
