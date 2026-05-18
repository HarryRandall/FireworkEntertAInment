import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

export const TABLE_PAGE_SIZE = 8;

type SearchParams = Record<string, string | undefined>;

type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  searchParams: SearchParams;
  pageKey?: string;
};

function pageHref(searchParams: SearchParams, page: number, pageKey: string) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== pageKey) params.set(key, value);
  }

  if (page > 1) params.set(pageKey, String(page));

  const query = params.toString();
  return query ? `?${query}` : "?";
}

function paginationRange(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export function TablePagination({
  currentPage,
  totalPages,
  searchParams,
  pageKey = "page",
}: TablePaginationProps) {
  if (totalPages <= 1) return null;

  const pages = paginationRange(currentPage, totalPages);

  return (
    <nav
      aria-label="Table pagination"
      className="mt-auto flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="text-sm text-[color:var(--color-content-subtle)]">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          href={pageHref(searchParams, Math.max(1, currentPage - 1), pageKey)}
          variant="secondary"
          size="sm"
          aria-disabled={currentPage === 1}
          className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
        >
          <ChevronLeft size={14} />
          Previous
        </Button>

        {pages.map((page, index) => {
          const previous = pages[index - 1];
          return (
            <span key={page} className="flex items-center gap-1">
              {previous && page - previous > 1 ? (
                <span className="flex h-8 min-w-8 items-center justify-center px-2 text-sm text-[color:var(--color-content-subtle)]">
                  ...
                </span>
              ) : null}
              <Button
                href={pageHref(searchParams, page, pageKey)}
                variant={page === currentPage ? "primary" : "ghost"}
                size="sm"
                aria-current={page === currentPage ? "page" : undefined}
                className="min-w-8 px-2"
              >
                {page}
              </Button>
            </span>
          );
        })}

        <Button
          href={pageHref(searchParams, Math.min(totalPages, currentPage + 1), pageKey)}
          variant="secondary"
          size="sm"
          aria-disabled={currentPage === totalPages}
          className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
        >
          Next
          <ChevronRight size={14} />
        </Button>
      </div>
    </nav>
  );
}
