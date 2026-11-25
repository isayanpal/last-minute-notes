'use client';

import type { SceneProps } from '../types';
import { ArrowHead, MONO, TONE_COLOR } from './common';
import type { GridState } from './grid';
import { At, IsoStage, Pad, Pin, Prism, Slab, World, extent, fitCam, proj, r2, region, toScreen } from './iso-core';

/**
 * Isometric grid engine. Same state as the 2D grid engine, drawn as a board of tiles.
 * The cell being worked on rises off the board.
 */

const TILE = 0.9;
const BASE = 0.1;

export function IsoGridScene({ state, frameKey }: SceneProps<GridState>) {
  const panels = state.panels ?? [];
  const rows = state.cells.length;
  const cols = Math.max(1, ...state.cells.map((r) => r.length));
  const gx0 = -0.7;
  const gx1 = cols - 0.3;
  const gy0 = -0.7;
  const gy1 = rows - 0.3;
  const headT = state.colHeaders ? 26 : 0;
  const ext = extent([proj(gx0, gy1), proj(gx1, gy0), proj(gx0, gy0, 0.9), proj(gx1, gy1)]);
  const cam = fitCam(ext, region(panels.length > 0, 58 + headT + (state.title ? 18 : 0), 74), 2.0);
  const cell = (r: number, c: number): [number, number] => proj(c, r, 0);
  const at = (r: number, c: number, z = 0) => toScreen(cam, proj(c, r, z));

  return (
    <IsoStage label="Grid diagram" panels={panels} note={state.note} frameKey={frameKey}>
      <World cam={cam}>
        <Slab gx0={gx0} gx1={gx1} gy0={gy0} gy1={gy1} z={BASE} />
        {state.cells.map((row, r) =>
          row.map((v, c) => {
            const st = state.states?.[`${r},${c}`] ?? 'normal';
            const [x, y] = cell(r, c);
            const empty = v === null;
            if (empty) {
              return (
                <g key={`${r},${c}`}>
                  <Pad gx0={c - TILE / 2} gx1={c + TILE / 2} gy0={r - TILE / 2} gy1={r + TILE / 2} z={BASE} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.18)" dash="3 3" />
                </g>
              );
            }
            const raised = st === 'active' || st === 'found' || st === 'swap';
            return (
              <At key={`${r},${c}`} x={x} y={y}>
                <Prism w={TILE} d={TILE} h={raised ? 0.34 : 0.16} lift={BASE} state={st === 'normal' ? 'normal' : st} label={String(v)} shadow={false} />
              </At>
            );
          }),
        )}
        {(state.arrows ?? []).map((a, i) => {
          const [x1, y1] = proj(a.from[1], a.from[0], BASE + 0.34);
          const [x2, y2] = proj(a.to[1], a.to[0], BASE + 0.34);
          const d = Math.hypot(x2 - x1, y2 - y1) || 1;
          const pad = 14;
          const sx1 = x1 + ((x2 - x1) / d) * pad;
          const sy1 = y1 + ((y2 - y1) / d) * pad;
          const sx2 = x2 - ((x2 - x1) / d) * pad;
          const sy2 = y2 - ((y2 - y1) / d) * pad;
          const color = TONE_COLOR[a.tone ?? 'accent'];
          return (
            <g key={`${frameKey}-a${i}`} className="lx-fade">
              <line x1={r2(sx1)} y1={r2(sy1)} x2={r2(sx2)} y2={r2(sy2)} stroke={color} strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
              <ArrowHead x1={sx1} y1={sy1} x2={sx2} y2={sy2} color={color} size={7} />
            </g>
          );
        })}
      </World>

      {state.title ? (
        <text x={(cam.tx + cam.s * ((ext.x0 + ext.x1) / 2))} y={34} textAnchor="middle" fontSize="11" fill="#a3a3a3" style={MONO}>
          {state.title}
        </text>
      ) : null}
      {(state.colHeaders ?? []).map((h, c) => {
        const [x, y] = toScreen(cam, proj(c, -1.15, 0));
        return (
          <At key={`ch${c}`} x={x} y={y - 6}>
            <text textAnchor="middle" fontSize="10" fill="#8a8a8a" style={MONO}>
              {h}
            </text>
          </At>
        );
      })}
      {(state.rowHeaders ?? []).map((h, r) => {
        const [x, y] = toScreen(cam, proj(-1.15, r, 0));
        return (
          <At key={`rh${r}`} x={x - 6} y={y + 4}>
            <text textAnchor="end" fontSize="10" fill="#8a8a8a" style={MONO}>
              {h}
            </text>
          </At>
        );
      })}
      {(state.pointers ?? []).map((p) => {
        const [x, y] = at(p.r + 0.55, p.c, 0);
        return <Pin key={p.label} at={[x, y + 16]} text={p.label} color={TONE_COLOR[p.tone ?? 'accent']} />;
      })}
    </IsoStage>
  );
}
