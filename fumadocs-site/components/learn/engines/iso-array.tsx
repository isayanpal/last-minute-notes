'use client';

import { Pill } from '../iso';
import type { SceneProps } from '../types';
import { ACCENT, MONO, TONE_COLOR } from './common';
import type { ArrayState } from './array';
import { At, IsoStage, Pad, Pin, Prism, Slab, World, extent, fitCam, proj, r2, region, toScreen } from './iso-core';

/**
 * Isometric array engine. Same state as the 2D array engine, drawn as blocks on a slab.
 * Rows stack toward the viewer, cells run along the slab. `bars` makes block height follow the value.
 */

const PITCH = 1.25;
const W = 0.88;
const ROW_GAP = 2.5;
const SLAB = 0.14;
const FLAT = 0.6;
const BAR_MAX = 3.1;

const cellValue = (c: ArrayState['rows'][number]['cells'][number]) => (typeof c === 'object' ? c.v : c);
const cellKey = (c: ArrayState['rows'][number]['cells'][number], i: number) => (typeof c === 'object' ? c.id : `i${i}`);

export function IsoArrayScene({ state, frameKey }: SceneProps<ArrayState>) {
  const rows = state.rows;
  const panels = state.panels ?? [];
  const n = Math.max(1, ...rows.map((r) => r.cells.length));
  const gxMin = -0.72;
  const gxMax = (n - 1) * PITCH + 0.72;
  const gyMin = -0.8;
  const gyMax = (rows.length - 1) * ROW_GAP + 0.8;
  const tall = rows.some((r) => r.bars) ? SLAB + BAR_MAX : SLAB + FLAT + 0.12;

  // Row names sit just behind the start of their slab, so leave floor for them.
  const hasLabels = rows.some((r) => r.label);
  const gxExt = hasLabels ? gxMin - 1.5 : gxMin;
  const ext = extent([proj(gxExt, gyMax), proj(gxMax, gyMin), proj(gxExt, gyMin, tall), proj(gxMax, gyMax)]);
  const cam = fitCam(ext, region(panels.length > 0, 74, 74));

  return (
    <IsoStage label="Array diagram" panels={panels} note={state.note} frameKey={frameKey}>
      <World cam={cam}>
        {rows.map((row, ri) => {
          const gy = ri * ROW_GAP;
          const len = row.cells.length;
          const max = Math.max(1, ...row.cells.map((c) => Math.abs(Number(cellValue(c)) || 0)));
          const heightOf = (v: number | string) => (row.bars ? 0.45 + (BAR_MAX - 0.45) * (Math.abs(Number(v) || 0) / max) : FLAT);
          return (
            <g key={ri}>
              <Slab gx0={gxMin} gx1={(len - 1) * PITCH + 0.72} gy0={gy - 0.72} gy1={gy + 0.72} z={SLAB} />
              {(row.showIndex ?? ri === 0)
                ? row.cells.map((_, i) => {
                    const [ix, iy] = proj(i * PITCH, gy + 1.05, 0);
                    return (
                      <text key={`ix${i}`} x={r2(ix)} y={r2(iy)} textAnchor="middle" fontSize={r2(10 / cam.s)} fill="#6b6b6b" style={MONO}>
                        {i}
                      </text>
                    );
                  })
                : null}
              {row.window ? (
                <Pad
                  gx0={row.window.from * PITCH - 0.58}
                  gx1={row.window.to * PITCH + 0.58}
                  gy0={gy - 0.62}
                  gy1={gy + 0.62}
                  z={SLAB + 0.01}
                  fill={`${row.window.tone === 'bad' ? '#e24b4a' : row.window.tone === 'ok' ? '#2fb487' : ACCENT}22`}
                  stroke={row.window.tone === 'bad' ? '#e24b4a' : row.window.tone === 'ok' ? '#2fb487' : ACCENT}
                  dash="5 4"
                />
              ) : null}
              {row.cells.map((c, i) => {
                const st = row.states?.[i] ?? 'normal';
                const [x, y] = proj(i * PITCH, gy, 0);
                const raised = st === 'active' || st === 'swap' ? 0.14 : 0;
                return (
                  <At key={cellKey(c, i)} x={x} y={y}>
                    <Prism w={W} d={W} h={heightOf(cellValue(c))} lift={SLAB + raised} shadowZ={SLAB} state={st} label={cellValue(c)} />
                  </At>
                );
              })}
            </g>
          );
        })}
      </World>

      {rows.map((row, ri) => {
        const gy = ri * ROW_GAP;
        const len = row.cells.length;
        const max = Math.max(1, ...row.cells.map((c) => Math.abs(Number(cellValue(c)) || 0)));
        const heightOf = (i: number) => (row.bars ? 0.45 + (BAR_MAX - 0.45) * (Math.abs(Number(cellValue(row.cells[i])) || 0) / max) : FLAT);
        const showIndex = row.showIndex ?? ri === 0;
        const used = new Map<string, number>();
        return (
          <g key={`hud${ri}`}>
            {row.label ? (
              <At x={toScreen(cam, proj(gxMin - 0.2, gy))[0] - 6} y={toScreen(cam, proj(gxMin - 0.2, gy))[1] + 4}>
                <text textAnchor="end" fontSize="10" fill="#8a8a8a" style={{ ...MONO, letterSpacing: '0.06em' }}>
                  {row.label.toUpperCase()}
                </text>
              </At>
            ) : null}
            {(row.pointers ?? []).map((p) => {
              const slot = `${p.i}-${p.up ? 'u' : 'd'}`;
              const k = used.get(slot) ?? 0;
              used.set(slot, k + 1);
              const color = TONE_COLOR[p.tone ?? 'accent'];
              if (p.up) {
                const [x, y] = toScreen(cam, proj(p.i * PITCH, gy, SLAB + heightOf(Math.min(Math.max(p.i, 0), len - 1)) + 0.15));
                return <Pin key={p.label} at={[x, y - 24 - k * 22]} text={p.label} color={color} up />;
              }
              const [x, y] = toScreen(cam, proj(p.i * PITCH + W / 2, gy + W / 2, SLAB));
              return <Pin key={p.label} at={[x, y + (showIndex ? 42 : 22) + k * 22]} text={p.label} color={color} />;
            })}
            {row.window?.label ? (() => {
              const w = row.window;
              const last = Math.min(Math.max(w.to, 0), len - 1);
              const [x, y] = toScreen(cam, proj(w.to * PITCH, gy, SLAB + heightOf(last) + 0.35));
              // Cells behind the window rise to the upper left, cells after it fall to the lower right,
              // so the label starts above the last cell and runs right, into free air.
              const half = (w.label!.length * 6.6 + 18) / 2;
              // An upward pointer inside the window already uses the air above its cell: go one tag higher.
              const lift = (row.pointers ?? []).some((p) => p.up && p.i >= w.from && p.i <= w.to) ? 22 : 0;
              return (
                <At key="wl" x={x + half - 6} y={y - 26 - lift}>
                  <Pill x={0} y={0} text={w.label!} tone={w.tone === 'bad' ? 'bad' : 'accent'} />
                </At>
              );
            })() : null}
          </g>
        );
      })}
    </IsoStage>
  );
}
