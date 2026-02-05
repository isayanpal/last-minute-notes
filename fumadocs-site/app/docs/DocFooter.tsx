'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'fumadocs-core/link';
import { useFooterItems } from '@fumadocs/ui/hooks/use-footer-items';
import { isActive } from '@fumadocs/ui/urls';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Item as PageTreeItem } from 'fumadocs-core/page-tree';

export default function DocFooter() {
  const footerList = useFooterItems();
  const pathname = usePathname();

  const { previous, next } = useMemo(() => {
    const idx = footerList.findIndex((item) => isActive(item.url, pathname, false));
    if (idx === -1) return {};
    return {
      previous: footerList[idx - 1],
      next: footerList[idx + 1],
    };
  }, [footerList, pathname]);

  const columnClass = previous && next ? 'md:grid-cols-3' : 'md:grid-cols-2';

  return (
    <div className={`grid gap-4 ${columnClass}`}>
      {previous ? <FooterItemLink item={previous} index={0} /> : null}
      <Link
        href="/"
        className="flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent/80 hover:text-fd-accent-foreground"
      >
        Home
      </Link>
      {next ? <FooterItemLink item={next} index={1} /> : null}
    </div>
  );
}

function FooterItemLink({ item, index }: { item: PageTreeItem; index: 0 | 1 }) {
  const Icon = index === 0 ? ChevronLeft : ChevronRight;

  return (
    <Link
      href={item.url}
      className={`flex flex-col gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-fd-accent/80 hover:text-fd-accent-foreground ${index === 1 ? 'text-end' : ''}`}
    >
      <div
        className={`inline-flex items-center gap-1.5 font-medium ${index === 1 ? 'flex-row-reverse' : ''}`}
      >
        <Icon className="-mx-1 size-4 shrink-0 rtl:rotate-180" />
        <p>{item.name}</p>
      </div>
      <p className="text-fd-muted-foreground truncate">
        {item.description ?? (index === 0 ? 'Previous page' : 'Next page')}
      </p>
    </Link>
  );
}
