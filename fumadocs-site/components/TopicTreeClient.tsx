'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Atom,
  BookOpen,
  Boxes,
  Braces,
  ChevronRight,
  Coffee,
  Cpu,
  Database,
  FileCode2,
  FileText,
  Folder,
  Globe,
  Layers,
  LayoutTemplate,
  MousePointerClick,
  Network,
  RefreshCw,
  Server,
  ServerCog,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';
import type { TreeItem } from '@/lib/topics';

export const ICONS: Record<string, LucideIcon> = {
  javascript: Braces,
  typescript: FileCode2,
  react: Atom,
  redux: Layers,
  sdui: LayoutTemplate,
  sdlc: RefreshCw,
  java: Coffee,
  oops: Boxes,
  dsa: Network,
  backend: ServerCog,
  databases: Database,
  networking: Globe,
  'operating-systems': SquareTerminal,
  'computer-fundamentals': Cpu,
  'system-design': Server,
};

type Path = { id: string; d: string; x2: number; y2: number };

const YELLOW = '#f5d547';
const NO_CHILDREN: TreeItem[] = [];

/** Position of `el` inside `root`, ignoring transforms (animations must not skew the connectors). */
function offsetWithin(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== root) {
    x += cur.offsetLeft;
    y += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

function indexStyle(index: number, base?: string): CSSProperties {
  return { '--i': index, ...(base ? { '--base': base } : {}) } as CSSProperties;
}

type NodeProps = {
  item: TreeItem;
  depth: number;
  index: number;
  open: boolean;
  onToggle?: () => void;
  onHover?: (id: string | null) => void;
  registerCard?: (id: string, el: HTMLElement | null) => void;
  isRoot?: boolean;
};

function TreeNode({ item, depth, index, open, onToggle, onHover, registerCard, isRoot }: NodeProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const childCards = useRef(new Map<string, HTMLElement>());
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [paths, setPaths] = useState<Path[]>([]);

  const children = item.children ?? NO_CHILDREN;
  const expanded = children.length > 0 && open;

  const setCard = useCallback(
    (el: HTMLElement | null) => {
      cardRef.current = el;
      registerCard?.(item.id, el);
    },
    [registerCard, item.id],
  );

  const registerChild = useCallback((id: string, el: HTMLElement | null) => {
    if (el) childCards.current.set(id, el);
    else childCards.current.delete(id);
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    const parent = cardRef.current;
    if (!expanded || !row || !parent) {
      setPaths((prev) => (prev.length ? [] : prev));
      return;
    }

    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const p = offsetWithin(parent, row);
      const x1 = p.x + parent.offsetWidth - 1;
      const y1 = p.y + parent.offsetHeight / 2;
      const next: Path[] = [];
      for (const child of children) {
        const el = childCards.current.get(child.id);
        if (!el) continue;
        const q = offsetWithin(el, row);
        const x2 = q.x + 1;
        const y2 = q.y + el.offsetHeight / 2;
        const dx = (x2 - x1) * 0.5;
        next.push({ id: child.id, d: `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`, x2, y2 });
      }
      setPaths((prev) =>
        prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.d === next[i].d) ? prev : next,
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    ro.observe(parent);
    childCards.current.forEach((el) => ro.observe(el));
    document.fonts?.ready.then(measure);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [expanded, children, openId]);

  // Keep a freshly opened branch visible when the tree is wider than its scroll container.
  useEffect(() => {
    if (!expanded || isRoot) return;
    const list = listRef.current;
    const scroller = list?.closest<HTMLElement>('[data-tt-scroll]');
    if (!list || !scroller) return;
    const timer = window.setTimeout(() => {
      const overflow = list.getBoundingClientRect().right - scroller.getBoundingClientRect().right;
      if (overflow > -16) scroller.scrollBy({ left: overflow + 32, behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [expanded, isRoot]);

  const hoverProps = {
    onPointerEnter: () => onHover?.(item.id),
    onPointerLeave: () => onHover?.(null),
    onFocusCapture: () => onHover?.(item.id),
    onBlurCapture: () => onHover?.(null),
  };

  const width = depth <= 1 ? 'md:w-72' : 'md:w-64';
  const cardBase =
    'tt-in relative z-10 w-full overflow-hidden rounded-xl border bg-[#141414] transition-[border-color,background-color,box-shadow] duration-200';
  const cardIdle = 'border-white/10 hover:border-[#f5d547]/45 hover:bg-[#191919]';
  const cardOpen =
    'border-[#f5d547]/60 bg-[#1a1810] shadow-[0_0_0_1px_rgba(245,213,71,0.12),0_10px_30px_-10px_rgba(245,213,71,0.3)]';
  const focusRing =
    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#f5d547]';

  const Icon = (item.icon && ICONS[item.icon]) || (children.length ? Folder : FileText);

  let card;
  if (isRoot) {
    card = (
      <div
        ref={setCard}
        style={indexStyle(0, '0ms')}
        className="tt-in tt-root relative z-10 flex w-full items-center gap-3 rounded-2xl border border-[#f5d547]/50 bg-[#17150c] px-4 py-3.5 md:w-56"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f5d547] text-black">
          <BookOpen className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-white">{item.title}</span>
          <span className="block text-xs text-zinc-400">
            {children.length} topics, {item.pages} pages
          </span>
        </span>
      </div>
    );
  } else if (children.length > 0) {
    card = (
      <div
        ref={setCard}
        style={indexStyle(index)}
        className={`${cardBase} ${width} flex items-stretch ${open ? cardOpen : cardIdle}`}
        {...hoverProps}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          title={item.description}
          className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5 text-left ${focusRing}`}
        >
          <span
            className={`grid shrink-0 place-items-center rounded-lg border transition-colors duration-200 ${
              depth <= 1 ? 'size-9' : 'size-8'
            } ${
              open
                ? 'border-[#f5d547]/60 bg-[#f5d547] text-black'
                : 'border-[#f5d547]/20 bg-[#f5d547]/8 text-[#f5d547]'
            }`}
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-zinc-100">{item.title}</span>
              <span className="shrink-0 rounded-full bg-white/8 px-1.5 py-px text-[10px] font-medium tabular-nums text-zinc-400">
                {item.pages}
              </span>
            </span>
            {item.description ? (
              <span className="block truncate text-xs text-zinc-500">{item.description}</span>
            ) : null}
          </span>
          <ChevronRight
            className={`size-4 shrink-0 transition-transform duration-300 ${
              open ? 'rotate-90 text-[#f5d547]' : 'text-zinc-500'
            }`}
          />
        </button>
        {item.url ? (
          <Link
            href={item.url}
            aria-label={`Open ${item.title}`}
            title={`Open ${item.title}`}
            className={`grid w-10 shrink-0 place-items-center border-l border-white/10 text-zinc-500 no-underline transition hover:bg-[#f5d547]/10 hover:text-[#f5d547] ${focusRing}`}
          >
            <ArrowUpRight className="size-4" />
          </Link>
        ) : null}
      </div>
    );
  } else {
    card = (
      <div
        ref={setCard}
        style={indexStyle(index)}
        className={`${cardBase} ${width} ${cardIdle}`}
        {...hoverProps}
      >
        <Link
          href={item.url ?? '#'}
          className={`group flex items-center gap-2.5 px-3 py-2.5 no-underline ${focusRing}`}
        >
          <FileText className="size-4 shrink-0 text-zinc-500 transition-colors group-hover:text-[#f5d547]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-zinc-200">{item.title}</span>
            {item.description ? (
              <span className="block truncate text-[11.5px] text-zinc-500">{item.description}</span>
            ) : null}
          </span>
          <ArrowUpRight className="size-3.5 shrink-0 -translate-x-1 text-[#f5d547] opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
        </Link>
      </div>
    );
  }

  return (
    <div ref={rowRef} className="relative flex flex-col md:flex-row md:items-center">
      <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible md:block">
        {paths.map((p, i) => {
          const active = openId === p.id || hoverId === p.id;
          return (
            <g key={p.id} style={indexStyle(i)}>
              <path d={p.d} pathLength={1} className="tt-path" data-active={active} />
              <circle cx={p.x2} cy={p.y2} r={3} className="tt-port" data-active={active} />
              {active ? (
                <circle r={3.5} fill={YELLOW} className="tt-dot">
                  <animateMotion dur="1.8s" repeatCount="indefinite" path={p.d} />
                </circle>
              ) : null}
            </g>
          );
        })}
      </svg>

      {card}

      {expanded ? (
        <ul
          ref={listRef}
          className="m-0 mt-2 ml-5 flex list-none flex-col gap-2 border-l border-white/10 p-0 pl-4 md:mt-0 md:ml-14 md:gap-3 md:border-l-0 md:pl-0"
        >
          {children.map((child, i) => (
            <li
              key={child.id}
              className="relative m-0 p-0 before:absolute before:top-6 before:-left-4 before:h-px before:w-4 before:bg-white/10 md:before:hidden"
            >
              <TreeNode
                item={child}
                depth={depth + 1}
                index={i}
                open={openId === child.id}
                onToggle={() => setOpenId((cur) => (cur === child.id ? null : child.id))}
                onHover={setHoverId}
                registerCard={registerChild}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function TopicTreeClient({ root }: { root: TreeItem }) {
  return (
    <div className="not-prose mt-8">
      <p className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
        <MousePointerClick className="size-3.5 text-[#f5d547]" />
        Click a branch to expand it. Use the arrow on a branch to open its page.
      </p>
      <div
        data-tt-scroll
        className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0e0e0e] bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] bg-size-[20px_20px] p-4 md:p-8"
      >
        <div className="min-w-full md:w-max">
          <TreeNode item={root} depth={0} index={0} open isRoot />
        </div>
      </div>
    </div>
  );
}
