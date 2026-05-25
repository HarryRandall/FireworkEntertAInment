'use client';

/** Trailing row-actions dropdown (3-dots) used in DataTable rows. */
import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type RowAction = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type RowActionsMenuProps = {
  items: RowAction[];
  label?: string;
};

export function RowActionsMenu({ items, label = 'Actions' }: RowActionsMenuProps) {
  const safeItems = items.filter(Boolean);
  const firstDestructiveIndex = safeItems.findIndex((i) => i.destructive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {safeItems.map((item, index) => (
          <span key={`${item.label}-${index}`}>
            {item.destructive && firstDestructiveIndex === index && index > 0 ? (
              <DropdownMenuSeparator />
            ) : null}
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                if (!item.disabled) item.onSelect();
              }}
              disabled={item.disabled}
              variant={item.destructive ? 'destructive' : 'default'}
              className={cn(
                'gap-2',
                item.destructive &&
                  'text-[color:var(--color-status-danger)] focus:bg-[color:var(--color-status-danger-subtle)] focus:text-[color:var(--color-status-danger)] data-[highlighted]:text-[color:var(--color-status-danger)]',
              )}
            >
              {item.icon ? <span className="flex h-4 w-4 items-center">{item.icon}</span> : null}
              {item.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
