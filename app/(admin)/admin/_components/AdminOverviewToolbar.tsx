'use client';

import { useCallback, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ADMIN_OVERVIEW_RANGE_OPTIONS,
  ADMIN_OVERVIEW_RANGE_PARAM,
  DEFAULT_ADMIN_OVERVIEW_RANGE_KEY,
  type AdminOverviewRangeKey,
} from '@/lib/admin/overview-range';

export function AdminOverviewToolbar({ range }: { range?: AdminOverviewRangeKey }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateRange = useCallback(
    (value: string) => {
      const nextRange = value as AdminOverviewRangeKey;
      const params = new URLSearchParams(searchParams.toString());

      if (nextRange === DEFAULT_ADMIN_OVERVIEW_RANGE_KEY) {
        params.delete(ADMIN_OVERVIEW_RANGE_PARAM);
      } else {
        params.set(ADMIN_OVERVIEW_RANGE_PARAM, nextRange);
      }

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  if (!range) return null;

  return (
    <div className="flex items-center gap-2" data-pending={isPending || undefined}>
      <Select value={range} onValueChange={updateRange}>
        <SelectTrigger aria-label="Dashboard range" className="w-40">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {ADMIN_OVERVIEW_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
