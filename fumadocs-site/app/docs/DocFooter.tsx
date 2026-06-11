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

  if (!previous && !next) return null;

  return (
    <div className="mt-2 grid grid-cols-2 gap-3">
      <div>{previous ? <FooterItemLink item={previous} index={0} /> : null}</div>
      <div>{next ? <FooterItemLink item={next} index={1} /> : null}</div>
    </div>
  );
}

function FooterItemLink({ item, index }: { item: PageTreeItem; index: 0 | 1 }) {
  const Icon = index === 0 ? ChevronLeft : ChevronRight;

  return (
    <Link
      href={item.url}
      className={`group flex flex-col gap-1 rounded-lg border border-white/10 bg-white/4 px-4 py-3 text-sm transition hover:border-[#f5d547]/30 hover:bg-white/6 ${index === 1 ? 'items-end text-end' : 'items-start'}`}
    >
      <div className={`inline-flex items-center gap-1 text-xs text-zinc-500 group-hover:text-[#f5d547] ${index === 1 ? 'flex-row-reverse' : ''}`}>
        <Icon className="size-3 shrink-0" />
        <span>{index === 0 ? 'Previous' : 'Next'}</span>
      </div>
      <p className="font-medium text-zinc-300 group-hover:text-white truncate max-w-50">
        {item.name}
      </p>
    </Link>
  );
}
