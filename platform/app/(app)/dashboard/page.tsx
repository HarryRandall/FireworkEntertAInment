/** Authenticated dashboard landing page summarising the user's recent shows and surfacing quick actions. */

import Link from 'next/link';
import { Suspense } from 'react';
import { PlusCircle, Music4, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import { AppPageHeader } from '@/app/components/app/AppPageHeader';
import { CardGridSkeleton } from '@/app/components/app/RouteSkeletons';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { EmptyState } from '@/app/components/ui/Feedback';
import { TablePagination } from '@/app/components/ui/TablePagination';
import { formatBudget, formatDuration, formatRelativeDate } from '@/lib/show-domain';
import { listShowsForCurrentUser } from '@/lib/shows.server';

const ROTATING_ICONS: LucideIcon[] = [Music4, Sparkles, Zap];
const PAGE_SIZE = 6;

function pickIcon(slug: string): LucideIcon {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return ROTATING_ICONS[hash % ROTATING_ICONS.length];
}

type PageProps = {
  searchParams?: Promise<{ page?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const requestedPage = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  return (
    <div>
      <AppPageHeader
        title="Your shows"
        description="Open a draft, or start something new."
        actions={
          <Button href="/shows/new" size="sm">
            <PlusCircle size={14} />
            New show
          </Button>
        }
      />

      <Suspense fallback={<CardGridSkeleton />}>
        <DashboardShows page={page} searchParams={params} />
      </Suspense>
    </div>
  );
}

async function DashboardShows({
  page,
  searchParams,
}: {
  page: number;
  searchParams: Record<string, string | undefined>;
}) {
  const shows = await listShowsForCurrentUser();
  const totalPages = Math.max(1, Math.ceil(shows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleShows = shows.slice(start, start + PAGE_SIZE);

  if (shows.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles size={28} strokeWidth={1.5} />}
        title="No shows yet"
        action={
          <Button href="/shows/new">
            <PlusCircle size={16} />
            Create your first show
          </Button>
        }
      >
        Upload a song and describe the vibe — ShowCrafter will draft your first pyromusical
        choreography in under a minute.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleShows.map((show) => {
          const Icon = pickIcon(show.slug);
          return (
            <Link
              key={show.id}
              href={`/shows/${show.slug}/preview`}
              prefetch
              className="group block rounded-xl focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
            >
              <Card radius="lg" className="p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-default)]">
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <Badge dot tone={show.status === 'complete' ? 'success' : 'neutral'}>
                    {show.status === 'complete' ? 'Complete' : 'Draft'}
                  </Badge>
                </div>
                <h3 className="mb-1 text-base font-semibold text-[color:var(--color-content-emphasis)]">
                  {show.title}
                </h3>
                <p className="mb-5 text-sm text-[color:var(--color-content-subtle)]">
                  {show.artist || 'Unknown artist'}
                  {show.song ? ` — ${show.song}` : ''}
                </p>
                <dl className="grid grid-cols-2 gap-4 border-t border-[color:var(--color-border-subtle)] pt-4 text-sm">
                  <div>
                    <dt className="mb-0.5 text-xs text-[color:var(--color-content-subtle)]">
                      Duration
                    </dt>
                    <dd className="font-medium text-[color:var(--color-content-emphasis)] tabular-nums">
                      {formatDuration(show.durationSeconds)}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-0.5 text-xs text-[color:var(--color-content-subtle)]">
                      Budget
                    </dt>
                    <dd className="font-medium text-[color:var(--color-content-emphasis)] tabular-nums">
                      {formatBudget(show.budgetCents)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="mb-0.5 text-xs text-[color:var(--color-content-subtle)]">
                      Last edited
                    </dt>
                    <dd className="text-[color:var(--color-content-default)]">
                      {formatRelativeDate(show.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </Card>
            </Link>
          );
        })}
        {Array.from({ length: PAGE_SIZE - visibleShows.length }).map((_, i) => (
          <div key={`placeholder-${i}`} aria-hidden className="invisible" />
        ))}
      </div>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        searchParams={searchParams}
      />
    </div>
  );
}
