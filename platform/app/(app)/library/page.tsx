/** Explore page: music-app style shelves of curated show templates. */

import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { LibraryCardsSkeleton, LibraryGridSkeleton } from '@/app/components/app/RouteSkeletons';
import { ExploreCard } from '@/app/components/app/ExploreCard';
import { ExploreRow } from '@/app/components/app/ExploreRow';
import { ExplorePreviewProvider } from '@/app/components/app/ExplorePreviewContext';
import { listShowTemplates } from '@/lib/admin.server';
import { listFireworkProducts } from '@/lib/shows.server';
import type { ShowTemplate } from '@/lib/admin.types';

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

type Shelf = {
  sort: LibrarySort;
  title: string;
  seeAllHref: string;
  templates: ShowTemplate[];
};

type LibrarySort = 'featured' | 'popular' | 'hot' | 'recent' | 'shortest';

const SORT_LABELS: Record<LibrarySort, string> = {
  featured: 'Staff picks',
  popular: 'Popular this month',
  hot: 'Hot right now',
  recent: 'Fresh drops',
  shortest: 'Quick bursts',
};
const SHOWS_PER_SHELF = 30;

function parseSort(value: string | undefined): LibrarySort | null {
  if (
    value === 'featured' ||
    value === 'popular' ||
    value === 'hot' ||
    value === 'recent' ||
    value === 'shortest'
  ) {
    return value;
  }
  return null;
}

function sortTemplates(templates: ShowTemplate[], sort: LibrarySort): ShowTemplate[] {
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
  return [...templates].sort((a, b) => hashString(b.id + 'hot') - hashString(a.id + 'hot'));
}

function templateMatchesShelf(template: ShowTemplate, sort: LibrarySort): boolean {
  const shelfLabel = SORT_LABELS[sort].toLowerCase();
  const moodTags = template.moodTags.map((tag) => tag.toLowerCase());
  if (moodTags.includes(shelfLabel)) return true;
  if (sort === 'featured') return template.isFeatured;
  if (sort === 'shortest') return (template.durationSeconds ?? Number.MAX_SAFE_INTEGER) <= 75;
  return false;
}

/** Build several distinctly ordered shelves from the available templates. */
function buildShelves(templates: ShowTemplate[]): Shelf[] {
  const usedTemplateIds = new Set<string>();

  function takeUniqueShelfTemplates(sort: LibrarySort): ShowTemplate[] {
    const selected: ShowTemplate[] = [];
    const sortedTemplates = sortTemplates(templates, sort);
    const preferredTemplates = sortedTemplates.filter((template) =>
      templateMatchesShelf(template, sort),
    );
    const fallbackTemplates = sortedTemplates.filter(
      (template) => !templateMatchesShelf(template, sort),
    );
    for (const template of [...preferredTemplates, ...fallbackTemplates]) {
      if (usedTemplateIds.has(template.id)) continue;
      usedTemplateIds.add(template.id);
      selected.push(template);
      if (selected.length === SHOWS_PER_SHELF) break;
    }
    return selected;
  }

  const shelves: Shelf[] = [
    {
      sort: 'featured',
      title: SORT_LABELS.featured,
      seeAllHref: '/library?sort=featured',
      templates: takeUniqueShelfTemplates('featured'),
    },
    {
      sort: 'popular',
      title: SORT_LABELS.popular,
      seeAllHref: '/library?sort=popular',
      templates: takeUniqueShelfTemplates('popular'),
    },
    {
      sort: 'hot',
      title: SORT_LABELS.hot,
      seeAllHref: '/library?sort=hot',
      templates: takeUniqueShelfTemplates('hot'),
    },
    {
      sort: 'recent',
      title: SORT_LABELS.recent,
      seeAllHref: '/library?sort=recent',
      templates: takeUniqueShelfTemplates('recent'),
    },
    {
      sort: 'shortest',
      title: SORT_LABELS.shortest,
      seeAllHref: '/library?sort=shortest',
      templates: takeUniqueShelfTemplates('shortest'),
    },
  ];

  return shelves.filter((shelf) => shelf.templates.length > 0);
}

type PageProps = {
  searchParams?: Promise<{ sort?: string }>;
};

export default async function LibraryPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const sort = parseSort(params.sort);

  return (
    <div className={sort ? 'space-y-4' : 'space-y-2'}>
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
  const [templates, specifications] = await Promise.all([
    listShowTemplates(),
    listFireworkProducts(),
  ]);

  if (templates.length === 0) {
    return (
      <p className="border-outline-variant/35 bg-surface-container-low text-on-surface-variant rounded-xl border border-dashed p-5 text-sm">
        No shows are available right now. Check back later.
      </p>
    );
  }

  const shelves = buildShelves(templates);
  const activeShelf = sort
    ? (shelves.find((shelf) => shelf.sort === sort) ?? {
        sort,
        title: SORT_LABELS[sort],
        seeAllHref: `/library?sort=${sort}`,
        templates: sortTemplates(templates, sort).slice(0, SHOWS_PER_SHELF),
      })
    : null;

  return (
    <ExplorePreviewProvider specifications={specifications}>
      {sort && activeShelf ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-on-surface text-xl font-semibold tracking-tight">
                {activeShelf.title}
              </h2>
              <p className="text-on-surface-variant mt-1 text-sm">
                {activeShelf.templates.length.toLocaleString()} shows
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-7">
            {activeShelf.templates.map((template) => (
              <ExploreCard key={template.id} template={template} className="w-full sm:w-full" />
            ))}
          </div>
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
