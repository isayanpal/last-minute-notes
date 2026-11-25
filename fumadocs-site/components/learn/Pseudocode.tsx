'use client';

import { Fragment } from 'react';
import { ListOrdered } from 'lucide-react';

const KEYWORDS = new Set([
  'for', 'each', 'while', 'if', 'else', 'return', 'repeat', 'until', 'in', 'to', 'and', 'or', 'not', 'then', 'do', 'break', 'continue', 'swap', 'push', 'pop', 'add', 'remove', 'mark', 'visit', 'skip', 'stop',
]);

/** Colour keywords and numbers in one line of pseudocode. Indentation is kept as written. */
function Line({ text }: { text: string }) {
  const parts = text.split(/(\s+|[()[\]{},.:=<>+\-*/%!&|^]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (KEYWORDS.has(p)) return <span key={i} className="text-fd-primary">{p}</span>;
        if (/^\d+$/.test(p)) return <span key={i} className="text-sky-300">{p}</span>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function Pseudocode({ lines, active }: { lines: string[]; active: number[] }) {
  return (
    <section aria-label="Pseudocode" className="overflow-hidden rounded-xl border border-fd-border bg-fd-card">
      <h2 className="flex items-center gap-2.5 px-5 pb-3 pt-4 text-base font-semibold">
        <ListOrdered className="size-[18px] text-fd-primary" aria-hidden /> Pseudocode
      </h2>
      <ol className="border-t border-fd-border bg-fd-background/60 py-2 font-mono text-[12.5px] leading-6">
        {lines.map((text, i) => {
          const on = active.includes(i + 1);
          return (
            <li
              key={i}
              aria-current={on ? 'step' : undefined}
              className={`relative flex gap-3 whitespace-pre px-5 transition-colors duration-300 ${on ? 'bg-fd-primary/12 text-fd-foreground' : 'text-fd-muted-foreground'}`}
            >
              <span aria-hidden className={`absolute inset-y-0 left-0 w-0.5 transition-opacity duration-300 ${on ? 'bg-fd-primary opacity-100' : 'opacity-0'}`} />
              <span aria-hidden className="w-4 shrink-0 select-none text-right text-[11px] text-fd-muted-foreground/60">
                {i + 1}
              </span>
              <span className="min-w-0">{text.trim() === '' ? ' ' : <Line text={text} />}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
