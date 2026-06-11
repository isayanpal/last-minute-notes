export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0b0b0b] text-foreground">
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-32">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#f5d547]/20 bg-[#f5d547]/5 px-4 py-1.5 text-xs font-medium text-[#f5d547] mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f5d547]" />
          Frontend Interview Prep
        </div>

        <h1 className="text-6xl font-bold tracking-tight text-white md:text-7xl leading-[1.05]">
          The{' '}
          <span className="text-[#f5d547]">Prep Cache</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-zinc-400 leading-relaxed">
          Practical interview prep and production lessons, distilled into
          short, high-signal notes — built from real interviews and day-to-day
          engineering work.
        </p>

        <div className="mt-10 flex items-center gap-4">
          <a
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg bg-[#f5d547] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#f7e06a] active:scale-95"
          >
            Browse notes
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <a
            href="https://github.com/isayanpal/last-minute-notes"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            GitHub
          </a>
        </div>

        <div className="mt-24 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'JavaScript', href: '/docs/javascript', desc: 'Async, closures, event loop' },
            { label: 'TypeScript', href: '/docs/typescript', desc: 'Types, generics, patterns' },
            { label: 'React', href: '/docs/react', desc: 'Hooks, patterns, performance' },
            { label: 'Redux', href: '/docs/redux', desc: 'RTK, state, async' },
          ].map((topic) => (
            <a
              key={topic.href}
              href={topic.href}
              className="group flex flex-col gap-2 rounded-xl border border-white/8 bg-white/3 p-5 transition hover:border-[#f5d547]/30 hover:bg-white/6 no-underline"
            >
              <span className="text-base font-semibold text-[#f5d547]">{topic.label}</span>
              <span className="text-xs text-zinc-500 leading-relaxed">{topic.desc}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
