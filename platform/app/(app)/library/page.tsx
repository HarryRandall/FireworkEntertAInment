import { Suspense } from "react";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { LibraryCardsSkeleton } from "@/app/components/app/RouteSkeletons";
import { ShowTemplatePreview } from "@/app/components/app/ShowTemplatePreview";
import { LibraryControls } from "@/app/(app)/library/LibraryControls";
import { listShowTemplates } from "@/lib/admin.server";
import { listFireworkSpecifications } from "@/lib/shows.server";
import type { ShowTemplate } from "@/lib/admin.types";

type SortKey = "popular" | "recent" | "featured" | "shortest" | "budget";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "recent", label: "Most recent" },
  { key: "featured", label: "Featured" },
  { key: "shortest", label: "Shortest" },
  { key: "budget", label: "Lowest budget" },
];

function sortTemplates(templates: ShowTemplate[], sort: SortKey) {
  return [...templates].sort((a, b) => {
    if (sort === "recent") {
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    }
    if (sort === "featured") {
      return Number(b.isFeatured) - Number(a.isFeatured) || b.likeCount - a.likeCount;
    }
    if (sort === "shortest") {
      return (a.durationSeconds ?? Number.MAX_SAFE_INTEGER) - (b.durationSeconds ?? Number.MAX_SAFE_INTEGER);
    }
    if (sort === "budget") {
      return (a.totalCents ?? Number.MAX_SAFE_INTEGER) - (b.totalCents ?? Number.MAX_SAFE_INTEGER);
    }
    return b.likeCount - a.likeCount;
  });
}

type PageProps = {
  searchParams?: Promise<{
    sort?: string;
  }>;
};

export default async function LibraryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requestedSort = params?.sort;
  const sort = SORTS.some((item) => item.key === requestedSort)
    ? (requestedSort as SortKey)
    : "popular";

  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Show library"
        description="Browse ready-made pyromusical templates, preview the fixed-camera replay, then clone one into your dashboard."
      />

      <LibraryControls
        sort={sort}
        sorts={SORTS}
      />

      <Suspense fallback={<LibraryCardsSkeleton />}>
        <LibraryTemplateGrid sort={sort} />
      </Suspense>
    </div>
  );
}

async function LibraryTemplateGrid({ sort }: { sort: SortKey }) {
  const [templates, specifications] = await Promise.all([
    listShowTemplates(),
    listFireworkSpecifications(),
  ]);
  const sortedTemplates = sortTemplates(templates, sort);

  return (
    <>
      {sortedTemplates.length > 0 ? (
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
          {sortedTemplates.map((template) => (
            <ShowTemplatePreview
              key={template.id}
              template={template}
              specifications={specifications}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-outline-variant/35 bg-surface-container-low p-5 text-sm text-on-surface-variant">
          No shows are available right now. Adjust the sort or check back later.
        </p>
      )}
    </>
  );
}
