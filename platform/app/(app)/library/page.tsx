import Link from "next/link";
import { ShowTemplatePreview } from "@/app/components/app/ShowTemplatePreview";
import { listShowTemplates } from "@/lib/platform.server";
import { listFireworkSpecifications } from "@/lib/shows.server";
import type { ShowTemplate } from "@/lib/platform.types";

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
  searchParams?: Promise<{ sort?: string }>;
};

export default async function LibraryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requestedSort = params?.sort;
  const sort = SORTS.some((item) => item.key === requestedSort)
    ? (requestedSort as SortKey)
    : "popular";
  const [templates, specifications] = await Promise.all([
    listShowTemplates(),
    listFireworkSpecifications(),
  ]);
  const sortedTemplates = sortTemplates(templates, sort);

  return (
    <div className="space-y-8">
      <header className="border-b border-outline-variant/15 pb-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">
          Show library
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
          Browse ready-made pyromusical templates, preview the fixed-camera
          replay, then clone one into your dashboard.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {SORTS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "popular" ? "/library" : `/library?sort=${item.key}`}
            className={
              item.key === sort
                ? "inline-flex h-10 items-center rounded-full bg-primary-container px-4 text-sm font-bold text-on-primary-container"
                : "inline-flex h-10 items-center rounded-full border border-outline/20 px-4 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>

      {sortedTemplates.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {sortedTemplates.map((template) => (
            <ShowTemplatePreview
              key={template.id}
              template={template}
              specifications={specifications}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5 text-sm text-on-surface-variant">
          No shows are available yet. Apply the latest migrations to seed the
          library.
        </p>
      )}
    </div>
  );
}
