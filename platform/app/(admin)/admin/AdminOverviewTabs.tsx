'use client';

import { useCallback, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs } from '@/components/ui/tabs';
import {
  ADMIN_OVERVIEW_TAB_PARAM,
  DEFAULT_ADMIN_OVERVIEW_TAB_KEY,
  type AdminOverviewTabKey,
} from '@/lib/admin/overview-tabs';

export function AdminOverviewTabs({
  children,
  tab,
}: {
  children: ReactNode;
  tab?: AdminOverviewTabKey;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedTab = tab ?? DEFAULT_ADMIN_OVERVIEW_TAB_KEY;

  const updateTab = useCallback(
    (value: string) => {
      const nextTab = value as AdminOverviewTabKey;
      const params = new URLSearchParams(searchParams.toString());

      if (nextTab === DEFAULT_ADMIN_OVERVIEW_TAB_KEY) {
        params.delete(ADMIN_OVERVIEW_TAB_PARAM);
      } else {
        params.set(ADMIN_OVERVIEW_TAB_PARAM, nextTab);
      }

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <Tabs
      value={selectedTab}
      onValueChange={updateTab}
      className="flex flex-col gap-4"
      data-pending={isPending || undefined}
    >
      {children}
    </Tabs>
  );
}
