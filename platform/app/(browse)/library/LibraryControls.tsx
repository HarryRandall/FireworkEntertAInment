'use client';

/** Client-side filter/sort controls rendered in the library page header. */

import { Check, ChevronDown, ListFilter } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/app/components/ui/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type SortKey = 'popular' | 'recent' | 'featured' | 'shortest' | 'budget';

type LibraryControlsProps = {
  sort: SortKey;
  sorts: { key: SortKey; label: string }[];
};

export function LibraryControls({ sort, sorts }: LibraryControlsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSort = sorts.find((item) => item.key === sort);

  const setSort = (next: SortKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next !== 'popular') params.set('sort', next);
    else params.delete('sort');

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex justify-end">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            size="md"
            className="h-9 max-w-full justify-start gap-2 rounded-md px-3"
            aria-label="Sort show library"
          >
            <ListFilter size={15} className="shrink-0 text-[color:var(--color-content-subtle)]" />
            <span className="shrink-0 text-[color:var(--color-content-subtle)]">Sort:</span>
            <span className="min-w-0 truncate">{selectedSort?.label ?? 'Most popular'}</span>
            <ChevronDown
              size={15}
              className="ml-1 shrink-0 text-[color:var(--color-content-subtle)]"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1">
          <Command>
            <CommandList>
              <CommandEmpty>No sort options.</CommandEmpty>
              <CommandGroup>
                {sorts.map((item) => {
                  const selected = item.key === sort;
                  return (
                    <CommandItem
                      key={item.key}
                      value={item.label}
                      onSelect={() => setSort(item.key)}
                      className="rounded-md"
                    >
                      <span className="flex h-4 w-4 items-center justify-center">
                        {selected ? <Check size={14} /> : null}
                      </span>
                      {item.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
