'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Lightbulb,
  ListOrdered,
  Pause,
  Play,
  RotateCcw,
  SignalMedium,
} from 'lucide-react';
import { LESSONS, TRACKS } from '@/lib/learn/catalog';
import { markComplete } from '@/lib/learn/progress';
import type { LegendItem, Lesson, Stat, StepTag } from './types';

const TAG_STYLE: Record<StepTag, string> = {
  problem: 'border-red-400/40 bg-red-400/10 text-red-300',
  concept: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
  technique: 'border-violet-400/40 bg-violet-400/10 text-violet-300',
  'trade-off': 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  'in practice': 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  recap: 'border-fd-primary/40 bg-fd-primary/10 text-fd-primary',
};

/** Inline formatting for step copy: **bold** and `code`. */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-fd-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded border border-fd-border bg-fd-muted px-1 py-px font-mono text-[0.85em] text-fd-foreground">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Body({ paragraphs }: { paragraphs: string[] }) {
  const bullets = paragraphs.filter((p) => p.startsWith('- '));
  if (bullets.length === paragraphs.length) {
    return (
      <ul className="space-y-2">
        {bullets.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-fd-primary" />
            <span>{rich(p.slice(2))}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i}>{rich(p)}</p>
      ))}
    </>
  );
}

function StatChip({ stat }: { stat: Stat }) {
  const tone =
    stat.tone === 'bad' ? 'text-red-300' : stat.tone === 'ok' ? 'text-emerald-300' : 'text-fd-foreground';
  return (
    <div className="min-w-0 rounded-lg border border-fd-border bg-fd-background/60 px-3 py-2">
      <div className="truncate font-mono text-[10px] uppercase tracking-wider text-fd-muted-foreground">{stat.label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono text-base font-semibold tabular-nums transition-colors ${tone}`}>{stat.value}</span>
        {stat.hint ? <span className="truncate font-mono text-[11px] text-fd-muted-foreground">{stat.hint}</span> : null}
      </div>
    </div>
  );
}

function LegendSwatch({ item }: { item: LegendItem }) {
  if (item.shape === 'bar') return <span className="h-1.5 w-3.5 rounded-full opacity-70" style={{ background: item.color }} />;
  if (item.shape === 'ring') return <span className="size-2.5 rounded-full border-2" style={{ borderColor: item.color }} />;
  return <span className="size-2 rounded-full" style={{ background: item.color }} />;
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-fd-border bg-fd-muted px-1.5 py-px font-mono text-[10px] text-fd-muted-foreground">
      {children}
    </kbd>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-md border border-fd-border bg-fd-card text-fd-muted-foreground transition-colors hover:border-fd-primary/50 hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-fd-primary"
    >
      {children}
    </button>
  );
}

export function LessonPlayer({ lesson, initialStep }: { lesson: Lesson<unknown>; initialStep: number }) {
  const total = lesson.steps.length;
  const clampStep = (n: number) => Math.min(Math.max(n, 0), total - 1);

  const [stepIdx, setStepIdx] = useState(() => clampStep(initialStep));
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const [maxSeen, setMaxSeen] = useState(stepIdx);
  const stageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);

  const step = lesson.steps[stepIdx];
  useEffect(() => {
    if (stepIdx === total - 1) markComplete(lesson.meta.slug);
  }, [stepIdx, total, lesson.meta.slug]);
  const state = step.frames[frame].state;
  const frameKey = `${stepIdx}-${frame}-${run}`;

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion.current) setFrame(lesson.steps[stepIdx].frames.length - 1);
    // Only on mount: later step changes handle reduced motion in goTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (n: number) => {
      const next = clampStep(n);
      setStepIdx(next);
      setFrame(reducedMotion.current ? lesson.steps[next].frames.length - 1 : 0);
      setPaused(false);
      setRun((r) => r + 1);
      setMaxSeen((m) => Math.max(m, next));
      const url = new URL(window.location.href);
      url.searchParams.set('step', String(next + 1));
      window.history.replaceState(null, '', url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson, total],
  );

  const replay = useCallback(() => {
    setFrame(0);
    setPaused(false);
    setRun((r) => r + 1);
  }, []);

  // Advance through the step's frames.
  useEffect(() => {
    if (paused || frame >= step.frames.length - 1) return;
    const id = window.setTimeout(() => setFrame((f) => f + 1), step.frames[frame].hold ?? 1500);
    return () => window.clearTimeout(id);
  }, [paused, frame, step, run]);

  // Freeze SMIL motion with the rest of the scene. CSS animations pause through data-paused.
  useEffect(() => {
    stageRef.current?.querySelectorAll('svg').forEach((svg) => {
      if (paused) svg.pauseAnimations();
      else svg.unpauseAnimations();
    });
  }, [paused, frameKey]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'ArrowRight') goTo(stepIdx + 1);
      else if (e.key === 'ArrowLeft') goTo(stepIdx - 1);
      else if (e.key === 'r' || e.key === 'R') replay();
      else if (e.key === ' ' && !(t instanceof HTMLButtonElement)) {
        e.preventDefault();
        setPaused((p) => !p);
      } else return;
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, replay, stepIdx]);

  const { meta, Scene } = lesson;
  const stats = lesson.stats(state);
  const next = lesson.steps[stepIdx + 1];
  const track = TRACKS.find((t) => t.id === meta.track);
  const trackLessons = LESSONS.filter((l) => l.track === meta.track);
  const nextLesson = trackLessons[trackLessons.findIndex((l) => l.slug === meta.slug) + 1];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:py-10">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <header className="flex flex-col gap-2">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-mono text-xs text-fd-muted-foreground">
              <Link href="/learn" className="hover:text-fd-foreground">
                Learn
              </Link>
              <span aria-hidden>/</span>
              <Link href={`/learn#${meta.track}`} className="hover:text-fd-foreground">
                {track?.title}
              </Link>
              <span aria-hidden>/</span>
              <span>{meta.section}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{meta.title}</h1>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full border border-fd-border px-2 py-0.5 text-fd-muted-foreground">
                  <Clock className="size-3" aria-hidden /> {meta.minutes} min
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-fd-border px-2 py-0.5 text-fd-muted-foreground">
                  <SignalMedium className="size-3" aria-hidden /> {meta.level}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-fd-border px-2 py-0.5 text-fd-muted-foreground">
                  <ListOrdered className="size-3" aria-hidden /> {total} steps
                </span>
              </div>
            </div>
            <p className="text-sm text-fd-muted-foreground">{meta.subtitle}</p>
          </header>

          <section aria-label="Animation" className="overflow-hidden rounded-xl border border-fd-border bg-fd-card">
            <div className="grid grid-cols-3 gap-2 p-3">
              {stats.map((s) => (
                <StatChip key={s.label} stat={s} />
              ))}
            </div>
            <div ref={stageRef} data-paused={paused} className="lx-stage px-1">
              <Scene state={state} frameKey={frameKey} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-fd-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fd-muted-foreground">
                {lesson.legend.map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1.5">
                    <LegendSwatch item={l} /> {l.label}
                  </span>
                ))}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <IconButton label="Replay step (R)" onClick={replay}>
                  <RotateCcw className="size-4" />
                </IconButton>
                <IconButton label={paused ? 'Play (Space)' : 'Pause (Space)'} onClick={() => setPaused((p) => !p)}>
                  {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                </IconButton>
              </div>
            </div>
          </section>

          <nav aria-label="Lesson steps" className="rounded-xl border border-fd-border bg-fd-card px-4 pb-3 pt-3">
            <div className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-fd-muted-foreground">
              <span>In this lesson</span>
              <span>
                Step {stepIdx + 1} of {total}
              </span>
            </div>
            <ol className="relative flex justify-between">
              <span aria-hidden className="absolute inset-x-3 top-3.5 h-px bg-fd-border" />
              <span
                aria-hidden
                className="absolute left-3 top-3.5 h-px bg-fd-primary/70 transition-[width] duration-500"
                style={{ width: `calc((100% - 1.5rem) * ${stepIdx / (total - 1)})` }}
              />
              {lesson.steps.map((s, i) => {
                const current = i === stepIdx;
                const done = i < stepIdx;
                return (
                  <li key={i} className="relative flex w-7 flex-col items-center">
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={current ? 'step' : undefined}
                      aria-label={`Step ${i + 1}: ${s.label}`}
                      className={`relative grid size-7 place-items-center rounded-full border font-mono text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-fd-primary ${
                        current
                          ? 'border-fd-primary bg-fd-primary text-fd-primary-foreground'
                          : done
                            ? 'border-fd-primary/60 bg-fd-card text-fd-primary hover:bg-fd-primary/10'
                            : 'border-fd-border bg-fd-card text-fd-muted-foreground hover:border-fd-primary/50 hover:text-fd-foreground'
                      }`}
                    >
                      {i + 1}
                    </button>
                    <span
                      className={`absolute top-9 whitespace-nowrap font-mono text-[11px] text-fd-foreground ${
                        current ? '' : 'hidden'
                      } ${i === 0 ? 'left-0' : i === total - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="h-6" />
          </nav>
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
          <section aria-live="polite" className="flex flex-col rounded-xl border border-fd-border bg-fd-card p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-fd-muted-foreground">
                Step {stepIdx + 1} / {total}
              </span>
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${TAG_STYLE[step.tag]}`}>
                {step.tag}
              </span>
            </div>
            <div key={stepIdx} className="lx-in mt-3 flex flex-col gap-3">
              <h2 className="text-lg font-semibold leading-snug">{step.title}</h2>
              <div className="flex flex-col gap-3 text-sm leading-relaxed text-fd-muted-foreground">
                <Body paragraphs={step.body} />
              </div>
              <div className="flex gap-3 rounded-lg border border-fd-primary/25 bg-fd-primary/[0.06] p-3">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-fd-primary" aria-hidden />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-fd-primary">Key idea</div>
                  <p className="mt-1 text-sm leading-relaxed text-fd-foreground/90">{rich(step.keyIdea)}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => goTo(stepIdx - 1)}
                disabled={stepIdx === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border px-3 py-2 text-sm transition-colors hover:bg-fd-muted disabled:pointer-events-none disabled:opacity-40"
              >
                <ArrowLeft className="size-4" aria-hidden /> Back
              </button>
              {next ? (
                <button
                  type="button"
                  onClick={() => goTo(stepIdx + 1)}
                  className="inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg bg-fd-primary px-3 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
                >
                  <span className="truncate">Next: {next.label}</span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </button>
              ) : (
                <Link
                  href={nextLesson ? `/learn/${nextLesson.slug}` : `/learn#${meta.track}`}
                  className="inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg bg-fd-primary px-3 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
                >
                  <span className="truncate">{nextLesson ? `Next lesson: ${nextLesson.title}` : 'All lessons'}</span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </Link>
              )}
            </div>
            <div className="mt-3 hidden items-center gap-1.5 text-[11px] text-fd-muted-foreground md:flex">
              <Kbd>←</Kbd>
              <Kbd>→</Kbd> step
              <span aria-hidden>·</span>
              <Kbd>R</Kbd> replay
              <span aria-hidden>·</span>
              <Kbd>Space</Kbd> pause
            </div>
          </section>

          <section className="rounded-xl border border-fd-border bg-fd-card p-5">
            <h2 className="font-mono text-xs uppercase tracking-wider text-fd-muted-foreground">You&apos;ll learn</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {lesson.objectives.map((o) => {
                const done = maxSeen + 1 >= o.step;
                return (
                  <li key={o.text} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors ${
                        done ? 'border-fd-primary bg-fd-primary text-fd-primary-foreground' : 'border-fd-border'
                      }`}
                    >
                      {done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
                    </span>
                    <span className={done ? 'text-fd-foreground' : 'text-fd-muted-foreground'}>{o.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <Link
            href={meta.notes.href}
            className="group flex items-center gap-3 rounded-xl border border-fd-border bg-fd-card p-4 text-sm transition-colors hover:border-fd-primary/50"
          >
            <BookOpen className="size-4 shrink-0 text-fd-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Read the full notes</span>
              <span className="block truncate text-xs text-fd-muted-foreground">{meta.notes.label}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
