"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { SelectField } from "@/app/components/ui/SelectField";

type SortKey = "popular" | "recent" | "featured" | "shortest" | "budget";

type LibraryControlsProps = {
  sort: SortKey;
  sorts: { key: SortKey; label: string }[];
};

export function LibraryControls({ sort, sorts }: LibraryControlsProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex justify-end">
      <SelectField
        value={sort}
        ariaLabel="Sort library items"
        iconLeft={<SlidersHorizontal size={16} className="text-on-surface-variant" />}
        className="w-64"
        options={sorts.map((item) => ({ value: item.key, label: item.label }))}
        onChange={(next) => {
          const params = new URLSearchParams();
          if (next !== "popular") params.set("sort", next);
          const query = params.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
      />
    </div>
  );
}
