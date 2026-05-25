'use client';

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
    { href: `/shows/${id}/timeline`, label: 'Timeline' },
  ];

  return (
    <nav className="border-outline-variant/10 flex flex-wrap items-center gap-x-8 gap-y-2 border-b">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            className={cn(
              'pb-4 text-sm font-medium transition-colors',
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
