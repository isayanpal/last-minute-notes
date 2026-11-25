'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Menu, X } from 'lucide-react';
import { LESSONS, TRACKS, sectionsOf, type LessonLevel, type LessonTrack } from '@/lib/learn/catalog';
import { MODULE_COLORS } from './module-ui';

const FOLDER_COLORS = MODULE_COLORS;
const LEVELS: ('All' | LessonLevel)[] = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const LEVEL_DOT: Record<LessonLevel, string> = { Beginner: 'bg-emerald-400', Intermediate: 'bg-amber-400', Advanced: 'bg-red-400' };

/** Track switcher. A dropdown, so it holds any number of tracks without squeezing labels. */
function TrackPicker({ value, onChange }: { value: LessonTrack; onChange: (t: LessonTrack) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = TRACKS.find((t) => t.id === value) ?? TRACKS[0];
  const countOf = (t: LessonTrack) => LESSONS.filter((l) => l.track === t).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      root.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div ref={root} className="relative mx-4">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-lg border bg-fd-background/60 px-3 py-2 text-left transition-colors ${open ? 'border-fd-primary/60' : 'border-fd-border hover:border-fd-primary/40'}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-fd-muted-foreground">Track</span>
          <span className="block truncate text-sm font-medium">{current.title}</span>
        </span>
        <span className="font-mono text-xs text-fd-muted-foreground">{countOf(value)}</span>
        <ChevronDown className={`size-4 shrink-0 text-fd-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open ? (
        <ul id={listId} role="listbox" aria-label="Track" className="lx-in absolute inset-x-0 top-full z-30 mt-1.5 max-h-[min(20rem,60dvh)] overflow-y-auto rounded-lg border border-fd-border bg-fd-popover p-1 shadow-xl">
          {TRACKS.map((t) => {
            const total = countOf(t.id);
            const selected = t.id === value;
            return (
              <li key={t.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${selected ? 'bg-fd-primary/15' : 'hover:bg-fd-muted'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.title}</span>
                    <span className="block font-mono text-[11px] text-fd-muted-foreground">
                      {total} lessons
                    </span>
                  </span>
                  {selected ? <Check className="size-4 shrink-0 text-fd-primary" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function Nav({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const pathname = usePathname();
  const currentSlug = pathname.startsWith('/learn/') ? pathname.split('/')[2] : undefined;
  const current = LESSONS.find((l) => l.slug === currentSlug);

  const [track, setTrack] = useState<LessonTrack>(current?.track ?? 'system-design');
  const [level, setLevel] = useState<'All' | LessonLevel>('All');
  const [open, setOpen] = useState<Set<string>>(() => new Set(current ? [`${current.track}:${current.section}`] : []));

  // Follow the lesson being read: switch track and open its section.
  useEffect(() => {
    if (!current) return;
    setTrack(current.track);
    setOpen((o) => new Set(o).add(`${current.track}:${current.section}`));
  }, [current?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const trackLessons = useMemo(() => LESSONS.filter((l) => l.track === track), [track]);
  const shown = useMemo(() => trackLessons.filter((l) => level === 'All' || l.level === level), [trackLessons, level]);
  // A level filter also hides modules that have no lesson of that level.
  const sections = sectionsOf(track)
    .map((name) => [name, shown.filter((l) => l.section === name)] as const)
    .filter(([, lessons]) => level === 'All' || lessons.length > 0);

  const toggle = (key: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <Link href="/learn" onClick={onNavigate} className="flex items-center gap-2 font-semibold hover:text-fd-primary">
          <FolderOpen className="size-5 text-fd-primary" aria-hidden />
          Lessons
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-fd-muted-foreground">
            {trackLessons.length} lessons
          </span>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close lessons menu" className="grid size-7 place-items-center rounded-md border border-fd-border text-fd-muted-foreground hover:text-fd-foreground">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      <TrackPicker value={track} onChange={setTrack} />

      <div className="mx-4 mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by level">
        {LEVELS.map((lv) => (
          <button
            key={lv}
            type="button"
            aria-pressed={level === lv}
            onClick={() => setLevel(lv)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${level === lv ? 'border-fd-primary/60 bg-fd-primary/10 text-fd-foreground' : 'border-fd-border text-fd-muted-foreground hover:text-fd-foreground'}`}
          >
            {lv !== 'All' ? <span className={`size-1.5 rounded-full ${LEVEL_DOT[lv]}`} aria-hidden /> : null}
            {lv}
          </button>
        ))}
      </div>

      <nav aria-label="Lessons" className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        {sections.length === 0 ? <p className="px-3 py-4 text-sm text-fd-muted-foreground">No {level.toLowerCase()} lessons in this track yet.</p> : null}
        {sections.map(([section, lessons], si) => {
          const key = `${track}:${section}`;
          const forced = level !== 'All';
          const expanded = forced || open.has(key);
          const all = trackLessons.filter((l) => l.section === section);
          const Icon = expanded ? FolderOpen : Folder;
          return (
            <div key={key} className="mt-1">
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-fd-muted"
              >
                <ChevronRight className={`size-4 shrink-0 text-fd-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden />
                <Icon className="size-[18px] shrink-0" style={{ color: FOLDER_COLORS[si % FOLDER_COLORS.length], fill: `${FOLDER_COLORS[si % FOLDER_COLORS.length]}33` }} aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {String(si + 1).padStart(2, '0')}. {section}
                </span>
                <span className="font-mono text-[11px] text-fd-muted-foreground">
                  {all.length}
                </span>
              </button>
              {expanded ? (
                <ul className="ml-[1.35rem] mt-0.5 border-l border-fd-border pl-3">
                  {lessons.map((l) => {
                    const isCurrent = l.slug === currentSlug;
                    return (
                      <li key={l.slug} className="relative">
                        <Link
                          href={`/learn/${l.slug}`}
                          onClick={onNavigate}
                          aria-current={isCurrent ? 'page' : undefined}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${isCurrent ? 'bg-fd-primary/15 text-fd-foreground ring-1 ring-fd-primary/40' : 'text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground'}`}
                        >
                          <FileText className="size-4 shrink-0 opacity-60" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{l.title}</span>
                          <span className={`size-1.5 shrink-0 rounded-full ${LEVEL_DOT[l.level]}`} title={l.level} aria-label={l.level} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export function CourseShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] items-start">
      <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[290px] shrink-0 border-r border-fd-border bg-fd-card/40 xl:block">
        <Nav />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-14 z-20 flex items-center border-b border-fd-border bg-fd-background/90 px-4 py-2 backdrop-blur xl:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-fd-border px-3 py-1.5 text-sm hover:border-fd-primary/50"
          >
            <Menu className="size-4" aria-hidden /> Lessons
          </button>
        </div>
        {children}
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Lessons menu">
          <button type="button" aria-label="Close lessons menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/60" />
          <aside className="lx-in absolute inset-y-0 left-0 w-[min(88vw,340px)] border-r border-fd-border bg-fd-background shadow-2xl">
            <Nav onNavigate={() => setDrawer(false)} onClose={() => setDrawer(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
