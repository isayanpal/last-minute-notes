'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown } from 'lucide-react';
import type { HubItem } from '@/lib/topics';

const STORAGE_KEY = 'lmn:read';
const MAX_CHIPS = 12;

function leaves(items: HubItem[]): HubItem[] {
  return items.flatMap((i) => (i.children ? leaves(i.children) : [i]));
}

/** Pages the reader has ticked off, persisted per browser. */
function useRead() {
  const [read, setRead] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRead(new Set(JSON.parse(raw) as string[]));
    } catch {
      // storage unavailable, keep in-memory state only
    }
  }, []);

  const persist = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(
    (url: string) => {
      setRead((prev) => {
        const next = new Set(prev);
        if (!next.delete(url)) next.add(url);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clear = useCallback(
    (urls: string[]) => {
      setRead((prev) => {
        const next = new Set(prev);
        urls.forEach((u) => next.delete(u));
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { read, toggle, clear };
}

type Ctx = {
  open: Set<string>;
  toggleOpen: (id: string) => void;
  read: Set<string>;
  toggleRead: (url: string) => void;
  levels: Record<string, string>;
};

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5d547]';

function Row({ item, index, depth, ctx }: { item: HubItem; index: number; depth: number; ctx: Ctx }) {
  const isFolder = Boolean(item.children?.length);
  const sections = item.sections ?? [];
  const expandable = isFolder || sections.length > 0;
  const open = ctx.open.has(item.id);
  const isRead = !isFolder && item.url ? ctx.read.has(item.url) : false;
  const level = item.url ? ctx.levels[item.url.split('/').pop() ?? ''] : undefined;
  const folderLeaves = isFolder ? leaves(item.children!) : [];
  const folderRead = folderLeaves.filter((l) => l.url && ctx.read.has(l.url)).length;
  const panelId = `hub-${item.id.replace(/[^a-z0-9]/gi, '-')}`;

  return (
    <li className="m-0 border-b border-white/8 p-0 last:border-b-0">
      <div
        style={{ '--i': index } as CSSProperties}
        className={`hub-row group/row relative flex items-start gap-4 py-4 pr-2 pl-4 transition-colors hover:bg-white/3 before:absolute before:top-3 before:bottom-3 before:left-0 before:w-0.5 before:origin-center before:scale-y-0 before:rounded-full before:bg-[#f5d547] before:transition-transform before:duration-300 hover:before:scale-y-100 ${
          depth ? 'py-3' : ''
        }`}
      >
        <span className="mt-0.5 w-6 shrink-0 font-mono text-xs tabular-nums text-zinc-600 transition-colors group-hover/row:text-[#f5d547]">
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="min-w-0 flex-1 transition-transform duration-300 group-hover/row:translate-x-0.5">
          {item.url ? (
            <Link
              href={item.url}
              className={`text-[15px] font-medium no-underline transition-colors after:absolute after:inset-0 ${focusRing} ${
                isRead ? 'text-zinc-500' : 'text-zinc-100 group-hover/row:text-white'
              }`}
            >
              {item.title}
            </Link>
          ) : (
            <span className="text-[15px] font-medium text-zinc-100">{item.title}</span>
          )}
          {item.description ? (
            <p className="m-0 mt-1 line-clamp-2 text-[13px] leading-relaxed text-zinc-500">{item.description}</p>
          ) : null}
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-1.5">
          {level ? (
            <span className="hidden rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400 sm:inline">
              {level}
            </span>
          ) : null}

          {isFolder ? (
            <span className="hidden text-xs tabular-nums text-zinc-500 sm:inline">
              {folderRead > 0 ? `${folderRead}/` : ''}
              {item.pages} pages
            </span>
          ) : null}

          {expandable ? (
            <button
              type="button"
              onClick={() => ctx.toggleOpen(item.id)}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${open ? 'Hide' : 'Show'} ${isFolder ? 'pages' : 'sections'} of ${item.title}`}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-white/8 hover:text-zinc-200 ${focusRing}`}
            >
              {!isFolder ? <span className="tabular-nums">{sections.length}</span> : null}
              <ChevronDown className={`size-4 transition-transform duration-300 ${open ? 'rotate-180 text-[#f5d547]' : ''}`} />
            </button>
          ) : null}

          {!isFolder && item.url ? (
            <button
              type="button"
              onClick={() => ctx.toggleRead(item.url!)}
              aria-pressed={isRead}
              aria-label={`Mark ${item.title} as read`}
              title={isRead ? 'Marked as read' : 'Mark as read'}
              className={`grid size-6 cursor-pointer place-items-center rounded-full border transition-all duration-200 active:scale-90 ${focusRing} ${
                isRead
                  ? 'border-[#f5d547] bg-[#f5d547] text-black'
                  : 'border-white/15 text-transparent hover:border-[#f5d547]/60 hover:text-[#f5d547]/60'
              }`}
            >
              <Check className="size-3.5" strokeWidth={3} />
            </button>
          ) : null}
        </div>
      </div>

      {expandable ? (
        <div
          id={panelId}
          inert={!open}
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="min-h-0 overflow-hidden">
            {isFolder ? (
              <ol className="m-0 ml-10 list-none border-l border-white/10 p-0">
                {item.children!.map((child, i) => (
                  <Row key={child.id} item={child} index={i} depth={depth + 1} ctx={ctx} />
                ))}
              </ol>
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-0.5 pr-4 pb-4 pl-14">
                {sections.slice(0, MAX_CHIPS).map((s, i) => (
                  <Link
                    key={s.url}
                    href={s.url}
                    style={{ transitionDelay: open ? `${120 + i * 25}ms` : '0ms' }}
                    className={`rounded-md border border-white/10 bg-white/3 px-2 py-1 text-xs text-zinc-400 no-underline transition-all duration-300 hover:border-[#f5d547]/50 hover:text-[#f5d547] ${focusRing} ${
                      open ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
                    }`}
                  >
                    {s.title}
                  </Link>
                ))}
                {sections.length > MAX_CHIPS ? (
                  <Link
                    href={item.url!}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#f5d547] no-underline hover:underline"
                  >
                    +{sections.length - MAX_CHIPS} more
                    <ArrowUpRight className="size-3" />
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function SectionHubClient({ items, levels = {} }: { items: HubItem[]; levels?: Record<string, string> }) {
  const { read, toggle, clear } = useRead();
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const all = useMemo(() => leaves(items).filter((l) => l.url), [items]);
  const done = all.filter((l) => read.has(l.url!)).length;
  const next = all.find((l) => !read.has(l.url!)) ?? all[0];
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;

  const toggleOpen = useCallback((id: string) => {
    setOpen((prev) => {
      const n = new Set(prev);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  }, []);

  const ctx: Ctx = { open, toggleOpen, read, toggleRead: toggle, levels };

  if (!items.length) return null;

  return (
    <div className="not-prose my-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {next?.url ? (
          <Link
            href={next.url}
            className="group inline-flex items-center gap-2 rounded-lg bg-[#f5d547] px-4 py-2 text-sm font-semibold text-black no-underline transition hover:bg-[#f7e06a] active:scale-95"
          >
            {done > 0 && done < all.length ? 'Continue with' : 'Start with'} {next.title}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="tabular-nums">
            {done} of {all.length} read
          </span>
          <span className="h-1 w-24 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <span
              className="block h-full rounded-full bg-[#f5d547] transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </span>
          {done > 0 ? (
            <button
              type="button"
              onClick={() => clear(all.map((l) => l.url!))}
              className={`cursor-pointer rounded px-1 text-zinc-500 underline-offset-2 hover:text-zinc-200 hover:underline ${focusRing}`}
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <ol className="m-0 list-none border-t border-white/8 p-0">
        {items.map((item, i) => (
          <Row key={item.id} item={item} index={i} depth={0} ctx={ctx} />
        ))}
      </ol>
    </div>
  );
}
