'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { HashState } from './lessons/consistent-hashing/model';
import { BASE4, WITH_E } from './lessons/consistent-hashing/rings';

const HashScene = dynamic(() => import('./lessons/consistent-hashing/Scene').then((m) => m.HashScene), {
  ssr: false,
  loading: () => <div className="aspect-[640/410] w-full" />,
});

const ring = (s: Partial<Extract<HashState, { mode: 'ring' }>> & Pick<Extract<HashState, { mode: 'ring' }>, 'markers'>): HashState => ({
  mode: 'ring',
  showKeys: true,
  showArcs: true,
  ...s,
});

/** A short loop: servers, a key walks clockwise, a server joins and only a few keys move. */
const LOOP: { state: HashState; caption: string }[] = [
  { state: ring({ markers: BASE4 }), caption: 'Servers sit on a hash ring' },
  { state: ring({ markers: BASE4, lookups: [{ angle: 160 }] }), caption: 'A key walks clockwise to its server' },
  { state: ring({ markers: WITH_E, baseline: BASE4 }), caption: 'Add a server: only a slice of keys move' },
  { state: ring({ markers: WITH_E, lookups: [{ angle: 322 }] }), caption: 'Past the top, wrap around' },
];

/** Looping preview of the Consistent Hashing lesson. Runs only while on screen and respects reduced motion. */
export function LearnPreview() {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduced) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % LOOP.length), 3200);
    return () => window.clearInterval(id);
  }, [visible, reduced]);

  const frame = LOOP[i];

  return (
    <Link
      ref={ref}
      href="/learn/consistent-hashing"
      aria-label="Open the Consistent Hashing lesson"
      className="group block w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] transition-colors hover:border-[#f5d547]/40"
    >
      <HashScene state={frame.state} frameKey={`preview-${i}`} />
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5">
        <span key={i} className="lx-fade truncate font-mono text-xs text-zinc-300">
          {frame.caption}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-500 transition-colors group-hover:text-[#f5d547]">
          Consistent Hashing <ArrowRight className="size-3.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
