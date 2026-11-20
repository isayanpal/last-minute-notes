import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock, ListOrdered } from 'lucide-react';
import { LESSONS, TRACKS, type LessonMeta } from '@/lib/learn/catalog';

export const metadata: Metadata = {
  title: 'Learn · Last Minute Notes',
  description: 'Interactive, step by step system design and DSA lessons built from the notes.',
};

const LEVEL_DOT: Record<LessonMeta['level'], string> = {
  Beginner: 'bg-emerald-400',
  Intermediate: 'bg-amber-400',
  Advanced: 'bg-red-400',
};

function LessonCard({ l, n }: { l: LessonMeta; n: number }) {
  return (
    <Link
      href={`/learn/${l.slug}`}
      className="group flex h-full flex-col rounded-xl border border-fd-border bg-fd-card p-4 transition-colors hover:border-fd-primary/50"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="font-mono text-[11px] text-fd-muted-foreground">{String(n).padStart(2, '0')}</span>
          <span className="font-semibold leading-snug">{l.title}</span>
        </span>
        <ArrowRight
          className="mt-0.5 size-4 shrink-0 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-fd-primary"
          aria-hidden
        />
      </span>
      <span className="mt-1.5 text-sm text-fd-muted-foreground">{l.subtitle}</span>
      <span className="mt-auto flex flex-wrap gap-3 pt-4 font-mono text-[11px] text-fd-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" aria-hidden /> {l.minutes} min
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${LEVEL_DOT[l.level]}`} aria-hidden />
          {l.level}
        </span>
        <span className="inline-flex items-center gap-1">
          <ListOrdered className="size-3" aria-hidden /> {l.steps} steps
        </span>
      </span>
    </Link>
  );
}

export default function LearnPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 md:py-14">
      <header className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-wider text-fd-primary">Learn</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Learn by watching it run</h1>
        <p className="mt-3 text-fd-muted-foreground">
          {LESSONS.length} lessons, each one idea walked through with an animated diagram you can step, replay and pause. Every lesson links
          back to the full notes.
        </p>
        <nav aria-label="Tracks" className="mt-5 flex flex-wrap gap-2">
          {TRACKS.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="rounded-full border border-fd-border px-3 py-1 text-sm text-fd-muted-foreground transition-colors hover:border-fd-primary/50 hover:text-fd-foreground"
            >
              {t.title} <span className="font-mono text-xs">{LESSONS.filter((l) => l.track === t.id).length}</span>
            </a>
          ))}
        </nav>
      </header>

      {TRACKS.map((t) => {
        const lessons = LESSONS.filter((l) => l.track === t.id);
        const sections = [...new Set(lessons.map((l) => l.section))];
        let n = 0;
        return (
          <section key={t.id} id={t.id} className="mt-14 scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight">{t.title}</h2>
            <p className="mt-1 text-sm text-fd-muted-foreground">{t.blurb}</p>
            {sections.map((section, si) => (
              <div key={section} className="mt-8">
                <h3 className="font-mono text-xs uppercase tracking-wider text-fd-muted-foreground">
                  {String(si + 1).padStart(2, '0')}. {section}
                </h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {lessons
                    .filter((l) => l.section === section)
                    .map((l) => (
                      <li key={l.slug}>
                        <LessonCard l={l} n={++n} />
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
