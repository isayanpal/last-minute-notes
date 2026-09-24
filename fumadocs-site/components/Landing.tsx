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
import { ArrowRight, Search, Terminal, Waypoints, Zap } from 'lucide-react';
import type { TreeItem } from '@/lib/topics';
import { ICONS } from './TopicTreeClient';
import { HeroTree } from './HeroTree';

const GITHUB = 'https://github.com/isayanpal/last-minute-notes';

// Order that lets both the 2-column and 3-column grids fill without gaps (featured cards span 2).
const GRID_ORDER = [
  'system-design', 'javascript', 'typescript', 'react', 'redux',
  'dsa', 'backend', 'databases', 'networking', 'operating-systems', 'computer-fundamentals',
  'sdui', 'sdlc', 'java', 'oops',
];
const FEATURED = new Set(['system-design', 'dsa', 'networking']);

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
    <span className="relative inline-block min-w-[9ch] overflow-clip">
      <span key={i} className="lp-word absolute inset-x-0 top-0 whitespace-nowrap text-[#f5d547]">
        {words[i]}
      </span>
      <span aria-hidden className="invisible whitespace-nowrap">
        {[...words].sort((a, b) => b.length - a.length)[0]}
      </span>
    </span>
  );
}

function Hero({ topics }: { topics: TreeItem[] }) {
  const words = topics.map((t) => t.title);

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

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-20 pb-24 lg:grid-cols-[1.05fr_0.95fr] lg:pt-28 lg:pb-32">
        <div>
          <div className="lp-rise inline-flex items-center gap-2 rounded-full border border-[#f5d547]/25 bg-[#f5d547]/5 px-4 py-1.5 text-xs font-medium text-[#f5d547]">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#f5d547] opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[#f5d547]" />
            </span>
            Software Engineer Interview Prep
          </div>

          <h1 className="lp-rise mt-7 text-6xl leading-[1.02] font-bold tracking-tight text-white [animation-delay:80ms] md:text-7xl">
            The <span className="lp-shine">Prep Cache</span>
          </h1>

          <p className="lp-rise mt-4 text-2xl font-semibold text-zinc-200 [animation-delay:160ms] md:text-3xl">
            Last-minute prep for <RotatingWord words={words} />
          </p>

          <p className="lp-rise mt-6 max-w-xl text-lg leading-relaxed text-zinc-400 [animation-delay:240ms]">
            Practical interview prep and production lessons, distilled into short, high-signal notes. Built from real
            interviews and day-to-day engineering work.
          </p>

          <div className="lp-rise mt-9 flex flex-wrap items-center gap-3 [animation-delay:320ms]">
            <Link
              href="/docs"
              className="group inline-flex items-center gap-2 rounded-lg bg-[#f5d547] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_0_30px_-6px_rgba(245,213,71,0.6)] transition hover:bg-[#f7e06a] active:scale-95"
            >
              Browse notes
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href={GITHUB}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
          </div>

          <SearchButton className="lp-rise group mt-6 flex w-full max-w-md cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-left text-sm text-zinc-500 transition hover:border-[#f5d547]/40 hover:bg-white/6 [animation-delay:400ms]">
            <Search className="size-4 text-zinc-500 transition-colors group-hover:text-[#f5d547]" />
            <span className="flex-1">Search notes, patterns, questions...</span>
            <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
              ⌘ K
            </kbd>
          </SearchButton>
        </div>

        <div className="lp-rise [animation-delay:200ms]">
          <HeroTree topics={topics} />
        </div>
      </div>
    </section>
  );
}

function TopicCard({ topic, index }: { topic: TreeItem; index: number }) {
  const featured = FEATURED.has(topic.icon ?? '');
  const Icon = ICONS[topic.icon ?? ''];
  const chips = (topic.children ?? []).slice(0, 5);

  return (
    <Reveal delay={index * 60} className={featured ? 'sm:col-span-2' : ''}>
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
