'use client';

/** Client tab navigation linking the preview, song context, show-guide and shopping-list sub-routes for a show. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Props = { id: string };

export function ShowTabs({ id }: Props) {
  const pathname = usePathname();
  const tabs = [
    { href: `/shows/${id}/preview`, label: 'Live preview' },
    { href: `/shows/${id}/shopping-list`, label: 'Shopping list' },
    { href: `/shows/${id}/show-guide`, label: 'Show guide' },
    { href: `/shows/${id}/timeline`, label: 'Song context' },
  ];

  return (
    <nav aria-label="Show sections" className="flex flex-wrap items-center gap-x-8 gap-y-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 rounded-sm pb-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-3 focus-visible:ring-offset-2',
              active
                ? 'border-primary text-primary border-b-2 font-semibold'
                : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
