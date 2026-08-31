'use client';

/** Client navigation linking the four show workspace sections. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { SHOW_DETAIL_SECTIONS } from './show-detail-sections';

type Props = {
  id: string;
  prefetch?: boolean;
};

export function ShowTabs({ id, prefetch = true }: Props) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <nav aria-label="Show sections" className="flex flex-wrap items-center gap-1.5">
      {SHOW_DETAIL_SECTIONS.map((section) => {
        const href = `/shows/${id}/${section.segment}`;
        const active = pathname === href;
        const pending = pendingHref === href;
        return (
          <Link
            key={section.segment}
            href={href}
            prefetch={prefetch}
            aria-current={active ? 'page' : undefined}
            aria-busy={pending || undefined}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              if (
                active ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              setPendingHref(href);
            }}
            className={cn(
              'focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-[color,background-color,box-shadow,transform] focus:outline-none focus-visible:ring-3 focus-visible:ring-offset-2 active:scale-[0.98]',
              active || pending
                ? 'text-foreground bg-[color:var(--accent)] font-semibold shadow-sm ring-1 ring-[color:var(--color-border-subtle)] ring-inset'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-[color:color-mix(in_srgb,var(--accent)_55%,transparent)]',
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
