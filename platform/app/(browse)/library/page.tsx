/** Explore page: music-app style shelves of curated show templates. */

import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { LibraryCardsSkeleton, LibraryGridSkeleton } from '@/app/components/app/RouteSkeletons';
import { ExploreCard } from '@/app/components/app/ExploreCard';
import { ExploreRow } from '@/app/components/app/ExploreRow';
import { ExplorePreviewProvider } from '@/app/components/app/ExplorePreviewContext';
import { listShowTemplates } from '@/lib/admin.server';
import type { ShowTemplateSummary } from '@/lib/show-template-summary';

type Shelf = {
  sort: LibrarySort;
  title: string;
  seeAllHref: string;
  templates: ShowTemplateSummary[];
};

type LibrarySort = 'featured' | 'popular' | 'curated' | 'recent' | 'shortest' | 'budget';

const SORT_LABELS: Record<LibrarySort, string> = {
  featured: 'Staff picks',
  popular: 'Most liked',
  curated: 'More to explore',
  recent: 'Recently updated',
  shortest: 'Quick bursts',
  budget: 'Highest budgets',
};
// Keep the landing route responsive on mobile. Full collections remain
// available through each shelf's factual "See all" route.
const SHOWS_PER_SHELF = 12;

function parseSort(value: string | undefined): LibrarySort | null {
  if (
    value === 'featured' ||
    value === 'popular' ||
    value === 'curated' ||
    value === 'recent' ||
    value === 'shortest' ||
    value === 'budget'
  ) {
    return value;
  }
  return null;
}

function sortTemplates(templates: ShowTemplateSummary[], sort: LibrarySort): ShowTemplateSummary[] {
  if (sort === 'popular') return [...templates].sort((a, b) => b.likeCount - a.likeCount);
  if (sort === 'featured') {
    return [...templates].sort(
      (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.likeCount - a.likeCount,
    );
  }
  if (sort === 'recent') {
    return [...templates].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  if (sort === 'shortest') {
    return [...templates].sort(
      (a, b) =>
        (a.durationSeconds ?? Number.MAX_SAFE_INTEGER) -
        (b.durationSeconds ?? Number.MAX_SAFE_INTEGER),
    );
  }
  if (sort === 'budget') {
    return [...templates].sort((a, b) => b.totalCents - a.totalCents);
  }
  return [...templates].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

function templateMatchesShelf(template: ShowTemplateSummary, sort: LibrarySort): boolean {
  if (sort === 'featured') return template.isFeatured;
  if (sort === 'shortest') return (template.durationSeconds ?? Number.MAX_SAFE_INTEGER) <= 75;
  return true;
}

function templatesForShelf(
  templates: ShowTemplateSummary[],
  sort: LibrarySort,
  limit?: number,
  usedTemplateIds = new Set<string>(),
  usedCompositionSignatures = new Set<string>(),
): ShowTemplateSummary[] {
  const matching = sortTemplates(templates, sort).filter((template) =>
    templateMatchesShelf(template, sort),
  );
  const selected: ShowTemplateSummary[] = [];

  for (const template of matching) {
    if (
      usedTemplateIds.has(template.id) ||
      usedCompositionSignatures.has(template.compositionSignature)
    ) {
      continue;
    }

    selected.push(template);
    usedTemplateIds.add(template.id);
    usedCompositionSignatures.add(template.compositionSignature);
    if (limit != null && selected.length >= limit) break;
  }

  return selected;
}

/** Build factual shelves without repeating a show or its firework composition. */
function buildShelves(templates: ShowTemplateSummary[]): Shelf[] {
  const usedTemplateIds = new Set<string>();
  const usedCompositionSignatures = new Set<string>();
  const shelfSorts: LibrarySort[] = ['featured', 'popular', 'curated', 'recent', 'shortest'];
  const shelves = shelfSorts.map((sort) => ({
    sort,
    title: SORT_LABELS[sort],
    seeAllHref: `/library?sort=${sort}`,
    templates: templatesForShelf(
      templates,
      sort,
      SHOWS_PER_SHELF,
      usedTemplateIds,
      usedCompositionSignatures,
    ),
  }));

  return shelves.filter((shelf) => shelf.templates.length > 0);
}

type PageProps = {
  searchParams?: Promise<{ sort?: string }>;
};

export default async function LibraryPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const sort = parseSort(params.sort);

  return (
    <div className={`mx-auto w-full max-w-[1600px] ${sort ? 'space-y-6' : 'space-y-4'}`}>
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Explore shows</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Preview published show templates and choose one as a starting point for your own plan.
        </p>
      </header>
      <Suspense
        fallback={
          sort ? <LibraryGridSkeleton title={SORT_LABELS[sort]} /> : <LibraryCardsSkeleton />
        }
      >
        <ExploreShelves sort={sort} />
      </Suspense>
    </div>
  );
}

async function ExploreShelves({ sort }: { sort: LibrarySort | null }) {
  const templates = await listShowTemplates();

  if (templates.length === 0) {
    return (
      <p className="border-outline-variant/35 bg-surface-container-low text-on-surface-variant rounded-xl border border-dashed p-5 text-sm">
        No show templates are available right now. Check back later.
      </p>
    );
  }

  const shelves = buildShelves(templates);
  const activeShelf = sort
    ? {
        sort,
        title: SORT_LABELS[sort],
        seeAllHref: `/library?sort=${sort}`,
        templates: templatesForShelf(templates, sort),
      }
    : null;

  return (
    <ExplorePreviewProvider>
      {sort && activeShelf ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-on-surface text-xl font-semibold tracking-tight">
                {activeShelf.title}
              </h2>
              <p className="text-on-surface-variant mt-1 text-sm">
                {activeShelf.templates.length.toLocaleString()}{' '}
                {activeShelf.templates.length === 1 ? 'template' : 'templates'}
              </p>
            </div>
            <Link
              href="/library"
              className="text-on-surface-variant hover:text-on-surface inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--color-border-subtle)] px-4 text-sm font-medium transition-colors"
            >
              <ChevronLeft size={16} />
              Back to shelves
            </Link>
          </div>
          {activeShelf.templates.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-7">
              {activeShelf.templates.map((template) => (
                <ExploreCard key={template.id} template={template} className="w-full sm:w-full" />
              ))}
            </div>
          ) : (
            <p className="border-outline-variant/35 bg-surface-container-low text-on-surface-variant rounded-xl border border-dashed p-5 text-sm">
              No templates match this collection yet.
            </p>
          )}
        </section>
      ) : (
        <div className="space-y-8">
          {shelves.map((shelf) => (
            <ExploreRow
              key={shelf.title}
              title={shelf.title}
              templates={shelf.templates}
              seeAllHref={shelf.seeAllHref}
            />
          ))}
        </div>
      )}
    </ExplorePreviewProvider>
  );
}
