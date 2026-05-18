import { FilterSkeleton, ListSkeleton } from "@/app/components/app/RouteSkeletons";

export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6" aria-label="Loading settings">
      <FilterSkeleton />
      <ListSkeleton rows={4} />
    </div>
  );
}
