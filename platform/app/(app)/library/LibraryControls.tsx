"use client";

import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

type SortKey = "popular" | "recent" | "featured" | "shortest" | "budget";

type LibraryControlsProps = {
  sort: SortKey;
  sorts: { key: SortKey; label: string }[];
};

export function LibraryControls({ sort, sorts }: LibraryControlsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (sortRef.current && !sortRef.current.contains(target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectedSort = sorts.find((item) => item.key === sort) ?? sorts[0];

  return (
    <div className="flex justify-end">
      <div ref={sortRef} className="relative">
        <button
          type="button"
          onClick={() => setSortOpen((open) => !open)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-outline-variant/55 bg-white px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary/35 hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <SlidersHorizontal size={16} className="text-on-surface-variant" />
          Sort: {selectedSort.label}
          <ChevronDown
            size={16}
            className={cn("text-on-surface-variant transition-transform", sortOpen && "rotate-180")}
          />
        </button>

        {sortOpen ? (
          <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-64 rounded-2xl border border-outline-variant/55 bg-white p-2 shadow-[var(--shadow-modal)]">
            <div className="grid gap-1">
              {sorts.map((item) => {
                const active = item.key === sort;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (item.key !== "popular") params.set("sort", item.key);
                      const query = params.toString();
                      router.push(query ? `${pathname}?${query}` : pathname);
                      setSortOpen(false);
                    }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-on-surface-variant hover:bg-[#EEF4FF] hover:text-primary",
                      )}
                    >
                    <span className={cn("font-medium", active && "font-semibold")}>
                      {item.label}
                    </span>
                    {active ? <Check size={15} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
