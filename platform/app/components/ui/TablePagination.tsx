/** Pagination control for DataTable: use on any server-paginated list with `searchParams`. */
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TABLE_PAGE_SIZE = 25;

type SearchParams = Record<string, string | undefined>;

type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  searchParams: SearchParams;
  pageKey?: string;
  className?: string;
  visibleItems?: number;
  totalItems?: number;
  itemLabel?: string;
  itemLabelPlural?: string;
};

function pageHref(searchParams: SearchParams, page: number, pageKey: string) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== pageKey) params.set(key, value);
  }

  if (page > 1) params.set(pageKey, String(page));

  const query = params.toString();
  return query ? `?${query}` : '?';
}

function paginationRange(currentPage: number, totalPages: number) {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 2) return [1, 2, 3];
  if (currentPage >= totalPages - 1) return [totalPages - 2, totalPages - 1, totalPages];

  return [currentPage - 1, currentPage, currentPage + 1];
}

function itemSummary({
  currentPage,
  totalPages,
  visibleItems,
  totalItems,
  itemLabel = 'item',
  itemLabelPlural,
}: {
  currentPage: number;
  totalPages: number;
  visibleItems?: number;
  totalItems?: number;
  itemLabel?: string;
  itemLabelPlural?: string;
}) {
  if (totalItems != null) {
    const label = totalItems === 1 ? itemLabel : (itemLabelPlural ?? `${itemLabel}s`);
    return `Viewing ${(visibleItems ?? totalItems).toLocaleString()} out of ${totalItems.toLocaleString()} ${label}`;
  }

  return `Page ${currentPage} of ${totalPages}`;
}

function paginationLinkClasses({
  active = false,
  disabled = false,
}: {
  active?: boolean;
  disabled?: boolean;
}) {
  return cn(
    'inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg border border-transparent px-2 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    active
      ? 'border-border bg-background text-foreground shadow-xs'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    disabled && 'pointer-events-none opacity-50',
  );
}

export function TablePagination({
  currentPage,
  totalPages,
  searchParams,
  pageKey = 'page',
  className,
  visibleItems,
  totalItems,
  itemLabel,
  itemLabelPlural,
}: TablePaginationProps) {
  if (totalPages <= 1 && totalItems == null) return null;

  const pages = paginationRange(currentPage, totalPages);
  const summary = itemSummary({
    currentPage,
    totalPages,
    visibleItems,
    totalItems,
    itemLabel,
    itemLabelPlural,
  });
  const showControls = totalPages > 1;

  return (
    <nav
      aria-label="Table pagination"
      className={cn(
        'flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-muted-foreground text-sm">{summary}</p>

      {showControls ? (
        <ul className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              href={pageHref(searchParams, Math.max(1, currentPage - 1), pageKey)}
              aria-label="Go to previous page"
              aria-disabled={currentPage === 1}
              className={paginationLinkClasses({ disabled: currentPage === 1 })}
            >
              <ChevronLeft size={16} aria-hidden />
              <span className="hidden sm:inline">Previous</span>
            </Link>
          </li>

          {pages[0] > 1 ? (
            <li>
              <span
                aria-hidden
                className="text-muted-foreground flex size-8 items-center justify-center"
              >
                <MoreHorizontal size={16} />
                <span className="sr-only">More pages</span>
              </span>
            </li>
          ) : null}

          {pages.map((page) => (
            <li key={page}>
              <Link
                href={pageHref(searchParams, page, pageKey)}
                aria-current={page === currentPage ? 'page' : undefined}
                className={paginationLinkClasses({ active: page === currentPage })}
              >
                {page}
              </Link>
            </li>
          ))}

          {pages[pages.length - 1] < totalPages ? (
            <li>
              <span
                aria-hidden
                className="text-muted-foreground flex size-8 items-center justify-center"
              >
                <MoreHorizontal size={16} />
                <span className="sr-only">More pages</span>
              </span>
            </li>
          ) : null}

          <li>
            <Link
              href={pageHref(searchParams, Math.min(totalPages, currentPage + 1), pageKey)}
              aria-label="Go to next page"
              aria-disabled={currentPage === totalPages}
              className={paginationLinkClasses({ disabled: currentPage === totalPages })}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight size={16} aria-hidden />
            </Link>
          </li>
        </ul>
      ) : null}
    </nav>
  );
}
