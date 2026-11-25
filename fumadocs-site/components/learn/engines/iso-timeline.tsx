'use client';

import type { SceneProps } from '../types';
import { MONO, TONE_COLOR, textW } from './common';
import type { TimelineState } from './timeline';
import { At, IsoStage, Pad, Pin, Prism, World, extent, fitCam, proj, region, toScreen } from './iso-core';

/**
 * Isometric timeline engine. Same state as the 2D timeline: time runs along the floor, lanes stack toward the viewer
 * and each bar is a slab as long as its interval.
 */

const SPAN = 9;
const LANE_GAP = 1.5;
const BAR_D = 0.8;
const FLOOR = 0.08;

export function IsoTimelineScene({ state, frameKey }: SceneProps<TimelineState>) {
  const lanes = state.lanes;
  const span = state.to - state.from || 1;
  const gx = (v: number) => ((v - state.from) / span) * SPAN;
  const laneW = Math.min(150, Math.max(54, ...lanes.map((l) => textW(l.label, 10.5) + 22)));
  const gyMax = (lanes.length - 1) * LANE_GAP;
  const ext = extent([proj(-0.4, gyMax + 1.1), proj(SPAN + 0.5, -0.9), proj(-0.4, -0.9, 1.2), proj(SPAN + 0.5, gyMax + 1.1)]);
  const reg = region(false, 66, 70);
  const cam = fitCam(ext, { ...reg, x0: reg.x0 + laneW }, 2.0);
  const ticks = state.ticks ?? Array.from({ length: 5 }, (_, i) => state.from + (span * i) / 4);
  const fmt = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}${state.unit ?? ''}`;

  return (
    <IsoStage label="Timeline diagram" note={state.note} frameKey={frameKey}>
      <World cam={cam}>
        <Pad gx0={-0.4} gx1={SPAN + 0.5} gy0={-0.8} gy1={gyMax + 0.8} z={0} fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.16)" />
        {lanes.map((_, li) => (
          <Pad key={`lane${li}`} gx0={-0.3} gx1={SPAN + 0.4} gy0={li * LANE_GAP - 0.5} gy1={li * LANE_GAP + 0.5} z={FLOOR} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" />
        ))}
        {ticks.map((t) => {
          const [x1, y1] = proj(gx(t), -0.8);
          const [x2, y2] = proj(gx(t), gyMax + 0.8);
          return <line key={`t${t}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.08)" vectorEffect="non-scaling-stroke" />;
        })}
        {(state.markers ?? []).map((m) => {
          const [x1, y1] = proj(gx(m.at), -0.9);
          const [x2, y2] = proj(gx(m.at), gyMax + 0.9);
          return (
            <line
              key={`${frameKey}-${m.label}`}
              className="lx-fade"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={TONE_COLOR[m.tone ?? 'accent']}
              strokeWidth="1.6"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {lanes.flatMap((lane, li) =>
          lane.bars.map((b, bi) => {
            const color = b.state === 'bad' ? TONE_COLOR.bad : TONE_COLOR[b.tone ?? 'info'];
            const len = Math.max(0.12, gx(b.to) - gx(b.from));
            const [x, y] = proj((gx(b.from) + gx(b.to)) / 2, li * LANE_GAP, 0);
            const inside = b.label ? textW(b.label, 10) + 6 < (len + BAR_D) * 30 * 0.8 : false;
            return (
              <g key={b.id ?? `${li}-${bi}`} style={{ opacity: b.state === 'dim' ? 0.35 : 1 }}>
                <At x={x} y={y}>
                  <Prism w={len} d={BAR_D} h={b.state === 'active' ? 0.55 : 0.34} lift={FLOOR} color={color} label={inside ? b.label : undefined} fontSize={10} shadow={false} />
                </At>
              </g>
            );
          }),
        )}
      </World>

      {lanes.map((lane, li) => {
        const [x, y] = toScreen(cam, proj(-0.3, li * LANE_GAP, 0));
        return (
          <At key={`${lane.label}-${li}`} x={x - 14} y={y + 4}>
            <text textAnchor="end" fontSize="10.5" fill="#a3a3a3" style={MONO}>
              {lane.label}
            </text>
          </At>
        );
      })}
      {lanes.flatMap((lane, li) =>
        lane.bars.map((b, bi) => {
          const len = Math.max(0.12, gx(b.to) - gx(b.from));
          const inside = b.label ? textW(b.label, 10) + 6 < (len + BAR_D) * 30 * 0.8 : false;
          if (!b.label || inside) return null;
          const color = b.state === 'bad' ? TONE_COLOR.bad : TONE_COLOR[b.tone ?? 'info'];
          const [x, y] = toScreen(cam, proj(gx(b.to) + 0.35, li * LANE_GAP, 0.3));
          return (
            <At key={`l-${b.id ?? `${li}-${bi}`}`} x={x + 6} y={y}>
              <text fontSize="10" fill={color} style={MONO}>
                {b.label}
              </text>
            </At>
          );
        }),
      )}
      {ticks.map((t) => {
        const [x, y] = toScreen(cam, proj(gx(t), gyMax + 0.95));
        return (
          <At key={`tl${t}`} x={x - 10} y={y + 10}>
            <text textAnchor="middle" fontSize="9.5" fill="#737373" style={MONO}>
              {fmt(t)}
            </text>
          </At>
        );
      })}
      {(state.markers ?? []).map((m) => {
        const [x, y] = toScreen(cam, proj(gx(m.at), -0.9));
        return <Pin key={`m-${frameKey}-${m.label}`} at={[x, y - 16]} text={m.label} color={TONE_COLOR[m.tone ?? 'accent']} up />;
      })}
    </IsoStage>
  );
}
