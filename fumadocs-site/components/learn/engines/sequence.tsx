'use client';

import { Pill, shade } from '../iso';
import type { BaseState, Note, SceneProps } from '../types';
import { ArrowHead, H, MONO, NoteLayer, Stage, TONE_COLOR, Traveler, W, pillTone, textW, vars, type PaintTone } from './common';
import { KIND_COLOR, type FlowKind } from './flow';

/**
 * Sequence diagram engine: actors across the top, messages as arrows going down in time.
 * Each frame lists every message so far. The last `fresh` messages animate in (default 1).
 */

export type SeqActor = {
  id: string;
  label: string;
  kind?: FlowKind;
  status?: 'normal' | 'active' | 'down' | 'dim';
  /** Pill at the bottom of the lifeline. */
  badge?: Note;
};

export type SeqMessage = {
  from: string;
  to: string;
  label: string;
  tone?: PaintTone;
  /** Draw dashed, the usual style for replies. */
  dashed?: boolean;
  /** The message never arrives: the arrow stops halfway with a red cross. */
  lost?: boolean;
};

export type SeqState = BaseState & {
  actors: SeqActor[];
  messages: SeqMessage[];
  fresh?: number;
};

const TOP = 38;
const FIRST_ROW = 96;
const MAX_ROWS = 9;

export function SequenceScene({ state, frameKey }: SceneProps<SeqState>) {
  const n = state.actors.length;
  const margin = n > 4 ? 64 : 92;
  const gap = n > 1 ? (W - 2 * margin) / (n - 1) : 0;
  const ax = new Map(state.actors.map((a, i) => [a.id, n > 1 ? margin + i * gap : W / 2]));
  const boxW = Math.min(124, Math.max(70, gap - 14));
  const offset = Math.max(0, state.messages.length - MAX_ROWS);
  const visible = state.messages.slice(offset);
  const rowH = Math.min(34, (H - 58 - FIRST_ROW) / Math.max(visible.length, 1));
  const fresh = Math.min(state.fresh ?? 1, visible.length);
  const firstFresh = visible.length - fresh;

  return (
    <Stage label="Sequence diagram">
      {state.actors.map((a) => {
        const x = ax.get(a.id)!;
        const color = a.status === 'down' ? '#e24b4a' : KIND_COLOR[a.kind ?? 'service'];
        const dim = a.status === 'dim';
        return (
          <g key={a.id} style={{ opacity: dim ? 0.35 : 1 }} className="lx-key">
            <line
              x1={x}
              y1={TOP + 18}
              x2={x}
              y2={H - 44}
              stroke={a.status === 'down' ? 'rgba(226,75,74,0.5)' : 'rgba(255,255,255,0.16)'}
              strokeDasharray="4 5"
            />
            <rect
              x={x - boxW / 2}
              y={TOP - 16}
              width={boxW}
              height={32}
              rx={9}
              fill={shade(color, -0.78)}
              stroke={a.status === 'active' ? '#f5d547' : shade(color, -0.1)}
              strokeWidth={a.status === 'active' ? 2 : 1}
            />
            <circle cx={x - boxW / 2 + 12} cy={TOP} r={3.5} fill={color} />
            <text x={x + 5} y={TOP + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight={600} fill={shade(color, 0.6)}>
              {a.label}
            </text>
            {a.status === 'down' ? (
              <text x={x + boxW / 2 - 4} y={TOP - 18} fontSize="15" fontWeight={700} fill="#e24b4a">
                ×
              </text>
            ) : null}
            {a.badge ? <Pill key={`${frameKey}-${a.id}`} x={x} y={H - 34} text={a.badge.text} tone={pillTone(a.badge.tone)} className="lx-fade" /> : null}
          </g>
        );
      })}

      {offset > 0 ? (
        <text x={W / 2} y={FIRST_ROW - 22} textAnchor="middle" fontSize="10" fill="#737373" style={MONO}>
          … {offset} earlier
        </text>
      ) : null}

      {visible.map((m, i) => {
        const y = FIRST_ROW + i * rowH;
        const x1 = ax.get(m.from);
        const x2 = ax.get(m.to);
        if (x1 === undefined || x2 === undefined) return null;
        const color = TONE_COLOR[m.tone ?? (m.dashed ? 'res' : 'req')];
        const isFresh = i >= firstFresh;
        const delay = isFresh ? (i - firstFresh) * 0.75 : 0;
        const key = isFresh ? `${frameKey}-${offset + i}` : `m${offset + i}`;

        if (x1 === x2) {
          const d = `M${x1} ${y - 6} h34 v12 h-30`;
          return (
            <g key={key}>
              <path
                d={d}
                pathLength={1}
                stroke={color}
                strokeWidth="1.6"
                fill="none"
                strokeDasharray={isFresh ? '1' : undefined}
                className={isFresh ? 'lx-draw' : undefined}
                style={isFresh ? vars({ '--dur': '0.5s', animationDelay: `${delay}s` }) : undefined}
              />
              <ArrowHead x1={x1 + 10} y1={y + 6} x2={x1 + 3} y2={y + 6} color={color} size={6} />
              <text x={x1 + 42} y={y + 0.5} dominantBaseline="middle" fontSize="10.5" fill={color} className={isFresh ? 'lx-fade' : undefined} style={{ ...MONO, animationDelay: `${delay}s` }}>
                {m.label}
              </text>
            </g>
          );
        }

        const dir = Math.sign(x2 - x1);
        const end = m.lost ? (x1 + x2) / 2 : x2 - dir * 3;
        const path = `M${x1 + dir * 3} ${y} L${end} ${y}`;
        const lw = textW(m.label, 10.5);
        const lx = (x1 + (m.lost ? end : x2)) / 2;
        return (
          <g key={key}>
            <path
              d={path}
              pathLength={1}
              stroke={color}
              strokeWidth="1.6"
              fill="none"
              strokeDasharray={m.dashed ? (isFresh ? undefined : '5 4') : isFresh ? '1' : undefined}
              className={isFresh && !m.dashed ? 'lx-draw' : isFresh ? 'lx-fade' : undefined}
              style={isFresh ? vars({ '--dur': '0.6s', animationDelay: `${delay}s` }) : undefined}
            />
            {m.lost ? (
              <text x={end} y={y + 5} textAnchor="middle" fontSize="15" fontWeight={700} fill="#e24b4a" className={isFresh ? 'lx-fade' : undefined} style={{ animationDelay: `${delay + 0.5}s` }}>
                ×
              </text>
            ) : (
              <g className={isFresh ? 'lx-fade' : undefined} style={{ animationDelay: `${delay + 0.45}s` }}>
                <ArrowHead x1={end - dir * 10} y1={y} x2={end} y2={y} color={color} />
              </g>
            )}
            <rect x={lx - lw / 2 - 4} y={y - 17} width={lw + 8} height={13} rx={3} fill="#0b0b0b" opacity={0.85} />
            <text
              x={lx}
              y={y - 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10.5"
              fill={shade(color, 0.35)}
              className={isFresh ? 'lx-fade' : undefined}
              style={{ ...MONO, animationDelay: `${delay}s` }}
            >
              {m.label}
            </text>
            {isFresh ? <Traveler path={path} dur={0.6} delay={delay} color={color} r={4} /> : null}
          </g>
        );
      })}

      <NoteLayer note={state.note} frameKey={frameKey} />
    </Stage>
  );
}
