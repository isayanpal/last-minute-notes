const HANDLE = 'sayanstwt';

/** Link to the author's X profile: logo plus visible handle. */
export function XLink({ className = '' }: { className?: string }) {
  return (
    <a
      href={`https://x.com/${HANDLE}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`Sayan on X (Twitter): @${HANDLE}`}
      className={`inline-flex items-center gap-2 rounded-lg bg-[#f5f5f5] px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-[#e6e6e6] active:scale-95 ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      @{HANDLE}
    </a>
  );
}
