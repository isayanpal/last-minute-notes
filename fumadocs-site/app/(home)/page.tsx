export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#2c2c2c_0%,#141414_45%,#0b0b0b_100%)] text-foreground">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#f5d547] text-black"></span>
            <span>Last Minute Notes</span>
          </div>
          <a
            href="https://github.com/isayanpal/last-minute-notes"
            target="_blank"
            rel="noreferrer"
            className="text-xs  tracking-[0.2em] text-muted-foreground transition hover:text-[#f5d547]"
          >
            Github
          </a>
        </div>

        <div className="mt-16 max-w-3xl">
          <h1 className="text-5xl font-semibold tracking-tight text-[#f5d547] md:text-6xl">
            The Prep Cache
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Practical interview prep and production lessons, distilled into
            short, high-signal notes.
          </p>
          <p className="mt-4 text-base text-muted-foreground/90">
            Built from real interviews and day-to-day engineering work: core
            JavaScript, TypeScript, React, and Redux, with patterns you can use
            immediately.
          </p>
          <div className="mt-8">
            <a
              href="/docs"
              className="inline-flex items-center rounded-full bg-[#f5d547] px-6 py-2 text-sm font-semibold text-black transition hover:bg-[#f7df6a]"
            >
              Explore the docs
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
