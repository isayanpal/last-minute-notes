'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import type { TreeItem } from '@/lib/topics';

const W = 460;
const H = 420;
const PAD = 14;
const NODE_X = 270;
const NODE_W = 190;
const NODE_H = 40;
const ROOT = { x: 0, w: 132, h: 72 };
const FEATURED = ['javascript', 'react', 'typescript', 'java', 'dsa', 'system-design', 'sdlc'];

const idx = (i: number) => ({ '--i': i }) as CSSProperties;

/** Small animated tree used as the hero visual. Mirrors the tree on the docs home page. */
export function HeroTree({ topics }: { topics: TreeItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  const nodes = FEATURED.map((slug) => topics.find((t) => t.icon === slug)).filter(
    (t): t is TreeItem => Boolean(t),
  );
  const gap = (H - PAD * 2 - NODE_H) / Math.max(nodes.length - 1, 1);
  const rootY = H / 2;
  const total = topics.reduce((sum, t) => sum + t.pages, 0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label="Preview of the notes tree"
      className="mx-auto h-auto w-full max-w-[460px] overflow-visible"
    >
      {nodes.map((t, i) => {
        const y = PAD + i * gap + NODE_H / 2;
        const x1 = ROOT.x + ROOT.w - 1;
        const dx = (NODE_X - x1) / 2;
        const d = `M${x1} ${rootY} C${x1 + dx} ${rootY} ${NODE_X - dx} ${y} ${NODE_X} ${y}`;
        const on = active === t.id;
        return (
          <g key={t.id} style={idx(i)}>
            <path d={d} pathLength={1} className="tt-path" data-active={on} />
            <circle r={on ? 3.5 : 2.5} className="lp-hdot" data-active={on}>
              <animateMotion dur={on ? '1.4s' : '3.6s'} begin={`${i * 0.55}s`} repeatCount="indefinite" path={d} />
            </circle>
          </g>
        );
      })}

      <g className="lp-hroot">
        <rect
          x={ROOT.x}
          y={rootY - ROOT.h / 2}
          width={ROOT.w}
          height={ROOT.h}
          rx={16}
          className="fill-[#f5d547]"
        />
        <rect
          x={ROOT.x}
          y={rootY - ROOT.h / 2}
          width={ROOT.w}
          height={ROOT.h}
          rx={16}
          fill="none"
          stroke="#f5d547"
          strokeWidth={2}
        >
          <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="stroke-width" values="2;12;2" dur="2.8s" repeatCount="indefinite" />
        </rect>
        <text x={ROOT.x + ROOT.w / 2} y={rootY - 4} textAnchor="middle" className="fill-black text-[15px] font-bold">
          Notes
        </text>
        <text x={ROOT.x + ROOT.w / 2} y={rootY + 14} textAnchor="middle" className="fill-black/70 text-[11px]">
          {total} pages
        </text>
      </g>

      {nodes.map((t, i) => {
        const y = PAD + i * gap;
        const on = active === t.id;
        return (
          <Link
            key={t.id}
            href={t.url ?? '/docs'}
            aria-label={`${t.title}, ${t.pages} pages`}
            onPointerEnter={() => setActive(t.id)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(t.id)}
            onBlur={() => setActive(null)}
            className="lp-hnode outline-none"
            data-active={on}
            style={idx(i)}
          >
            <rect x={NODE_X} y={y} width={NODE_W} height={NODE_H} rx={10} />
            <circle cx={NODE_X + 16} cy={y + NODE_H / 2} r={4} className="lp-hnode-dot" />
            <text x={NODE_X + 30} y={y + NODE_H / 2 + 4.5} className="fill-zinc-100 text-[13px] font-semibold">
              {t.title}
            </text>
            <text
              x={NODE_X + NODE_W - 14}
              y={y + NODE_H / 2 + 4}
              textAnchor="end"
              className="fill-zinc-500 text-[11px] tabular-nums"
            >
              {t.pages}
            </text>
          </Link>
        );
      })}
    </svg>
  );
}
