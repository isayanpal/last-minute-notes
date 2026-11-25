'use client';

import { Pill } from '../iso';
import type { BaseState, SceneProps, Tone } from '../types';
import { ACCENT, ITEM_STYLE, MONO, NoteLayer, halo, Panels, Stage, Tag, TONE_COLOR, W, H, type ItemState, type Panel, type PaintTone } from './common';

/**
 * Array engine: one to three rows of cells with pointers, a highlighted window, and side panels.
 * Give cells an `id` when values move (sorting, swapping) so they glide to their new slot.
 */

export type Cell = number | string | { v: number | string; id: string };

export type ArrayRow = {
  label?: string;
  cells: Cell[];
  /** Per index visual state. */
  states?: Record<number, ItemState>;
  /** Named markers under (or above with `up`) a cell, e.g. L, R, i, slow, fast. */
  pointers?: { i: number; label: string; tone?: PaintTone; up?: boolean }[];
  /** Bracket over an inclusive index range, e.g. a sliding window. */
  window?: { from: number; to: number; label?: string; tone?: Tone };
  /** Show index numbers above cells. Default true for the first row. */
  showIndex?: boolean;
  /** Draw as vertical bars sized by value instead of boxes. */
  bars?: boolean;
};

export type ArrayState = BaseState & {
  rows: ArrayRow[];
  panels?: Panel[];
};

const cellValue = (c: Cell) => (typeof c === 'object' ? c.v : c);
const cellKey = (c: Cell, i: number) => (typeof c === 'object' ? c.id : `i${i}`);

export function ArrayScene({ state, frameKey }: SceneProps<ArrayState>) {
  const panels = state.panels ?? [];
  const panelW = panels.length ? 150 : 0;
  const left = 40;
  const right = W - 32 - (panelW ? panelW + 18 : 0);
  const rows = state.rows;
  const bandH = (H - 70) / rows.length;

  return (
    <Stage label="Array diagram">
      {rows.map((row, ri) => {
        const n = Math.max(row.cells.length, 1);
        const labelW = row.label ? 72 : 0;
        const avail = right - left - labelW;
        const size = Math.min(48, (avail - (n - 1) * 6) / n);
        const step = size + Math.min(6, size * 0.15);
        const total = n * step - (step - size);
        const x0 = left + labelW + (avail - total) / 2;
        const bandTop = 34 + ri * bandH;
        const maxVal = Math.max(1, ...row.cells.map((c) => Math.abs(Number(cellValue(c)) || 0)));
        const barArea = Math.min(bandH - 70, 190);
        const cy = row.bars ? bandTop + 26 + barArea : bandTop + bandH / 2 - 6;
        const showIndex = row.showIndex ?? ri === 0;
        const font = size < 26 ? 10 : size < 36 ? 12 : 14;
        const xi = (i: number) => x0 + i * step;

        return (
          <g key={ri}>
            {row.label ? (
              <text x={left} y={row.bars ? cy - 8 : cy + 1} dominantBaseline="middle" fontSize="10" fill="#8a8a8a" style={{ ...MONO, letterSpacing: '0.06em' }}>
                {row.label.toUpperCase()}
              </text>
            ) : null}

            {row.window ? (
              (() => {
                const wx1 = xi(row.window.from) - 5;
                const wx2 = xi(row.window.to) + size + 5;
                const top = row.bars ? bandTop + 10 : cy - size / 2 - 9;
                const bottom = cy + (row.bars ? 4 : size / 2 + 5);
                const color = row.window.tone === 'bad' ? '#e24b4a' : row.window.tone === 'ok' ? '#2fb487' : ACCENT;
                return (
                  <g>
                    <rect
                      className="lx-window"
                      x={wx1}
                      y={top}
                      width={Math.max(0, wx2 - wx1)}
                      height={bottom - top}
                      rx={8}
                      fill={`${color}14`}
                      stroke={color}
                      strokeWidth="1.5"
                      strokeDasharray="5 4"
                    />
                    {row.window.label ? <Pill x={(wx1 + wx2) / 2} y={top - 12} text={row.window.label} tone={row.window.tone === 'bad' ? 'bad' : 'accent'} /> : null}
                  </g>
                );
              })()
            ) : null}

            {showIndex
              ? row.cells.map((_, i) => (
                  <text key={`ix${i}`} x={xi(i) + size / 2} y={(row.bars ? bandTop + 20 : cy - size / 2) - (row.window?.label ? 26 : 12)} textAnchor="middle" fontSize="9" fill="#5c5c5c" style={MONO}>
                    {i}
                  </text>
                ))
              : null}

            {row.cells.map((c, i) => {
              const st = ITEM_STYLE[row.states?.[i] ?? 'normal'];
              const v = cellValue(c);
              const x = xi(i);
              if (row.bars) {
                const h = Math.max(4, (Math.abs(Number(v) || 0) / maxVal) * barArea);
                return (
                  <g key={cellKey(c, i)} className="lx-slide" style={{ transform: `translate(${x}px, ${cy}px)` }}>
                    <rect x={0} y={-h} width={size} height={h} rx={4} fill={st.fill} stroke={st.stroke} strokeWidth="1.5" className="lx-key lx-bar lx-halo" style={halo(Boolean(st.glow), st.stroke, 6)} />
                    <text x={size / 2} y={14} textAnchor="middle" fontSize={font} fill={st.text} style={MONO}>
                      {v}
                    </text>
                  </g>
                );
              }
              return (
                <g key={cellKey(c, i)} className="lx-slide" style={{ transform: `translate(${x}px, ${cy - size / 2}px)` }}>
                  <rect
                    width={size}
                    height={size}
                    rx={Math.min(8, size / 5)}
                    fill={st.fill}
                    stroke={st.stroke}
                    strokeWidth="1.5"
                    className="lx-key lx-halo"
                    style={halo(Boolean(st.glow), st.stroke, 6)}
                  />
                  <text x={size / 2} y={size / 2 + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={font} fontWeight={600} fill={st.text} style={MONO}>
                    {v}
                  </text>
                </g>
              );
            })}

            {(() => {
              const seen = new Map<string, number>();
              return (row.pointers ?? []).map((p) => {
                const slot = `${p.i}-${p.up ? 'u' : 'd'}`;
                const k = seen.get(slot) ?? 0;
                seen.set(slot, k + 1);
                const base = row.bars ? cy + 34 : p.up ? cy - size / 2 - 22 : cy + size / 2 + 20;
                const y = p.up ? base - k * 22 : base + k * 22;
                return (
                  <g key={p.label} className="lx-slide" style={{ transform: `translate(${xi(p.i) + size / 2}px, ${y}px)` }}>
                    <Tag x={0} y={0} text={p.label} color={TONE_COLOR[p.tone ?? 'accent']} up={p.up} />
                  </g>
                );
              });
            })()}
          </g>
        );
      })}

      <Panels panels={panels} x={W - 24 - panelW} y={30} w={panelW} h={H - 76} />
      <NoteLayer note={state.note} frameKey={frameKey} />
    </Stage>
  );
}
