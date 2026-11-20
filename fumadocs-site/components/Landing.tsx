'use client';

import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { ArrowRight, Play, Search, Terminal, Waypoints, Zap } from 'lucide-react';
import { LESSONS } from '@/lib/learn/catalog';
import type { TreeItem } from '@/lib/topics';
import { LearnPreview } from './learn/LearnPreview';
import { ICONS } from './TopicTreeClient';
import { HeroTree } from './HeroTree';

// Display order of the topic grid (featured cards span 2). With an odd topic count the last row is short.
const GRID_ORDER = [
  'system-design', 'frontend-system-design', 'javascript', 'typescript', 'react', 'react-native', 'nextjs', 'redux',
  'dsa', 'backend', 'databases', 'networking', 'operating-systems', 'computer-fundamentals',
  'sdui', 'sdlc', 'java', 'python', 'oops',
];
const FEATURED = new Set<string>();

const vars = (v: Record<string, string | number>) => v as CSSProperties;

function trackPointer(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

/** Fades and lifts its children in once they scroll into view. */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-in={shown} style={vars({ '--d': `${delay}ms` })} className={`lp-reveal ${className}`}>
      {children}
    </div>
  );
}

function SearchButton({ className = '', children }: { className?: string; children: ReactNode }) {
  const { setOpenSearch } = useSearchContext();
  return (
    <button type="button" onClick={() => setOpenSearch(true)} className={className}>
      {children}
    </button>
  );
}

function RotatingWord({ words }: { words: string[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % words.length), 2200);
    return () => window.clearInterval(id);
  }, [words.length]);

  return (
    <span className="relative mt-1 block h-[1.3em] overflow-clip" aria-live="off">
      <span key={i} className="lp-word absolute inset-x-0 top-0 whitespace-nowrap text-center text-[#f5d547]">
        {words[i]}
      </span>
    </span>
  );
}

function HeroCard({
  eyebrow,
  meta,
  title,
  action,
  delay,
  children,
}: {
  eyebrow: string;
  meta: string;
  title: string;
  action: ReactNode;
  delay: number;
  children: ReactNode;
}) {
  return (
    <div
      style={vars({ animationDelay: `${delay}ms` })}
      className="lp-rise flex flex-col rounded-2xl border border-white/10 bg-[#111]/80 p-4 backdrop-blur-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-baseline gap-2 text-base font-semibold text-white">
          <span className="text-xs font-medium tracking-wide text-[#f5d547] uppercase">{eyebrow}</span>
          {title}
        </h2>
        <p className="font-mono text-xs text-zinc-500">{meta}</p>
      </div>
      <div className="flex flex-1 items-center justify-center py-3 [&_svg]:max-h-[clamp(150px,29vh,236px)]">{children}</div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">{action}</div>
    </div>
  );
}

function Hero({ topics }: { topics: TreeItem[] }) {
  const words = topics.map((t) => t.title);
  const totalPages = topics.reduce((sum, t) => sum + t.pages, 0);

  return (
    <section
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--hx', `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty('--hy', `${e.clientY - r.top}px`);
      }}
      className="relative isolate overflow-hidden"
    >
      <div aria-hidden className="lp-grid absolute inset-0 -z-10" />
      <div aria-hidden className="lp-spot absolute inset-0 -z-10" />
      <div aria-hidden className="lp-orb absolute -top-24 left-[8%] -z-10 size-[420px] bg-[#f5d547]/15" />
      <div
        aria-hidden
        className="lp-orb absolute top-40 right-[4%] -z-10 size-[360px] bg-[#f59e0b]/10 [animation-delay:-6s]"
      />

      <div className="mx-auto max-w-6xl px-6 pt-8 pb-12 lg:pt-10 lg:pb-14">
        <div className="mx-auto max-w-3xl text-center">
          <div className="lp-rise inline-flex items-center gap-2 rounded-full border border-[#f5d547]/25 bg-[#f5d547]/5 px-4 py-1.5 text-xs font-medium text-[#f5d547]">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#f5d547] opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[#f5d547]" />
            </span>
            Software Engineer Interview Prep
          </div>

          <h1 className="lp-rise mt-4 text-4xl leading-[1.02] font-bold tracking-tight text-white [animation-delay:80ms] md:text-6xl">
            The <span className="lp-shine">Prep Cache</span>
          </h1>

          <p className="lp-rise mt-2.5 text-xl font-semibold text-zinc-200 [animation-delay:160ms] md:text-2xl">
            Last-minute prep for <RotatingWord words={words} />
          </p>


          <SearchButton className="lp-rise group mx-auto mt-5 flex w-full max-w-md cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-left text-sm text-zinc-500 transition hover:border-[#f5d547]/40 hover:bg-white/6 [animation-delay:240ms]">
            <Search className="size-4 text-zinc-500 transition-colors group-hover:text-[#f5d547]" />
            <span className="flex-1">Search notes, patterns, questions...</span>
            <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
              ⌘ K
            </kbd>
          </SearchButton>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          <HeroCard
            eyebrow="Read"
            meta={`${totalPages} pages`}
            title="The notes"
            delay={320}
            action={
              <Link
                href="/docs"
                className="group inline-flex items-center gap-2 rounded-lg bg-[#f5d547] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(245,213,71,0.6)] transition hover:bg-[#f7e06a] active:scale-95"
              >
                Browse notes
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            }
          >
            <HeroTree topics={topics} />
          </HeroCard>

          <HeroCard
            eyebrow="Watch"
            meta={`${LESSONS.length} lessons`}
            title="Interactive lessons"
            delay={400}
            action={
              <>
                <Link
                  href="/learn"
                  className="group inline-flex items-center gap-2 rounded-lg border border-[#f5d547]/40 bg-[#f5d547]/10 px-4 py-2 text-sm font-semibold text-[#f5d547] transition hover:border-[#f5d547]/70 hover:bg-[#f5d547]/20 active:scale-95"
                >
                  <Play className="size-3.5 fill-current" aria-hidden />
                  Watch it run
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <span className="flex items-center gap-3 text-xs text-zinc-500">
                  <Link href="/learn#system-design" className="transition-colors hover:text-[#f5d547]">
                    System Design <span className="font-mono">{LESSONS.filter((l) => l.track === 'system-design').length}</span>
                  </Link>
                  <Link href="/learn#dsa" className="transition-colors hover:text-[#f5d547]">
                    DSA <span className="font-mono">{LESSONS.filter((l) => l.track === 'dsa').length}</span>
                  </Link>
                </span>
              </>
            }
          >
            <LearnPreview />
          </HeroCard>
        </div>
      </div>
    </section>
  );
}

function TopicCard({ topic, index }: { topic: TreeItem; index: number }) {
  const featured = FEATURED.has(topic.icon ?? '');
  const Icon = ICONS[topic.icon ?? ''];
  const chips = (topic.children ?? []).slice(0, 5);
  const learnTrack = topic.icon === 'dsa' ? 'dsa' : 'system-design';
  const lessonCount = topic.icon === 'dsa' || topic.icon === 'system-design' ? LESSONS.filter((l) => l.track === learnTrack).length : 0;

  return (
    <Reveal delay={index * 60} className={`relative ${featured ? 'sm:col-span-2' : ''}`}>
      <Link
        href={topic.url ?? '/docs'}
        onPointerMove={trackPointer}
        className="lp-card group relative flex h-full min-h-44 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111] p-5 no-underline transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#f5d547]"
      >
        <div className="flex items-start justify-between">
          <span className="grid size-10 place-items-center rounded-xl border border-[#f5d547]/20 bg-[#f5d547]/8 text-[#f5d547] transition-colors duration-300 group-hover:bg-[#f5d547] group-hover:text-black">
            {Icon ? <Icon className="size-5" /> : null}
          </span>
          <span className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-medium tabular-nums text-zinc-400">
            {topic.pages} pages
          </span>
        </div>

        <h3 className="mt-5 text-lg font-semibold text-white">{topic.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{topic.description}</p>

        {featured && chips.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c.id} className="rounded-md border border-white/10 bg-white/4 px-2 py-0.5 text-xs text-zinc-400">
                {c.title}
              </span>
            ))}
          </div>
        ) : null}

        <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-medium text-zinc-500 transition-colors group-hover:text-[#f5d547]">
          Open
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </Link>
      {lessonCount > 0 ? (
        <Link
          href={`/learn#${learnTrack}`}
          className="absolute right-4 bottom-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-[#f5d547]/30 bg-[#0b0b0b]/90 px-3 py-1 text-xs font-medium text-[#f5d547] transition hover:border-[#f5d547]/70 hover:bg-[#f5d547]/10"
        >
          <Play className="size-3 fill-current" aria-hidden />
          {lessonCount} interactive lessons
        </Link>
      ) : null}
    </Reveal>
  );
}

function Topics({ topics }: { topics: TreeItem[] }) {
  const ordered = [
    ...GRID_ORDER.map((slug) => topics.find((t) => t.icon === slug)).filter((t): t is TreeItem => Boolean(t)),
    ...topics.filter((t) => !GRID_ORDER.includes(t.icon ?? '')),
  ];

  return (
    <section className="mx-auto mt-28 max-w-6xl px-6">
      <Reveal>
        <p className="text-sm font-medium tracking-wide text-[#f5d547] uppercase">Topics</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">
          Everything you might get asked, one branch at a time.
        </h2>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((t, i) => (
          <TopicCard key={t.id} topic={t} index={i} />
        ))}
      </div>
    </section>
  );
}

function Features({ diagrams }: { diagrams: number }) {
  const items = [
    {
      icon: Zap,
      title: 'Short and dense',
      body: 'Each note is written to be skimmed. You can revise a whole topic in one sitting, not one weekend.',
    },
    {
      icon: Waypoints,
      title: 'Diagrams over walls of text',
      body: `${diagrams} flowcharts and diagrams show how each idea actually works, from the event loop to a full system design.`,
    },
    {
      icon: Terminal,
      title: 'Code that runs',
      body: 'Java, JavaScript, and TypeScript snippets in the system design notes were compiled and run, not just typed.',
    },
  ];

  return (
    <section className="mx-auto mt-28 max-w-6xl px-6">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((f, i) => (
          <Reveal key={f.title} delay={i * 80}>
            <div
              onPointerMove={trackPointer}
              className="lp-card relative h-full overflow-hidden rounded-2xl border border-white/10 bg-[#111] p-6"
            >
              <f.icon className="size-5 text-[#f5d547]" />
              <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto mt-28 max-w-6xl px-6 pb-20">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-3xl border border-[#f5d547]/25 bg-[#14120a] px-8 py-14 text-center">
          <div aria-hidden className="lp-grid absolute inset-0 -z-10 opacity-60" />
          <div aria-hidden className="lp-orb absolute -bottom-40 left-1/2 -z-10 size-[420px] -translate-x-1/2 bg-[#f5d547]/20" />
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Interview tomorrow?</h2>
          <p className="mx-auto mt-3 max-w-md text-zinc-400">
            Start from the tree, then search for whatever you forgot.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs"
              className="group inline-flex items-center gap-2 rounded-lg bg-[#f5d547] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#f7e06a] active:scale-95"
            >
              Open the tree
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <SearchButton className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white active:scale-95">
              <Search className="size-4" />
              Search
            </SearchButton>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 py-6 text-center text-xs text-zinc-500">
      Made by{' '}
      <a
        href="https://github.com/isayanpal"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-zinc-400 transition-colors hover:text-[#f5d547]"
      >
        isayanpal
      </a>
    </footer>
  );
}

export function Landing({ topics, diagrams }: { topics: TreeItem[]; diagrams: number }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0b0b0b] text-foreground">
      <Hero topics={topics} />
      <Topics topics={topics} />
      <Features diagrams={diagrams} />
      <FinalCta />
      <Footer />
    </main>
  );
}
