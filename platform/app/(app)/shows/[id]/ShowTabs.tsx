'use client';

/** Client navigation linking the four show workspace sections. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SHOW_DETAIL_SECTIONS } from './show-detail-sections';

type Props = {
  id: string;
  prefetch?: boolean;
};

export function ShowTabs({ id, prefetch = true }: Props) {
  const pathname = usePathname();

  return (
    <nav aria-label="Show sections" className="flex flex-wrap items-center gap-x-8 gap-y-2">
      {SHOW_DETAIL_SECTIONS.map((section) => {
        const href = `/shows/${id}/${section.segment}`;
        const active = pathname === href;
        return (
          <Link
            key={section.segment}
            href={href}
            prefetch={prefetch}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 rounded-sm pb-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-3 focus-visible:ring-offset-2',
              active
                ? 'border-primary text-primary border-b-2 font-semibold'
                : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent',
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
